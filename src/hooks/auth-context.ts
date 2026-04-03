import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  role: 'super_admin' | 'regional_admin' | 'tsm' | 'admin' | 'team_leader' | 'captain' | 'dsr';
  team_leader_id?: string | null;
  captain_id?: string | null;
  dsr_id?: string | null;
}

export interface AssignedRegion {
  id: string;
  name: string;
}

export interface TeamLeaderProfile {
  id: string;
  name: string;
  phone: string | null;
  region_id: string | null;
  region_name: string | null;
}

export interface CaptainProfile {
  id: string;
  name: string;
  phone: string | null;
  team_leader_id: string | null;
  team_leader_name: string | null;
}

export interface DSRProfile {
  id: string;
  name: string;
  phone: string | null;
  captain_id: string | null;
  captain_name: string | null;
  team_leader_id: string | null;
  team_leader_name: string | null;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  adminUser: AdminUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isRegionalAdmin: boolean;
  isTSM: boolean;
  isTeamLeader: boolean;
  isCaptain: boolean;
  isDSR: boolean;
  isManager: boolean;
  isLoading: boolean;
  assignedRegions: AssignedRegion[];
  assignedRegionIds: string[];
  currentTeamLeader: TeamLeaderProfile | null;
  currentCaptain: CaptainProfile | null;
  currentDSR: DSRProfile | null;
  hasRegionAccess: (regionId: string | null | undefined) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}