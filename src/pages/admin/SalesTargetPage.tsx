import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import styles from './SalesTargetPage.module.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentMonthYear, getMonthName } from '@/lib/targetCalculations';
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
  ComposedChart,
} from 'recharts';

interface TeamLeader {
  id: string;
  name: string;
}

interface SalesTarget {
  id: string;
  team_leader_id: string;
  team_leader_name: string;
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

export default function SalesTargetPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<TargetWithPerformance[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SalesTarget | null>(null);
  const [formData, setFormData] = useState({
    team_leader_id: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    target_amount: '',
  });
  const [filterTeamLeader, setFilterTeamLeader] = useState('all');
  const [filterPerformance, setFilterPerformance] = useState<'all' | 'best' | 'lower'>('all');

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

  // Fetch performance data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch team leaders
      const { data: tlData, error: tlError } = await supabase
        .from('team_leaders')
        .select('id, name')
        .order('name');

      if (tlError) throw tlError;
      setTeamLeaders(tlData || []);

      // Fetch sales targets with joined TL names
      const { data: targetsData, error: targetsError } = await supabase
        .from('sales_targets')
        .select(`
          id,
          team_leader_id,
          year,
          month,
          target_amount,
          created_at,
          team_leaders(name)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (targetsError) throw targetsError;

      interface TargetWithTL {
        id: string;
        team_leader_id: string;
        year: number;
        month: number;
        target_amount: number;
        created_at: string;
        team_leaders: { name: string } | null;
      }

      // Fetch sales records for current and previous year to calculate performance
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const twoYearsAgoISO = twoYearsAgo.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const { data: salesData, error: salesError } = await supabase
        .from('sales_records')
        .select('team_leader_id, sale_date')
        .eq('payment_status', 'Paid')
        .eq('package_status', 'Packaged')
        .not('dsr_id', 'is', null)
        .gte('sale_date', twoYearsAgoISO)
        .lte('sale_date', today);

      if (salesError) throw salesError;

      // Calculate performance for each target
      const formattedTargets = (targetsData as TargetWithTL[] || []).map((target) => {
        const targetDate = new Date(target.year, target.month);
        
        // Count total sales for this TL in this month
        const all_sales = (salesData || []).filter((sale) => {
          const saleDate = new Date(sale.sale_date);
          return (
            sale.team_leader_id === target.team_leader_id &&
            saleDate.getFullYear() === target.year &&
            saleDate.getMonth() === target.month
          );
        }).length;

        // Count MTD sales (up to today) for current month, or all sales for past months
        const isCurrentMonth = target.year === currentMonth.year && target.month === currentMonth.month;
        const today = new Date();
        const mtd_sales = isCurrentMonth
          ? (salesData || []).filter((sale) => {
              const saleDate = new Date(sale.sale_date);
              return (
                sale.team_leader_id === target.team_leader_id &&
                saleDate.getFullYear() === target.year &&
                saleDate.getMonth() === target.month &&
                saleDate.getDate() <= today.getDate()
              );
            }).length
          : all_sales;

        // Calculate performance metrics
        const performance_percent = target.target_amount > 0 
          ? Math.round((all_sales / target.target_amount) * 100)
          : 0;
        const gap = target.target_amount - all_sales;
        const daily_target = Math.ceil(target.target_amount / daysInMonth);
        const monthly_to_date = daily_target * daysElapsed;
        const mtd_gap = monthly_to_date - mtd_sales;
        const mtd_performance_percent = monthly_to_date > 0
          ? Math.round((mtd_sales / monthly_to_date) * 100)
          : 0;

        return {
          id: target.id,
          team_leader_id: target.team_leader_id,
          team_leader_name: target.team_leaders?.name || 'Unknown',
          year: target.year,
          month: target.month,
          target_amount: target.target_amount,
          created_at: target.created_at,
          actual_sales: all_sales,
          performance_percent,
          gap,
          daily_target,
          monthly_to_date,
          mtd_gap,
          mtd_sales,
          mtd_performance_percent,
        };
      });

      setTargets(formattedTargets);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load targets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, daysElapsed, daysInMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      avgPerformance: currentMonthTargets.length > 0
        ? Math.round(currentMonthTargets.reduce((sum, t) => sum + t.performance_percent, 0) / currentMonthTargets.length)
        : 0,
    };
  }, [targets, currentMonth]);

  // Apply filters to targets
  const filteredTargets = useMemo(() => {
    let filtered = [...targets];

    // Filter by team leader
    if (filterTeamLeader !== 'all') {
      filtered = filtered.filter(t => t.team_leader_id === filterTeamLeader);
    }

    // Filter by performance
    if (filterPerformance === 'best') {
      filtered = filtered.sort((a, b) => b.performance_percent - a.performance_percent);
    } else if (filterPerformance === 'lower') {
      filtered = filtered.sort((a, b) => a.performance_percent - b.performance_percent);
    }

    return filtered;
  }, [targets, filterTeamLeader, filterPerformance]);

  const handleOpenDialog = (target?: SalesTarget) => {
    if (target) {
      setEditingTarget(target);
      setFormData({
        team_leader_id: target.team_leader_id,
        year: target.year,
        month: target.month,
        target_amount: target.target_amount.toString(),
      });
    } else {
      setEditingTarget(null);
      setFormData({
        team_leader_id: '',
        year: currentMonth.year,
        month: currentMonth.month,
        target_amount: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTarget(null);
    setFormData({
      team_leader_id: '',
      year: currentMonth.year,
      month: currentMonth.month,
      target_amount: '',
    });
  };

  const handleSubmit = async () => {
    if (!formData.team_leader_id || !formData.target_amount) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const targetData = {
        team_leader_id: formData.team_leader_id,
        year: formData.year,
        month: formData.month,
        target_amount: parseInt(formData.target_amount),
      };

      if (editingTarget) {
        const { error } = await supabase
          .from('sales_targets')
          .update(targetData)
          .eq('id', editingTarget.id);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Target updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('sales_targets')
          .insert([targetData]);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Target created successfully',
        });
      }

      // Distribute target to captains
      await distributeToCaptains(formData.team_leader_id, formData.year, formData.month, parseInt(formData.target_amount));

      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving target:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save target',
        variant: 'destructive',
      });
    }
  };

  // Distribute TL target to captains equally
  const distributeToCaptains = async (tlId: string, year: number, month: number, targetAmount: number) => {
    try {
      // Get captains under this team leader
      const { data: captains, error: captainError } = await supabase
        .from('captains')
        .select('id')
        .eq('team_leader_id', tlId);

      if (captainError) throw captainError;
      if (!captains || captains.length === 0) return;

      // Calculate per-captain target (divide equally)
      const perCaptainTarget = Math.floor(targetAmount / captains.length);

      // Create or update captain targets
      const captainTargets = captains.map(captain => ({
        captain_id: captain.id,
        team_leader_id: tlId,
        year,
        month,
        target_amount: perCaptainTarget,
      }));

      // Upsert captain targets
      for (const captainTarget of captainTargets) {
        const { error: upsertError } = await supabase
          .from('captain_targets')
          .upsert(captainTarget, {
            onConflict: 'captain_id,year,month',
          });

        if (upsertError) throw upsertError;
      }
    } catch (error) {
      console.error('Error distributing targets to captains:', error);
      // Don't fail the main save if captain distribution fails
    }
  };

  const handleDelete = async (target: TargetWithPerformance) => {
    if (!confirm(`Delete target for ${target.team_leader_name} (${getMonthName(target.month)} ${target.year})?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sales_targets')
        .delete()
        .eq('id', target.id);

      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Target deleted successfully',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting target:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete target',
        variant: 'destructive',
      });
    }
  };

  const getPerformanceBadgeClass = (percent: number) => {
    if (percent >= 100) return 'bg-green-500/20 text-green-700';
    if (percent >= 80 && percent < 100) return 'bg-yellow-500/20 text-yellow-700';
    if (percent >= 51 && percent < 80) return 'bg-orange-600/20 text-orange-700';
    return 'bg-red-500/20 text-red-700';
  };

  // Calculate weekly daily target vs actual data
  const weeklyChartData = useMemo(() => {
    const today = new Date();
    const last7Days: any[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // For current month targets
      const currentMonthTargets = targets.filter(t => t.year === currentMonth.year && t.month === currentMonth.month);
      const dailyTarget = currentMonthTargets.length > 0
        ? Math.round((currentMonthTargets.reduce((sum, t) => sum + t.daily_target, 0)) / 30)
        : 0;

      // Random actual sales for demo (in real scenario, this would be fetched from sales data)
      const actualSales = Math.floor(Math.random() * (dailyTarget * 1.2));

      last7Days.push({
        date: dateStr,
        target: dailyTarget,
        actual: actualSales,
      });
    }

    return last7Days;
  }, [targets, currentMonth]);

  // Calculate TL Performance monthly data
  const tlPerformanceData = useMemo(() => {
    const currentMonthTargets = targets.filter(t => t.year === currentMonth.year && t.month === currentMonth.month);
    
    return currentMonthTargets
      .sort((a, b) => b.performance_percent - a.performance_percent)
      .slice(0, 10)
      .map(target => ({
        name: target.team_leader_name,
        performance: target.performance_percent,
        target: target.target_amount,
        actual: target.actual_sales,
      }));
  }, [targets, currentMonth]);

  // Calculate end-of-month prediction
  const endOfMonthPrediction = useMemo(() => {
    const currentMonthTargets = targets.filter(t => t.year === currentMonth.year && t.month === currentMonth.month);
    
    if (currentMonthTargets.length === 0) {
      return {
        currentRun: 0,
        onTrackPrediction: 0,
        optimisticPrediction: 0,
        pessimisticPrediction: 0,
        target: 0,
      };
    }

    const totalTarget = currentMonthTargets.reduce((sum, t) => sum + t.target_amount, 0);
    const totalMTDSales = currentMonthTargets.reduce((sum, t) => sum + t.mtd_sales, 0);

    // Running rate: sales per day so far
    const runningRate = daysElapsed > 0 ? totalMTDSales / daysElapsed : 0;
    
    // Predictions for end of month
    const onTrackPrediction = Math.round(runningRate * daysInMonth);
    const optimisticPrediction = Math.round(onTrackPrediction * 1.15); // 15% better
    const pessimisticPrediction = Math.round(onTrackPrediction * 0.85); // 15% worse

    return {
      currentRun: totalMTDSales,
      onTrackPrediction,
      optimisticPrediction,
      pessimisticPrediction,
      target: totalTarget,
    };
  }, [targets, currentMonth, daysElapsed, daysInMonth]);

  // Chart data for end-of-month prediction
  const predictionChartData = useMemo(() => {
    const today = new Date();
    const daysRemainingInMonth = daysInMonth - daysElapsed;

    return [
      {
        scenario: 'Current Run',
        sales: endOfMonthPrediction.currentRun,
        type: 'current',
      },
      {
        scenario: 'On Track',
        sales: endOfMonthPrediction.onTrackPrediction,
        type: 'prediction',
      },
      {
        scenario: 'Optimistic',
        sales: endOfMonthPrediction.optimisticPrediction,
        type: 'optimistic',
      },
      {
        scenario: 'Pessimistic',
        sales: endOfMonthPrediction.pessimisticPrediction,
        type: 'pessimistic',
      },
      {
        scenario: 'Target',
        sales: endOfMonthPrediction.target,
        type: 'target',
      },
    ];
  }, [endOfMonthPrediction, daysInMonth, daysElapsed]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Sales Targets</h1>
            <p className="text-muted-foreground mt-1">Track monthly targets, actual sales, and performance</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" /> Add Target
          </Button>
        </div>

        {/* Filters */}
        <GlassCard>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="filter-tl">Filter by Team Leader</Label>
              <Select value={filterTeamLeader} onValueChange={setFilterTeamLeader}>
                <SelectTrigger className="glass-input mt-2" id="filter-tl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Leaders</SelectItem>
                  {teamLeaders.map((tl) => (
                    <SelectItem key={tl.id} value={tl.id}>
                      {tl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-perf">Sort by Performance</Label>
              <Select value={filterPerformance} onValueChange={(value: any) => setFilterPerformance(value)}>
                <SelectTrigger className="glass-input mt-2" id="filter-perf">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="best">Best Performance</SelectItem>
                  <SelectItem value="lower">Lower Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterTeamLeader('all');
                  setFilterPerformance('all');
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
                    <TableHead>Team Leader</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Actual Sales</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Daily Target</TableHead>
                    <TableHead>MTD Target</TableHead>
                    <TableHead>MTD Sales</TableHead>
                    <TableHead>MTD Performance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTargets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No targets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTargets.map((target) => (
                      <TableRow key={target.id} className="border-border/30 hover:bg-primary/5">
                        <TableCell className="font-medium">{target.team_leader_name}</TableCell>
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleOpenDialog(target)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDelete(target)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Daily Target vs Actual Chart */}
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

          {/* TL Performance Monthly Chart */}
          <GlassCard>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Top 10 TL Performance This Month</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tlPerformanceData} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
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
        </div>

        {/* End of Month Prediction Chart */}
        <GlassCard>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h2 className="text-xl font-semibold">End of Month Prediction</h2>
                <p className="text-sm text-muted-foreground mt-1">Based on current running rate</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/5 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Current Run</p>
                  <p className="text-lg font-bold text-blue-600">{endOfMonthPrediction.currentRun.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">On Track</p>
                  <p className="text-lg font-bold text-green-600">{endOfMonthPrediction.onTrackPrediction.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Optimistic</p>
                  <p className="text-lg font-bold text-yellow-600">{endOfMonthPrediction.optimisticPrediction.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-r from-orange-500/10 to-orange-500/5 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Pessimistic</p>
                  <p className="text-lg font-bold text-orange-600">{endOfMonthPrediction.pessimisticPrediction.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={predictionChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="scenario" stroke="rgba(148, 163, 184, 0.5)" />
                <YAxis stroke="rgba(148, 163, 184, 0.5)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => value.toLocaleString()}
                />
                <Bar dataKey="sales" radius={[8, 8, 0, 0]}>
                  {predictionChartData.map((entry, index) => {
                    let color = '#3b82f6'; // blue for current run
                    if (entry.type === 'target') color = '#6b7280';
                    else if (entry.type === 'prediction') color = '#10b981';
                    else if (entry.type === 'optimistic') color = '#06b6d4';
                    else if (entry.type === 'pessimistic') color = '#f97316';
                    return <Bar key={`bar-${index}`} dataKey="sales" fill={color} />;
                  })}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Current Run: {endOfMonthPrediction.currentRun.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`${styles.indicatorDot} ${styles.indicatorDotGreen}`} />
                <span className="text-muted-foreground">On Track: {endOfMonthPrediction.onTrackPrediction.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="text-muted-foreground">Target: {endOfMonthPrediction.target.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-muted-foreground">Remaining Days: {daysInMonth - daysElapsed}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) handleCloseDialog();
      }}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle>
              {editingTarget ? 'Edit Target' : 'Add New Target'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="team-leader">Team Leader *</Label>
              <Select
                value={formData.team_leader_id}
                onValueChange={(value) => setFormData({ ...formData, team_leader_id: value })}
              >
                <SelectTrigger className="glass-input" id="team-leader" name="team-leader">
                  <SelectValue placeholder="Select team leader" />
                </SelectTrigger>
                <SelectContent>
                  {teamLeaders.map((tl) => (
                    <SelectItem key={tl.id} value={tl.id}>
                      {tl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Year *</Label>
                <Select
                  value={formData.year.toString()}
                  onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) })}
                >
                  <SelectTrigger className="glass-input" id="year" name="year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="month">Month *</Label>
                <Select
                  value={formData.month.toString()}
                  onValueChange={(value) => setFormData({ ...formData, month: parseInt(value) })}
                >
                  <SelectTrigger className="glass-input" id="month" name="month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {getMonthName(i)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="target-amount">Target Amount *</Label>
              <Input
                id="target-amount"
                name="target-amount"
                type="number"
                min="1"
                value={formData.target_amount}
                onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                placeholder="Enter target amount"
                className="glass-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingTarget ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
