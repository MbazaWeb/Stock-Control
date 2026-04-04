import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
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

export default function SalesTargetPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SalesTarget | null>(null);
  const [formData, setFormData] = useState({
    team_leader_id: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    target_amount: '',
  });

  const currentMonth = getCurrentMonthYear();

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

      const formattedTargets = (targetsData || []).map((target: any) => ({
        id: target.id,
        team_leader_id: target.team_leader_id,
        team_leader_name: target.team_leaders?.name || 'Unknown',
        year: target.year,
        month: target.month,
        target_amount: target.target_amount,
        created_at: target.created_at,
      }));

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
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleDelete = async (target: SalesTarget) => {
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

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Sales Targets</h1>
              <p className="text-slate-300">Manage monthly targets for team leaders</p>
            </div>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" /> Add Target
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard>
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Total Team Leaders</p>
                <p className="text-3xl font-bold text-white">{teamLeaders.length}</p>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Total Targets This Month</p>
                <p className="text-3xl font-bold text-white">
                  {targets.filter(t => t.year === currentMonth.year && t.month === currentMonth.month).length}
                </p>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Combined Monthly Target</p>
                <p className="text-3xl font-bold text-white">
                  {targets
                    .filter(t => t.year === currentMonth.year && t.month === currentMonth.month)
                    .reduce((sum, t) => sum + t.target_amount, 0)
                    .toLocaleString()}
                </p>
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
                      <TableHead>Year</TableHead>
                      <TableHead>Target Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                          No targets created yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      targets.map((target) => (
                        <TableRow key={target.id} className="border-border/30 hover:bg-primary/5">
                          <TableCell className="font-medium">{target.team_leader_name}</TableCell>
                          <TableCell>
                            {getMonthName(target.month)}
                          </TableCell>
                          <TableCell>{target.year}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{target.target_amount.toLocaleString()}</Badge>
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
        </div>
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
