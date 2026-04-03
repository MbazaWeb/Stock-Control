CREATE OR REPLACE FUNCTION public.can_manage_sales_role_users(checking_user_id uuid)
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
      AND role IN ('super_admin', 'admin')
  );
$$;

DROP POLICY IF EXISTS "Admins can manage sales role admin users" ON public.admin_users;

CREATE POLICY "Admins can manage sales role admin users"
ON public.admin_users
FOR ALL
USING (
  public.can_manage_sales_role_users(auth.uid())
  AND role IN ('team_leader', 'captain', 'dsr')
)
WITH CHECK (
  public.can_manage_sales_role_users(auth.uid())
  AND role IN ('team_leader', 'captain', 'dsr')
);