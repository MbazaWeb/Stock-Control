-- ============================================
-- STOCKY DATABASE SETUP - RUN IN SUPABASE SQL EDITOR
-- ============================================

-- STEP 1: Create tables and functions
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Admin Users Table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    name text,
    role text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_users_pkey PRIMARY KEY (id),
    CONSTRAINT admin_users_email_key UNIQUE (email),
    CONSTRAINT admin_users_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'regional_admin'::text, 'admin'::text])))
);

-- Admin Region Assignments Table (for regional admins)
CREATE TABLE IF NOT EXISTS public.admin_region_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    region_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_region_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT admin_region_assignments_admin_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(id) ON DELETE CASCADE,
    CONSTRAINT admin_region_assignments_region_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE CASCADE,
    CONSTRAINT admin_region_assignments_unique UNIQUE (admin_id, region_id)
);

-- Zones Table
CREATE TABLE IF NOT EXISTS public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT zones_pkey PRIMARY KEY (id),
    CONSTRAINT zones_name_key UNIQUE (name)
);

-- Regions Table
CREATE TABLE IF NOT EXISTS public.regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    zone_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT regions_pkey PRIMARY KEY (id),
    CONSTRAINT regions_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE
);

-- Team Leaders Table
CREATE TABLE IF NOT EXISTS public.team_leaders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    region_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_leaders_pkey PRIMARY KEY (id),
    CONSTRAINT team_leaders_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL
);

-- Captains Table
CREATE TABLE IF NOT EXISTS public.captains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    team_leader_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT captains_pkey PRIMARY KEY (id),
    CONSTRAINT captains_team_leader_id_fkey FOREIGN KEY (team_leader_id) REFERENCES public.team_leaders(id) ON DELETE SET NULL
);

-- DSRs Table
CREATE TABLE IF NOT EXISTS public.dsrs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    captain_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dsrs_pkey PRIMARY KEY (id),
    CONSTRAINT dsrs_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.captains(id) ON DELETE SET NULL
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    smartcard_number text NOT NULL,
    serial_number text NOT NULL,
    stock_type text DEFAULT 'Full Set'::text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    payment_status text DEFAULT 'Pending'::text NOT NULL,
    package_status text DEFAULT 'Pending'::text NOT NULL,
    assigned_to_type text,
    assigned_to_id uuid,
    zone_id uuid,
    region_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_pkey PRIMARY KEY (id),
    CONSTRAINT inventory_smartcard_number_key UNIQUE (smartcard_number),
    CONSTRAINT inventory_serial_number_key UNIQUE (serial_number),
    CONSTRAINT inventory_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL,
    CONSTRAINT inventory_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL,
    CONSTRAINT inventory_assigned_to_type_check CHECK ((assigned_to_type = ANY (ARRAY['team_leader'::text, 'captain'::text, 'dsr'::text]))),
    CONSTRAINT inventory_package_status_check CHECK ((package_status = ANY (ARRAY['Pending'::text, 'Packaged'::text, 'No Package'::text]))),
    CONSTRAINT inventory_payment_status_check CHECK ((payment_status = ANY (ARRAY['Pending'::text, 'Paid'::text, 'Unpaid'::text]))),
    CONSTRAINT inventory_status_check CHECK ((status = ANY (ARRAY['available'::text, 'assigned'::text, 'sold'::text])))
);

-- Sales Records Table
CREATE TABLE IF NOT EXISTS public.sales_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_id uuid,
    smartcard_number text NOT NULL,
    serial_number text NOT NULL,
    stock_type text DEFAULT 'Full Set'::text NOT NULL,
    customer_name text,
    customer_phone text,
    sale_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_status text DEFAULT 'Unpaid'::text NOT NULL,
    package_status text DEFAULT 'No Package'::text NOT NULL,
    amount numeric(10,2) DEFAULT 0,
    team_leader_id uuid,
    captain_id uuid,
    dsr_id uuid,
    zone_id uuid,
    region_id uuid,
    stripe_payment_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_records_pkey PRIMARY KEY (id),
    CONSTRAINT sales_records_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE SET NULL,
    CONSTRAINT sales_records_team_leader_id_fkey FOREIGN KEY (team_leader_id) REFERENCES public.team_leaders(id) ON DELETE SET NULL,
    CONSTRAINT sales_records_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.captains(id) ON DELETE SET NULL,
    CONSTRAINT sales_records_dsr_id_fkey FOREIGN KEY (dsr_id) REFERENCES public.dsrs(id) ON DELETE SET NULL,
    CONSTRAINT sales_records_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL,
    CONSTRAINT sales_records_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL,
    CONSTRAINT sales_records_package_status_check CHECK ((package_status = ANY (ARRAY['Packaged'::text, 'No Package'::text]))),
    CONSTRAINT sales_records_payment_status_check CHECK ((payment_status = ANY (ARRAY['Paid'::text, 'Unpaid'::text])))
);

-- STEP 2: Create Triggers
-- ============================================

DROP TRIGGER IF EXISTS update_inventory_updated_at ON public.inventory;
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_records_updated_at ON public.sales_records;
CREATE TRIGGER update_sales_records_updated_at BEFORE UPDATE ON public.sales_records 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STEP 3: Enable Row Level Security
-- ============================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_region_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create Security Functions
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin_user(checking_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = checking_user_id
       OR email = (SELECT email FROM auth.users WHERE id = checking_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(checking_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE (user_id = checking_user_id
       OR email = (SELECT email FROM auth.users WHERE id = checking_user_id))
    AND role = 'super_admin'
  );
$$;

-- Function to get assigned region IDs for current user
CREATE OR REPLACE FUNCTION public.get_admin_region_ids(checking_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(ara.region_id),
    ARRAY[]::uuid[]
  )
  FROM public.admin_region_assignments ara
  JOIN public.admin_users au ON au.id = ara.admin_id
  WHERE au.user_id = checking_user_id
     OR au.email = (SELECT email FROM auth.users WHERE id = checking_user_id);
$$;

-- Function to check if user has access to a specific region
CREATE OR REPLACE FUNCTION public.has_region_access(checking_user_id uuid, check_region_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_super_admin(checking_user_id) 
    OR check_region_id = ANY(public.get_admin_region_ids(checking_user_id))
    OR (
      -- If no regions assigned, they have access to all (legacy admin behavior)
      array_length(public.get_admin_region_ids(checking_user_id), 1) IS NULL
      AND public.is_admin_user(checking_user_id)
    );
$$;

-- STEP 5: Create RLS Policies
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view own record" ON public.admin_users;
DROP POLICY IF EXISTS "Admin can link own user_id" ON public.admin_users;
DROP POLICY IF EXISTS "Users can insert own admin record" ON public.admin_users;
DROP POLICY IF EXISTS "Admin manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Admin manage admin_region_assignments" ON public.admin_region_assignments;
DROP POLICY IF EXISTS "Admin view admin_region_assignments" ON public.admin_region_assignments;
DROP POLICY IF EXISTS "Admin manage captains" ON public.captains;
DROP POLICY IF EXISTS "Admin manage dsrs" ON public.dsrs;
DROP POLICY IF EXISTS "Admin manage inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admin manage regions" ON public.regions;
DROP POLICY IF EXISTS "Admin manage sales_records" ON public.sales_records;
DROP POLICY IF EXISTS "Admin manage team_leaders" ON public.team_leaders;
DROP POLICY IF EXISTS "Admin manage zones" ON public.zones;
DROP POLICY IF EXISTS "Public read captains" ON public.captains;
DROP POLICY IF EXISTS "Public read dsrs" ON public.dsrs;
DROP POLICY IF EXISTS "Public read inventory" ON public.inventory;
DROP POLICY IF EXISTS "Public read regions" ON public.regions;
DROP POLICY IF EXISTS "Public read sales_records" ON public.sales_records;
DROP POLICY IF EXISTS "Public read team_leaders" ON public.team_leaders;
DROP POLICY IF EXISTS "Public read zones" ON public.zones;

-- Admin Users Policies
CREATE POLICY "Super admins can manage admin_users"
ON public.admin_users FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can view own record"
ON public.admin_users FOR SELECT
USING (auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Admin can link own user_id"
ON public.admin_users FOR UPDATE
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Admin Region Assignments Policies
CREATE POLICY "Super admins can manage admin_region_assignments"
ON public.admin_region_assignments FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can view own region assignments"
ON public.admin_region_assignments FOR SELECT
USING (
  admin_id IN (
    SELECT id FROM public.admin_users 
    WHERE user_id = auth.uid() 
       OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Admin Management Policies
CREATE POLICY "Admin manage captains"
ON public.captains FOR ALL
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin manage dsrs"
ON public.dsrs FOR ALL
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin manage inventory"
ON public.inventory FOR ALL
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin manage regions"
ON public.regions FOR ALL
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin manage sales_records"
ON public.sales_records FOR ALL
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin manage team_leaders"
ON public.team_leaders FOR ALL
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin manage zones"
ON public.zones FOR ALL
USING (public.is_admin_user(auth.uid()));

-- Public Read Policies
CREATE POLICY "Public read captains"
ON public.captains FOR SELECT USING (true);

CREATE POLICY "Public read dsrs"
ON public.dsrs FOR SELECT USING (true);

CREATE POLICY "Public read inventory"
ON public.inventory FOR SELECT USING (true);

CREATE POLICY "Public read regions"
ON public.regions FOR SELECT USING (true);

CREATE POLICY "Public read sales_records"
ON public.sales_records FOR SELECT USING (true);

CREATE POLICY "Public read team_leaders"
ON public.team_leaders FOR SELECT USING (true);

CREATE POLICY "Public read zones"
ON public.zones FOR SELECT USING (true);

-- STEP 6: Grant Admin Access
-- ============================================
-- NOTE: Set user_id directly for the super admin account

INSERT INTO public.admin_users (user_id, email, role)
VALUES (
  '39b44744-ac96-478b-b95c-5688e5c60d2f',
  'mbazzacodes@gmail.com',
  'super_admin'
)
ON CONFLICT (email) DO UPDATE SET
  role = 'super_admin',
  user_id = '39b44744-ac96-478b-b95c-5688e5c60d2f';

-- STEP 7: Create Excel Import Templates Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.import_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_name text NOT NULL,
    template_type text NOT NULL,
    column_headers jsonb NOT NULL,
    sample_data jsonb,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT import_templates_pkey PRIMARY KEY (id),
    CONSTRAINT import_templates_name_key UNIQUE (template_name)
);

ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read import_templates" ON public.import_templates;
DROP POLICY IF EXISTS "Admin manage import_templates" ON public.import_templates;

CREATE POLICY "Public read import_templates"
ON public.import_templates FOR SELECT USING (true);

CREATE POLICY "Admin manage import_templates"
ON public.import_templates FOR ALL
USING (public.is_admin_user(auth.uid()));

-- Insert Excel Import Format Templates
-- ============================================

-- Inventory Import Template
INSERT INTO public.import_templates (template_name, template_type, column_headers, sample_data, description)
VALUES (
  'Inventory Import',
  'inventory',
  '["Smartcard Number", "Serial Number", "Stock Type"]',
  '[
    {"Smartcard Number": "1234567890", "Serial Number": "SN-ABC123", "Stock Type": "Full Set"},
    {"Smartcard Number": "0987654321", "Serial Number": "SN-XYZ789", "Stock Type": "Decoder Only"},
    {"Smartcard Number": "1122334455", "Serial Number": "SN-DEF456", "Stock Type": "Dish Only"}
  ]',
  'Import inventory items. Column A: Smartcard Number (10 digits), Column B: Serial Number (uppercase), Column C: Stock Type (Full Set, Decoder Only, Dish Only)'
)
ON CONFLICT (template_name) DO NOTHING;

-- Sales Records Import Template
INSERT INTO public.import_templates (template_name, template_type, column_headers, sample_data, description)
VALUES (
  'Sales Import',
  'sales',
  '["Smartcard Number", "Serial Number", "Customer Name", "Customer Phone", "Sale Date", "Payment Status", "Package Status"]',
  '[
    {"Smartcard Number": "1234567890", "Serial Number": "SN-ABC123", "Customer Name": "John Doe", "Customer Phone": "+254712345678", "Sale Date": "2026-03-25", "Payment Status": "Paid", "Package Status": "Packaged"},
    {"Smartcard Number": "0987654321", "Serial Number": "SN-XYZ789", "Customer Name": "Jane Smith", "Customer Phone": "+254798765432", "Sale Date": "2026-03-24", "Payment Status": "Unpaid", "Package Status": "No Package"}
  ]',
  'Import sales records. Payment Status: Paid/Unpaid. Package Status: Packaged/No Package'
)
ON CONFLICT (template_name) DO NOTHING;

-- Team Leaders Import Template
INSERT INTO public.import_templates (template_name, template_type, column_headers, sample_data, description)
VALUES (
  'Team Leaders Import',
  'team_leaders',
  '["Name", "Phone", "Region"]',
  '[
    {"Name": "John Leader", "Phone": "+254712345678", "Region": "Nairobi Central"},
    {"Name": "Jane Leader", "Phone": "+254798765432", "Region": "Mombasa"}
  ]',
  'Import team leaders. Region must match an existing region name in the system.'
)
ON CONFLICT (template_name) DO NOTHING;

-- Captains Import Template
INSERT INTO public.import_templates (template_name, template_type, column_headers, sample_data, description)
VALUES (
  'Captains Import',
  'captains',
  '["Name", "Phone", "Team Leader"]',
  '[
    {"Name": "Captain Alpha", "Phone": "+254712345678", "Team Leader": "John Leader"},
    {"Name": "Captain Beta", "Phone": "+254798765432", "Team Leader": "Jane Leader"}
  ]',
  'Import captains. Team Leader must match an existing team leader name in the system.'
)
ON CONFLICT (template_name) DO NOTHING;

-- DSRs Import Template
INSERT INTO public.import_templates (template_name, template_type, column_headers, sample_data, description)
VALUES (
  'DSRs Import',
  'dsrs',
  '["Name", "Phone", "Captain"]',
  '[
    {"Name": "DSR One", "Phone": "+254712345678", "Captain": "Captain Alpha"},
    {"Name": "DSR Two", "Phone": "+254798765432", "Captain": "Captain Beta"}
  ]',
  'Import DSRs (Direct Sales Representatives). Captain must match an existing captain name in the system.'
)
ON CONFLICT (template_name) DO NOTHING;

-- Zones Import Template
INSERT INTO public.import_templates (template_name, template_type, column_headers, sample_data, description)
VALUES (
  'Zones Import',
  'zones',
  '["Zone Name"]',
  '[
    {"Zone Name": "Central"},
    {"Zone Name": "Coast"},
    {"Zone Name": "Western"}
  ]',
  'Import zones. Zone names must be unique.'
)
ON CONFLICT (template_name) DO NOTHING;

-- Regions Import Template
INSERT INTO public.import_templates (template_name, template_type, column_headers, sample_data, description)
VALUES (
  'Regions Import',
  'regions',
  '["Region Name", "Zone"]',
  '[
    {"Region Name": "Nairobi Central", "Zone": "Central"},
    {"Region Name": "Mombasa", "Zone": "Coast"},
    {"Region Name": "Kisumu", "Zone": "Western"}
  ]',
  'Import regions. Zone must match an existing zone name in the system.'
)
ON CONFLICT (template_name) DO NOTHING;

-- ============================================
-- EXCEL IMPORT FORMAT REFERENCE
-- ============================================
/*
INVENTORY EXCEL FORMAT:
-----------------------
| Column A          | Column B        | Column C      |
|-------------------|-----------------|---------------|
| Smartcard Number  | Serial Number   | Stock Type    |
| 1234567890        | SN-ABC123       | Full Set      |
| 0987654321        | SN-XYZ789       | Decoder Only  |

Stock Types: "Full Set", "Decoder Only", "Dish Only"

VALIDATION RULES:
- Smartcard Number: 10-digit number
- Serial Number: Uppercase alphanumeric with hyphens allowed
- Stock Type: Must be one of the allowed values

SALES EXCEL FORMAT:
-------------------
| Smartcard | Serial    | Customer    | Phone          | Sale Date  | Payment | Package    |
|-----------|-----------|-------------|----------------|------------|---------|------------|
| 1234567890| SN-ABC123 | John Doe    | +254712345678  | 2026-03-25 | Paid    | Packaged   |

Payment Status: "Paid", "Unpaid"
Package Status: "Packaged", "No Package"
*/

-- ============================================
-- SETUP COMPLETE!
-- ============================================
