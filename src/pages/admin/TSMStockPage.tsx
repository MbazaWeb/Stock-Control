import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';

interface TeamLeaderOption {
  id: string;
  name: string;
  region_id: string | null;
}

interface StockItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  region_id: string | null;
  created_at: string;
}

export default function TSMStockPage() {
  const { assignedRegionIds } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned' | 'team_leader'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'assigned' | 'sold'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [packageFilter, setPackageFilter] = useState<'all' | 'packaged' | 'no-package' | 'pending'>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [teamLeaderFilter, setTeamLeaderFilter] = useState('all');
  const [teamLeaders, setTeamLeaders] = useState<TeamLeaderOption[]>([]);
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);

  const fetchData = useCallback(async () => {
    if (assignedRegionIds.length === 0) {
      setTeamLeaders([]);
      setRegions([]);
      setStockItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [regionsRes, teamLeadersRes, stockRes] = await Promise.all([
        supabase.from('regions').select('id, name').in('id', assignedRegionIds).order('name'),
        supabase.from('team_leaders').select('id, name, region_id').in('region_id', assignedRegionIds).order('name'),
        supabase
          .from('inventory')
          .select('id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, assigned_to_type, assigned_to_id, region_id, created_at')
          .in('region_id', assignedRegionIds)
          .order('created_at', { ascending: false }),
      ]);

      if (regionsRes.error) throw regionsRes.error;
      if (teamLeadersRes.error) throw teamLeadersRes.error;
      if (stockRes.error) throw stockRes.error;

      setRegions(regionsRes.data || []);
      setTeamLeaders(teamLeadersRes.data || []);
      setStockItems(stockRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [assignedRegionIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setTeamLeaderFilter('all');
  }, [regionFilter]);

  const tlNameMap = useMemo(
    () => Object.fromEntries(teamLeaders.map((teamLeader) => [teamLeader.id, teamLeader.name])),
    [teamLeaders]
  );

  const filteredTeamLeaders = useMemo(
    () => teamLeaders.filter((teamLeader) => regionFilter === 'all' || teamLeader.region_id === regionFilter),
    [regionFilter, teamLeaders]
  );

  const filteredItems = useMemo(
    () =>
      stockItems.filter((item) => {
        const query = searchQuery.toLowerCase();
        const matchesQuery =
          item.smartcard_number.toLowerCase().includes(query) ||
          item.serial_number.toLowerCase().includes(query);
        const matchesAssignment =
          assignmentFilter === 'all'
            ? !item.assigned_to_type || item.assigned_to_type === 'team_leader'
            : assignmentFilter === 'unassigned'
              ? !item.assigned_to_id
              : item.assigned_to_type === 'team_leader';
        const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;
        const matchesPayment = paymentFilter === 'all'
          ? true
          : paymentFilter === 'paid'
            ? item.payment_status === 'Paid'
            : item.payment_status === 'Unpaid';
        const matchesPackage = packageFilter === 'all'
          ? true
          : packageFilter === 'packaged'
            ? item.package_status === 'Packaged'
            : packageFilter === 'no-package'
              ? item.package_status === 'No Package'
              : item.package_status === 'Pending';
        const matchesRegion = regionFilter === 'all' ? true : item.region_id === regionFilter;
        const matchesTeamLeader =
          teamLeaderFilter === 'all'
            ? true
            : item.assigned_to_type === 'team_leader' && item.assigned_to_id === teamLeaderFilter;

        return matchesQuery && matchesAssignment && matchesStatus && matchesPayment && matchesPackage && matchesRegion && matchesTeamLeader;
      }),
    [assignmentFilter, packageFilter, paymentFilter, regionFilter, searchQuery, statusFilter, stockItems, teamLeaderFilter]
  );

  const tlAssignedCount = useMemo(
    () => stockItems.filter((item) => item.assigned_to_type === 'team_leader' && item.assigned_to_id).length,
    [stockItems]
  );

  const unassignedCount = useMemo(
    () => stockItems.filter((item) => !item.assigned_to_id && item.status === 'available').length,
    [stockItems]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">TSM Stock View</h1>
          <p className="text-muted-foreground mt-1">Track stock assigned to team leaders and stock still unassigned across your regions.</p>
        </div>

        <GlassCard className="p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search smartcard or serial..."
                className="pl-9"
              />
            </div>
            <Select value={assignmentFilter} onValueChange={(value: 'all' | 'unassigned' | 'team_leader') => setAssignmentFilter(value)}>
              <SelectTrigger className="w-full xl:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">TL + Unassigned</SelectItem>
                <SelectItem value="team_leader">TL Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'available' | 'assigned' | 'sold') => setStatusFilter(value)}>
              <SelectTrigger className="w-full xl:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={(value: 'all' | 'paid' | 'unpaid') => setPaymentFilter(value)}>
              <SelectTrigger className="w-full xl:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={packageFilter} onValueChange={(value: 'all' | 'packaged' | 'no-package' | 'pending') => setPackageFilter(value)}>
              <SelectTrigger className="w-full xl:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                <SelectItem value="packaged">Packaged</SelectItem>
                <SelectItem value="no-package">No Package</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-full xl:w-48"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teamLeaderFilter} onValueChange={setTeamLeaderFilter}>
              <SelectTrigger className="w-full xl:w-56"><SelectValue placeholder="Team leader" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Leaders</SelectItem>
                {filteredTeamLeaders.map((teamLeader) => (
                  <SelectItem key={teamLeader.id} value={teamLeader.id}>{teamLeader.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <GlassCard className="p-4 text-center">
            <Package className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stockItems.length}</p>
            <p className="text-sm text-muted-foreground">Territory Stock</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{unassignedCount}</p>
            <p className="text-sm text-muted-foreground">Unassigned</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{tlAssignedCount}</p>
            <p className="text-sm text-muted-foreground">TL Assigned</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{filteredItems.length}</p>
            <p className="text-sm text-muted-foreground">Filtered Results</p>
          </GlassCard>
        </div>

        <GlassCard>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-4 p-4">
                {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Package</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No stock found for the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.smartcard_number}</TableCell>
                        <TableCell className="font-mono text-sm">{item.serial_number}</TableCell>
                        <TableCell>{item.stock_type}</TableCell>
                        <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                        <TableCell>
                          {!item.assigned_to_id ? (
                            <Badge variant="secondary">Unassigned</Badge>
                          ) : item.assigned_to_type === 'team_leader' ? (
                            <Badge variant="outline">TL: {tlNameMap[item.assigned_to_id] || 'Unknown'}</Badge>
                          ) : (
                            <Badge variant="outline">{item.assigned_to_type}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.payment_status === 'Paid' ? 'default' : 'destructive'}>{item.payment_status}</Badge>
                        </TableCell>
                        <TableCell><Badge variant="outline">{item.package_status}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </GlassCard>
      </div>
    </AdminLayout>
  );
}