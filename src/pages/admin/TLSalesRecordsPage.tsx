import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Package, Search, ShoppingCart } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import SalesDateFilter from '@/components/SalesDateFilter';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/auth-context';
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

export default function TLSalesRecordsPage() {
  const { currentTeamLeader, currentCaptain, currentDSR, isCaptain, isDSR } = useAuth();
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sales, setSales] = useState<SaleRecord[]>([]);
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">Sales records for {ownerName || 'your account'} • {salesDateLabel}</p>
        </div>
        <SalesDateFilter preset={salesDatePreset} startDate={salesDateFrom} endDate={salesDateTo} onPresetChange={handleSalesDatePresetChange} onStartDateChange={setSalesDateFrom} onEndDateChange={setSalesDateTo} />
        <GlassCard className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search smartcard, serial, customer..." className="pl-9" />
          </div>
        </GlassCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center"><ShoppingCart className="h-6 w-6 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{filteredSales.length}</p><p className="text-sm text-muted-foreground">Sales</p></GlassCard>
          <GlassCard className="p-4 text-center"><CreditCard className="h-6 w-6 mx-auto text-red-500 mb-2" /><p className="text-2xl font-bold">{filteredSales.filter((sale) => sale.payment_status === 'Unpaid').length}</p><p className="text-sm text-muted-foreground">Unpaid</p></GlassCard>
          <GlassCard className="p-4 text-center"><Package className="h-6 w-6 mx-auto text-green-500 mb-2" /><p className="text-2xl font-bold">{filteredSales.filter((sale) => sale.package_status === 'Packaged').length}</p><p className="text-sm text-muted-foreground">Packaged</p></GlassCard>
          <GlassCard className="p-4 text-center"><Package className="h-6 w-6 mx-auto text-amber-500 mb-2" /><p className="text-2xl font-bold">{filteredSales.filter((sale) => !sale.dsr_id).length}</p><p className="text-sm text-muted-foreground">Incomplete</p></GlassCard>
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