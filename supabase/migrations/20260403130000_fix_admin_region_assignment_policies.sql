ALTER TABLE public.admin_region_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage admin_region_assignments" ON public.admin_region_assignments;
DROP POLICY IF EXISTS "Admins can view own region assignments" ON public.admin_region_assignments;
DROP POLICY IF EXISTS "Admin view admin_region_assignments" ON public.admin_region_assignments;
DROP POLICY IF EXISTS "Admin manage admin_region_assignments" ON public.admin_region_assignments;

CREATE POLICY "Super admins can manage admin_region_assignments"
ON public.admin_region_assignments
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can view own region assignments"
ON public.admin_region_assignments
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR admin_id IN (
    SELECT id
    FROM public.admin_users
    WHERE user_id = auth.uid()
  )
);