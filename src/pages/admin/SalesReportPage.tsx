import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Users,
  Package,
  Calendar,
  Smartphone,
  Download,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/skeleton';
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ExcelJS from 'exceljs';

interface RegionSales {
  name: string;
  sales: number;
  regionId?: string;
}

interface TLPerformance {
  id: string;
  name: string;
  assigned: number;
  sold: number;
  inHand: number;
  soldPercentage: number;
  regionId?: string;
}

interface InventoryTrend {
  date: string;
  available: number;
  sold: number;
  assigned: number;
}

interface StockTypeDist {
  name: string;
  value: number;
  percentage: number;
}

interface SalesRecord {
  id: string;
  sale_date: string;
  team_leader_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
  region_id: string | null;
  stock_type: string | null;
  regions?: { name: string; id: string };
  team_leaders?: { name: string; id: string; region_id?: string };
}

interface InventoryItem {
  id: string;
  status: string;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  stock_type: string | null;
  created_at: string;
  region_id?: string | null;
}

interface DashboardStats {
  totalSales: number;
  totalRegions: number;
  activeRegions: number;
  totalTLs: number;
  activeTLs: number;
  avgPerTL: number;
  totalAvailable: number;
  totalAssigned: number;
  totalSoldFromAssigned: number;
  totalInHand: number;
  conversionRate: number;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(142.1, 76.2%, 36.3%)',
  'hsl(47.9, 95.8%, 53.1%)',
  'hsl(280, 65%, 60%)',
  'hsl(200, 80%, 50%)',
  'hsl(350, 70%, 55%)',
  'hsl(30, 80%, 55%)',
];

export default function SalesReportPage() {
  const { isRegionalAdmin, assignedRegionIds } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');
  const [regionFilter, setRegionFilter] = useState('all');
  const [stockTypeFilter, setStockTypeFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  
  const [regionSales, setRegionSales] = useState<RegionSales[]>([]);
  const [tlPerformance, setTLPerformance] = useState<TLPerformance[]>([]);
  const [inventoryTrend, setInventoryTrend] = useState<InventoryTrend[]>([]);
  const [stockTypeDist, setStockTypeDist] = useState<StockTypeDist[]>([]);
  const [allRegions, setAllRegions] = useState<Array<{id: string, name: string}>>([]);
  const [allStockTypes, setAllStockTypes] = useState<string[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalRegions: 0,
    activeRegions: 0,
    totalTLs: 0,
    activeTLs: 0,
    avgPerTL: 0,
    totalAvailable: 0,
    totalAssigned: 0,
    totalSoldFromAssigned: 0,
    totalInHand: 0,
    conversionRate: 0,
  });

  // Memoized calculations
  const filteredRegionSales = useMemo(() => {
    if (regionFilter === 'all') return regionSales;
    return regionSales.filter(region => region.regionId === regionFilter);
  }, [regionSales, regionFilter]);

  const filteredTLPerformance = useMemo(() => {
    let filtered = tlPerformance;
    if (regionFilter !== 'all') {
      filtered = filtered.filter(tl => tl.regionId === regionFilter);
    }
    if (stockTypeFilter !== 'all') {
      // Filter TLs who have sales of this stock type
      // This would require additional data, but we'll implement filtering logic
    }
    return filtered;
  }, [tlPerformance, regionFilter, stockTypeFilter]);

  const filteredStockTypeDist = useMemo(() => {
    if (stockTypeFilter === 'all') return stockTypeDist;
    return stockTypeDist.filter(stock => stock.name === stockTypeFilter);
  }, [stockTypeDist, stockTypeFilter]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const getDateFilter = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { startDate: weekAgo.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: monthStart.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      case 'quarter':
        const quarterStart = new Date(now);
        quarterStart.setMonth(quarterStart.getMonth() - 3);
        return { startDate: quarterStart.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return { startDate: yearStart.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
      default:
        const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: defaultStart.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
    }
  }, [dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { startDate } = getDateFilter();

      // Build queries with region filtering for regional admins
      let salesQuery = supabase
        .from('sales_records')
        .select('*, regions:region_id(name, id), team_leaders:team_leader_id(name, id, region_id)')
        .gte('sale_date', startDate)
        .order('sale_date', { ascending: false });
      
      let inventoryQuery = supabase.from('inventory')
        .select('*, regions:region_id(name)')
        .or('status.eq.available,status.eq.assigned,status.eq.sold');

      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        salesQuery = salesQuery.in('region_id', assignedRegionIds);
        inventoryQuery = inventoryQuery.in('region_id', assignedRegionIds);
      }

      // Fetch all required data in parallel with improved queries
      const [
        salesRes,
        regionsRes,
        teamLeadersRes,
        inventoryRes,
      ] = await Promise.all([
        salesQuery,
        supabase.from('regions').select('*').order('name'),
        supabase.from('team_leaders').select('*, regions:region_id(name)').order('name'),
        inventoryQuery,
      ]);

      const sales = salesRes.data || [];
      const regions = regionsRes.data || [];
      let teamLeaders = teamLeadersRes.data || [];
      const allInventory = inventoryRes.data || [];

      // For regional admins, filter team leaders by assigned regions
      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        teamLeaders = teamLeaders.filter(tl => 
          tl.region_id && assignedRegionIds.includes(tl.region_id)
        );
      }

      // Set all regions for filter (filtered for regional admins)
      const accessibleRegions = isRegionalAdmin && assignedRegionIds.length > 0
        ? regions.filter(r => assignedRegionIds.includes(r.id))
        : regions;
      setAllRegions(accessibleRegions.map(r => ({ id: r.id, name: r.name })));

      // Extract unique stock types
      const stockTypes = [...new Set(allInventory
        .map((item: InventoryItem) => item.stock_type)
        .filter(Boolean))] as string[];
      setAllStockTypes(stockTypes);

      // Calculate comprehensive statistics
      const totalAssigned = allInventory.filter((item: InventoryItem) => 
        item.assigned_to_type === 'team_leader' && item.status !== 'sold'
      ).length;
      
      const totalSold = allInventory.filter((item: InventoryItem) => 
        item.status === 'sold'
      ).length;
      
      const totalAvailable = allInventory.filter((item: InventoryItem) => 
        item.status === 'available' && !item.assigned_to_id
      ).length;

      // Calculate sold from assigned stock
      const soldFromAssigned = allInventory.filter((item: InventoryItem) => 
        item.status === 'sold' && item.assigned_to_type === 'team_leader'
      ).length;

      const totalInHand = Math.max(0, totalAssigned - soldFromAssigned);
      
      // Calculate active TLs (TLs with sales in period)
      const tlIdsWithSales = [...new Set(sales.map((s: SalesRecord) => s.team_leader_id).filter(Boolean))];
      
      // Calculate active regions (regions with sales in period)
      const regionIdsWithSales = [...new Set(sales.map((s: SalesRecord) => s.region_id).filter(Boolean))];

      // Sales by Region with region IDs
      const regionMap: Record<string, { sales: number, id?: string }> = {};
      sales.forEach((sale: SalesRecord) => {
        const regionName = sale.regions?.name || 'Unassigned';
        const regionId = sale.regions?.id || 'unassigned';
        if (!regionMap[regionName]) {
          regionMap[regionName] = { sales: 0, id: regionId };
        }
        regionMap[regionName].sales += 1;
      });
      
      const regionData = Object.entries(regionMap)
        .map(([name, data]) => ({ 
          name, 
          sales: data.sales, 
          regionId: data.id 
        }))
        .sort((a, b) => b.sales - a.sales);
      setRegionSales(regionData);

      // Team Leader Performance - Optimized with single query
      const tlPerformancePromises = teamLeaders.map(async (tl) => {
        // Get assigned and sold counts in single query
        const { data: inventoryData } = await supabase
          .from('inventory')
          .select('status')
          .eq('assigned_to_type', 'team_leader')
          .eq('assigned_to_id', tl.id);

        const assigned = inventoryData?.filter(item => item.status === 'assigned').length || 0;
        const sold = inventoryData?.filter(item => item.status === 'sold').length || 0;
        const inHand = Math.max(0, assigned - sold);
        const soldPercentage = assigned > 0 ? (sold / assigned) * 100 : 0;

        return {
          id: tl.id,
          name: tl.name,
          assigned,
          sold,
          inHand,
          soldPercentage: parseFloat(soldPercentage.toFixed(1)),
          regionId: tl.region_id,
        };
      });

      const tlData = await Promise.all(tlPerformancePromises);
      const sortedTlData = tlData.sort((a, b) => b.soldPercentage - a.soldPercentage);
      setTLPerformance(sortedTlData);

      // Inventory Trend (last 14 days for better insights)
      const trendData: InventoryTrend[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Daily sales for this day
        const daySales = sales.filter((s: SalesRecord) => 
          s.sale_date.startsWith(dateStr)
        ).length;
        
        // Get inventory snapshot (more efficient calculation)
        const inventoryBeforeDate = allInventory.filter((item: InventoryItem) => 
          new Date(item.created_at) <= date
        );

        const available = inventoryBeforeDate.filter((item: InventoryItem) => 
          item.status === 'available' && !item.assigned_to_id
        ).length;
        
        const assigned = inventoryBeforeDate.filter((item: InventoryItem) => 
          item.assigned_to_type === 'team_leader' && item.status === 'assigned'
        ).length;

        trendData.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          available,
          sold: daySales,
          assigned,
        });
      }
      setInventoryTrend(trendData);

      // Stock Type Distribution with percentages
      const stockTypeMap: Record<string, number> = {};
      allInventory.forEach((item: InventoryItem) => {
        const type = item.stock_type || 'Unknown';
        stockTypeMap[type] = (stockTypeMap[type] || 0) + 1;
      });
      
      const totalItems = allInventory.length;
      const stockTypeData = Object.entries(stockTypeMap)
        .map(([name, value]) => ({
          name,
          value,
          percentage: totalItems > 0 ? (value / totalItems) * 100 : 0
        }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
      setStockTypeDist(stockTypeData);

      // Calculate conversion rate
      const conversionRate = totalAssigned > 0 
        ? (soldFromAssigned / totalAssigned) * 100 
        : 0;

      // Set comprehensive stats
      setStats({
        totalSales: sales.length,
        totalRegions: regions.length,
        activeRegions: regionIdsWithSales.length,
        totalTLs: teamLeaders.length,
        activeTLs: tlIdsWithSales.length,
        avgPerTL: teamLeaders.length > 0 ? Math.round(sales.length / teamLeaders.length) : 0,
        totalAvailable,
        totalAssigned,
        totalSoldFromAssigned: soldFromAssigned,
        totalInHand,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      
      // Region Sales sheet
      const regionWS = workbook.addWorksheet('Region Sales');
      const regionData = filteredRegionSales.map(rs => ({
        Region: rs.name,
        Sales: rs.sales,
        'Sales Percentage': stats.totalSales > 0 ? 
          ((rs.sales / stats.totalSales) * 100).toFixed(1) + '%' : '0%'
      }));
      if (regionData.length > 0) {
        regionWS.columns = Object.keys(regionData[0]).map(key => ({ header: key, key }));
        regionWS.addRows(regionData);
      }
      
      // TL Performance sheet
      const tlWS = workbook.addWorksheet('TL Performance');
      const tlData = filteredTLPerformance.map(tl => ({
        'Team Leader': tl.name,
        Assigned: tl.assigned,
        Sold: tl.sold,
        'In Hand': tl.inHand,
        'Sold Rate': tl.soldPercentage.toFixed(1) + '%',
        Performance: tl.soldPercentage >= 75 ? 'Excellent' : 
                    tl.soldPercentage >= 50 ? 'Good' : 
                    'Needs Improvement'
      }));
      if (tlData.length > 0) {
        tlWS.columns = Object.keys(tlData[0]).map(key => ({ header: key, key }));
        tlWS.addRows(tlData);
      }
      
      // Stock Distribution sheet
      const stockWS = workbook.addWorksheet('Stock Distribution');
      const stockData = filteredStockTypeDist.map(st => ({
        'Stock Type': st.name,
        Count: st.value,
        Percentage: st.percentage.toFixed(1) + '%'
      }));
      if (stockData.length > 0) {
        stockWS.columns = Object.keys(stockData[0]).map(key => ({ header: key, key }));
        stockWS.addRows(stockData);
      }
      
      // Summary sheet
      const summaryWS = workbook.addWorksheet('Summary');
      const summaryData = [{
        'Date Range': dateRange.charAt(0).toUpperCase() + dateRange.slice(1),
        'Total Sales': stats.totalSales,
        'Active Regions': stats.activeRegions,
        'Active Team Leaders': stats.activeTLs,
        'Conversion Rate': stats.conversionRate + '%',
        'Available Stock': stats.totalAvailable,
        'Assigned Stock': stats.totalAssigned,
        'Sold from Assigned': stats.totalSoldFromAssigned,
        'Stock in Hand': stats.totalInHand
      }];
      summaryWS.columns = Object.keys(summaryData[0]).map(key => ({ header: key, key }));
      summaryWS.addRows(summaryData);
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Sales_Report_${dateRange}_${timestamp}.xlsx`;
      
      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting data:', error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Calculate performance metrics
  const overallSoldPercentage = stats.totalAssigned > 0 
    ? (stats.totalSoldFromAssigned / stats.totalAssigned) * 100 
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Sales Analytics Dashboard
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Real-time analytics and performance insights</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px] glass-input">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">Last 3 Months</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={fetchReportData}
              className="glass-button"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              className="glass-button"
              disabled={exporting}
            >
              <Download className={`w-4 h-4 mr-2 ${exporting ? 'animate-spin' : ''}`} />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <GlassCard>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[180px] glass-input">
                <MapPin className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {allRegions.map(region => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockTypeFilter} onValueChange={setStockTypeFilter}>
              <SelectTrigger className="w-[180px] glass-input">
                <Package className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Stock Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Types</SelectItem>
                {allStockTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="text-center hover:shadow-lg transition-shadow">
            <Package className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{stats.totalAvailable}</p>
            <p className="text-xs text-muted-foreground">Available Stock</p>
            <Badge variant="outline" className="mt-2 text-xs">
              {stats.totalAssigned > 0 
                ? `${((stats.totalAvailable / (stats.totalAvailable + stats.totalAssigned)) * 100).toFixed(0)}% of total`
                : '100% of total'}
            </Badge>
          </GlassCard>
          <GlassCard className="text-center hover:shadow-lg transition-shadow">
            <Users className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{stats.totalAssigned}</p>
            <p className="text-xs text-muted-foreground">Assigned to TLs</p>
            <Badge variant="outline" className="mt-2 text-xs">
              {stats.activeTLs} active TLs
            </Badge>
          </GlassCard>
          <GlassCard className="text-center hover:shadow-lg transition-shadow">
            <TrendingUp className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.totalSoldFromAssigned}</p>
            <p className="text-xs text-muted-foreground">Sold from Assigned</p>
            <Badge variant="outline" className="mt-2 text-xs bg-primary/10 text-primary">
              {stats.conversionRate}% conversion
            </Badge>
          </GlassCard>
          <GlassCard className="text-center hover:shadow-lg transition-shadow">
            <Smartphone className="h-6 w-6 mx-auto text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{stats.totalInHand}</p>
            <p className="text-xs text-muted-foreground">In Hand with TLs</p>
            <Badge variant="outline" className="mt-2 text-xs">
              {stats.totalAssigned > 0 
                ? `${((stats.totalInHand / stats.totalAssigned) * 100).toFixed(0)}% of assigned`
                : '0%'}
            </Badge>
          </GlassCard>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <GlassCard className="text-center hover:shadow-lg transition-shadow">
            <BarChart3 className="h-6 w-6 mx-auto text-orange-500 mb-2" />
            <p className="text-2xl font-bold">{stats.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Overall Conversion Rate</p>
            <div className="mt-2 w-full bg-muted rounded-full h-2" aria-hidden="true">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-all"
                style={{ width: `${Math.min(stats.conversionRate, 100)}%` }}
                aria-hidden="true"
              />
            </div>
          </GlassCard>
          <GlassCard className="text-center hover:shadow-lg transition-shadow">
            <TrendingUp className="h-6 w-6 mx-auto text-secondary mb-2" />
            <p className="text-2xl font-bold">{stats.totalSales}</p>
            <p className="text-xs text-muted-foreground">Total Sales ({dateRange})</p>
            <Badge variant="outline" className="mt-2 text-xs">
              {stats.activeRegions} active regions
            </Badge>
          </GlassCard>
          <GlassCard className="text-center hover:shadow-lg transition-shadow">
            <Users className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.avgPerTL}</p>
            <p className="text-xs text-muted-foreground">Avg Sales per TL</p>
            <Badge variant="outline" className="mt-2 text-xs">
              {stats.activeTLs}/{stats.totalTLs} TLs active
            </Badge>
          </GlassCard>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Region */}
          <GlassCard className="hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Top Regions by Sales
              </h3>
              <Badge variant="outline">
                {filteredRegionSales.length} regions
              </Badge>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredRegionSales.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    formatter={(value) => [`${value} sales`, 'Count']}
                    labelFormatter={(label) => `Region: ${label}`}
                  />
                  <Bar 
                    dataKey="sales" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 8, 8, 0]}
                    name="Sales Count"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {filteredRegionSales.length > 8 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing top 8 of {filteredRegionSales.length} regions
              </p>
            )}
          </GlassCard>

          {/* Stock Type Distribution */}
          <GlassCard className="hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-secondary" />
                Stock Type Distribution
              </h3>
              <Badge variant="outline">
                {filteredStockTypeDist.length} types
              </Badge>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredStockTypeDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percentage }) => `${name} (${percentage.toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {filteredStockTypeDist.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS[index % CHART_COLORS.length]} 
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    formatter={(value, name, props) => {
                      const percentage = props.payload.percentage;
                      return [
                        `${value} units (${percentage.toFixed(1)}%)`,
                        'Stock Type'
                      ];
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry) => (
                      <span className="text-xs">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Leader Performance */}
          <GlassCard className="hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Leader Stock Performance
              </h3>
              <Badge variant="outline">
                Top {Math.min(8, filteredTLPerformance.length)} TLs
              </Badge>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredTLPerformance.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10} 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                    interval={0}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        'assigned': 'Assigned Stock',
                        'sold': 'Sold Stock',
                        'inHand': 'In Hand'
                      };
                      return [`${value} units`, labels[name] || name];
                    }}
                    labelFormatter={(label) => `TL: ${label}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="assigned" 
                    name="Assigned Stock" 
                    fill="hsl(200, 80%, 50%)" 
                    radius={[4, 4, 0, 0]}
                    stackId="a"
                  />
                  <Bar 
                    dataKey="sold" 
                    name="Sold Stock" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    stackId="a"
                  />
                  <Bar 
                    dataKey="inHand" 
                    name="In Hand" 
                    fill="hsl(142.1, 76.2%, 36.3%)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Sales Trend */}
          <GlassCard className="hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-secondary" />
                14-Day Sales & Stock Trend
              </h3>
              <Badge variant="outline">
                Daily tracking
              </Badge>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={inventoryTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        'sold': 'Daily Sales',
                        'available': 'Available Stock',
                        'assigned': 'Assigned Stock'
                      };
                      return [`${value} units`, labels[name] || name];
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sold" 
                    name="Daily Sales" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3} 
                    dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="assigned" 
                    name="Assigned Stock" 
                    stroke="hsl(200, 80%, 50%)" 
                    strokeWidth={2} 
                    dot={{ fill: 'hsl(200, 80%, 50%)', r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="available" 
                    name="Available Stock" 
                    stroke="hsl(142.1, 76.2%, 36.3%)" 
                    strokeWidth={2} 
                    dot={{ fill: 'hsl(142.1, 76.2%, 36.3%)', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* TL Stock Details Table */}
        <GlassCard className="hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Leader Performance Details
              </h3>
              <Badge variant="outline">
                {filteredTLPerformance.length} team leaders
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Sorted by conversion rate
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Team Leader</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Assigned Stock</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Sold Stock</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">In Hand</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Sold Rate</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Performance</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTLPerformance.map((tl, idx) => {
                  const performanceColor = tl.soldPercentage >= 75 ? 'text-green-600' : 
                                          tl.soldPercentage >= 50 ? 'text-yellow-600' : 'text-red-600';
                  const performanceLevel = tl.soldPercentage >= 75 ? 'Excellent' : 
                                          tl.soldPercentage >= 50 ? 'Good' : 'Needs Attention';
                  const performanceBg = tl.soldPercentage >= 75 ? 'bg-green-500/10' : 
                                      tl.soldPercentage >= 50 ? 'bg-yellow-500/10' : 'bg-red-500/10';
                  
                  return (
                    <tr key={tl.id} className="border-b border-border/30 hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">{idx + 1}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">{tl.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 text-sm font-medium">
                          {tl.assigned}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                          {tl.sold}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-sm font-medium">
                          {tl.inHand}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-sm font-medium ${performanceColor}`}>
                          {tl.soldPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden" aria-hidden="true">
                          <div
                            className={`h-full rounded-full transition-all ${
                              tl.soldPercentage >= 75 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                              tl.soldPercentage >= 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                              'bg-gradient-to-r from-red-500 to-pink-500'
                            }`}
                            style={{ width: `${Math.min(tl.soldPercentage, 100)}%` }}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground mt-1 block">
                          {performanceLevel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={`${performanceBg} border-0`}>
                          {tl.assigned > 0 ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {filteredTLPerformance.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No team leaders found for selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredTLPerformance.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Avg Sold Rate</p>
                  <p className="text-lg font-bold">
                    {filteredTLPerformance.length > 0 
                      ? (filteredTLPerformance.reduce((acc, tl) => acc + tl.soldPercentage, 0) / filteredTLPerformance.length).toFixed(1)
                      : '0'}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total Assigned</p>
                  <p className="text-lg font-bold">
                    {filteredTLPerformance.reduce((acc, tl) => acc + tl.assigned, 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total Sold</p>
                  <p className="text-lg font-bold">
                    {filteredTLPerformance.reduce((acc, tl) => acc + tl.sold, 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total in Hand</p>
                  <p className="text-lg font-bold">
                    {filteredTLPerformance.reduce((acc, tl) => acc + tl.inHand, 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </AdminLayout>
  );
}