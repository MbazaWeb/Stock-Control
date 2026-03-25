import { useState, useEffect, useCallback } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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
  region_id: string | null;
  zone_id: string | null;
  inventory_id: string | null;
}

interface TeamLeader {
  id: string;
  name: string;
  region_id: string | null;
}

interface Region {
  id: string;
  name: string;
  zone_id: string | null;
}

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
}

export default function RecordSalePage() {
  const { toast } = useToast();
  const { isRegionalAdmin, assignedRegionIds } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [tlStock, setTlStock] = useState<InventoryItem[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [deleteSale, setDeleteSale] = useState<SaleRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Simple form state
  const [formData, setFormData] = useState({
    region_id: '',
    team_leader_id: '',
    inventory_id: '',
    package_status: 'No Package',
    sale_date: new Date().toISOString().split('T')[0],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Build sales query with region filtering for regional admins
      let salesQuery = supabase.from('sales_records').select('*').order('sale_date', { ascending: false });
      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        salesQuery = salesQuery.in('region_id', assignedRegionIds);
      }

      const [salesRes, tlRes, regionRes] = await Promise.all([
        salesQuery,
        supabase.from('team_leaders').select('id, name, region_id').order('name'),
        supabase.from('regions').select('*').order('name'),
      ]);

      if (salesRes.data) setSales(salesRes.data);
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
    } finally {
      setLoading(false);
    }
  }, [isRegionalAdmin, assignedRegionIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch TL's assigned stock when TL changes
  useEffect(() => {
    if (!formData.team_leader_id) {
      setTlStock([]);
      return;
    }

    const fetchTLStock = async () => {
      const { data } = await supabase
        .from('inventory')
        .select('id, smartcard_number, serial_number, stock_type')
        .eq('assigned_to_type', 'team_leader')
        .eq('assigned_to_id', formData.team_leader_id)
        .eq('status', 'assigned')
        .order('smartcard_number');

      setTlStock(data || []);
    };

    fetchTLStock();
  }, [formData.team_leader_id]);

  // Filter TLs by selected region
  const filteredTLs = formData.region_id
    ? teamLeaders.filter((tl) => tl.region_id === formData.region_id)
    : [];

  const resetForm = () => {
    setEditingSale(null);
    setFormData({
      region_id: '',
      team_leader_id: '',
      inventory_id: '',
      package_status: 'No Package',
      sale_date: new Date().toISOString().split('T')[0],
    });
    setTlStock([]);
  };

  const handleRegionChange = (regionId: string) => {
    setFormData({
      ...formData,
      region_id: regionId,
      team_leader_id: '',
      inventory_id: '',
    });
    setTlStock([]);
  };

  const handleTLChange = (tlId: string) => {
    setFormData({
      ...formData,
      team_leader_id: tlId,
      inventory_id: '',
    });
  };

  const handleSubmit = async () => {
    if (!formData.inventory_id) {
      toast({ title: 'Error', description: 'Please select stock item', variant: 'destructive' });
      return;
    }

    const selectedStock = tlStock.find((s) => s.id === formData.inventory_id);
    if (!selectedStock) {
      toast({ title: 'Error', description: 'Stock not found', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Get zone_id from region
      const region = regions.find((r) => r.id === formData.region_id);

      const saleData = {
        smartcard_number: selectedStock.smartcard_number,
        serial_number: selectedStock.serial_number,
        stock_type: selectedStock.stock_type,
        sale_date: formData.sale_date,
        payment_status: 'Unpaid',
        package_status: formData.package_status,
        team_leader_id: formData.team_leader_id,
        region_id: formData.region_id,
        zone_id: region?.zone_id || null,
        inventory_id: formData.inventory_id,
      };

      if (editingSale) {
        const { error } = await supabase.from('sales_records').update(saleData).eq('id', editingSale.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Sale updated!' });
      } else {
        // Insert sale record
        const { error } = await supabase.from('sales_records').insert([saleData]);
        if (error) throw error;

        // Mark inventory as sold
        await supabase.from('inventory').update({ status: 'sold' }).eq('id', formData.inventory_id);

        toast({ title: 'Success', description: 'Sale recorded!' });
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
    const { error } = await supabase.from('sales_records').delete().eq('id', deleteSale.id);
    if (!error) {
      toast({ title: 'Deleted', description: 'Sale record removed.' });
      setDeleteDialogOpen(false);
      setDeleteSale(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    const { error } = await supabase.from('sales_records').delete().in('id', selectedItems);
    if (!error) {
      toast({ title: 'Deleted', description: `${selectedItems.length} sales removed.` });
      setSelectedItems([]);
      fetchData();
    }
  };

  const handleEditClick = (sale: SaleRecord) => {
    setEditingSale(sale);
    setFormData({
      region_id: sale.region_id || '',
      team_leader_id: sale.team_leader_id || '',
      inventory_id: sale.inventory_id || '',
      package_status: sale.package_status,
      sale_date: sale.sale_date,
    });
    setDialogOpen(true);
  };

  const handleUpdatePaymentStatus = async (sale: SaleRecord, status: string) => {
    const { error } = await supabase.from('sales_records').update({ payment_status: status }).eq('id', sale.id);
    if (!error) {
      toast({ title: 'Success', description: `Payment: ${status}` });
      fetchData();
    }
  };

  const handleUpdatePackageStatus = async (sale: SaleRecord, status: string) => {
    const { error } = await supabase.from('sales_records').update({ package_status: status }).eq('id', sale.id);
    if (!error) {
      toast({ title: 'Success', description: `Package: ${status}` });
      fetchData();
    }
  };

  const filteredSales = sales.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.smartcard_number.toLowerCase().includes(query) ||
      s.serial_number.toLowerCase().includes(query) ||
      s.customer_name?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
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
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Record Sales
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Simple sales recording</p>
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>

        {/* Search & Actions */}
        <GlassCard>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search smartcard, serial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            {selectedItems.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete ({selectedItems.length})
              </Button>
            )}
          </div>
        </GlassCard>

        {/* Sales Table */}
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedItems.length === filteredSales.length && filteredSales.length > 0}
                    onCheckedChange={(val) =>
                      setSelectedItems(val ? filteredSales.map((s) => s.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>Smartcard / Serial</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Team Leader</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No sales recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.slice(0, 50).map((sale) => (
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
                              : 'bg-destructive/20 text-destructive border-destructive/30'
                          }
                        >
                          {sale.payment_status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => handleUpdatePaymentStatus(sale, sale.payment_status === 'Paid' ? 'Unpaid' : 'Paid')}
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
                              ? 'bg-green-500/20 text-green-500 border-green-500/30'
                              : 'bg-destructive/20 text-destructive border-destructive/30'
                          }
                        >
                          {sale.package_status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => handleUpdatePackageStatus(sale, sale.package_status === 'Packaged' ? 'No Package' : 'Packaged')}
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
                      {teamLeaders.find((t) => t.id === sale.team_leader_id)?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEditClick(sale)}
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
        </GlassCard>

        {/* Simple Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSale ? 'Edit Sale' : 'Record New Sale'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* 1. Select Region */}
              <div>
                <Label>Region *</Label>
                <Select value={formData.region_id} onValueChange={handleRegionChange}>
                  <SelectTrigger className="glass-input">
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
                <Label>Team Leader *</Label>
                <Select
                  value={formData.team_leader_id}
                  onValueChange={handleTLChange}
                  disabled={!formData.region_id}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder={formData.region_id ? 'Select TL' : 'Select region first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTLs.length === 0 ? (
                      <SelectItem value="__none__" disabled>No TLs in this region</SelectItem>
                    ) : (
                      filteredTLs.map((tl) => (
                        <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Select Stock (TL's assigned inventory) */}
              <div>
                <Label>Stock Item * <span className="text-muted-foreground text-xs">({tlStock.length} available)</span></Label>
                <Select
                  value={formData.inventory_id}
                  onValueChange={(v) => setFormData({ ...formData, inventory_id: v })}
                  disabled={!formData.team_leader_id}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder={formData.team_leader_id ? 'Select stock' : 'Select TL first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tlStock.length === 0 ? (
                      <SelectItem value="__none__" disabled>No stock assigned to this TL</SelectItem>
                    ) : (
                      tlStock.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.smartcard_number} - {inv.stock_type}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Package Status */}
              <div>
                <Label>Package Status</Label>
                <Select
                  value={formData.package_status}
                  onValueChange={(v) => setFormData({ ...formData, package_status: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Packaged">Packaged</SelectItem>
                    <SelectItem value="No Package">No Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 5. Sale Date */}
              <div>
                <Label>Sale Date</Label>
                <Input
                  type="date"
                  value={formData.sale_date}
                  onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !formData.inventory_id}>
                {saving ? 'Saving...' : editingSale ? 'Update' : 'Record Sale'}
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
