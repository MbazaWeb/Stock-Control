-- ============================================
-- FIX LOGIN ISSUE - RUN IN SUPABASE SQL EDITOR
-- ============================================
-- This script directly links the super admin user_id to fix login issues

-- Update the admin_users record with the actual Supabase auth user_id
UPDATE public.admin_users
SET user_id = '39b44744-ac96-478b-b95c-5688e5c60d2f'
WHERE email = 'mbazzacodes@gmail.com';

-- Verify the update
SELECT id, email, user_id, role 
FROM public.admin_users 
WHERE email = 'mbazzacodes@gmail.com';
