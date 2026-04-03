import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  MapPin,
  Shield,
  Search,
  RefreshCw,
  Check,
  KeyRound,
  UserCircle2,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type UserRole = 'regional_admin' | 'tsm' | 'team_leader' | 'captain' | 'dsr';

interface ManagedUser {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
  team_leader_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
  assigned_regions?: Array<{ id: string; name: string }>;
  team_leader?: { id: string; name: string; phone: string | null; region_id: string | null; region_name: string | null } | null;
  captain?: { id: string; name: string; phone: string | null; team_leader_id: string | null; team_leader_name: string | null } | null;
  dsr?: { id: string; name: string; phone: string | null; captain_id: string | null; captain_name: string | null; team_leader_id: string | null; team_leader_name: string | null } | null;
}

interface Region {
  id: string;
  name: string;
  zone_id: string | null;
  zones?: { name: string } | null;
}

interface TeamLeaderOption {
  id: string;
  name: string;
  phone: string | null;
  region_id: string | null;
  regions?: { name: string } | null;
}

interface CaptainOption {
  id: string;
  name: string;
  phone: string | null;
  team_leader_id: string | null;
}

interface DsrOption {
  id: string;
  name: string;
  phone: string | null;
  captain_id: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ephemeralStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const createEphemeralSupabaseClient = () =>
  createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: ephemeralStorage,
      storageKey: 'stocky-managed-user-auth',
    },
  });
const managedAuthClient = createEphemeralSupabaseClient();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const requestError = error as { message: string; details?: string | null; hint?: string | null; code?: string | null };

    if (requestError.code === '23514' && requestError.message.includes('admin_users_role_check')) {
      return 'The database still rejects one or more managed roles. Apply the latest admin_users role-check SQL update, then try again.';
    }

    if (requestError.code === '42703') {
      return 'The database is missing one of the admin_users columns required by this page. Apply the latest admin_users SQL updates, then try again.';
    }

    if (requestError.code === '23505') {
      const combinedMessage = [requestError.message, requestError.details, requestError.hint].filter(Boolean).join(' ');

      if (combinedMessage.includes('admin_users_email_key') || combinedMessage.includes('Key (email)=')) {
        return 'This email is already linked to an app login. Use a different email or edit the existing user.';
      }

      if (combinedMessage.includes('admin_users_captain_id_unique') || combinedMessage.includes('Key (captain_id)=')) {
        return 'This captain already has a login linked in the app.';
      }

      if (combinedMessage.includes('admin_users_dsr_id_unique') || combinedMessage.includes('Key (dsr_id)=')) {
        return 'This DSR already has a login linked in the app.';
      }

      return 'A duplicate app login already exists for this record.';
    }

    return [requestError.message, requestError.details, requestError.hint].filter(Boolean).join(' ');
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already been registered')) {
      return 'This email already exists in Supabase Auth. Use another email, or link the existing auth user manually.';
    }

    if (normalizedMessage.includes('password should')) {
      return error.message;
    }

    if (error.message.toLowerCase().includes('security purposes')) {
      return error.message;
    }

    return error.message;
  }

  return fallback;
};

const isMissingAdminUserNameColumn = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  if (!('code' in error) || !('message' in error)) return false;
  return error.code === '42703' && typeof error.message === 'string' && error.message.includes('admin_users.name');
};

interface AdminUserConflictRow {
  id: string;
  email: string;
  role: string;
  team_leader_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
}

export default function RegionalAdminPage() {
  const { toast } = useToast();
  const { adminUser, isSuperAdmin, isRegionalAdmin, assignedRegionIds, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canManageSalesRoles = isSuperAdmin || adminUser?.role === 'admin' || isRegionalAdmin;
  const managedRoles = useMemo<UserRole[]>(
    () => (isSuperAdmin
      ? ['regional_admin', 'tsm', 'team_leader', 'captain', 'dsr']
      : ['team_leader', 'captain', 'dsr']),
    [isSuperAdmin]
  );

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeaderOption[]>([]);
  const [captains, setCaptains] = useState<CaptainOption[]>([]);
  const [dsrs, setDsrs] = useState<DsrOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<UserRole>(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'tsm' && isSuperAdmin) return 'tsm';
    if (tab === 'regional_admin' && isSuperAdmin) return 'regional_admin';
    if (tab === 'captain') return 'captain';
    if (tab === 'dsr') return 'dsr';
    return isSuperAdmin ? 'regional_admin' : 'team_leader';
  });
  const [regionalDialogOpen, setRegionalDialogOpen] = useState(false);
  const [tlDialogOpen, setTlDialogOpen] = useState(false);
  const [captainDialogOpen, setCaptainDialogOpen] = useState(false);
  const [dsrDialogOpen, setDsrDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRegionalUser, setEditingRegionalUser] = useState<ManagedUser | null>(null);
  const [editingTLUser, setEditingTLUser] = useState<ManagedUser | null>(null);
  const [editingCaptainUser, setEditingCaptainUser] = useState<ManagedUser | null>(null);
  const [editingDsrUser, setEditingDsrUser] = useState<ManagedUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null);
  const [regionalForm, setRegionalForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'regional_admin' as 'regional_admin' | 'tsm',
    selectedRegions: [] as string[],
  });
  const [teamLeaderForm, setTeamLeaderForm] = useState({
    teamLeaderId: '',
    email: '',
    password: '',
  });
  const [captainForm, setCaptainForm] = useState({
    captainId: '',
    email: '',
    password: '',
  });
  const [dsrForm, setDsrForm] = useState({
    dsrId: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (!isAuthLoading && !canManageSalesRoles) {
      navigate('/admin');
    }
  }, [canManageSalesRoles, isAuthLoading, navigate]);

  useEffect(() => {
    if (!isSuperAdmin && activeTab === 'regional_admin') {
      setActiveTab('team_leader');
    }
  }, [activeTab, isSuperAdmin]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'tsm' && isSuperAdmin) {
      setActiveTab('tsm');
      return;
    }
    if (tab === 'regional_admin' && isSuperAdmin) {
      setActiveTab('regional_admin');
      return;
    }
    if (tab === 'team_leader' || tab === 'captain' || tab === 'dsr') {
      setActiveTab(tab);
    }
  }, [isSuperAdmin, location.search]);

  const createManagedAuthUser = async (email: string, password: string) => {
    const client = managedAuthClient;
    const normalizedEmail = normalizeEmail(email);

    try {
      const { data, error } = await client.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login`,
        },
      });

      if (error) {
        const normalizedMessage = error.message.toLowerCase();

        if (normalizedMessage.includes('already registered') || normalizedMessage.includes('already been registered')) {
          const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (signInError || !signInData.user?.id) {
            throw new Error('This email already exists in Supabase Auth, but the password does not match the existing account. Use the original password or remove that auth user before retrying.');
          }

          return signInData.user.id;
        }

        throw error;
      }

      if (!data.user?.id) throw new Error('User account could not be created.');
      return data.user.id;
    } finally {
      await client.auth.signOut();
    }
  };

  const assertNoManagedUserConflict = async ({
    email,
    excludedUserId,
    teamLeaderId,
    captainId,
    dsrId,
  }: {
    email: string;
    excludedUserId?: string;
    teamLeaderId?: string | null;
    captainId?: string | null;
    dsrId?: string | null;
  }) => {
    const normalizedEmail = normalizeEmail(email);

    const [emailRes, teamLeaderRes, captainRes, dsrRes] = await Promise.all([
      supabase.from('admin_users').select('id, email, role, team_leader_id, captain_id, dsr_id').eq('email', normalizedEmail).maybeSingle(),
      teamLeaderId
        ? supabase.from('admin_users').select('id, email, role, team_leader_id, captain_id, dsr_id').eq('team_leader_id', teamLeaderId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      captainId
        ? supabase.from('admin_users').select('id, email, role, team_leader_id, captain_id, dsr_id').eq('captain_id', captainId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      dsrId
        ? supabase.from('admin_users').select('id, email, role, team_leader_id, captain_id, dsr_id').eq('dsr_id', dsrId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (emailRes.error) throw emailRes.error;
    if (teamLeaderRes.error) throw teamLeaderRes.error;
    if (captainRes.error) throw captainRes.error;
    if (dsrRes.error) throw dsrRes.error;

    const isOtherUser = (row: AdminUserConflictRow | null) => row && row.id !== excludedUserId;

    if (isOtherUser(emailRes.data as AdminUserConflictRow | null)) {
      throw new Error('This email is already linked to an app login. Use a different email or edit the existing user.');
    }

    if (isOtherUser(teamLeaderRes.data as AdminUserConflictRow | null)) {
      throw new Error('This team leader already has a login linked in the app. Edit the existing user instead.');
    }

    if (isOtherUser(captainRes.data as AdminUserConflictRow | null)) {
      throw new Error('This captain already has a login linked in the app. Edit the existing user instead.');
    }

    if (isOtherUser(dsrRes.data as AdminUserConflictRow | null)) {
      throw new Error('This DSR already has a login linked in the app. Edit the existing user instead.');
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const loadUsers = async () => {
        const withName = await supabase
          .from('admin_users')
          .select('id, user_id, email, name, role, created_at, team_leader_id, captain_id, dsr_id')
          .in('role', managedRoles)
          .order('created_at', { ascending: false });

        if (!withName.error) return withName;
        if (!isMissingAdminUserNameColumn(withName.error)) return withName;

        const withoutName = await supabase
          .from('admin_users')
          .select('id, user_id, email, role, created_at, team_leader_id, captain_id, dsr_id')
          .in('role', managedRoles)
          .order('created_at', { ascending: false });

        if (withoutName.error) return withoutName;

        return {
          ...withoutName,
          data: (withoutName.data || []).map((user) => ({ ...user, name: null })),
        };
      };

      let regionsQuery = supabase.from('regions').select('id, name, zone_id, zones:zone_id(name)').order('name');
      let teamLeadersQuery = supabase.from('team_leaders').select('id, name, phone, region_id, regions:region_id(name)').order('name');

      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        regionsQuery = regionsQuery.in('id', assignedRegionIds);
        teamLeadersQuery = teamLeadersQuery.in('region_id', assignedRegionIds);
      }

      const [usersRes, regionsRes, teamLeadersRes, captainsRes, dsrsRes] = await Promise.all([
        loadUsers(),
        regionsQuery,
        teamLeadersQuery,
        supabase.from('captains').select('id, name, phone, team_leader_id').order('name'),
        supabase.from('dsrs').select('id, name, phone, captain_id').order('name'),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (regionsRes.error) throw regionsRes.error;
      if (teamLeadersRes.error) throw teamLeadersRes.error;
      if (captainsRes.error) throw captainsRes.error;
      if (dsrsRes.error) throw dsrsRes.error;

      const teamLeaderList = (teamLeadersRes.data || []) as TeamLeaderOption[];
      const allCaptainList = (captainsRes.data || []) as CaptainOption[];
      const teamLeaderIds = new Set(teamLeaderList.map((teamLeader) => teamLeader.id));
      const captainList = isRegionalAdmin && assignedRegionIds.length > 0
        ? allCaptainList.filter((captain) => captain.team_leader_id !== null && teamLeaderIds.has(captain.team_leader_id))
        : allCaptainList;
      const captainIds = new Set(captainList.map((captain) => captain.id));
      const allDsrList = (dsrsRes.data || []) as DsrOption[];
      const dsrList = isRegionalAdmin && assignedRegionIds.length > 0
        ? allDsrList.filter((dsr) => dsr.captain_id !== null && captainIds.has(dsr.captain_id))
        : allDsrList;
      const captainMap = new Map(captainList.map((captain) => [captain.id, captain]));
      const regionScopedAdminIds = ((usersRes.data || []) as ManagedUser[])
        .filter((user) => user.role === 'regional_admin' || user.role === 'tsm')
        .map((user) => user.id);
      const assignmentMap = new Map<string, Array<{ id: string; name: string }>>();

      if (regionScopedAdminIds.length > 0) {
        const { data: assignments } = await supabase
          .from('admin_region_assignments')
          .select('admin_id, regions:region_id(id, name)')
          .in('admin_id', regionScopedAdminIds);

        for (const assignment of assignments || []) {
          const region = assignment.regions;
          if (!region) continue;

          const existingRegions = assignmentMap.get(assignment.admin_id) || [];
          existingRegions.push(region);
          assignmentMap.set(assignment.admin_id, existingRegions);
        }
      }

      const mappedUsers = await Promise.all(
        ((usersRes.data || []) as ManagedUser[]).map(async (user) => {
          if (user.role === 'regional_admin' || user.role === 'tsm') {
            return {
              ...user,
              assigned_regions: assignmentMap.get(user.id) || [],
              team_leader: null,
              captain: null,
              dsr: null,
            };
          }

          const linkedTeamLeader = teamLeaderList.find((teamLeader) => teamLeader.id === user.team_leader_id) || null;
          const linkedCaptain = captainList.find((captain) => captain.id === user.captain_id) || null;
          const linkedDsr = dsrList.find((dsr) => dsr.id === user.dsr_id) || null;
          const linkedDsrCaptain = linkedDsr?.captain_id ? captainMap.get(linkedDsr.captain_id) || null : null;

          return {
            ...user,
            assigned_regions: [],
            team_leader: linkedTeamLeader
              ? {
                  id: linkedTeamLeader.id,
                  name: linkedTeamLeader.name,
                  phone: linkedTeamLeader.phone,
                  region_id: linkedTeamLeader.region_id,
                  region_name: linkedTeamLeader.regions?.name || null,
                }
              : null,
            captain: linkedCaptain
              ? {
                  id: linkedCaptain.id,
                  name: linkedCaptain.name,
                  phone: linkedCaptain.phone,
                  team_leader_id: linkedCaptain.team_leader_id,
                  team_leader_name: linkedCaptain.team_leader_id ? teamLeaderList.find((teamLeader) => teamLeader.id === linkedCaptain.team_leader_id)?.name || null : null,
                }
              : null,
            dsr: linkedDsr
              ? {
                  id: linkedDsr.id,
                  name: linkedDsr.name,
                  phone: linkedDsr.phone,
                  captain_id: linkedDsr.captain_id,
                  captain_name: linkedDsrCaptain?.name || null,
                  team_leader_id: linkedDsrCaptain?.team_leader_id || null,
                  team_leader_name: linkedDsrCaptain?.team_leader_id ? teamLeaderList.find((teamLeader) => teamLeader.id === linkedDsrCaptain.team_leader_id)?.name || null : null,
                }
              : null,
          };
        })
      );

      const scopedUsers = isRegionalAdmin
        ? mappedUsers.filter((user) => {
            if (user.role === 'team_leader') return Boolean(user.team_leader);
            if (user.role === 'captain') return Boolean(user.captain);
            if (user.role === 'dsr') return Boolean(user.dsr);
            return false;
          })
        : mappedUsers;

      setUsers(scopedUsers);
      setRegions(regionsRes.data || []);
      setTeamLeaders(teamLeaderList);
      setCaptains(captainList);
      setDsrs(dsrList);
    } catch (error) {
      console.error('Error fetching users page data:', error);
      toast({ title: 'Error', description: getRequestErrorMessage(error, 'Failed to load users page data.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [assignedRegionIds, isRegionalAdmin, managedRoles, toast]);

  useEffect(() => {
    if (canManageSalesRoles) {
      fetchData();
    }
  }, [canManageSalesRoles, fetchData]);

  const regionalAdmins = useMemo(() => users.filter((user) => user.role === 'regional_admin'), [users]);
  const tsmUsers = useMemo(() => users.filter((user) => user.role === 'tsm'), [users]);
  const teamLeaderUsers = useMemo(() => users.filter((user) => user.role === 'team_leader'), [users]);
  const captainUsers = useMemo(() => users.filter((user) => user.role === 'captain'), [users]);
  const dsrUsers = useMemo(() => users.filter((user) => user.role === 'dsr'), [users]);
  const scopedSummaryLabel = isSuperAdmin ? 'Region-Scoped Admins' : 'Assigned Regions';
  const scopedSummaryValue = isSuperAdmin ? regionalAdmins.length + tsmUsers.length : regions.length;

  const filteredRegionalAdmins = useMemo(
    () =>
      regionalAdmins.filter((user) => {
        const query = searchQuery.toLowerCase();
        return (
          user.email.toLowerCase().includes(query) ||
          (user.assigned_regions || []).some((region) => region.name.toLowerCase().includes(query))
        );
      }),
    [regionalAdmins, searchQuery]
  );

  const filteredTsmUsers = useMemo(
    () =>
      tsmUsers.filter((user) => {
        const query = searchQuery.toLowerCase();
        return (
          user.email.toLowerCase().includes(query) ||
          (user.assigned_regions || []).some((region) => region.name.toLowerCase().includes(query))
        );
      }),
    [searchQuery, tsmUsers]
  );

  const filteredTeamLeaderUsers = useMemo(
    () =>
      teamLeaderUsers.filter((user) => {
        const query = searchQuery.toLowerCase();
        return (
          user.email.toLowerCase().includes(query) ||
          (user.team_leader?.name || '').toLowerCase().includes(query) ||
          (user.team_leader?.region_name || '').toLowerCase().includes(query)
        );
      }),
    [searchQuery, teamLeaderUsers]
  );

  const filteredCaptainUsers = useMemo(
    () =>
      captainUsers.filter((user) => {
        const query = searchQuery.toLowerCase();
        return (
          user.email.toLowerCase().includes(query) ||
          (user.captain?.name || '').toLowerCase().includes(query) ||
          (user.captain?.team_leader_name || '').toLowerCase().includes(query)
        );
      }),
    [captainUsers, searchQuery]
  );

  const filteredDsrUsers = useMemo(
    () =>
      dsrUsers.filter((user) => {
        const query = searchQuery.toLowerCase();
        return (
          user.email.toLowerCase().includes(query) ||
          (user.dsr?.name || '').toLowerCase().includes(query) ||
          (user.dsr?.captain_name || '').toLowerCase().includes(query)
        );
      }),
    [dsrUsers, searchQuery]
  );

  const availableTeamLeaders = useMemo(
    () =>
      teamLeaders.filter(
        (teamLeader) =>
          !teamLeaderUsers.some(
            (user) => user.team_leader_id === teamLeader.id && user.id !== editingTLUser?.id
          )
      ),
    [editingTLUser?.id, teamLeaderUsers, teamLeaders]
  );

  const availableCaptains = useMemo(
    () =>
      captains.filter(
        (captain) => !captainUsers.some((user) => user.captain_id === captain.id && user.id !== editingCaptainUser?.id)
      ),
    [captainUsers, captains, editingCaptainUser?.id]
  );

  const availableDsrs = useMemo(
    () =>
      dsrs.filter(
        (dsr) => !dsrUsers.some((user) => user.dsr_id === dsr.id && user.id !== editingDsrUser?.id)
      ),
    [dsrUsers, dsrs, editingDsrUser?.id]
  );

  const resetRegionalForm = () => {
    setEditingRegionalUser(null);
    setRegionalForm({ name: '', email: '', password: '', role: 'regional_admin', selectedRegions: [] });
  };

  const resetTeamLeaderForm = () => {
    setEditingTLUser(null);
    setTeamLeaderForm({ teamLeaderId: '', email: '', password: '' });
  };

  const resetCaptainForm = () => {
    setEditingCaptainUser(null);
    setCaptainForm({ captainId: '', email: '', password: '' });
  };

  const resetDsrForm = () => {
    setEditingDsrUser(null);
    setDsrForm({ dsrId: '', email: '', password: '' });
  };

  const openRegionalDialog = (user?: ManagedUser, role: 'regional_admin' | 'tsm' = 'regional_admin') => {
    if (user) {
      setEditingRegionalUser(user);
      setRegionalForm({
        name: user.name || '',
        email: user.email,
        password: '',
        role: user.role === 'tsm' ? 'tsm' : 'regional_admin',
        selectedRegions: user.assigned_regions?.map((region) => region.id) || [],
      });
    } else {
      resetRegionalForm();
      setRegionalForm({ name: '', email: '', password: '', role, selectedRegions: [] });
    }
    setRegionalDialogOpen(true);
  };

  const openTeamLeaderDialog = (user?: ManagedUser) => {
    if (user) {
      setEditingTLUser(user);
      setTeamLeaderForm({
        teamLeaderId: user.team_leader_id || '',
        email: user.email,
        password: '',
      });
    } else {
      resetTeamLeaderForm();
    }
    setTlDialogOpen(true);
  };

  const openCaptainDialog = (user?: ManagedUser) => {
    if (user) {
      setEditingCaptainUser(user);
      setCaptainForm({ captainId: user.captain_id || '', email: user.email, password: '' });
    } else {
      resetCaptainForm();
    }
    setCaptainDialogOpen(true);
  };

  const openDsrDialog = (user?: ManagedUser) => {
    if (user) {
      setEditingDsrUser(user);
      setDsrForm({ dsrId: user.dsr_id || '', email: user.email, password: '' });
    } else {
      resetDsrForm();
    }
    setDsrDialogOpen(true);
  };

  const handleToggleRegion = (regionId: string) => {
    setRegionalForm((previous) => ({
      ...previous,
      selectedRegions: previous.selectedRegions.includes(regionId)
        ? previous.selectedRegions.filter((id) => id !== regionId)
        : [...previous.selectedRegions, regionId],
    }));
  };

  const handleSaveRegionalUser = async () => {
    const normalizedEmail = normalizeEmail(regionalForm.email);

    if (!normalizedEmail) {
      toast({ title: 'Error', description: 'Email is required.', variant: 'destructive' });
      return;
    }
    if (!editingRegionalUser && !regionalForm.password.trim()) {
      toast({ title: 'Error', description: 'Password is required for new regional admins.', variant: 'destructive' });
      return;
    }
    if (regionalForm.selectedRegions.length === 0) {
      toast({ title: 'Error', description: 'Select at least one region.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let adminId = editingRegionalUser?.id;
      const scopedRole = regionalForm.role;

      await assertNoManagedUserConflict({ email: normalizedEmail, excludedUserId: editingRegionalUser?.id });

      if (editingRegionalUser) {
        let { error } = await supabase
          .from('admin_users')
          .update({ name: regionalForm.name.trim() || null, email: normalizedEmail, role: scopedRole })
          .eq('id', editingRegionalUser.id);
        if (isMissingAdminUserNameColumn(error)) {
          ({ error } = await supabase
            .from('admin_users')
            .update({ email: normalizedEmail, role: scopedRole })
            .eq('id', editingRegionalUser.id));
        }
        if (error) throw error;
        await supabase.from('admin_region_assignments').delete().eq('admin_id', editingRegionalUser.id);
      } else {
        const userId = await createManagedAuthUser(normalizedEmail, regionalForm.password.trim());
        let insertResult = await supabase
          .from('admin_users')
          .insert({
            name: regionalForm.name.trim() || null,
            email: normalizedEmail,
            role: scopedRole,
            user_id: userId,
            team_leader_id: null,
          })
          .select('id')
          .single();
        if (isMissingAdminUserNameColumn(insertResult.error)) {
          insertResult = await supabase
            .from('admin_users')
            .insert({
              email: normalizedEmail,
              role: scopedRole,
              user_id: userId,
              team_leader_id: null,
            })
            .select('id')
            .single();
        }
        const { data, error } = insertResult;
        if (error) throw error;
        adminId = data.id;
      }

      const { error: assignmentError } = await supabase.from('admin_region_assignments').insert(
        regionalForm.selectedRegions.map((regionId) => ({ admin_id: adminId as string, region_id: regionId }))
      );
      if (assignmentError) throw assignmentError;

      toast({
        title: editingRegionalUser ? 'Updated' : 'Created',
        description: editingRegionalUser
          ? `${scopedRole === 'tsm' ? 'TSM' : 'Regional admin'} updated successfully.`
          : `${scopedRole === 'tsm' ? 'TSM' : 'Regional admin'} login created successfully.`,
      });
      setRegionalDialogOpen(false);
      resetRegionalForm();
      fetchData();
    } catch (error) {
      const message = getRequestErrorMessage(error, 'Failed to save region-scoped user.');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTeamLeaderUser = async () => {
    const normalizedEmail = normalizeEmail(teamLeaderForm.email);

    if (!teamLeaderForm.teamLeaderId) {
      toast({ title: 'Error', description: 'Select a team leader first.', variant: 'destructive' });
      return;
    }
    if (!normalizedEmail) {
      toast({ title: 'Error', description: 'Email is required.', variant: 'destructive' });
      return;
    }
    if (!editingTLUser && !teamLeaderForm.password.trim()) {
      toast({ title: 'Error', description: 'Password is required for new TL users.', variant: 'destructive' });
      return;
    }

    const linkedTeamLeader = teamLeaders.find((teamLeader) => teamLeader.id === teamLeaderForm.teamLeaderId);
    if (!linkedTeamLeader) {
      toast({ title: 'Error', description: 'Selected team leader was not found.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await assertNoManagedUserConflict({ email: normalizedEmail, excludedUserId: editingTLUser?.id, teamLeaderId: linkedTeamLeader.id });

      if (editingTLUser) {
        const { error } = await supabase
          .from('admin_users')
          .update({
            email: normalizedEmail,
            team_leader_id: linkedTeamLeader.id,
            captain_id: null,
            dsr_id: null,
          })
          .eq('id', editingTLUser.id);
        if (error) throw error;
      } else {
        const userId = await createManagedAuthUser(normalizedEmail, teamLeaderForm.password.trim());
        const { error } = await supabase.from('admin_users').insert({
          email: normalizedEmail,
          role: 'team_leader',
          user_id: userId,
          team_leader_id: linkedTeamLeader.id,
          captain_id: null,
          dsr_id: null,
        });
        if (error) throw error;
      }

      toast({
        title: editingTLUser ? 'Updated' : 'Created',
        description: editingTLUser ? 'Team leader login updated successfully.' : 'Team leader login created successfully.',
      });
      setTlDialogOpen(false);
      resetTeamLeaderForm();
      fetchData();
    } catch (error) {
      const message = getRequestErrorMessage(error, 'Failed to save team leader login.');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCaptainUser = async () => {
    const normalizedEmail = normalizeEmail(captainForm.email);

    if (!captainForm.captainId) {
      toast({ title: 'Error', description: 'Select a captain first.', variant: 'destructive' });
      return;
    }
    if (!normalizedEmail) {
      toast({ title: 'Error', description: 'Email is required.', variant: 'destructive' });
      return;
    }
    if (!editingCaptainUser && !captainForm.password.trim()) {
      toast({ title: 'Error', description: 'Password is required for new captain users.', variant: 'destructive' });
      return;
    }

    const linkedCaptain = captains.find((captain) => captain.id === captainForm.captainId);
    if (!linkedCaptain) {
      toast({ title: 'Error', description: 'Selected captain was not found.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await assertNoManagedUserConflict({ email: normalizedEmail, excludedUserId: editingCaptainUser?.id, captainId: linkedCaptain.id });

      if (editingCaptainUser) {
        const { error } = await supabase
          .from('admin_users')
          .update({
            email: normalizedEmail,
            team_leader_id: linkedCaptain.team_leader_id,
            captain_id: linkedCaptain.id,
            dsr_id: null,
          })
          .eq('id', editingCaptainUser.id);
        if (error) throw error;
      } else {
        const userId = await createManagedAuthUser(normalizedEmail, captainForm.password.trim());
        const { error } = await supabase.from('admin_users').insert({
          email: normalizedEmail,
          role: 'captain',
          user_id: userId,
          team_leader_id: linkedCaptain.team_leader_id,
          captain_id: linkedCaptain.id,
          dsr_id: null,
        });
        if (error) throw error;
      }

      toast({ title: editingCaptainUser ? 'Updated' : 'Created', description: editingCaptainUser ? 'Captain login updated successfully.' : 'Captain login created successfully.' });
      setCaptainDialogOpen(false);
      resetCaptainForm();
      fetchData();
    } catch (error) {
      const message = getRequestErrorMessage(error, 'Failed to save captain login.');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDsrUser = async () => {
    const normalizedEmail = normalizeEmail(dsrForm.email);

    if (!dsrForm.dsrId) {
      toast({ title: 'Error', description: 'Select a DSR first.', variant: 'destructive' });
      return;
    }
    if (!normalizedEmail) {
      toast({ title: 'Error', description: 'Email is required.', variant: 'destructive' });
      return;
    }
    if (!editingDsrUser && !dsrForm.password.trim()) {
      toast({ title: 'Error', description: 'Password is required for new DSR users.', variant: 'destructive' });
      return;
    }

    const linkedDsr = dsrs.find((dsr) => dsr.id === dsrForm.dsrId);
    if (!linkedDsr) {
      toast({ title: 'Error', description: 'Selected DSR was not found.', variant: 'destructive' });
      return;
    }

    const linkedCaptain = linkedDsr.captain_id ? captains.find((captain) => captain.id === linkedDsr.captain_id) || null : null;

    setSaving(true);
    try {
      await assertNoManagedUserConflict({ email: normalizedEmail, excludedUserId: editingDsrUser?.id, dsrId: linkedDsr.id });

      if (editingDsrUser) {
        const { error } = await supabase
          .from('admin_users')
          .update({
            email: normalizedEmail,
            team_leader_id: linkedCaptain?.team_leader_id || null,
            captain_id: null,
            dsr_id: linkedDsr.id,
          })
          .eq('id', editingDsrUser.id);
        if (error) throw error;
      } else {
        const userId = await createManagedAuthUser(normalizedEmail, dsrForm.password.trim());
        const { error } = await supabase.from('admin_users').insert({
          email: normalizedEmail,
          role: 'dsr',
          user_id: userId,
          team_leader_id: linkedCaptain?.team_leader_id || null,
          captain_id: null,
          dsr_id: linkedDsr.id,
        });
        if (error) throw error;
      }

      toast({ title: editingDsrUser ? 'Updated' : 'Created', description: editingDsrUser ? 'DSR login updated successfully.' : 'DSR login created successfully.' });
      setDsrDialogOpen(false);
      resetDsrForm();
      fetchData();
    } catch (error) {
      const message = getRequestErrorMessage(error, 'Failed to save DSR login.');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    try {
      if (deleteUser.role === 'regional_admin' || deleteUser.role === 'tsm') {
        await supabase.from('admin_region_assignments').delete().eq('admin_id', deleteUser.id);
      }
      const { error } = await supabase.from('admin_users').delete().eq('id', deleteUser.id);
      if (error) throw error;

      toast({ title: 'Deleted', description: 'User access removed successfully.' });
      setDeleteDialogOpen(false);
      setDeleteUser(null);
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete user.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  if (isAuthLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <GlassCard key={index} className="p-4">
                <Skeleton className="h-20 w-full" />
              </GlassCard>
            ))}
          </div>
          <GlassCard className="p-4">
            <Skeleton className="h-10 w-full" />
          </GlassCard>
        </div>
      </AdminLayout>
    );
  }

  if (!canManageSalesRoles) return null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              Users Page
            </h1>
            <p className="text-muted-foreground mt-1">
              {isSuperAdmin
                ? 'Manage sales-team login credentials and access roles, including TSM accounts.'
                : 'Manage team leader, captain, and DSR logins within your assigned regions.'}
            </p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <Users className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <Shield className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{scopedSummaryValue}</p>
            <p className="text-sm text-muted-foreground">{scopedSummaryLabel}</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <UserCircle2 className="h-6 w-6 mx-auto text-amber-500 mb-2" />
            <p className="text-2xl font-bold">{teamLeaderUsers.length}</p>
            <p className="text-sm text-muted-foreground">TL Logins</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <KeyRound className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{captainUsers.length + dsrUsers.length}</p>
            <p className="text-sm text-muted-foreground">Captain + DSR Logins</p>
          </GlassCard>
        </div>

        <GlassCard className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, region, or TL..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        </GlassCard>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as UserRole)}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <TabsList>
              {isSuperAdmin && <TabsTrigger value="regional_admin">Regional Admin Credentials</TabsTrigger>}
              {isSuperAdmin && <TabsTrigger value="tsm">TSM Credentials</TabsTrigger>}
              <TabsTrigger value="team_leader">Team Leader Credentials</TabsTrigger>
              <TabsTrigger value="captain">Captain Credentials</TabsTrigger>
              <TabsTrigger value="dsr">DSR Credentials</TabsTrigger>
            </TabsList>
            {(activeTab === 'regional_admin' || activeTab === 'tsm') && isSuperAdmin ? (
              <Button onClick={() => openRegionalDialog(undefined, activeTab === 'tsm' ? 'tsm' : 'regional_admin')}>
                <Plus className="h-4 w-4 mr-2" />
                {activeTab === 'tsm' ? 'Add TSM' : 'Add Regional Admin'}
              </Button>
            ) : activeTab === 'team_leader' ? (
              <Button onClick={() => openTeamLeaderDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add TL Login
              </Button>
            ) : activeTab === 'captain' ? (
              <Button onClick={() => openCaptainDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Captain Login
              </Button>
            ) : (
              <Button onClick={() => openDsrDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add DSR Login
              </Button>
            )}
          </div>

          <TabsContent value="regional_admin" className="mt-6">
            <GlassCard>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="space-y-4 p-4">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned Regions</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegionalAdmins.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No regional admin credentials found.</TableCell></TableRow>
                      ) : (
                        filteredRegionalAdmins.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell><div className="font-medium">{user.email}</div></TableCell>
                            <TableCell className="font-mono text-sm">{user.email}</TableCell>
                            <TableCell><Badge variant={user.user_id ? 'default' : 'secondary'}>{user.user_id ? 'Ready' : 'Not Linked'}</Badge></TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {(user.assigned_regions || []).map((region) => (
                                  <Badge key={region.id} variant="outline" className="text-xs">
                                    <MapPin className="h-3 w-3 mr-1" />{region.name}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openRegionalDialog(user)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setDeleteUser(user); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="team_leader" className="mt-6">
            <GlassCard>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="space-y-4 p-4">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeamLeaderUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No TL credentials found.</TableCell></TableRow>
                      ) : (
                        filteredTeamLeaderUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="font-medium">{user.team_leader?.name || user.email}</div>
                              <div className="text-xs text-muted-foreground">{user.team_leader?.phone || 'No phone'}</div>
                            </TableCell>
                            <TableCell>{user.team_leader?.region_name || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{user.email}</TableCell>
                            <TableCell><Badge variant={user.user_id ? 'default' : 'secondary'}>{user.user_id ? 'Ready' : 'Not Linked'}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openTeamLeaderDialog(user)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setDeleteUser(user); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="captain" className="mt-6">
            <GlassCard>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="space-y-4 p-4">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Captain</TableHead>
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCaptainUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No captain credentials found.</TableCell></TableRow>
                      ) : (
                        filteredCaptainUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell><div className="font-medium">{user.captain?.name || user.email}</div><div className="text-xs text-muted-foreground">{user.captain?.phone || 'No phone'}</div></TableCell>
                            <TableCell>{user.captain?.team_leader_name || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{user.email}</TableCell>
                            <TableCell><Badge variant={user.user_id ? 'default' : 'secondary'}>{user.user_id ? 'Ready' : 'Not Linked'}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => openCaptainDialog(user)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => { setDeleteUser(user); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="dsr" className="mt-6">
            <GlassCard>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="space-y-4 p-4">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DSR</TableHead>
                        <TableHead>Captain</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDsrUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No DSR credentials found.</TableCell></TableRow>
                      ) : (
                        filteredDsrUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell><div className="font-medium">{user.dsr?.name || user.email}</div><div className="text-xs text-muted-foreground">{user.dsr?.phone || 'No phone'}</div></TableCell>
                            <TableCell>{user.dsr?.captain_name || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{user.email}</TableCell>
                            <TableCell><Badge variant={user.user_id ? 'default' : 'secondary'}>{user.user_id ? 'Ready' : 'Not Linked'}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => openDsrDialog(user)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => { setDeleteUser(user); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="tsm" className="mt-6">
            <GlassCard>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="space-y-4 p-4">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned Regions</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTsmUsers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No TSM credentials found.</TableCell></TableRow>
                      ) : (
                        filteredTsmUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="font-medium">{user.name || user.email}</div>
                              {user.name && <div className="text-xs text-muted-foreground">{user.email}</div>}
                              <Badge variant="outline" className="mt-1">Territory Manager</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{user.email}</TableCell>
                            <TableCell><Badge variant={user.user_id ? 'default' : 'secondary'}>{user.user_id ? 'Ready' : 'Not Linked'}</Badge></TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {(user.assigned_regions || []).map((region) => (
                                  <Badge key={region.id} variant="outline" className="text-xs">
                                    <MapPin className="h-3 w-3 mr-1" />{region.name}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openRegionalDialog(user)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setDeleteUser(user); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={regionalDialogOpen} onOpenChange={setRegionalDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRegionalUser
                ? `Edit ${regionalForm.role === 'tsm' ? 'TSM' : 'Regional Admin'} Credential`
                : `Create ${regionalForm.role === 'tsm' ? 'TSM' : 'Regional Admin'} Credential`}
            </DialogTitle>
            <DialogDescription>
              Set the login email and choose the regions this {regionalForm.role === 'tsm' ? 'territory manager' : 'regional admin'} can manage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="regional-name">Name</Label>
                <Input
                  id="regional-name"
                  value={regionalForm.name}
                  onChange={(event) => setRegionalForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder={regionalForm.role === 'tsm' ? 'Territory manager name' : 'Regional admin name'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="regional-email">Email</Label>
                <Input id="regional-email" type="email" value={regionalForm.email} onChange={(event) => setRegionalForm((previous) => ({ ...previous, email: event.target.value }))} placeholder="regional.admin@example.com" />
              </div>
            </div>
            {!editingRegionalUser && (
              <div className="space-y-2">
                <Label htmlFor="regional-password">Password</Label>
                <Input id="regional-password" type="password" value={regionalForm.password} onChange={(event) => setRegionalForm((previous) => ({ ...previous, password: event.target.value }))} placeholder="Create a login password" />
              </div>
            )}
            <div className="space-y-3">
              <Label>Assign Regions</Label>
              <p className="text-sm text-muted-foreground">This account must have at least one region. Zones and regions should be created first.</p>
              <div className="border rounded-lg max-h-64 overflow-y-auto divide-y">
                {regions.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No regions found. Create zones and regions first.</div>
                ) : (
                  regions.map((region) => (
                    <label key={region.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={regionalForm.selectedRegions.includes(region.id)} onCheckedChange={() => handleToggleRegion(region.id)} />
                      <div className="flex-1">
                        <div className="font-medium">{region.name}</div>
                        {region.zones?.name && <div className="text-xs text-muted-foreground">Zone: {region.zones.name}</div>}
                      </div>
                      {regionalForm.selectedRegions.includes(region.id) && <Check className="h-4 w-4 text-green-500" />}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegionalDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRegionalUser} disabled={saving}>{saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}{editingRegionalUser ? 'Update User' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tlDialogOpen} onOpenChange={setTlDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTLUser ? 'Edit TL Credential' : 'Create TL Credential'}</DialogTitle>
            <DialogDescription>
              Link a team leader profile to a login email for admin access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-leader-select">Select Team Leader</Label>
              <select id="team-leader-select" aria-label="Select team leader" title="Select team leader" value={teamLeaderForm.teamLeaderId} onChange={(event) => setTeamLeaderForm((previous) => ({ ...previous, teamLeaderId: event.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={!!editingTLUser}>
                <option value="">Choose a team leader</option>
                {availableTeamLeaders.map((teamLeader) => (
                  <option key={teamLeader.id} value={teamLeader.id}>{teamLeader.name}{teamLeader.regions?.name ? ` - ${teamLeader.regions.name}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tl-email">Email</Label>
              <Input id="tl-email" type="email" value={teamLeaderForm.email} onChange={(event) => setTeamLeaderForm((previous) => ({ ...previous, email: event.target.value }))} placeholder="teamleader@example.com" />
            </div>
            {!editingTLUser && (
              <div className="space-y-2">
                <Label htmlFor="tl-password">Password</Label>
                <Input id="tl-password" type="password" value={teamLeaderForm.password} onChange={(event) => setTeamLeaderForm((previous) => ({ ...previous, password: event.target.value }))} placeholder="Create a login password" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTlDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTeamLeaderUser} disabled={saving}>{saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}{editingTLUser ? 'Update User' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={captainDialogOpen} onOpenChange={setCaptainDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCaptainUser ? 'Edit Captain Credential' : 'Create Captain Credential'}</DialogTitle>
            <DialogDescription>
              Link a captain profile to a login email for admin access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="captain-select">Select Captain</Label>
              <select id="captain-select" aria-label="Select captain" title="Select captain" value={captainForm.captainId} onChange={(event) => setCaptainForm((previous) => ({ ...previous, captainId: event.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={!!editingCaptainUser}>
                <option value="">Choose a captain</option>
                {availableCaptains.map((captain) => (
                  <option key={captain.id} value={captain.id}>{captain.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="captain-email">Email</Label><Input id="captain-email" type="email" value={captainForm.email} onChange={(event) => setCaptainForm((previous) => ({ ...previous, email: event.target.value }))} placeholder="captain@example.com" /></div>
            {!editingCaptainUser && <div className="space-y-2"><Label htmlFor="captain-password">Password</Label><Input id="captain-password" type="password" value={captainForm.password} onChange={(event) => setCaptainForm((previous) => ({ ...previous, password: event.target.value }))} placeholder="Create a login password" /></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCaptainDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveCaptainUser} disabled={saving}>{saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}{editingCaptainUser ? 'Update User' : 'Create User'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dsrDialogOpen} onOpenChange={setDsrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDsrUser ? 'Edit DSR Credential' : 'Create DSR Credential'}</DialogTitle>
            <DialogDescription>
              Link a DSR profile to a login email for admin access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="dsr-select">Select DSR</Label>
              <select id="dsr-select" aria-label="Select dsr" title="Select dsr" value={dsrForm.dsrId} onChange={(event) => setDsrForm((previous) => ({ ...previous, dsrId: event.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={!!editingDsrUser}>
                <option value="">Choose a DSR</option>
                {availableDsrs.map((dsr) => (
                  <option key={dsr.id} value={dsr.id}>{dsr.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="dsr-email">Email</Label><Input id="dsr-email" type="email" value={dsrForm.email} onChange={(event) => setDsrForm((previous) => ({ ...previous, email: event.target.value }))} placeholder="dsr@example.com" /></div>
            {!editingDsrUser && <div className="space-y-2"><Label htmlFor="dsr-password">Password</Label><Input id="dsr-password" type="password" value={dsrForm.password} onChange={(event) => setDsrForm((previous) => ({ ...previous, password: event.target.value }))} placeholder="Create a login password" /></div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDsrDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveDsrUser} disabled={saving}>{saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}{editingDsrUser ? 'Update User' : 'Create User'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User Access?</AlertDialogTitle>
            <AlertDialogDescription>This removes {deleteUser?.email} from the app user list. Their auth account may still exist, but they will no longer have access to this app.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">Delete User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
