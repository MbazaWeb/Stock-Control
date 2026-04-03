import { useEffect, useState, useMemo, useCallback } from 'react';
import { Users, Search, Filter, Eye, Phone, MapPin } from 'lucide-react';
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

interface DSRRow {
  id: string;
  name: string;
  phone: string | null;
  captain_id: string | null;
  captainName: string | null;
  tlId: string | null;
  tlName: string | null;
  zoneName: string | null;
  zoneId: string | null;
  regionName: string | null;
  regionId: string | null;
  dsr_number: string | null;
  has_fss_account: boolean;
  fss_username: string | null;
  district: string | null;
  ward: string | null;
  street_village: string | null;
  salesCount: number;
  assignedCount: number;
  isActive: boolean;
  isAudited: boolean;
  latestAuditDate: string | null;
}

interface StockItem {
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  sale_date: string | null;
  customer_name: string | null;
  payment_status: string | null;
  package_status: string | null;
}

export default function DSRPage() {
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [dsrs, setDsrs] = useState<DSRRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [allRegions, setAllRegions] = useState<Array<{ id: string; name: string; zone_id: string | null }>>([]);
  const [teamLeaders, setTeamLeaders] = useState<Array<{ id: string; name: string; region_id: string | null }>>([]);
  const [captains, setCaptains] = useState<Array<{ id: string; name: string; team_leader_id: string | null }>>([]);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [tlFilter, setTlFilter] = useState('all');
  const [captainFilter, setCaptainFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDSR, setSelectedDSR] = useState<DSRRow | null>(null);
  const [dsrStock, setDsrStock] = useState<StockItem[]>([]);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [salesDatePreset, setSalesDatePreset] = useState<SalesDatePreset>('this_month');
  const [salesDateFrom, setSalesDateFrom] = useState(defaultSalesDateRange.startDate);
  const [salesDateTo, setSalesDateTo] = useState(defaultSalesDateRange.endDate);

  const salesDateRange = createSalesDateRange(salesDatePreset, salesDateFrom, salesDateTo);
  const salesDateLabel = describeSalesDateRange(salesDateRange);

  useEffect(() => { setRegionFilter('all'); setTlFilter('all'); setCaptainFilter('all'); }, [zoneFilter]);
  useEffect(() => { setTlFilter('all'); setCaptainFilter('all'); }, [regionFilter]);
  useEffect(() => { setCaptainFilter('all'); }, [tlFilter]);

  const handleSalesDatePresetChange = (preset: SalesDatePreset) => {
    const nextRange = createSalesDateRange(preset, salesDateFrom, salesDateTo);
    setSalesDatePreset(preset);
    setSalesDateFrom(nextRange.startDate);
    setSalesDateTo(nextRange.endDate);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch reference data in parallel
      const [zonesRes, regionsRes, tlsRes, captainsRes, dsrsRes] = await Promise.all([
        supabase.from('zones').select('id, name').order('name'),
        supabase.from('regions').select('id, name, zone_id').order('name'),
        supabase.from('team_leaders').select('id, name, phone, region_id').order('name'),
        supabase.from('captains').select('id, name, phone, team_leader_id').order('name'),
        supabase.from('dsrs').select('id, name, phone, captain_id, dsr_number, has_fss_account, fss_username, district, ward, street_village').order('name'),
      ]);

      const zonesList = zonesRes.data || [];
      const regionsList = regionsRes.data || [];
      const tlsList = tlsRes.data || [];
      const captainsList = captainsRes.data || [];
      const dsrsList = dsrsRes.data || [];

      setZones(zonesList);
      setAllRegions(regionsList);
      setTeamLeaders(tlsList);
      setCaptains(captainsList);

      // Build lookup maps
      const zoneMap = new Map(zonesList.map(z => [z.id, z.name]));
      const regionMap = new Map(regionsList.map(r => [r.id, r]));
      const tlMap = new Map(tlsList.map(t => [t.id, t]));
      const captainMap = new Map(captainsList.map(c => [c.id, c]));

      // Fetch sales counts per DSR for the selected period
      const [{ data: salesData }, { data: auditData }] = await Promise.all([
        supabase
          .from('sales_records')
          .select('dsr_id')
          .not('dsr_id', 'is', null)
          .gte('sale_date', salesDateRange.startDate)
          .lte('sale_date', salesDateRange.endDate),
        supabase
          .from('audits')
          .select('dsr_id, audit_date')
          .eq('audit_target_type', 'dsr')
          .gte('audit_date', salesDateRange.startDate)
          .lte('audit_date', salesDateRange.endDate),
      ]);

      // Fetch assigned stock counts per DSR
      const { data: assignedData } = await supabase
        .from('inventory')
        .select('assigned_to_id')
        .eq('assigned_to_type', 'dsr');

      // Count sales per DSR
      const salesCountMap = new Map<string, number>();
      (salesData || []).forEach(s => {
        if (s.dsr_id) salesCountMap.set(s.dsr_id, (salesCountMap.get(s.dsr_id) || 0) + 1);
      });

      // Active DSRs are those with sales in the selected period
      const activeDSRs = new Set<string>();
      (salesData || []).forEach(s => {
        if (s.dsr_id) activeDSRs.add(s.dsr_id);
      });

      // Assigned stock count per DSR
      const assignedCountMap = new Map<string, number>();
      (assignedData || []).forEach(a => {
        if (a.assigned_to_id) assignedCountMap.set(a.assigned_to_id, (assignedCountMap.get(a.assigned_to_id) || 0) + 1);
      });

      const latestAuditMap = new Map<string, string>();
      (auditData || []).forEach((audit) => {
        if (!audit.dsr_id) return;
        const current = latestAuditMap.get(audit.dsr_id);
        if (!current || audit.audit_date > current) latestAuditMap.set(audit.dsr_id, audit.audit_date);
      });

      // Build DSR rows with hierarchy
      const dsrRows: DSRRow[] = dsrsList.map(dsr => {
        const captain = dsr.captain_id ? captainMap.get(dsr.captain_id) : null;
        const tl = captain?.team_leader_id ? tlMap.get(captain.team_leader_id) : null;
        const region = tl?.region_id ? regionMap.get(tl.region_id) : null;
        const zoneName = region?.zone_id ? zoneMap.get(region.zone_id) || null : null;

        return {
          id: dsr.id,
          name: dsr.name,
          phone: dsr.phone,
          captain_id: dsr.captain_id,
          captainName: captain?.name || null,
          tlId: captain?.team_leader_id || null,
          tlName: tl?.name || null,
          zoneId: region?.zone_id || null,
          zoneName,
          regionId: tl?.region_id || null,
          regionName: region?.name || null,
          dsr_number: dsr.dsr_number ?? null,
          has_fss_account: dsr.has_fss_account ?? false,
          fss_username: dsr.fss_username ?? null,
          district: dsr.district ?? null,
          ward: dsr.ward ?? null,
          street_village: dsr.street_village ?? null,
          salesCount: salesCountMap.get(dsr.id) || 0,
          assignedCount: assignedCountMap.get(dsr.id) || 0,
          isActive: activeDSRs.has(dsr.id),
          isAudited: latestAuditMap.has(dsr.id),
          latestAuditDate: latestAuditMap.get(dsr.id) || null,
        };
      });

      setDsrs(dsrRows);
    } catch (err) {
      console.error('Error fetching DSR data:', err);
    } finally {
      setLoading(false);
    }
  }, [salesDateRange.startDate, salesDateRange.endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchDSRStock = async (dsr: DSRRow) => {
    setSelectedDSR(dsr);
    setStockDialogOpen(true);
    setStockLoading(true);
    try {
      // Get sold items from sales_records
      const { data: salesData } = await supabase
        .from('sales_records')
        .select('smartcard_number, serial_number, stock_type, sale_date, customer_name, payment_status, package_status')
        .eq('dsr_id', dsr.id)
        .gte('sale_date', salesDateRange.startDate)
        .lte('sale_date', salesDateRange.endDate)
        .order('sale_date', { ascending: false });

      // Get assigned inventory (in-hand)
      const { data: invData } = await supabase
        .from('inventory')
        .select('smartcard_number, serial_number, stock_type, status')
        .eq('assigned_to_type', 'dsr')
        .eq('assigned_to_id', dsr.id);

      const items: StockItem[] = [];

      (salesData || []).forEach(s => {
        items.push({
          smartcard_number: s.smartcard_number,
          serial_number: s.serial_number,
          stock_type: s.stock_type,
          status: 'Sold',
          sale_date: s.sale_date,
          customer_name: s.customer_name,
          payment_status: s.payment_status,
          package_status: s.package_status,
        });
      });

      (invData || []).forEach(i => {
        // Avoid duplicates with sold items
        if (!items.some(x => x.smartcard_number === i.smartcard_number)) {
          items.push({
            smartcard_number: i.smartcard_number,
            serial_number: i.serial_number,
            stock_type: i.stock_type,
            status: i.status === 'Sold' ? 'Sold' : 'In Hand',
            sale_date: null,
            customer_name: null,
            payment_status: null,
            package_status: null,
          });
        }
      });

      setDsrStock(items);
    } catch (err) {
      console.error('Error fetching DSR stock:', err);
    } finally {
      setStockLoading(false);
    }
  };

  // Filter logic
  const filteredRegions = useMemo(() => {
    if (zoneFilter === 'all') return allRegions;
    return allRegions.filter(r => r.zone_id === zoneFilter);
  }, [zoneFilter, allRegions]);

  const filteredTLs = useMemo(() => {
    let tls = teamLeaders;
    if (regionFilter !== 'all') tls = tls.filter(t => t.region_id === regionFilter);
    else if (zoneFilter !== 'all') {
      const regionIds = new Set(filteredRegions.map(r => r.id));
      tls = tls.filter(t => t.region_id && regionIds.has(t.region_id));
    }
    return tls;
  }, [zoneFilter, regionFilter, teamLeaders, filteredRegions]);

  const filteredCaptains = useMemo(() => {
    let caps = captains;
    if (tlFilter !== 'all') caps = caps.filter(c => c.team_leader_id === tlFilter);
    else {
      const tlIds = new Set(filteredTLs.map(t => t.id));
      caps = caps.filter(c => c.team_leader_id && tlIds.has(c.team_leader_id));
    }
    return caps;
  }, [tlFilter, captains, filteredTLs]);

  const filteredDSRs = useMemo(() => {
    let result = dsrs;

    if (zoneFilter !== 'all') result = result.filter(d => d.zoneId === zoneFilter);
    if (regionFilter !== 'all') result = result.filter(d => d.regionId === regionFilter);
    if (tlFilter !== 'all') result = result.filter(d => d.tlId === tlFilter);
    if (captainFilter !== 'all') result = result.filter(d => d.captain_id === captainFilter);
    if (statusFilter === 'active') result = result.filter(d => d.isActive);
    if (statusFilter === 'inactive') result = result.filter(d => !d.isActive);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.phone?.toLowerCase().includes(q) ||
        d.dsr_number?.toLowerCase().includes(q) ||
        d.tlName?.toLowerCase().includes(q) ||
        d.captainName?.toLowerCase().includes(q) ||
        d.zoneName?.toLowerCase().includes(q) ||
        d.regionName?.toLowerCase().includes(q) ||
        d.district?.toLowerCase().includes(q) ||
        d.ward?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [dsrs, zoneFilter, regionFilter, tlFilter, captainFilter, statusFilter, searchQuery]);

  const totalSales = useMemo(() => filteredDSRs.reduce((acc, d) => acc + d.salesCount, 0), [filteredDSRs]);
  const activeDSRCount = useMemo(() => filteredDSRs.filter(d => d.isActive).length, [filteredDSRs]);
  const auditedDSRCount = useMemo(() => filteredDSRs.filter(d => d.isAudited).length, [filteredDSRs]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                DSR Directory
              </span>
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-0.5">
              All Direct Sales Representatives — {salesDateLabel} sales and activity
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
              {filteredDSRs.length} DSRs
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              {activeDSRCount} Active
            </Badge>
            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
              {totalSales} Sales
            </Badge>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
              {auditedDSRCount} Audited
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <GlassCard className="p-3 md:p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs glass-input"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs glass-input"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {filteredRegions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={tlFilter} onValueChange={setTlFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs glass-input"><SelectValue placeholder="TL" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All TLs</SelectItem>
                {filteredTLs.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={captainFilter} onValueChange={setCaptainFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs glass-input"><SelectValue placeholder="Captain" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Captains</SelectItem>
                {filteredCaptains.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[110px] h-8 text-xs glass-input"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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

            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search DSR name, phone, TL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs glass-input"
              />
            </div>
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">DSR Name</TableHead>
                  <TableHead className="text-xs">D Number</TableHead>
                  <TableHead className="text-xs">Zone</TableHead>
                  <TableHead className="text-xs">Region</TableHead>
                  <TableHead className="text-xs">TL Name</TableHead>
                  <TableHead className="text-xs">Captain</TableHead>
                  <TableHead className="text-xs">Location</TableHead>
                  <TableHead className="text-xs text-center">Sales</TableHead>
                  <TableHead className="text-xs text-center">Assigned</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDSRs.length > 0 ? (
                  filteredDSRs.map((dsr) => (
                    <TableRow key={dsr.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="text-xs">
                        <div>
                          <span className="font-medium">{dsr.name}</span>
                          {dsr.phone && (
                            <span className="text-muted-foreground ml-1 text-[10px]">({dsr.phone})</span>
                          )}
                          {dsr.has_fss_account && (
                            <Badge className="text-[10px] ml-1 bg-green-500/20 text-green-500 border-green-500/30 px-1 py-0">FSS</Badge>
                          )}
                          {dsr.isAudited && (
                            <Badge className="text-[10px] ml-1 bg-amber-500/20 text-amber-500 border-amber-500/30 px-1 py-0">
                              Audited{dsr.latestAuditDate ? ` ${dsr.latestAuditDate}` : ''}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{dsr.dsr_number || '—'}</TableCell>
                      <TableCell className="text-xs">{dsr.zoneName || '—'}</TableCell>
                      <TableCell className="text-xs">{dsr.regionName || '—'}</TableCell>
                      <TableCell className="text-xs">{dsr.tlName || '—'}</TableCell>
                      <TableCell className="text-xs">{dsr.captainName || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(dsr.district || dsr.ward || dsr.street_village) ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {[dsr.district, dsr.ward, dsr.street_village].filter(Boolean).join(', ')}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                            dsr.salesCount > 0
                              ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                              : 'bg-muted text-muted-foreground'
                          }`}
                          onClick={() => fetchDSRStock(dsr)}
                        >
                          {dsr.salesCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                            dsr.assignedCount > 0
                              ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                              : 'bg-muted text-muted-foreground'
                          }`}
                          onClick={() => fetchDSRStock(dsr)}
                        >
                          {dsr.assignedCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-xs ${
                          dsr.isActive
                            ? 'bg-green-500/20 text-green-500 border-green-500/30'
                            : 'bg-red-500/20 text-red-500 border-red-500/30'
                        }`}>
                          {dsr.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      No DSRs found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </GlassCard>

        {/* Stock/Sales Dialog */}
        <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
          <DialogContent className="glass-card max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                {selectedDSR?.name} — Stock & Sales
              </DialogTitle>
              <DialogDescription>
                {salesDateLabel} • {dsrStock.filter(s => s.status === 'Sold').length} sold • {dsrStock.filter(s => s.status === 'In Hand').length} in hand
              </DialogDescription>
            </DialogHeader>

            {stockLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : dsrStock.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Smartcard</TableHead>
                      <TableHead className="text-xs">Serial</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Sale Date</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs">Payment</TableHead>
                      <TableHead className="text-xs">Package</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dsrStock.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-mono">{item.smartcard_number}</TableCell>
                        <TableCell className="text-xs font-mono">{item.serial_number}</TableCell>
                        <TableCell className="text-xs">{item.stock_type}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${
                            item.status === 'Sold'
                              ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                              : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                          }`}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{item.sale_date || '—'}</TableCell>
                        <TableCell className="text-xs">{item.customer_name || '—'}</TableCell>
                        <TableCell>
                          {item.payment_status ? (
                            <Badge className={`text-xs ${
                              item.payment_status === 'Paid'
                                ? 'bg-green-500/20 text-green-500 border-green-500/30'
                                : 'bg-red-500/20 text-red-500 border-red-500/30'
                            }`}>
                              {item.payment_status}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {item.package_status ? (
                            <Badge className={`text-xs ${
                              item.package_status === 'Packaged'
                                ? 'bg-purple-500/20 text-purple-500 border-purple-500/30'
                                : 'bg-pink-500/20 text-pink-500 border-pink-500/30'
                            }`}>
                              {item.package_status === 'Packaged' ? '✓ Packaged' : 'No Package'}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No stock or sales found for this DSR
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PublicLayout>
  );
}
