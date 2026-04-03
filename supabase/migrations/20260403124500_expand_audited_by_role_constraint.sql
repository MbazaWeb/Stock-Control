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
      'super_admin'::text
    ]
  )
);