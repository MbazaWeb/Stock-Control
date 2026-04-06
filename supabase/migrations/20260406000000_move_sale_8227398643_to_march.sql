-- Move sale 8227398643 from April to March
-- This correction fixes the date placement issue for smartcard/serial 8227398643

-- Update the sale_date to March 31, 2026 (or the appropriate March date)
UPDATE public.sales_records
SET sale_date = '2026-03-31'
WHERE 
  smartcard_number = '8227398643' 
  OR serial_number = '8227398643'
  OR id = '8227398643'
  AND sale_date >= '2026-04-01'
  AND sale_date < '2026-05-01';

-- Verify the update was successful
-- SELECT id, smartcard_number, serial_number, sale_date, payment_status, package_status 
-- FROM public.sales_records 
-- WHERE smartcard_number = '8227398643' OR serial_number = '8227398643';
