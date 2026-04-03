CREATE OR REPLACE FUNCTION public.sale_completion_status(target_dsr_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN target_dsr_id IS NULL THEN 'incomplete_not_scanned'
    ELSE 'complete'
  END;
$$;

ALTER TABLE public.sales_records
ADD COLUMN IF NOT EXISTS sale_completion_status text
GENERATED ALWAYS AS (public.sale_completion_status(dsr_id)) STORED;

ALTER TABLE public.pending_sales
ADD COLUMN IF NOT EXISTS sale_completion_status text
GENERATED ALWAYS AS (public.sale_completion_status(dsr_id)) STORED;

COMMENT ON COLUMN public.sales_records.sale_completion_status IS 'Computed completion state. Sales without a DSR remain incomplete_not_scanned.';
COMMENT ON COLUMN public.pending_sales.sale_completion_status IS 'Computed completion state. Pending sales without a DSR remain incomplete_not_scanned.';

CREATE OR REPLACE VIEW public.sales_records_with_completion
WITH (security_invoker = true)
AS
SELECT
  sales_records.*,
  (sales_records.dsr_id IS NOT NULL) AS is_sale_complete
FROM public.sales_records;

CREATE OR REPLACE VIEW public.pending_sales_with_completion
WITH (security_invoker = true)
AS
SELECT
  pending_sales.*,
  (pending_sales.dsr_id IS NOT NULL) AS is_sale_complete
FROM public.pending_sales;

GRANT SELECT ON public.sales_records_with_completion TO anon, authenticated, service_role;
GRANT SELECT ON public.pending_sales_with_completion TO anon, authenticated, service_role;
