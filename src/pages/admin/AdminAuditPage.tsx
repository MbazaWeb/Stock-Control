import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Eye, Plus, RefreshCw, Search } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { emptyAuditMetrics, fetchAuditMetrics, type AuditTargetType } from '@/lib/auditMetrics';
import { getAuditActorRole } from '@/lib/auditRole';
import { formatSmartcardEntries, parseSmartcardEntries } from '@/lib/auditSmartcards';
import { getSupabaseErrorMessage } from '@/lib/supabaseError';

interface AuditRecord {
  id: string;
  audit_date: string;
  created_at: string;
  auditTargetType: AuditTargetType;
  status: string;
  captainCount: number;
  dsrCount: number;
  sales_count: number;
  soldSmartcards: string[];
  stockInHandSmartcards: string[];
  unpaidSmartcards: string[];
  noPackageSmartcards: string[];
  total_stock: number;
  issues: string | null;
  notes: string | null;
  auditedByRole: string;
  auditedByEmail: string | null;
  targetName: string;
  dsrName: string | null;
  captainName: string | null;
  teamLeaderName: string | null;
  regionId: string | null;
  regionName: string | null;
}

interface AuditRow {
  id: string;
  audit_date: string;
  created_at: string;
  audit_target_type: AuditTargetType;
  status: string;
  captain_count: number;
  dsr_count: number;
  sales_count: number;
  sold_smartcards: string[];
  stock_in_hand_smartcards: string[];
  unpaid_smartcards: string[];
  no_package_smartcards: string[];
  total_stock: number;
  issues: string | null;
  notes: string | null;
  audited_by_role: string;
  audited_by_admin_user_id: string | null;
  dsr_id: string | null;
  captain_id: string | null;
  team_leader_id: string | null;
}

interface TeamLeaderOption {
  id: string;
  name: string;
  region_id: string | null;
  regionName: string | null;
}

interface CaptainOption {
  id: string;
  name: string;
  team_leader_id: string | null;
}

interface DsrOption {
  id: string;
  name: string;
  captain_id: string | null;
}

interface DsrLookup {
  id: string;
  name: string;
  captain_id: string | null;
}

interface CaptainLookup {
  id: string;
  name: string;
  team_leader_id: string | null;
}

interface TeamLeaderLookup {
  id: string;
  name: string;
  region_id: string | null;
  regions: { name?: string } | null;
}

interface AuditorLookup {
  id: string;
  email: string;
  role: string;
}

const initialForm = {
  auditTargetType: 'team_leader' as AuditTargetType,
  team_leader_id: '',
  captain_id: '',
  dsr_id: '',
  captain_count: 0,
  dsr_count: 0,
  sold_smartcards: '',
  stock_in_hand_smartcards: '',
  unpaid_smartcards: '',
  no_package_smartcards: '',
  issues: '',
  notes: '',
  status: 'ok' as 'ok' | 'issue',
};

export default function AdminAuditPage() {
  const { toast } = useToast();
  const { adminUser, isRegionalAdmin, isTSM, hasRegionAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<AuditRecord | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeaderOption[]>([]);
  const [captains, setCaptains] = useState<CaptainOption[]>([]);
  const [dsrs, setDsrs] = useState<DsrOption[]>([]);
  const [form, setForm] = useState(initialForm);

  const isRegionScopedAuditor = isRegionalAdmin || isTSM;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [auditResponse, teamLeaderResponse, captainResponse, dsrResponse] = await Promise.all([
        supabase
          .from('audits')
          .select('id, audit_date, created_at, audit_target_type, status, captain_count, dsr_count, sales_count, sold_smartcards, stock_in_hand_smartcards, unpaid_smartcards, no_package_smartcards, total_stock, issues, notes, audited_by_role, audited_by_admin_user_id, dsr_id, captain_id, team_leader_id')
          .order('audit_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('team_leaders').select('id, name, region_id, regions:region_id(name)').order('name'),
        supabase.from('captains').select('id, name, team_leader_id').order('name'),
        supabase.from('dsrs').select('id, name, captain_id').order('name'),
      ]);

      if (auditResponse.error) throw auditResponse.error;
      if (teamLeaderResponse.error) throw teamLeaderResponse.error;
      if (captainResponse.error) throw captainResponse.error;
      if (dsrResponse.error) throw dsrResponse.error;

      const teamLeaderOptions = (teamLeaderResponse.data || [])
        .map((teamLeader) => ({
          id: teamLeader.id,
          name: teamLeader.name,
          region_id: teamLeader.region_id,
          regionName: (teamLeader.regions as { name?: string } | null)?.name || null,
        }))
        .filter((teamLeader) => !isRegionScopedAuditor || hasRegionAccess(teamLeader.region_id));

      const allowedTeamLeaderIds = new Set(teamLeaderOptions.map((teamLeader) => teamLeader.id));
      const captainOptions = (captainResponse.data || []).filter(
        (captain) => !captain.team_leader_id || allowedTeamLeaderIds.has(captain.team_leader_id)
      ) as CaptainOption[];
      const allowedCaptainIds = new Set(captainOptions.map((captain) => captain.id));
      const dsrOptions = (dsrResponse.data || []).filter(
        (dsr) => !dsr.captain_id || allowedCaptainIds.has(dsr.captain_id)
      ) as DsrOption[];

      setTeamLeaders(teamLeaderOptions);
      setCaptains(captainOptions);
      setDsrs(dsrOptions);

      const rows = (auditResponse.data || []) as AuditRow[];
      const dsrIds = Array.from(new Set(rows.map((row) => row.dsr_id).filter(Boolean))) as string[];
      const captainIds = Array.from(new Set(rows.map((row) => row.captain_id).filter(Boolean))) as string[];
      const teamLeaderIds = Array.from(new Set(rows.map((row) => row.team_leader_id).filter(Boolean))) as string[];
      const auditorIds = Array.from(new Set(rows.map((row) => row.audited_by_admin_user_id).filter(Boolean))) as string[];

      const [dsrRes, captainRes, teamLeaderRes, auditorRes] = await Promise.all([
        dsrIds.length > 0
          ? supabase.from('dsrs').select('id, name, captain_id').in('id', dsrIds)
          : Promise.resolve({ data: [], error: null }),
        captainIds.length > 0
          ? supabase.from('captains').select('id, name, team_leader_id').in('id', captainIds)
          : Promise.resolve({ data: [], error: null }),
        teamLeaderIds.length > 0
          ? supabase.from('team_leaders').select('id, name, region_id, regions:region_id(name)').in('id', teamLeaderIds)
          : Promise.resolve({ data: [], error: null }),
        auditorIds.length > 0
          ? supabase.from('admin_users').select('id, email, role').in('id', auditorIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (dsrRes.error) throw dsrRes.error;
      if (captainRes.error) throw captainRes.error;
      if (teamLeaderRes.error) throw teamLeaderRes.error;
      if (auditorRes.error) throw auditorRes.error;

      const dsrMap = new Map<string, DsrLookup>(((dsrRes.data || []) as DsrLookup[]).map((dsr) => [dsr.id, dsr] as const));
      const captainMap = new Map<string, CaptainLookup>(((captainRes.data || []) as CaptainLookup[]).map((captain) => [captain.id, captain] as const));
      const teamLeaderMap = new Map<string, TeamLeaderLookup>(((teamLeaderRes.data || []) as TeamLeaderLookup[]).map((teamLeader) => [teamLeader.id, teamLeader] as const));
      const auditorMap = new Map<string, AuditorLookup>(((auditorRes.data || []) as AuditorLookup[]).map((auditor) => [auditor.id, auditor] as const));

      const mapped = rows
        .map((row) => {
          const dsr = row.dsr_id ? dsrMap.get(row.dsr_id) : null;
          const captain = row.captain_id
            ? captainMap.get(row.captain_id)
            : dsr?.captain_id
              ? captainMap.get(dsr.captain_id)
              : null;
          const teamLeader = row.team_leader_id
            ? teamLeaderMap.get(row.team_leader_id)
            : captain?.team_leader_id
              ? teamLeaderMap.get(captain.team_leader_id)
              : null;
          const auditor = row.audited_by_admin_user_id ? auditorMap.get(row.audited_by_admin_user_id) : null;
          const regionId = teamLeader?.region_id || null;
          const regionName = (teamLeader?.regions as { name?: string } | null)?.name || null;
          const targetName = row.audit_target_type === 'team_leader'
            ? teamLeader?.name || 'Unknown Team Leader'
            : row.audit_target_type === 'captain'
              ? captain?.name || 'Unknown Captain'
              : dsr?.name || 'Unknown DSR';

          return {
            id: row.id,
            audit_date: row.audit_date,
            created_at: row.created_at,
            auditTargetType: row.audit_target_type,
            status: row.status,
            captainCount: row.captain_count || 0,
            dsrCount: row.dsr_count || 0,
            sales_count: row.sales_count,
            soldSmartcards: row.sold_smartcards || [],
            stockInHandSmartcards: row.stock_in_hand_smartcards || [],
            unpaidSmartcards: row.unpaid_smartcards || [],
            noPackageSmartcards: row.no_package_smartcards || [],
            total_stock: row.total_stock,
            issues: row.issues,
            notes: row.notes,
            auditedByRole: row.audited_by_role,
            auditedByEmail: auditor?.email || null,
            targetName,
            dsrName: dsr?.name || null,
            captainName: captain?.name || null,
            teamLeaderName: teamLeader?.name || null,
            regionId,
            regionName,
          } satisfies AuditRecord;
        })
        .filter((audit) => !isRegionScopedAuditor || hasRegionAccess(audit.regionId));

      setAudits(mapped);
    } catch (fetchError) {
      console.error('Error fetching admin audits:', fetchError);
      toast({ title: 'Error', description: 'Failed to load audits.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [hasRegionAccess, isRegionScopedAuditor, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAudits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return audits.filter((audit) => {
      if (statusFilter !== 'all' && audit.status !== statusFilter) return false;
      if (!query) return true;

      return [
        audit.targetName,
        audit.dsrName,
        audit.captainName,
        audit.teamLeaderName,
        audit.regionName,
        audit.auditedByEmail,
        audit.auditedByRole,
        audit.auditTargetType,
        audit.issues,
        audit.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [audits, searchQuery, statusFilter]);

  const auditedStaffCount = useMemo(
    () => new Set(filteredAudits.map((audit) => `${audit.auditTargetType}:${audit.targetName}`)).size,
    [filteredAudits]
  );
  const issueCount = useMemo(() => filteredAudits.filter((audit) => audit.status === 'issue').length, [filteredAudits]);

  const filteredCaptains = useMemo(
    () => captains.filter((captain) => captain.team_leader_id === form.team_leader_id),
    [captains, form.team_leader_id]
  );
  const filteredDsrs = useMemo(
    () => dsrs.filter((dsr) => dsr.captain_id === form.captain_id),
    [dsrs, form.captain_id]
  );

  const selectedTargetReady = form.auditTargetType === 'team_leader'
    ? Boolean(form.team_leader_id)
    : form.auditTargetType === 'captain'
      ? Boolean(form.captain_id)
      : Boolean(form.dsr_id);

  const soldCount = useMemo(() => parseSmartcardEntries(form.sold_smartcards).length, [form.sold_smartcards]);
  const stockCount = useMemo(() => parseSmartcardEntries(form.stock_in_hand_smartcards).length, [form.stock_in_hand_smartcards]);
  const unpaidCount = useMemo(() => parseSmartcardEntries(form.unpaid_smartcards).length, [form.unpaid_smartcards]);
  const noPackageCount = useMemo(() => parseSmartcardEntries(form.no_package_smartcards).length, [form.no_package_smartcards]);

  const applyMetricsToForm = useCallback((metrics = emptyAuditMetrics) => {
    setForm((current) => ({
      ...current,
      captain_count: metrics.captainCount,
      dsr_count: metrics.dsrCount,
      sold_smartcards: metrics.soldSmartcards.join(', '),
      stock_in_hand_smartcards: metrics.stockInHandSmartcards.join(', '),
      unpaid_smartcards: metrics.unpaidSmartcards.join(', '),
      no_package_smartcards: metrics.noPackageSmartcards.join(', '),
    }));
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!selectedTargetReady) {
      applyMetricsToForm(emptyAuditMetrics);
      return;
    }

    setMetricsLoading(true);
    try {
      const metrics = await fetchAuditMetrics(form.auditTargetType, {
        teamLeaderId: form.team_leader_id || null,
        captainId: form.captain_id || null,
        dsrId: form.dsr_id || null,
      });
      applyMetricsToForm(metrics);
    } catch (metricsError) {
      console.error('Error pulling audit metrics:', metricsError);
      toast({ title: 'Error', description: getSupabaseErrorMessage(metricsError, 'Failed to pull audit metrics.'), variant: 'destructive' });
    } finally {
      setMetricsLoading(false);
    }
  }, [applyMetricsToForm, form.auditTargetType, form.captain_id, form.dsr_id, form.team_leader_id, selectedTargetReady, toast]);

  useEffect(() => {
    if (!createDialogOpen) return;
    void loadMetrics();
  }, [createDialogOpen, loadMetrics]);

  const handleTargetTypeChange = (value: AuditTargetType) => {
    setForm((current) => ({
      ...current,
      auditTargetType: value,
      team_leader_id: '',
      captain_id: '',
      dsr_id: '',
      captain_count: 0,
      dsr_count: 0,
      sold_smartcards: '',
      stock_in_hand_smartcards: '',
      unpaid_smartcards: '',
      no_package_smartcards: '',
    }));
  };

  const handleTeamLeaderChange = (value: string) => {
    setForm((current) => ({
      ...current,
      team_leader_id: value,
      captain_id: '',
      dsr_id: '',
      captain_count: 0,
      dsr_count: 0,
      sold_smartcards: '',
      stock_in_hand_smartcards: '',
      unpaid_smartcards: '',
      no_package_smartcards: '',
    }));
  };

  const handleCaptainChange = (value: string) => {
    const captain = captains.find((option) => option.id === value);
    setForm((current) => ({
      ...current,
      team_leader_id: captain?.team_leader_id || current.team_leader_id,
      captain_id: value,
      dsr_id: '',
      captain_count: 0,
      dsr_count: 0,
      sold_smartcards: '',
      stock_in_hand_smartcards: '',
      unpaid_smartcards: '',
      no_package_smartcards: '',
    }));
  };

  const handleDsrChange = (value: string) => {
    const dsr = dsrs.find((option) => option.id === value);
    const captain = dsr?.captain_id ? captains.find((option) => option.id === dsr.captain_id) : null;

    setForm((current) => ({
      ...current,
      team_leader_id: captain?.team_leader_id || current.team_leader_id,
      captain_id: dsr?.captain_id || current.captain_id,
      dsr_id: value,
      captain_count: 0,
      dsr_count: 0,
      sold_smartcards: '',
      stock_in_hand_smartcards: '',
      unpaid_smartcards: '',
      no_package_smartcards: '',
    }));
  };

  const canSubmit = form.auditTargetType === 'team_leader'
    ? Boolean(form.team_leader_id)
    : form.auditTargetType === 'captain'
      ? Boolean(form.team_leader_id && form.captain_id)
      : Boolean(form.team_leader_id && form.captain_id && form.dsr_id);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminUser || !canSubmit) return;

    const soldSmartcards = parseSmartcardEntries(form.sold_smartcards);
    const stockInHandSmartcards = parseSmartcardEntries(form.stock_in_hand_smartcards);
    const unpaidSmartcards = parseSmartcardEntries(form.unpaid_smartcards);
    const noPackageSmartcards = parseSmartcardEntries(form.no_package_smartcards);

    setSaving(true);
    try {
      const { error } = await supabase.from('audits').insert({
        audit_target_type: form.auditTargetType,
        audited_by_admin_user_id: adminUser.id,
        audited_by_role: getAuditActorRole(adminUser.role),
        team_leader_id: form.team_leader_id,
        captain_id: form.auditTargetType === 'captain' || form.auditTargetType === 'dsr' ? form.captain_id : null,
        dsr_id: form.auditTargetType === 'dsr' ? form.dsr_id : null,
        captain_count: form.auditTargetType === 'team_leader' ? form.captain_count : 0,
        dsr_count: form.auditTargetType === 'team_leader' || form.auditTargetType === 'captain' ? form.dsr_count : 0,
        sales_count: soldSmartcards.length,
        sold_smartcards: soldSmartcards,
        total_stock: stockInHandSmartcards.length,
        stock_in_hand_smartcards: stockInHandSmartcards,
        unpaid_smartcards: unpaidSmartcards,
        no_package_smartcards: noPackageSmartcards,
        issues: form.issues.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      });

      if (error) throw error;

      toast({ title: 'Audit saved', description: 'The audit was recorded successfully.' });
      setForm(initialForm);
      setCreateDialogOpen(false);
      fetchData();
    } catch (submitError) {
      console.error('Error saving admin audit:', submitError);
      const message = getSupabaseErrorMessage(submitError, 'Failed to save audit.');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">All Audits</h1>
            <p className="text-muted-foreground mt-1">
              Review all recorded audits and create new audits for team leaders, captains, or DSRs.
            </p>
          </div>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Audit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Audit</DialogTitle>
                <DialogDescription>Audit metrics are pulled from live staff, sales, and stock data for the selected target.</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Audit Target</Label>
                  <Select value={form.auditTargetType} onValueChange={(value) => handleTargetTypeChange(value as AuditTargetType)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team_leader">Team Leader</SelectItem>
                      <SelectItem value="captain">Captain</SelectItem>
                      <SelectItem value="dsr">DSR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Team Leader</Label>
                  <Select value={form.team_leader_id} onValueChange={handleTeamLeaderChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select team leader" /></SelectTrigger>
                    <SelectContent>
                      {teamLeaders.map((teamLeader) => (
                        <SelectItem key={teamLeader.id} value={teamLeader.id}>
                          {teamLeader.name}{teamLeader.regionName ? ` (${teamLeader.regionName})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(form.auditTargetType === 'captain' || form.auditTargetType === 'dsr') && (
                  <div>
                    <Label>Captain</Label>
                    <Select value={form.captain_id} onValueChange={handleCaptainChange} disabled={!form.team_leader_id}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select captain" /></SelectTrigger>
                      <SelectContent>
                        {filteredCaptains.map((captain) => (
                          <SelectItem key={captain.id} value={captain.id}>{captain.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.auditTargetType === 'dsr' && (
                  <div>
                    <Label>DSR</Label>
                    <Select value={form.dsr_id} onValueChange={handleDsrChange} disabled={!form.captain_id}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select DSR" /></SelectTrigger>
                      <SelectContent>
                        {filteredDsrs.map((dsr) => (
                          <SelectItem key={dsr.id} value={dsr.id}>{dsr.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={() => void loadMetrics()} disabled={!selectedTargetReady || metricsLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
                    Pull Data
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {form.auditTargetType === 'team_leader' && (
                    <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{form.captain_count}</p><p className="text-xs text-muted-foreground">Captains</p></GlassCard>
                  )}
                  {(form.auditTargetType === 'team_leader' || form.auditTargetType === 'captain') && (
                    <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{form.dsr_count}</p><p className="text-xs text-muted-foreground">DSRs</p></GlassCard>
                  )}
                  <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{soldCount}</p><p className="text-xs text-muted-foreground">Total Sales</p></GlassCard>
                  <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{stockCount}</p><p className="text-xs text-muted-foreground">Stock In Hand</p></GlassCard>
                  <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{unpaidCount}</p><p className="text-xs text-muted-foreground">Unpaid</p></GlassCard>
                  <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{noPackageCount}</p><p className="text-xs text-muted-foreground">No Package</p></GlassCard>
                </div>

                <div>
                  <Label>Smartcards Sold</Label>
                  <Textarea value={form.sold_smartcards} onChange={(event) => setForm((current) => ({ ...current, sold_smartcards: event.target.value }))} className="mt-1 min-h-24" placeholder={form.auditTargetType === 'dsr' ? 'Pulled sales can be edited manually.' : 'Pulled from sold stock for the selected target.'} />
                  <p className="mt-1 text-xs text-muted-foreground">Pulled from stock sold. For DSR audits, you can still add or remove smartcards manually.</p>
                </div>

                <div>
                  <Label>Stock In Hand Smartcards</Label>
                  <Textarea value={form.stock_in_hand_smartcards} onChange={(event) => setForm((current) => ({ ...current, stock_in_hand_smartcards: event.target.value }))} className="mt-1 min-h-24" placeholder={form.auditTargetType === 'dsr' ? 'Pulled stock can be edited manually.' : 'Pulled from stock in hand for the selected target.'} />
                  <p className="mt-1 text-xs text-muted-foreground">Pulled from in-hand stock. For DSR audits, you can still adjust the list manually.</p>
                </div>

                <div>
                  <Label>Unpaid Smartcards</Label>
                  <Textarea value={form.unpaid_smartcards} readOnly className="mt-1 min-h-24" placeholder="Pulled from sold stock with unpaid status" />
                </div>

                <div>
                  <Label>No Package Smartcards</Label>
                  <Textarea value={form.no_package_smartcards} readOnly className="mt-1 min-h-24" placeholder="Pulled from sold stock with no package status" />
                </div>

                <div>
                  <Label>Issues</Label>
                  <Textarea value={form.issues} onChange={(event) => setForm((current) => ({ ...current, issues: event.target.value }))} className="mt-1" />
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1" />
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as 'ok' | 'issue' }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ok">OK</SelectItem>
                      <SelectItem value="issue">Issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={!canSubmit || saving || metricsLoading}>
                  {saving ? 'Saving...' : 'Save Audit'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(3)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlassCard className="p-4 text-center"><ClipboardCheck className="h-6 w-6 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{filteredAudits.length}</p><p className="text-sm text-muted-foreground">Visible Audits</p></GlassCard>
              <GlassCard className="p-4 text-center"><CheckCircle2 className="h-6 w-6 mx-auto text-green-500 mb-2" /><p className="text-2xl font-bold">{auditedStaffCount}</p><p className="text-sm text-muted-foreground">Audited Staff</p></GlassCard>
              <GlassCard className="p-4 text-center"><AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" /><p className="text-2xl font-bold">{issueCount}</p><p className="text-sm text-muted-foreground">Issues Raised</p></GlassCard>
            </div>

            <GlassCard className="p-4">
              <div className="flex flex-col md:flex-row gap-4 md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search target, hierarchy, auditor, or notes..."
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="ok">OK</SelectItem>
                    <SelectItem value="issue">Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Target Type</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Captain</TableHead>
                      <TableHead>Team Leader</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Auditor</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAudits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No audits found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredAudits.map((audit) => (
                        <TableRow key={audit.id}>
                          <TableCell>{audit.audit_date}</TableCell>
                          <TableCell className="capitalize">{audit.auditTargetType.replace('_', ' ')}</TableCell>
                          <TableCell className="font-medium">{audit.targetName}</TableCell>
                          <TableCell>{audit.captainName || '-'}</TableCell>
                          <TableCell>{audit.teamLeaderName || '-'}</TableCell>
                          <TableCell>{audit.regionName || '-'}</TableCell>
                          <TableCell>
                            <Badge className={audit.status === 'ok' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}>
                              {audit.status === 'ok' ? 'OK' : 'Issue'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{audit.auditedByEmail || '-'}</div>
                            <div className="text-xs text-muted-foreground">{audit.auditedByRole}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setSelectedAudit(audit)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          </>
        )}

        <Dialog open={Boolean(selectedAudit)} onOpenChange={(open) => !open && setSelectedAudit(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Details</DialogTitle>
              <DialogDescription>Complete audit information for the selected record.</DialogDescription>
            </DialogHeader>
            {selectedAudit && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={selectedAudit.status === 'ok' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}>
                    {selectedAudit.status === 'ok' ? 'OK' : 'Issue'}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Audit date: {selectedAudit.audit_date}</span>
                  <span className="text-sm text-muted-foreground">Created: {new Date(selectedAudit.created_at).toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GlassCard className="p-4 space-y-2">
                    <div className="text-xs text-muted-foreground">Target</div>
                    <div className="font-medium">{selectedAudit.targetName}</div>
                    <div className="text-xs text-muted-foreground capitalize">Target type: {selectedAudit.auditTargetType.replace('_', ' ')}</div>
                    <div className="text-xs text-muted-foreground">DSR: {selectedAudit.dsrName || '-'}</div>
                    <div className="text-xs text-muted-foreground">Captain: {selectedAudit.captainName || '-'}</div>
                    <div className="text-xs text-muted-foreground">Team Leader: {selectedAudit.teamLeaderName || '-'}</div>
                    <div className="text-xs text-muted-foreground">Region: {selectedAudit.regionName || '-'}</div>
                  </GlassCard>
                  <GlassCard className="p-4 space-y-2">
                    <div className="text-xs text-muted-foreground">Audited By</div>
                    <div className="font-medium">{selectedAudit.auditedByEmail || '-'}</div>
                    <div className="text-xs text-muted-foreground">Role: {selectedAudit.auditedByRole}</div>
                  </GlassCard>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedAudit.auditTargetType === 'team_leader' && (
                    <GlassCard className="p-4 text-center"><div className="text-xs text-muted-foreground mb-1">Captains</div><div className="text-2xl font-bold">{selectedAudit.captainCount}</div></GlassCard>
                  )}
                  {(selectedAudit.auditTargetType === 'team_leader' || selectedAudit.auditTargetType === 'captain') && (
                    <GlassCard className="p-4 text-center"><div className="text-xs text-muted-foreground mb-1">DSRs</div><div className="text-2xl font-bold">{selectedAudit.dsrCount}</div></GlassCard>
                  )}
                  <GlassCard className="p-4 text-center"><div className="text-xs text-muted-foreground mb-1">Sales Count</div><div className="text-2xl font-bold">{selectedAudit.sales_count}</div></GlassCard>
                  <GlassCard className="p-4 text-center"><div className="text-xs text-muted-foreground mb-1">Stock In Hand</div><div className="text-2xl font-bold">{selectedAudit.total_stock}</div></GlassCard>
                  <GlassCard className="p-4 text-center"><div className="text-xs text-muted-foreground mb-1">Unpaid</div><div className="text-2xl font-bold">{selectedAudit.unpaidSmartcards.length}</div></GlassCard>
                  <GlassCard className="p-4 text-center"><div className="text-xs text-muted-foreground mb-1">No Package</div><div className="text-2xl font-bold">{selectedAudit.noPackageSmartcards.length}</div></GlassCard>
                </div>

                <GlassCard className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">Issues</div>
                  <div className="text-sm whitespace-pre-wrap">{selectedAudit.issues || 'No issues recorded.'}</div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">Sold Smartcards</div>
                  <div className="text-sm whitespace-pre-wrap">{formatSmartcardEntries(selectedAudit.soldSmartcards)}</div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">Stock In Hand Smartcards</div>
                  <div className="text-sm whitespace-pre-wrap">{formatSmartcardEntries(selectedAudit.stockInHandSmartcards)}</div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">Unpaid Smartcards</div>
                  <div className="text-sm whitespace-pre-wrap">{formatSmartcardEntries(selectedAudit.unpaidSmartcards)}</div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">No Package Smartcards</div>
                  <div className="text-sm whitespace-pre-wrap">{formatSmartcardEntries(selectedAudit.noPackageSmartcards)}</div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">Notes</div>
                  <div className="text-sm whitespace-pre-wrap">{selectedAudit.notes || 'No notes recorded.'}</div>
                </GlassCard>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
