import { useCallback, useEffect, useState } from 'react';
import { PackageX, Search, Calendar, Filter } from 'lucide-react';
import SalesDateFilter from '@/components/SalesDateFilter';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createSalesDateRange,
  describeSalesDateRange,
  getDefaultSalesDateRange,
  type SalesDatePreset,
} from '@/lib/salesDateRange';
import { getSaleCompletionBadgeClass, getSaleCompletionLabel } from '@/lib/saleCompletion';

interface NoPackageSale {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  dsr_id: string | null;
  team_leader: { name: string } | null;
  captain: { name: string } | null;
  dsr: { name: string } | null;
  zone: { id: string; name: string } | null;
  region: { id: string; name: string } | null;
}

interface NoPackageSaleRow {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  dsr_id: string | null;
  team_leaders: { name: string } | null;
  captains: { name: string } | null;
  dsrs: { name: string } | null;
  zones: { id: string; name: string } | null;
  regions: { id: string; name: string } | null;
}

interface Zone { id: string; name: string; }
interface Region { id: string; name: string; zone_id: string; }

export default function NoPackagePage() {
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [sales, setSales] = useState<NoPackageSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<NoPackageSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [salesDatePreset, setSalesDatePreset] = useState<SalesDatePreset>('this_month');
  const [salesDateFrom, setSalesDateFrom] = useState(defaultSalesDateRange.startDate);
  const [salesDateTo, setSalesDateTo] = useState(defaultSalesDateRange.endDate);

  const salesDateRange = createSalesDateRange(salesDatePreset, salesDateFrom, salesDateTo);
  const salesDateLabel = describeSalesDateRange(salesDateRange);

  useEffect(() => { setRegionFilter('all'); }, [zoneFilter]);

  useEffect(() => {
    let result = sales;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.smartcard_number.toLowerCase().includes(query) ||
          s.serial_number.toLowerCase().includes(query) ||
          s.customer_name?.toLowerCase().includes(query) ||
          s.team_leader?.name.toLowerCase().includes(query) ||
          s.dsr?.name.toLowerCase().includes(query)
      );
    }
    if (zoneFilter !== 'all') result = result.filter(s => s.zone?.id === zoneFilter);
    if (regionFilter !== 'all') result = result.filter(s => s.region?.id === regionFilter);
    setFilteredSales(result);
  }, [searchQuery, sales, zoneFilter, regionFilter]);

  const handleSalesDatePresetChange = (preset: SalesDatePreset) => {
    const nextRange = createSalesDateRange(preset, salesDateFrom, salesDateTo);
    setSalesDatePreset(preset);
    setSalesDateFrom(nextRange.startDate);
    setSalesDateTo(nextRange.endDate);
  };

  const fetchNoPackageSales = useCallback(async () => {
    try {
      const [salesRes, zonesRes, regionsRes] = await Promise.all([
        supabase
          .from('sales_records')
          .select(`
            id, smartcard_number, serial_number, stock_type, customer_name, sale_date, payment_status, dsr_id,
            team_leaders:team_leader_id(name),
            captains:captain_id(name),
            dsrs:dsr_id(name),
            zones:zone_id(id, name),
            regions:region_id(id, name)
          `)
          .eq('package_status', 'No Package')
          .gte('sale_date', salesDateRange.startDate)
          .lte('sale_date', salesDateRange.endDate)
          .order('sale_date', { ascending: false }),
        supabase.from('zones').select('id, name').order('name'),
        supabase.from('regions').select('id, name, zone_id').order('name'),
      ]);

      if (!salesRes.error && salesRes.data) {
        setSales(
          (salesRes.data as NoPackageSaleRow[]).map((item) => ({
            ...item,
            dsr_id: item.dsr_id,
            team_leader: item.team_leaders,
            captain: item.captains,
            dsr: item.dsrs,
            zone: item.zones,
            region: item.regions,
          }))
        );
      }
      setZones(zonesRes.data || []);
      setRegions(regionsRes.data || []);
    } catch (error) {
      console.error('Error fetching no package sales:', error);
    } finally {
      setLoading(false);
    }
  }, [salesDateRange.endDate, salesDateRange.startDate]);

  useEffect(() => {
    fetchNoPackageSales();
  }, [fetchNoPackageSales]);

  return (
    <PublicLayout>
      <div className="space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-destructive to-warning bg-clip-text text-transparent">
                No Package
              </span>
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-0.5">
              {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''} without package • {salesDateLabel}
            </p>
          </div>
          <Badge className="badge-destructive text-sm md:text-lg py-1 md:py-2 px-3 md:px-4 self-start">
            <PackageX className="h-5 w-5 mr-2" />
            {filteredSales.length} No Package
          </Badge>
        </div>

        {/* Search & Filters */}
        <GlassCard className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by smartcard, serial, customer, or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-glass"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs glass-input"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs glass-input"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {(zoneFilter === 'all' ? regions : regions.filter(r => r.zone_id === zoneFilter)).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <SalesDateFilter
              preset={salesDatePreset}
              startDate={salesDateFrom}
              endDate={salesDateTo}
              onPresetChange={handleSalesDatePresetChange}
              onStartDateChange={setSalesDateFrom}
              onEndDateChange={setSalesDateTo}
            />
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard className="overflow-hidden p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-12 text-center">
              <PackageX className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">No records without package found for {salesDateLabel.toLowerCase()}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Sale Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-medium">
                        {sale.smartcard_number}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {sale.serial_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.stock_type}</Badge>
                      </TableCell>
                      <TableCell>{sale.customer_name || '-'}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(sale.sale_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            sale.payment_status === 'Paid'
                              ? 'bg-green-500/20 text-green-500 border-green-500/30'
                              : 'bg-red-500/20 text-red-500 border-red-500/30'
                          }
                        >
                          {sale.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          {sale.team_leader && (
                            <span className="badge-blue block w-fit">TL: {sale.team_leader.name}</span>
                          )}
                          {sale.captain && (
                            <span className="badge-gold block w-fit">Capt: {sale.captain.name}</span>
                          )}
                          {sale.dsr && (
                            <span className="bg-muted px-2 py-0.5 rounded-full block w-fit">
                              DSR: {sale.dsr.name}
                            </span>
                          )}
                          <Badge className={getSaleCompletionBadgeClass(sale.dsr_id)}>
                            {getSaleCompletionLabel(sale.dsr_id)}
                          </Badge>
                          {!sale.dsr && <span className="text-amber-600">No DSR attached yet</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>
      </div>
    </PublicLayout>
  );
}
