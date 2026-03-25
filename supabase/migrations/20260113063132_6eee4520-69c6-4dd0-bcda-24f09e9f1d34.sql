-- Drop the problematic RLS policy that causes infinite recursion
DROP POLICY IF EXISTS "Admin manage admin_users" ON public.admin_users;

-- Create a security definer function to check if user is admin
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
  );
$$;

-- Create a security definer function to check if user is super admin
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
    WHERE user_id = checking_user_id
    AND role = 'super_admin'
  );
$$;

-- Create new RLS policies using the security definer functions
CREATE POLICY "Super admins can manage admin_users"
ON public.admin_users
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Allow admins to read their own record
CREATE POLICY "Admins can view own record"
ON public.admin_users
FOR SELECT
USING (auth.uid() = user_id);

-- Allow any authenticated user to insert during registration (their own record)
CREATE POLICY "Users can insert own admin record"
ON public.admin_users
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update other tables to use the new function
DROP POLICY IF EXISTS "Admin manage captains" ON public.captains;
DROP POLICY IF EXISTS "Admin manage dsrs" ON public.dsrs;
DROP POLICY IF EXISTS "Admin manage inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admin manage regions" ON public.regions;
DROP POLICY IF EXISTS "Admin manage sales_records" ON public.sales_records;
DROP POLICY IF EXISTS "Admin manage team_leaders" ON public.team_leaders;
DROP POLICY IF EXISTS "Admin manage zones" ON public.zones;

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