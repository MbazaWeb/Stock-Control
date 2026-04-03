ALTER TABLE public.admin_users
DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users
ADD CONSTRAINT admin_users_role_check
CHECK (
  role = ANY (
    ARRAY[
      'super_admin'::text,
      'regional_admin'::text,
      'admin'::text,
      'team_leader'::text,
      'captain'::text,
      'dsr'::text
    ]
  )
);