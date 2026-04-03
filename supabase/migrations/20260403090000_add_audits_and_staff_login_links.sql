ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS captain_id uuid,
ADD COLUMN IF NOT EXISTS dsr_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_users_captain_id_fkey'
  ) THEN
    ALTER TABLE public.admin_users
    ADD CONSTRAINT admin_users_captain_id_fkey
    FOREIGN KEY (captain_id) REFERENCES public.captains(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_users_dsr_id_fkey'
  ) THEN
    ALTER TABLE public.admin_users
    ADD CONSTRAINT admin_users_dsr_id_fkey
    FOREIGN KEY (dsr_id) REFERENCES public.dsrs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_captain_id_unique
ON public.admin_users (captain_id)
WHERE captain_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_dsr_id_unique
ON public.admin_users (dsr_id)
WHERE dsr_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.audits (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  audit_date date DEFAULT CURRENT_DATE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  audited_by_admin_user_id uuid,
  audited_by_role text NOT NULL,
  team_leader_id uuid,
  captain_id uuid,
  dsr_id uuid NOT NULL,
  sales_count integer DEFAULT 0 NOT NULL,
  total_stock integer DEFAULT 0 NOT NULL,
  issues text,
  notes text,
  status text DEFAULT 'ok'::text NOT NULL,
  CONSTRAINT audits_pkey PRIMARY KEY (id),
  CONSTRAINT audits_audited_by_role_check CHECK ((audited_by_role = ANY (ARRAY['team_leader'::text, 'captain'::text]))),
  CONSTRAINT audits_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'issue'::text]))),
  CONSTRAINT audits_sales_count_check CHECK ((sales_count >= 0)),
  CONSTRAINT audits_total_stock_check CHECK ((total_stock >= 0))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audits_audited_by_admin_user_id_fkey'
  ) THEN
    ALTER TABLE public.audits
    ADD CONSTRAINT audits_audited_by_admin_user_id_fkey
    FOREIGN KEY (audited_by_admin_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audits_team_leader_id_fkey'
  ) THEN
    ALTER TABLE public.audits
    ADD CONSTRAINT audits_team_leader_id_fkey
    FOREIGN KEY (team_leader_id) REFERENCES public.team_leaders(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audits_captain_id_fkey'
  ) THEN
    ALTER TABLE public.audits
    ADD CONSTRAINT audits_captain_id_fkey
    FOREIGN KEY (captain_id) REFERENCES public.captains(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audits_dsr_id_fkey'
  ) THEN
    ALTER TABLE public.audits
    ADD CONSTRAINT audits_dsr_id_fkey
    FOREIGN KEY (dsr_id) REFERENCES public.dsrs(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audits_audit_date_idx ON public.audits (audit_date DESC);
CREATE INDEX IF NOT EXISTS audits_dsr_id_idx ON public.audits (dsr_id);
CREATE INDEX IF NOT EXISTS audits_team_leader_id_idx ON public.audits (team_leader_id);
CREATE INDEX IF NOT EXISTS audits_captain_id_idx ON public.audits (captain_id);

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read audits" ON public.audits;
CREATE POLICY "Admin read audits"
ON public.audits FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin insert audits" ON public.audits;
CREATE POLICY "Admin insert audits"
ON public.audits FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin update audits" ON public.audits;
CREATE POLICY "Admin update audits"
ON public.audits FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
  )
);
