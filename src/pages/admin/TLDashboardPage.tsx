import { useCallback, useEffect, useState } from 'react';
import { Calendar, ClipboardCheck, CreditCard, Package, PackageCheck, PackageX, ShoppingCart, Users, TrendingUp, Target } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import SalesDateFilter from '@/components/SalesDateFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/auth-context';
import { createSalesDateRange, describeSalesDateRange, getDefaultSalesDateRange, type SalesDatePreset } from '@/lib/salesDateRange';
import { calculateTargetMetrics, DistributedTarget, getCurrentMonthYear, getMonthName } from '@/lib/targetCalculations';

interface DashboardStats {
  stockInHand: number;
  totalStockReceived: number;
  totalStockSold: number;
  soldThisMonth: number;
  soldToday: number;
  soldYesterday: number;
  unpaidCount: number;
  noPackageCount: number;
  dsrCount: number;
  auditedDsrCount: number;
  monthlyTarget: number;
  monthlyToDate: number;
  monthlyToDateGap: number;
}

interface RecentSale {
  id: string;
  smartcard_number: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
}

interface RecentAudit {
  id: string;
  dsrName: string;
  audit_date: string;
  status: string;
}

export default function TLDashboardPage() {
  const { currentTeamLeader, currentCaptain, isCaptain, isTeamLeader } = useAuth();
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    stockInHand: 0,
    totalStockReceived: 0,
    totalStockSold: 0,
    soldThisMonth: 0,
    soldToday: 0,
    soldYesterday: 0,
    unpaidCount: 0,
    noPackageCount: 0,
    dsrCount: 0,
    auditedDsrCount: 0,
    monthlyTarget: 0,
    monthlyToDate: 0,
    monthlyToDateGap: 0,
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  const [salesDatePreset, setSalesDatePreset] = useState<SalesDatePreset>('this_month');
  const [salesDateFrom, setSalesDateFrom] = useState(defaultSalesDateRange.startDate);
  const [salesDateTo, setSalesDateTo] = useState(defaultSalesDateRange.endDate);

  const ownerId = isCaptain ? currentCaptain?.id : currentTeamLeader?.id;
  const ownerName = isCaptain ? currentCaptain?.name : currentTeamLeader?.name;
  const ownerRoleLabel = isCaptain ? 'Captain' : 'TL';

  const salesDateRange = createSalesDateRange(salesDatePreset, salesDateFrom, salesDateTo);
  const salesDateLabel = describeSalesDateRange(salesDateRange);
  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const fetchDashboardData = useCallback(async () => {
    if (!ownerId) return;

    setLoading(true);
    try {
      const stockInHandQuery = supabase
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_type', isCaptain ? 'captain' : 'team_leader')
        .eq('assigned_to_id', ownerId)
        .eq('status', 'assigned');

      const totalStockReceivedQuery = supabase
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_type', isCaptain ? 'captain' : 'team_leader')
        .eq('assigned_to_id', ownerId);

      let totalSalesQuery = supabase
        .from('sales_records')
        .select('id', { count: 'exact', head: true });

      let soldThisMonthQuery = supabase
        .from('sales_records')
        .select('id', { count: 'exact', head: true })
        .gte('sale_date', thisMonthStart)
        .lte('sale_date', today);

      let soldTodayQuery = supabase
        .from('sales_records')
        .select('id', { count: 'exact', head: true })
        .eq('sale_date', today);

      let soldYesterdayQuery = supabase
        .from('sales_records')
        .select('id', { count: 'exact', head: true })
        .eq('sale_date', yesterday);

      let recentSalesQuery = supabase
        .from('sales_records')
        .select('id, smartcard_number, customer_name, sale_date, payment_status, package_status')
        .gte('sale_date', salesDateRange.startDate)
        .lte('sale_date', salesDateRange.endDate)
        .order('sale_date', { ascending: false })
        .limit(5);

      if (isCaptain) {
        totalSalesQuery = totalSalesQuery.eq('captain_id', ownerId);
        soldThisMonthQuery = soldThisMonthQuery.eq('captain_id', ownerId);
        soldTodayQuery = soldTodayQuery.eq('captain_id', ownerId);
        soldYesterdayQuery = soldYesterdayQuery.eq('captain_id', ownerId);
        recentSalesQuery = recentSalesQuery.eq('captain_id', ownerId);
      } else {
        totalSalesQuery = totalSalesQuery.eq('team_leader_id', ownerId);
        soldThisMonthQuery = soldThisMonthQuery.eq('team_leader_id', ownerId);
        soldTodayQuery = soldTodayQuery.eq('team_leader_id', ownerId);
        soldYesterdayQuery = soldYesterdayQuery.eq('team_leader_id', ownerId);
        recentSalesQuery = recentSalesQuery.eq('team_leader_id', ownerId);
      }

      const [
        totalSalesRes,
        soldThisMonthRes,
        soldTodayRes,
        soldYesterdayRes,
        unpaidRes,
        noPackageRes,
        stockInHandRes,
        totalStockReceivedRes,
        recentSalesRes,
      ] = await Promise.all([
        totalSalesQuery,
        soldThisMonthQuery,
        soldTodayQuery,
        soldYesterdayQuery,
        supabase
        .from('sales_records')
        .select('id', { count: 'exact', head: true })
        .eq(isCaptain ? 'captain_id' : 'team_leader_id', ownerId)
        .eq('payment_status', 'Unpaid'),
        supabase
        .from('sales_records')
        .select('id', { count: 'exact', head: true })
        .eq(isCaptain ? 'captain_id' : 'team_leader_id', ownerId)
        .eq('package_status', 'No Package'),
        stockInHandQuery,
        totalStockReceivedQuery,
        recentSalesQuery,
      ]);

      let dsrRows: Array<{ id: string; captain_id: string | null }> = [];

      if (isTeamLeader && currentTeamLeader) {
        const { data: teamCaptains } = await supabase.from('captains').select('id').eq('team_leader_id', currentTeamLeader.id);
        const captainRows = teamCaptains || [];
        const captainIds = captainRows.map((captain) => captain.id);
        const { data: teamDsrs } = captainIds.length > 0
          ? await supabase.from('dsrs').select('id, captain_id').in('captain_id', captainIds)
          : { data: [] as Array<{ id: string; captain_id: string | null }> };
        dsrRows = teamDsrs || [];
      } else if (isCaptain && currentCaptain) {
        const { data: captainDsrs } = await supabase.from('dsrs').select('id, captain_id').eq('captain_id', currentCaptain.id);
        dsrRows = captainDsrs || [];
      }

      let auditsQuery = supabase
        .from('audits')
        .select('id, dsr_id, audit_date, status')
        .eq('audit_target_type', 'dsr')
        .gte('audit_date', salesDateRange.startDate)
        .lte('audit_date', salesDateRange.endDate)
        .order('audit_date', { ascending: false })
        .limit(5);

      auditsQuery = auditsQuery.eq(isCaptain ? 'captain_id' : 'team_leader_id', ownerId);
      const { data: auditRows } = await auditsQuery;

      const auditDsrIds = Array.from(new Set((auditRows || []).map((audit) => audit.dsr_id).filter(Boolean))) as string[];
      const { data: auditDsrs } = auditDsrIds.length > 0
        ? await supabase.from('dsrs').select('id, name').in('id', auditDsrIds)
        : { data: [] as Array<{ id: string; name: string }> };
      const auditDsrMap = new Map((auditDsrs || []).map((dsr) => [dsr.id, dsr.name]));

      // Fetch monthly target for TL (only for TLs, not captains)
      let monthlyTarget = 0;
      let monthlyToDate = 0;
      let monthlyToDateGap = 0;

      if (isTeamLeader && ownerId) {
        const currentMonth = getCurrentMonthYear();
        const { data: targetData } = await supabase
          .from('sales_targets')
          .select('target_amount')
          .eq('team_leader_id', ownerId)
          .eq('year', currentMonth.year)
          .eq('month', currentMonth.month)
          .single();

        if (targetData) {
          monthlyTarget = targetData.target_amount;
          const metrics = calculateTargetMetrics(
            monthlyTarget,
            soldThisMonthRes.count || 0,
            currentMonth.year,
            currentMonth.month
          );
          monthlyToDate = metrics.monthlyToDate;
          monthlyToDateGap = metrics.monthlyToDateGap;
        }
      }

      setStats({
        stockInHand: stockInHandRes.count || 0,
        totalStockReceived: totalStockReceivedRes.count || 0,
        totalStockSold: totalSalesRes.count || 0,
        soldThisMonth: soldThisMonthRes.count || 0,
        soldToday: soldTodayRes.count || 0,
        soldYesterday: soldYesterdayRes.count || 0,
        unpaidCount: unpaidRes.count || 0,
        noPackageCount: noPackageRes.count || 0,
        dsrCount: dsrRows.length,
        auditedDsrCount: new Set((auditRows || []).map((audit) => audit.dsr_id).filter(Boolean)).size,
        monthlyTarget,
        monthlyToDate,
        monthlyToDateGap,
      });
      setRecentSales(recentSalesRes.data || []);
      setRecentAudits((auditRows || []).map((audit) => ({
        id: audit.id,
        dsrName: audit.dsr_id ? auditDsrMap.get(audit.dsr_id) || 'Unknown DSR' : 'Unknown DSR',
        audit_date: audit.audit_date,
        status: audit.status,
      })));
    } finally {
      setLoading(false);
    }
  }, [currentCaptain, currentTeamLeader, isCaptain, isTeamLeader, ownerId, salesDateRange.endDate, salesDateRange.startDate, thisMonthStart, today, yesterday]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSalesDatePresetChange = (preset: SalesDatePreset) => {
    const nextRange = createSalesDateRange(preset, salesDateFrom, salesDateTo);
    setSalesDatePreset(preset);
    setSalesDateFrom(nextRange.startDate);
    setSalesDateTo(nextRange.endDate);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">TL Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview for {ownerName || 'your account'}.</p>
          </div>
          <Badge variant="outline" className="w-fit">
            <Calendar className="h-4 w-4 mr-2" />
            {salesDateLabel}
          </Badge>
        </div>

        <SalesDateFilter
          preset={salesDatePreset}
          startDate={salesDateFrom}
          endDate={salesDateTo}
          onPresetChange={handleSalesDatePresetChange}
          onStartDateChange={setSalesDateFrom}
          onEndDateChange={setSalesDateTo}
        />

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[...Array(6)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <GlassCard className="p-4 text-center"><Package className="h-6 w-6 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{stats.stockInHand}</p><p className="text-sm text-muted-foreground">Stock In Hand</p></GlassCard>
              <GlassCard className="p-4 text-center"><PackageCheck className="h-6 w-6 mx-auto text-cyan-500 mb-2" /><p className="text-2xl font-bold">{stats.totalStockReceived}</p><p className="text-sm text-muted-foreground">Total Stock Received</p></GlassCard>
              <GlassCard className="p-4 text-center"><ShoppingCart className="h-6 w-6 mx-auto text-blue-500 mb-2" /><p className="text-2xl font-bold">{stats.totalStockSold}</p><p className="text-sm text-muted-foreground">Total Stock Sold</p></GlassCard>
              <GlassCard className="p-4 text-center"><Calendar className="h-6 w-6 mx-auto text-violet-500 mb-2" /><p className="text-2xl font-bold">{stats.soldThisMonth}</p><p className="text-sm text-muted-foreground">Sold This Month</p></GlassCard>
              <GlassCard className="p-4 text-center"><Calendar className="h-6 w-6 mx-auto text-emerald-500 mb-2" /><p className="text-2xl font-bold">{stats.soldToday}</p><p className="text-sm text-muted-foreground">Sold Today</p></GlassCard>
              <GlassCard className="p-4 text-center"><Calendar className="h-6 w-6 mx-auto text-orange-500 mb-2" /><p className="text-2xl font-bold">{stats.soldYesterday}</p><p className="text-sm text-muted-foreground">Sold Yesterday</p></GlassCard>
              <GlassCard className="p-4 text-center"><CreditCard className="h-6 w-6 mx-auto text-red-500 mb-2" /><p className="text-2xl font-bold">{stats.unpaidCount}</p><p className="text-sm text-muted-foreground">All Unpaid</p></GlassCard>
              <GlassCard className="p-4 text-center"><PackageX className="h-6 w-6 mx-auto text-amber-500 mb-2" /><p className="text-2xl font-bold">{stats.noPackageCount}</p><p className="text-sm text-muted-foreground">All No Package</p></GlassCard>
              <GlassCard className="p-4 text-center"><Users className="h-6 w-6 mx-auto text-indigo-500 mb-2" /><p className="text-2xl font-bold">{stats.dsrCount}</p><p className="text-sm text-muted-foreground">Total DSR</p></GlassCard>
              <GlassCard className="p-4 text-center"><ClipboardCheck className="h-6 w-6 mx-auto text-green-500 mb-2" /><p className="text-2xl font-bold">{stats.auditedDsrCount}</p><p className="text-sm text-muted-foreground">Audited DSRs</p></GlassCard>
            </div>

            {/* Monthly Target Summary (for Team Leaders only) */}
            {isTeamLeader && stats.monthlyTarget > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Monthly Target</span>
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-3xl font-bold">{stats.monthlyTarget.toLocaleString()}</p>
                  <div className="mt-3">
                    <Progress value={(stats.soldThisMonth / stats.monthlyTarget) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">{stats.soldThisMonth} / {stats.monthlyTarget} ({Math.round((stats.soldThisMonth / stats.monthlyTarget) * 100)}%)</p>
                  </div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Monthly To Date Target</span>
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold">{stats.monthlyToDate.toLocaleString()}</p>
                  <div className="mt-3">
                    <Progress value={(Math.max(0, stats.soldThisMonth) / stats.monthlyToDate) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">{stats.soldThisMonth} / {stats.monthlyToDate} targets</p>
                  </div>
                </GlassCard>

                <GlassCard className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Monthly To Date Gap</span>
                    <Badge className={stats.monthlyToDateGap >= 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                      {stats.monthlyToDateGap >= 0 ? '+' : ''}{stats.monthlyToDateGap.toLocaleString()}
                    </Badge>
                  </div>
                  <p className={`text-2xl font-bold ${stats.monthlyToDateGap >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(stats.monthlyToDateGap).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats.monthlyToDateGap >= 0 ? 'Ahead of pace' : 'Behind pace'}
                  </p>
                </GlassCard>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <GlassCard className="p-4">
                <h2 className="text-lg font-semibold mb-4">My Details</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Role</span><span className="font-medium">{ownerRoleLabel}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Name</span><span className="font-medium">{ownerName || '-'}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Phone</span><span className="font-medium">{(isCaptain ? currentCaptain?.phone : currentTeamLeader?.phone) || '-'}</span></div>
                  {!isCaptain && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Region</span><span className="font-medium">{currentTeamLeader?.region_name || '-'}</span></div>}
                  {isCaptain && <div className="flex justify-between gap-4"><span className="text-muted-foreground">Team Leader</span><span className="font-medium">{currentCaptain?.team_leader_name || '-'}</span></div>}
                </div>
              </GlassCard>
              <GlassCard className="p-4">
                <h2 className="text-lg font-semibold mb-4">Recent Sales</h2>
                <div className="space-y-3">
                  {recentSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sales found for this period.</p>
                  ) : (
                    recentSales.map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                        <div>
                          <div className="font-medium">{sale.smartcard_number}</div>
                          <div className="text-xs text-muted-foreground">{sale.customer_name || 'No customer'} • {sale.sale_date}</div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={sale.payment_status === 'Paid' ? 'default' : 'destructive'}>{sale.payment_status}</Badge>
                          <Badge variant="outline">{sale.package_status}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
              <GlassCard className="p-4">
                <h2 className="text-lg font-semibold mb-4">Recent Audits</h2>
                <div className="space-y-3">
                  {recentAudits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No audits found for this period.</p>
                  ) : (
                    recentAudits.map((audit) => (
                      <div key={audit.id} className="flex items-center justify-between gap-4 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                        <div>
                          <div className="font-medium">{audit.dsrName}</div>
                          <div className="text-xs text-muted-foreground">{audit.audit_date}</div>
                        </div>
                        <Badge className={audit.status === 'ok' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}>
                          {audit.status === 'ok' ? 'OK' : 'Issue'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}