import { useEffect, useState, useMemo } from 'react';
import { Package, Search, Filter, Plus, X, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Zone { id: string; name: string; }
interface Region { id: string; name: string; zone_id: string; }
interface TeamLeader { id: string; name: string; region_id: string; }
interface Captain { id: string; name: string; team_leader_id: string; }
interface DSR { id: string; name: string; captain_id: string; }

interface StockItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  notes: string | null;
  created_at: string;
  zone_name: string | null;
  region_name: string | null;
  tl_name: string | null;
  captain_name: string | null;
  dsr_name: string | null;
  assigned_to_type: string | null;
  customer_name: string | null;
  sale_date: string | null;
  source: 'inventory' | 'sale';
  zone_id: string | null;
  region_id: string | null;
  tl_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
}

export default function UnassignedPage() {
  const navigate = useNavigate();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);

  // Filter states
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [tlFilter, setTlFilter] = useState('all');
  const [captainFilter, setCaptainFilter] = useState('all');
  const [dsrFilter, setDsrFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Lookup data
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  // Reset dependent filters when parent changes
  useEffect(() => { setRegionFilter('all'); setTlFilter('all'); setCaptainFilter('all'); setDsrFilter('all'); }, [zoneFilter]);
  useEffect(() => { setTlFilter('all'); setCaptainFilter('all'); setDsrFilter('all'); }, [regionFilter]);
  useEffect(() => { setCaptainFilter('all'); setDsrFilter('all'); }, [tlFilter]);
  useEffect(() => { setDsrFilter('all'); }, [captainFilter]);

  const fetchData = async () => {
    try {
      const [zonesRes, regionsRes, tlRes, captainsRes, dsrsRes, inventoryRes, salesRes] = await Promise.all([
        supabase.from('zones').select('id, name').order('name'),
        supabase.from('regions').select('id, name, zone_id').order('name'),
        supabase.from('team_leaders').select('id, name, region_id').order('name'),
        supabase.from('captains').select('id, name, team_leader_id').order('name'),
        supabase.from('dsrs').select('id, name, captain_id').order('name'),
        supabase.from('inventory').select(`
          id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at,
          assigned_to_type, assigned_to_id,
          zones:zone_id(id, name),
          regions:region_id(id, name)
        `).order('created_at', { ascending: false }),
        supabase.from('sales_records').select(`
          id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at,
          team_leaders:team_leader_id(id, name),
          captains:captain_id(id, name),
          dsrs:dsr_id(id, name),
          zones:zone_id(id, name),
          regions:region_id(id, name)
        `).order('created_at', { ascending: false }),
      ]);

      setZones(zonesRes.data || []);
      setRegions(regionsRes.data || []);
      setTeamLeaders(tlRes.data || []);
      setCaptains(captainsRes.data || []);
      setDsrs(dsrsRes.data || []);

      const allZones = zonesRes.data || [];
      const allRegions = regionsRes.data || [];
      const allTLs = tlRes.data || [];
      const allCaptains = captainsRes.data || [];
      const allDSRs = dsrsRes.data || [];

      // Build lookup maps
      const tlMap = new Map(allTLs.map(t => [t.id, t]));
      const captainMap = new Map(allCaptains.map(c => [c.id, c]));
      const dsrMap = new Map(allDSRs.map(d => [d.id, d]));
      const regionMap = new Map(allRegions.map(r => [r.id, r]));
      const zoneMap = new Map(allZones.map(z => [z.id, z]));

      // Process inventory items - resolve full hierarchy
      const inventoryItems: StockItem[] = (inventoryRes.data || []).map((item: any) => {
        const zoneData = item.zones as any;
        const regionData = item.regions as any;
        let tl_name: string | null = null;
        let captain_name: string | null = null;
        let dsr_name: string | null = null;
        let tl_id: string | null = null;
        let captain_id: string | null = null;
        let dsr_id: string | null = null;

        if (item.assigned_to_id && item.assigned_to_type) {
          if (item.assigned_to_type === 'team_leader') {
            const tl = tlMap.get(item.assigned_to_id);
            tl_name = tl?.name || null;
            tl_id = item.assigned_to_id;
          } else if (item.assigned_to_type === 'captain') {
            const cap = captainMap.get(item.assigned_to_id);
            captain_name = cap?.name || null;
            captain_id = item.assigned_to_id;
            if (cap?.team_leader_id) {
              const tl = tlMap.get(cap.team_leader_id);
              tl_name = tl?.name || null;
              tl_id = cap.team_leader_id;
            }
          } else if (item.assigned_to_type === 'dsr') {
            const d = dsrMap.get(item.assigned_to_id);
            dsr_name = d?.name || null;
            dsr_id = item.assigned_to_id;
            if (d?.captain_id) {
              const cap = captainMap.get(d.captain_id);
              captain_name = cap?.name || null;
              captain_id = d.captain_id;
              if (cap?.team_leader_id) {
                const tl = tlMap.get(cap.team_leader_id);
                tl_name = tl?.name || null;
                tl_id = cap.team_leader_id;
              }
            }
          }
        }

        return {
          id: item.id,
          smartcard_number: item.smartcard_number,
          serial_number: item.serial_number,
          stock_type: item.stock_type,
          status: item.status === 'sold' ? 'Sold' : item.status === 'assigned' ? 'In-hand' : 'In Warehouse',
          payment_status: item.payment_status || 'Unpaid',
          package_status: item.package_status || 'No Package',
          notes: item.notes,
          created_at: item.created_at,
          zone_name: zoneData?.name || null,
          region_name: regionData?.name || null,
          tl_name, captain_name, dsr_name,
          assigned_to_type: item.assigned_to_type,
          customer_name: null,
          sale_date: null,
          source: 'inventory' as const,
          zone_id: zoneData?.id || null,
          region_id: regionData?.id || null,
          tl_id, captain_id, dsr_id,
        };
      });

      // Process sales items
      const salesItems: StockItem[] = (salesRes.data || []).map((item: any) => {
        const zoneData = item.zones as any;
        const regionData = item.regions as any;
        const tlData = item.team_leaders as any;
        const capData = item.captains as any;
        const dsrData = item.dsrs as any;

        // Resolve parent chain for sales TL
        let tl_name = tlData?.name || null;
        let tl_id = tlData?.id || null;
        const captain_name = capData?.name || null;
        const captain_id_val = capData?.id || null;
        const dsr_name = dsrData?.name || null;
        const dsr_id_val = dsrData?.id || null;

        // If captain set but TL not, resolve TL from captain
        if (!tl_name && captain_id_val) {
          const cap = captainMap.get(captain_id_val);
          if (cap?.team_leader_id) {
            const tl = tlMap.get(cap.team_leader_id);
            tl_name = tl?.name || null;
            tl_id = cap.team_leader_id;
          }
        }

        return {
          id: item.id,
          smartcard_number: item.smartcard_number,
          serial_number: item.serial_number,
          stock_type: item.stock_type,
          status: 'Sold',
          payment_status: item.payment_status || 'Unpaid',
          package_status: item.package_status || 'No Package',
          notes: item.notes,
          created_at: item.created_at,
          zone_name: zoneData?.name || null,
          region_name: regionData?.name || null,
          tl_name, captain_name, dsr_name,
          assigned_to_type: null,
          customer_name: item.customer_name,
          sale_date: item.sale_date,
          source: 'sale' as const,
          zone_id: zoneData?.id || null,
          region_id: regionData?.id || null,
          tl_id, captain_id: captain_id_val, dsr_id: dsr_id_val,
        };
      });

      // Merge: deduplicate by smartcard - sales take priority over inventory "sold"
      const salesSmartcards = new Set(salesItems.map(s => s.smartcard_number));
      const merged = [
        ...inventoryItems.filter(i => !(i.status === 'Sold' && salesSmartcards.has(i.smartcard_number))),
        ...salesItems,
      ];
      setStockItems(merged);
    } catch (error) {
      console.error('Error fetching stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter options based on parent selection
  const filteredRegions = useMemo(() =>
    zoneFilter === 'all' ? regions : regions.filter(r => r.zone_id === zoneFilter),
  [regions, zoneFilter]);

  const filteredTLs = useMemo(() =>
    regionFilter === 'all' ? teamLeaders : teamLeaders.filter(t => t.region_id === regionFilter),
  [teamLeaders, regionFilter]);

  const filteredCaptains = useMemo(() =>
    tlFilter === 'all' ? captains : captains.filter(c => c.team_leader_id === tlFilter),
  [captains, tlFilter]);

  const filteredDSRs = useMemo(() =>
    captainFilter === 'all' ? dsrs : dsrs.filter(d => d.captain_id === captainFilter),
  [dsrs, captainFilter]);

  // Apply all filters
  const filteredItems = useMemo(() => {
    let items = stockItems;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.smartcard_number.toLowerCase().includes(q) ||
        i.serial_number.toLowerCase().includes(q) ||
        i.tl_name?.toLowerCase().includes(q) ||
        i.captain_name?.toLowerCase().includes(q) ||
        i.dsr_name?.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q)
      );
    }
    if (zoneFilter !== 'all') items = items.filter(i => i.zone_id === zoneFilter);
    if (regionFilter !== 'all') items = items.filter(i => i.region_id === regionFilter);
    if (tlFilter !== 'all') items = items.filter(i => i.tl_id === tlFilter);
    if (captainFilter !== 'all') items = items.filter(i => i.captain_id === captainFilter);
    if (dsrFilter !== 'all') items = items.filter(i => i.dsr_id === dsrFilter);
    if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
    if (paymentFilter !== 'all') items = items.filter(i => i.payment_status === paymentFilter);

    return items;
  }, [stockItems, searchQuery, zoneFilter, regionFilter, tlFilter, captainFilter, dsrFilter, statusFilter, paymentFilter]);

  const hasActiveFilters = zoneFilter !== 'all' || regionFilter !== 'all' || tlFilter !== 'all' ||
    captainFilter !== 'all' || dsrFilter !== 'all' || statusFilter !== 'all' || paymentFilter !== 'all';

  const clearFilters = () => {
    setZoneFilter('all'); setRegionFilter('all'); setTlFilter('all');
    setCaptainFilter('all'); setDsrFilter('all'); setStatusFilter('all'); setPaymentFilter('all');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Sold': return <Badge className="badge-destructive">Sold</Badge>;
      case 'In-hand': return <Badge className="badge-warning">In-hand</Badge>;
      default: return <Badge className="badge-blue">In Warehouse</Badge>;
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Stock Overview
              </span>
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-0.5">
              {filteredItems.length} of {stockItems.length} items
            </p>
          </div>
          <Button onClick={() => navigate('/add-sale')} className="self-start">
            <Plus className="h-4 w-4 mr-2" />
            Add Sale
          </Button>
        </div>

        {/* Search + Filters */}
        <GlassCard className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search smartcard, serial, TL, captain, DSR, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-glass"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {filteredRegions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tlFilter} onValueChange={setTlFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="TL" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All TLs</SelectItem>
                {filteredTLs.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={captainFilter} onValueChange={setCaptainFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="Captain" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Captains</SelectItem>
                {filteredCaptains.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dsrFilter} onValueChange={setDsrFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="DSR" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All DSRs</SelectItem>
                {filteredDSRs.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="In Warehouse">In Warehouse</SelectItem>
                <SelectItem value="In-hand">In-hand</SelectItem>
                <SelectItem value="Sold">Sold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs glass-input"><SelectValue placeholder="Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
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
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">No stock items found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Smartcard</TableHead>
                    <TableHead>SN</TableHead>
                    <TableHead className="hidden md:table-cell">Zone</TableHead>
                    <TableHead className="hidden md:table-cell">Region</TableHead>
                    <TableHead>TL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow
                      key={`${item.source}-${item.id}`}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <TableCell className="font-mono font-medium text-xs md:text-sm">
                        {item.smartcard_number}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.serial_number}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {item.zone_name || '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {item.region_name || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.tl_name || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Smartcard</div>
                <div className="font-mono font-medium">{selectedItem.smartcard_number}</div>
                <div className="text-muted-foreground">Serial Number</div>
                <div className="font-mono">{selectedItem.serial_number}</div>
                <div className="text-muted-foreground">Type</div>
                <div><Badge variant="outline">{selectedItem.stock_type}</Badge></div>
                <div className="text-muted-foreground">Status</div>
                <div>{getStatusBadge(selectedItem.status)}</div>
                <div className="text-muted-foreground">Payment</div>
                <div>
                  <Badge className={selectedItem.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}>
                    {selectedItem.payment_status}
                  </Badge>
                </div>
                <div className="text-muted-foreground">Package</div>
                <div>
                  <Badge className={selectedItem.package_status === 'Packaged' ? 'badge-success' : 'badge-destructive'}>
                    {selectedItem.package_status}
                  </Badge>
                </div>
              </div>
              <div className="border-t pt-3 grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Zone</div>
                <div>{selectedItem.zone_name || '-'}</div>
                <div className="text-muted-foreground">Region</div>
                <div>{selectedItem.region_name || '-'}</div>
                <div className="text-muted-foreground">Team Leader</div>
                <div>{selectedItem.tl_name || '-'}</div>
                <div className="text-muted-foreground">Captain</div>
                <div>{selectedItem.captain_name || '-'}</div>
                <div className="text-muted-foreground">DSR</div>
                <div>{selectedItem.dsr_name || '-'}</div>
              </div>
              {(selectedItem.customer_name || selectedItem.sale_date || selectedItem.notes) && (
                <div className="border-t pt-3 grid grid-cols-2 gap-2">
                  {selectedItem.customer_name && (
                    <>
                      <div className="text-muted-foreground">Customer</div>
                      <div>{selectedItem.customer_name}</div>
                    </>
                  )}
                  {selectedItem.sale_date && (
                    <>
                      <div className="text-muted-foreground">Sale Date</div>
                      <div>{new Date(selectedItem.sale_date).toLocaleDateString()}</div>
                    </>
                  )}
                  {selectedItem.notes && (
                    <>
                      <div className="text-muted-foreground">Notes</div>
                      <div className="col-span-2 bg-muted/50 rounded p-2 text-xs">{selectedItem.notes}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}
