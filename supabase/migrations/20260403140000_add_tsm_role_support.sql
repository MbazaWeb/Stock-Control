ALTER TABLE public.admin_users
DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users
ADD CONSTRAINT admin_users_role_check
CHECK (
  role = ANY (
    ARRAY[
      'super_admin'::text,
      'regional_admin'::text,
      'tsm'::text,
      'admin'::text,
      'team_leader'::text,
      'captain'::text,
      'dsr'::text
    ]
  )
);

ALTER TABLE public.audits
DROP CONSTRAINT IF EXISTS audits_audited_by_role_check;

ALTER TABLE public.audits
ADD CONSTRAINT audits_audited_by_role_check
CHECK (
  audited_by_role = ANY (
    ARRAY[
      'team_leader'::text,
      'captain'::text,
      'admin'::text,
      'regional_admin'::text,
      'tsm'::text,
      'super_admin'::text
    ]
  )
);