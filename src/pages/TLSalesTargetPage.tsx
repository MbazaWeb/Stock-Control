import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentMonthYear, getMonthName } from '@/lib/targetCalculations';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from 'recharts';

interface SalesTarget {
  id: string;
  team_leader_id: string;
  year: number;
  month: number;
  target_amount: number;
  created_at: string;
}

interface TargetWithPerformance extends SalesTarget {
  actual_sales: number;
  performance_percent: number;
  gap: number;
  daily_target: number;
  monthly_to_date: number;
  mtd_gap: number;
  mtd_sales: number;
  mtd_performance_percent: number;
}

export default function TLSalesTargetPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<TargetWithPerformance[]>([]);

  const currentMonth = getCurrentMonthYear();

  // Calculate days elapsed in current month
  const daysInMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }, []);

  const daysElapsed = useMemo(() => {
    const now = new Date();
    return now.getDate();
  }, []);

  // Fetch team leader data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get current user's team leader account
      const { data: tlData, error: tlError } = await supabase
        .from('team_leaders')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (tlError) throw tlError;

      const tlId = tlData.id;

      // Fetch sales targets for this team leader
      const { data: targetsData, error: targetsError } = await supabase
        .from('sales_targets')
        .select('*')
        .eq('team_leader_id', tlId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (targetsError) throw targetsError;

      // Fetch all sales for this team leader
      const { data: salesData, error: salesError } = await supabase
        .from('sales_records')
        .select('*')
        .eq('status', 'Paid')
        .neq('date_recorded', null);

      if (salesError) throw salesError;

      // Calculate performance metrics
      const targetsWithPerformance: TargetWithPerformance[] = (targetsData || []).map((target) => {
        // Count actual sales
        const actual_sales = (salesData || []).filter(
          (sale: any) => 
            new Date(sale.date_recorded).getFullYear() === target.year &&
            new Date(sale.date_recorded).getMonth() === target.month
        ).length;

        const performance_percent = target.target_amount > 0
          ? Math.round((actual_sales / target.target_amount) * 100)
          : 0;

        const gap = actual_sales - target.target_amount;

        // Calculate daily target
        const daily_target = Math.ceil(target.target_amount / daysInMonth);
        const monthly_to_date = daily_target * daysElapsed;

        // Calculate MTD metrics
        const isCurrentMonth = target.year === currentMonth.year && target.month === currentMonth.month;
        const today = new Date();
        const mtd_sales = isCurrentMonth
          ? (salesData || []).filter((sale: any) => {
              const saleDate = new Date(sale.date_recorded);
              return (
                saleDate.getFullYear() === target.year &&
                saleDate.getMonth() === target.month &&
                saleDate <= today
              );
            }).length
          : actual_sales;

        const mtd_performance_percent = monthly_to_date > 0
          ? Math.round((mtd_sales / monthly_to_date) * 100)
          : 0;

        const mtd_gap = mtd_sales - monthly_to_date;

        return {
          ...target,
          actual_sales,
          performance_percent,
          gap,
          daily_target,
          monthly_to_date,
          mtd_gap,
          mtd_sales,
          mtd_performance_percent,
        };
      });

      setTargets(targetsWithPerformance);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sales targets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, daysInMonth, daysElapsed, currentMonth, toast]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id, fetchData]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const currentMonthTargets = targets.filter(t => t.year === currentMonth.year && t.month === currentMonth.month);
    const totalMTDSales = currentMonthTargets.reduce((sum, t) => sum + t.mtd_sales, 0);
    const totalMTDTarget = currentMonthTargets.reduce((sum, t) => sum + t.monthly_to_date, 0);
    const totalMTDPerformance = totalMTDTarget > 0
      ? Math.round((totalMTDSales / totalMTDTarget) * 100)
      : 0;

    return {
      totalTargets: currentMonthTargets.length,
      totalTarget: currentMonthTargets.reduce((sum, t) => sum + t.target_amount, 0),
      totalActual: currentMonthTargets.reduce((sum, t) => sum + t.actual_sales, 0),
      totalMTD: currentMonthTargets.reduce((sum, t) => sum + t.monthly_to_date, 0),
      totalMTDSales,
      totalMTDPerformance,
    };
  }, [targets, currentMonth]);

  const getPerformanceBadgeClass = (percent: number) => {
    if (percent >= 100) return 'bg-green-500/20 text-green-700';
    if (percent >= 80 && percent < 100) return 'bg-yellow-500/20 text-yellow-700';
    if (percent >= 51 && percent < 80) return 'bg-orange-600/20 text-orange-700';
    return 'bg-red-500/20 text-red-700';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">My Sales Targets</h1>
          <p className="text-muted-foreground mt-1">Track your monthly targets and performance</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <GlassCard>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Total Targets</p>
              <p className="text-3xl font-bold">{summary.totalTargets}</p>
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

        {/* Targets Table */}
        <GlassCard>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
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
                  {targets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No targets available
                      </TableCell>
                    </TableRow>
                  ) : (
                    targets.map((target) => (
                      <TableRow key={target.id} className="border-border/30 hover:bg-primary/5">
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
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>

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
    </AdminLayout>
  );
}
