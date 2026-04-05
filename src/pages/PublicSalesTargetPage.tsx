import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentMonthYear, getMonthName } from '@/lib/targetCalculations';
import { Tables } from '@/integrations/supabase/types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Zone {
  id: string;
  name: string;
}

interface Region {
  id: string;
  name: string;
  zone_id: string | null;
}

interface TargetWithPerformance {
  id: string;
  name: string;
  year: number;
  month: number;
  target_amount: number;
  actual_sales: number;
  performance_percent: number;
  gap: number;
  daily_target: number;
  monthly_to_date: number;
  mtd_gap: number;
  mtd_sales: number;
  mtd_performance_percent: number;
  is_regional?: boolean;
}

export default function PublicSalesTargetPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  
  // Data state
  const [regionalTargets, setRegionalTargets] = useState<TargetWithPerformance[]>([]);
  const [teamLeaderTargets, setTeamLeaderTargets] = useState<TargetWithPerformance[]>([]);
  const [allTargets, setAllTargets] = useState<TargetWithPerformance[]>([]);

  const currentMonth = useMemo(() => getCurrentMonthYear(), []);

  const daysInMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }, []);

  const daysElapsed = useMemo(() => {
    const now = new Date();
    return now.getDate();
  }, []);

  // Load zones and regions
  useEffect(() => {
    const loadLocationData = async () => {
      try {
        const { data: zonesData, error: zonesError } = await supabase
          .from('zones')
          .select('*')
          .order('name');

        if (zonesError) throw zonesError;
        setZones(zonesData || []);

        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('*')
          .order('name');

        if (regionsError) throw regionsError;
        setRegions(regionsData || []);
      } catch (error) {
        console.error('Error loading location data:', error);
      }
    };

    loadLocationData();
  }, []);

  // Fetch targets and sales data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Starting fetch data...');
      
      // Fetch regional targets with region info
      console.log('Fetching tsm_targets...');
      const { data: tsmTargetsData, error: tsmError } = await supabase
        .from('tsm_targets')
        .select('id, region_id, year, month, target_amount, regions(name)')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (tsmError) {
        console.error('TSM Targets Error:', tsmError);
        throw new Error(`Failed to fetch tsm_targets: ${tsmError.message}`);
      }
      console.log('TSM Targets fetched:', tsmTargetsData?.length || 0, 'records');

      // Fetch team leader targets with team leader info
      console.log('Fetching sales_targets (team leader targets)...');
      const { data: tlTargetsData, error: tlError } = await supabase
        .from('sales_targets')
        .select(`
          id,
          team_leader_id,
          year,
          month,
          target_amount,
          team_leaders(name, region_id)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (tlError) {
        console.error('Sales Targets Error:', tlError);
        throw new Error(`Failed to fetch sales_targets: ${tlError.message}`);
      }
      console.log('Sales Targets fetched:', tlTargetsData?.length || 0, 'records');

      // Fetch all paid sales
      console.log('Fetching sales_records...');
      const { data: salesData, error: salesError } = await supabase
        .from('sales_records')
        .select('*')
        .eq('payment_status', 'Paid');

      if (salesError) {
        console.error('Sales Records Error:', salesError);
        throw new Error(`Failed to fetch sales_records: ${salesError.message}`);
      }
      console.log('Sales Records fetched:', salesData?.length || 0, 'records');

      console.log('All data fetched successfully. Processing...');

      // Calculate regional targets with performance
      const regionalWithPerf: TargetWithPerformance[] = (tsmTargetsData || []).map((target: { id: string; region_id: string; year: number; month: number; target_amount: number; regions?: { name: string } }) => {
        const actual_sales = (salesData || []).filter(
          (sale) =>
            sale.region_id === target.region_id &&
            new Date(sale.sale_date).getFullYear() === target.year &&
            new Date(sale.sale_date).getMonth() === target.month
        ).length;

        const performance_percent = target.target_amount > 0
          ? Math.round((actual_sales / target.target_amount) * 100)
          : 0;

        const daily_target = Math.ceil(target.target_amount / daysInMonth);
        const monthly_to_date = daily_target * daysElapsed;

        const isCurrentMonth = target.year === currentMonth.year && target.month === currentMonth.month;
        const today = new Date();
        const mtd_sales = isCurrentMonth
          ? (salesData || []).filter((sale) => {
              const saleDate = new Date(sale.sale_date);
              return (
                sale.region_id === target.region_id &&
                saleDate.getFullYear() === target.year &&
                saleDate.getMonth() === target.month &&
                saleDate <= today
              );
            }).length
          : actual_sales;

        const mtd_performance_percent = monthly_to_date > 0
          ? Math.round((mtd_sales / monthly_to_date) * 100)
          : 0;

        return {
          id: target.id,
          name: target.regions?.name || 'Unknown',
          year: target.year,
          month: target.month,
          target_amount: target.target_amount,
          actual_sales,
          performance_percent,
          gap: actual_sales - target.target_amount,
          daily_target,
          monthly_to_date,
          mtd_gap: mtd_sales - monthly_to_date,
          mtd_sales,
          mtd_performance_percent,
          is_regional: true,
        };
      });

      // Calculate team leader targets with performance
      const tlWithPerf: TargetWithPerformance[] = (tlTargetsData || []).map((target: { id: string; team_leader_id: string; year: number; month: number; target_amount: number; team_leaders?: { name: string; region_id: string | null } }) => {
        const actual_sales = (salesData || []).filter(
          (sale) =>
            sale.team_leader_id === target.team_leader_id &&
            new Date(sale.sale_date).getFullYear() === target.year &&
            new Date(sale.sale_date).getMonth() === target.month
        ).length;

        const performance_percent = target.target_amount > 0
          ? Math.round((actual_sales / target.target_amount) * 100)
          : 0;

        const daily_target = Math.ceil(target.target_amount / daysInMonth);
        const monthly_to_date = daily_target * daysElapsed;

        const isCurrentMonth = target.year === currentMonth.year && target.month === currentMonth.month;
        const today = new Date();
        const mtd_sales = isCurrentMonth
          ? (salesData || []).filter((sale) => {
              const saleDate = new Date(sale.sale_date);
              return (
                sale.team_leader_id === target.team_leader_id &&
                saleDate.getFullYear() === target.year &&
                saleDate.getMonth() === target.month &&
                saleDate <= today
              );
            }).length
          : actual_sales;

        const mtd_performance_percent = monthly_to_date > 0
          ? Math.round((mtd_sales / monthly_to_date) * 100)
          : 0;

        return {
          id: target.id,
          name: target.team_leaders?.name || 'Unknown',
          year: target.year,
          month: target.month,
          target_amount: target.target_amount,
          actual_sales,
          performance_percent,
          gap: actual_sales - target.target_amount,
          daily_target,
          monthly_to_date,
          mtd_gap: mtd_sales - monthly_to_date,
          mtd_sales,
          mtd_performance_percent,
          is_regional: false,
        };
      });

      setRegionalTargets(regionalWithPerf);
      setTeamLeaderTargets(tlWithPerf);
      setAllTargets([...regionalWithPerf, ...tlWithPerf]);
      console.log('Processing complete! Regional targets:', regionalWithPerf.length, 'Team leader targets:', tlWithPerf.length);
    } catch (error) {
      console.error('=== COMPLETE ERROR DETAILS ===');
      console.error('Error object:', error);
      console.error('Error type:', error?.constructor?.name);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      console.error('============================');
      toast({
        title: 'Error Loading Targets',
        description: error instanceof Error ? error.message : 'Failed to load targets. Check browser console for details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentMonth, daysInMonth, daysElapsed, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter regions by selected zone
  const filteredRegions = useMemo(() => {
    if (selectedZone === 'all') return regions;
    return regions.filter(r => r.zone_id === selectedZone);
  }, [regions, selectedZone]);

  // Filter targets based on selection
  const filteredTargets = useMemo(() => {
    let filtered = allTargets.filter(
      t => t.year === currentMonth.year && t.month === currentMonth.month
    );

    if (selectedRegion !== 'all') {
      filtered = filtered.filter(t => {
        if (t.is_regional) {
          const region = regions.find(r => r.name === t.name);
          return region?.id === selectedRegion;
        }
        return true;
      });
    } else if (selectedZone !== 'all') {
      const zoneRegionIds = filteredRegions.map(r => r.id);
      filtered = filtered.filter(t => {
        if (t.is_regional) {
          const region = regions.find(r => r.name === t.name);
          return zoneRegionIds.includes(region?.id || '');
        }
        return true;
      });
    }

    return filtered;
  }, [allTargets, selectedZone, selectedRegion, filteredRegions, regions, currentMonth]);

  // Calculate summary for filtered targets
  const summary = useMemo(() => {
    const totalMTDSales = filteredTargets.reduce((sum, t) => sum + t.mtd_sales, 0);
    const totalMTDTarget = filteredTargets.reduce((sum, t) => sum + t.monthly_to_date, 0);
    const totalMTDPerformance = totalMTDTarget > 0
      ? Math.round((totalMTDSales / totalMTDTarget) * 100)
      : 0;

    return {
      totalTargets: filteredTargets.filter(t => t.is_regional).length,
      totalTarget: filteredTargets.reduce((sum, t) => sum + t.target_amount, 0),
      totalActual: filteredTargets.reduce((sum, t) => sum + t.actual_sales, 0),
      totalMTD: totalMTDTarget,
      totalMTDSales,
      totalMTDPerformance,
    };
  }, [filteredTargets]);

  const getPerformanceBadgeClass = (percent: number) => {
    if (percent >= 100) return 'bg-green-500/20 text-green-700';
    if (percent >= 80 && percent < 100) return 'bg-yellow-500/20 text-yellow-700';
    if (percent >= 51 && percent < 80) return 'bg-orange-600/20 text-orange-700';
    return 'bg-red-500/20 text-red-700';
  };

  // Chart data for regional performance
  const regionPerformanceData = useMemo(() => {
    return filteredTargets
      .filter(t => t.is_regional)
      .sort((a, b) => b.performance_percent - a.performance_percent)
      .slice(0, 10)
      .map(target => ({
        name: target.name,
        performance: target.performance_percent,
        target: target.target_amount,
        actual: target.actual_sales,
      }));
  }, [filteredTargets]);

  // Chart data for weekly trend
  const weeklyChartData = useMemo(() => {
    const today = new Date();
    const last7Days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      const dailyActual = filteredTargets.reduce((sum, t) => sum + t.actual_sales, 0) / 7;
      const dailyTarget = filteredTargets.reduce((sum, t) => sum + t.daily_target, 0);

      last7Days.push({
        date: dateStr,
        target: Math.round(dailyTarget),
        actual: Math.round(dailyActual),
      });
    }

    return last7Days;
  }, [filteredTargets]);

  // Split targets by type
  const regionalOnly = filteredTargets.filter(t => t.is_regional);
  const teamLeadersOnly = filteredTargets.filter(t => !t.is_regional);

  return (
    <PublicLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Regional Sales Performance</h1>
          <p className="text-muted-foreground mt-1">Filter by zone and region to view targets and team leader performance</p>
        </div>

        {/* Filters */}
        <GlassCard>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="filter-zone">Filter by Zone</Label>
              <Select value={selectedZone} onValueChange={setSelectedZone}>
                <SelectTrigger className="glass-input mt-2" id="filter-zone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-region">Filter by Region</Label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="glass-input mt-2" id="filter-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {filteredRegions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedZone('all');
                  setSelectedRegion('all');
                }}
                className="w-full"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <GlassCard>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Total Regions</p>
              <p className="text-3xl font-bold">{regionalOnly.length}</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Total Target</p>
              <p className="text-3xl font-bold">{summary.totalTarget.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Monthly goal</p>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Actual Sales</p>
              <p className="text-3xl font-bold">{summary.totalActual.toLocaleString()}</p>
              <p className={`text-xs font-medium ${summary.totalActual >= summary.totalTarget ? 'text-green-600' : 'text-red-600'}`}>
                {summary.totalActual >= summary.totalTarget ? '+' : ''}{summary.totalActual - summary.totalTarget}
              </p>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">MTD Target</p>
              <p className="text-3xl font-bold">{summary.totalMTD.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Month to date</p>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">MTD Sales</p>
              <p className="text-3xl font-bold">{summary.totalMTDSales.toLocaleString()}</p>
              <p className={`text-xs font-medium ${summary.totalMTDSales >= summary.totalMTD ? 'text-green-600' : 'text-red-600'}`}>
                {summary.totalMTDSales >= summary.totalMTD ? '+' : ''}{summary.totalMTDSales - summary.totalMTD}
              </p>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">MTD Performance</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">{summary.totalMTDPerformance}%</p>
                {summary.totalMTDPerformance >= 100 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Of MTD target</p>
            </div>
          </GlassCard>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Regional Performance Chart */}
          {regionPerformanceData.length > 0 && (
            <GlassCard>
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Top Region Performance</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={regionPerformanceData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis type="number" stroke="rgba(148, 163, 184, 0.5)" />
                    <YAxis dataKey="name" type="category" width={140} stroke="rgba(148, 163, 184, 0.5)" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="performance" fill="#10b981" name="Performance %" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )}

          {/* Weekly Trend Chart */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Weekly Target vs Actual</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="date" stroke="rgba(148, 163, 184, 0.5)" />
                  <YAxis stroke="rgba(148, 163, 184, 0.5)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="target" stroke="#f97316" name="Daily Target" strokeWidth={2} />
                  <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Actual Sales" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Regional Targets Table */}
        {regionalOnly.length > 0 && (
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Regional Targets</h2>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>Region</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Actual Sales</TableHead>
                        <TableHead>Performance</TableHead>
                        <TableHead>Daily Target</TableHead>
                        <TableHead>MTD Target</TableHead>
                        <TableHead>MTD Sales</TableHead>
                        <TableHead>MTD Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regionalOnly.map((target) => (
                        <TableRow key={target.id} className="border-border/30 hover:bg-primary/5">
                          <TableCell className="font-medium">{target.name}</TableCell>
                          <TableCell>{getMonthName(target.month)} {target.year}</TableCell>
                          <TableCell className="font-semibold">{target.target_amount.toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">{target.actual_sales.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getPerformanceBadgeClass(target.performance_percent)}>
                              {target.performance_percent}%
                            </Badge>
                          </TableCell>
                          <TableCell>{target.daily_target.toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">{target.monthly_to_date.toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">{target.mtd_sales.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getPerformanceBadgeClass(target.mtd_performance_percent)}>
                              {target.mtd_performance_percent}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </GlassCard>
        )}

        {/* Team Leaders Targets Table */}
        {teamLeadersOnly.length > 0 && (
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Team Leader Targets</h2>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Actual Sales</TableHead>
                        <TableHead>Performance</TableHead>
                        <TableHead>Daily Target</TableHead>
                        <TableHead>MTD Target</TableHead>
                        <TableHead>MTD Sales</TableHead>
                        <TableHead>MTD Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamLeadersOnly.map((target) => (
                        <TableRow key={target.id} className="border-border/30 hover:bg-primary/5">
                          <TableCell className="font-medium">{target.name}</TableCell>
                          <TableCell>{getMonthName(target.month)} {target.year}</TableCell>
                          <TableCell className="font-semibold">{target.target_amount.toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">{target.actual_sales.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getPerformanceBadgeClass(target.performance_percent)}>
                              {target.performance_percent}%
                            </Badge>
                          </TableCell>
                          <TableCell>{target.daily_target.toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">{target.monthly_to_date.toLocaleString()}</TableCell>
                          <TableCell className="font-semibold">{target.mtd_sales.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getPerformanceBadgeClass(target.mtd_performance_percent)}>
                              {target.mtd_performance_percent}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </GlassCard>
        )}

        {/* Legend */}
        <GlassCard>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground mb-2">Performance %</p>
                <p className="text-xs">Monthly achievement: (Actual Sales / Target Amount) × 100</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground mb-2">Daily Target</p>
                <p className="text-xs">Prorated daily goal: Monthly Target ÷ Days in Month</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground mb-2">MTD Target</p>
                <p className="text-xs">Month-to-date goal: Daily Target × Days Elapsed</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground mb-2">MTD Performance %</p>
                <p className="text-xs">MTD achievement: (MTD Sales / MTD Target) × 100</p>
              </div>
            </div>

            <div className="border-t border-border/50 pt-4 mt-4">
              <p className="font-semibold text-muted-foreground mb-3">Performance Badge Colors</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-700">100%+</Badge>
                  <span className="text-xs text-muted-foreground">Exceeded target</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500/20 text-yellow-700">80-99%</Badge>
                  <span className="text-xs text-muted-foreground">On track</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-600/20 text-orange-700">51-79%</Badge>
                  <span className="text-xs text-muted-foreground">At risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-500/20 text-red-700">0-50%</Badge>
                  <span className="text-xs text-muted-foreground">Critical</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </PublicLayout>
  );
}
