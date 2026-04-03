ALTER TABLE public.pending_sales
ADD COLUMN IF NOT EXISTS submitted_by_admin_user_id uuid NULL REFERENCES public.admin_users(id) ON DELETE SET NULL;

ALTER TABLE public.pending_sales
ADD COLUMN IF NOT EXISTS submitted_by_role text NULL;

CREATE INDEX IF NOT EXISTS idx_pending_sales_submitted_by_admin_user_id
ON public.pending_sales (submitted_by_admin_user_id);

COMMENT ON COLUMN public.pending_sales.submitted_by_admin_user_id IS 'Admin user record that submitted the pending sale on behalf of a TL or captain.';
COMMENT ON COLUMN public.pending_sales.submitted_by_role IS 'Role of the submitting admin user at submission time.';