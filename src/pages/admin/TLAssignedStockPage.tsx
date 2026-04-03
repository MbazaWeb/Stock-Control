import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

interface StockItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  package_status: string;
  payment_status: string;
  created_at: string;
}

export default function TLAssignedStockPage() {
  const { currentTeamLeader, currentCaptain, isCaptain } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'sold'>('all');
  const [stockTypeFilter, setStockTypeFilter] = useState('all');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);

  const assigneeId = isCaptain ? currentCaptain?.id : currentTeamLeader?.id;
  const assigneeType = isCaptain ? 'captain' : 'team_leader';
  const title = isCaptain ? 'Captain Stock' : 'TL Assigned Stock';
  const ownerName = isCaptain ? currentCaptain?.name : currentTeamLeader?.name;

  const fetchData = useCallback(async () => {
    if (!assigneeId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('inventory')
        .select('id, smartcard_number, serial_number, stock_type, status, package_status, payment_status, created_at')
        .eq('assigned_to_type', assigneeType)
        .eq('assigned_to_id', assigneeId)
        .order('created_at', { ascending: false });

      setStockItems(data || []);
    } finally {
      setLoading(false);
    }
  }, [assigneeId, assigneeType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stockTypes = useMemo(() => Array.from(new Set(stockItems.map((item) => item.stock_type))).sort(), [stockItems]);

  const filteredItems = useMemo(
    () =>
      stockItems.filter((item) => {
        const matchesQuery =
          item.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.serial_number.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;
        const matchesStockType = stockTypeFilter === 'all' ? true : item.stock_type === stockTypeFilter;

        return matchesQuery && matchesStatus && matchesStockType;
      }),
    [searchQuery, statusFilter, stockItems, stockTypeFilter]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">Stock currently assigned to {ownerName || 'your account'}.</p>
        </div>
        <GlassCard className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search smartcard or serial..." className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'assigned' | 'sold') => setStatusFilter(value)}>
              <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Assigned</SelectItem>
                <SelectItem value="assigned">In Hand</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stockTypeFilter} onValueChange={setStockTypeFilter}>
              <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Types</SelectItem>
                {stockTypes.map((stockType) => (
                  <SelectItem key={stockType} value={stockType}>{stockType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center"><Package className="h-6 w-6 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{stockItems.length}</p><p className="text-sm text-muted-foreground">All Stock Assigned</p></GlassCard>
          <GlassCard className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{stockItems.filter((item) => item.status === 'assigned').length}</p><p className="text-sm text-muted-foreground">In Hand</p></GlassCard>
          <GlassCard className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{stockItems.filter((item) => item.status === 'sold').length}</p><p className="text-sm text-muted-foreground">Sold</p></GlassCard>
          <GlassCard className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{filteredItems.length}</p><p className="text-sm text-muted-foreground">Filtered Results</p></GlassCard>
        </div>
        <GlassCard>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-4 p-4">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Package</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No assigned stock found.</TableCell></TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.smartcard_number}</TableCell>
                        <TableCell className="font-mono text-sm">{item.serial_number}</TableCell>
                        <TableCell>{item.stock_type}</TableCell>
                        <TableCell><Badge variant="outline">{item.status}</Badge></TableCell>
                        <TableCell><Badge variant={item.payment_status === 'Paid' ? 'default' : 'destructive'}>{item.payment_status}</Badge></TableCell>
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