import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  Check,
  X,
  Package,
  CreditCard,
  Trash2,
  Filter,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { supabase } from '@/integrations/supabase/client';

interface SalesRecord {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  team_leader_id: string | null;
  region_id: string | null;
  notes: string | null;
  created_at: string;
  team_leaders?: { name: string } | null;
  regions?: { name: string } | null;
}

export default function SalesManagementPage() {
  const { toast } = useToast();
  const { isRegionalAdmin, assignedRegionIds } = useAuth();
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Build sales query with region filtering for regional admins
      let salesQuery = supabase
        .from('sales_records')
        .select(`
          *,
          team_leaders:team_leader_id(name),
          regions:region_id(name)
        `)
        .order('sale_date', { ascending: false })
        .limit(500);
      
      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        salesQuery = salesQuery.in('region_id', assignedRegionIds);
      }

      const [salesRes, regionsRes] = await Promise.all([
        salesQuery,
        supabase.from('regions').select('id, name').order('name'),
      ]);

      if (salesRes.data) setSales(salesRes.data);
      // For regional admins, only show their assigned regions in filter
      if (regionsRes.data) {
        const filteredRegions = isRegionalAdmin && assignedRegionIds.length > 0
          ? regionsRes.data.filter(r => assignedRegionIds.includes(r.id))
          : regionsRes.data;
        setRegions(filteredRegions);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sales data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, isRegionalAdmin, assignedRegionIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updatePaymentStatus = async (id: string, newStatus: string) => {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from('sales_records')
        .update({ payment_status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Also update inventory if linked
      const sale = sales.find(s => s.id === id);
      if (sale) {
        await supabase
          .from('inventory')
          .update({ payment_status: newStatus })
          .eq('smartcard_number', sale.smartcard_number);
      }

      setSales(prev =>
        prev.map(s => (s.id === id ? { ...s, payment_status: newStatus } : s))
      );

      toast({
        title: 'Updated',
        description: `Payment status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating:', error);
      toast({
        title: 'Error',
        description: 'Failed to update payment status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const updatePackageStatus = async (id: string, newStatus: string) => {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from('sales_records')
        .update({ package_status: newStatus })
        .eq('id', id);

      if (error) throw error;

      // Also update inventory if linked
      const sale = sales.find(s => s.id === id);
      if (sale) {
        await supabase
          .from('inventory')
          .update({ package_status: newStatus })
          .eq('smartcard_number', sale.smartcard_number);
      }

      setSales(prev =>
        prev.map(s => (s.id === id ? { ...s, package_status: newStatus } : s))
      );

      toast({
        title: 'Updated',
        description: `Package status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating:', error);
      toast({
        title: 'Error',
        description: 'Failed to update package status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkPaymentUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    
    setUpdating('bulk');
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('sales_records')
        .update({ payment_status: status })
        .in('id', ids);

      if (error) throw error;

      setSales(prev =>
        prev.map(s => (selectedIds.has(s.id) ? { ...s, payment_status: status } : s))
      );
      setSelectedIds(new Set());

      toast({
        title: 'Bulk Update',
        description: `${ids.length} records updated to ${status}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to bulk update',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkPackageUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    
    setUpdating('bulk');
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('sales_records')
        .update({ package_status: status })
        .in('id', ids);

      if (error) throw error;

      setSales(prev =>
        prev.map(s => (selectedIds.has(s.id) ? { ...s, package_status: status } : s))
      );
      setSelectedIds(new Set());

      toast({
        title: 'Bulk Update',
        description: `${ids.length} records updated to ${status}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to bulk update',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('sales_records')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      setSales(prev => prev.filter(s => s.id !== deleteId));
      toast({
        title: 'Deleted',
        description: 'Sale record deleted',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete record',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteId(null);
    }
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Records');

    worksheet.columns = [
      { header: 'Smartcard', key: 'smartcard', width: 15 },
      { header: 'Serial', key: 'serial', width: 15 },
      { header: 'Stock Type', key: 'type', width: 12 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Sale Date', key: 'date', width: 12 },
      { header: 'Payment', key: 'payment', width: 10 },
      { header: 'Package', key: 'package', width: 12 },
      { header: 'Team Leader', key: 'tl', width: 20 },
      { header: 'Region', key: 'region', width: 15 },
    ];

    filteredSales.forEach(sale => {
      worksheet.addRow({
        smartcard: sale.smartcard_number,
        serial: sale.serial_number,
        type: sale.stock_type,
        customer: sale.customer_name || '',
        phone: sale.customer_phone || '',
        date: sale.sale_date,
        payment: sale.payment_status,
        package: sale.package_status,
        tl: sale.team_leaders?.name || '',
        region: sale.regions?.name || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_records_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      searchQuery === '' ||
      sale.smartcard_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesPayment =
      paymentFilter === 'all' || sale.payment_status === paymentFilter;

    const matchesPackage =
      packageFilter === 'all' || sale.package_status === packageFilter;

    const matchesRegion =
      regionFilter === 'all' || sale.region_id === regionFilter;

    return matchesSearch && matchesPayment && matchesPackage && matchesRegion;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSales.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSales.map(s => s.id)));
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold">Sales Management</h1>
            <p className="text-muted-foreground mt-1">
              Update payment and package status for sales records
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <GlassCard className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search smartcard, serial, customer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={packageFilter} onValueChange={setPackageFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                <SelectItem value="Packaged">Packaged</SelectItem>
                <SelectItem value="No Package">No Package</SelectItem>
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <GlassCard className="p-4 bg-primary/5">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkPaymentUpdate('Paid')}
                  disabled={updating === 'bulk'}
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  Mark Paid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkPaymentUpdate('Unpaid')}
                  disabled={updating === 'bulk'}
                >
                  <X className="h-4 w-4 mr-1" />
                  Mark Unpaid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkPackageUpdate('Packaged')}
                  disabled={updating === 'bulk'}
                >
                  <Package className="h-4 w-4 mr-1" />
                  Mark Packaged
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkPackageUpdate('No Package')}
                  disabled={updating === 'bulk'}
                >
                  <X className="h-4 w-4 mr-1" />
                  Mark No Package
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </GlassCard>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold">{filteredSales.length}</p>
            <p className="text-sm text-muted-foreground">Total Records</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {filteredSales.filter(s => s.payment_status === 'Paid').length}
            </p>
            <p className="text-sm text-muted-foreground">Paid</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {filteredSales.filter(s => s.payment_status === 'Unpaid').length}
            </p>
            <p className="text-sm text-muted-foreground">Unpaid</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {filteredSales.filter(s => s.package_status === 'Packaged').length}
            </p>
            <p className="text-sm text-muted-foreground">Packaged</p>
          </GlassCard>
        </div>

        {/* Table */}
        <GlassCard>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-4 p-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filteredSales.length > 0 &&
                          selectedIds.size === filteredSales.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Team Leader</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <p className="text-muted-foreground">No sales records found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(sale.id)}
                            onCheckedChange={() => toggleSelect(sale.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {sale.smartcard_number}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {sale.serial_number}
                        </TableCell>
                        <TableCell>{sale.sale_date}</TableCell>
                        <TableCell>{sale.customer_name || '-'}</TableCell>
                        <TableCell>{sale.team_leaders?.name || '-'}</TableCell>
                        <TableCell>{sale.regions?.name || '-'}</TableCell>
                        <TableCell>
                          <button
                            onClick={() =>
                              updatePaymentStatus(
                                sale.id,
                                sale.payment_status === 'Paid' ? 'Unpaid' : 'Paid'
                              )
                            }
                            disabled={updating === sale.id}
                            className="cursor-pointer"
                          >
                            <Badge
                              variant={
                                sale.payment_status === 'Paid'
                                  ? 'default'
                                  : 'destructive'
                              }
                              className="cursor-pointer hover:opacity-80"
                            >
                              {updating === sale.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : sale.payment_status === 'Paid' ? (
                                <Check className="h-3 w-3 mr-1" />
                              ) : (
                                <X className="h-3 w-3 mr-1" />
                              )}
                              {sale.payment_status}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() =>
                              updatePackageStatus(
                                sale.id,
                                sale.package_status === 'Packaged'
                                  ? 'No Package'
                                  : 'Packaged'
                              )
                            }
                            disabled={updating === sale.id}
                            className="cursor-pointer"
                          >
                            <Badge
                              variant={
                                sale.package_status === 'Packaged'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="cursor-pointer hover:opacity-80"
                            >
                              {updating === sale.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : sale.package_status === 'Packaged' ? (
                                <Package className="h-3 w-3 mr-1" />
                              ) : (
                                <X className="h-3 w-3 mr-1" />
                              )}
                              {sale.package_status}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeleteId(sale.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The sale record will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
