import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Search,
  ShoppingCart,
  Package,
  Check,
  XCircle,
  PackageOpen,
  PackageCheck,
  Filter,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';
import SalesDateFilter from '@/components/SalesDateFilter';
import {
  createSalesDateRange,
  describeSalesDateRange,
  getDefaultSalesDateRange,
  type SalesDatePreset,
} from '@/lib/salesDateRange';
import {
  getSaleCompletionBadgeClass,
  getSaleCompletionLabel,
} from '@/lib/saleCompletion';

interface SaleRecord {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  team_leader_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
  region_id: string | null;
  zone_id: string | null;
  inventory_id: string | null;
}

interface TeamLeader {
  id: string;
  name: string;
  region_id: string | null;
}

interface Captain {
  id: string;
  name: string;
  team_leader_id: string | null;
}

interface DSR {
  id: string;
  name: string;
  captain_id: string | null;
  dsr_number: string | null;
}

interface Region {
  id: string;
  name: string;
  zone_id: string | null;
}

interface Zone {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  assigned_to_type?: string;
  assigned_to_id?: string;
}

export default function RecordSalePage() {
  const { toast } = useToast();
  const { isRegionalAdmin, assignedRegionIds } = useAuth();
  const defaultSalesDateRange = getDefaultSalesDateRange();
  const [loading, setLoading] = useState(true);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tlStock, setTlStock] = useState<InventoryItem[]>([]);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [salesDatePreset, setSalesDatePreset] = useState<SalesDatePreset>('this_month');
  const [salesDateFrom, setSalesDateFrom] = useState(defaultSalesDateRange.startDate);
  const [salesDateTo, setSalesDateTo] = useState(defaultSalesDateRange.endDate);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [deleteSale, setDeleteSale] = useState<SaleRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [attachDsrMode, setAttachDsrMode] = useState(false);

  // Simple form state
  const [formData, setFormData] = useState({
    region_id: '',
    team_leader_id: '',
    captain_id: '',
    dsr_id: '',
    inventory_id: '',
    package_status: 'No Package',
    payment_status: 'Unpaid',
    sale_date: new Date().toISOString().split('T')[0],
    seller_type: '',
    seller_id: '',
  });

  const salesDateRange = createSalesDateRange(salesDatePreset, salesDateFrom, salesDateTo);
  const salesDateLabel = describeSalesDateRange(salesDateRange);

  // Create lookup maps for better performance
  const captainMap = useMemo(() => new Map(captains.map(c => [c.id, c])), [captains]);
  const dsrMap = useMemo(() => new Map(dsrs.map(d => [d.id, d])), [dsrs]);
  const teamLeaderMap = useMemo(() => new Map(teamLeaders.map(t => [t.id, t])), [teamLeaders]);
  const regionMap = useMemo(() => new Map(regions.map(r => [r.id, r])), [regions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Build sales query with region filtering for regional admins
      let salesQuery = supabase
        .from('sales_records')
        .select('*')
        .gte('sale_date', salesDateRange.startDate)
        .lte('sale_date', salesDateRange.endDate)
        .order('sale_date', { ascending: false });
      
      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        salesQuery = salesQuery.in('region_id', assignedRegionIds);
      }

      const [salesRes, tlRes, captainRes, dsrRes, regionRes, zonesRes] = await Promise.all([
        salesQuery,
        supabase.from('team_leaders').select('id, name, region_id').order('name'),
        supabase.from('captains').select('id, name, team_leader_id').order('name'),
        supabase.from('dsrs').select('id, name, captain_id, dsr_number').order('name'),
        supabase.from('regions').select('*').order('name'),
        supabase.from('zones').select('id, name').order('name'),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (salesRes.data) setSales(salesRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
      if (captainRes.data) setCaptains(captainRes.data);
      if (dsrRes.data) setDsrs(dsrRes.data);
      
      // For regional admins, filter team leaders and regions
      if (tlRes.data) {
        const filteredTLs = isRegionalAdmin && assignedRegionIds.length > 0
          ? tlRes.data.filter(tl => tl.region_id && assignedRegionIds.includes(tl.region_id))
          : tlRes.data;
        setTeamLeaders(filteredTLs);
      }
      
      if (regionRes.data) {
        const filteredRegions = isRegionalAdmin && assignedRegionIds.length > 0
          ? regionRes.data.filter(r => assignedRegionIds.includes(r.id))
          : regionRes.data;
        setRegions(filteredRegions);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ 
        title: 'Error Loading Data', 
        description: 'Failed to load sales data. Please refresh the page.',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [assignedRegionIds, isRegionalAdmin, salesDateRange.endDate, salesDateRange.startDate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSalesDatePresetChange = (preset: SalesDatePreset) => {
    const nextRange = createSalesDateRange(preset, salesDateFrom, salesDateTo);
    setSalesDatePreset(preset);
    setSalesDateFrom(nextRange.startDate);
    setSalesDateTo(nextRange.endDate);
    setCurrentPage(1); // Reset pagination when date range changes
  };

  // Fetch all stock assigned to TL, their Captains, and DSRs when TL changes
  useEffect(() => {
    if (!formData.team_leader_id) {
      setTlStock([]);
      return;
    }

    let isMounted = true;

    const fetchAllStock = async () => {
      // Get all captains under this TL
      const tlCaptains = captains.filter(c => c.team_leader_id === formData.team_leader_id).map(c => c.id);
      // Get all dsrs under these captains
      const tlDsrs = dsrs.filter(d => tlCaptains.includes(d.captain_id || '')).map(d => d.id);

      // Build all assigned_to_type/id pairs
      const assignments = [
        { type: 'team_leader', id: formData.team_leader_id },
        ...tlCaptains.map(id => ({ type: 'captain', id })),
        ...tlDsrs.map(id => ({ type: 'dsr', id })),
      ];

      // Fetch all stock assigned to any of these
      let allStock: InventoryItem[] = [];
      for (const a of assignments) {
        const { data, error } = await supabase
          .from('inventory')
          .select('id, smartcard_number, serial_number, stock_type, assigned_to_type, assigned_to_id')
          .eq('assigned_to_type', a.type)
          .eq('assigned_to_id', a.id)
          .eq('status', 'assigned');
        
        if (error) {
          console.error('Error fetching stock:', error);
          continue;
        }
        
        if (data) {
          const mapped = data.map((item: {
            id: string;
            smartcard_number: string;
            serial_number: string;
            stock_type: string;
            assigned_to_type: string | null;
            assigned_to_id: string | null;
          }): InventoryItem => ({
            ...item,
            assigned_to_type: item.assigned_to_type === null ? undefined : item.assigned_to_type,
            assigned_to_id: item.assigned_to_id === null ? undefined : item.assigned_to_id,
          }));
          allStock = allStock.concat(mapped);
        }
      }
      
      if (isMounted) {
        setTlStock(allStock);
      }
    };

    fetchAllStock();
    
    return () => { isMounted = false; };
  }, [formData.team_leader_id, captains, dsrs]);

  // Filter TLs by selected region
  const filteredTLs = formData.region_id
    ? teamLeaders.filter((tl) => tl.region_id === formData.region_id)
    : [];
  const filteredCaptains = formData.team_leader_id
    ? captains.filter((captain) => captain.team_leader_id === formData.team_leader_id)
    : [];
  const filteredDsrs = formData.captain_id
    ? dsrs.filter((dsr) => dsr.captain_id === formData.captain_id)
    : [];

  const resetForm = () => {
    setEditingSale(null);
    setAttachDsrMode(false);
    setFormData({
      region_id: '',
      team_leader_id: '',
      captain_id: '',
      dsr_id: '',
      inventory_id: '',
      package_status: 'No Package',
      payment_status: 'Unpaid',
      sale_date: new Date().toISOString().split('T')[0],
      seller_type: '',
      seller_id: '',
    });
    setTlStock([]);
  };

  const handleRegionChange = (regionId: string) => {
    setFormData({
      ...formData,
      region_id: regionId,
      team_leader_id: '',
      captain_id: '',
      dsr_id: '',
      inventory_id: '',
      seller_id: '',
      seller_type: '',
    });
    setTlStock([]);
  };

  const handleTLChange = (tlId: string) => {
    setFormData({
      ...formData,
      team_leader_id: tlId,
      captain_id: '',
      dsr_id: '',
      inventory_id: '',
      seller_id: '',
      seller_type: '',
    });
  };

  const handleCaptainChange = (captainId: string) => {
    setFormData({
      ...formData,
      captain_id: captainId,
      dsr_id: '',
      inventory_id: '',
      seller_id: '',
      seller_type: '',
    });
  };

  const handleDsrChange = (dsrId: string) => {
    setFormData({
      ...formData,
      dsr_id: dsrId,
      inventory_id: '',
    });
  };

  const validateForm = () => {
    if (!attachDsrMode && !editingSale && !formData.inventory_id) {
      toast({ title: 'Error', description: 'Please select a stock item', variant: 'destructive' });
      return false;
    }
    
    if (attachDsrMode) {
      if (!formData.team_leader_id) {
        toast({ title: 'Error', description: 'Please select a Team Leader', variant: 'destructive' });
        return false;
      }
      if (!formData.captain_id) {
        toast({ title: 'Error', description: 'Please select a Captain', variant: 'destructive' });
        return false;
      }
      if (!formData.dsr_id) {
        toast({ title: 'Error', description: 'Please select a DSR', variant: 'destructive' });
        return false;
      }
    }
    
    if (!formData.region_id && !attachDsrMode) {
      toast({ title: 'Error', description: 'Please select a region', variant: 'destructive' });
      return false;
    }
    
    if (!formData.team_leader_id && !attachDsrMode) {
      toast({ title: 'Error', description: 'Please select a Team Leader', variant: 'destructive' });
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    let selectedStock;
    if (editingSale) {
      // Always use the original stock from the sale being edited
      selectedStock = {
        smartcard_number: editingSale.smartcard_number,
        serial_number: editingSale.serial_number,
        stock_type: editingSale.stock_type,
        id: editingSale.inventory_id,
      };
    } else if (!attachDsrMode) {
      selectedStock = tlStock.find((s) => s.id === formData.inventory_id);
      if (!selectedStock) {
        toast({ title: 'Error', description: 'Stock not found', variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      if (attachDsrMode && editingSale) {
        // Just update the DSR for the sale
        const { error } = await supabase
          .from('sales_records')
          .update({ 
            dsr_id: formData.dsr_id,
            captain_id: formData.captain_id,
            team_leader_id: formData.team_leader_id
          })
          .eq('id', editingSale.id);
        
        if (error) throw error;
        toast({ title: 'Success', description: 'DSR attached successfully!' });
      } else if (editingSale) {
        // Update existing sale
        const region = regions.find((r) => r.id === formData.region_id);
        
        const saleData = {
          smartcard_number: editingSale.smartcard_number,
          serial_number: editingSale.serial_number,
          stock_type: editingSale.stock_type,
          sale_date: formData.sale_date,
          payment_status: formData.payment_status,
          package_status: formData.package_status,
          team_leader_id: formData.team_leader_id,
          captain_id: formData.captain_id || null,
          dsr_id: formData.dsr_id || null,
          region_id: formData.region_id,
          zone_id: region?.zone_id || null,
          inventory_id: editingSale.inventory_id,
        };
        
        const { error } = await supabase
          .from('sales_records')
          .update(saleData)
          .eq('id', editingSale.id);
        
        if (error) throw error;
        toast({ title: 'Success', description: 'Sale updated successfully!' });
      } else {
        // Insert new sale record
        const region = regions.find((r) => r.id === formData.region_id);
        
        // Determine seller type and id from form
        let sellerType = formData.seller_type;
        let sellerId = formData.seller_id;
        
        // Fallback: if not set, use DSR, Captain, or TL from form
        if (!sellerType || !sellerId) {
          if (formData.dsr_id) {
            sellerType = 'dsr';
            sellerId = formData.dsr_id;
          } else if (formData.captain_id) {
            sellerType = 'captain';
            sellerId = formData.captain_id;
          } else {
            sellerType = 'team_leader';
            sellerId = formData.team_leader_id;
          }
        }

        const saleData = {
          smartcard_number: selectedStock!.smartcard_number,
          serial_number: selectedStock!.serial_number,
          stock_type: selectedStock!.stock_type,
          sale_date: formData.sale_date,
          payment_status: formData.payment_status,
          package_status: formData.package_status,
          team_leader_id: formData.team_leader_id,
          captain_id: formData.captain_id || null,
          dsr_id: formData.dsr_id || null,
          region_id: formData.region_id,
          zone_id: region?.zone_id || null,
          inventory_id: formData.inventory_id,
        };

        const { error } = await supabase.from('sales_records').insert([saleData]);
        if (error) throw error;

        // Mark inventory as sold
        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({ status: 'sold' })
          .eq('id', formData.inventory_id);
        
        if (inventoryError) throw inventoryError;

        toast({ title: 'Success', description: 'Sale recorded successfully!' });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSale) return;
    
    try {
      // First, get the inventory item to revert it back to available
      const { data: saleData } = await supabase
        .from('sales_records')
        .select('inventory_id')
        .eq('id', deleteSale.id)
        .single();

      // Delete the sale record
      const { error: deleteError } = await supabase
        .from('sales_records')
        .delete()
        .eq('id', deleteSale.id);
      
      if (deleteError) throw deleteError;

      // If there's an inventory item linked, revert it back to available
      if (saleData?.inventory_id) {
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            status: 'available',
            payment_status: 'Unpaid',
            package_status: 'No Package'
          })
          .eq('id', saleData.inventory_id);

        if (updateError) console.error('Warning: Could not revert inventory status:', updateError);
      }
      
      toast({ title: 'Deleted', description: 'Sale record removed and inventory restored to available.' });
      setDeleteDialogOpen(false);
      setDeleteSale(null);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      // First, get all inventory items linked to these sales
      const { data: salesData } = await supabase
        .from('sales_records')
        .select('inventory_id')
        .in('id', selectedItems);

      // Delete all selected sales
      const { error: deleteError } = await supabase
        .from('sales_records')
        .delete()
        .in('id', selectedItems);
      
      if (deleteError) throw deleteError;

      // Get inventory IDs to revert
      const inventoryIds = (salesData || [])
        .map(s => s.inventory_id)
        .filter((id): id is string => Boolean(id));

      // Revert all linked inventory items back to available
      if (inventoryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('inventory')
          .update({
            status: 'available',
            payment_status: 'Unpaid',
            package_status: 'No Package'
          })
          .in('id', inventoryIds);

        if (updateError) console.error('Warning: Could not revert inventory status for some items:', updateError);
      }
      
      toast({ title: 'Deleted', description: `${selectedItems.length} sale(s) removed and inventory restored to available.` });
      setSelectedItems([]);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleBulkStatusUpdate = async (ids: string[], updates: object) => {
    setBulkUpdating(true);
    try {
      const { error } = await supabase
        .from('sales_records')
        .update(updates)
        .in('id', ids);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: `${ids.length} sale(s) updated successfully.` });
      setSelectedItems([]);
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleEditClick = (sale: SaleRecord) => {
    setEditingSale(sale);
    setAttachDsrMode(false);
    setFormData({
      region_id: sale.region_id || '',
      team_leader_id: sale.team_leader_id || '',
      captain_id: sale.captain_id || '',
      dsr_id: sale.dsr_id || '',
      inventory_id: sale.inventory_id || '',
      package_status: sale.package_status,
      payment_status: sale.payment_status,
      sale_date: sale.sale_date,
      seller_type: '',
      seller_id: '',
    });
    setDialogOpen(true);
  };

  const handleAttachDsr = (sale: SaleRecord) => {
    setEditingSale(sale);
    setAttachDsrMode(true);
    setFormData({
      region_id: sale.region_id || '',
      team_leader_id: sale.team_leader_id || '',
      captain_id: sale.captain_id || '',
      dsr_id: '',
      inventory_id: sale.inventory_id || '',
      package_status: sale.package_status,
      payment_status: sale.payment_status,
      sale_date: sale.sale_date,
      seller_type: '',
      seller_id: '',
    });
    setDialogOpen(true);
  };

  const handleUpdatePaymentStatus = async (sale: SaleRecord, status: string) => {
    try {
      const { error } = await supabase
        .from('sales_records')
        .update({ payment_status: status })
        .eq('id', sale.id);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: `Payment status updated to ${status}` });
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleUpdatePackageStatus = async (sale: SaleRecord, status: string) => {
    try {
      const { error } = await supabase
        .from('sales_records')
        .update({ package_status: status })
        .eq('id', sale.id);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: `Package status updated to ${status}` });
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  useEffect(() => { setRegionFilter('all'); }, [zoneFilter]);

  const filteredSales = sales.filter((s) => {
    const query = searchQuery.toLowerCase();
    const dsr = dsrMap.get(s.dsr_id || '');
    const matchesSearch =
      s.smartcard_number.toLowerCase().includes(query) ||
      s.serial_number.toLowerCase().includes(query) ||
      (s.customer_name?.toLowerCase() || '').includes(query) ||
      (dsr?.name || '').toLowerCase().includes(query);
    
    const matchesZone = zoneFilter === 'all' || s.zone_id === zoneFilter;
    const matchesRegion = regionFilter === 'all' || s.region_id === regionFilter;
    
    // CRITICAL: Client-side date range filter (safety check when server-side filter may fail)
    // Ensure sale_date is within the selected date range
    const saleDate = s.sale_date;
    const matchesDateRange = saleDate >= salesDateRange.startDate && saleDate <= salesDateRange.endDate;
    
    return matchesSearch && matchesZone && matchesRegion && matchesDateRange;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-full md:w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </AdminLayout>
    );
  }

  const stats = {
    total: sales.length,
    paid: sales.filter((s) => s.payment_status === 'Paid').length,
    unpaid: sales.filter((s) => s.payment_status === 'Unpaid').length,
    noPackage: sales.filter((s) => s.package_status === 'No Package').length,
    incomplete: sales.filter((s) => !s.dsr_id).length,
  };

  return (
    <AdminLayout>
      <div className="space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Record Sales
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Simple sales recording for {salesDateLabel.toLowerCase()}</p>
          </div>
          <Button
            className="bg-gradient-to-r from-primary to-secondary text-primary-foreground"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Record Sale
          </Button>
        </div>

        <SalesDateFilter
          preset={salesDatePreset}
          startDate={salesDateFrom}
          endDate={salesDateTo}
          onPresetChange={handleSalesDatePresetChange}
          onStartDateChange={setSalesDateFrom}
          onEndDateChange={setSalesDateTo}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <GlassCard className="text-center">
            <ShoppingCart className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Sales</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-500">{stats.paid}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </GlassCard>
          <GlassCard className="text-center">
            <XCircle className="h-8 w-8 mx-auto text-warning mb-2" />
            <p className="text-2xl font-bold text-warning">{stats.unpaid}</p>
            <p className="text-xs text-muted-foreground">Unpaid</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Package className="h-8 w-8 mx-auto text-destructive mb-2" />
            <p className="text-2xl font-bold text-destructive">{stats.noPackage}</p>
            <p className="text-xs text-muted-foreground">No Package</p>
          </GlassCard>
          <GlassCard className="text-center">
            <XCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-amber-500">{stats.incomplete}</p>
            <p className="text-xs text-muted-foreground">Incomplete</p>
          </GlassCard>
        </div>

        {/* Search & Actions */}
        <GlassCard className="space-y-3">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-sales"
                  name="search-sales"
                  placeholder="Search smartcard, serial, DSR name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleBulkStatusUpdate(selectedItems, { payment_status: 'Paid' })}
                  disabled={bulkUpdating}
                >
                  <Check className="w-3 h-3 mr-1" /> Paid
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleBulkStatusUpdate(selectedItems, { payment_status: 'Unpaid' })}
                  disabled={bulkUpdating}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Unpaid
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleBulkStatusUpdate(selectedItems, { package_status: 'Packaged' })}
                  disabled={bulkUpdating}
                >
                  <PackageCheck className="w-3 h-3 mr-1" /> Packaged
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => handleBulkStatusUpdate(selectedItems, { package_status: 'No Package' })}
                  disabled={bulkUpdating}
                >
                  <PackageOpen className="w-3 h-3 mr-1" /> No Pkg
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={handleBulkDelete}
                  disabled={bulkUpdating}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Delete ({selectedItems.length})
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={zoneFilter} onValueChange={(val) => {
              setZoneFilter(val);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[140px] h-8 text-xs glass-input" id="zone-filter" name="zone-filter">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={(val) => {
              setRegionFilter(val);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[140px] h-8 text-xs glass-input" id="region-filter" name="region-filter">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {(zoneFilter === 'all' ? regions : regions.filter(r => r.zone_id === zoneFilter)).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredSales.length} of {sales.length} sales
            </span>
          </div>
        </GlassCard>

        {/* Sales Table */}
        <GlassCard>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedItems.length === paginatedSales.length && paginatedSales.length > 0}
                      onCheckedChange={(val) =>
                        setSelectedItems(val ? paginatedSales.map((s) => s.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead>Smartcard / Serial</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Team Leader</TableHead>
                  <TableHead>DSR</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No sales recorded for {salesDateLabel.toLowerCase()}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSales.map((sale) => (
                    <TableRow key={sale.id} className="border-border/30 hover:bg-primary/5">
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(sale.id)}
                          onCheckedChange={() =>
                            setSelectedItems((prev) =>
                              prev.includes(sale.id)
                                ? prev.filter((id) => id !== sale.id)
                                : [...prev, sale.id]
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{sale.smartcard_number}</div>
                        <div className="text-xs text-muted-foreground">{sale.serial_number}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.stock_type}</Badge>
                      </TableCell>
                      <TableCell>{new Date(sale.sale_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              sale.payment_status === 'Paid'
                                ? 'bg-green-500/20 text-green-500 border-green-500/30'
                                : 'bg-red-500/20 text-red-500 border-red-500/30'
                            }
                          >
                            {sale.payment_status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleUpdatePaymentStatus(sale, sale.payment_status === 'Paid' ? 'Unpaid' : 'Paid')}
                            aria-label={sale.payment_status === 'Paid' ? 'Mark as unpaid' : 'Mark as paid'}
                          >
                            {sale.payment_status === 'Paid' ? (
                              <XCircle className="h-3 w-3 text-destructive" />
                            ) : (
                              <Check className="h-3 w-3 text-green-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              sale.package_status === 'Packaged'
                                ? 'bg-purple-500/20 text-purple-500 border-purple-500/30'
                                : 'bg-pink-500/20 text-pink-500 border-pink-500/30'
                            }
                          >
                            {sale.package_status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleUpdatePackageStatus(sale, sale.package_status === 'Packaged' ? 'No Package' : 'Packaged')}
                            aria-label={sale.package_status === 'Packaged' ? 'Mark as no package' : 'Mark as packaged'}
                          >
                            {sale.package_status === 'Packaged' ? (
                              <PackageOpen className="h-3 w-3 text-destructive" />
                            ) : (
                              <PackageCheck className="h-3 w-3 text-green-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {teamLeaderMap.get(sale.team_leader_id || '')?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {sale.dsr_id ? (
                          <div>
                            <div className="font-medium">{dsrMap.get(sale.dsr_id)?.name || '-'}</div>
                            <div className="text-xs text-muted-foreground">
                              {dsrMap.get(sale.dsr_id)?.dsr_number || 'No D number'}
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-600 text-xs border-amber-400"
                            onClick={() => handleAttachDsr(sale)}
                          >
                            Attach DSR
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getSaleCompletionBadgeClass(sale.dsr_id)}>
                          {getSaleCompletionLabel(sale.dsr_id)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditClick(sale)}
                            aria-label="Edit sale"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setDeleteSale(sale);
                              setDeleteDialogOpen(true);
                            }}
                            aria-label="Delete sale"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </GlassCard>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}>
          <DialogContent className="glass-card border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {attachDsrMode
                  ? 'Attach DSR to Sale'
                  : editingSale
                  ? 'Edit Sale'
                  : 'Record New Sale'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {attachDsrMode ? (
                <div className="space-y-4">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-2">
                    <p className="text-sm text-amber-600">
                      Attaching DSR to sale: <strong>{editingSale?.smartcard_number}</strong>
                    </p>
                  </div>
                  
                  {/* Select TL */}
                  <div>
                    <Label htmlFor="attach-tl">Team Leader *</Label>
                    <Select
                      value={formData.team_leader_id}
                      onValueChange={(v) => {
                        setFormData({ ...formData, team_leader_id: v, captain_id: '', dsr_id: '' });
                      }}
                    >
                      <SelectTrigger className="glass-input" id="attach-tl" name="attach-tl">
                        <SelectValue placeholder="Select TL" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamLeaders.length === 0 ? (
                          <SelectItem value="no-tls" disabled>No TLs available</SelectItem>
                        ) : (
                          teamLeaders.map((tl) => (
                            <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Select Captain */}
                  <div>
                    <Label htmlFor="attach-captain">Captain *</Label>
                    <Select
                      value={formData.captain_id}
                      onValueChange={(v) => {
                        setFormData({ ...formData, captain_id: v, dsr_id: '' });
                      }}
                      disabled={!formData.team_leader_id}
                    >
                      <SelectTrigger className="glass-input" id="attach-captain" name="attach-captain">
                        <SelectValue placeholder={formData.team_leader_id ? 'Select captain' : 'Select TL first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCaptains.length === 0 ? (
                          <SelectItem value="no-captains" disabled>No captains under this TL</SelectItem>
                        ) : (
                          filteredCaptains.map((captain) => (
                            <SelectItem key={captain.id} value={captain.id}>{captain.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Select DSR */}
                  <div>
                    <Label htmlFor="attach-dsr">DSR *</Label>
                    <Select
                      value={formData.dsr_id}
                      onValueChange={handleDsrChange}
                      disabled={!formData.captain_id}
                    >
                      <SelectTrigger className="glass-input" id="attach-dsr" name="attach-dsr">
                        <SelectValue placeholder={formData.captain_id ? 'Select DSR' : 'Select captain first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredDsrs.length === 0 ? (
                          <SelectItem value="no-dsrs" disabled>No DSRs under this captain</SelectItem>
                        ) : (
                          filteredDsrs.map((dsr) => (
                            <SelectItem key={dsr.id} value={dsr.id}>
                              {dsr.name}{dsr.dsr_number ? ` - ${dsr.dsr_number}` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">Select TL → Captain → DSR to attach to this sale.</p>
                </div>
              ) : (
                <>
                  {/* 1. Select Region */}
                  <div>
                    <Label htmlFor="region">Region *</Label>
                    <Select value={formData.region_id} onValueChange={handleRegionChange}>
                      <SelectTrigger className="glass-input" id="region" name="region">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2. Select Team Leader (filtered by region) */}
                  <div>
                    <Label htmlFor="team-leader">Team Leader *</Label>
                    <Select
                      value={formData.team_leader_id}
                      onValueChange={handleTLChange}
                      disabled={!formData.region_id}
                    >
                      <SelectTrigger className="glass-input" id="team-leader" name="team-leader">
                        <SelectValue placeholder={formData.region_id ? 'Select TL' : 'Select region first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTLs.length === 0 ? (
                          <SelectItem value="no-tls-region" disabled>No TLs in this region</SelectItem>
                        ) : (
                          filteredTLs.map((tl) => (
                            <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="captain">Captain (Optional)</Label>
                    <Select
                      value={formData.captain_id || 'none'}
                      onValueChange={(v) => {
                        if (v === 'none') {
                          handleCaptainChange('');
                        } else {
                          handleCaptainChange(v);
                        }
                      }}
                      disabled={!formData.team_leader_id}
                    >
                      <SelectTrigger className="glass-input" id="captain" name="captain">
                        <SelectValue placeholder={formData.team_leader_id ? 'Select captain' : 'Select TL first'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {filteredCaptains.map((captain) => (
                          <SelectItem key={captain.id} value={captain.id}>{captain.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dsr">DSR (Optional)</Label>
                    <Select
                      value={formData.dsr_id || 'none'}
                      onValueChange={(v) => {
                        if (v === 'none') {
                          handleDsrChange('');
                        } else {
                          handleDsrChange(v);
                        }
                      }}
                      disabled={!formData.captain_id}
                    >
                      <SelectTrigger className="glass-input" id="dsr" name="dsr">
                        <SelectValue placeholder={formData.captain_id ? 'Select DSR' : 'Select captain first'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {filteredDsrs.map((dsr) => (
                          <SelectItem key={dsr.id} value={dsr.id}>
                            {dsr.name}{dsr.dsr_number ? ` - ${dsr.dsr_number}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">If DSR is missing, the sale will stay marked as Incomplete.</p>
                  </div>

                  {/* 3. Select Stock (all in hand for TL, Captain, DSR) */}
                  {!editingSale && (
                    <div>
                      <Label htmlFor="stock-item">Stock Item * <span className="text-muted-foreground text-xs">({tlStock.length} available)</span></Label>
                      <Select
                        value={formData.inventory_id}
                        onValueChange={(v) => setFormData({ ...formData, inventory_id: v })}
                        disabled={!formData.team_leader_id}
                      >
                        <SelectTrigger className="glass-input" id="stock-item" name="stock-item">
                          <SelectValue placeholder={formData.team_leader_id ? 'Select stock' : 'Select TL first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {tlStock.length === 0 ? (
                            <SelectItem value="no-stock" disabled>No stock assigned to TL, Captain, or DSR</SelectItem>
                          ) : (
                            tlStock.map((inv) => (
                              <SelectItem key={inv.id} value={inv.id}>
                                {inv.smartcard_number} - {inv.stock_type} 
                                ({inv.assigned_to_type}: {inv.assigned_to_id?.slice(0, 8)})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 3b. Select Seller (who sold) */}
                  <div>
                    <Label htmlFor="sold-by">Sold By *</Label>
                    <Select
                      value={formData.seller_id || 'none'}
                      onValueChange={(v) => {
                        if (v === 'none') {
                          setFormData({ ...formData, seller_id: '', seller_type: '' });
                        } else {
                          // Find type by id
                          let type = '';
                          if (v === formData.team_leader_id) type = 'team_leader';
                          else if (captains.some(c => c.id === v)) type = 'captain';
                          else if (dsrs.some(d => d.id === v)) type = 'dsr';
                          setFormData({ ...formData, seller_id: v, seller_type: type });
                        }
                      }}
                      disabled={!formData.team_leader_id}
                    >
                      <SelectTrigger className="glass-input" id="sold-by" name="sold-by">
                        <SelectValue placeholder={formData.team_leader_id ? 'Select who sold' : 'Select TL first'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {formData.team_leader_id && (
                          <SelectItem value={formData.team_leader_id}>
                            TL: {teamLeaderMap.get(formData.team_leader_id)?.name}
                          </SelectItem>
                        )}
                        {filteredCaptains.map(c => (
                          <SelectItem key={c.id} value={c.id}>Captain: {c.name}</SelectItem>
                        ))}
                        {filteredDsrs.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            DSR: {d.name}{d.dsr_number ? ` - ${d.dsr_number}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">Select the actual seller (TL, Captain, or DSR).</p>
                  </div>

                  {/* 4. Package Status */}
                  <div>
                    <Label htmlFor="package-status">Package Status</Label>
                    <Select
                      value={formData.package_status}
                      onValueChange={(v) => setFormData({ ...formData, package_status: v })}
                    >
                      <SelectTrigger className="glass-input" id="package-status" name="package-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Packaged">Packaged</SelectItem>
                        <SelectItem value="No Package">No Package</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 5. Payment Status */}
                  <div>
                    <Label htmlFor="payment-status">Payment Status</Label>
                    <Select
                      value={formData.payment_status}
                      onValueChange={(v) => setFormData({ ...formData, payment_status: v })}
                    >
                      <SelectTrigger className="glass-input" id="payment-status" name="payment-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 6. Sale Date */}
                  <div>
                    <Label htmlFor="sale-date">Sale Date</Label>
                    <Input
                      id="sale-date"
                      name="sale-date"
                      type="date"
                      value={formData.sale_date}
                      onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                      className="glass-input"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || (
                  attachDsrMode
                    ? !(formData.team_leader_id && formData.captain_id && formData.dsr_id)
                    : (!formData.inventory_id && !editingSale)
                )}
              >
                {saving ? 'Saving...' : (attachDsrMode ? 'Attach DSR' : (editingSale ? 'Update' : 'Record Sale'))}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Delete Sale?</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              This will permanently delete the sale record for{' '}
              <strong>{deleteSale?.smartcard_number}</strong>.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}