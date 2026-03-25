import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Package,
  User,
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
  Download,
  RefreshCw,
  Edit,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
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
  zone?: { name: string; id?: string } | null;
  region?: { name: string; id?: string } | null;
  zone_id?: string | null;
  region_id?: string | null;
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

interface TeamMember {
  id: string;
  name: string;
}

interface InventoryRow {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  assigned_to_name?: string | null;
  zone_id: string | null;
  region_id: string | null;
  notes: string | null;
  created_at: string;
  zones: { id: string; name: string } | null;
  regions: { id: string; name: string } | null;
}

interface SalesRow {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  payment_status: string;
  package_status: string;
  sale_date: string;
  customer_name: string | null;
  notes: string | null;
  zone_id: string | null;
  region_id: string | null;
  team_leader_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
  created_at: string;
  zones: { id: string; name: string } | null;
  regions: { id: string; name: string } | null;
  team_leaders: { name: string } | null;
  captains: { name: string } | null;
  dsrs: { name: string } | null;
}

export default function AdminSearchPage() {
  const { toast } = useToast();
  const { isRegionalAdmin, assignedRegionIds } = useAuth();
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
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);

  // Assignment data
  const [assignType, setAssignType] = useState<'team_leader' | 'captain' | 'dsr'>('team_leader');
  const [assignToId, setAssignToId] = useState<string>('');
  const [teamLeaders, setTeamLeaders] = useState<TeamMember[]>([]);
  const [captains, setCaptains] = useState<TeamMember[]>([]);
  const [dsrs, setDsrs] = useState<TeamMember[]>([]);

  // Edit data
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [editPackageStatus, setEditPackageStatus] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const [updating, setUpdating] = useState(false);

  const loadZonesAndRegions = useCallback(async () => {
    try {
      const zoneQuery = supabase.from('zones').select('id, name').order('name');
      let regionQuery = supabase.from('regions').select('id, name').order('name');

      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        regionQuery = regionQuery.in('id', assignedRegionIds);
      }

      const [zoneRes, regionRes] = await Promise.all([zoneQuery, regionQuery]);

      if (zoneRes.data) setZones(zoneRes.data);
      if (regionRes.data) setRegions(regionRes.data);
    } catch (error) {
      console.error('Error loading zones/regions:', error);
    }
  }, [isRegionalAdmin, assignedRegionIds]);

  const loadTeamMembers = useCallback(async () => {
    try {
      let tlQuery = supabase.from('team_leaders').select('id, name, region_id').order('name');
      const captainQuery = supabase.from('captains').select('id, name, team_leaders!inner(region_id)').order('name');
      const dsrQuery = supabase.from('dsrs').select('id, name, captains!inner(team_leaders!inner(region_id))').order('name');

      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        tlQuery = tlQuery.in('region_id', assignedRegionIds);
      }

      const [tlRes, captainRes, dsrRes] = await Promise.all([tlQuery, captainQuery, dsrQuery]);

      if (tlRes.data) setTeamLeaders(tlRes.data);
      if (captainRes.data) {
        const filteredCaptains = isRegionalAdmin && assignedRegionIds.length > 0
          ? captainRes.data.filter((c: { team_leaders?: { region_id?: string } }) => assignedRegionIds.includes(c.team_leaders?.region_id))
          : captainRes.data;
        setCaptains(filteredCaptains);
      }
      if (dsrRes.data) {
        const filteredDsrs = isRegionalAdmin && assignedRegionIds.length > 0
          ? dsrRes.data.filter((d: { captains?: { team_leaders?: { region_id?: string } } }) => assignedRegionIds.includes(d.captains?.team_leaders?.region_id))
          : dsrRes.data;
        setDsrs(filteredDsrs);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }, [isRegionalAdmin, assignedRegionIds]);

  useEffect(() => {
    loadZonesAndRegions();
    loadTeamMembers();
  }, [loadZonesAndRegions, loadTeamMembers]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    setSelectedIds(new Set());

    try {
      let data: SearchResult[] = [];

      if (searchType === 'smartcard' || searchType === 'serial') {
        // Search in inventory
        let inventoryQuery = supabase
          .from('inventory')
          .select(`
            id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at,
            assigned_to_type, assigned_to_id, zone_id, region_id,
            zones:zone_id(id, name),
            regions:region_id(id, name)
          `)
          .ilike(searchType === 'smartcard' ? 'smartcard_number' : 'serial_number', `%${searchQuery}%`)
          .limit(100);

        if (isRegionalAdmin && assignedRegionIds.length > 0) {
          inventoryQuery = inventoryQuery.in('region_id', assignedRegionIds);
        }

        const { data: inventoryData } = await inventoryQuery;

        // Fetch assigned person names for inventory items
        const inventoryWithNames = await Promise.all((inventoryData || []).map(async (item: InventoryRow) => {
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
        let salesQuery = supabase
          .from('sales_records')
          .select(`
            id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at,
            team_leader_id, captain_id, dsr_id, zone_id, region_id,
            team_leaders:team_leader_id(name),
            captains:captain_id(name),
            dsrs:dsr_id(name),
            zones:zone_id(id, name),
            regions:region_id(id, name)
          `)
          .ilike(searchType === 'smartcard' ? 'smartcard_number' : 'serial_number', `%${searchQuery}%`)
          .limit(100);

        if (isRegionalAdmin && assignedRegionIds.length > 0) {
          salesQuery = salesQuery.in('region_id', assignedRegionIds);
        }

        const { data: salesData } = await salesQuery;

        // Process inventory data
        const inventoryResults = inventoryWithNames.map((item: InventoryRow) => ({
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
          zone_id: item.zone_id,
          region_id: item.region_id,
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
        const salesResults = (salesData || []).map((item: SalesRow) => ({
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
          zone_id: item.zone_id,
          region_id: item.region_id,
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

        const tlNames = Object.fromEntries(tlData.data?.map(t => [t.id, t.name]) || []);
        const captainNames = Object.fromEntries(captainData.data?.map(c => [c.id, c.name]) || []);
        const dsrNames = Object.fromEntries(dsrData.data?.map(d => [d.id, d.name]) || []);

        if (tlIds.length || captainIds.length || dsrIds.length) {
          const salesPromises = [];
          const inventoryPromises = [];

          if (tlIds.length) {
            let q = supabase.from('sales_records')
              .select(`id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at, team_leader_id, captain_id, dsr_id, zone_id, region_id, zones:zone_id(id, name), regions:region_id(id, name)`)
              .in('team_leader_id', tlIds)
              .limit(50);
            if (isRegionalAdmin && assignedRegionIds.length > 0) q = q.in('region_id', assignedRegionIds);
            salesPromises.push(q);

            let iq = supabase.from('inventory')
              .select(`id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at, assigned_to_type, assigned_to_id, zone_id, region_id, zones:zone_id(id, name), regions:region_id(id, name)`)
              .in('assigned_to_id', tlIds)
              .eq('assigned_to_type', 'team_leader')
              .limit(50);
            if (isRegionalAdmin && assignedRegionIds.length > 0) iq = iq.in('region_id', assignedRegionIds);
            inventoryPromises.push(iq);
          }
          if (captainIds.length) {
            let q = supabase.from('sales_records')
              .select(`id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at, team_leader_id, captain_id, dsr_id, zone_id, region_id, zones:zone_id(id, name), regions:region_id(id, name)`)
              .in('captain_id', captainIds)
              .limit(50);
            if (isRegionalAdmin && assignedRegionIds.length > 0) q = q.in('region_id', assignedRegionIds);
            salesPromises.push(q);

            let iq = supabase.from('inventory')
              .select(`id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at, assigned_to_type, assigned_to_id, zone_id, region_id, zones:zone_id(id, name), regions:region_id(id, name)`)
              .in('assigned_to_id', captainIds)
              .eq('assigned_to_type', 'captain')
              .limit(50);
            if (isRegionalAdmin && assignedRegionIds.length > 0) iq = iq.in('region_id', assignedRegionIds);
            inventoryPromises.push(iq);
          }
          if (dsrIds.length) {
            let q = supabase.from('sales_records')
              .select(`id, smartcard_number, serial_number, stock_type, payment_status, package_status, sale_date, customer_name, notes, created_at, team_leader_id, captain_id, dsr_id, zone_id, region_id, zones:zone_id(id, name), regions:region_id(id, name)`)
              .in('dsr_id', dsrIds)
              .limit(50);
            if (isRegionalAdmin && assignedRegionIds.length > 0) q = q.in('region_id', assignedRegionIds);
            salesPromises.push(q);

            let iq = supabase.from('inventory')
              .select(`id, smartcard_number, serial_number, stock_type, status, payment_status, package_status, notes, created_at, assigned_to_type, assigned_to_id, zone_id, region_id, zones:zone_id(id, name), regions:region_id(id, name)`)
              .in('assigned_to_id', dsrIds)
              .eq('assigned_to_type', 'dsr')
              .limit(50);
            if (isRegionalAdmin && assignedRegionIds.length > 0) iq = iq.in('region_id', assignedRegionIds);
            inventoryPromises.push(iq);
          }

          const salesResults = await Promise.all(salesPromises);
          const inventoryResults = await Promise.all(inventoryPromises);

          const allSalesData = salesResults.flatMap(r => r.data || []);
          const uniqueSales = Array.from(new Map(allSalesData.map(s => [s.id, s])).values());

          const allInventoryData = inventoryResults.flatMap(r => r.data || []);
          const uniqueInventory = Array.from(new Map(allInventoryData.map(i => [i.id, i])).values());

          const salesFormatted = uniqueSales.map((item: SalesRow) => ({
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
            zone_id: item.zone_id,
            region_id: item.region_id,
            team_leader: item.team_leader_id ? { name: tlNames[item.team_leader_id] || 'Unknown' } : null,
            captain: item.captain_id ? { name: captainNames[item.captain_id] || 'Unknown' } : null,
            dsr: item.dsr_id ? { name: dsrNames[item.dsr_id] || 'Unknown' } : null,
            created_at: item.created_at,
            source: 'sale' as const
          }));

          const inventoryFormatted = uniqueInventory.map((item: InventoryRow) => {
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
              zone_id: item.zone_id,
              region_id: item.region_id,
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
      toast({ title: 'Search Error', description: 'Failed to search records', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = results;
    if (filters.stock_type !== 'all') filtered = filtered.filter(item => item.stock_type === filters.stock_type);
    if (filters.status !== 'all') filtered = filtered.filter(item => item.status === filters.status);
    if (filters.payment_status !== 'all') filtered = filtered.filter(item => item.payment_status === filters.payment_status);
    if (filters.package_status !== 'all') filtered = filtered.filter(item => item.package_status === filters.package_status);
    if (filters.zone !== 'all') filtered = filtered.filter(item => item.zone?.name === filters.zone);
    if (filters.region !== 'all') filtered = filtered.filter(item => item.region?.name === filters.region);
    setFilteredResults(filtered);
  };

  const resetFilters = () => {
    setFilters({ stock_type: 'all', status: 'all', payment_status: 'all', package_status: 'all', zone: 'all', region: 'all' });
    setFilteredResults(results);
  };

  // Bulk selection
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map(r => `${r.source}-${r.id}`)));
    }
  };

  const toggleSelect = (item: SearchResult) => {
    const key = `${item.source}-${item.id}`;
    const newSet = new Set(selectedIds);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedIds(newSet);
  };

  // Actions
  const openAssignDialog = (item: SearchResult) => {
    if (item.source !== 'inventory') {
      toast({ title: 'Cannot Assign', description: 'Only inventory items can be assigned', variant: 'destructive' });
      return;
    }
    setSelectedItem(item);
    setAssignType('team_leader');
    setAssignToId('');
    setAssignDialogOpen(true);
  };

  const openEditDialog = (item: SearchResult) => {
    setSelectedItem(item);
    setEditPaymentStatus(item.payment_status);
    setEditPackageStatus(item.package_status);
    setEditStatus(item.status);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (item: SearchResult) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedItem || !assignToId) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          assigned_to_type: assignType,
          assigned_to_id: assignToId,
          status: 'assigned'
        })
        .eq('id', selectedItem.id);

      if (error) throw error;

      toast({ title: 'Assigned', description: 'Stock assigned successfully' });
      setAssignDialogOpen(false);
      // Refresh results
      const updatedResults = results.map(r =>
        r.id === selectedItem.id && r.source === 'inventory'
          ? { ...r, assigned_to_type: assignType, assigned_to_id: assignToId, status: 'assigned' }
          : r
      );
      setResults(updatedResults);
      setFilteredResults(updatedResults);
    } catch (error) {
      console.error('Assign error:', error);
      toast({ title: 'Error', description: 'Failed to assign stock', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedItem) return;
    setUpdating(true);
    try {
      if (selectedItem.source === 'inventory') {
        const { error } = await supabase
          .from('inventory')
          .update({
            payment_status: editPaymentStatus,
            package_status: editPackageStatus,
            status: editStatus
          })
          .eq('id', selectedItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_records')
          .update({
            payment_status: editPaymentStatus,
            package_status: editPackageStatus
          })
          .eq('id', selectedItem.id);
        if (error) throw error;
      }

      toast({ title: 'Updated', description: 'Record updated successfully' });
      setEditDialogOpen(false);
      // Refresh results
      const updatedResults = results.map(r =>
        r.id === selectedItem.id && r.source === selectedItem.source
          ? { ...r, payment_status: editPaymentStatus, package_status: editPackageStatus, status: selectedItem.source === 'inventory' ? editStatus : r.status }
          : r
      );
      setResults(updatedResults);
      setFilteredResults(updatedResults);
    } catch (error) {
      console.error('Update error:', error);
      toast({ title: 'Error', description: 'Failed to update record', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setUpdating(true);
    try {
      const table = selectedItem.source === 'inventory' ? 'inventory' : 'sales_records';
      const { error } = await supabase.from(table).delete().eq('id', selectedItem.id);
      if (error) throw error;

      toast({ title: 'Deleted', description: 'Record deleted successfully' });
      setDeleteDialogOpen(false);
      const updatedResults = results.filter(r => !(r.id === selectedItem.id && r.source === selectedItem.source));
      setResults(updatedResults);
      setFilteredResults(updatedResults);
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  // Bulk actions
  const handleBulkPaymentUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    setUpdating(true);
    try {
      const inventoryIds: string[] = [];
      const salesIds: string[] = [];

      selectedIds.forEach(key => {
        const [source, id] = key.split('-');
        if (source === 'inventory') inventoryIds.push(id);
        else salesIds.push(id);
      });

      if (inventoryIds.length > 0) {
        await supabase.from('inventory').update({ payment_status: status }).in('id', inventoryIds);
      }
      if (salesIds.length > 0) {
        await supabase.from('sales_records').update({ payment_status: status }).in('id', salesIds);
      }

      toast({ title: 'Updated', description: `${selectedIds.size} records updated to ${status}` });
      // Refresh
      const updatedResults = results.map(r => {
        const key = `${r.source}-${r.id}`;
        return selectedIds.has(key) ? { ...r, payment_status: status } : r;
      });
      setResults(updatedResults);
      setFilteredResults(updatedResults);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Bulk update error:', error);
      toast({ title: 'Error', description: 'Failed to update records', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkPackageUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    setUpdating(true);
    try {
      const inventoryIds: string[] = [];
      const salesIds: string[] = [];

      selectedIds.forEach(key => {
        const [source, id] = key.split('-');
        if (source === 'inventory') inventoryIds.push(id);
        else salesIds.push(id);
      });

      if (inventoryIds.length > 0) {
        await supabase.from('inventory').update({ package_status: status }).in('id', inventoryIds);
      }
      if (salesIds.length > 0) {
        await supabase.from('sales_records').update({ package_status: status }).in('id', salesIds);
      }

      toast({ title: 'Updated', description: `${selectedIds.size} records updated to ${status}` });
      const updatedResults = results.map(r => {
        const key = `${r.source}-${r.id}`;
        return selectedIds.has(key) ? { ...r, package_status: status } : r;
      });
      setResults(updatedResults);
      setFilteredResults(updatedResults);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Bulk update error:', error);
      toast({ title: 'Error', description: 'Failed to update records', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
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
      'Assigned To': item.assigned_to_name || item.team_leader?.name || item.captain?.name || item.dsr?.name || '-',
      'Zone': item.zone?.name || '-',
      'Region': item.region?.name || '-',
      'Customer Name': item.customer_name || '-',
      'Sale Date': item.sale_date || '-',
      'Source': item.source,
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
    a.download = `admin_search_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string, hasAssignment: boolean) => {
    switch (status) {
      case 'available':
        return hasAssignment
          ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Available</Badge>
          : <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30"><Package className="h-3 w-3 mr-1" /> Not Assigned</Badge>;
      case 'assigned':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30"><Users className="h-3 w-3 mr-1" /> In Hand</Badge>;
      case 'sold':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30"><CreditCard className="h-3 w-3 mr-1" /> Sold</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (status: string) => {
    return status === 'Paid'
      ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>
      : <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><Clock className="h-3 w-3 mr-1" />Unpaid</Badge>;
  };

  const getPackageBadge = (status: string) => {
    return status === 'Packaged'
      ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30"><Package className="h-3 w-3 mr-1" />Packaged</Badge>
      : <Badge className="bg-red-500/20 text-red-500 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />No Package</Badge>;
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

  const currentAssignList = assignType === 'team_leader' ? teamLeaders : assignType === 'captain' ? captains : dsrs;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Admin Search
              </span>
            </h1>
            <p className="text-muted-foreground">Search and manage stock & sales records</p>
          </div>
          <div className="flex gap-2">
            {filteredResults.length > 0 && (
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Export ({filteredResults.length})
              </Button>
            )}
          </div>
        </div>

        {/* Search Form */}
        <GlassCard>
          <form onSubmit={handleSearch} className="space-y-4">
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as 'smartcard' | 'serial' | 'person')}>
              <TabsList className="grid w-full grid-cols-3 glass-card text-xs md:text-sm">
                <TabsTrigger value="smartcard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Package className="h-4 w-4 mr-2" />Smartcard
                </TabsTrigger>
                <TabsTrigger value="serial" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Box className="h-4 w-4 mr-2" />Serial Number
                </TabsTrigger>
                <TabsTrigger value="person" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <User className="h-4 w-4 mr-2" />Person
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={
                    searchType === 'smartcard'
                      ? 'Enter smartcard number...'
                      : searchType === 'serial'
                      ? 'Enter serial number...'
                      : 'Enter TL, Captain, or DSR name...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 input-glass h-12"
                />
              </div>
              <Button type="submit" className="btn-primary-gradient h-12 px-8" disabled={isLoading}>
                {isLoading ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Searching...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" />Search</>
                )}
              </Button>
            </div>
          </form>
        </GlassCard>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <GlassCard>
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-medium">{selectedIds.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkPaymentUpdate('Paid')} disabled={updating}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />Mark Paid
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkPaymentUpdate('Unpaid')} disabled={updating}>
                  <Clock className="h-4 w-4 mr-1" />Mark Unpaid
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkPackageUpdate('Packaged')} disabled={updating}>
                  <Package className="h-4 w-4 mr-1" />Mark Packaged
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkPackageUpdate('No Package')} disabled={updating}>
                  <XCircle className="h-4 w-4 mr-1" />Mark No Package
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear Selection</Button>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Filters */}
        {hasSearched && results.length > 0 && (
          <GlassCard>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />Filter Results
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={applyFilters}>Apply Filters</Button>
                <Button variant="outline" size="sm" onClick={resetFilters}>Clear Filters</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Stock Type</label>
                <Select value={filters.stock_type} onValueChange={(v) => setFilters({ ...filters, stock_type: v })}>
                  <SelectTrigger className="glass-input"><SelectValue placeholder="All Types" /></SelectTrigger>
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
                <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                  <SelectTrigger className="glass-input"><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="assigned">In Hand</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Status</label>
                <Select value={filters.payment_status} onValueChange={(v) => setFilters({ ...filters, payment_status: v })}>
                  <SelectTrigger className="glass-input"><SelectValue placeholder="All Payment Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Package Status</label>
                <Select value={filters.package_status} onValueChange={(v) => setFilters({ ...filters, package_status: v })}>
                  <SelectTrigger className="glass-input"><SelectValue placeholder="All Package Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Packaged">Packaged</SelectItem>
                    <SelectItem value="No Package">No Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Zone</label>
                <Select value={filters.zone} onValueChange={(v) => setFilters({ ...filters, zone: v })}>
                  <SelectTrigger className="glass-input"><SelectValue placeholder="All Zones" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Zones</SelectItem>
                    {zones.map(zone => <SelectItem key={zone.id} value={zone.name}>{zone.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Region</label>
                <Select value={filters.region} onValueChange={(v) => setFilters({ ...filters, region: v })}>
                  <SelectTrigger className="glass-input"><SelectValue placeholder="All Regions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions.map(region => <SelectItem key={region.id} value={region.name}>{region.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {filteredResults.length} Result{filteredResults.length !== 1 ? 's' : ''} Found
              </h2>
              {filteredResults.length > 0 && (
                <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                  {selectedIds.size === filteredResults.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>

            {filteredResults.length === 0 ? (
              <GlassCard className="text-center py-12">
                <Search className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-4">No records found matching your search</p>
              </GlassCard>
            ) : (
              <div className="grid gap-4">
                {filteredResults.map((item) => {
                  const key = `${item.source}-${item.id}`;
                  return (
                    <GlassCard key={key} className="hover:shadow-lg transition-shadow">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <Checkbox
                          checked={selectedIds.has(key)}
                          onCheckedChange={() => toggleSelect(item)}
                          className="mt-1"
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="font-mono text-xl font-bold text-primary">{item.smartcard_number}</span>
                                {getStatusBadge(item.status, !!item.assigned_to_name)}
                                <Badge variant="outline" className={item.source === 'inventory' ? 'border-blue-500/30 text-blue-500' : 'border-amber-500/30 text-amber-500'}>
                                  {item.source === 'inventory' ? 'Inventory' : 'Sale'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="font-mono">{item.serial_number}</span>
                                <span>{item.stock_type}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {item.payment_status && getPaymentBadge(item.payment_status)}
                              {item.package_status && getPackageBadge(item.package_status)}
                            </div>
                          </div>

                          {/* Assignment Info */}
                          {item.source === 'inventory' && item.assigned_to_name && item.assigned_to_type && (
                            <div className="mb-3 flex flex-wrap gap-2">
                              {item.assigned_to_type === 'team_leader' && getTeamBadge('tl', item.assigned_to_name)}
                              {item.assigned_to_type === 'captain' && getTeamBadge('captain', item.assigned_to_name)}
                              {item.assigned_to_type === 'dsr' && getTeamBadge('dsr', item.assigned_to_name)}
                            </div>
                          )}

                          {item.source === 'sale' && (item.team_leader || item.captain || item.dsr) && (
                            <div className="mb-3 flex flex-wrap gap-2">
                              {item.team_leader && getTeamBadge('tl', item.team_leader.name)}
                              {item.captain && getTeamBadge('captain', item.captain.name)}
                              {item.dsr && getTeamBadge('dsr', item.dsr.name)}
                            </div>
                          )}

                          {/* Location */}
                          {(item.zone || item.region) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                              <MapPin className="h-4 w-4" />
                              {item.zone?.name && <span>{item.zone.name}</span>}
                              {item.zone && item.region && <span>•</span>}
                              {item.region?.name && <span>{item.region.name}</span>}
                            </div>
                          )}

                          {/* Sale info */}
                          {item.source === 'sale' && item.customer_name && (
                            <div className="text-sm text-muted-foreground">
                              <User className="h-4 w-4 inline mr-1" />
                              {item.customer_name} • {item.sale_date}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          {item.source === 'inventory' && item.status !== 'sold' && (
                            <Button size="sm" variant="outline" onClick={() => openAssignDialog(item)}>
                              <Users className="h-4 w-4 mr-1" />Assign
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}>
                            <Edit className="h-4 w-4 mr-1" />Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => openDeleteDialog(item)}>
                            <Trash2 className="h-4 w-4 mr-1" />Delete
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Stock</DialogTitle>
              <DialogDescription>
                Assign {selectedItem?.smartcard_number} to a team member
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Assign To Type</label>
                <Select value={assignType} onValueChange={(v) => { setAssignType(v as 'team_leader' | 'captain' | 'dsr'); setAssignToId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team_leader">Team Leader</SelectItem>
                    <SelectItem value="captain">Captain</SelectItem>
                    <SelectItem value="dsr">DSR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Select {assignType === 'team_leader' ? 'Team Leader' : assignType === 'captain' ? 'Captain' : 'DSR'}</label>
                <Select value={assignToId} onValueChange={setAssignToId}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {currentAssignList.map(member => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={!assignToId || updating}>
                {updating ? 'Assigning...' : 'Assign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Record</DialogTitle>
              <DialogDescription>
                Update {selectedItem?.smartcard_number}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedItem?.source === 'inventory' && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Stock Status</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="assigned">In Hand (Assigned)</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Payment Status</label>
                <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Package Status</label>
                <Select value={editPackageStatus} onValueChange={setEditPackageStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Packaged">Packaged</SelectItem>
                    <SelectItem value="No Package">No Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={updating}>
                {updating ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Record</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedItem?.smartcard_number}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {updating ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
