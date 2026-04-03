import { useCallback, useEffect, useState, useMemo } from 'react';
import { CreditCard, Search, Eye, Calendar, Phone, User, Package, Users, Filter } from 'lucide-react';
import SalesDateFilter from '@/components/SalesDateFilter';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

interface UnpaidSale {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
  package_status: string;
  notes: string | null;
  dsr_id: string | null;
  team_leader: { name: string } | null;
  captain: { name: string } | null;
  dsr: { name: string } | null;
  zone: { name: string } | null;
  region: { name: string } | null;
  created_at: string;
}

interface SaleDetail {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
  package_status: string;
  notes: string | null;
  dsr_id: string | null;
  team_leader: { name: string } | null;
  captain: { name: string } | null;
  dsr: { name: string } | null;
  zone: { name: string } | null;
  region: { name: string } | null;
  created_at: string;
}

interface RelatedLocation {
  id: string;
  name: string;
}

interface UnpaidSaleRow {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
  package_status: string;
  notes: string | null;
  created_at: string;
  dsr_id: string | null;
  team_leaders: { name: string } | null;
  captains: { name: string } | null;
  dsrs: { name: string } | null;
  zones: RelatedLocation | null;
  regions: RelatedLocation | null;
}

const TL_COLORS = [
  'bg-purple-500/20 text-purple-500 border-purple-500/30',
  'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
  'bg-pink-500/20 text-pink-500 border-pink-500/30',
  'bg-orange-500/20 text-orange-500 border-orange-500/30',
  'bg-teal-500/20 text-teal-500 border-teal-500/30',
  'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
  'bg-rose-500/20 text-rose-500 border-rose-500/30',
  'bg-amber-500/20 text-amber-500 border-amber-500/30',
  'bg-lime-500/20 text-lime-500 border-lime-500/30',
  'bg-fuchsia-500/20 text-fuchsia-500 border-fuchsia-500/30',
];

export default function UnpaidPage() {
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [sales, setSales] = useState<UnpaidSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<UnpaidSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [zones, setZones] = useState<Array<{id: string; name: string}>>([]);
  const [regions, setRegions] = useState<Array<{id: string; name: string; zone_id: string}>>([]);
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
          s.captain?.name.toLowerCase().includes(query) ||
          s.dsr?.name.toLowerCase().includes(query) ||
          s.zone?.name.toLowerCase().includes(query) ||
          s.region?.name.toLowerCase().includes(query)
      );
    }
    if (zoneFilter !== 'all') result = result.filter((s) => s.zone?.name && zones.find((zone) => zone.name === s.zone?.name)?.id === zoneFilter);
    if (regionFilter !== 'all') result = result.filter((s) => s.region?.name && regions.find((region) => region.name === s.region?.name)?.id === regionFilter);
    setFilteredSales(result);
  }, [searchQuery, sales, zoneFilter, regionFilter, zones, regions]);

  const handleSalesDatePresetChange = (preset: SalesDatePreset) => {
    const nextRange = createSalesDateRange(preset, salesDateFrom, salesDateTo);
    setSalesDatePreset(preset);
    setSalesDateFrom(nextRange.startDate);
    setSalesDateTo(nextRange.endDate);
  };

  const fetchUnpaidSales = useCallback(async () => {
    try {
      const [salesQuery, zonesRes, regionsRes] = await Promise.all([
        supabase
          .from('sales_records')
          .select(`
            id, 
            smartcard_number, 
            serial_number, 
            stock_type, 
            customer_name, 
            customer_phone, 
            sale_date, 
            package_status,
            notes,
            created_at,
            dsr_id,
            team_leaders:team_leader_id(name),
            captains:captain_id(name),
            dsrs:dsr_id(name),
            zones:zone_id(id, name),
            regions:region_id(id, name)
          `)
          .eq('payment_status', 'Unpaid')
          .gte('sale_date', salesDateRange.startDate)
          .lte('sale_date', salesDateRange.endDate)
          .order('created_at', { ascending: false }),
        supabase.from('zones').select('id, name').order('name'),
        supabase.from('regions').select('id, name, zone_id').order('name'),
      ]);

      setZones(zonesRes.data || []);
      setRegions(regionsRes.data || []);

      const data = salesQuery.data;
      const error = salesQuery.error;

      if (!error && data) {
        const formattedData = (data as UnpaidSaleRow[]).map((item) => ({
          id: item.id,
          smartcard_number: item.smartcard_number,
          serial_number: item.serial_number,
          stock_type: item.stock_type,
          customer_name: item.customer_name,
          customer_phone: item.customer_phone,
          sale_date: item.sale_date,
          package_status: item.package_status,
          notes: item.notes,
          dsr_id: item.dsr_id,
          team_leader: item.team_leaders,
          captain: item.captains,
          dsr: item.dsrs,
          zone: item.zones,
          region: item.regions,
          created_at: item.created_at,
        }));
        setSales(formattedData);
        setFilteredSales(formattedData);
      }
    } catch (error) {
      console.error('Error fetching unpaid sales:', error);
    } finally {
      setLoading(false);
    }
  }, [salesDateRange.endDate, salesDateRange.startDate]);

  useEffect(() => {
    fetchUnpaidSales();
  }, [fetchUnpaidSales]);

  const viewSaleDetails = (sale: UnpaidSale) => {
    setSelectedSale({
      id: sale.id,
      smartcard_number: sale.smartcard_number,
      serial_number: sale.serial_number,
      stock_type: sale.stock_type,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      sale_date: sale.sale_date,
      package_status: sale.package_status,
      notes: sale.notes,
      dsr_id: sale.dsr_id,
      team_leader: sale.team_leader,
      captain: sale.captain,
      dsr: sale.dsr,
      zone: sale.zone,
      region: sale.region,
      created_at: sale.created_at,
    });
    setDetailDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'Packaged' 
      ? 'bg-purple-500/20 text-purple-500 border-purple-500/30' 
      : 'bg-pink-500/20 text-pink-500 border-pink-500/30';
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const tlColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueTLs = [...new Set(sales.map(s => s.team_leader?.name).filter(Boolean))] as string[];
    uniqueTLs.forEach((name, i) => {
      map.set(name, TL_COLORS[i % TL_COLORS.length]);
    });
    return map;
  }, [sales]);

  const getTeamBadge = (type: 'tl' | 'captain' | 'dsr', name: string) => {
    const config = {
      tl: { className: tlColorMap.get(name) || TL_COLORS[0] },
      captain: { className: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
      dsr: { className: 'bg-green-500/20 text-green-500 border-green-500/30' }
    };
    
    const { className } = config[type];
    
    return (
      <Badge className={`${className} text-xs`}>
        {type === 'tl' ? 'TL' : type === 'captain' ? 'Captain' : 'DSR'}: {name}
      </Badge>
    );
  };

  return (
    <PublicLayout>
      <div className="space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-warning to-secondary bg-clip-text text-transparent">
                Unpaid Stock
              </span>
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-0.5">
              {filteredSales.length} stock item{filteredSales.length !== 1 ? 's' : ''} pending payment • {salesDateLabel}
            </p>
          </div>
          <Badge className="badge-warning text-sm md:text-lg py-1 md:py-2 px-3 md:px-4 self-start">
            <CreditCard className="h-5 w-5 mr-2" />
            {filteredSales.length} Unpaid
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{filteredSales.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Unpaid</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">
              {sales.filter(s => s.package_status === 'No Package').length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">No Package</div>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">
              {new Set(sales.map(s => s.team_leader?.name).filter(Boolean)).size}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Team Leaders</div>
          </GlassCard>
        </div>

        {/* Search & Filters */}
        <GlassCard className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by smartcard, serial, customer, team, zone, or region..."
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {filteredSales.length} of {sales.length} unpaid records
            </p>
            <p className="text-xs text-muted-foreground">
              Last updated: {sales.length > 0 ? getTimeAgo(sales[0]?.created_at) : 'Never'}
            </p>
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
              <CreditCard className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">
                {searchQuery ? 'No unpaid stock found matching your search' : `No unpaid stock found for ${salesDateLabel.toLowerCase()}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[100px]">Smartcard</TableHead>
                    <TableHead className="w-[120px]">Serial</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="w-[120px]">Sale Date</TableHead>
                    <TableHead className="w-[100px]">Package</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="w-[100px] text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30 border-b border-border/30">
                      <TableCell className="font-medium">
                        <div className="font-mono font-bold text-primary">
                          {sale.smartcard_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm text-muted-foreground">
                          {sale.serial_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sale.stock_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {sale.customer_name || 'No name'}
                          </div>
                          {sale.customer_phone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {sale.customer_phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="text-sm">
                            {new Date(sale.sale_date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getTimeAgo(sale.sale_date)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(sale.package_status)} text-xs`}>
                          {sale.package_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {sale.zone && (
                            <div className="text-xs text-muted-foreground">Zone: {sale.zone.name}</div>
                          )}
                          {sale.region && (
                            <div className="text-xs text-muted-foreground">Region: {sale.region.name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {sale.team_leader && getTeamBadge('tl', sale.team_leader.name)}
                          {sale.captain && getTeamBadge('captain', sale.captain.name)}
                          {sale.dsr && getTeamBadge('dsr', sale.dsr.name)}
                          <Badge className={getSaleCompletionBadgeClass(sale.dsr_id)}>
                            {getSaleCompletionLabel(sale.dsr_id)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewSaleDetails(sale)}
                          className="gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Sale Details
              </DialogTitle>
              <DialogDescription>
                View complete information for this unpaid sale
              </DialogDescription>
            </DialogHeader>
            
            {selectedSale && (
              <div className="space-y-4">
                {/* Smartcard and Serial */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <div className="text-xs text-muted-foreground">Smartcard Number</div>
                    <div className="font-mono font-bold text-lg">{selectedSale.smartcard_number}</div>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-lg">
                    <div className="text-xs text-muted-foreground">Serial Number</div>
                    <div className="font-mono font-bold text-lg">{selectedSale.serial_number}</div>
                  </div>
                </div>

                {/* Stock Type and Package Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-secondary/5 rounded-lg">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Stock Type
                    </div>
                    <div className="font-medium">{selectedSale.stock_type}</div>
                  </div>
                  <div className="p-3 bg-secondary/5 rounded-lg">
                    <div className="text-xs text-muted-foreground">Package Status</div>
                    <Badge className={getStatusColor(selectedSale.package_status)}>
                      {selectedSale.package_status}
                    </Badge>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="p-3 bg-blue-500/5 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Customer Information
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">{selectedSale.customer_name || 'No name provided'}</div>
                    {selectedSale.customer_phone && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selectedSale.customer_phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Information */}
                <div className="p-3 bg-green-500/5 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-2">Location</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Zone</div>
                      <div className="font-medium">{selectedSale.zone?.name || 'Not specified'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Region</div>
                      <div className="font-medium">{selectedSale.region?.name || 'Not specified'}</div>
                    </div>
                  </div>
                </div>

                {/* Team Assignment */}
                <div className="p-3 bg-purple-500/5 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Team Assignment
                  </div>
                  <div className="space-y-2">
                    {selectedSale.team_leader && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Team Leader</span>
                        <span className="font-medium">{selectedSale.team_leader.name}</span>
                      </div>
                    )}
                    {selectedSale.captain && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Captain</span>
                        <span className="font-medium">{selectedSale.captain.name}</span>
                      </div>
                    )}
                    {selectedSale.dsr && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">DSR</span>
                        <span className="font-medium">{selectedSale.dsr.name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Completion</span>
                      <Badge className={getSaleCompletionBadgeClass(selectedSale.dsr_id)}>
                        {getSaleCompletionLabel(selectedSale.dsr_id)}
                      </Badge>
                    </div>
                    {!selectedSale.dsr && (
                      <div className="text-xs text-amber-600">No DSR attached yet, so this sale is still incomplete / not scanned.</div>
                    )}
                  </div>
                </div>

                {/* Sale Date and Notes */}
                <div className="p-3 bg-amber-500/5 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Sale Information
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sale Date</span>
                      <span className="font-medium">{formatDate(selectedSale.sale_date)}</span>
                    </div>
                    {selectedSale.notes && (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground mb-1">Notes</div>
                        <div className="text-sm p-2 bg-background/50 rounded border border-border/30">
                          {selectedSale.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Record Information */}
                <div className="p-3 bg-muted/10 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Record Information</div>
                  <div className="text-xs space-y-1">
                    <div>Created: {new Date(selectedSale.created_at).toLocaleString()}</div>
                    <div>Status: <Badge className="badge-warning ml-1">Unpaid</Badge></div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PublicLayout>
  );
}