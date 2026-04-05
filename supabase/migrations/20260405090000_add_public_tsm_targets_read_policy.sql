-- Add public read access to tsm_targets for the public sales dashboard
-- This allows unauthenticated users to view regional sales targets and performance data
--
-- ISSUE: The tsm_targets table was created with RLS enabled but only had an admin-only policy.
-- This blocked all public access. This fix adds a SELECT policy allowing unauthenticated access.
--
-- The original policy "Admins can manage tsm targets" blocks all non-admin reads.
-- We add this new policy "Public read access to tsm targets" to enable public SELECT access.
-- RLS policies are evaluated with OR logic, so this new policy will allow public reads.

-- Drop existing public read policy if it exists (idempotent)
DROP POLICY IF EXISTS "Public read access to tsm targets" ON public.tsm_targets;

-- Create policy allowing public read access to tsm targets
CREATE POLICY "Public read access to tsm targets" ON public.tsm_targets
  FOR SELECT
  USING (true);




