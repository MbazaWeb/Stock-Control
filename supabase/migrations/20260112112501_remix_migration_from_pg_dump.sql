CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_users_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text])))
);


--
-- Name: captains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.captains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    team_leader_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dsrs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsrs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    captain_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
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
    CONSTRAINT inventory_assigned_to_type_check CHECK ((assigned_to_type = ANY (ARRAY['team_leader'::text, 'captain'::text, 'dsr'::text]))),
    CONSTRAINT inventory_package_status_check CHECK ((package_status = ANY (ARRAY['Pending'::text, 'Packaged'::text, 'No Package'::text]))),
    CONSTRAINT inventory_payment_status_check CHECK ((payment_status = ANY (ARRAY['Pending'::text, 'Paid'::text, 'Unpaid'::text]))),
    CONSTRAINT inventory_status_check CHECK ((status = ANY (ARRAY['available'::text, 'assigned'::text, 'sold'::text])))
);


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    zone_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_records (
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
    CONSTRAINT sales_records_package_status_check CHECK ((package_status = ANY (ARRAY['Packaged'::text, 'No Package'::text]))),
    CONSTRAINT sales_records_payment_status_check CHECK ((payment_status = ANY (ARRAY['Paid'::text, 'Unpaid'::text])))
);


--
-- Name: team_leaders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_leaders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    region_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: captains captains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captains
    ADD CONSTRAINT captains_pkey PRIMARY KEY (id);


--
-- Name: dsrs dsrs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsrs
    ADD CONSTRAINT dsrs_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_serial_number_key UNIQUE (serial_number);


--
-- Name: inventory inventory_smartcard_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_smartcard_number_key UNIQUE (smartcard_number);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: sales_records sales_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_records
    ADD CONSTRAINT sales_records_pkey PRIMARY KEY (id);


--
-- Name: team_leaders team_leaders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_leaders
    ADD CONSTRAINT team_leaders_pkey PRIMARY KEY (id);


--
-- Name: zones zones_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_name_key UNIQUE (name);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: inventory update_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales_records update_sales_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_records_updated_at BEFORE UPDATE ON public.sales_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: captains captains_team_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.captains
    ADD CONSTRAINT captains_team_leader_id_fkey FOREIGN KEY (team_leader_id) REFERENCES public.team_leaders(id) ON DELETE SET NULL;


--
-- Name: dsrs dsrs_captain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsrs
    ADD CONSTRAINT dsrs_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.captains(id) ON DELETE SET NULL;


--
-- Name: inventory inventory_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: inventory inventory_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: regions regions_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- Name: sales_records sales_records_captain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_records
    ADD CONSTRAINT sales_records_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.captains(id) ON DELETE SET NULL;


--
-- Name: sales_records sales_records_dsr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_records
    ADD CONSTRAINT sales_records_dsr_id_fkey FOREIGN KEY (dsr_id) REFERENCES public.dsrs(id) ON DELETE SET NULL;


--
-- Name: sales_records sales_records_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_records
    ADD CONSTRAINT sales_records_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE SET NULL;


--
-- Name: sales_records sales_records_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_records
    ADD CONSTRAINT sales_records_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: sales_records sales_records_team_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_records
    ADD CONSTRAINT sales_records_team_leader_id_fkey FOREIGN KEY (team_leader_id) REFERENCES public.team_leaders(id) ON DELETE SET NULL;


--
-- Name: sales_records sales_records_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_records
    ADD CONSTRAINT sales_records_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: team_leaders team_leaders_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_leaders
    ADD CONSTRAINT team_leaders_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE SET NULL;


--
-- Name: admin_users Admin manage admin_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage admin_users" ON public.admin_users USING ((EXISTS ( SELECT 1
   FROM public.admin_users admin_users_1
  WHERE ((admin_users_1.user_id = auth.uid()) AND (admin_users_1.role = 'super_admin'::text)))));


--
-- Name: captains Admin manage captains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage captains" ON public.captains USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: dsrs Admin manage dsrs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage dsrs" ON public.dsrs USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: inventory Admin manage inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage inventory" ON public.inventory USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: regions Admin manage regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage regions" ON public.regions USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: sales_records Admin manage sales_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage sales_records" ON public.sales_records USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: team_leaders Admin manage team_leaders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage team_leaders" ON public.team_leaders USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: zones Admin manage zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin manage zones" ON public.zones USING ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));


--
-- Name: captains Public read captains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read captains" ON public.captains FOR SELECT USING (true);


--
-- Name: dsrs Public read dsrs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read dsrs" ON public.dsrs FOR SELECT USING (true);


--
-- Name: inventory Public read inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read inventory" ON public.inventory FOR SELECT USING (true);


--
-- Name: regions Public read regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read regions" ON public.regions FOR SELECT USING (true);


--
-- Name: sales_records Public read sales_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read sales_records" ON public.sales_records FOR SELECT USING (true);


--
-- Name: team_leaders Public read team_leaders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read team_leaders" ON public.team_leaders FOR SELECT USING (true);


--
-- Name: zones Public read zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read zones" ON public.zones FOR SELECT USING (true);


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: captains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.captains ENABLE ROW LEVEL SECURITY;

--
-- Name: dsrs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dsrs ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;

--
-- Name: team_leaders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;

--
-- Name: zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;