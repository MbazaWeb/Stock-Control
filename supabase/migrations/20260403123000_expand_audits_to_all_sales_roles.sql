ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS audit_target_type text;

ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS sold_smartcards text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS stock_in_hand_smartcards text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS unpaid_smartcards text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS no_package_smartcards text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS captain_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS dsr_count integer NOT NULL DEFAULT 0;

UPDATE public.audits
SET audit_target_type = 'dsr'
WHERE audit_target_type IS NULL;

ALTER TABLE public.audits
ALTER COLUMN dsr_id DROP NOT NULL;

ALTER TABLE public.audits
ALTER COLUMN audit_target_type SET NOT NULL;

ALTER TABLE public.audits
DROP CONSTRAINT IF EXISTS audits_target_type_check;

ALTER TABLE public.audits
DROP CONSTRAINT IF EXISTS audits_audited_by_role_check;

ALTER TABLE public.audits
ADD CONSTRAINT audits_target_type_check
CHECK (audit_target_type = ANY (ARRAY['team_leader'::text, 'captain'::text, 'dsr'::text]));

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

ALTER TABLE public.audits
DROP CONSTRAINT IF EXISTS audits_target_reference_check;

ALTER TABLE public.audits
ADD CONSTRAINT audits_target_reference_check
CHECK (
  (audit_target_type = 'team_leader' AND team_leader_id IS NOT NULL AND captain_id IS NULL AND dsr_id IS NULL)
  OR (audit_target_type = 'captain' AND team_leader_id IS NOT NULL AND captain_id IS NOT NULL AND dsr_id IS NULL)
  OR (audit_target_type = 'dsr' AND dsr_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_audits_target_type ON public.audits (audit_target_type);