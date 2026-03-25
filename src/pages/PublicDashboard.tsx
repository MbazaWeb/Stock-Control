import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import StatsCard from '@/components/ui/StatsCard';
import GlassCard from '@/components/ui/GlassCard';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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

export default function PublicDashboard() {
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
    recentActivity: 0,
  });

  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [tlStockData, setTlStockData] = useState<TLStockStatus[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh data every 2 minutes
    const interval = setInterval(fetchDashboardData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTLStockData = async () => {
    try {
      const { data: teamLeaders } = await supabase
        .from('team_leaders')
        .select('id, name')
        .order('name');

      if (!teamLeaders) return [];

      const tlStockStatus: TLStockStatus[] = [];

      const promises = teamLeaders.map(async (tl) => {
        // Count assigned stock to this TL
        const { count: assignedCount } = await supabase
          .from('inventory')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to_type', 'team_leader')
          .eq('assigned_to_id', tl.id);

        // Count sold stock by this TL
        const { count: soldCount } = await supabase
          .from('inventory')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to_type', 'team_leader')
          .eq('assigned_to_id', tl.id)
          .eq('status', 'sold');

        // Count available stock (assigned but not sold)
        const { count: inHandCount } = await supabase
          .from('inventory')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to_type', 'team_leader')
          .eq('assigned_to_id', tl.id)
          .eq('status', 'assigned');

        const total_assigned = assignedCount || 0;
        const total_sold = soldCount || 0;
        const in_hand = inHandCount || 0;
        const conversion_rate = total_assigned > 0 ? (total_sold / total_assigned) * 100 : 0;

        tlStockStatus.push({
          name: tl.name,
          total_assigned,
          total_sold,
          available: total_assigned - total_sold,
          in_hand,
          conversion_rate,
        });
      });

      await Promise.all(promises);
      
      // Sort by conversion rate (highest first)
      tlStockStatus.sort((a, b) => b.conversion_rate - a.conversion_rate);
      
      return tlStockStatus;
    } catch (error) {
      console.error('Error fetching TL stock data:', error);
      return [];
    }
  };

  const fetchRecentSales = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: recentSales } = await supabase
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
        .eq('sale_date', today)
        .order('created_at', { ascending: false })
        .limit(5);

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
    try {
      const now = new Date();
      const todayISO = now.toISOString().split('T')[0];
      const startOfMonthISO = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];

      // Fetch TL stock data first
      const tlStockData = await fetchTLStockData();
      const tlAssignedStock = tlStockData.reduce((sum, tl) => sum + tl.total_assigned, 0);
      const tlSoldStock = tlStockData.reduce((sum, tl) => sum + tl.total_sold, 0);
      const tlInHandStock = tlStockData.reduce((sum, tl) => sum + tl.in_hand, 0);

      setTlStockData(tlStockData);

      const [
        inventoryRes,
        availableRes,
        salesTodayRes,
        salesMonthRes,
        unpaidRes,
        noPackageRes,
        unassignedRes,
        tlRes,
        captainRes,
        dsrRes,
      ] = await Promise.all([
        supabase.from('inventory').select('id', { count: 'exact', head: true }),
        supabase
          .from('inventory')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'available')
          .is('assigned_to_id', null),

        supabase
          .from('sales_records')
          .select('id', { count: 'exact', head: true })
          .eq('sale_date', todayISO),

        supabase
          .from('sales_records')
          .select('id', { count: 'exact', head: true })
          .gte('sale_date', startOfMonthISO),

        supabase
          .from('sales_records')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'Unpaid'),

        supabase
          .from('sales_records')
          .select('id', { count: 'exact', head: true })
          .eq('package_status', 'No Package'),

        supabase
          .from('sales_records')
          .select('id', { count: 'exact', head: true })
          .is('team_leader_id', null)
          .is('captain_id', null)
          .is('dsr_id', null),

        supabase.from('team_leaders').select('id', { count: 'exact', head: true }),
        supabase.from('captains').select('id', { count: 'exact', head: true }),
        supabase.from('dsrs').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalStock: inventoryRes.count ?? 0,
        availableStock: availableRes.count ?? 0,
        soldToday: salesTodayRes.count ?? 0,
        soldThisMonth: salesMonthRes.count ?? 0,
        unpaidCount: unpaidRes.count ?? 0,
        noPackageCount: noPackageRes.count ?? 0,
        unassignedSold: unassignedRes.count ?? 0,
        teamLeaders: tlRes.count ?? 0,
        captains: captainRes.count ?? 0,
        dsrs: dsrRes.count ?? 0,
        tlAssignedStock,
        tlSoldStock,
        tlInHandStock,
        recentActivity: salesTodayRes.count ?? 0,
      });

      // Fetch recent sales
      await fetchRecentSales();

      // Generate 7-day trend data
      const trends: DailyTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split('T')[0];

        const { count } = await supabase
          .from('sales_records')
          .select('id', { count: 'exact', head: true })
          .eq('sale_date', iso);

        trends.push({
          date: d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          units: count ?? 0,
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        });
      }

      setDailyTrends(trends);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Stock Dashboard
              </span>
            </h1>
            <p className="text-muted-foreground">
              Real-time inventory and sales overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{currentDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Daily Avg Units</p>
                <p className="text-2xl font-bold mt-1">
                  {(dailyTrends.reduce((sum, day) => sum + day.units, 0) / 7).toFixed(1)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sales Today</p>
                <p className="text-2xl font-bold mt-1">{stats.soldToday}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stock Turnover</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.tlAssignedStock > 0 ? 
                    `${Math.round((stats.tlSoldStock / stats.tlAssignedStock) * 100)}%` : '0%'}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <BarChart3 className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Units</p>
                <p className="text-2xl font-bold mt-1">{stats.unpaidCount}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/10">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            title="Monthly Units" 
            value={stats.soldThisMonth.toString()} 
            subtitle="Units sold this month" 
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
            title="Unassigned Sales" 
            value={stats.unassignedSold.toString()} 
            subtitle="Need assignment" 
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

        {/* Charts and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Trend Chart */}
          <GlassCard className="lg:col-span-2 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                7-Day Sales Trend (Units)
              </h3>
              <div className="text-sm text-muted-foreground">
                Total: {dailyTrends.reduce((sum, day) => sum + day.units, 0)} units
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
                    labelFormatter={(label, items) => {
                      const item = items?.[0];
                      return item ? `${item.payload.date} (${label})` : label;
                    }}
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
                Recent Sales Today
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
                            <Badge variant="outline" className="text-xs">
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
                            variant={sale.payment_status === 'Paid' ? 'success' : 'warning'} 
                            className="text-xs mt-1"
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
                  <span className="text-sm">Total Sales Team</span>
                  <Badge variant="outline" className="bg-primary/20 text-primary">
                    {stats.teamLeaders + stats.captains + stats.dsrs}
                  </Badge>
                </div>
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

        {/* Stock Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overall Stock Utilization */}
          <GlassCard className="hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" />
              Stock Distribution
            </h3>
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="text-4xl font-bold">{stockUtilization}%</div>
                <p className="text-muted-foreground mt-2">of total inventory utilized</p>
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
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-out ${item.color}`}
                          style={{ width: `${item.percentage}%` }}
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
                    <span className="text-sm">Monthly Sales</span>
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