-- Create sales_targets table for storing monthly targets for team leaders
CREATE TABLE IF NOT EXISTS public.sales_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_leader_id uuid NOT NULL REFERENCES team_leaders(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  target_amount integer NOT NULL CHECK (target_amount > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  
  -- Ensure one target per TL per month
  UNIQUE(team_leader_id, year, month)
);

-- Create captain_targets table for storing monthly targets for captains
CREATE TABLE IF NOT EXISTS public.captain_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  captain_id uuid NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
  team_leader_id uuid NOT NULL REFERENCES team_leaders(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  target_amount integer NOT NULL CHECK (target_amount > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  
  -- Ensure one target per captain per month
  UNIQUE(captain_id, year, month)
);

-- Create tsm_targets table for storing monthly targets for TSMs (region-based)
CREATE TABLE IF NOT EXISTS public.tsm_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  target_amount integer NOT NULL CHECK (target_amount > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  
  -- Ensure one target per region per month
  UNIQUE(region_id, year, month)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_targets_team_leader ON public.sales_targets(team_leader_id, year, month);
CREATE INDEX IF NOT EXISTS idx_sales_targets_year_month ON public.sales_targets(year, month);
CREATE INDEX IF NOT EXISTS idx_captain_targets_captain ON public.captain_targets(captain_id, year, month);
CREATE INDEX IF NOT EXISTS idx_captain_targets_year_month ON public.captain_targets(year, month);
CREATE INDEX IF NOT EXISTS idx_tsm_targets_region ON public.tsm_targets(region_id, year, month);
CREATE INDEX IF NOT EXISTS idx_tsm_targets_year_month ON public.tsm_targets(year, month);

-- Enable RLS on all tables
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captain_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tsm_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_targets (TL and Admins can manage)
CREATE POLICY "TLs can view their own targets" ON public.sales_targets
  FOR SELECT USING (
    team_leader_id = auth.uid() OR
    auth.jwt() ->> 'role' = 'authenticated' AND auth.jwt() ->> 'user_role' = 'admin'
  );

CREATE POLICY "Admins can create/update TL targets" ON public.sales_targets
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

-- RLS Policies for captain_targets (Captains and TLs can view, Admins can manage)
CREATE POLICY "Captains can view their own targets" ON public.captain_targets
  FOR SELECT USING (
    captain_id = auth.uid() OR
    team_leader_id = auth.uid() OR
    auth.jwt() ->> 'user_role' = 'admin'
  );

CREATE POLICY "Admins can manage captain targets" ON public.captain_targets
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

-- RLS Policies for tsm_targets (TSMs and Admins can view)
CREATE POLICY "TSMs can view region targets" ON public.tsm_targets
  FOR SELECT USING (
    auth.jwt() ->> 'user_role' = 'admin' OR
    auth.jwt() ->> 'user_role' = 'tsm'
  );

CREATE POLICY "Admins can manage TSM targets" ON public.tsm_targets
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

-- Create function to calculate monthly to date target based on days elapsed
CREATE OR REPLACE FUNCTION public.calculate_monthly_to_date_target(
  daily_target numeric,
  p_year integer DEFAULT EXTRACT(YEAR FROM NOW()),
  p_month integer DEFAULT EXTRACT(MONTH FROM NOW())
)
RETURNS integer AS $$
DECLARE
  first_day date;
  today date;
  days_elapsed integer;
BEGIN
  first_day := make_date(p_year, p_month, 1);
  today := CURRENT_DATE;
  
  -- If today is before the first day of the month, return 0
  IF today < first_day THEN
    RETURN 0;
  END IF;
  
  -- Calculate days from start of month to today (inclusive)
  days_elapsed := EXTRACT(DAY FROM today);
  
  RETURN FLOOR(daily_target * days_elapsed)::integer;
END;
$$ LANGUAGE plpgsql;
