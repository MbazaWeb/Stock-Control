import { useEffect, useState, useMemo, useCallback, type ElementType } from 'react';
import { 
  Package, 
  TrendingUp, 
  CreditCard, 
  PackageX, 
  Users,
  AlertTriangle,
  BarChart3,
  Smartphone,
  UserCheck,
  RefreshCw,
  Download,
  Bell,
  Clock,
  Calendar,
  FileText,
  Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/layout/AdminLayout';
import StatsCard from '@/components/ui/StatsCard';
import GlassCard from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import ExcelJS from 'exceljs';

interface DashboardStats {
  totalStock: number;
  availableStock: number;
  soldToday: number;
  soldThisMonth: number;
  unpaidCount: number;
  noPackageCount: number;
  unassignedSold: number;
  teamLeaders: number;
  captains: number;
  dsrs: number;
  tlAssignedStock: number;
  tlSoldStock: number;
  tlInHandStock: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  pendingUnpaidUnits: number;
  recentActivity: number;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  priority: number;
}

interface QuickStat {
  label: string;
  value: string;
  change: number;
  icon: ElementType;
  color: string;
}

interface WeeklyDataPoint {
  day: string;
  date: string;
  dateFull: string;
  units: number;
}

interface MonthlyDataPoint {
  month: string;
  year: number;
  units: number;
}

interface SaleRecord {
  id: string;
  smartcard_number: string;
  serial_number: string;
  sale_date: string;
  sale_time?: string;
  payment_status: string;
  package_status: string;
  customer_name: string | null;
  team_leader_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStock: 0,
    availableStock: 0,
    soldToday: 0,
    soldThisMonth: 0,
    unpaidCount: 0,
    noPackageCount: 0,
    unassignedSold: 0,
    teamLeaders: 0,
    captains: 0,
    dsrs: 0,
    tlAssignedStock: 0,
    tlSoldStock: 0,
    tlInHandStock: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
    pendingUnpaidUnits: 0,
    recentActivity: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyData, setWeeklyData] = useState<WeeklyDataPoint[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [topTLs, setTopTLs] = useState<Array<{name: string, sold: number, assigned: number, conversion: number}>>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week');
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [zones, setZones] = useState<Array<{id: string; name: string}>>([]);
  const [allRegions, setAllRegions] = useState<Array<{id: string; name: string; zone_id: string}>>([]);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

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

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneFilter, regionFilter]);

  const fetchTLStockData = async () => {
    try {
      let tlQuery = supabase.from('team_leaders').select('id, name, region_id, regions(name)');
      if (regionFilter !== 'all') {
        tlQuery = tlQuery.eq('region_id', regionFilter);
      } else if (zoneFilter !== 'all') {
        const zoneRegionIds = allRegions.filter(r => r.zone_id === zoneFilter).map(r => r.id);
        if (zoneRegionIds.length > 0) tlQuery = tlQuery.in('region_id', zoneRegionIds);
        else return { totalAssigned: 0, totalSold: 0, totalInHand: 0, topTLs: [] };
      }
      const { data: teamLeaders } = await tlQuery;

      if (!teamLeaders || teamLeaders.length === 0) {
        return { totalAssigned: 0, totalSold: 0, totalInHand: 0, topTLs: [] };
      }

      const tlIds = teamLeaders.map(tl => tl.id);

      // Batch: 2 queries instead of 2 per TL
      const [{ data: assignedItems }, { data: soldItems }] = await Promise.all([
        supabase.from('inventory').select('assigned_to_id').eq('assigned_to_type', 'team_leader').in('assigned_to_id', tlIds).eq('status', 'assigned'),
        supabase.from('inventory').select('assigned_to_id').eq('assigned_to_type', 'team_leader').in('assigned_to_id', tlIds).eq('status', 'sold'),
      ]);

      const assignedMap: Record<string, number> = {};
      const soldMap: Record<string, number> = {};
      (assignedItems || []).forEach(i => { assignedMap[i.assigned_to_id] = (assignedMap[i.assigned_to_id] || 0) + 1; });
      (soldItems || []).forEach(i => { soldMap[i.assigned_to_id] = (soldMap[i.assigned_to_id] || 0) + 1; });

      let totalAssigned = 0;
      let totalSold = 0;
      let totalInHand = 0;
      const tlPerformance = teamLeaders.map(tl => {
        const assigned = (assignedMap[tl.id] || 0) + (soldMap[tl.id] || 0);
        const sold = soldMap[tl.id] || 0;
        const inHand = assignedMap[tl.id] || 0;
        const conversion = assigned > 0 ? (sold / assigned) * 100 : 0;
        totalAssigned += assigned;
        totalSold += sold;
        totalInHand += inHand;
        return { name: tl.name, sold, assigned, inHand, conversion: parseFloat(conversion.toFixed(1)), region: (tl.regions as { name: string } | null)?.name || 'Unassigned' };
      });

      const sortedTLs = tlPerformance
        .sort((a, b) => b.conversion - a.conversion)
        .slice(0, 5)
        .map(tl => ({ name: tl.name, sold: tl.sold, assigned: tl.assigned, conversion: tl.conversion }));

      return { totalAssigned, totalSold, totalInHand, topTLs: sortedTLs };
    } catch (error) {
      console.error('Error fetching TL stock data:', error);
      return { totalAssigned: 0, totalSold: 0, totalInHand: 0, topTLs: [] };
    }
  };

  const fetchRecentAlerts = async () => {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { data: unpaidSales } = await supabase
        .from('sales_records')
        .select('*')
        .eq('payment_status', 'Unpaid')
        .lt('sale_date', threeDaysAgo.toISOString().split('T')[0])
        .order('sale_date', { ascending: false })
        .limit(5);

      const { data: lowStock } = await supabase
        .from('inventory')
        .select('count')
        .eq('status', 'available')
        .is('assigned_to_id', null);

      const stockCount = lowStock?.[0]?.count || 0;
      
      const alertsData: AlertItem[] = [];

      if (unpaidSales && unpaidSales.length > 0) {
        alertsData.push({
          id: 'unpaid-alert',
          type: 'warning',
          title: `${unpaidSales.length} Overdue Payments`,
          message: `Sales unpaid for more than 3 days`,
          timestamp: new Date().toISOString(),
          priority: 2
        });
      }

      if (stockCount < 20) {
        alertsData.push({
          id: 'low-stock-alert',
          type: 'error',
          title: 'Low Stock Alert',
          message: `Only ${stockCount} units available in inventory`,
          timestamp: new Date().toISOString(),
          priority: 1
        });
      }

      const { data: noPackage } = await supabase
        .from('sales_records')
        .select('count')
        .eq('package_status', 'No Package');

      if (noPackage?.[0]?.count > 5) {
        alertsData.push({
          id: 'package-alert',
          type: 'warning',
          title: `${noPackage[0].count} Missing Packages`,
          message: 'Multiple sales without proper packaging',
          timestamp: new Date().toISOString(),
          priority: 3
        });
      }

      setAlerts(alertsData.sort((a, b) => a.priority - b.priority).slice(0, 5));
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const fetchRecentSales = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('sales_records')
        .select(`
          id,
          smartcard_number,
          serial_number,
          sale_date,
          payment_status,
          package_status,
          customer_name,
          team_leader_id,
          captain_id,
          dsr_id,
          created_at
        `)
        .eq('sale_date', today)
        .order('created_at', { ascending: false })
        .limit(10);

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
  };

  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0];
      const startOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
        .toISOString().split('T')[0];

      const tlStockData = await fetchTLStockData();

      // Build filtered queries
      const invQ = () => {
        let q = supabase.from('inventory').select('id', { count: 'exact', head: true });
        if (zoneFilter !== 'all') q = q.eq('zone_id', zoneFilter);
        if (regionFilter !== 'all') q = q.eq('region_id', regionFilter);
        return q;
      };
      const salesQ = (useHead = true) => {
        let q = supabase.from('sales_records').select('id', { count: 'exact', head: useHead });
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
        salesMonthRes,
        salesLastMonthRes,
        unpaidRes,
        noPackageRes,
        unassignedRes,
        tlRes,
        captainRes,
        dsrRes,
      ] = await Promise.all([
        invQ(),
        invQ().eq('status', 'available').is('assigned_to_id', null),
        salesQ().eq('sale_date', today),
        salesQ(false).gte('sale_date', startOfMonth),
        salesQ().gte('sale_date', startOfLastMonth).lt('sale_date', startOfMonth),
        salesQ(false).eq('payment_status', 'Unpaid'),
        salesQ().eq('package_status', 'No Package'),
        salesQ().is('team_leader_id', null).is('captain_id', null).is('dsr_id', null),
        tlQ(),
        supabase.from('captains').select('id', { count: 'exact', head: true }),
        supabase.from('dsrs').select('id', { count: 'exact', head: true }),
      ]);

      // Calculate growth
      const monthlyGrowth = salesLastMonthRes.count ? 
        ((salesMonthRes.count - salesLastMonthRes.count) / salesLastMonthRes.count) * 100 : 0;

      const totalSalesWeek = await calculateWeeklySales();
      const weeklyGrowth = totalSalesWeek > 0 ? 
        ((salesTodayRes.count || 0) / totalSalesWeek * 100) : 0;

      setStats({
        totalStock: inventoryRes.count || 0,
        availableStock: availableRes.count || 0,
        soldToday: salesTodayRes.count || 0,
        soldThisMonth: salesMonthRes.count || 0,
        unpaidCount: unpaidRes.count || 0,
        noPackageCount: noPackageRes.count || 0,
        unassignedSold: unassignedRes.count || 0,
        teamLeaders: tlRes.count || 0,
        captains: captainRes.count || 0,
        dsrs: dsrRes.count || 0,
        tlAssignedStock: tlStockData.totalAssigned,
        tlSoldStock: tlStockData.totalSold,
        tlInHandStock: tlStockData.totalInHand,
        weeklyGrowth: parseFloat(weeklyGrowth.toFixed(1)),
        monthlyGrowth: parseFloat(monthlyGrowth.toFixed(1)),
        pendingUnpaidUnits: unpaidRes.count || 0,
        recentActivity: salesTodayRes.count || 0,
      });

      setTopTLs(tlStockData.topTLs);

      // Weekly data — single query instead of 7
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      const weekStartISO = weekStart.toISOString().split('T')[0];

      let weekQuery = supabase.from('sales_records').select('sale_date').gte('sale_date', weekStartISO).lte('sale_date', today);
      if (zoneFilter !== 'all') weekQuery = weekQuery.eq('zone_id', zoneFilter);
      if (regionFilter !== 'all') weekQuery = weekQuery.eq('region_id', regionFilter);
      const { data: weekSales } = await weekQuery;

      const weekCounts: Record<string, number> = {};
      (weekSales || []).forEach(r => { weekCounts[r.sale_date] = (weekCounts[r.sale_date] || 0) + 1; });

      const weekly: WeeklyDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        weekly.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          date: dateStr,
          dateFull: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          units: weekCounts[dateStr] || 0,
        });
      }
      setWeeklyData(weekly);

      // Monthly data — single query instead of 12
      const currentDate = new Date();
      const yearAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11, 1);
      const yearAgoISO = yearAgo.toISOString().split('T')[0];
      const endOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

      let monthAllQuery = supabase.from('sales_records').select('sale_date').gte('sale_date', yearAgoISO).lte('sale_date', endOfCurrentMonth);
      if (zoneFilter !== 'all') monthAllQuery = monthAllQuery.eq('zone_id', zoneFilter);
      if (regionFilter !== 'all') monthAllQuery = monthAllQuery.eq('region_id', regionFilter);
      const { data: monthSales } = await monthAllQuery;

      const monthCounts: Record<string, number> = {};
      (monthSales || []).forEach(r => {
        const key = r.sale_date.substring(0, 7); // YYYY-MM
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      });

      const monthly: MonthlyDataPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthly.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          year: date.getFullYear(),
          units: monthCounts[key] || 0,
        });
      }
      setMonthlyData(monthly);

      await fetchRecentAlerts();
      await fetchRecentSales();

      // Set quick stats (units only)
      setQuickStats([
        {
          label: 'Daily Avg Units',
          value: (weekly.reduce((sum, day) => sum + day.units, 0) / 7).toFixed(1),
          change: 12.5,
          icon: TrendingUp,
          color: 'text-green-500'
        },
        {
          label: 'Stock Turnover',
          value: (tlStockData.totalAssigned > 0 ? 
            (tlStockData.totalSold / tlStockData.totalAssigned * 100).toFixed(1) + '%' : '0%'),
          change: 8.2,
          icon: RefreshCw,
          color: 'text-blue-500'
        },
        {
          label: 'Active Sales Today',
          value: `${salesTodayRes.count || 0}`,
          change: 5.7,
          icon: Clock,
          color: 'text-purple-500'
        },
        {
          label: 'Pending Units',
          value: `${unpaidRes.count || 0}`,
          change: -3.1,
          icon: AlertTriangle,
          color: 'text-orange-500'
        }
      ]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateWeeklySales = async () => {
    try {
      const weeklySales = weeklyData.reduce((sum, day) => sum + day.units, 0);
      return weeklySales;
    } catch (error) {
      console.error('Error calculating weekly sales:', error);
      return 0;
    }
  };

  const handleExport = async () => {
    const exportData = {
      summary: {
        ...stats,
        timestamp: new Date().toISOString()
      },
      weeklyData,
      monthlyData,
      topPerformers: topTLs,
      recentSales,
      alerts
    };

    const workbook = new ExcelJS.Workbook();
    
    const ws = workbook.addWorksheet('Dashboard Summary');
    ws.columns = Object.keys(exportData.summary).map(key => ({ header: key, key }));
    ws.addRow(exportData.summary);
    
    const ws2 = workbook.addWorksheet('Weekly Data');
    if (weeklyData.length > 0) {
      ws2.columns = Object.keys(weeklyData[0]).map(key => ({ header: key, key }));
      ws2.addRows(weeklyData);
    }
    
    const ws3 = workbook.addWorksheet('Top Performers');
    if (topTLs.length > 0) {
      ws3.columns = Object.keys(topTLs[0]).map(key => ({ header: key, key }));
      ws3.addRows(topTLs);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate TL performance percentage
  const tlSoldPercentage = useMemo(() => {
    return stats.tlAssignedStock > 0 
      ? (stats.tlSoldStock / stats.tlAssignedStock) * 100 
      : 0;
  }, [stats.tlAssignedStock, stats.tlSoldStock]);

  // Determine TL performance variant based on percentage
  const getTLPerformanceVariant = useCallback(() => {
    if (tlSoldPercentage >= 70) return "success";
    if (tlSoldPercentage >= 50) return "gold";
    return "warning";
  }, [tlSoldPercentage]);

  const getAlertIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Bell className="h-4 w-4 text-blue-500" />;
      case 'success': return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  const chartData = timeRange === 'week' ? weeklyData : monthlyData;
  const chartXKey = timeRange === 'week' ? 'day' : 'month';

  return (
    <AdminLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Admin Dashboard
              </span>
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-0.5">
              Real-time insights and management overview
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              disabled={refreshing}
              className="glass-button"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="glass-button"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
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
          </div>
        </GlassCard>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          {quickStats.map((stat, index) => (
            <GlassCard key={index} className="!p-3 md:!p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] md:text-sm text-muted-foreground truncate">{stat.label}</p>
                  <p className="text-lg md:text-2xl font-bold mt-0.5 md:mt-1">{stat.value}</p>
                  <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                    <TrendingUp className={`h-3 w-3 ${stat.change >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                    <span className={`text-[10px] md:text-xs ${stat.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {stat.change >= 0 ? '+' : ''}{stat.change}%
                    </span>
                    <span className="text-[10px] md:text-xs text-muted-foreground ml-0.5 hidden sm:inline">vs last period</span>
                  </div>
                </div>
                <div className={`p-2 md:p-3 rounded-full ${stat.color.replace('text-', 'bg-')}/10 flex-shrink-0`}>
                  <stat.icon className={`h-4 w-4 md:h-6 md:w-6 ${stat.color}`} />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4">
          <StatsCard
            title="Total Inventory"
            value={stats.totalStock.toLocaleString()}
            subtitle={`${stats.availableStock} available units`}
            icon={Package}
            variant="blue"
            trend={{ value: stats.weeklyGrowth, isPositive: stats.weeklyGrowth >= 0 }}
          />
          <StatsCard
            title="TL Stock Performance"
            value={`${tlSoldPercentage.toFixed(1)}%`}
            subtitle={`${stats.tlSoldStock} sold of ${stats.tlAssignedStock} assigned`}
            icon={UserCheck}
            variant={getTLPerformanceVariant()}
            trend={{ value: stats.monthlyGrowth, isPositive: stats.monthlyGrowth >= 0 }}
          />
          <StatsCard
            title="Sales Today"
            value={stats.soldToday.toString()}
            subtitle={`${stats.recentActivity} units • ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
            icon={TrendingUp}
            variant="gold"
          />
          <StatsCard
            title="Pending Units"
            value={stats.pendingUnpaidUnits.toString()}
            subtitle={`${stats.unpaidCount} unpaid sales`}
            icon={CreditCard}
            variant="warning"
          />
          <StatsCard
            title="Monthly Units"
            value={stats.soldThisMonth.toString()}
            subtitle={`${stats.monthlyGrowth >= 0 ? '+' : ''}${stats.monthlyGrowth}% from last month`}
            icon={BarChart3}
            variant={stats.monthlyGrowth >= 0 ? "success" : "destructive"}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4">
          <StatsCard
            title="Team Leaders"
            value={stats.teamLeaders.toString()}
            subtitle={`${stats.captains} captains • ${stats.dsrs} DSRs`}
            icon={Users}
            variant="blue"
          />
          <StatsCard
            title="TL Stock"
            value={stats.tlAssignedStock.toString()}
            subtitle={`${stats.tlSoldStock} sold, ${stats.tlInHandStock} in hand`}
            icon={Smartphone}
            variant="blue"
          />
          <StatsCard
            title="Stock Issues"
            value={stats.noPackageCount.toString()}
            subtitle={`${stats.unassignedSold} unassigned sales`}
            icon={PackageX}
            variant="destructive"
          />
          <StatsCard
            title="Available Stock"
            value={stats.availableStock.toString()}
            subtitle="Ready for assignment"
            icon={Package}
            variant="success"
          />
          <StatsCard
            title="Active Alerts"
            value={alerts.length.toString()}
            subtitle="Requires attention"
            icon={Bell}
            variant={alerts.length > 0 ? "warning" : "default"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
          {/* Sales Chart - Units Only */}
          <GlassCard className="lg:col-span-2 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Sales Performance (Units)
              </h3>
              <div className="flex gap-2">
                <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as 'week' | 'month' | 'quarter')}>
                  <TabsList className="glass-input p-1">
                    <TabsTrigger value="week" className="text-xs px-3">Week</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs px-3">Month</TabsTrigger>
                    <TabsTrigger value="quarter" className="text-xs px-3">Quarter</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey={chartXKey} 
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
                    labelFormatter={(label) => {
                      if (timeRange === 'week') {
                        const dayData = (chartData as WeeklyDataPoint[]).find(d => d.day === label);
                        return dayData?.dateFull || label;
                      }
                      return label;
                    }}
                  />
                  <Legend />
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

          {/* Quick Actions & Recent Activity */}
          <div className="space-y-6">
            <GlassCard className="hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-secondary" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <a href="/admin/inventory" className="glass-button text-center p-2 md:p-4 hover:shadow-blue transition-all group">
                  <Package className="h-6 w-6 md:h-8 md:w-8 mx-auto text-primary mb-1 md:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-xs md:text-base">Add Stock</span>
                </a>
                <a href="/admin/assign-stock" className="glass-button text-center p-2 md:p-4 hover:shadow-gold transition-all group">
                  <Users className="h-6 w-6 md:h-8 md:w-8 mx-auto text-secondary mb-1 md:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-xs md:text-base">Assign Stock</span>
                </a>
                <a href="/admin/sales-team" className="glass-button text-center p-2 md:p-4 hover:shadow-blue transition-all group">
                  <Users className="h-6 w-6 md:h-8 md:w-8 mx-auto text-primary mb-1 md:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-xs md:text-base">Manage Team</span>
                </a>
                <a href="/admin/record-sales" className="glass-button text-center p-2 md:p-4 hover:shadow-gold transition-all group">
                  <BarChart3 className="h-6 w-6 md:h-8 md:w-8 mx-auto text-secondary mb-1 md:mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-xs md:text-base">View Sales</span>
                </a>
              </div>
            </GlassCard>

            {/* Recent Sales Activity */}
            <GlassCard className="hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Recent Sales Today
              </h3>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
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
                    No sales recorded today yet
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Top Team Leaders Performance */}
        {topTLs.length > 0 && (
          <GlassCard className="hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Performing Team Leaders
                <Badge variant="outline" className="ml-2">
                  By Conversion Rate
                </Badge>
              </h3>
              <div className="text-sm text-muted-foreground">
                Avg Conversion: {(topTLs.reduce((acc, tl) => acc + tl.conversion, 0) / topTLs.length).toFixed(1)}%
              </div>
            </div>
            <div className="space-y-4">
              {topTLs.map((tl, index) => {
                const performanceColor = tl.conversion >= 70 ? 'text-green-500' : 
                                        tl.conversion >= 50 ? 'text-yellow-500' : 'text-red-500';
                
                return (
                  <div key={index} className="space-y-2 group hover:bg-primary/5 p-2 rounded-lg transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <span className="text-sm font-medium">{index + 1}</span>
                        </div>
                        <div>
                          <span className="font-medium">{tl.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Assigned: {tl.assigned}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Sold: {tl.sold}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className={`text-sm font-medium ${performanceColor}`}>
                            {tl.conversion.toFixed(1)}% Rate
                          </span>
                          <div className="text-xs text-muted-foreground mt-1">
                            {((tl.sold / tl.assigned) * 100).toFixed(1)}% sold
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden" aria-hidden="true">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          tl.conversion >= 70 ? 'bg-green-600' : 
                          tl.conversion >= 50 ? 'bg-yellow-500' : 
                          'bg-red-500'
                        }`}
                        style={{ width: `${tl.conversion}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        )}

        {/* Stock Overview & Recent Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
          <GlassCard className="hover:shadow-lg transition-shadow">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" />
              Stock Distribution Analysis
            </h3>
            <div className="space-y-4">
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
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${item.color}`}
                      style={{ width: `${item.percentage}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Stock Health Indicator */}
            <div className="mt-6 p-4 bg-primary/5 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Stock Health</span>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  stats.availableStock < 20 ? 'bg-red-500/20 text-red-700' :
                  stats.availableStock < 50 ? 'bg-yellow-500/20 text-yellow-700' : 
                  'bg-green-500/20 text-green-700'
                }`}>
                  {stats.availableStock < 20 ? "Low" :
                   stats.availableStock < 50 ? "Moderate" : "Healthy"}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.availableStock < 20 
                  ? "Stock levels critical. Consider restocking immediately."
                  : stats.availableStock < 50
                  ? "Stock levels moderate. Monitor closely."
                  : "Stock levels are healthy."
                }
              </p>
            </div>
          </GlassCard>

          {/* Alerts Panel */}
          <GlassCard className="hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              Recent Alerts & Notifications
            </h3>
            <div className="space-y-4">
              {alerts.length > 0 ? (
                alerts.map((alert, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${
                      alert.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
                      alert.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                      alert.type === 'info' ? 'bg-blue-500/10 border-blue-500/30' :
                      'bg-green-500/10 border-green-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className="font-medium">{alert.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              alert.type === 'error' ? 'border-red-500/50 text-red-700' :
                              alert.type === 'warning' ? 'border-yellow-500/50 text-yellow-700' :
                              alert.type === 'info' ? 'border-blue-500/50 text-blue-700' :
                              'border-green-500/50 text-green-700'
                            }`}
                          >
                            {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Priority {alert.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="mb-2">
                    <Bell className="h-12 w-12 mx-auto text-gray-400" />
                  </div>
                  <p className="font-medium">All systems normal</p>
                  <p className="text-sm mt-1">No alerts at the moment</p>
                </div>
              )}
            </div>
            
            {/* Date & Time Display */}
            <div className="mt-6 p-4 bg-primary/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Current Date</span>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </AdminLayout>
  );
}