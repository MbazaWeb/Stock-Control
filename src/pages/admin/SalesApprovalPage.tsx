import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Package,
  CreditCard,
  Shield,
  UserPlus,
  User,
  MapPin,
  Calendar,
  Loader2,
  Eye,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import StatsCard from '@/components/ui/StatsCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface PendingSale {
  id: string;
  inventory_id: string | null;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  notes: string | null;
  approval_status: string;
  created_at: string;
  team_leader?: { name: string } | null;
  captain?: { name: string } | null;
  dsr?: { name: string } | null;
  zone?: { name: string } | null;
  region?: { name: string } | null;
}

export default function SalesApprovalPage() {
  const { toast } = useToast();
  const { isRegionalAdmin, assignedRegionIds } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<PendingSale | null>(null);

  const fetchPendingSales = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pending_sales')
        .select(`
          *,
          team_leaders:team_leader_id(name),
          captains:captain_id(name),
          dsrs:dsr_id(name),
          zones:zone_id(name),
          regions:region_id(name)
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        query = query.in('region_id', assignedRegionIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data || []).map((item: Record<string, unknown>) => ({
        ...item,
        team_leader: item.team_leaders,
        captain: item.captains,
        dsr: item.dsrs,
        zone: item.zones,
        region: item.regions,
      }));

      setPendingSales(formatted);
    } catch (error) {
      console.error('Error fetching pending sales:', error);
    } finally {
      setLoading(false);
    }
  }, [isRegionalAdmin, assignedRegionIds]);

  useEffect(() => {
    fetchPendingSales();
  }, [fetchPendingSales]);

  const handleApprove = async (sale: PendingSale) => {
    setProcessing(sale.id);
    try {
      // 1. Check inventory isn't already sold
      if (sale.inventory_id) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('status')
          .eq('id', sale.inventory_id)
          .single();

        if (inv?.status === 'sold') {
          toast({ title: 'Error', description: 'This stock has already been sold', variant: 'destructive' });
          await supabase.from('pending_sales').update({ approval_status: 'rejected' }).eq('id', sale.id);
          fetchPendingSales();
          return;
        }
      }

      // 2. Check no existing sale record for this inventory
      if (sale.inventory_id) {
        const { data: existingSale } = await supabase
          .from('sales_records')
          .select('id')
          .eq('inventory_id', sale.inventory_id)
          .limit(1);

        if (existingSale && existingSale.length > 0) {
          toast({ title: 'Error', description: 'A sale record already exists for this stock', variant: 'destructive' });
          await supabase.from('pending_sales').update({ approval_status: 'rejected' }).eq('id', sale.id);
          fetchPendingSales();
          return;
        }
      }

      // 3. Get raw record with IDs (not joined names)
      const { data: rawSale } = await supabase
        .from('pending_sales')
        .select('*')
        .eq('id', sale.id)
        .single();

      if (!rawSale) throw new Error('Pending sale not found');

      // 4. Insert into sales_records
      const { error: insertError } = await supabase.from('sales_records').insert([{
        inventory_id: rawSale.inventory_id,
        smartcard_number: rawSale.smartcard_number,
        serial_number: rawSale.serial_number,
        stock_type: rawSale.stock_type,
        customer_name: rawSale.customer_name,
        sale_date: rawSale.sale_date,
        payment_status: rawSale.payment_status,
        package_status: rawSale.package_status,
        team_leader_id: rawSale.team_leader_id,
        captain_id: rawSale.captain_id,
        dsr_id: rawSale.dsr_id,
        zone_id: rawSale.zone_id,
        region_id: rawSale.region_id,
        notes: rawSale.notes,
      }]);
      if (insertError) throw insertError;

      // 4. Update inventory status to sold
      if (sale.inventory_id) {
        await supabase.from('inventory').update({ status: 'sold' }).eq('id', sale.inventory_id);
      }

      // 5. Mark pending sale as approved
      await supabase.from('pending_sales').update({ approval_status: 'approved' }).eq('id', sale.id);

      toast({ title: 'Approved!', description: `Sale for ${sale.smartcard_number} has been approved and recorded.` });
      fetchPendingSales();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve sale';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (sale: PendingSale) => {
    setProcessing(sale.id);
    try {
      const { error } = await supabase
        .from('pending_sales')
        .update({ approval_status: 'rejected' })
        .eq('id', sale.id);

      if (error) throw error;
      toast({ title: 'Rejected', description: `Sale for ${sale.smartcard_number} has been rejected.` });
      fetchPendingSales();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reject sale';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const filtered = searchQuery
    ? pendingSales.filter(s =>
        s.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pendingSales;

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Sales Approval
              </span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">Review and approve sale requests from public submissions</p>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-sm px-3 py-1">
            <Clock className="h-4 w-4 mr-1" /> {pendingSales.length} Pending
          </Badge>
        </div>

        {/* Search */}
        <GlassCard>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by smartcard, serial, or customer name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <h3 className="text-lg font-medium">No Pending Sales</h3>
              <p className="text-sm text-muted-foreground">All sale requests have been reviewed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Smartcard</TableHead>
                    <TableHead className="hidden md:table-cell">Serial</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="hidden lg:table-cell">Package</TableHead>
                    <TableHead className="hidden lg:table-cell">Team</TableHead>
                    <TableHead className="hidden lg:table-cell">Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono font-medium text-primary">{sale.smartcard_number}</TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs">{sale.serial_number}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{sale.stock_type}</TableCell>
                      <TableCell className="text-sm">{sale.customer_name || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {new Date(sale.sale_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={sale.payment_status === 'Paid'
                          ? 'bg-green-500/20 text-green-500 border-green-500/30'
                          : 'bg-red-500/20 text-red-500 border-red-500/30'
                        }>
                          {sale.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge className={sale.package_status === 'Packaged'
                          ? 'bg-green-500/20 text-green-500 border-green-500/30'
                          : 'bg-red-500/20 text-red-500 border-red-500/30'
                        }>
                          {sale.package_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {sale.team_leader?.name && <div className="flex items-center gap-1"><Shield className="h-3 w-3" />{sale.team_leader.name}</div>}
                        {sale.captain?.name && <div className="flex items-center gap-1"><UserPlus className="h-3 w-3" />{sale.captain.name}</div>}
                        {sale.dsr?.name && <div className="flex items-center gap-1"><User className="h-3 w-3" />{sale.dsr.name}</div>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {sale.zone?.name && <div>{sale.zone.name}</div>}
                        {sale.region?.name && <div className="text-muted-foreground">{sale.region.name}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="md:hidden h-7 w-7 p-0"
                            onClick={() => setDetailItem(sale)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs px-2"
                            disabled={processing === sale.id}
                            onClick={() => handleApprove(sale)}
                          >
                            {processing === sale.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Approve</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs px-2"
                            disabled={processing === sale.id}
                            onClick={() => handleReject(sale)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>

        {/* Mobile Detail Dialog */}
        <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-mono text-primary">{detailItem?.smartcard_number}</DialogTitle>
            </DialogHeader>
            {detailItem && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground text-xs">Serial</span><div className="font-mono">{detailItem.serial_number}</div></div>
                  <div><span className="text-muted-foreground text-xs">Type</span><div>{detailItem.stock_type}</div></div>
                  <div><span className="text-muted-foreground text-xs">Customer</span><div>{detailItem.customer_name || '—'}</div></div>
                  <div><span className="text-muted-foreground text-xs">Sale Date</span><div>{new Date(detailItem.sale_date).toLocaleDateString()}</div></div>
                  <div><span className="text-muted-foreground text-xs">Payment</span><div><Badge className={detailItem.payment_status === 'Paid' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>{detailItem.payment_status}</Badge></div></div>
                  <div><span className="text-muted-foreground text-xs">Package</span><div><Badge className={detailItem.package_status === 'Packaged' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>{detailItem.package_status}</Badge></div></div>
                </div>
                {detailItem.team_leader?.name && <div className="flex items-center gap-1"><Shield className="h-3 w-3" />TL: {detailItem.team_leader.name}</div>}
                {detailItem.captain?.name && <div className="flex items-center gap-1"><UserPlus className="h-3 w-3" />Captain: {detailItem.captain.name}</div>}
                {detailItem.dsr?.name && <div className="flex items-center gap-1"><User className="h-3 w-3" />DSR: {detailItem.dsr.name}</div>}
                {detailItem.zone?.name && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{detailItem.zone.name} {detailItem.region?.name && `/ ${detailItem.region.name}`}</div>}
                {detailItem.notes && <div><span className="text-muted-foreground text-xs">Notes</span><div>{detailItem.notes}</div></div>}
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={processing === detailItem?.id}
                onClick={() => { if (detailItem) { handleApprove(detailItem); setDetailItem(null); } }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={processing === detailItem?.id}
                onClick={() => { if (detailItem) { handleReject(detailItem); setDetailItem(null); } }}
              >
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
