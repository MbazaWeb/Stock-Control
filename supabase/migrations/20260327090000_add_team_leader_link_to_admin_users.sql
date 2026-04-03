ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS team_leader_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_users_team_leader_id_fkey'
  ) THEN
    ALTER TABLE public.admin_users
    ADD CONSTRAINT admin_users_team_leader_id_fkey
    FOREIGN KEY (team_leader_id) REFERENCES public.team_leaders(id) ON DELETE SET NULL;
  END IF;
END $$;