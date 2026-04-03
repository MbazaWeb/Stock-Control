import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRight,
  Package,
  Search,
  Users,
  UserPlus,
  User,
  Send,
  History,
  Edit,
  Trash2,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Smartphone,
  FileSpreadsheet,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
// ExcelJS loaded dynamically in handleExport

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  zone_id: string | null;
  region_id: string | null;
  zone_name: string | null;
  region_name: string | null;
  created_at: string;
}

interface TeamLeader {
  id: string;
  name: string;
  region_id?: string | null;
}

interface Captain {
  id: string;
  name: string;
  team_leader_id: string | null;
  team_leaders?: { name: string } | null;
}

interface DSR {
  id: string;
  name: string;
  captain_id: string | null;
  captains?: { name: string; team_leader_id?: string | null } | null;
}

interface AssignmentStats {
  total: number;
  available: number;
  assignedTL: number;
  assignedCaptain: number;
  assignedDSR: number;
  sold: number;
  denied: number;
  returned: number;
  readyForAssignment: number;
  assignmentRate: number;
}

interface AssignmentHistory {
  id: string;
  inventory_id: string;
  assigned_to_type: string;
  assigned_to_id: string;
  assigned_by: string;
  assigned_at: string;
  notes: string | null;
  previous_assignment: string | null;
}

export default function AssignStockPage() {
  const { toast } = useToast();
  const { isRegionalAdmin, assignedRegionIds } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bulkSelectAll, setBulkSelectAll] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  
  const [assignmentData, setAssignmentData] = useState({
    assign_type: 'team_leader',
    assign_to_id: '',
    zone_id: '',
    region_id: '',
    notes: '',
    effective_date: new Date().toISOString().split('T')[0],
  });

  const [bulkEditData, setBulkEditData] = useState({
    status: '',
    notes: '',
  });

  const [stats, setStats] = useState<AssignmentStats>({
    total: 0,
    available: 0,
    assignedTL: 0,
    assignedCaptain: 0,
    assignedDSR: 0,
    sold: 0,
    denied: 0,
    returned: 0,
    readyForAssignment: 0,
    assignmentRate: 0,
  });

  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [zones, setZones] = useState<Array<{id: string, name: string}>>([]);
  const [regions, setRegions] = useState<Array<{id: string, name: string, zone_id: string | null}>>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build inventory query with region filtering for regional admins
      let invQuery = supabase
        .from('inventory')
        .select('*, zones!inventory_zone_id_fkey(name), regions!inventory_region_id_fkey(name)')
        .order('created_at', { ascending: false });
      
      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        invQuery = invQuery.in('region_id', assignedRegionIds);
      }

      const [
        invRes,
        tlRes,
        capRes,
        dsrRes,
        zoneRes,
        regionRes,
      ] = await Promise.all([
        invQuery,
        supabase.from('team_leaders').select('id, name, region_id'),
        supabase.from('captains').select('*, team_leaders!captains_team_leader_id_fkey(name)'),
        supabase.from('dsrs').select('*, captains!dsrs_captain_id_fkey(name, team_leader_id)'),
        supabase.from('zones').select('id, name').order('name'),
        supabase.from('regions').select('id, name, zone_id').order('name'),
      ]);

      if (invRes.data) {
        const formattedData = invRes.data.map(item => ({
          ...item,
          zone_name: item.zones?.name || null,
          region_name: item.regions?.name || null
        }));
        setInventory(formattedData);
        calculateStats(formattedData);
      }
      
      // For regional admins, filter team leaders by assigned regions
      if (tlRes.data) {
        const filteredTLs = isRegionalAdmin && assignedRegionIds.length > 0
          ? tlRes.data.filter(tl => tl.region_id && assignedRegionIds.includes(tl.region_id))
          : tlRes.data;
        setTeamLeaders(filteredTLs);
      }
      if (capRes.data) setCaptains(capRes.data);
      if (dsrRes.data) setDsrs(dsrRes.data);
      if (zoneRes.data) setZones(zoneRes.data);
      // For regional admins, filter regions
      if (regionRes.data) {
        const filteredRegions = isRegionalAdmin && assignedRegionIds.length > 0
          ? regionRes.data.filter(r => assignedRegionIds.includes(r.id))
          : regionRes.data;
        setRegions(filteredRegions);
      }
    } catch (error: unknown) {
      toast({ 
        title: 'Error fetching data', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = useCallback((data: InventoryItem[]) => {
    const total = data.length;
    const available = data.filter(i => i.status === 'available' && !i.assigned_to_id).length;
    const assignedTL = data.filter(i => i.assigned_to_type === 'team_leader').length;
    const assignedCaptain = data.filter(i => i.assigned_to_type === 'captain').length;
    const assignedDSR = data.filter(i => i.assigned_to_type === 'dsr').length;
    const sold = data.filter(i => i.status === 'sold').length;
    const denied = data.filter(i => i.status === 'denied').length;
    const returned = data.filter(i => i.status === 'returned').length;
    const readyForAssignment = available + assignedTL + assignedCaptain + assignedDSR;
    const assignmentRate = total > 0 ? ((assignedTL + assignedCaptain + assignedDSR) / total) * 100 : 0;

    setStats({
      total,
      available,
      assignedTL,
      assignedCaptain,
      assignedDSR,
      sold,
      denied,
      returned,
      readyForAssignment,
      assignmentRate: parseFloat(assignmentRate.toFixed(1)),
    });
  }, []);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = 
        item.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.serial_number.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesType = typeFilter === 'all' || item.stock_type === typeFilter;
      
      let matchesAssignment = true;
      if (assignmentFilter !== 'all') {
        if (assignmentFilter === 'assigned') {
          matchesAssignment = !!item.assigned_to_id;
        } else if (assignmentFilter === 'unassigned') {
          matchesAssignment = !item.assigned_to_id;
        } else {
          matchesAssignment = item.assigned_to_type === assignmentFilter;
        }
      }

      const matchesZone = zoneFilter === 'all' || item.zone_id === zoneFilter;
      const matchesRegion =
        regionFilter === 'all' ||
        (regionFilter === 'unassigned' ? !item.region_id : item.region_id === regionFilter);

      // Tab-based filtering
      if (activeTab !== 'all') {
        if (activeTab === 'available') {
          return matchesSearch && item.status === 'available' && !item.assigned_to_id;
        } else if (activeTab === 'assigned') {
          return matchesSearch && item.assigned_to_id !== null;
        } else if (activeTab === 'sold') {
          return matchesSearch && item.status === 'sold';
        }
      }

      return matchesSearch && matchesStatus && matchesType && matchesAssignment && matchesZone && matchesRegion;
    });
  }, [inventory, searchQuery, statusFilter, typeFilter, assignmentFilter, zoneFilter, regionFilter, activeTab]);

  const eligibleForSelection = useMemo(() => {
    return filteredInventory.filter(item => 
      item.status !== 'sold' && item.status !== 'denied'
    ).map(item => item.id);
  }, [filteredInventory]);

  const assignmentRegions = useMemo(() => {
    if (!assignmentData.zone_id) {
      return regions;
    }

    return regions.filter(region => region.zone_id === assignmentData.zone_id);
  }, [assignmentData.zone_id, regions]);

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === eligibleForSelection.length) {
      setSelectedItems([]);
      setBulkSelectAll(false);
    } else {
      setSelectedItems([...eligibleForSelection]);
      setBulkSelectAll(true);
    }
  };

  const handleAssign = async () => {
    if (selectedItems.length === 0) {
      toast({ 
        title: 'No items selected', 
        description: 'Please select at least one item to assign.',
        variant: 'destructive' 
      });
      return;
    }

    if (!assignmentData.assign_to_id) {
      toast({ 
        title: 'No recipient selected', 
        description: 'Please select a team member to assign stock to.',
        variant: 'destructive' 
      });
      return;
    }

    if (!assignmentData.zone_id) {
      toast({
        title: 'Zone required',
        description: 'Please select a zone before assigning stock.',
        variant: 'destructive'
      });
      return;
    }

    if (!assignmentData.region_id) {
      toast({
        title: 'Region required',
        description: 'Please select a region before assigning stock.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Check if any selected items are already sold or denied
      const selectedItemsData = inventory.filter(item => selectedItems.includes(item.id));
      const invalidItems = selectedItemsData.filter(item => 
        item.status === 'sold' || item.status === 'denied'
      );

      if (invalidItems.length > 0) {
        toast({ 
          title: 'Cannot assign sold/denied items', 
          description: `${invalidItems.length} items are sold or denied and cannot be assigned.`,
          variant: 'destructive' 
        });
        return;
      }

      // Update inventory
      const { error } = await supabase
        .from('inventory')
        .update({
          status: 'assigned',
          assigned_to_type: assignmentData.assign_type,
          assigned_to_id: assignmentData.assign_to_id,
          zone_id: assignmentData.zone_id,
          region_id: assignmentData.region_id,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedItems);

      if (error) throw error;

      // Assignment history logging (skipped - table not yet created)

      toast({ 
        title: 'Stock Assigned Successfully', 
        description: `${selectedItems.length} items assigned to ${getAssigneeName()}.`,
      });

      setAssignDialogOpen(false);
      setSelectedItems([]);
      setAssignmentData({
        assign_type: 'team_leader',
        assign_to_id: '',
        zone_id: '',
        region_id: '',
        notes: '',
        effective_date: new Date().toISOString().split('T')[0],
      });
      fetchData();
    } catch (error: unknown) {
      toast({ 
        title: 'Assignment Failed', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (selectedItems.length === 0) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          status: 'available',
          assigned_to_type: null,
          assigned_to_id: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedItems);

      if (error) throw error;

      toast({ 
        title: 'Stock Unassigned', 
        description: `${selectedItems.length} items returned to available stock.` 
      });
      setSelectedItems([]);
      fetchData();
    } catch (error: unknown) {
      toast({ 
        title: 'Operation Failed', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEdit = async () => {
    if (selectedItems.length === 0) return;

    setLoading(true);
    try {
      const updateData: Record<string, string | null> = {};
      if (bulkEditData.status) {
        updateData.status = bulkEditData.status;
        if (bulkEditData.status === 'available') {
          updateData.assigned_to_type = null;
          updateData.assigned_to_id = null;
        }
        updateData.updated_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('inventory')
        .update(updateData)
        .in('id', selectedItems);

      if (error) throw error;

      // Inventory history logging (skipped - table not yet created)

      toast({ title: 'Bulk Update Successful', description: `${selectedItems.length} items updated.` });
      setBulkEditDialogOpen(false);
      setSelectedItems([]);
      setBulkEditData({ status: '', notes: '' });
      fetchData();
    } catch (error: unknown) {
      toast({ 
        title: 'Bulk Update Failed', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'selected' | 'filtered' | 'all') => {
    setExporting(true);
    try {
      let exportData: InventoryItem[] = [];

      switch (type) {
        case 'selected':
          exportData = inventory.filter(item => selectedItems.includes(item.id));
          break;
        case 'filtered':
          exportData = filteredInventory;
          break;
        case 'all':
          exportData = inventory;
          break;
      }

      if (exportData.length === 0) {
        toast({ title: 'No data to export', variant: 'destructive' });
        return;
      }

      // Format data for Excel
      const formattedData = exportData.map(item => ({
        'Smartcard Number': item.smartcard_number,
        'Serial Number': item.serial_number,
        'Stock Type': item.stock_type,
        'Status': item.status,
        'Assigned To Type': item.assigned_to_type || 'N/A',
        'Assigned To ID': item.assigned_to_id || 'N/A',
        'Zone': item.zone_name || 'N/A',
        'Region': item.region_name || 'N/A',
        'Created Date': new Date(item.created_at).toLocaleDateString(),
        'Assignee Name': getFullAssigneeName(item),
      }));

      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Assignments');
      if (formattedData.length > 0) {
        ws.columns = Object.keys(formattedData[0]).map(key => ({ header: key, key }));
        ws.addRows(formattedData);
      }
      
      const filename = `stock_assignments_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Export Successful', description: `${exportData.length} items exported.` });
    } catch (error: unknown) {
      toast({ title: 'Export Failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setExporting(false);
      setExportDialogOpen(false);
    }
  };

  const fetchAssignmentHistory = async (inventoryId: string) => {
    // assignment_history table not yet created - show items from inventory
    setAssignmentHistory([]);
    setSelectedInventoryItem(inventory.find(item => item.id === inventoryId) || null);
    setHistoryDialogOpen(true);
  };

  const getAssigneeName = () => {
    if (!assignmentData.assign_to_id) return '';
    
    switch (assignmentData.assign_type) {
      case 'team_leader':
        return teamLeaders.find(t => t.id === assignmentData.assign_to_id)?.name || '';
      case 'captain':
        return captains.find(c => c.id === assignmentData.assign_to_id)?.name || '';
      case 'dsr':
        return dsrs.find(d => d.id === assignmentData.assign_to_id)?.name || '';
      default:
        return '';
    }
  };

  const getFullAssigneeName = (item: InventoryItem) => {
    if (!item.assigned_to_type || !item.assigned_to_id) return 'Unassigned';
    
    switch (item.assigned_to_type) {
      case 'team_leader':
        return `TL: ${teamLeaders.find(t => t.id === item.assigned_to_id)?.name || 'Unknown'}`;
      case 'captain':
        return `Captain: ${captains.find(c => c.id === item.assigned_to_id)?.name || 'Unknown'}`;
      case 'dsr':
        return `DSR: ${dsrs.find(d => d.id === item.assigned_to_id)?.name || 'Unknown'}`;
      default:
        return 'Unknown';
    }
  };

  const getAssigneeOptions = () => {
    switch (assignmentData.assign_type) {
      case 'team_leader':
        return teamLeaders.map(tl => ({ id: tl.id, name: tl.name, type: 'Team Leader' }));
      case 'captain':
        return captains.map(cap => ({ 
          id: cap.id, 
          name: cap.name, 
          type: 'Captain',
          team_leader: teamLeaders.find(tl => tl.id === cap.team_leader_id)?.name 
        }));
      case 'dsr':
        return dsrs.map(dsr => ({ 
          id: dsr.id, 
          name: dsr.name, 
          type: 'DSR',
          captain: captains.find(cap => cap.id === dsr.captain_id)?.name,
          team_leader: captains.find(cap => cap.id === dsr.captain_id)?.team_leaders?.name
        }));
      default:
        return [];
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available': return 'default';
      case 'assigned': return 'secondary';
      case 'sold': return 'success';
      case 'denied': return 'destructive';
      case 'returned': return 'outline';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="h-3 w-3" />;
      case 'assigned': return <User className="h-3 w-3" />;
      case 'sold': return <Package className="h-3 w-3" />;
      case 'denied': return <XCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  const getAssigneeColor = (type: string | null) => {
    switch (type) {
      case 'team_leader': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'captain': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'dsr': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Stock Assignment Management
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Assign, track, and manage stock distribution across your sales team
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading}
              className="glass-button"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
              className="glass-button"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <GlassCard className="text-center p-4 hover:shadow-lg transition-shadow">
            <Package className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Stock</p>
            <Progress value={100} className="h-1 mt-2" />
          </GlassCard>
          
          <GlassCard className="text-center p-4 hover:shadow-lg transition-shadow">
            <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats.available}</p>
            <p className="text-xs text-muted-foreground">Available</p>
            <div className="mt-2 text-xs">
              {stats.total > 0 ? `${((stats.available / stats.total) * 100).toFixed(1)}%` : '0%'}
            </div>
          </GlassCard>
          
          <GlassCard className="text-center p-4 hover:shadow-lg transition-shadow">
            <Users className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{stats.assignedTL + stats.assignedCaptain + stats.assignedDSR}</p>
            <p className="text-xs text-muted-foreground">Assigned</p>
            <div className="mt-2 text-xs">
              {stats.assignmentRate}% rate
            </div>
          </GlassCard>
          
          <GlassCard className="text-center p-4 hover:shadow-lg transition-shadow">
            <Smartphone className="h-6 w-6 mx-auto text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{stats.sold}</p>
            <p className="text-xs text-muted-foreground">Sold</p>
            <div className="mt-2 text-xs text-secondary">
              Finalized
            </div>
          </GlassCard>
          
          <GlassCard className="text-center p-4 hover:shadow-lg transition-shadow">
            <BarChart3 className="h-6 w-6 mx-auto text-orange-500 mb-2" />
            <p className="text-2xl font-bold">{stats.readyForAssignment}</p>
            <p className="text-xs text-muted-foreground">Ready to Assign</p>
            <div className="mt-2 text-xs">
              {stats.available} available + {stats.assignedTL + stats.assignedCaptain + stats.assignedDSR} assigned
            </div>
          </GlassCard>
        </div>

        {/* Tabs & Filters */}
        <GlassCard>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="glass-input p-1">
              <TabsTrigger value="all" className="text-xs px-3">All Items</TabsTrigger>
              <TabsTrigger value="available" className="text-xs px-3">Available</TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs px-3">Assigned</TabsTrigger>
              <TabsTrigger value="sold" className="text-xs px-3">Sold</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-4 items-center mt-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by smartcard, serial, or assignee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] glass-input">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>

              <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                <SelectTrigger className="w-[150px] glass-input">
                  <SelectValue placeholder="Assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="team_leader">Team Leaders</SelectItem>
                  <SelectItem value="captain">Captains</SelectItem>
                  <SelectItem value="dsr">DSRs</SelectItem>
                </SelectContent>
              </Select>

              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-[150px] glass-input">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map(zone => (
                    <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-[150px] glass-input">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {(zoneFilter === 'all' ? regions : regions.filter(r => r.zone_id === zoneFilter)).map(region => (
                    <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                  ))}
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex flex-wrap items-center gap-4">
                <Badge variant="secondary" className="px-3 py-1">
                  {selectedItems.length} selected
                </Badge>
                <Button
                  size="sm"
                  onClick={() => setAssignDialogOpen(true)}
                  disabled={selectedItems.some(id => 
                    inventory.find(item => item.id === id)?.status === 'sold'
                  )}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Assign Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnassign}
                  disabled={selectedItems.some(id => 
                    inventory.find(item => item.id === id)?.status === 'sold'
                  )}
                >
                  <History className="h-4 w-4 mr-2" />
                  Unassign
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkEditDialogOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Bulk Edit
                </Button>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Inventory Table */}
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedItems.length === eligibleForSelection.length && eligibleForSelection.length > 0}
                      onCheckedChange={toggleSelectAll}
                      disabled={eligibleForSelection.length === 0}
                    />
                  </TableHead>
                  <TableHead>Smartcard / Serial</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Zone / Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array(10).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">No inventory items found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Try adjusting your filters or add new inventory
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className={`hover:bg-primary/5 transition-colors ${
                        selectedItems.includes(item.id) ? 'bg-primary/10' : ''
                      }`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          disabled={item.status === 'sold' || item.status === 'denied'}
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
                        <div className="space-y-1">
                          {item.zone_name && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {item.zone_name}
                            </Badge>
                          )}
                          {item.region_name && (
                            <div className="text-xs text-muted-foreground">{item.region_name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusBadgeVariant(item.status)}
                          className="gap-1"
                        >
                          {getStatusIcon(item.status)}
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.assigned_to_type && item.assigned_to_id ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getAssigneeColor(item.assigned_to_type)}>
                              {item.assigned_to_type === 'team_leader' ? 'TL' : 
                               item.assigned_to_type === 'captain' ? 'CPT' : 'DSR'}
                            </Badge>
                            <span className="text-sm">{getFullAssigneeName(item)}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fetchAssignmentHistory(item.id)}
                            title="View History"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {filteredInventory.length > 0 && (
            <div className="p-4 border-t border-border/50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredInventory.length} of {inventory.length} items
                </div>
                <div className="text-sm text-muted-foreground">
                  {eligibleForSelection.length} eligible for assignment
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="glass-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Stock</DialogTitle>
            <DialogDescription>
              Assign {selectedItems.length} selected items to a team member
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select
                value={assignmentData.assign_type}
                onValueChange={(v) => setAssignmentData({...assignmentData, assign_type: v, assign_to_id: ''})}
              >
                <SelectTrigger className="glass-input">
                  <SelectValue placeholder="Select assignment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="captain">Captain</SelectItem>
                  <SelectItem value="dsr">DSR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Recipient</Label>
              <Select
                value={assignmentData.assign_to_id}
                onValueChange={(v) => setAssignmentData({...assignmentData, assign_to_id: v})}
                disabled={!assignmentData.assign_type}
              >
                <SelectTrigger className="glass-input">
                  <SelectValue placeholder={`Select ${assignmentData.assign_type}`} />
                </SelectTrigger>
                <SelectContent>
                  {getAssigneeOptions().map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      <div className="flex flex-col">
                        <span>{person.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {person.type}
                          {('team_leader' in person) && ` • TL: ${person.team_leader}`}
                          {('captain' in person) && ` • CPT: ${person.captain}`}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Zone</Label>
                <Select
                  value={assignmentData.zone_id}
                  onValueChange={(v) => setAssignmentData({ ...assignmentData, zone_id: v, region_id: '' })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Region</Label>
                <Select
                  value={assignmentData.region_id}
                  onValueChange={(v) => setAssignmentData({ ...assignmentData, region_id: v })}
                  disabled={!assignmentData.zone_id}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentRegions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>{region.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={assignmentData.effective_date}
                onChange={(e) => setAssignmentData({...assignmentData, effective_date: e.target.value})}
                className="glass-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about this assignment..."
                value={assignmentData.notes}
                onChange={(e) => setAssignmentData({...assignmentData, notes: e.target.value})}
                className="glass-input"
                rows={3}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Important:</p>
                  <p className="mt-1">This action will mark selected items as "assigned", link them to the selected team member, and update their zone and region.</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!assignmentData.assign_to_id || !assignmentData.zone_id || !assignmentData.region_id || loading}>
              {loading ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle>Bulk Edit {selectedItems.length} Items</DialogTitle>
            <DialogDescription>
              Update status and add notes for selected items
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status Update</Label>
              <Select
                value={bulkEditData.status}
                onValueChange={(v) => setBulkEditData({...bulkEditData, status: v})}
              >
                <SelectTrigger className="glass-input">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add notes for this bulk update..."
                value={bulkEditData.notes}
                onChange={(e) => setBulkEditData({...bulkEditData, notes: e.target.value})}
                className="glass-input"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkEdit} disabled={loading}>
              {loading ? 'Updating...' : 'Update Items'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="glass-card border-border/50 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assignment History</DialogTitle>
            <DialogDescription>
              {selectedInventoryItem && (
                <div className="mt-2">
                  <p className="font-medium">{selectedInventoryItem.smartcard_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedInventoryItem.serial_number}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto">
            {assignmentHistory.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No assignment history found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignmentHistory.map((history, index) => (
                  <div key={history.id} className="border-l-2 border-primary pl-4 py-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          Assigned to {history.assigned_to_type}: {
                            history.assigned_to_type === 'team_leader' 
                              ? teamLeaders.find(t => t.id === history.assigned_to_id)?.name
                              : history.assigned_to_type === 'captain'
                              ? captains.find(c => c.id === history.assigned_to_id)?.name
                              : dsrs.find(d => d.id === history.assigned_to_id)?.name
                          }
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          By {history.assigned_by} • {new Date(history.assigned_at).toLocaleString()}
                        </p>
                        {history.notes && (
                          <p className="text-sm mt-2 p-2 bg-muted/50 rounded">{history.notes}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2">
                        #{assignmentHistory.length - index}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
            <DialogDescription>
              Choose what data to export as Excel spreadsheet
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-4">
            <Button
              variant="outline"
              onClick={() => handleExport('selected')}
              disabled={selectedItems.length === 0 || exporting}
              className="justify-start"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Selected Items ({selectedItems.length})
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleExport('filtered')}
              disabled={filteredInventory.length === 0 || exporting}
              className="justify-start"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Filtered Items ({filteredInventory.length})
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleExport('all')}
              disabled={inventory.length === 0 || exporting}
              className="justify-start"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export All Items ({inventory.length})
            </Button>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}