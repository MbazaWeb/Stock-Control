-- Create pending_sales table for public sale submissions awaiting admin approval
CREATE TABLE public.pending_sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_id uuid,
    smartcard_number text NOT NULL,
    serial_number text NOT NULL,
    stock_type text DEFAULT 'Full Set'::text NOT NULL,
    customer_name text,
    sale_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_status text DEFAULT 'Unpaid'::text NOT NULL,
    package_status text DEFAULT 'No Package'::text NOT NULL,
    team_leader_id uuid,
    captain_id uuid,
    dsr_id uuid,
    zone_id uuid,
    region_id uuid,
    notes text,
    approval_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pending_sales_pkey PRIMARY KEY (id),
    CONSTRAINT pending_sales_payment_status_check CHECK ((payment_status = ANY (ARRAY['Paid'::text, 'Unpaid'::text]))),
    CONSTRAINT pending_sales_package_status_check CHECK ((package_status = ANY (ARRAY['Packaged'::text, 'No Package'::text]))),
    CONSTRAINT pending_sales_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

-- Prevent duplicate pending sales for the same inventory item
CREATE UNIQUE INDEX pending_sales_inventory_pending_idx ON public.pending_sales (inventory_id) WHERE (approval_status = 'pending');

-- Foreign keys
ALTER TABLE ONLY public.pending_sales
    ADD CONSTRAINT pending_sales_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pending_sales
    ADD CONSTRAINT pending_sales_team_leader_id_fkey FOREIGN KEY (team_leader_id) REFERENCES public.team_leaders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pending_sales
    ADD CONSTRAINT pending_sales_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.captains(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pending_sales
    ADD CONSTRAINT pending_sales_dsr_id_fkey FOREIGN KEY (dsr_id) REFERENCES public.dsrs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pending_sales
    ADD CONSTRAINT pending_sales_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.pending_sales
    ADD CONSTRAINT pending_sales_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;

-- Auto-update updated_at
CREATE TRIGGER update_pending_sales_updated_at BEFORE UPDATE ON public.pending_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.pending_sales ENABLE ROW LEVEL SECURITY;

-- Public can read pending_sales
CREATE POLICY "Public read pending_sales" ON public.pending_sales FOR SELECT USING (true);

-- Public can insert pending_sales (anonymous users can submit sale requests)
CREATE POLICY "Public insert pending_sales" ON public.pending_sales FOR INSERT WITH CHECK (true);

-- Admin can manage (select, update, delete) pending_sales
CREATE POLICY "Admin manage pending_sales" ON public.pending_sales USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));
