import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, Package, Search, ShoppingCart } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import SalesDateFilter from '@/components/SalesDateFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createSalesDateRange, describeSalesDateRange, getDefaultSalesDateRange, type SalesDatePreset } from '@/lib/salesDateRange';
import { getSaleCompletionBadgeClass, getSaleCompletionLabel } from '@/lib/saleCompletion';

interface SaleRecord {
  id: string;
  smartcard_number: string;
  serial_number: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  dsr_id: string | null;
}

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  zone_id: string | null;
  region_id: string | null;
}

interface PendingSaleRequest {
  id: string;
  smartcard_number: string;
  serial_number: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  approval_status: string;
}

export default function TLSalesRecordsPage() {
  const { toast } = useToast();
  const { adminUser, currentTeamLeader, currentCaptain, currentDSR, isCaptain, isDSR } = useAuth();
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [availableStock, setAvailableStock] = useState<InventoryItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingSaleRequest[]>([]);
  const [stockTypeFilter, setStockTypeFilter] = useState('all');
  const [inventoryId, setInventoryId] = useState('');
  const [packageStatus, setPackageStatus] = useState('No Package');
  const [paymentStatus, setPaymentStatus] = useState('Unpaid');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [salesDatePreset, setSalesDatePreset] = useState<SalesDatePreset>('this_month');
  const [salesDateFrom, setSalesDateFrom] = useState(defaultSalesDateRange.startDate);
  const [salesDateTo, setSalesDateTo] = useState(defaultSalesDateRange.endDate);

  const ownerName = isDSR ? currentDSR?.name : isCaptain ? currentCaptain?.name : currentTeamLeader?.name;
  const title = isDSR ? 'My Sales' : isCaptain ? 'Captain Sales Records' : 'TL Sales Records';

  const salesDateRange = createSalesDateRange(salesDatePreset, salesDateFrom, salesDateTo);
  const salesDateLabel = describeSalesDateRange(salesDateRange);

  const fetchData = useCallback(async () => {
    const scopeId = isDSR ? currentDSR?.id : isCaptain ? currentCaptain?.id : currentTeamLeader?.id;
    if (!scopeId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('sales_records')
        .select('id, smartcard_number, serial_number, customer_name, sale_date, payment_status, package_status, dsr_id')
        .gte('sale_date', salesDateRange.startDate)
        .lte('sale_date', salesDateRange.endDate)
        .order('sale_date', { ascending: false });

      if (isDSR) query = query.eq('dsr_id', scopeId);
      else if (isCaptain) query = query.eq('captain_id', scopeId);
      else query = query.eq('team_leader_id', scopeId);

      const { data } = await query;
      setSales(data || []);
    } finally {
      setLoading(false);
    }
  }, [currentCaptain, currentDSR, currentTeamLeader, isCaptain, isDSR, salesDateRange.endDate, salesDateRange.startDate]);

  const fetchDsrSubmissionData = useCallback(async () => {
    if (!isDSR || !currentDSR || !adminUser) {
      setAvailableStock([]);
      setPendingRequests([]);
      return;
    }

    try {
      const [pendingRes, soldRes, inventoryRes, requestRes] = await Promise.all([
        supabase.from('pending_sales').select('inventory_id').eq('approval_status', 'pending'),
        supabase.from('sales_records').select('inventory_id').not('inventory_id', 'is', null),
        supabase
          .from('inventory')
          .select('id, smartcard_number, serial_number, stock_type, zone_id, region_id')
          .eq('assigned_to_type', 'dsr')
          .eq('assigned_to_id', currentDSR.id)
          .eq('status', 'assigned')
          .order('smartcard_number'),
        supabase
          .from('pending_sales')
          .select('id, smartcard_number, serial_number, customer_name, sale_date, payment_status, package_status, approval_status')
          .eq('submitted_by_admin_user_id', adminUser.id)
          .eq('dsr_id', currentDSR.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      const excludedIds = new Set<string>([
        ...(pendingRes.data || []).map((item) => item.inventory_id),
        ...(soldRes.data || []).map((item) => item.inventory_id),
      ].filter((value): value is string => Boolean(value)));

      setAvailableStock((inventoryRes.data || []).filter((item) => !excludedIds.has(item.id)));
      setPendingRequests(requestRes.data || []);
    } catch (error) {
      console.error('Error loading DSR submission data:', error);
      toast({ title: 'Error', description: 'Failed to load DSR stock for submission.', variant: 'destructive' });
    }
  }, [adminUser, currentDSR, isDSR, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchDsrSubmissionData();
  }, [fetchDsrSubmissionData]);

  const handleSalesDatePresetChange = (preset: SalesDatePreset) => {
    const nextRange = createSalesDateRange(preset, salesDateFrom, salesDateTo);
    setSalesDatePreset(preset);
    setSalesDateFrom(nextRange.startDate);
    setSalesDateTo(nextRange.endDate);
  };

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) =>
        sale.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sale.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [sales, searchQuery]
  );

  const filteredStock = useMemo(
    () => (stockTypeFilter === 'all' ? availableStock : availableStock.filter((item) => item.stock_type === stockTypeFilter)),
    [availableStock, stockTypeFilter]
  );

  const stockTypes = useMemo(() => Array.from(new Set(availableStock.map((item) => item.stock_type))).sort(), [availableStock]);
  const pendingCount = useMemo(() => pendingRequests.filter((request) => request.approval_status === 'pending').length, [pendingRequests]);

  const resetSubmissionForm = () => {
    setInventoryId('');
    setPackageStatus('No Package');
    setPaymentStatus('Unpaid');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setNotes('');
    setStockTypeFilter('all');
  };

  const handleSubmitSale = async () => {
    if (!isDSR || !currentDSR || !adminUser || !inventoryId) {
      toast({ title: 'Error', description: 'Please select stock before submitting.', variant: 'destructive' });
      return;
    }

    const selectedStock = availableStock.find((item) => item.id === inventoryId);
    if (!selectedStock) {
      toast({ title: 'Error', description: 'Selected stock was not found.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: existingPending } = await supabase
        .from('pending_sales')
        .select('id')
        .eq('inventory_id', inventoryId)
        .eq('approval_status', 'pending')
        .limit(1);

      if (existingPending && existingPending.length > 0) {
        toast({ title: 'Error', description: 'This stock already has a pending sale request.', variant: 'destructive' });
        return;
      }

      const { data: existingSale } = await supabase
        .from('sales_records')
        .select('id')
        .eq('inventory_id', inventoryId)
        .limit(1);

      if (existingSale && existingSale.length > 0) {
        toast({ title: 'Error', description: 'This stock has already been sold.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('pending_sales').insert([{ 
        inventory_id: selectedStock.id,
        smartcard_number: selectedStock.smartcard_number,
        serial_number: selectedStock.serial_number,
        stock_type: selectedStock.stock_type,
        customer_name: customerName.trim() || null,
        sale_date: saleDate,
        payment_status: paymentStatus,
        package_status: packageStatus,
        team_leader_id: currentDSR.team_leader_id,
        captain_id: currentDSR.captain_id,
        dsr_id: currentDSR.id,
        submitted_by_admin_user_id: adminUser.id,
        submitted_by_role: adminUser.role,
        zone_id: selectedStock.zone_id,
        region_id: selectedStock.region_id,
        notes: notes.trim() || null,
      }]);

      if (error) throw error;

      toast({ title: 'Sale submitted', description: 'Your sale has been sent for approval.' });
      resetSubmissionForm();
      await Promise.all([fetchData(), fetchDsrSubmissionData()]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit sale.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">Sales records for {ownerName || 'your account'} • {salesDateLabel}</p>
        </div>

        {isDSR && (
          <GlassCard className="p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Submit Sale
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Record a DSR sale here. It will stay pending until admin approval.</p>
              </div>
              <div className="flex gap-2 text-sm">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                  {filteredStock.length} Available
                </Badge>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                  {pendingCount} Pending
                </Badge>
              </div>
            </div>

            {stockTypes.length > 1 && (
              <div>
                <Label className="text-xs">Stock Type</Label>
                <Select value={stockTypeFilter} onValueChange={setStockTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {stockTypes.map((stockType) => (
                      <SelectItem key={stockType} value={stockType}>{stockType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Assigned Stock ({filteredStock.length})</Label>
              <Select value={inventoryId} onValueChange={setInventoryId} disabled={filteredStock.length === 0}>
                <SelectTrigger><SelectValue placeholder={filteredStock.length === 0 ? 'No available stock to submit' : 'Select stock item'} /></SelectTrigger>
                <SelectContent>
                  {filteredStock.map((stock) => (
                    <SelectItem key={stock.id} value={stock.id}>
                      {stock.smartcard_number} - {stock.serial_number} ({stock.stock_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {inventoryId && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Package Status</Label>
                    <Select value={packageStatus} onValueChange={setPackageStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Packaged">Packaged</SelectItem>
                        <SelectItem value="No Package">No Package</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Payment Status</Label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Sale Date</Label>
                    <Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Customer Name</Label>
                    <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Any follow-up notes..." rows={3} />
                </div>

                <div className="pt-2 border-t">
                  <Button onClick={handleSubmitSale} disabled={submitting} className="w-full md:w-auto">
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Submit For Approval</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">Submitted sales are reviewed from the admin Sales Approval page before they become a final sales record.</p>
                </div>
              </>
            )}

            {pendingRequests.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <h3 className="text-sm font-semibold">Recent Requests</h3>
                  <p className="text-xs text-muted-foreground">Your latest sales waiting for approval or recently processed.</p>
                </div>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-border/50 p-3">
                      <div>
                        <div className="font-mono text-sm">{request.smartcard_number}</div>
                        <div className="text-xs text-muted-foreground">{request.serial_number} • {request.customer_name || 'No customer name'} • {request.sale_date}</div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{request.payment_status}</Badge>
                        <Badge variant="outline">{request.package_status}</Badge>
                        <Badge className={request.approval_status === 'approved'
                          ? 'bg-green-500/20 text-green-500 border-green-500/30'
                          : request.approval_status === 'rejected'
                            ? 'bg-red-500/20 text-red-500 border-red-500/30'
                            : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}>
                          {request.approval_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        )}

        <SalesDateFilter preset={salesDatePreset} startDate={salesDateFrom} endDate={salesDateTo} onPresetChange={handleSalesDatePresetChange} onStartDateChange={setSalesDateFrom} onEndDateChange={setSalesDateTo} />
        <GlassCard className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search smartcard, serial, customer..." className="pl-9" />
          </div>
        </GlassCard>
        <div className={`grid grid-cols-2 ${isDSR ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
          <GlassCard className="p-4 text-center"><ShoppingCart className="h-6 w-6 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{filteredSales.length}</p><p className="text-sm text-muted-foreground">Sales</p></GlassCard>
          <GlassCard className="p-4 text-center"><CreditCard className="h-6 w-6 mx-auto text-red-500 mb-2" /><p className="text-2xl font-bold">{filteredSales.filter((sale) => sale.payment_status === 'Unpaid').length}</p><p className="text-sm text-muted-foreground">Unpaid</p></GlassCard>
          <GlassCard className="p-4 text-center"><Package className="h-6 w-6 mx-auto text-green-500 mb-2" /><p className="text-2xl font-bold">{filteredSales.filter((sale) => sale.package_status === 'Packaged').length}</p><p className="text-sm text-muted-foreground">Packaged</p></GlassCard>
          <GlassCard className="p-4 text-center"><Package className="h-6 w-6 mx-auto text-amber-500 mb-2" /><p className="text-2xl font-bold">{filteredSales.filter((sale) => !sale.dsr_id).length}</p><p className="text-sm text-muted-foreground">Incomplete</p></GlassCard>
          {isDSR && <GlassCard className="p-4 text-center"><CheckCircle2 className="h-6 w-6 mx-auto text-amber-500 mb-2" /><p className="text-2xl font-bold">{pendingCount}</p><p className="text-sm text-muted-foreground">Pending Approval</p></GlassCard>}
        </div>
        <GlassCard>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-4 p-4">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Smartcard</TableHead><TableHead>Serial</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Payment</TableHead><TableHead>Package</TableHead><TableHead>Completion</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No sales records found.</TableCell></TableRow>
                  ) : (
                    filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">{sale.smartcard_number}</TableCell>
                        <TableCell className="font-mono text-sm">{sale.serial_number}</TableCell>
                        <TableCell>{sale.customer_name || '-'}</TableCell>
                        <TableCell>{sale.sale_date}</TableCell>
                        <TableCell><Badge variant={sale.payment_status === 'Paid' ? 'default' : 'destructive'}>{sale.payment_status}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{sale.package_status}</Badge></TableCell>
                        <TableCell><Badge className={getSaleCompletionBadgeClass(sale.dsr_id)}>{getSaleCompletionLabel(sale.dsr_id)}</Badge></TableCell>
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