import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  role: 'super_admin' | 'regional_admin' | 'admin';
}

interface AssignedRegion {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  adminUser: AdminUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isRegionalAdmin: boolean;
  isLoading: boolean;
  assignedRegions: AssignedRegion[];
  assignedRegionIds: string[];
  hasRegionAccess: (regionId: string | null | undefined) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [assignedRegions, setAssignedRegions] = useState<AssignedRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminChecked, setAdminChecked] = useState(false);

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
        setAdminChecked(true);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAdminUser = async (userId: string, email?: string | null) => {
    console.log('fetchAdminUser called with:', { userId, email });
    try {
      // First check if user already linked
      let { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      console.log('Query by user_id result:', { data, error });

      // If not found by user_id, check by email and auto-link
      if (!data && email) {
        const { data: byEmail, error: emailError } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        console.log('Query by email result:', { byEmail, emailError });

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

      console.log('Final admin data:', data);

      if (data) {
        setAdminUser(data as AdminUser);
        // Fetch assigned regions for regional admins
        await fetchAssignedRegions(data.id);
      } else {
        setAdminUser(null);
        setAssignedRegions([]);
      }
    } catch (error) {
      console.error('Error fetching admin user:', error);
      setAdminUser(null);
      setAssignedRegions([]);
    } finally {
      setAdminChecked(true);
      setIsLoading(false);
    }
  };

  const fetchAssignedRegions = async (adminId: string) => {
    try {
      const { data } = await supabase
        .from('admin_region_assignments')
        .select('region_id, regions:region_id(id, name)')
        .eq('admin_id', adminId);

      if (data) {
        const regions = data
          .map((item: { region_id: string; regions: { id: string; name: string } | null }) => item.regions)
          .filter((r): r is AssignedRegion => r !== null);
        setAssignedRegions(regions);
      }
    } catch (error) {
      console.error('Error fetching assigned regions:', error);
      setAssignedRegions([]);
    }
  };

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
    setAdminChecked(false);
  };

  const isSuperAdmin = adminUser?.role === 'super_admin';
  const isRegionalAdmin = adminUser?.role === 'regional_admin';
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
    isLoading,
    assignedRegions,
    assignedRegionIds,
    hasRegionAccess,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
