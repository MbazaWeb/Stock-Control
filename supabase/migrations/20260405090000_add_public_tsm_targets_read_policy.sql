-- Add public read access to tsm_targets for the public sales dashboard
-- This allows unauthenticated users to view regional sales targets

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "Public read access to tsm targets" ON public.tsm_targets;

-- Create policy allowing public read access to tsm targets
CREATE POLICY "Public read access to tsm targets" ON public.tsm_targets
  FOR SELECT
  USING (true);

