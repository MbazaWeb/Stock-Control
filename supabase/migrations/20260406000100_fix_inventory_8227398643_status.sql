-- Fix inventory status for smartcard 8227398643 - restore to available
-- This item was marked as sold but the sale was deleted, so it should be available for reassignment

UPDATE public.inventory
SET 
  status = 'available',
  assigned_to_type = NULL,
  assigned_to_id = NULL,
  payment_status = 'Unpaid',
  package_status = 'No Package'
WHERE 
  smartcard_number = '8227398643' 
  OR serial_number = '5075739175';

-- Verify the update
-- SELECT id, smartcard_number, serial_number, status, payment_status, package_status, assigned_to_type, assigned_to_id 
-- FROM public.inventory 
-- WHERE smartcard_number = '8227398643' OR serial_number = '5075739175';
