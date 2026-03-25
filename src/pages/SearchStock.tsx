import { useState } from 'react';
import { 
  Search, 
  Package, 
  User, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin,
  Users,
  Shield,
  UserPlus,
  CreditCard,
  Box,
  Filter,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelJS from 'exceljs';

interface SearchResult {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  sale_date?: string;
  customer_name?: string;
  notes?: string;
  assigned_to_type?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  team_leader?: { name: string } | null;
  captain?: { name: string } | null;
  dsr?: { name: string } | null;
  zone?: { name: string } | null;
  region?: { name: string } | null;
  created_at: string;
  source: 'inventory' | 'sale';
}

interface FilterOptions {
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  zone: string;
  region: string;
}

export default function SearchStock() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'smartcard' | 'serial' | 'person'>('smartcard');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    stock_type: 'all',
    status: 'all',
    payment_status: 'all',
    package_status: 'all',
    zone: 'all',
    region: 'all',
  });
  const [zones, setZones] = useState<Array<{id: string, name: string}>>([]);
  const [regions, setRegions] = useState<Array<{id: string, name: string}>>([]);

  const loadZonesAndRegions = async () => {
    try {
      const [zoneRes, regionRes] = await Promise.all([
        supabase.from('zones').select('id, name').order('name'),
        supabase.from('regions').select('id, name').order('name')
      ]);
      
      if (zoneRes.data) setZones(zoneRes.data);
      if (regionRes.data) setRegions(regionRes.data);
    } catch (error) {
      console.error('Error loading zones/regions:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    await loadZonesAndRegions();

    try {
      let data: SearchResult[] = [];

      if (searchType === 'smartcard' || searchType === 'serial') {
        // Search in inventory
        const { data: inventoryData } = await supabase
          .from('inventory')
          .select(`
            id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at,
            assigned_to_type, assigned_to_id,
            zones:zone_id(id, name),
            regions:region_id(id, name)
          `)
          .ilike(searchType === 'smartcard' ? 'smartcard_number' : 'serial_number', `%${searchQuery}%`)
          .limit(100);

        // Fetch assigned person names for inventory items
        const inventoryWithNames = await Promise.all((inventoryData || []).map(async (item: any) => {
          let assigned_to_name = null;
          if (item.assigned_to_id && item.assigned_to_type) {
            const table = item.assigned_to_type === 'team_leader' ? 'team_leaders' 
              : item.assigned_to_type === 'captain' ? 'captains' : 'dsrs';
            const { data: personData } = await supabase
              .from(table)
              .select('name')
              .eq('id', item.assigned_to_id)
              .single();
            assigned_to_name = personData?.name || null;
          }
          return { ...item, assigned_to_name };
        }));

        // Search in sales
        const { data: salesData } = await supabase
          .from('sales_records')
          .select(`
            id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at,
            team_leaders:team_leader_id(name),
            captains:captain_id(name),
            dsrs:dsr_id(name),
            zones:zone_id(id, name),
            regions:region_id(id, name)
          `)
          .ilike(searchType === 'smartcard' ? 'smartcard_number' : 'serial_number', `%${searchQuery}%`)
          .limit(100);

        // Process inventory data
        const inventoryResults = inventoryWithNames.map((item: any) => ({
          id: item.id,
          smartcard_number: item.smartcard_number,
          serial_number: item.serial_number,
          stock_type: item.stock_type,
          status: item.status,
          payment_status: item.payment_status,
          package_status: item.package_status,
          notes: item.notes,
          zone: item.zones,
          region: item.regions,
          assigned_to_type: item.assigned_to_type,
          assigned_to_id: item.assigned_to_id,
          assigned_to_name: item.assigned_to_name,
          team_leader: item.assigned_to_type === 'team_leader' && item.assigned_to_name ? { name: item.assigned_to_name } : null,
          captain: item.assigned_to_type === 'captain' && item.assigned_to_name ? { name: item.assigned_to_name } : null,
          dsr: item.assigned_to_type === 'dsr' && item.assigned_to_name ? { name: item.assigned_to_name } : null,
          created_at: item.created_at,
          source: 'inventory' as const
        }));

        // Process sales data
        const salesResults = (salesData || []).map((item: any) => ({
          id: item.id,
          smartcard_number: item.smartcard_number,
          serial_number: item.serial_number,
          stock_type: item.stock_type,
          status: 'sold',
          payment_status: item.payment_status,
          package_status: item.package_status,
          sale_date: item.sale_date,
          customer_name: item.customer_name,
          notes: item.notes,
          zone: item.zones,
          region: item.regions,
          team_leader: item.team_leaders,
          captain: item.captains,
          dsr: item.dsrs,
          created_at: item.created_at,
          source: 'sale' as const
        }));

        data = [...inventoryResults, ...salesResults];
      } else {
        // Search by person name
        const [tlData, captainData, dsrData] = await Promise.all([
          supabase.from('team_leaders').select('id, name').ilike('name', `%${searchQuery}%`),
          supabase.from('captains').select('id, name').ilike('name', `%${searchQuery}%`),
          supabase.from('dsrs').select('id, name').ilike('name', `%${searchQuery}%`)
        ]);

        const tlIds = tlData.data?.map(t => t.id) || [];
        const captainIds = captainData.data?.map(c => c.id) || [];
        const dsrIds = dsrData.data?.map(d => d.id) || [];

        // Map IDs to names for lookup
        const tlNames = Object.fromEntries(tlData.data?.map(t => [t.id, t.name]) || []);
        const captainNames = Object.fromEntries(captainData.data?.map(c => [c.id, c.name]) || []);
        const dsrNames = Object.fromEntries(dsrData.data?.map(d => [d.id, d.name]) || []);

        if (tlIds.length || captainIds.length || dsrIds.length) {
          // Search sales by person
          let salesPromises = [];
          if (tlIds.length) {
            salesPromises.push(
              supabase.from('sales_records')
                .select(`id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at, team_leader_id, captain_id, dsr_id, zones:zone_id(id, name), regions:region_id(id, name)`)
                .in('team_leader_id', tlIds)
                .limit(50)
            );
          }
          if (captainIds.length) {
            salesPromises.push(
              supabase.from('sales_records')
                .select(`id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at, team_leader_id, captain_id, dsr_id, zones:zone_id(id, name), regions:region_id(id, name)`)
                .in('captain_id', captainIds)
                .limit(50)
            );
          }
          if (dsrIds.length) {
            salesPromises.push(
              supabase.from('sales_records')
                .select(`id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at, team_leader_id, captain_id, dsr_id, zones:zone_id(id, name), regions:region_id(id, name)`)
                .in('dsr_id', dsrIds)
                .limit(50)
            );
          }

          // Search inventory by person - separate queries for each type
          let inventoryPromises = [];
          if (tlIds.length) {
            inventoryPromises.push(
              supabase.from('inventory')
                .select(`id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at, assigned_to_type, assigned_to_id, zones:zone_id(id, name), regions:region_id(id, name)`)
                .in('assigned_to_id', tlIds)
                .eq('assigned_to_type', 'team_leader')
                .limit(50)
            );
          }
          if (captainIds.length) {
            inventoryPromises.push(
              supabase.from('inventory')
                .select(`id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at, assigned_to_type, assigned_to_id, zones:zone_id(id, name), regions:region_id(id, name)`)
                .in('assigned_to_id', captainIds)
                .eq('assigned_to_type', 'captain')
                .limit(50)
            );
          }
          if (dsrIds.length) {
            inventoryPromises.push(
              supabase.from('inventory')
                .select(`id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at, assigned_to_type, assigned_to_id, zones:zone_id(id, name), regions:region_id(id, name)`)
                .in('assigned_to_id', dsrIds)
                .eq('assigned_to_type', 'dsr')
                .limit(50)
            );
          }

          const salesResults = await Promise.all(salesPromises);
          const inventoryResults = await Promise.all(inventoryPromises);

          // Flatten and dedupe sales
          const allSalesData = salesResults.flatMap(r => r.data || []);
          const uniqueSales = Array.from(new Map(allSalesData.map(s => [s.id, s])).values());

          // Flatten and dedupe inventory
          const allInventoryData = inventoryResults.flatMap(r => r.data || []);
          const uniqueInventory = Array.from(new Map(allInventoryData.map(i => [i.id, i])).values());

          const salesFormatted = uniqueSales.map((item: any) => ({
            id: item.id,
            smartcard_number: item.smartcard_number,
            serial_number: item.serial_number,
            stock_type: item.stock_type,
            status: 'sold',
            payment_status: item.payment_status,
            package_status: item.package_status,
            sale_date: item.sale_date,
            customer_name: item.customer_name,
            notes: item.notes,
            zone: item.zones,
            region: item.regions,
            team_leader: item.team_leader_id ? { name: tlNames[item.team_leader_id] || 'Unknown' } : null,
            captain: item.captain_id ? { name: captainNames[item.captain_id] || 'Unknown' } : null,
            dsr: item.dsr_id ? { name: dsrNames[item.dsr_id] || 'Unknown' } : null,
            created_at: item.created_at,
            source: 'sale' as const
          }));

          const inventoryFormatted = uniqueInventory.map((item: any) => {
            let assigned_to_name = null;
            if (item.assigned_to_type === 'team_leader') assigned_to_name = tlNames[item.assigned_to_id];
            else if (item.assigned_to_type === 'captain') assigned_to_name = captainNames[item.assigned_to_id];
            else if (item.assigned_to_type === 'dsr') assigned_to_name = dsrNames[item.assigned_to_id];
            
            return {
              id: item.id,
              smartcard_number: item.smartcard_number,
              serial_number: item.serial_number,
              stock_type: item.stock_type,
              status: item.status,
              payment_status: item.payment_status,
              package_status: item.package_status,
              notes: item.notes,
              zone: item.zones,
              region: item.regions,
              assigned_to_type: item.assigned_to_type,
              assigned_to_id: item.assigned_to_id,
              assigned_to_name,
              team_leader: item.assigned_to_type === 'team_leader' && assigned_to_name ? { name: assigned_to_name } : null,
              captain: item.assigned_to_type === 'captain' && assigned_to_name ? { name: assigned_to_name } : null,
              dsr: item.assigned_to_type === 'dsr' && assigned_to_name ? { name: assigned_to_name } : null,
              created_at: item.created_at,
              source: 'inventory' as const
            };
          });

          data = [...salesFormatted, ...inventoryFormatted];
        }
      }

      setResults(data);
      setFilteredResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = results;

    if (filters.stock_type !== 'all') {
      filtered = filtered.filter(item => item.stock_type === filters.stock_type);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }

    if (filters.payment_status !== 'all') {
      filtered = filtered.filter(item => item.payment_status === filters.payment_status);
    }

    if (filters.package_status !== 'all') {
      filtered = filtered.filter(item => item.package_status === filters.package_status);
    }

    if (filters.zone !== 'all') {
      filtered = filtered.filter(item => item.zone?.name === filters.zone);
    }

    if (filters.region !== 'all') {
      filtered = filtered.filter(item => item.region?.name === filters.region);
    }

    setFilteredResults(filtered);
  };

  const resetFilters = () => {
    setFilters({
      stock_type: 'all',
      status: 'all',
      payment_status: 'all',
      package_status: 'all',
      zone: 'all',
      region: 'all',
    });
    setFilteredResults(results);
  };

  const handleExport = async () => {
    const exportData = filteredResults.map(item => ({
      'Smartcard Number': item.smartcard_number,
      'Serial Number': item.serial_number,
      'Stock Type': item.stock_type,
      'Status': item.status === 'available' && !item.assigned_to_name ? 'Available - Not Assigned' : item.status,
      'Payment Status': item.payment_status,
      'Package Status': item.package_status,
      'Assigned To Type': item.assigned_to_type || (item.status === 'available' ? 'Not Assigned' : '-'),
      'Assigned To': item.assigned_to_name || item.team_leader?.name || item.captain?.name || item.dsr?.name || (item.status === 'available' ? 'Not Assigned' : '-'),
      'Zone': item.zone?.name || '-',
      'Region': item.region?.name || '-',
      'Team Leader': item.team_leader?.name || '-',
      'Captain': item.captain?.name || '-',
      'DSR': item.dsr?.name || '-',
      'Customer Name': item.customer_name || '-',
      'Sale Date': item.sale_date || '-',
      'Notes': item.notes || '-',
      'Source': item.source,
      'Last Updated': new Date(item.created_at).toLocaleString()
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Search Results');
    
    if (exportData.length > 0) {
      worksheet.columns = Object.keys(exportData[0]).map(key => ({ header: key, key }));
      worksheet.addRows(exportData);
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock_search_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Available
        </Badge>;
      case 'assigned':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
          <Users className="h-3 w-3 mr-1" /> Assigned
        </Badge>;
      case 'sold':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
          <CreditCard className="h-3 w-3 mr-1" /> Sold
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    return status === 'Paid' 
      ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />Paid
        </Badge>
      : <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
          <Clock className="h-3 w-3 mr-1" />Unpaid
        </Badge>;
  };

  const getPackageBadge = (status: string) => {
    return status === 'Packaged'
      ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          <Package className="h-3 w-3 mr-1" />Packaged
        </Badge>
      : <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
          <XCircle className="h-3 w-3 mr-1" />No Package
        </Badge>;
  };

  const getSourceBadge = (source: string) => {
    return source === 'inventory'
      ? <Badge variant="outline" className="border-blue-500/30 text-blue-500">
          <Package className="h-3 w-3 mr-1" />Inventory
        </Badge>
      : <Badge variant="outline" className="border-amber-500/30 text-amber-500">
          <CreditCard className="h-3 w-3 mr-1" />Sale
        </Badge>;
  };

  const getTeamBadge = (type: 'tl' | 'captain' | 'dsr', name: string) => {
    const config = {
      tl: { icon: Shield, className: 'bg-purple-500/20 text-purple-500 border-purple-500/30' },
      captain: { icon: UserPlus, className: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
      dsr: { icon: User, className: 'bg-green-500/20 text-green-500 border-green-500/30' }
    };
    
    const { icon: Icon, className } = config[type];
    
    return (
      <Badge className={`${className} text-xs flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {type === 'tl' ? 'TL: ' : type === 'captain' ? 'Captain: ' : 'DSR: '}
        {name}
      </Badge>
    );
  };

  return (
    <PublicLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Search Stock & Sales
              </span>
            </h1>
            <p className="text-muted-foreground">
              Find inventory and sales records with detailed information
            </p>
          </div>
          {filteredResults.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export Results ({filteredResults.length})
            </Button>
          )}
        </div>

        {/* Search Form */}
        <GlassCard>
          <form onSubmit={handleSearch} className="space-y-4">
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as any)}>
              <TabsList className="grid w-full grid-cols-3 glass-card text-xs md:text-sm">
                <TabsTrigger value="smartcard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Package className="h-4 w-4 mr-2" />
                  Smartcard
                </TabsTrigger>
                <TabsTrigger value="serial" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Box className="h-4 w-4 mr-2" />
                  Serial Number
                </TabsTrigger>
                <TabsTrigger value="person" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <User className="h-4 w-4 mr-2" />
                  Person
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={
                    searchType === 'smartcard' 
                      ? 'Enter smartcard number (e.g., 8212345678)...'
                      : searchType === 'serial'
                      ? 'Enter serial number (e.g., S07512345678)...'
                      : 'Enter team leader, captain, or DSR name...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 input-glass h-12"
                />
              </div>
              <Button type="submit" className="btn-primary-gradient h-12 px-8" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </form>
        </GlassCard>

        {/* Filters */}
        {hasSearched && results.length > 0 && (
          <GlassCard>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Filter Results
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={applyFilters}>
                  Apply Filters
                </Button>
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear Filters
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Stock Type</label>
                <Select
                  value={filters.stock_type}
                  onValueChange={(v) => setFilters({...filters, stock_type: v})}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Full Set">Full Set</SelectItem>
                    <SelectItem value="Decoder Only">Decoder Only</SelectItem>
                    <SelectItem value="Remote Only">Remote Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select
                  value={filters.status}
                  onValueChange={(v) => setFilters({...filters, status: v})}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Status</label>
                <Select
                  value={filters.payment_status}
                  onValueChange={(v) => setFilters({...filters, payment_status: v})}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="All Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Package Status</label>
                <Select
                  value={filters.package_status}
                  onValueChange={(v) => setFilters({...filters, package_status: v})}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="All Package Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Packaged">Packaged</SelectItem>
                    <SelectItem value="No Package">No Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Zone</label>
                <Select
                  value={filters.zone}
                  onValueChange={(v) => setFilters({...filters, zone: v})}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="All Zones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Zones</SelectItem>
                    {zones.map(zone => (
                      <SelectItem key={zone.id} value={zone.name}>{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Region</label>
                <Select
                  value={filters.region}
                  onValueChange={(v) => setFilters({...filters, region: v})}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions.map(region => (
                      <SelectItem key={region.id} value={region.name}>{region.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">
                {filteredResults.length} Result{filteredResults.length !== 1 ? 's' : ''} Found
                {results.length !== filteredResults.length && (
                  <span className="text-sm text-muted-foreground font-normal ml-2">
                    (filtered from {results.length})
                  </span>
                )}
              </h2>
            </div>

            {filteredResults.length === 0 ? (
              <GlassCard className="text-center py-12">
                <Search className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-4">
                  {results.length === 0 
                    ? "No records found matching your search"
                    : "No records match your filters. Try different filter options."
                  }
                </p>
              </GlassCard>
            ) : (
              <div className="grid gap-4">
                {filteredResults.map((item) => (
                  <GlassCard key={`${item.source}-${item.id}`} className="hover:shadow-lg transition-shadow">
                    {/* Card Header */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xl font-bold text-primary">
                              {item.smartcard_number}
                            </span>
                            {getStatusBadge(item.status)}
                            {getSourceBadge(item.source)}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Box className="h-4 w-4" />
                            <span className="font-mono">{item.serial_number}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            <span>{item.stock_type}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {item.payment_status && getPaymentBadge(item.payment_status)}
                        {item.package_status && getPackageBadge(item.package_status)}
                      </div>
                    </div>

                    {/* Location Information */}
                    {(item.zone || item.region) && (
                      <div className="mb-4 p-3 bg-primary/5 rounded-lg">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Location Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {item.zone && (
                            <div>
                              <div className="text-xs text-muted-foreground">Zone</div>
                              <div className="font-medium">{item.zone.name}</div>
                            </div>
                          )}
                          {item.region && (
                            <div>
                              <div className="text-xs text-muted-foreground">Region</div>
                              <div className="font-medium">{item.region.name}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stock Assignment (for inventory) */}
                    {item.source === 'inventory' && item.assigned_to_name && item.assigned_to_type && (
                      <div className="mb-4 p-3 bg-blue-500/5 rounded-lg">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Assigned To
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {item.assigned_to_type === 'team_leader' && getTeamBadge('tl', item.assigned_to_name)}
                          {item.assigned_to_type === 'captain' && getTeamBadge('captain', item.assigned_to_name)}
                          {item.assigned_to_type === 'dsr' && getTeamBadge('dsr', item.assigned_to_name)}
                        </div>
                      </div>
                    )}

                    {/* Not Assigned (for available inventory) */}
                    {item.source === 'inventory' && item.status === 'available' && !item.assigned_to_name && (
                      <div className="mb-4 p-3 bg-gray-500/5 rounded-lg border border-dashed border-gray-300">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          Stock Status
                        </h4>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Available - Not Assigned
                          </Badge>
                          <span className="text-sm text-muted-foreground">This stock is in warehouse, ready to be assigned</span>
                        </div>
                      </div>
                    )}

                    {/* Team Assignment (for sales) */}
                    {item.source === 'sale' && (item.team_leader || item.captain || item.dsr) && (
                      <div className="mb-4 p-3 bg-secondary/5 rounded-lg">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Team Assignment
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {item.team_leader && getTeamBadge('tl', item.team_leader.name)}
                          {item.captain && getTeamBadge('captain', item.captain.name)}
                          {item.dsr && getTeamBadge('dsr', item.dsr.name)}
                        </div>
                      </div>
                    )}

                    {/* Sale Information */}
                    {item.source === 'sale' && (
                      <div className="mb-4 p-3 bg-green-500/5 rounded-lg">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Sale Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {item.sale_date && (
                            <div>
                              <div className="text-xs text-muted-foreground">Sale Date</div>
                              <div className="font-medium flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {new Date(item.sale_date).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                            </div>
                          )}
                          {item.customer_name && (
                            <div>
                              <div className="text-xs text-muted-foreground">Customer</div>
                              <div className="font-medium flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {item.customer_name}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {item.notes && (
                      <div className="p-3 bg-muted/10 rounded-lg">
                        <h4 className="text-sm font-medium mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{item.notes}</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
                      <div>
                        Last Updated: {new Date(item.created_at).toLocaleDateString()} at{' '}
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-right">
                        Record Type: <span className="font-medium">{item.source === 'inventory' ? 'Inventory' : 'Sale'}</span>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}