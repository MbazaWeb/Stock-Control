import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Plus, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { fetchAuditMetrics } from '@/lib/auditMetrics';
import { formatSmartcardEntries, parseSmartcardEntries } from '@/lib/auditSmartcards';
import { getSupabaseErrorMessage } from '@/lib/supabaseError';

interface DsrOption {
  id: string;
  name: string;
  captain_id: string | null;
  captainName: string | null;
}

interface CaptainOption {
  id: string;
  name: string;
}

type ManagerAuditTargetType = 'captain' | 'dsr';

interface AuditRecord {
  id: string;
  targetType: ManagerAuditTargetType;
  audit_date: string;
  status: string;
  sales_count: number;
  dsr_count: number;
  soldSmartcards: string[];
  stockInHandSmartcards: string[];
  unpaidSmartcards: string[];
  noPackageSmartcards: string[];
  total_stock: number;
  issues: string | null;
  notes: string | null;
  subjectName: string;
  captainName: string | null;
}

export default function ManagerAuditPage() {
  const { toast } = useToast();
  const { adminUser, isTeamLeader, isCaptain, currentTeamLeader, currentCaptain } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [captainOptions, setCaptainOptions] = useState<CaptainOption[]>([]);
  const [options, setOptions] = useState<DsrOption[]>([]);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [form, setForm] = useState({
    audit_target_type: (isTeamLeader ? 'captain' : 'dsr') as ManagerAuditTargetType,
    captain_id: '',
    dsr_id: '',
    sold_smartcards: '',
    stock_in_hand_smartcards: '',
    unpaid_smartcards: '',
    no_package_smartcards: '',
    issues: '',
    notes: '',
    status: 'ok' as 'ok' | 'issue',
  });

  const roleLabel = isTeamLeader ? 'Team Leader' : 'Captain';
  const ownerName = isTeamLeader ? currentTeamLeader?.name : currentCaptain?.name;

  const fetchData = useCallback(async () => {
    if ((!isTeamLeader || !currentTeamLeader) && (!isCaptain || !currentCaptain)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let captainRows: Array<{ id: string; name: string }> = [];
      let dsrRows: Array<{ id: string; name: string; captain_id: string | null }> = [];

      if (isTeamLeader && currentTeamLeader) {
        const { data: captains } = await supabase
          .from('captains')
          .select('id, name')
          .eq('team_leader_id', currentTeamLeader.id)
          .order('name');

        captainRows = captains || [];
        const captainIds = captainRows.map((captain) => captain.id);

        if (captainIds.length > 0) {
          const { data: dsrs } = await supabase
            .from('dsrs')
            .select('id, name, captain_id')
            .in('captain_id', captainIds)
            .order('name');

          dsrRows = dsrs || [];
        }
      } else if (isCaptain && currentCaptain) {
        captainRows = [{ id: currentCaptain.id, name: currentCaptain.name }];
        const { data: dsrs } = await supabase
          .from('dsrs')
          .select('id, name, captain_id')
          .eq('captain_id', currentCaptain.id)
          .order('name');

        dsrRows = dsrs || [];
      }

      const captainNameMap = new Map(captainRows.map((captain) => [captain.id, captain.name]));
      setCaptainOptions(captainRows);
      setOptions(
        dsrRows.map((dsr) => ({
          id: dsr.id,
          name: dsr.name,
          captain_id: dsr.captain_id,
          captainName: dsr.captain_id ? captainNameMap.get(dsr.captain_id) || null : null,
        }))
      );

      let auditQuery = supabase
        .from('audits')
        .select('id, audit_target_type, audit_date, status, sales_count, dsr_count, sold_smartcards, stock_in_hand_smartcards, unpaid_smartcards, no_package_smartcards, total_stock, issues, notes, dsr_id, captain_id')
        .order('audit_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (isTeamLeader && currentTeamLeader) auditQuery = auditQuery.eq('team_leader_id', currentTeamLeader.id);
      if (isCaptain && currentCaptain) auditQuery = auditQuery.eq('captain_id', currentCaptain.id);
      if (isTeamLeader) auditQuery = auditQuery.in('audit_target_type', ['captain', 'dsr']);
      if (isCaptain) auditQuery = auditQuery.eq('audit_target_type', 'dsr');

      const { data: auditRows, error: auditError } = await auditQuery;
      if (auditError) throw auditError;

      const auditDsrIds = Array.from(new Set((auditRows || []).map((row) => row.dsr_id).filter(Boolean)));
      const { data: auditDsrs } = auditDsrIds.length > 0
        ? await supabase.from('dsrs').select('id, name, captain_id').in('id', auditDsrIds as string[])
        : { data: [] as Array<{ id: string; name: string; captain_id: string | null }> };

      const auditCaptainIds = Array.from(new Set((auditRows || []).map((row) => row.captain_id).filter(Boolean)));
      const { data: auditCaptains } = auditCaptainIds.length > 0
        ? await supabase.from('captains').select('id, name').in('id', auditCaptainIds as string[])
        : { data: [] as Array<{ id: string; name: string }> };

      const auditDsrMap = new Map((auditDsrs || []).map((dsr) => [dsr.id, dsr]));
      const auditCaptainMap = new Map((auditCaptains || []).map((captain) => [captain.id, captain.name]));

      setAudits(
        (auditRows || []).map((row) => {
          const dsr = row.dsr_id ? auditDsrMap.get(row.dsr_id) : null;
          const captainName = row.captain_id
            ? auditCaptainMap.get(row.captain_id) || null
            : dsr?.captain_id
              ? auditCaptainMap.get(dsr.captain_id) || null
              : null;

          return {
            id: row.id,
            targetType: row.audit_target_type as ManagerAuditTargetType,
            audit_date: row.audit_date,
            status: row.status,
            sales_count: row.sales_count,
            dsr_count: row.dsr_count || 0,
            soldSmartcards: row.sold_smartcards || [],
            stockInHandSmartcards: row.stock_in_hand_smartcards || [],
            unpaidSmartcards: row.unpaid_smartcards || [],
            noPackageSmartcards: row.no_package_smartcards || [],
            total_stock: row.total_stock,
            issues: row.issues,
            notes: row.notes,
            subjectName: row.audit_target_type === 'captain' ? captainName || 'Unknown Captain' : dsr?.name || 'Unknown DSR',
            captainName,
          };
        })
      );
    } catch (error) {
      console.error('Error fetching audits:', error);
      toast({ title: 'Error', description: 'Failed to load audit data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentCaptain, currentTeamLeader, isCaptain, isTeamLeader, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const auditedDsrCount = useMemo(() => new Set(audits.map((audit) => audit.subjectName)).size, [audits]);
  const issueCount = useMemo(() => audits.filter((audit) => audit.status === 'issue').length, [audits]);
  const soldCount = useMemo(() => parseSmartcardEntries(form.sold_smartcards).length, [form.sold_smartcards]);
  const stockCount = useMemo(() => parseSmartcardEntries(form.stock_in_hand_smartcards).length, [form.stock_in_hand_smartcards]);
  const unpaidCount = useMemo(() => parseSmartcardEntries(form.unpaid_smartcards).length, [form.unpaid_smartcards]);
  const noPackageCount = useMemo(() => parseSmartcardEntries(form.no_package_smartcards).length, [form.no_package_smartcards]);

  const loadMetrics = useCallback(async () => {
    const selectedTargetId = form.audit_target_type === 'captain' ? form.captain_id : form.dsr_id;
    if (!selectedTargetId) {
      setForm((current) => ({ ...current, sold_smartcards: '', stock_in_hand_smartcards: '', unpaid_smartcards: '', no_package_smartcards: '' }));
      return;
    }

    setMetricsLoading(true);
    try {
      const metrics = form.audit_target_type === 'captain'
        ? await fetchAuditMetrics('captain', { captainId: form.captain_id })
        : await fetchAuditMetrics('dsr', { dsrId: form.dsr_id });
      setForm((current) => ({
        ...current,
        sold_smartcards: metrics.soldSmartcards.join(', '),
        stock_in_hand_smartcards: metrics.stockInHandSmartcards.join(', '),
        unpaid_smartcards: metrics.unpaidSmartcards.join(', '),
        no_package_smartcards: metrics.noPackageSmartcards.join(', '),
      }));
    } catch (metricsError) {
      console.error('Error pulling DSR audit metrics:', metricsError);
      toast({ title: 'Error', description: getSupabaseErrorMessage(metricsError, 'Failed to pull DSR audit metrics.'), variant: 'destructive' });
    } finally {
      setMetricsLoading(false);
    }
  }, [form.audit_target_type, form.captain_id, form.dsr_id, toast]);

  useEffect(() => {
    if (!open) return;
    void loadMetrics();
  }, [loadMetrics, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const selectedDsr = options.find((option) => option.id === form.dsr_id);
    const selectedCaptain = captainOptions.find((option) => option.id === form.captain_id);
    const targetType = isTeamLeader ? form.audit_target_type : 'dsr';

    if (!adminUser) return;
    if (targetType === 'captain' && !selectedCaptain) return;
    if (targetType === 'dsr' && !selectedDsr) return;

    const soldSmartcards = parseSmartcardEntries(form.sold_smartcards);
    const stockInHandSmartcards = parseSmartcardEntries(form.stock_in_hand_smartcards);
    const unpaidSmartcards = parseSmartcardEntries(form.unpaid_smartcards);
    const noPackageSmartcards = parseSmartcardEntries(form.no_package_smartcards);

    setSaving(true);
    try {
      const { error } = await supabase.from('audits').insert({
        audit_target_type: targetType,
        audited_by_admin_user_id: adminUser.id,
        audited_by_role: isTeamLeader ? 'team_leader' : 'captain',
        team_leader_id: isTeamLeader ? currentTeamLeader?.id || null : currentCaptain?.team_leader_id || null,
        captain_id: targetType === 'captain' ? selectedCaptain?.id || null : selectedDsr?.captain_id || null,
        dsr_id: targetType === 'dsr' ? selectedDsr?.id || null : null,
        dsr_count: targetType === 'captain' ? options.filter((option) => option.captain_id === selectedCaptain?.id).length : 0,
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

  toast({ title: 'Audit saved', description: `The ${targetType === 'captain' ? 'captain' : 'DSR'} audit was recorded successfully.` });
  setForm({ audit_target_type: (isTeamLeader ? 'captain' : 'dsr') as ManagerAuditTargetType, captain_id: '', dsr_id: '', sold_smartcards: '', stock_in_hand_smartcards: '', unpaid_smartcards: '', no_package_smartcards: '', issues: '', notes: '', status: 'ok' });
      setOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving manager audit:', error);
      const message = getSupabaseErrorMessage(error, 'Failed to save audit.');
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
            <h1 className="text-3xl font-display font-bold">Audit Report</h1>
            <p className="text-muted-foreground mt-1">{roleLabel} audits for {ownerName || 'your team'}.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Audit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit DSR Audit</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isTeamLeader && (
                  <div>
                    <Label>Audit Target</Label>
                    <Select value={form.audit_target_type} onValueChange={(value) => setForm((current) => ({ ...current, audit_target_type: value as ManagerAuditTargetType, captain_id: '', dsr_id: '', sold_smartcards: '', stock_in_hand_smartcards: '', unpaid_smartcards: '', no_package_smartcards: '' }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="captain">Captain</SelectItem>
                        <SelectItem value="dsr">DSR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.audit_target_type === 'captain' ? (
                  <div>
                    <Label>Captain</Label>
                    <Select value={form.captain_id} onValueChange={(value) => setForm((current) => ({ ...current, captain_id: value }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select captain" /></SelectTrigger>
                      <SelectContent>
                        {captainOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                <div>
                  <Label>DSR</Label>
                  <Select value={form.dsr_id} onValueChange={(value) => setForm((current) => ({ ...current, dsr_id: value }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select DSR" /></SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}{option.captainName ? ` (Captain: ${option.captainName})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={() => void loadMetrics()} disabled={!(form.audit_target_type === 'captain' ? form.captain_id : form.dsr_id) || metricsLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
                    Pull Data
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{soldCount}</p><p className="text-xs text-muted-foreground">Total Sales</p></GlassCard>
                  <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{stockCount}</p><p className="text-xs text-muted-foreground">Stock In Hand</p></GlassCard>
                  <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{unpaidCount}</p><p className="text-xs text-muted-foreground">Unpaid</p></GlassCard>
                  <GlassCard className="p-3 text-center"><p className="text-xl font-bold">{noPackageCount}</p><p className="text-xs text-muted-foreground">No Package</p></GlassCard>
                </div>
                <div>
                  <Label>Smartcards Sold</Label>
                  <Textarea value={form.sold_smartcards} onChange={(event) => setForm((current) => ({ ...current, sold_smartcards: event.target.value }))} className="mt-1 min-h-24" placeholder="Pulled sales can be edited manually." />
                </div>
                <div>
                  <Label>Stock In Hand Smartcards</Label>
                  <Textarea value={form.stock_in_hand_smartcards} onChange={(event) => setForm((current) => ({ ...current, stock_in_hand_smartcards: event.target.value }))} className="mt-1 min-h-24" placeholder="Pulled stock can be edited manually." />
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
                  <Textarea value={form.issues} onChange={(event) => setForm((current) => ({ ...current, issues: event.target.value }))} className="mt-1" placeholder="List any field issues, blockers, or visit findings" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1" placeholder="Optional follow-up notes" />
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
                <Button type="submit" className="w-full" disabled={saving || !form.dsr_id}>
                  {saving ? 'Submitting...' : `Submit ${form.audit_target_type === 'captain' ? 'Captain' : 'DSR'} Audit`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(3)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <GlassCard className="p-4 text-center"><ClipboardCheck className="h-6 w-6 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{audits.length}</p><p className="text-sm text-muted-foreground">Total Audits</p></GlassCard>
              <GlassCard className="p-4 text-center"><CheckCircle2 className="h-6 w-6 mx-auto text-green-500 mb-2" /><p className="text-2xl font-bold">{auditedDsrCount}</p><p className="text-sm text-muted-foreground">Audited DSRs</p></GlassCard>
              <GlassCard className="p-4 text-center"><AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" /><p className="text-2xl font-bold">{issueCount}</p><p className="text-sm text-muted-foreground">Issues Raised</p></GlassCard>
            </div>

            <div className="space-y-3">
              {audits.length === 0 && <p className="text-sm text-muted-foreground">No audits recorded yet.</p>}
              {audits.map((audit) => (
                <GlassCard key={audit.id} className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={audit.status === 'ok' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}>
                          {audit.status === 'ok' ? 'OK' : 'Issue'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{audit.audit_date}</span>
                        {audit.captainName && <span className="text-xs text-muted-foreground">Captain: {audit.captainName}</span>}
                      </div>
                        <div className="font-medium">{audit.subjectName}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground md:grid-cols-4">
                        <div>Sales: {audit.sales_count}</div>
                        <div>Stock: {audit.total_stock}</div>
                        <div>Unpaid: {audit.unpaidSmartcards.length}</div>
                          <div>{audit.targetType === 'captain' ? `DSRs: ${audit.dsr_count}` : `No Package: ${audit.noPackageSmartcards.length}`}</div>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>Issues: {audit.issues || 'None'}</div>
                        <div>Notes: {audit.notes || 'None'}</div>
                        <div>Sold smartcards: {formatSmartcardEntries(audit.soldSmartcards)}</div>
                        <div>Stock smartcards: {formatSmartcardEntries(audit.stockInHandSmartcards)}</div>
                        <div>Unpaid smartcards: {formatSmartcardEntries(audit.unpaidSmartcards)}</div>
                        <div>No package smartcards: {formatSmartcardEntries(audit.noPackageSmartcards)}</div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}