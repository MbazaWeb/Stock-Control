import { useCallback, useEffect, useState } from 'react';
import {
  Package,
  TrendingUp,
  CreditCard,
  PackageX,
  Users,
  BarChart3,
  AlertTriangle,
  Activity,
  Clock,
  Calendar,
  ShoppingCart,
  Filter,
} from 'lucide-react';
import SalesDateFilter from '@/components/SalesDateFilter';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import StatsCard from '@/components/ui/StatsCard';
import GlassCard from '@/components/ui/GlassCard';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';
import {
  createSalesDateRange,
  describeSalesDateRange,
  getDefaultSalesDateRange,
  getSalesDatePresetLabel,
  listSalesDateRangeDays,
  type SalesDatePreset,
} from '@/lib/salesDateRange';

interface DashboardStats {
  totalStock: number;
  availableStock: number;
  soldToday: number;
  soldThisMonth: number;
  unpaidCount: number;
  noPackageCount: number;
  incompleteSales: number;
  teamLeaders: number;
  captains: number;
  dsrs: number;
  tlAssignedStock: number;
  tlSoldStock: number;
  tlInHandStock: number;
  auditedDsrs: number;
  recentActivity: number;
}

interface DailyTrend {
  date: string;
  units: number;
  dayName: string;
}

interface TLStockStatus {
  name: string;
  total_assigned: number;
  total_sold: number;
  available: number;
  in_hand: number;
  conversion_rate: number;
}

interface RecentSale {
  id: string;
  smartcard_number: string;
  sale_date: string;
  sale_time?: string;
  payment_status: string;
  package_status: string;
  customer_name: string | null;
  created_at: string;
}

interface RecentAudit {
  id: string;
  dsrName: string;
  audit_date: string;
  status: string;
}

export default function PublicDashboard() {
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [stats, setStats] = useState<DashboardStats>({
    totalStock: 0,
    availableStock: 0,
    soldToday: 0,
    soldThisMonth: 0,
    unpaidCount: 0,
    noPackageCount: 0,
    incompleteSales: 0,
    teamLeaders: 0,
    captains: 0,
    dsrs: 0,
    tlAssignedStock: 0,
    tlSoldStock: 0,
    tlInHandStock: 0,
    auditedDsrs: 0,
    recentActivity: 0,
  });

  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [tlStockData, setTlStockData] = useState<TLStockStatus[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Array<{id: string; name: string}>>([]);
  const [allRegions, setAllRegions] = useState<Array<{id: string; name: string; zone_id: string | null}>>([]);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [salesDatePreset, setSalesDatePreset] = useState<SalesDatePreset>('this_month');
  const [salesDateFrom, setSalesDateFrom] = useState(defaultSalesDateRange.startDate);
  const [salesDateTo, setSalesDateTo] = useState(defaultSalesDateRange.endDate);

  const salesDateRange = createSalesDateRange(salesDatePreset, salesDateFrom, salesDateTo);
  const salesDateLabel = describeSalesDateRange(salesDateRange);
  const salesDateTitle = getSalesDatePresetLabel(salesDateRange.preset);

  useEffect(() => {
    const fetchFilters = async () => {
      const [z, r] = await Promise.all([
        supabase.from('zones').select('id, name').order('name'),
        supabase.from('regions').select('id, name, zone_id').order('name'),
      ]);
      setZones(z.data || []);
      setAllRegions(r.data || []);
    };
    fetchFilters();
  }, []);

  useEffect(() => { setRegionFilter('all'); }, [zoneFilter]);

  const handleSalesDatePresetChange = (preset: SalesDatePreset) => {
    const nextRange = createSalesDateRange(preset, salesDateFrom, salesDateTo);
    setSalesDatePreset(preset);
    setSalesDateFrom(nextRange.startDate);
    setSalesDateTo(nextRange.endDate);
  };

  const fetchTLStockData = useCallback(async () => {
    try {
      let tlQuery = supabase.from('team_leaders').select('id, name, region_id').order('name');
      if (regionFilter !== 'all') {
        tlQuery = tlQuery.eq('region_id', regionFilter);
      } else if (zoneFilter !== 'all') {
        // Only use allRegions at mount, not as a dependency
        const zoneRegionIds = allRegions.filter(r => r.zone_id === zoneFilter).map(r => r.id);
        if (zoneRegionIds.length > 0) tlQuery = tlQuery.in('region_id', zoneRegionIds);
        else return [];
      }
      const { data: teamLeaders } = await tlQuery;
      if (!teamLeaders || teamLeaders.length === 0) return [];
      const tlIds = teamLeaders.map(tl => tl.id);
      // Batch: fetch all inventory for these TLs in 2 queries instead of 3 per TL
      const [{ data: assignedItems }, { data: soldItems }] = await Promise.all([
        supabase.from('inventory').select('assigned_to_id').eq('assigned_to_type', 'team_leader').in('assigned_to_id', tlIds).eq('status', 'assigned'),
        supabase.from('inventory').select('assigned_to_id').eq('assigned_to_type', 'team_leader').in('assigned_to_id', tlIds).eq('status', 'sold'),
      ]);

      const assignedMap: Record<string, number> = {};
      const soldMap: Record<string, number> = {};
      (assignedItems || []).forEach((item) => {
        if (item.assigned_to_id) {
          assignedMap[item.assigned_to_id] = (assignedMap[item.assigned_to_id] || 0) + 1;
        }
      });
      (soldItems || []).forEach((item) => {
        if (item.assigned_to_id) {
          soldMap[item.assigned_to_id] = (soldMap[item.assigned_to_id] || 0) + 1;
        }
      });

      const tlStockStatus: TLStockStatus[] = teamLeaders.map(tl => {
        const in_hand = assignedMap[tl.id] || 0;
        const total_sold = soldMap[tl.id] || 0;
        const total_assigned = in_hand + total_sold;
        const conversion_rate = total_assigned > 0 ? (total_sold / total_assigned) * 100 : 0;
        return { name: tl.name, total_assigned, total_sold, available: total_assigned - total_sold, in_hand, conversion_rate };
      });

      tlStockStatus.sort((a, b) => b.conversion_rate - a.conversion_rate);
      return tlStockStatus;
    } catch (error) {
      console.error('Error fetching TL stock data:', error);
      return [];
    }
  }, [allRegions, regionFilter, zoneFilter]);

  const fetchRecentSales = useCallback(async () => {
    try {
      let query = supabase
        .from('sales_records')
        .select(`
          id,
          smartcard_number,
          sale_date,
          payment_status,
          package_status,
          customer_name,
          created_at
        `)
        .gte('sale_date', salesDateRange.startDate)
        .lte('sale_date', salesDateRange.endDate)
        .order('created_at', { ascending: false })
        .limit(5);

      if (zoneFilter !== 'all') query = query.eq('zone_id', zoneFilter);
      if (regionFilter !== 'all') query = query.eq('region_id', regionFilter);

      const { data: recentSales } = await query;

      if (recentSales) {
        const formattedSales = recentSales.map(sale => ({
          ...sale,
          sale_time: new Date(sale.created_at).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        }));
        setRecentSales(formattedSales);
      }
    } catch (error) {
      console.error('Error fetching recent sales:', error);
    }
  }, [regionFilter, salesDateRange.startDate, salesDateRange.endDate, zoneFilter]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const now = new Date();
      const todayISO = now.toISOString().split('T')[0];

      // Fetch TL stock data first
      const tlStockData = await fetchTLStockData();
      const tlAssignedStock = tlStockData.reduce((sum, tl) => sum + tl.total_assigned, 0);
      const tlSoldStock = tlStockData.reduce((sum, tl) => sum + tl.total_sold, 0);
      const tlInHandStock = tlStockData.reduce((sum, tl) => sum + tl.in_hand, 0);

      setTlStockData(tlStockData);

      // Build filtered queries
      const invQ = () => {
        let q = supabase.from('inventory').select('id', { count: 'exact', head: true });
        if (zoneFilter !== 'all') q = q.eq('zone_id', zoneFilter);
        if (regionFilter !== 'all') q = q.eq('region_id', regionFilter);
        return q;
      };
      const salesQ = () => {
        let q = supabase.from('sales_records').select('id', { count: 'exact', head: true });
        if (zoneFilter !== 'all') q = q.eq('zone_id', zoneFilter);
        if (regionFilter !== 'all') q = q.eq('region_id', regionFilter);
        return q;
      };
      const tlQ = () => {
        let q = supabase.from('team_leaders').select('id', { count: 'exact', head: true });
        if (regionFilter !== 'all') {
          q = q.eq('region_id', regionFilter);
        } else if (zoneFilter !== 'all') {
          const zoneRegionIds = allRegions.filter(r => r.zone_id === zoneFilter).map(r => r.id);
          if (zoneRegionIds.length > 0) q = q.in('region_id', zoneRegionIds);
        }
        return q;
      };

      const [
        inventoryRes,
        availableRes,
        salesTodayRes,
        salesPeriodRes,
        unpaidRes,
        noPackageRes,
        incompleteRes,
        tlRes,
        captainRes,
        dsrRes,
        auditRes,
      ] = await Promise.all([
        invQ(),
        invQ().eq('status', 'available').is('assigned_to_id', null),
        salesQ().eq('sale_date', todayISO),
        salesQ().gte('sale_date', salesDateRange.startDate).lte('sale_date', salesDateRange.endDate),
        salesQ().eq('payment_status', 'Unpaid').gte('sale_date', salesDateRange.startDate).lte('sale_date', salesDateRange.endDate),
        salesQ().eq('package_status', 'No Package').gte('sale_date', salesDateRange.startDate).lte('sale_date', salesDateRange.endDate),
        salesQ().is('dsr_id', null).gte('sale_date', salesDateRange.startDate).lte('sale_date', salesDateRange.endDate),
        tlQ(),
        supabase.from('captains').select('id', { count: 'exact', head: true }),
        supabase.from('dsrs').select('id', { count: 'exact', head: true }),
        supabase.from('audits').select('id, dsr_id, audit_date, status').eq('audit_target_type', 'dsr').gte('audit_date', salesDateRange.startDate).lte('audit_date', salesDateRange.endDate).order('audit_date', { ascending: false }).limit(5),
      ]);

      const auditDsrIds = Array.from(new Set((auditRes.data || []).map((audit) => audit.dsr_id).filter(Boolean))) as string[];
      const { data: auditDsrs } = auditDsrIds.length > 0
        ? await supabase.from('dsrs').select('id, name').in('id', auditDsrIds)
        : { data: [] as Array<{ id: string; name: string }> };
      const auditDsrMap = new Map((auditDsrs || []).map((dsr) => [dsr.id, dsr.name]));

      setStats({
        totalStock: inventoryRes.count ?? 0,
        availableStock: availableRes.count ?? 0,
        soldToday: salesTodayRes.count ?? 0,
        soldThisMonth: salesPeriodRes.count ?? 0,
        unpaidCount: unpaidRes.count ?? 0,
        noPackageCount: noPackageRes.count ?? 0,
        incompleteSales: incompleteRes.count ?? 0,
        teamLeaders: tlRes.count ?? 0,
        captains: captainRes.count ?? 0,
        dsrs: dsrRes.count ?? 0,
        tlAssignedStock,
        tlSoldStock,
        tlInHandStock,
        auditedDsrs: new Set((auditRes.data || []).map((audit) => audit.dsr_id).filter((value): value is string => Boolean(value))).size,
        recentActivity: salesTodayRes.count ?? 0,
      });
      setRecentAudits((auditRes.data || []).map((audit) => ({
        id: audit.id,
        dsrName: audit.dsr_id ? auditDsrMap.get(audit.dsr_id) || 'Unknown DSR' : 'Unknown DSR',
        audit_date: audit.audit_date,
        status: audit.status,
      })));

      // Fetch recent sales
      await fetchRecentSales();

      let trendQuery = supabase
        .from('sales_records')
        .select('sale_date')
        .gte('sale_date', salesDateRange.startDate)
        .lte('sale_date', salesDateRange.endDate);
      if (zoneFilter !== 'all') trendQuery = trendQuery.eq('zone_id', zoneFilter);
      if (regionFilter !== 'all') trendQuery = trendQuery.eq('region_id', regionFilter);
      const { data: trendData } = await trendQuery;

      const dayCounts: Record<string, number> = {};
      (trendData || []).forEach(r => { dayCounts[r.sale_date] = (dayCounts[r.sale_date] || 0) + 1; });

      const trends: DailyTrend[] = listSalesDateRangeDays(salesDateRange).map((iso) => {
        const date = new Date(`${iso}T00:00:00`);

        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          units: dayCounts[iso] || 0,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        };
      });

      setDailyTrends(trends);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [regionFilter, salesDateRange.startDate, salesDateRange.endDate, zoneFilter]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </PublicLayout>
    );
  }

  const stockUtilization = stats.totalStock > 0
    ? Math.round(((stats.totalStock - stats.availableStock) / stats.totalStock) * 100)
    : 0;

  const tlStockUtilization = stats.tlAssignedStock > 0 
    ? Math.round((stats.tlSoldStock / stats.tlAssignedStock) * 100) 
    : 0;

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <PublicLayout>
      <div className="space-y-3 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl md:text-4xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Stock Dashboard
              </span>
            </h1>
            <p className="text-xs md:text-base text-muted-foreground">
              Real-time inventory and sales overview
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1 md:gap-2 text-[11px] md:text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{currentDate}</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2 text-[11px] md:text-sm text-muted-foreground">
              <Clock className="h-3 w-3 md:h-4 md:w-4" />
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Zone/Region Filter */}
        <GlassCard className="p-3 md:p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {(zoneFilter === 'all' ? allRegions : allRegions.filter(r => r.zone_id === zoneFilter)).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <SalesDateFilter
              preset={salesDatePreset}
              startDate={salesDateFrom}
              endDate={salesDateTo}
              onPresetChange={handleSalesDatePresetChange}
              onStartDateChange={setSalesDateFrom}
              onEndDateChange={setSalesDateTo}
            />
          </div>
        </GlassCard>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          <GlassCard className="!p-2.5 md:!p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] md:text-sm text-muted-foreground truncate">Daily Avg Units</p>
                <p className="text-lg md:text-2xl font-bold mt-0.5">
                  {(dailyTrends.reduce((sum, day) => sum + day.units, 0) / 7).toFixed(1)}
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-full bg-green-500/10 flex-shrink-0">
                <TrendingUp className="h-4 w-4 md:h-6 md:w-6 text-green-500" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="!p-2.5 md:!p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] md:text-sm text-muted-foreground truncate">Active Sales Today</p>
                <p className="text-lg md:text-2xl font-bold mt-0.5">{stats.soldToday}</p>
              </div>
              <div className="p-2 md:p-3 rounded-full bg-blue-500/10 flex-shrink-0">
                <Clock className="h-4 w-4 md:h-6 md:w-6 text-blue-500" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="!p-2.5 md:!p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] md:text-sm text-muted-foreground truncate">Stock Turnover</p>
                <p className="text-lg md:text-2xl font-bold mt-0.5">
                  {stats.tlAssignedStock > 0 ? 
                    `${Math.round((stats.tlSoldStock / stats.tlAssignedStock) * 100)}%` : '0%'}
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-full bg-purple-500/10 flex-shrink-0">
                <BarChart3 className="h-4 w-4 md:h-6 md:w-6 text-purple-500" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="!p-2.5 md:!p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] md:text-sm text-muted-foreground truncate">Pending Units</p>
                <p className="text-lg md:text-2xl font-bold mt-0.5">{stats.unpaidCount}</p>
              </div>
              <div className="p-2 md:p-3 rounded-full bg-orange-500/10 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 md:h-6 md:w-6 text-orange-500" />
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          <StatsCard 
            title="Total Inventory" 
            value={stats.totalStock.toLocaleString()} 
            subtitle={`${stats.availableStock} available units`} 
            icon={Package} 
            variant="blue" 
          />
          <StatsCard 
            title="Sales Today" 
            value={stats.soldToday.toString()} 
            subtitle={`${stats.recentActivity} units • ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`} 
            icon={TrendingUp} 
            variant="gold" 
          />
          <StatsCard 
            title={salesDateTitle} 
            value={stats.soldThisMonth.toString()} 
            subtitle={`${salesDateLabel} sales`} 
            icon={BarChart3} 
            variant="blue" 
          />
          <StatsCard 
            title="Pending Units" 
            value={stats.unpaidCount.toString()} 
            subtitle="Unpaid sales" 
            icon={CreditCard} 
            variant="warning" 
          />
          <StatsCard 
            title="No Package" 
            value={stats.noPackageCount.toString()} 
            subtitle="Awaiting package" 
            icon={PackageX} 
            variant="destructive" 
          />
          <StatsCard 
            title="Incomplete Sales" 
            value={stats.incompleteSales.toString()} 
            subtitle="Missing DSR / not scanned" 
            icon={AlertTriangle} 
            variant="warning" 
          />
          <StatsCard 
            title="TL Stock Status" 
            value={`${tlStockUtilization}%`} 
            subtitle={`${stats.tlSoldStock} sold of ${stats.tlAssignedStock} assigned`} 
            icon={Users} 
            variant={tlStockUtilization >= 70 ? "success" : tlStockUtilization >= 50 ? "gold" : "warning"} 
          />
          <StatsCard 
            title="In-hand Stock" 
            value={stats.tlInHandStock.toString()} 
            subtitle={`With team leaders`} 
            icon={ShoppingCart} 
            variant="blue" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          {/* Sales Trend Chart */}
          <GlassCard className="lg:col-span-2 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Sales Trend (Units)
              </h3>
              <div className="text-sm text-muted-foreground">
                {salesDateLabel} • {dailyTrends.reduce((sum, day) => sum + day.units, 0)} units
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrends}>
                  <defs>
                    <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="dayName" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    formatter={(value, name) => {
                      return [`${value} units`, 'Units Sold'];
                    }}
                    labelFormatter={(label) => String(label)}
                  />
                  <Area
                    type="monotone"
                    dataKey="units"
                    name="Units Sold"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorUnits)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Recent Activity */}
          <div className="space-y-6">
            <GlassCard className="hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Recent Sales
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {recentSales.length > 0 ? (
                  recentSales.map((sale, index) => (
                    <div 
                      key={index} 
                      className="p-3 rounded-lg border border-border/30 hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">{sale.smartcard_number}</div>
                            <Badge className={`text-xs ${sale.package_status === 'Packaged' ? 'bg-purple-500/20 text-purple-500 border-purple-500/30' : 'bg-pink-500/20 text-pink-500 border-pink-500/30'}`}>
                              {sale.package_status === 'Packaged' ? '✓ Packaged' : 'No Package'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {sale.customer_name || 'No customer name'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{sale.sale_time}</div>
                          <Badge 
                            className={`text-xs mt-1 ${sale.payment_status === 'Paid' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'}`}
                          >
                            {sale.payment_status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No sales recorded for {salesDateLabel.toLowerCase()}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Quick Summary */}
            <GlassCard className="hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Activity Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2">
                  <span className="text-sm">Team Leaders</span>
                  <Badge variant="outline">{stats.teamLeaders}</Badge>
                </div>
                <div className="flex justify-between items-center p-2">
                  <span className="text-sm">Captains</span>
                  <Badge variant="outline">{stats.captains}</Badge>
                </div>
                <div className="flex justify-between items-center p-2">
                  <span className="text-sm">DSRs</span>
                  <Badge variant="outline">{stats.dsrs}</Badge>
                </div>
                <div className="flex justify-between items-center p-2">
                  <span className="text-sm">Audited DSRs</span>
                  <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">{stats.auditedDsrs}</Badge>
                </div>
                <div className="flex justify-between items-center p-2">
                  <span className="text-sm">Total Sales Team</span>
                  <Badge variant="outline" className="bg-primary/20 text-primary">
                    {stats.teamLeaders + stats.captains + stats.dsrs}
                  </Badge>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-500" />
                Recent DSR Audits
              </h3>
              <div className="space-y-3">
                {recentAudits.length > 0 ? (
                  recentAudits.map((audit) => (
                    <div key={audit.id} className="flex items-center justify-between rounded-lg border border-border/30 p-3">
                      <div>
                        <div className="text-sm font-medium">{audit.dsrName}</div>
                        <div className="text-xs text-muted-foreground">{audit.audit_date}</div>
                      </div>
                      <Badge className={audit.status === 'ok' ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}>
                        {audit.status === 'ok' ? 'OK' : 'Issue'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">No recent DSR audits</div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Team Leader Stock Table */}
        <GlassCard className="hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Team Leader Stock Performance
            </h3>
            <Badge variant="outline">
              Sorted by Conversion Rate
            </Badge>
          </div>
          {tlStockData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 font-medium">Team Leader</th>
                    <th className="text-left py-3 px-4 font-medium">Assigned</th>
                    <th className="text-left py-3 px-4 font-medium">Sold</th>
                    <th className="text-left py-3 px-4 font-medium">In-hand</th>
                    <th className="text-left py-3 px-4 font-medium">Available</th>
                    <th className="text-left py-3 px-4 font-medium">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {tlStockData.map((tl, index) => {
                    const performanceColor = tl.conversion_rate >= 70 ? 'text-green-500' : 
                                            tl.conversion_rate >= 50 ? 'text-yellow-500' : 'text-red-500';
                    
                    return (
                      <tr key={index} className="border-b border-border/30 hover:bg-primary/5">
                        <td className="py-3 px-4 font-medium">{tl.name}</td>
                        <td className="py-3 px-4">{tl.total_assigned}</td>
                        <td className="py-3 px-4 text-green-500">{tl.total_sold}</td>
                        <td className="py-3 px-4 text-amber-500">{tl.in_hand}</td>
                        <td className="py-3 px-4 text-blue-500">{tl.available}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${performanceColor}`}>
                              {tl.conversion_rate.toFixed(1)}%
                            </span>
                            <Progress 
                              value={tl.conversion_rate} 
                              className="h-2 w-24" 
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No team leader stock data available
            </div>
          )}
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
          {/* Overall Stock Utilization */}
          <GlassCard className="hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" />
              Stock Distribution
            </h3>
            <div className="space-y-6">
              <div className="text-center py-2 md:py-4">
                <div className="text-2xl md:text-4xl font-bold">{stockUtilization}%</div>
                <p className="text-xs md:text-base text-muted-foreground mt-1 md:mt-2">of total inventory utilized</p>
                <div className="mt-6 space-y-4">
                  {[
                    { label: 'Total Stock', value: stats.totalStock, color: 'bg-gray-500', percentage: 100 },
                    { label: 'Available Stock', value: stats.availableStock, color: 'bg-green-500', 
                      percentage: stats.totalStock > 0 ? (stats.availableStock / stats.totalStock) * 100 : 0 },
                    { label: 'Assigned to TLs', value: stats.tlAssignedStock, color: 'bg-blue-500', 
                      percentage: stats.totalStock > 0 ? (stats.tlAssignedStock / stats.totalStock) * 100 : 0 },
                    { label: 'Sold from TL Stock', value: stats.tlSoldStock, color: 'bg-primary', 
                      percentage: stats.tlAssignedStock > 0 ? (stats.tlSoldStock / stats.tlAssignedStock) * 100 : 0 },
                  ].map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.value} units</span>
                          <span className="text-xs text-muted-foreground">
                            ({item.percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden" aria-hidden="true">
                        <Progress
                          value={item.percentage}
                          className={`h-2 ${item.color}/15 [&>[data-slot='progress-indicator']]:${item.color}`}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Performance Metrics */}
          <GlassCard className="hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Performance Insights
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-primary/5 rounded-lg">
                  <p className="text-xs text-muted-foreground">Conversion Rate</p>
                  <p className="text-xl font-bold">{tlStockUtilization}%</p>
                  <p className="text-xs text-muted-foreground mt-1">TL Stock Sold</p>
                </div>
                <div className="p-3 bg-secondary/5 rounded-lg">
                  <p className="text-xs text-muted-foreground">Daily Activity</p>
                  <p className="text-xl font-bold">{stats.soldToday}</p>
                  <p className="text-xs text-muted-foreground mt-1">Units Today</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Stock with TLs</span>
                  </div>
                  <span className="font-medium text-blue-600">{stats.tlInHandStock} units</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{salesDateTitle}</span>
                  </div>
                  <span className="font-medium text-green-600">{stats.soldThisMonth} units</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">Pending Units</span>
                  </div>
                  <span className="font-medium text-yellow-600">{stats.unpaidCount} units</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <PackageX className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Missing Packages</span>
                  </div>
                  <span className="font-medium text-red-600">{stats.noPackageCount} units</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </PublicLayout>
  );
}