-- Add public read access to sales_targets for the public sales dashboard
-- This allows unauthenticated users to view team leader targets and performance data
--
-- ISSUE: The sales_targets table was created with RLS enabled but only had admin and TL-specific policies.
-- This blocked all public access. This fix adds a SELECT policy allowing unauthenticated access.

-- Drop existing public read policy if it exists (idempotent)
DROP POLICY IF EXISTS "Public read access to sales targets" ON public.sales_targets;

-- Create policy allowing public read access to sales targets
CREATE POLICY "Public read access to sales targets" ON public.sales_targets
  FOR SELECT
  USING (true);
