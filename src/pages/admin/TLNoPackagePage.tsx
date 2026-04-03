import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageX, Search } from 'lucide-react';
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

interface NoPackageSale {
  id: string;
  smartcard_number: string;
  serial_number: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  dsr_id: string | null;
}

export default function TLNoPackagePage() {
  const { currentTeamLeader } = useAuth();
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<NoPackageSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [salesDatePreset, setSalesDatePreset] = useState<SalesDatePreset>('this_month');
  const [salesDateFrom, setSalesDateFrom] = useState(defaultSalesDateRange.startDate);
  const [salesDateTo, setSalesDateTo] = useState(defaultSalesDateRange.endDate);

  const salesDateRange = createSalesDateRange(salesDatePreset, salesDateFrom, salesDateTo);
  const salesDateLabel = describeSalesDateRange(salesDateRange);

  const fetchData = useCallback(async () => {
    if (!currentTeamLeader) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('sales_records')
        .select('id, smartcard_number, serial_number, customer_name, sale_date, payment_status, dsr_id')
        .eq('team_leader_id', currentTeamLeader.id)
        .eq('package_status', 'No Package')
        .gte('sale_date', salesDateRange.startDate)
        .lte('sale_date', salesDateRange.endDate)
        .order('sale_date', { ascending: false });
      setSales(data || []);
    } finally {
      setLoading(false);
    }
  }, [currentTeamLeader, salesDateRange.endDate, salesDateRange.startDate]);

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
    () => sales.filter((sale) => sale.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) || sale.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) || (sale.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())),
    [sales, searchQuery]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">TL No Packages</h1>
          <p className="text-muted-foreground mt-1">Sales without package for {currentTeamLeader?.name || 'your account'} • {salesDateLabel}</p>
        </div>
        <SalesDateFilter preset={salesDatePreset} startDate={salesDateFrom} endDate={salesDateTo} onPresetChange={handleSalesDatePresetChange} onStartDateChange={setSalesDateFrom} onEndDateChange={setSalesDateTo} />
        <GlassCard className="p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search smartcard, serial, customer..." className="pl-9" /></div></GlassCard>
        <GlassCard>
          <div className="overflow-x-auto">
            {loading ? <div className="space-y-4 p-4">{[...Array(5)].map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Smartcard</TableHead><TableHead>Serial</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Payment</TableHead><TableHead>Completion</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No no-package sales found.</TableCell></TableRow> : filteredSales.map((sale) => (
                    <TableRow key={sale.id}><TableCell className="font-mono text-sm">{sale.smartcard_number}</TableCell><TableCell className="font-mono text-sm">{sale.serial_number}</TableCell><TableCell>{sale.customer_name || '-'}</TableCell><TableCell>{sale.sale_date}</TableCell><TableCell><Badge variant={sale.payment_status === 'Paid' ? 'default' : 'destructive'}>{sale.payment_status}</Badge></TableCell><TableCell><Badge className={getSaleCompletionBadgeClass(sale.dsr_id)}>{getSaleCompletionLabel(sale.dsr_id)}</Badge></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </GlassCard>
        <GlassCard className="p-4 text-center"><PackageX className="h-6 w-6 mx-auto text-amber-500 mb-2" /><p className="text-2xl font-bold">{filteredSales.length}</p><p className="text-sm text-muted-foreground">No Package Records</p></GlassCard>
      </div>
    </AdminLayout>
  );
}