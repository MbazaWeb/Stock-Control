DROP POLICY IF EXISTS "Team leaders manage own captains" ON public.captains;
DROP POLICY IF EXISTS "Team leaders manage own dsrs" ON public.dsrs;
DROP POLICY IF EXISTS "Captains manage own dsrs" ON public.dsrs;

CREATE POLICY "Team leaders manage own captains"
ON public.captains
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'team_leader'
      AND team_leader_id = captains.team_leader_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'team_leader'
      AND team_leader_id = captains.team_leader_id
  )
);

CREATE POLICY "Team leaders manage own dsrs"
ON public.dsrs
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    JOIN public.captains ON captains.id = dsrs.captain_id
    WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'team_leader'
      AND admin_users.team_leader_id = captains.team_leader_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    JOIN public.captains ON captains.id = dsrs.captain_id
    WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'team_leader'
      AND admin_users.team_leader_id = captains.team_leader_id
  )
);

CREATE POLICY "Captains manage own dsrs"
ON public.dsrs
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'captain'
      AND captain_id = dsrs.captain_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'captain'
      AND captain_id = dsrs.captain_id
  )
);