import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit,
  Users,
  UserPlus,
  Phone,
  MapPin,
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  FileText,
  X,
  Filter,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';

interface TeamLeader {
  id: string;
  name: string;
  phone: string | null;
  region_id: string | null;
  created_at: string;
}

interface Captain {
  id: string;
  name: string;
  phone: string | null;
  team_leader_id: string | null;
  created_at: string;
}

interface DSR {
  id: string;
  name: string;
  phone: string | null;
  captain_id: string | null;
  dsr_number: string | null;
  has_fss_account: boolean;
  fss_username: string | null;
  district: string | null;
  ward: string | null;
  street_village: string | null;
  created_at: string;
}

interface Region {
  id: string;
  name: string;
  zone_id?: string | null;
}

interface Zone {
  id: string;
  name: string;
}

interface TsmUser {
  id: string;
  name: string | null;
  email: string;
  assigned_regions: Array<{ id: string; name: string }>;
}

const isMissingAdminUserNameColumn = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  if (!('code' in error) || !('message' in error)) return false;
  return error.code === '42703' && typeof error.message === 'string' && error.message.includes('admin_users.name');
};

export default function SalesTeamPage() {
    // Search state
    const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { adminUser, isSuperAdmin, isRegionalAdmin, isTSM, assignedRegionIds } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const isRegionScopedManager = isRegionalAdmin || isTSM;
  const canCreateTsmCredentials = isSuperAdmin || adminUser?.role === 'admin';

  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [tsmUsers, setTsmUsers] = useState<TsmUser[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  // Dialog states
  const [tlDialogOpen, setTlDialogOpen] = useState(false);
  const [captainDialogOpen, setCaptainDialogOpen] = useState(false);
  const [dsrDialogOpen, setDsrDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDsrDialogOpen, setBulkDsrDialogOpen] = useState(false);

  // Edit states
  const [editingTL, setEditingTL] = useState<TeamLeader | null>(null);
  const [editingCaptain, setEditingCaptain] = useState<Captain | null>(null);
  const [editingDSR, setEditingDSR] = useState<DSR | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  // Form states
  const [tlForm, setTlForm] = useState({ name: '', phone: '', region_id: '' });
  const [captainForm, setCaptainForm] = useState({ name: '', phone: '', team_leader_id: '' });
  const [dsrForm, setDsrForm] = useState({ name: '', phone: '', captain_id: '', dsr_number: '', has_fss_account: false, fss_username: '', district: '', ward: '', street_village: '' });

  // Bulk DSR state
  const [bulkDsrData, setBulkDsrData] = useState({
    captain_id: '',
    dsrList: '',
  });
  const [parsedDsrs, setParsedDsrs] = useState<Array<{name: string, phone?: string}>>([]);
  const [processingBulk, setProcessingBulk] = useState(false);

  // Expanded rows for hierarchy view
  const [expandedTLs, setExpandedTLs] = useState<string[]>([]);
  const [expandedCaptains, setExpandedCaptains] = useState<string[]>([]);
  const [expandedTsms, setExpandedTsms] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tlRes, captainRes, dsrRes, regionRes, zonesRes, tsmRes] = await Promise.all([
        supabase.from('team_leaders').select('*').order('name'),
        supabase.from('captains').select('*').order('name'),
        supabase.from('dsrs').select('*').order('name'),
        supabase.from('regions').select('id, name, zone_id').order('name'),
        supabase.from('zones').select('id, name').order('name'),
        (async () => {
          const withName = await supabase.from('admin_users').select('id, name, email').eq('role', 'tsm').order('name');
          if (!withName.error) return withName;
          if (!isMissingAdminUserNameColumn(withName.error)) return withName;

          const withoutName = await supabase.from('admin_users').select('id, email').eq('role', 'tsm').order('email');
          if (withoutName.error) return withoutName;

          return {
            ...withoutName,
            data: (withoutName.data || []).map((user) => ({ ...user, name: null })),
          };
        })(),
      ]);

      if (zonesRes.data) setZones(zonesRes.data);

      if (tsmRes.data && tsmRes.data.length > 0) {
        const tsmIds = tsmRes.data.map((user) => user.id);
        const { data: assignmentRows } = await supabase
          .from('admin_region_assignments')
          .select('admin_id, regions:region_id(id, name)')
          .in('admin_id', tsmIds);

        const assignmentMap = new Map<string, Array<{ id: string; name: string }>>();
        for (const assignment of assignmentRows || []) {
          const region = assignment.regions;
          if (!region) continue;
          const existing = assignmentMap.get(assignment.admin_id) || [];
          existing.push(region);
          assignmentMap.set(assignment.admin_id, existing);
        }

        const scopedTsms = tsmRes.data
          .map((user) => ({
            id: user.id,
            name: user.name || null,
            email: user.email,
            assigned_regions: assignmentMap.get(user.id) || [],
          }))
          .filter((user) => !isRegionScopedManager || user.assigned_regions.some((region) => assignedRegionIds.includes(region.id)));

        setTsmUsers(scopedTsms);
      } else {
        setTsmUsers([]);
      }

      // Region-scoped managers only work inside their assigned regions.
      if (tlRes.data) {
        const filteredTLs = isRegionScopedManager && assignedRegionIds.length > 0
          ? tlRes.data.filter(tl => tl.region_id && assignedRegionIds.includes(tl.region_id))
          : tlRes.data;
        setTeamLeaders(filteredTLs);
        
        // Keep downstream hierarchy lists aligned to the scoped TL set.
        if (captainRes.data) {
          const tlIds = filteredTLs.map(tl => tl.id);
          const filteredCaptains = isRegionScopedManager && assignedRegionIds.length > 0
            ? captainRes.data.filter(c => c.team_leader_id && tlIds.includes(c.team_leader_id))
            : captainRes.data;
          setCaptains(filteredCaptains);
          
          if (dsrRes.data) {
            const captainIds = filteredCaptains.map(c => c.id);
            const filteredDSRs = isRegionScopedManager && assignedRegionIds.length > 0
              ? dsrRes.data.filter(d => d.captain_id && captainIds.includes(d.captain_id))
              : dsrRes.data;
            setDsrs(filteredDSRs);
          }
        }
      } else {
        if (captainRes.data) setCaptains(captainRes.data);
        if (dsrRes.data) setDsrs(dsrRes.data);
      }
      
      if (regionRes.data) {
        const filteredRegions = isRegionScopedManager && assignedRegionIds.length > 0
          ? regionRes.data.filter(r => assignedRegionIds.includes(r.id))
          : regionRes.data;
        setRegions(filteredRegions);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => { setRegionFilter('all'); }, [zoneFilter]);

  // Helper for case-insensitive search
  const matchesSearch = (str: string | null | undefined) =>
    searchQuery.trim() === '' || (str && str.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  // Filtered lists based on zone/region selection and search
  const filteredTeamLeaders = teamLeaders.filter(tl => {
    if (regionFilter !== 'all') {
      if (tl.region_id !== regionFilter) return false;
    } else if (zoneFilter !== 'all') {
      const zoneRegionIds = regions.filter(r => r.zone_id === zoneFilter).map(r => r.id);
      if (!tl.region_id || !zoneRegionIds.includes(tl.region_id)) return false;
    }
    // Search by name or phone
    return matchesSearch(tl.name) || matchesSearch(tl.phone);
  });
  const filteredTLIds = filteredTeamLeaders.map(tl => tl.id);
  const filteredCaptains = captains.filter(c => {
    if (!c.team_leader_id || !filteredTLIds.includes(c.team_leader_id)) return false;
    // Search by name or phone
    return matchesSearch(c.name) || matchesSearch(c.phone);
  });
  const filteredCaptainIds = filteredCaptains.map(c => c.id);
  const filteredDsrs = dsrs.filter(d => {
    if (!d.captain_id || !filteredCaptainIds.includes(d.captain_id)) return false;
    // Search by name, phone, or dsr_number
    return matchesSearch(d.name) || matchesSearch(d.phone) || matchesSearch(d.dsr_number);
  });
  const visibleRegionIds = regionFilter !== 'all'
    ? [regionFilter]
    : zoneFilter !== 'all'
      ? regions.filter((region) => region.zone_id === zoneFilter).map((region) => region.id)
      : regions.map((region) => region.id);
  const filteredTsmUsers = tsmUsers.filter((user) =>
    user.assigned_regions.some((region) => visibleRegionIds.includes(region.id))
  );

  // Team Leader handlers
  const handleTLSubmit = async () => {
    if (!tlForm.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const data = {
      name: tlForm.name,
      phone: tlForm.phone || null,
      region_id: tlForm.region_id || null,
    };

    const { error } = editingTL
      ? await supabase.from('team_leaders').update(data).eq('id', editingTL.id)
      : await supabase.from('team_leaders').insert([data]);

    if (!error) {
      toast({ title: 'Success', description: editingTL ? 'Team Leader updated!' : 'Team Leader added!' });
      setTlDialogOpen(false);
      setEditingTL(null);
      setTlForm({ name: '', phone: '', region_id: '' });
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Captain handlers
  const handleCaptainSubmit = async () => {
    if (!captainForm.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const data = {
      name: captainForm.name,
      phone: captainForm.phone || null,
      team_leader_id: captainForm.team_leader_id || null,
    };

    const { error } = editingCaptain
      ? await supabase.from('captains').update(data).eq('id', editingCaptain.id)
      : await supabase.from('captains').insert([data]);

    if (!error) {
      toast({ title: 'Success', description: editingCaptain ? 'Captain updated!' : 'Captain added!' });
      setCaptainDialogOpen(false);
      setEditingCaptain(null);
      setCaptainForm({ name: '', phone: '', team_leader_id: '' });
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // DSR handlers
  const handleDSRSubmit = async () => {
    if (!dsrForm.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const data = {
      name: dsrForm.name,
      phone: dsrForm.phone || null,
      captain_id: dsrForm.captain_id || null,
      dsr_number: dsrForm.dsr_number || null,
      has_fss_account: dsrForm.has_fss_account,
      fss_username: dsrForm.has_fss_account ? (dsrForm.fss_username || null) : null,
      district: dsrForm.district || null,
      ward: dsrForm.ward || null,
      street_village: dsrForm.street_village || null,
    };

    const { error } = editingDSR
      ? await supabase.from('dsrs').update(data).eq('id', editingDSR.id)
      : await supabase.from('dsrs').insert([data]);

    if (!error) {
      toast({ title: 'Success', description: editingDSR ? 'DSR updated!' : 'DSR added!' });
      setDsrDialogOpen(false);
      setEditingDSR(null);
setDsrForm({ name: '', phone: '', captain_id: '', dsr_number: '', has_fss_account: false, fss_username: '', district: '', ward: '', street_village: '' });
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Parse DSR list from text input
  const parseDsrList = () => {
    if (!bulkDsrData.dsrList.trim()) {
      setParsedDsrs([]);
      return;
    }

    const lines = bulkDsrData.dsrList.split('\n');
    const parsed: Array<{name: string, phone?: string}> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for comma or tab separated values
      let name = '';
      let phone = '';

      if (trimmed.includes(',')) {
        const parts = trimmed.split(',').map(p => p.trim());
        name = parts[0] || '';
        phone = parts[1] || '';
      } else if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t').map(p => p.trim());
        name = parts[0] || '';
        phone = parts[1] || '';
      } else {
        // Single value, assume it's a name
        name = trimmed;
      }

      if (name) {
        parsed.push({ name, phone: phone || undefined });
      }
    }

    setParsedDsrs(parsed);
  };

  // Handle bulk DSR import
  const handleBulkDsrImport = async () => {
    if (!bulkDsrData.captain_id) {
      toast({ title: 'Error', description: 'Please select a captain for the DSRs', variant: 'destructive' });
      return;
    }

    if (parsedDsrs.length === 0) {
      toast({ title: 'Error', description: 'No valid DSR data found', variant: 'destructive' });
      return;
    }

    setProcessingBulk(true);

    try {
      // Prepare DSR data for insertion
      const dsrData = parsedDsrs.map(dsr => ({
        name: dsr.name,
        phone: dsr.phone || null,
        captain_id: bulkDsrData.captain_id,
      }));

      // Insert DSRs in batches to avoid exceeding limits
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < dsrData.length; i += batchSize) {
        const batch = dsrData.slice(i, i + batchSize);
        const { error } = await supabase.from('dsrs').insert(batch);

        if (error) {
          console.error('Error inserting batch:', error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }

      // Show results
      if (successCount > 0) {
        toast({
          title: 'Bulk Import Complete',
          description: `Successfully imported ${successCount} DSRs${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        });
      } else {
        toast({
          title: 'Import Failed',
          description: 'Failed to import any DSRs. Please check the data and try again.',
          variant: 'destructive',
        });
      }

      // Reset and close
      if (successCount > 0) {
        setBulkDsrData({ captain_id: '', dsrList: '' });
        setParsedDsrs([]);
        setBulkDsrDialogOpen(false);
        fetchData();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to import DSRs',
        variant: 'destructive',
      });
    } finally {
      setProcessingBulk(false);
    }
  };

  // Download template CSV
  const downloadTemplate = () => {
    const template = "Name,Phone\nJohn Doe,1234567890\nJane Smith,0987654321\nMike Johnson,\nSarah Williams,1112223333";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dsr_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;

    let error;
    switch (deleteTarget.type) {
      case 'TL':
        ({ error } = await supabase.from('team_leaders').delete().eq('id', deleteTarget.id));
        break;
      case 'Captain':
        ({ error } = await supabase.from('captains').delete().eq('id', deleteTarget.id));
        break;
      case 'DSR':
        ({ error } = await supabase.from('dsrs').delete().eq('id', deleteTarget.id));
        break;
    }

    if (!error) {
      toast({ title: 'Deleted', description: `${deleteTarget.type} removed.` });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleTL = (id: string) => {
    setExpandedTLs((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleCaptain = (id: string) => {
    setExpandedCaptains((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleTSM = (id: string) => {
    setExpandedTsms((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Parse DSR list when text changes
  useEffect(() => {
    parseDsrList();
  }, [bulkDsrData.dsrList]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-3 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Sales Team Management
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Manage the sales hierarchy from TSM to TL, Captain, and DSR</p>
          </div>
          {isTSM && <Badge variant="outline">Territory Manager Scope</Badge>}
        </div>

        {/* Search Bar */}
        <GlassCard className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 items-center">
          <Input
            className="glass-input w-full md:w-96"
            placeholder="Search by name, phone, or DSR number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus={false}
          />
        </GlassCard>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="text-center">
            <Users className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{filteredTsmUsers.length}</p>
            <p className="text-xs text-muted-foreground">TSMs</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Users className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{filteredTeamLeaders.length}</p>
            <p className="text-xs text-muted-foreground">Team Leaders</p>
          </GlassCard>
          <GlassCard className="text-center">
            <UserPlus className="h-8 w-8 mx-auto text-secondary mb-2" />
            <p className="text-2xl font-bold">{filteredCaptains.length}</p>
            <p className="text-xs text-muted-foreground">Captains</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Users className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{filteredDsrs.length}</p>
            <p className="text-xs text-muted-foreground">DSRs</p>
          </GlassCard>
        </div>

        {/* Zone/Region Filter */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs glass-input"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs glass-input"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {(zoneFilter === 'all' ? regions : regions.filter(r => r.zone_id === zoneFilter)).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        {/* Tabs */}
        <Tabs defaultValue="hierarchy" className="w-full">
          <TabsList className="glass-card w-full justify-start">
            <TabsTrigger value="hierarchy">Team Hierarchy</TabsTrigger>
            <TabsTrigger value="leaders">Team Leaders</TabsTrigger>
            <TabsTrigger value="captains">Captains</TabsTrigger>
            <TabsTrigger value="dsrs">DSRs</TabsTrigger>
          </TabsList>

          {/* Hierarchy View */}
          <TabsContent value="hierarchy" className="mt-4">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Team Structure</h3>
                <div className="flex gap-2">
                  {canCreateTsmCredentials && (
                    <Button size="sm" variant="outline" onClick={() => navigate('/admin/regional-admins?tab=tsm')}>
                      <Plus className="w-4 h-4 mr-1" /> TSM
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setTlDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Team Leader
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCaptainDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Captain
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBulkDsrDialogOpen(true)}>
                    <Upload className="w-4 h-4 mr-1" /> Bulk DSRs
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDsrDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> DSR
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                TSM credentials are created from the Users page. Team records below are grouped as TSM, then TL, then Captain, then DSR.
              </p>

              <div className="space-y-2">
                {filteredTsmUsers.map((tsm) => {
                  const tsmRegionIds = tsm.assigned_regions.map((region) => region.id);
                  const tsmTeamLeaders = filteredTeamLeaders.filter((tl) => tl.region_id && tsmRegionIds.includes(tl.region_id));
                  const isTsmExpanded = expandedTsms.includes(tsm.id);

                  return (
                    <div key={tsm.id} className="border border-border/50 rounded-xl overflow-hidden">
                      <div
                        className="flex items-center justify-between p-4 bg-amber-500/10 cursor-pointer hover:bg-amber-500/15"
                        onClick={() => toggleTSM(tsm.id)}
                      >
                        <div className="flex items-center gap-3">
                          {isTsmExpanded ? (
                            <ChevronDown className="h-5 w-5 text-amber-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-amber-600" />
                          )}
                          <Users className="h-5 w-5 text-amber-600" />
                          <div>
                            <span className="font-semibold">{tsm.name || tsm.email}</span>
                            {tsm.name && <div className="text-xs text-muted-foreground">{tsm.email}</div>}
                            <Badge className="ml-2 bg-amber-500/20 text-amber-700 text-xs">TSM</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {tsm.assigned_regions.map((region) => (
                            <Badge key={region.id} variant="outline">{region.name}</Badge>
                          ))}
                          <Badge variant="outline">{tsmTeamLeaders.length} TLs</Badge>
                        </div>
                      </div>

                      {isTsmExpanded && (
                        <div className="pl-6 border-t border-border/30 space-y-2 py-2">
                          {tsmTeamLeaders.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-4">No team leaders in this TSM scope</p>
                          ) : (
                            tsmTeamLeaders.map((tl) => {
                              const tlCaptains = filteredCaptains.filter((c) => c.team_leader_id === tl.id);
                              const isExpanded = expandedTLs.includes(tl.id);

                              return (
                                <div key={tl.id} className="border border-border/50 rounded-xl overflow-hidden ml-2">
                                  <div
                                    className="flex items-center justify-between p-4 bg-primary/5 cursor-pointer hover:bg-primary/10"
                                    onClick={() => toggleTL(tl.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      {isExpanded ? (
                                        <ChevronDown className="h-5 w-5 text-primary" />
                                      ) : (
                                        <ChevronRight className="h-5 w-5 text-primary" />
                                      )}
                                      <Users className="h-5 w-5 text-primary" />
                                      <div>
                                        <span className="font-semibold">{tl.name}</span>
                                        <Badge className="ml-2 bg-primary/20 text-primary text-xs">TL</Badge>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {tl.phone && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Phone className="h-3 w-3" /> {tl.phone}
                                        </span>
                                      )}
                                      <Badge variant="outline">{tlCaptains.length} Captains</Badge>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTL(tl);
                                          setTlForm({ name: tl.name, phone: tl.phone || '', region_id: tl.region_id || '' });
                                          setTlDialogOpen(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteTarget({ type: 'TL', id: tl.id, name: tl.name });
                                          setDeleteDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="pl-8 border-t border-border/30">
                                      {tlCaptains.length === 0 ? (
                                        <p className="text-sm text-muted-foreground p-4">No captains assigned</p>
                                      ) : (
                                        tlCaptains.map((captain) => {
                                          const captainDsrs = filteredDsrs.filter((d) => d.captain_id === captain.id);
                                          const isCaptainExpanded = expandedCaptains.includes(captain.id);

                                          return (
                                            <div key={captain.id} className="border-b border-border/20 last:border-0">
                                              <div
                                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/5"
                                                onClick={() => toggleCaptain(captain.id)}
                                              >
                                                <div className="flex items-center gap-3">
                                                  {isCaptainExpanded ? (
                                                    <ChevronDown className="h-4 w-4 text-secondary" />
                                                  ) : (
                                                    <ChevronRight className="h-4 w-4 text-secondary" />
                                                  )}
                                                  <UserPlus className="h-4 w-4 text-secondary" />
                                                  <span className="font-medium">{captain.name}</span>
                                                  <Badge className="bg-secondary/20 text-secondary text-xs">Captain</Badge>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="outline">{captainDsrs.length} DSRs</Badge>
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingCaptain(captain);
                                                      setCaptainForm({
                                                        name: captain.name,
                                                        phone: captain.phone || '',
                                                        team_leader_id: captain.team_leader_id || '',
                                                      });
                                                      setCaptainDialogOpen(true);
                                                    }}
                                                  >
                                                    <Edit className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setDeleteTarget({ type: 'Captain', id: captain.id, name: captain.name });
                                                      setDeleteDialogOpen(true);
                                                    }}
                                                  >
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                  </Button>
                                                </div>
                                              </div>

                                              {isCaptainExpanded && (
                                                <div className="pl-8 bg-muted/20">
                                                  {captainDsrs.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground p-3">No DSRs assigned</p>
                                                  ) : (
                                                    captainDsrs.map((dsr) => (
                                                      <div
                                                        key={dsr.id}
                                                        className="flex items-center justify-between p-2 border-b border-border/10 last:border-0"
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <Users className="h-3 w-3 text-muted-foreground" />
                                                          <span className="text-sm">{dsr.name}</span>
                                                          {dsr.phone && (
                                                            <span className="text-xs text-muted-foreground">({dsr.phone})</span>
                                                          )}
                                                        </div>
                                                        <div className="flex gap-1">
                                                          <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6"
                                                            onClick={() => {
                                                              setEditingDSR(dsr);
                                                              setDsrForm({
                                                                name: dsr.name,
                                                                phone: dsr.phone || '',
                                                                captain_id: dsr.captain_id || '',
                                                                dsr_number: dsr.dsr_number || '',
                                                                has_fss_account: dsr.has_fss_account || false,
                                                                fss_username: dsr.fss_username || '',
                                                                district: dsr.district || '',
                                                                ward: dsr.ward || '',
                                                                street_village: dsr.street_village || '',
                                                              });
                                                              setDsrDialogOpen(true);
                                                            }}
                                                          >
                                                            <Edit className="h-3 w-3" />
                                                          </Button>
                                                          <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6"
                                                            onClick={() => {
                                                              setDeleteTarget({ type: 'DSR', id: dsr.id, name: dsr.name });
                                                              setDeleteDialogOpen(true);
                                                            }}
                                                          >
                                                            <Trash2 className="h-3 w-3 text-destructive" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    ))
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredTeamLeaders.filter((tl) => !filteredTsmUsers.some((tsm) => tsm.assigned_regions.some((region) => region.id === tl.region_id))).length > 0 && (
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <div className="p-4 bg-muted/20">
                      <span className="font-semibold text-muted-foreground">Unassigned Team Leaders</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {filteredTeamLeaders
                        .filter((tl) => !filteredTsmUsers.some((tsm) => tsm.assigned_regions.some((region) => region.id === tl.region_id)))
                        .map((tl) => (
                          <div key={tl.id} className="flex items-center justify-between p-2 bg-muted/10 rounded-lg">
                            <div>
                              <div className="font-medium">{tl.name}</div>
                              <div className="text-xs text-muted-foreground">{tl.region_id ? regions.find((region) => region.id === tl.region_id)?.name || 'Unknown region' : 'No region'}</div>
                            </div>
                            <Badge variant="outline">No TSM credential assigned to this region</Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Unassigned Captains */}
                {captains.filter((c) => !c.team_leader_id).length > 0 && (
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <div className="p-4 bg-muted/20">
                      <span className="font-semibold text-muted-foreground">Unassigned Captains</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {captains
                        .filter((c) => !c.team_leader_id)
                        .map((captain) => (
                          <div key={captain.id} className="flex items-center justify-between p-2 bg-muted/10 rounded-lg">
                            <span>{captain.name}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingCaptain(captain);
                                setCaptainForm({
                                  name: captain.name,
                                  phone: captain.phone || '',
                                  team_leader_id: '',
                                });
                                setCaptainDialogOpen(true);
                              }}
                            >
                              Assign
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Team Leaders Tab */}
          <TabsContent value="leaders" className="mt-4">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Team Leaders</h3>
                <Button
                  onClick={() => {
                    setEditingTL(null);
                    setTlForm({ name: '', phone: '', region_id: '' });
                    setTlDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Team Leader
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTeamLeaders.map((tl) => (
                  <div key={tl.id} className="glass-card p-4 rounded-xl border border-border/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{tl.name}</h4>
                        {tl.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {tl.phone}
                          </p>
                        )}
                        {tl.region_id && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {regions.find((r) => r.id === tl.region_id)?.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingTL(tl);
                            setTlForm({ name: tl.name, phone: tl.phone || '', region_id: tl.region_id || '' });
                            setTlDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setDeleteTarget({ type: 'TL', id: tl.id, name: tl.name });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <Badge className="mt-3 bg-primary/20 text-primary">
                      {captains.filter((c) => c.team_leader_id === tl.id).length} Captains
                    </Badge>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Captains Tab */}
          <TabsContent value="captains" className="mt-4">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Captains</h3>
                <Button
                  onClick={() => {
                    setEditingCaptain(null);
                    setCaptainForm({ name: '', phone: '', team_leader_id: '' });
                    setCaptainDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Captain
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCaptains.map((captain) => (
                  <div key={captain.id} className="glass-card p-4 rounded-xl border border-border/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{captain.name}</h4>
                        {captain.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {captain.phone}
                          </p>
                        )}
                        {captain.team_leader_id && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Users className="h-3 w-3" /> {teamLeaders.find((t) => t.id === captain.team_leader_id)?.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingCaptain(captain);
                            setCaptainForm({
                              name: captain.name,
                              phone: captain.phone || '',
                              team_leader_id: captain.team_leader_id || '',
                            });
                            setCaptainDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setDeleteTarget({ type: 'Captain', id: captain.id, name: captain.name });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <Badge className="mt-3 bg-secondary/20 text-secondary">
                      {filteredDsrs.filter((d) => d.captain_id === captain.id).length} DSRs
                    </Badge>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>

          {/* DSRs Tab */}
          <TabsContent value="dsrs" className="mt-4">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">DSRs</h3>
                  <p className="text-sm text-muted-foreground">Total {dsrs.length} DSRs registered</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setBulkDsrDialogOpen(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Bulk Import
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingDSR(null);
                      setDsrForm({ name: '', phone: '', captain_id: '', dsr_number: '', has_fss_account: false, fss_username: '', district: '', ward: '', street_village: '' });
                      setDsrDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add DSR
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDsrs.map((dsr) => (
                  <div key={dsr.id} className="glass-card p-4 rounded-xl border border-border/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{dsr.name}</h4>
                          {dsr.dsr_number && (
                            <Badge variant="outline" className="text-xs">{dsr.dsr_number}</Badge>
                          )}
                        </div>
                        {dsr.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {dsr.phone}
                          </p>
                        )}
                        {dsr.captain_id && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <UserPlus className="h-3 w-3" /> {captains.find((c) => c.id === dsr.captain_id)?.name}
                          </p>
                        )}
                        {(dsr.district || dsr.ward || dsr.street_village) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {[dsr.district, dsr.ward, dsr.street_village].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {dsr.has_fss_account && (
                          <Badge className="text-xs mt-1 bg-green-500/20 text-green-500 border-green-500/30">FSS: {dsr.fss_username || '—'}</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingDSR(dsr);
                            setDsrForm({
                              name: dsr.name,
                              phone: dsr.phone || '',
                              captain_id: dsr.captain_id || '',
                              dsr_number: dsr.dsr_number || '',
                              has_fss_account: dsr.has_fss_account || false,
                              fss_username: dsr.fss_username || '',
                              district: dsr.district || '',
                              ward: dsr.ward || '',
                              street_village: dsr.street_village || '',
                            });
                            setDsrDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setDeleteTarget({ type: 'DSR', id: dsr.id, name: dsr.name });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* Team Leader Dialog */}
        <Dialog open={tlDialogOpen} onOpenChange={setTlDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingTL ? 'Edit Team Leader' : 'Add Team Leader'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={tlForm.name}
                  onChange={(e) => setTlForm({ ...tlForm, name: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={tlForm.phone}
                  onChange={(e) => setTlForm({ ...tlForm, phone: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Region</Label>
                <Select value={tlForm.region_id} onValueChange={(v) => setTlForm({ ...tlForm, region_id: v })}>
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTlDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleTLSubmit} className="bg-gradient-to-r from-primary to-secondary">
                {editingTL ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Captain Dialog */}
        <Dialog open={captainDialogOpen} onOpenChange={setCaptainDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingCaptain ? 'Edit Captain' : 'Add Captain'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={captainForm.name}
                  onChange={(e) => setCaptainForm({ ...captainForm, name: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={captainForm.phone}
                  onChange={(e) => setCaptainForm({ ...captainForm, phone: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Team Leader</Label>
                <Select
                  value={captainForm.team_leader_id}
                  onValueChange={(v) => setCaptainForm({ ...captainForm, team_leader_id: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select team leader" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamLeaders.map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>
                        {tl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCaptainDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCaptainSubmit} className="bg-gradient-to-r from-primary to-secondary">
                {editingCaptain ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DSR Dialog */}
        <Dialog open={dsrDialogOpen} onOpenChange={setDsrDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDSR ? 'Edit DSR' : 'Add DSR'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={dsrForm.name}
                    onChange={(e) => setDsrForm({ ...dsrForm, name: e.target.value })}
                    className="glass-input"
                  />
                </div>
                <div>
                  <Label>DSR Number (ID)</Label>
                  <Input
                    value={dsrForm.dsr_number}
                    onChange={(e) => setDsrForm({ ...dsrForm, dsr_number: e.target.value })}
                    className="glass-input"
                    placeholder="e.g. D-001"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={dsrForm.phone}
                    onChange={(e) => setDsrForm({ ...dsrForm, phone: e.target.value })}
                    className="glass-input"
                  />
                </div>
                <div>
                  <Label>Captain</Label>
                  <Select value={dsrForm.captain_id} onValueChange={(v) => setDsrForm({ ...dsrForm, captain_id: v })}>
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select captain" />
                    </SelectTrigger>
                    <SelectContent>
                      {captains.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* FSS Account */}
              <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fss-account"
                    checked={dsrForm.has_fss_account}
                    onCheckedChange={(checked) => setDsrForm({ ...dsrForm, has_fss_account: !!checked })}
                  />
                  <Label htmlFor="fss-account" className="cursor-pointer">Has FSS Account</Label>
                </div>
                {dsrForm.has_fss_account && (
                  <div>
                    <Label>FSS Username</Label>
                    <Input
                      value={dsrForm.fss_username}
                      onChange={(e) => setDsrForm({ ...dsrForm, fss_username: e.target.value })}
                      className="glass-input"
                      placeholder="FSS account username"
                    />
                  </div>
                )}
              </div>

              {/* Working Station */}
              <div className="space-y-3 p-3 rounded-lg border border-border/30 bg-muted/20">
                <Label className="text-sm font-semibold">Working Station</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">District</Label>
                    <Input
                      value={dsrForm.district}
                      onChange={(e) => setDsrForm({ ...dsrForm, district: e.target.value })}
                      className="glass-input"
                      placeholder="District"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ward</Label>
                    <Input
                      value={dsrForm.ward}
                      onChange={(e) => setDsrForm({ ...dsrForm, ward: e.target.value })}
                      className="glass-input"
                      placeholder="Ward"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Street / Village</Label>
                  <Input
                    value={dsrForm.street_village}
                    onChange={(e) => setDsrForm({ ...dsrForm, street_village: e.target.value })}
                    className="glass-input"
                    placeholder="Street or village name"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDsrDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDSRSubmit} className="bg-gradient-to-r from-primary to-secondary">
                {editingDSR ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk DSR Import Dialog */}
        <Dialog open={bulkDsrDialogOpen} onOpenChange={setBulkDsrDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk DSR Import</DialogTitle>
              <DialogDescription>
                Import multiple DSRs at once. Each line should contain DSR details (Name, Phone optional).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Captain Selection */}
              <div>
                <Label className="text-base font-semibold">Select Captain *</Label>
                <p className="text-sm text-muted-foreground mb-2">All imported DSRs will be assigned to this captain</p>
                <Select
                  value={bulkDsrData.captain_id}
                  onValueChange={(v) => setBulkDsrData({ ...bulkDsrData, captain_id: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select captain for all DSRs" />
                  </SelectTrigger>
                  <SelectContent>
                    {captains.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.team_leader_id && `(TL: ${teamLeaders.find(t => t.id === c.team_leader_id)?.name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Import Instructions */}
              <div className="border border-border/30 rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">Import Format</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadTemplate}
                    className="h-8"
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Download Template
                  </Button>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">You can import DSRs using either format:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="font-medium">CSV Format (recommended):</p>
                      <pre className="text-xs bg-background/50 p-2 rounded border">
                        John Doe,1234567890{'\n'}
                        Jane Smith,0987654321{'\n'}
                        Mike Johnson{'\n'}
                        Sarah Williams,1112223333
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Line by Line:</p>
                      <pre className="text-xs bg-background/50 p-2 rounded border">
                        John Doe{'\n'}
                        Jane Smith 0987654321{'\n'}
                        Mike Johnson{'\n'}
                        Sarah Williams (1112223333)
                      </pre>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    <strong>Note:</strong> Phone numbers are optional. Names are required.
                  </p>
                </div>
              </div>

              {/* DSR Input Area */}
              <div>
                <Label className="text-base font-semibold">DSR List *</Label>
                <p className="text-sm text-muted-foreground mb-2">Enter one DSR per line. You can paste from Excel or CSV.</p>
                <Textarea
                  value={bulkDsrData.dsrList}
                  onChange={(e) => setBulkDsrData({ ...bulkDsrData, dsrList: e.target.value })}
                  className="glass-input min-h-[200px] font-mono text-sm"
                  placeholder="John Doe,1234567890&#10;Jane Smith,0987654321&#10;Mike Johnson&#10;Sarah Williams,1112223333"
                />
              </div>

              {/* Preview Section */}
              {parsedDsrs.length > 0 && (
                <div className="border border-border/30 rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/30 flex justify-between items-center">
                    <div>
                      <span className="font-semibold">Preview ({parsedDsrs.length} DSRs)</span>
                      <Badge variant="outline" className="ml-2">
                        {bulkDsrData.captain_id 
                          ? `Assigned to: ${captains.find(c => c.id === bulkDsrData.captain_id)?.name}`
                          : 'No captain selected'
                        }
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setParsedDsrs([])}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/20">
                        <tr>
                          <th className="text-left p-2 border-b border-border/30">#</th>
                          <th className="text-left p-2 border-b border-border/30">Name</th>
                          <th className="text-left p-2 border-b border-border/30">Phone</th>
                          <th className="text-left p-2 border-b border-border/30">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedDsrs.map((dsr, index) => (
                          <tr key={index} className="border-b border-border/10 hover:bg-muted/10">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2 font-medium">{dsr.name}</td>
                            <td className="p-2 text-muted-foreground">{dsr.phone || '-'}</td>
                            <td className="p-2">
                              <Badge variant={dsr.name ? "outline" : "destructive"}>
                                {dsr.name ? 'Ready' : 'Invalid'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {parsedDsrs.length === 0 && bulkDsrData.dsrList.trim() && (
                <div className="p-3 border border-warning/30 rounded-lg bg-warning/10">
                  <p className="text-warning text-sm">
                    No valid DSR data found. Please check the format and try again.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setBulkDsrDialogOpen(false);
                setBulkDsrData({ captain_id: '', dsrList: '' });
                setParsedDsrs([]);
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkDsrImport}
                disabled={!bulkDsrData.captain_id || parsedDsrs.length === 0 || processingBulk}
                className="bg-gradient-to-r from-primary to-secondary"
              >
                {processingBulk ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {parsedDsrs.length} DSRs
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Delete {deleteTarget?.type}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}