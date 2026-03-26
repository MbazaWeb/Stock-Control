-- Add DSR number, FSS account, and working station fields to dsrs table
ALTER TABLE public.dsrs
  ADD COLUMN IF NOT EXISTS dsr_number text,
  ADD COLUMN IF NOT EXISTS has_fss_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fss_username text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS ward text,
  ADD COLUMN IF NOT EXISTS street_village text;
