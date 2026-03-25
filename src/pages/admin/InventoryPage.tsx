import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Package,
  Search,
  Upload,
  FileSpreadsheet,
  Download,
  X,
  Check,
  AlertCircle,
  Users,
  MapPin,
  Box,
  ShoppingCart,
  User,
  UserPlus,
  Shield,
} from 'lucide-react';
import ExcelJS from 'exceljs';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  STOCK_TYPES,
  validateSmartcard,
  validateSerialNumber,
  formatSmartcardHint,
  formatSerialHint,
} from '@/lib/validation';

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  notes: string | null;
  created_at: string;
  zone_id: string | null;
  region_id: string | null;
}

interface Zone {
  id: string;
  name: string;
}

interface Region {
  id: string;
  name: string;
  zone_id: string | null;
}

interface TeamLeader {
  id: string;
  name: string;
}

interface Captain {
  id: string;
  name: string;
}

interface DSR {
  id: string;
  name: string;
}

interface RegionSummary {
  region_id: string;
  region_name: string;
  zone_name: string;
  total: number;
  available: number;
  sold: number;
  assigned: number;
  inhand: number;
}

export default function InventoryPage() {
  const { toast } = useToast();
  const { isSuperAdmin, isRegionalAdmin, assignedRegionIds } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionSummaries, setRegionSummaries] = useState<RegionSummary[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [bulkInput, setBulkInput] = useState('');
  const [excelPreview, setExcelPreview] = useState<{
    smartcard_number: string;
    serial_number: string;
    stock_type: string;
    zone_id: string | null;
    region_id: string | null;
    valid: boolean;
    errors: string[];
  }[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    smartcard_number: '',
    serial_number: '',
    stock_type: 'Full Set',
    notes: '',
    zone_id: '',
    region_id: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build inventory query with region filtering for regional admins
      let invQuery = supabase.from('inventory').select('*').order('created_at', { ascending: false });
      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        invQuery = invQuery.in('region_id', assignedRegionIds);
      }

      const [invRes, zoneRes, regionRes, tlRes, captainRes, dsrRes] = await Promise.all([
        invQuery,
        supabase.from('zones').select('*').order('name'),
        supabase.from('regions').select('*').order('name'),
        supabase.from('team_leaders').select('id, name').order('name'),
        supabase.from('captains').select('id, name').order('name'),
        supabase.from('dsrs').select('id, name').order('name'),
      ]);

      if (invRes.data) {
        setInventory(invRes.data);
        // Filter regions based on admin access for summaries
        const accessibleRegions = isRegionalAdmin && assignedRegionIds.length > 0
          ? (regionRes.data || []).filter(r => assignedRegionIds.includes(r.id))
          : regionRes.data || [];
        calculateRegionSummaries(invRes.data, zoneRes.data || [], accessibleRegions);
      }
      if (zoneRes.data) setZones(zoneRes.data);
      // For regional admins, only show their assigned regions
      if (regionRes.data) {
        const filteredRegions = isRegionalAdmin && assignedRegionIds.length > 0
          ? regionRes.data.filter(r => assignedRegionIds.includes(r.id))
          : regionRes.data;
        setRegions(filteredRegions);
      }
      if (tlRes.data) setTeamLeaders(tlRes.data);
      if (captainRes.data) setCaptains(captainRes.data);
      if (dsrRes.data) setDsrs(dsrRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRegionSummaries = (invData: InventoryItem[], zoneData: Zone[], regionData: Region[]) => {
    const summaries: RegionSummary[] = [];
    
    // Create summary for each region
    regionData.forEach(region => {
      const regionItems = invData.filter(item => item.region_id === region.id);
      const total = regionItems.length;
      const available = regionItems.filter(item => item.status === 'available').length;
      const sold = regionItems.filter(item => item.status === 'sold').length;
      const assigned = regionItems.filter(item => item.assigned_to_id !== null).length;
      const inhand = available - assigned; // Inhand = available minus assigned
      
      const zoneName = zoneData.find(z => z.id === region.zone_id)?.name || 'Unknown Zone';
      
      summaries.push({
        region_id: region.id,
        region_name: region.name,
        zone_name: zoneName,
        total,
        available,
        sold,
        assigned,
        inhand: Math.max(inhand, 0) // Ensure non-negative
      });
    });
    
    // Add summary for unassigned items (no region)
    const unassignedRegionItems = invData.filter(item => !item.region_id);
    if (unassignedRegionItems.length > 0) {
      const total = unassignedRegionItems.length;
      const available = unassignedRegionItems.filter(item => item.status === 'available').length;
      const sold = unassignedRegionItems.filter(item => item.status === 'sold').length;
      const assigned = unassignedRegionItems.filter(item => item.assigned_to_id !== null).length;
      const inhand = available - assigned;
      
      summaries.push({
        region_id: 'unassigned',
        region_name: 'Unassigned',
        zone_name: 'No Zone',
        total,
        available,
        sold,
        assigned,
        inhand: Math.max(inhand, 0)
      });
    }
    
    setRegionSummaries(summaries);
  };

  const getAssignedName = (item: InventoryItem) => {
    if (!item.assigned_to_type || !item.assigned_to_id) return null;
    
    switch (item.assigned_to_type) {
      case 'team_leader':
        return teamLeaders.find(tl => tl.id === item.assigned_to_id)?.name || 'Unknown TL';
      case 'captain':
        return captains.find(c => c.id === item.assigned_to_id)?.name || 'Unknown Captain';
      case 'dsr':
        return dsrs.find(d => d.id === item.assigned_to_id)?.name || 'Unknown DSR';
      default:
        return null;
    }
  };

  const getAssignedIcon = (type: string | null) => {
    switch (type) {
      case 'team_leader':
        return <Shield className="h-3 w-3" />;
      case 'captain':
        return <UserPlus className="h-3 w-3" />;
      case 'dsr':
        return <User className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getAssignedBadgeColor = (type: string | null) => {
    switch (type) {
      case 'team_leader':
        return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case 'captain':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'dsr':
        return 'bg-green-500/20 text-green-500 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  const getAssignedRoleName = (type: string | null) => {
    switch (type) {
      case 'team_leader':
        return 'TL';
      case 'captain':
        return 'Captain';
      case 'dsr':
        return 'DSR';
      default:
        return 'Unknown';
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      smartcard_number: '',
      serial_number: '',
      stock_type: 'Full Set',
      notes: '',
      zone_id: '',
      region_id: '',
    });
  };

  const handleSubmit = async () => {
    // Validate smartcard
    const scValidation = validateSmartcard(formData.smartcard_number);
    if (!scValidation.valid) {
      toast({
        title: 'Validation Error',
        description: scValidation.message,
        variant: 'destructive',
      });
      return;
    }

    // Validate serial number
    const snValidation = validateSerialNumber(formData.serial_number);
    if (!snValidation.valid) {
      toast({
        title: 'Validation Error',
        description: snValidation.message,
        variant: 'destructive',
      });
      return;
    }

    const itemData = {
      smartcard_number: formData.smartcard_number,
      serial_number: formData.serial_number.toUpperCase(),
      stock_type: formData.stock_type,
      notes: formData.notes || null,
      zone_id: formData.zone_id || null,
      region_id: formData.region_id || null,
    };

    const { error } = editingItem
      ? await supabase.from('inventory').update(itemData).eq('id', editingItem.id)
      : await supabase.from('inventory').insert([itemData]);

    if (!error) {
      toast({ title: 'Success', description: editingItem ? 'Stock updated!' : 'Stock added!' });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkUpload = async () => {
    const items = bulkInput
      .trim()
      .split('\n')
      .map((line) => {
        const [sc, sn, type] = line.split(',').map((s) => s.trim());
        return {
          smartcard_number: sc,
          serial_number: sn,
          stock_type: type || 'Full Set',
          zone_id: formData.zone_id || null,
          region_id: formData.region_id || null,
        };
      })
      .filter((item) => item.smartcard_number && item.serial_number);

    if (items.length === 0) {
      toast({ title: 'No valid items', description: 'Please enter valid data.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('inventory').insert(items);
    if (!error) {
      toast({ title: 'Success', description: `${items.length} items added.` });
      setBulkDialogOpen(false);
      setBulkInput('');
      resetForm();
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      const sheet = workbook.worksheets[0];
      const rows: any[][] = [];
      sheet.eachRow((row, rowNumber) => {
        rows.push(row.values as any[]);
      });

      const parsed = rows.slice(1).map((row, index) => {
        const sc = String(row[1] || '').trim();
        const sn = String(row[2] || '').trim().toUpperCase();
        const type = (row[3] || 'Full Set').toString();
        const errors: string[] = [];

        const scVal = validateSmartcard(sc);
        if (!sc || !scVal.valid) errors.push(scVal.message || 'Invalid smartcard');

        const snVal = validateSerialNumber(sn);
        if (!sn || !snVal.valid) errors.push(snVal.message || 'Invalid serial');

        return {
          smartcard_number: sc,
          serial_number: sn,
          stock_type: type,
          zone_id: formData.zone_id || null,
          region_id: formData.region_id || null,
          valid: errors.length === 0,
          errors,
          __row: index + 2,
        } as any;
      });

      if (parsed.length === 0) {
        toast({ title: 'No rows found in the sheet', variant: 'destructive' });
        return;
      }

      setExcelPreview(parsed as any);
      setExcelDialogOpen(true);
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeExcelRow = (idx: number) => {
    setExcelPreview((prev) => prev.filter((_, i) => i !== idx));
  };

  const confirmExcelImport = async () => {
    const items = excelPreview.filter((r) => r.valid).map((r) => ({
      smartcard_number: r.smartcard_number,
      serial_number: r.serial_number,
      stock_type: r.stock_type || 'Full Set',
      zone_id: r.zone_id || null,
      region_id: r.region_id || null,
    }));

    if (items.length === 0) {
      toast({ title: 'No valid rows', description: 'Please fix or remove invalid rows before importing.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('inventory').insert(items);
    if (!error) {
      toast({ title: 'Imported', description: `${items.length} items added from Excel.` });
      setExcelDialogOpen(false);
      setExcelPreview([]);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from('inventory').delete().eq('id', deleteItem.id);
    if (!error) {
      toast({ title: 'Deleted', description: 'Stock item removed.' });
      setDeleteDialogOpen(false);
      setDeleteItem(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    const { error } = await supabase.from('inventory').delete().in('id', selectedItems);
    if (!error) {
      toast({ title: 'Deleted', description: `${selectedItems.length} items removed.` });
      setSelectedItems([]);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      smartcard_number: item.smartcard_number,
      serial_number: item.serial_number,
      stock_type: item.stock_type,
      notes: item.notes || '',
      zone_id: item.zone_id || '',
      region_id: item.region_id || '',
    });
    setDialogOpen(true);
  };

  const exportToExcel = async () => {
    const exportData = filteredInventory.map((item) => ({
      'Smartcard Number': item.smartcard_number,
      'Serial Number': item.serial_number,
      'Stock Type': item.stock_type,
      Status: item.status,
      'Payment Status': item.payment_status,
      'Package Status': item.package_status,
      Zone: zones.find((z) => z.id === item.zone_id)?.name || '',
      Region: regions.find((r) => r.id === item.region_id)?.name || '',
      Notes: item.notes || '',
    }));

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Inventory');
    if (exportData.length > 0) {
      ws.columns = Object.keys(exportData[0]).map(key => ({ header: key, key }));
      ws.addRows(exportData);
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredInventory = inventory.filter((i) => {
    const matchesSearch =
      i.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.serial_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesZone = zoneFilter === 'all' || i.zone_id === zoneFilter;
    const matchesRegion = regionFilter === 'all' || i.region_id === regionFilter;
    return matchesSearch && matchesStatus && matchesZone && matchesRegion;
  });

  const filteredRegions = formData.zone_id
    ? regions.filter((r) => r.zone_id === formData.zone_id)
    : regions;

  // Filter regions for the dropdown based on selected zone
  const filteredRegionsForFilter = zoneFilter === 'all' 
    ? regions 
    : regions.filter(r => r.zone_id === zoneFilter);

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

  // Overall statistics
  const stats = {
    total: inventory.length,
    available: inventory.filter((i) => i.status === 'available').length,
    sold: inventory.filter((i) => i.status === 'sold').length,
    assigned: inventory.filter((i) => i.assigned_to_id).length,
    inhand: inventory.filter((i) => i.status === 'available').length - inventory.filter((i) => i.assigned_to_id).length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Inventory Management
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Add, edit, and manage stock</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="glass-button" onClick={() => setBulkDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Bulk Upload
            </Button>
            <Button
              variant="outline"
              className="glass-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel Import
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleExcelUpload}
              accept=".xlsx,.xls"
              className="hidden"
              aria-label="Import Excel file"
            />
            <Button variant="outline" className="glass-button" onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-secondary text-primary-foreground"
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Stock
            </Button>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <GlassCard className="text-center">
            <Box className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Stock</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-500">{stats.available}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </GlassCard>
          <GlassCard className="text-center">
            <X className="h-8 w-8 mx-auto text-red-500 mb-2" />
            <p className="text-2xl font-bold text-red-500">{stats.sold}</p>
            <p className="text-xs text-muted-foreground">Sold</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Users className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-blue-500">{stats.assigned}</p>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </GlassCard>
          <GlassCard className="text-center">
            <ShoppingCart className="h-8 w-8 mx-auto text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-amber-500">{stats.inhand}</p>
            <p className="text-xs text-muted-foreground">In-hand</p>
          </GlassCard>
        </div>

        {/* Region Summary Cards */}
        {regionSummaries.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Region-wise Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {regionSummaries.map((summary) => (
                <GlassCard key={summary.region_id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-base">{summary.region_name}</h4>
                      <p className="text-xs text-muted-foreground">{summary.zone_name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {summary.total} Total
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Available</span>
                      <Badge className="bg-green-500/20 text-green-500 text-xs">
                        {summary.available}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Sold</span>
                      <Badge className="bg-red-500/20 text-red-500 text-xs">
                        {summary.sold}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Assigned</span>
                      <Badge className="bg-blue-500/20 text-blue-500 text-xs">
                        {summary.assigned}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">In-hand</span>
                      <Badge className="bg-amber-500/20 text-amber-500 text-xs">
                        {summary.inhand}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="text-center">
                        <div>Available %</div>
                        <div className="font-semibold">
                          {summary.total > 0 ? ((summary.available / summary.total) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div>Sold %</div>
                        <div className="font-semibold">
                          {summary.total > 0 ? ((summary.sold / summary.total) * 100).toFixed(1) : 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <GlassCard>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search serial or smartcard..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            <Select value={zoneFilter} onValueChange={(value) => {
              setZoneFilter(value);
              setRegionFilter('all'); // Reset region filter when zone changes
            }}>
              <SelectTrigger className="w-[150px] glass-input">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[150px] glass-input">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {filteredRegionsForFilter.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] glass-input">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="inhand">In-hand</SelectItem>
              </SelectContent>
            </Select>
            {selectedItems.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete ({selectedItems.length})
              </Button>
            )}
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedItems.length === filteredInventory.length && filteredInventory.length > 0}
                    onCheckedChange={(val) =>
                      setSelectedItems(val ? filteredInventory.map((i) => i.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>Smartcard / Serial</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Zone / Region</TableHead>
                <TableHead>Status & Assignment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No inventory items found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory.slice(0, 50).map((item) => {
                  const assignedName = getAssignedName(item);
                  const assignedIcon = getAssignedIcon(item.assigned_to_type);
                  const assignedBadgeColor = getAssignedBadgeColor(item.assigned_to_type);
                  const assignedRoleName = getAssignedRoleName(item.assigned_to_type);
                  
                  // Determine if item is "In-hand" (available but not assigned)
                  const isInhand = item.status === 'available' && !item.assigned_to_id;
                  
                  return (
                    <TableRow key={item.id} className="border-border/30 hover:bg-primary/5">
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() =>
                            setSelectedItems((prev) =>
                              prev.includes(item.id)
                                ? prev.filter((id) => id !== item.id)
                                : [...prev, item.id]
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.smartcard_number}</div>
                        <div className="text-xs text-muted-foreground">{item.serial_number}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.stock_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{zones.find((z) => z.id === item.zone_id)?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {regions.find((r) => r.id === item.region_id)?.name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {/* Main Status Badge */}
                          <div>
                            {item.status === 'sold' ? (
                              <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                                <X className="h-3 w-3 mr-1" />
                                Sold
                              </Badge>
                            ) : isInhand ? (
                              <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                                <ShoppingCart className="h-3 w-3 mr-1" />
                                In-hand
                              </Badge>
                            ) : (
                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                <Check className="h-3 w-3 mr-1" />
                                Available
                              </Badge>
                            )}
                          </div>
                          
                          {/* Assignment Details */}
                          {item.assigned_to_id && assignedName && (
                            <div className="flex items-center gap-2">
                              <Badge className={`${assignedBadgeColor} text-xs flex items-center gap-1`}>
                                {assignedIcon}
                                {assignedRoleName}: {assignedName}
                              </Badge>
                            </div>
                          )}
                          
                          {/* Region Assignment (if no personal assignment) */}
                          {!item.assigned_to_id && item.region_id && (
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Region: {regions.find(r => r.id === item.region_id)?.name}
                              </Badge>
                            </div>
                          )}
                          
                          {/* No Assignment Status */}
                          {!item.assigned_to_id && !item.region_id && item.status === 'available' && (
                            <Badge variant="outline" className="text-xs">
                              Unassigned
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleteItem(item);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
          {filteredInventory.length > 50 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Showing 50 of {filteredInventory.length} items
            </div>
          )}
        </GlassCard>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Stock' : 'Add Stock'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Smartcard Number *</Label>
                  <Input
                    value={formData.smartcard_number}
                    onChange={(e) => setFormData({ ...formData, smartcard_number: e.target.value })}
                    className="glass-input"
                    placeholder="8212345678"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formatSmartcardHint()}
                  </p>
                </div>
                <div>
                  <Label>Serial Number *</Label>
                  <Input
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value.toUpperCase() })}
                    className="glass-input"
                    placeholder="S07512345678"
                    maxLength={12}
                  />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formatSerialHint()}
                  </p>
                </div>
              </div>
              <div>
                <Label>Stock Type</Label>
                <Select
                  value={formData.stock_type}
                  onValueChange={(v) => setFormData({ ...formData, stock_type: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Zone</Label>
                  <Select
                    value={formData.zone_id}
                    onValueChange={(v) => setFormData({ ...formData, zone_id: v, region_id: '' })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Region</Label>
                  <Select
                    value={formData.region_id}
                    onValueChange={(v) => setFormData({ ...formData, region_id: v })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRegions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="glass-input"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="bg-gradient-to-r from-primary to-secondary">
                {editingItem ? 'Update' : 'Add Stock'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Upload Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Bulk Upload Stock</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter one item per line: smartcard, serial, type (optional)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Zone</Label>
                  <Select
                    value={formData.zone_id}
                    onValueChange={(v) => setFormData({ ...formData, zone_id: v, region_id: '' })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Region</Label>
                  <Select
                    value={formData.region_id}
                    onValueChange={(v) => setFormData({ ...formData, region_id: v })}
                  >
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRegions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="123456789, SN001, Full Set&#10;987654321, SN002, Decoder Only"
                className="glass-input"
                rows={8}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkUpload} className="bg-gradient-to-r from-primary to-secondary">
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Excel Preview Dialog */}
        <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-4xl">
            <DialogHeader>
              <DialogTitle>Excel Import Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-auto">
              <p className="text-sm text-muted-foreground">Rows marked in red have validation errors and won't be imported. Remove or fix them before confirming.</p>
              <div className="overflow-auto">
                <table className="w-full text-sm table-auto border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">#</th>
                      <th className="p-2">Smartcard</th>
                      <th className="p-2">Serial</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r, i) => (
                      <tr key={i} className={r.valid ? 'bg-transparent' : 'bg-red-50'}>
                        <td className="p-2 align-top">{r.__row || i + 2}</td>
                        <td className="p-2 align-top">{r.smartcard_number}</td>
                        <td className="p-2 align-top">{r.serial_number}</td>
                        <td className="p-2 align-top">{r.stock_type}</td>
                        <td className="p-2 align-top">
                          {r.valid ? (
                            <Badge>Valid</Badge>
                          ) : (
                            <div className="text-xs text-destructive">
                              {r.errors.join('; ')}
                            </div>
                          )}
                        </td>
                        <td className="p-2 align-top">
                          <Button variant="ghost" size="sm" onClick={() => removeExcelRow(i)}>Remove</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setExcelDialogOpen(false); setExcelPreview([]); }}>
                Cancel
              </Button>
              <Button onClick={confirmExcelImport} className="bg-gradient-to-r from-primary to-secondary">
                Import Valid Rows
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Delete Stock</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Are you sure you want to delete stock <strong>{deleteItem?.smartcard_number}</strong>?
              This action cannot be undone.
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