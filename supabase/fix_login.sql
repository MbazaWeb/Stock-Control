-- ============================================
-- FIX LOGIN ISSUE - RUN IN SUPABASE SQL EDITOR
-- ============================================

-- STEP 1: Disable RLS on admin_users (fixes the chicken-and-egg problem)
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- STEP 2: Link user_id to admin record
UPDATE public.admin_users
SET user_id = '39b44744-ac96-478b-b95c-5688e5c60d2f',
    role = 'super_admin'
WHERE email = 'mbazzacodes@gmail.com';

-- STEP 3: If no row exists, insert it
INSERT INTO public.admin_users (user_id, email, role)
VALUES ('39b44744-ac96-478b-b95c-5688e5c60d2f', 'mbazzacodes@gmail.com', 'super_admin')
ON CONFLICT (email) DO UPDATE SET
  user_id = '39b44744-ac96-478b-b95c-5688e5c60d2f',
  role = 'super_admin';

-- STEP 4: Verify
SELECT id, email, user_id, role FROM public.admin_users;
