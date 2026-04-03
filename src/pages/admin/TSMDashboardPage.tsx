import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, ClipboardCheck, CreditCard, MapPin, Package, PackageX, RefreshCw, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  regions: number;
  teamLeaders: number;
  captains: number;
  dsrs: number;
  totalSales: number;
  tlAssignedStock: number;
  unassignedStock: number;
  soldThisMonth: number;
  soldToday: number;
  soldYesterday: number;
  unpaidCount: number;
  noPackageCount: number;
  auditsLogged: number;
  issueAudits: number;
}

interface RecentAudit {
  id: string;
  audit_date: string;
  targetType: string;
  targetName: string;
  regionName: string;
  status: string;
  auditedByRole: string;
}

const initialStats: DashboardStats = {
  regions: 0,
  teamLeaders: 0,
  captains: 0,
  dsrs: 0,
  totalSales: 0,
  tlAssignedStock: 0,
  unassignedStock: 0,
  soldThisMonth: 0,
  soldToday: 0,
  soldYesterday: 0,
  unpaidCount: 0,
  noPackageCount: 0,
  auditsLogged: 0,
  issueAudits: 0,
};

export default function TSMDashboardPage() {
  const { adminUser, assignedRegionIds, isRegionalAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  const [regionNames, setRegionNames] = useState<Record<string, string>>({});
  const [regionFilter, setRegionFilter] = useState('all');

  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterday = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  }, []);
  const effectiveRegionIds = useMemo(
    () => (regionFilter === 'all' ? assignedRegionIds : assignedRegionIds.filter((regionId) => regionId === regionFilter)),
    [assignedRegionIds, regionFilter]
  );

  useEffect(() => {
    if (regionFilter !== 'all' && !assignedRegionIds.includes(regionFilter)) {
      setRegionFilter('all');
    }
  }, [assignedRegionIds, regionFilter]);

  const fetchData = useCallback(async () => {
    if (effectiveRegionIds.length === 0) {
      setStats(initialStats);
      setRecentAudits([]);
      setRegionNames({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading((current) => current && !refreshing);

    try {
      const [regionsRes, teamLeadersRes, inventoryRes, salesRes, auditsRes] = await Promise.all([
        supabase.from('regions').select('id, name').in('id', assignedRegionIds).order('name'),
        supabase.from('team_leaders').select('id, name, region_id').in('region_id', effectiveRegionIds).order('name'),
        supabase
          .from('inventory')
          .select('id, region_id, assigned_to_type, assigned_to_id, status')
          .in('region_id', effectiveRegionIds),
        supabase
          .from('sales_records')
          .select('id, region_id, sale_date, payment_status, package_status')
          .in('region_id', effectiveRegionIds),
        supabase
          .from('audits')
          .select('id, audit_date, status, audit_target_type, audited_by_role, team_leader_id, captain_id, dsr_id')
          .order('audit_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (regionsRes.error) throw regionsRes.error;
      if (teamLeadersRes.error) throw teamLeadersRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (salesRes.error) throw salesRes.error;
      if (auditsRes.error) throw auditsRes.error;

      const regionMap = Object.fromEntries((regionsRes.data || []).map((region) => [region.id, region.name]));
      setRegionNames(regionMap);

      const teamLeaders = teamLeadersRes.data || [];
      const teamLeaderIds = teamLeaders.map((teamLeader) => teamLeader.id);

      const [captainsRes, dsrsRes] = await Promise.all([
        teamLeaderIds.length > 0
          ? supabase.from('captains').select('id, name, team_leader_id').in('team_leader_id', teamLeaderIds).order('name')
          : Promise.resolve({ data: [], error: null }),
        teamLeaderIds.length > 0
          ? supabase.from('dsrs').select('id, name, captain_id')
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (captainsRes.error) throw captainsRes.error;
      if (dsrsRes.error) throw dsrsRes.error;

      const captains = captainsRes.data || [];
      const captainIds = new Set(captains.map((captain) => captain.id));
      const filteredDsrs = (dsrsRes.data || []).filter((dsr) => dsr.captain_id && captainIds.has(dsr.captain_id));

      const inventory = inventoryRes.data || [];
      const sales = salesRes.data || [];
      const scopedAudits = (auditsRes.data || []).filter((audit) => {
        const teamLeader = teamLeaders.find((item) => item.id === audit.team_leader_id);
        if (teamLeader?.region_id) return effectiveRegionIds.includes(teamLeader.region_id);

        const captain = captains.find((item) => item.id === audit.captain_id);
        if (captain?.team_leader_id) {
          const captainTl = teamLeaders.find((item) => item.id === captain.team_leader_id);
          if (captainTl?.region_id) return effectiveRegionIds.includes(captainTl.region_id);
        }

        const dsr = filteredDsrs.find((item) => item.id === audit.dsr_id);
        if (dsr?.captain_id) {
          const dsrCaptain = captains.find((item) => item.id === dsr.captain_id);
          const dsrTl = teamLeaders.find((item) => item.id === dsrCaptain?.team_leader_id);
          if (dsrTl?.region_id) return effectiveRegionIds.includes(dsrTl.region_id);
        }

        return false;
      });

      setStats({
        regions: effectiveRegionIds.length,
        teamLeaders: teamLeaders.length,
        captains: captains.length,
        dsrs: filteredDsrs.length,
        totalSales: sales.length,
        tlAssignedStock: inventory.filter(
          (item) => item.assigned_to_type === 'team_leader' && item.assigned_to_id && item.status !== 'available'
        ).length,
        unassignedStock: inventory.filter((item) => !item.assigned_to_id && item.status === 'available').length,
        soldThisMonth: sales.filter((sale) => sale.sale_date >= monthStart).length,
        soldToday: sales.filter((sale) => sale.sale_date === today).length,
        soldYesterday: sales.filter((sale) => sale.sale_date === yesterday).length,
        unpaidCount: sales.filter((sale) => sale.payment_status === 'Unpaid').length,
        noPackageCount: sales.filter((sale) => sale.package_status === 'No Package').length,
        auditsLogged: scopedAudits.length,
        issueAudits: scopedAudits.filter((audit) => audit.status === 'issue').length,
      });

      setRecentAudits(
        scopedAudits.slice(0, 8).map((audit) => {
          const teamLeader = teamLeaders.find((item) => item.id === audit.team_leader_id) || null;
          const captain = captains.find((item) => item.id === audit.captain_id) || null;
          const dsr = filteredDsrs.find((item) => item.id === audit.dsr_id) || null;
          const ownerTl = teamLeader
            || (captain?.team_leader_id ? teamLeaders.find((item) => item.id === captain.team_leader_id) || null : null)
            || (dsr?.captain_id
              ? (() => {
                  const dsrCaptain = captains.find((item) => item.id === dsr.captain_id) || null;
                  return dsrCaptain?.team_leader_id
                    ? teamLeaders.find((item) => item.id === dsrCaptain.team_leader_id) || null
                    : null;
                })()
              : null);

          return {
            id: audit.id,
            audit_date: audit.audit_date,
            targetType: audit.audit_target_type,
            targetName:
              audit.audit_target_type === 'team_leader'
                ? teamLeader?.name || 'Unknown Team Leader'
                : audit.audit_target_type === 'captain'
                  ? captain?.name || 'Unknown Captain'
                  : dsr?.name || 'Unknown DSR',
            regionName: ownerTl?.region_id ? regionMap[ownerTl.region_id] || 'Unknown Region' : 'Unknown Region',
            status: audit.status,
            auditedByRole: audit.audited_by_role,
          };
        })
      );
    } catch (error) {
      console.error('Error loading TSM dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assignedRegionIds, effectiveRegionIds, monthStart, refreshing, today, yesterday]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const salesSummaryCards = [
    { label: 'Sales This Month', value: stats.soldThisMonth, icon: TrendingUp, accent: 'text-emerald-600' },
    { label: 'Total Sales', value: stats.totalSales, icon: ClipboardCheck, accent: 'text-primary' },
    { label: 'All Unpaid', value: stats.unpaidCount, icon: CreditCard, accent: 'text-red-600' },
    { label: 'All No Package', value: stats.noPackageCount, icon: PackageX, accent: 'text-amber-600' },
    { label: 'Sold Today', value: stats.soldToday, icon: Calendar, accent: 'text-blue-600' },
    { label: 'Sold Yesterday', value: stats.soldYesterday, icon: Calendar, accent: 'text-orange-600' },
  ];

  const territoryCards = [
    { label: 'Regions In Scope', value: stats.regions, icon: MapPin },
    { label: 'Team Leaders', value: stats.teamLeaders, icon: Users },
    { label: 'Captains', value: stats.captains, icon: ShieldCheck },
    { label: 'DSRs', value: stats.dsrs, icon: Activity },
    { label: 'TL Assigned Stock', value: stats.tlAssignedStock, icon: Package },
    { label: 'Unassigned Stock', value: stats.unassignedStock, icon: Package },
    { label: 'Audits Logged', value: stats.auditsLogged, icon: ClipboardCheck },
    { label: 'Issue Audits', value: stats.issueAudits, icon: ClipboardCheck },
  ];

  const dashboardTitle = isRegionalAdmin ? 'Regional Admin Dashboard' : 'TSM Dashboard';
  const dashboardDescription = isRegionalAdmin
    ? 'Region-wide visibility across your assigned regions.'
    : 'Territory-wide visibility across your assigned regions.';
  const signedInLabel = isRegionalAdmin ? 'Regional Admin' : 'Territory Manager';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">{dashboardTitle}</h1>
            <p className="text-muted-foreground mt-1">{dashboardDescription}</p>
            <p className="text-sm text-muted-foreground mt-1">Signed in as {adminUser?.name || adminUser?.email || signedInLabel}.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                variant={regionFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRegionFilter('all')}
              >
                All Regions
              </Button>
              {assignedRegionIds.map((regionId) => (
                <Button
                  key={regionId}
                  variant={regionFilter === regionId ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRegionFilter(regionId)}
                >
                  {regionNames[regionId] || 'Assigned Region'}
                </Button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setRefreshing(true);
              fetchData();
            }}
            disabled={loading || refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Sales Summary</h2>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
              : salesSummaryCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <GlassCard key={card.label} className="p-4 text-center">
                      <Icon className={`h-6 w-6 mx-auto mb-2 ${card.accent}`} />
                      <p className="text-2xl font-bold">{card.value}</p>
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                    </GlassCard>
                  );
                })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
            : territoryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <GlassCard key={card.label} className="p-4">
                    <Icon className="h-5 w-5 text-primary mb-3" />
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                  </GlassCard>
                );
              })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="p-4">
            <h2 className="text-lg font-semibold mb-4">Recent Audits</h2>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAudits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No audits found for your territory.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentAudits.map((audit) => (
                        <TableRow key={audit.id}>
                          <TableCell>{new Date(audit.audit_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="font-medium">{audit.targetName}</div>
                            <div className="text-xs text-muted-foreground">{audit.targetType.replace('_', ' ')}</div>
                          </TableCell>
                          <TableCell>{audit.regionName}</TableCell>
                          <TableCell>
                            <Badge variant={audit.status === 'issue' ? 'destructive' : 'default'}>{audit.status}</Badge>
                          </TableCell>
                          <TableCell>{audit.auditedByRole.replace('_', ' ')}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Territory Summary</h2>
              <p className="text-sm text-muted-foreground mt-1">Current-month sales are scoped, while unpaid and no-package remain cumulative.</p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <span className="text-sm text-muted-foreground">Audits Logged</span>
                  <span className="font-semibold">{stats.auditsLogged}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <span className="text-sm text-muted-foreground">Unpaid Sales</span>
                  <span className="font-semibold">{stats.unpaidCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <span className="text-sm text-muted-foreground">No Package</span>
                  <span className="font-semibold">{stats.noPackageCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border p-3">
                  <span className="text-sm text-muted-foreground">Managed Staff</span>
                  <span className="font-semibold">{stats.teamLeaders + stats.captains + stats.dsrs}</span>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </AdminLayout>
  );
}