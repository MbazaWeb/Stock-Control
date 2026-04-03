import {
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  AdminUser,
  AssignedRegion,
  AuthContext,
  AuthContextType,
  CaptainProfile,
  DSRProfile,
  TeamLeaderProfile,
} from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [assignedRegions, setAssignedRegions] = useState<AssignedRegion[]>([]);
  const [currentTeamLeader, setCurrentTeamLeader] = useState<TeamLeaderProfile | null>(null);
  const [currentCaptain, setCurrentCaptain] = useState<CaptainProfile | null>(null);
  const [currentDSR, setCurrentDSR] = useState<DSRProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminChecked, setAdminChecked] = useState(false);

  const clearScopedProfiles = useCallback(() => {
    setCurrentTeamLeader(null);
    setCurrentCaptain(null);
    setCurrentDSR(null);
  }, []);

  const fetchAssignedRegions = useCallback(async (adminId: string) => {
    try {
      const { data } = await supabase
        .from('admin_region_assignments')
        .select('region_id, regions:region_id(id, name)')
        .eq('admin_id', adminId);

      if (data) {
        const regions = data
          .map((item: { region_id: string; regions: { id: string; name: string } | null }) => item.regions)
          .filter((region): region is AssignedRegion => region !== null);
        setAssignedRegions(regions);
      }
    } catch (error) {
      console.error('Error fetching assigned regions:', error);
      setAssignedRegions([]);
    }
  }, []);

  const fetchTeamLeaderProfile = useCallback(async (teamLeaderId: string) => {
    try {
      const { data } = await supabase
        .from('team_leaders')
        .select('id, name, phone, region_id, regions:region_id(name)')
        .eq('id', teamLeaderId)
        .maybeSingle();

      if (data) {
        const regionName = (data as { regions?: { name?: string } | null }).regions?.name || null;
        setCurrentTeamLeader({
          id: data.id,
          name: data.name,
          phone: data.phone,
          region_id: data.region_id,
          region_name: regionName,
        });
        setAssignedRegions(
          data.region_id && regionName
            ? [{ id: data.region_id, name: regionName }]
            : []
        );
        setCurrentCaptain(null);
        setCurrentDSR(null);
      } else {
        clearScopedProfiles();
        setAssignedRegions([]);
      }
    } catch (error) {
      console.error('Error fetching team leader profile:', error);
      clearScopedProfiles();
      setAssignedRegions([]);
    }
  }, [clearScopedProfiles]);

  const fetchCaptainProfile = useCallback(async (captainId: string) => {
    try {
      const { data } = await supabase
        .from('captains')
        .select('id, name, phone, team_leader_id, team_leaders:team_leader_id(name)')
        .eq('id', captainId)
        .maybeSingle();

      if (data) {
        setCurrentCaptain({
          id: data.id,
          name: data.name,
          phone: data.phone,
          team_leader_id: data.team_leader_id,
          team_leader_name: (data as { team_leaders?: { name?: string } | null }).team_leaders?.name || null,
        });
        setCurrentTeamLeader(null);
        setCurrentDSR(null);
      } else {
        clearScopedProfiles();
      }

      setAssignedRegions([]);
    } catch (error) {
      console.error('Error fetching captain profile:', error);
      clearScopedProfiles();
      setAssignedRegions([]);
    }
  }, [clearScopedProfiles]);

  const fetchDSRProfile = useCallback(async (dsrId: string) => {
    try {
      const { data: dsrData } = await supabase
        .from('dsrs')
        .select('id, name, phone, captain_id')
        .eq('id', dsrId)
        .maybeSingle();

      if (!dsrData) {
        clearScopedProfiles();
        setAssignedRegions([]);
        return;
      }

      let captainName: string | null = null;
      let teamLeaderId: string | null = null;
      let teamLeaderName: string | null = null;

      if (dsrData.captain_id) {
        const { data: captainData } = await supabase
          .from('captains')
          .select('id, name, team_leader_id, team_leaders:team_leader_id(name)')
          .eq('id', dsrData.captain_id)
          .maybeSingle();

        captainName = captainData?.name || null;
        teamLeaderId = captainData?.team_leader_id || null;
        teamLeaderName = (captainData as { team_leaders?: { name?: string } | null } | null)?.team_leaders?.name || null;
      }

      setCurrentDSR({
        id: dsrData.id,
        name: dsrData.name,
        phone: dsrData.phone,
        captain_id: dsrData.captain_id,
        captain_name: captainName,
        team_leader_id: teamLeaderId,
        team_leader_name: teamLeaderName,
      });
      setCurrentTeamLeader(null);
      setCurrentCaptain(null);
      setAssignedRegions([]);
    } catch (error) {
      console.error('Error fetching DSR profile:', error);
      clearScopedProfiles();
      setAssignedRegions([]);
    }
  }, [clearScopedProfiles]);

  const fetchAdminUser = useCallback(async (userId: string, email?: string | null) => {
    try {
      // First check if user already linked
      const { data: initialData, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      let data = initialData;

      // If not found by user_id, check by email and auto-link
      if (!data && email) {
        const { data: byEmail, error: emailError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (byEmail && !byEmail.user_id) {
          // Auto-link user_id to admin record
          await supabase
            .from('admin_users')
            .update({ user_id: userId })
            .eq('id', byEmail.id);
          data = { ...byEmail, user_id: userId };
        } else if (byEmail) {
          data = byEmail;
        }
      }

      if (data) {
        setAdminUser(data as AdminUser);
        if (data.role === 'regional_admin' || data.role === 'tsm') {
          await fetchAssignedRegions(data.id);
          clearScopedProfiles();
        } else if (data.role === 'team_leader' && data.team_leader_id) {
          await fetchTeamLeaderProfile(data.team_leader_id);
        } else if (data.role === 'captain' && data.captain_id) {
          await fetchCaptainProfile(data.captain_id);
        } else if (data.role === 'dsr' && data.dsr_id) {
          await fetchDSRProfile(data.dsr_id);
        } else {
          setAssignedRegions([]);
          clearScopedProfiles();
        }
      } else {
        setAdminUser(null);
        setAssignedRegions([]);
        clearScopedProfiles();
      }
    } catch (error) {
      console.error('Error fetching admin user:', error);
      setAdminUser(null);
      setAssignedRegions([]);
      clearScopedProfiles();
    } finally {
      setAdminChecked(true);
      setIsLoading(false);
    }
  }, [clearScopedProfiles, fetchAssignedRegions, fetchCaptainProfile, fetchDSRProfile, fetchTeamLeaderProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchAdminUser(session.user.id, session.user.email);
      } else {
        setIsLoading(false);
        setAdminChecked(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setIsLoading(true);
        fetchAdminUser(session.user.id, session.user.email);
      } else {
        setAdminUser(null);
        clearScopedProfiles();
        setAdminChecked(true);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [clearScopedProfiles, fetchAdminUser]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdminUser(null);
    setAssignedRegions([]);
    clearScopedProfiles();
    setAdminChecked(false);
  };

  const isSuperAdmin = adminUser?.role === 'super_admin';
  const isRegionalAdmin = adminUser?.role === 'regional_admin';
  const isTSM = adminUser?.role === 'tsm';
  const isTeamLeader = adminUser?.role === 'team_leader';
  const isCaptain = adminUser?.role === 'captain';
  const isDSR = adminUser?.role === 'dsr';
  const isManager = isTeamLeader || isCaptain;
  const assignedRegionIds = assignedRegions.map(r => r.id);

  // Check if user has access to a specific region
  const hasRegionAccess = (regionId: string | null | undefined): boolean => {
    if (!regionId) return true; // No region filter needed
    if (isSuperAdmin) return true; // Super admin has full access
    if (assignedRegionIds.length === 0) return true; // Legacy admin with no assignments has full access
    return assignedRegionIds.includes(regionId);
  };

  const value: AuthContextType = {
    user,
    session,
    adminUser,
    isAdmin: adminChecked && !!adminUser,
    isSuperAdmin,
    isRegionalAdmin,
    isTSM,
    isTeamLeader,
    isCaptain,
    isDSR,
    isManager,
    isLoading,
    assignedRegions,
    assignedRegionIds,
    currentTeamLeader,
    currentCaptain,
    currentDSR,
    hasRegionAccess,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
