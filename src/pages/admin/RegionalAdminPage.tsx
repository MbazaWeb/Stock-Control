import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  MapPin,
  Shield,
  Search,
  RefreshCw,
  Check,
  X,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useNavigate } from 'react-router-dom';

interface AdminUser {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  assigned_regions?: Array<{ id: string; name: string }>;
}

interface Region {
  id: string;
  name: string;
  zone_id: string | null;
  zones?: { name: string } | null;
}

export default function RegionalAdminPage() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [deleteAdmin, setDeleteAdmin] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    selectedRegions: [] as string[],
  });

  // Redirect if not super admin
  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/admin');
    }
  }, [isSuperAdmin, navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all regional admins
      const { data: adminsData } = await supabase
        .from('admin_users')
        .select('*')
        .eq('role', 'regional_admin')
        .order('created_at', { ascending: false });

      // Fetch all regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('id, name, zone_id, zones:zone_id(name)')
        .order('name');

      // Fetch region assignments for each admin
      if (adminsData) {
        const adminsWithRegions = await Promise.all(
          adminsData.map(async (admin) => {
            const { data: assignments } = await supabase
              .from('admin_region_assignments')
              .select('region_id, regions:region_id(id, name)')
              .eq('admin_id', admin.id);

            return {
              ...admin,
              assigned_regions: assignments
                ?.map((a: { region_id: string; regions: { id: string; name: string } | null }) => a.regions)
                .filter((r): r is { id: string; name: string } => r !== null) || [],
            };
          })
        );
        setAdmins(adminsWithRegions);
      }

      if (regionsData) setRegions(regionsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (admin?: AdminUser) => {
    if (admin) {
      setEditingAdmin(admin);
      setFormData({
        email: admin.email,
        name: admin.name || '',
        selectedRegions: admin.assigned_regions?.map(r => r.id) || [],
      });
    } else {
      setEditingAdmin(null);
      setFormData({
        email: '',
        name: '',
        selectedRegions: [],
      });
    }
    setDialogOpen(true);
  };

  const handleToggleRegion = (regionId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedRegions: prev.selectedRegions.includes(regionId)
        ? prev.selectedRegions.filter(id => id !== regionId)
        : [...prev.selectedRegions, regionId],
    }));
  };

  const handleSave = async () => {
    if (!formData.email.trim()) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }

    if (formData.selectedRegions.length === 0) {
      toast({ title: 'Error', description: 'Select at least one region', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let adminId: string;

      if (editingAdmin) {
        // Update existing admin
        const { error } = await supabase
          .from('admin_users')
          .update({
            email: formData.email.trim(),
            name: formData.name.trim() || null,
          })
          .eq('id', editingAdmin.id);

        if (error) throw error;
        adminId = editingAdmin.id;

        // Delete existing region assignments
        await supabase
          .from('admin_region_assignments')
          .delete()
          .eq('admin_id', adminId);
      } else {
        // Create new regional admin
        const { data: newAdmin, error } = await supabase
          .from('admin_users')
          .insert({
            email: formData.email.trim(),
            name: formData.name.trim() || null,
            role: 'regional_admin',
            user_id: null, // Will be linked when they log in
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('An admin with this email already exists');
          }
          throw error;
        }
        adminId = newAdmin.id;
      }

      // Create region assignments
      const assignments = formData.selectedRegions.map(regionId => ({
        admin_id: adminId,
        region_id: regionId,
      }));

      const { error: assignError } = await supabase
        .from('admin_region_assignments')
        .insert(assignments);

      if (assignError) throw assignError;

      toast({
        title: editingAdmin ? 'Updated' : 'Created',
        description: editingAdmin
          ? 'Regional admin updated successfully'
          : 'Regional admin created successfully. They can now log in with their email.',
      });

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAdmin) return;

    try {
      // Delete region assignments first (should cascade, but be explicit)
      await supabase
        .from('admin_region_assignments')
        .delete()
        .eq('admin_id', deleteAdmin.id);

      // Delete admin user
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', deleteAdmin.id);

      if (error) throw error;

      toast({ title: 'Deleted', description: 'Regional admin removed' });
      setDeleteDialogOpen(false);
      setDeleteAdmin(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const filteredAdmins = admins.filter(admin =>
    admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.assigned_regions?.some(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              Regional Admins
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage regional administrators and their assigned regions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Regional Admin
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <Users className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{admins.length}</p>
            <p className="text-sm text-muted-foreground">Regional Admins</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <MapPin className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{regions.length}</p>
            <p className="text-sm text-muted-foreground">Total Regions</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <Check className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">
              {new Set(admins.flatMap(a => a.assigned_regions?.map(r => r.id) || [])).size}
            </p>
            <p className="text-sm text-muted-foreground">Regions Assigned</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <X className="h-6 w-6 mx-auto text-red-500 mb-2" />
            <p className="text-2xl font-bold">
              {regions.length - new Set(admins.flatMap(a => a.assigned_regions?.map(r => r.id) || [])).size}
            </p>
            <p className="text-sm text-muted-foreground">Unassigned Regions</p>
          </GlassCard>
        </div>

        {/* Search */}
        <GlassCard className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, or region..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-4 p-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Regions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-muted-foreground">
                          {admins.length === 0
                            ? 'No regional admins yet. Click "Add Regional Admin" to create one.'
                            : 'No admins match your search.'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAdmins.map(admin => (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-medium">{admin.name || 'Not set'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{admin.email}</TableCell>
                        <TableCell>
                          <Badge variant={admin.user_id ? 'default' : 'secondary'}>
                            {admin.user_id ? 'Active' : 'Pending Login'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {admin.assigned_regions && admin.assigned_regions.length > 0 ? (
                              admin.assigned_regions.map(region => (
                                <Badge key={region.id} variant="outline" className="text-xs">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {region.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(admin)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteAdmin(admin);
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
            )}
          </div>
        </GlassCard>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAdmin ? 'Edit Regional Admin' : 'Add Regional Admin'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  They will use this email to log in
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Admin Name"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Assign Regions *</Label>
              <p className="text-sm text-muted-foreground">
                Select the regions this admin will manage. They will only see data from these regions.
              </p>
              
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {regions.length === 0 ? (
                  <p className="p-4 text-center text-muted-foreground">
                    No regions found. Create regions first.
                  </p>
                ) : (
                  <div className="divide-y">
                    {regions.map(region => (
                      <label
                        key={region.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={formData.selectedRegions.includes(region.id)}
                          onCheckedChange={() => handleToggleRegion(region.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{region.name}</div>
                          {region.zones?.name && (
                            <div className="text-xs text-muted-foreground">
                              Zone: {region.zones.name}
                            </div>
                          )}
                        </div>
                        {formData.selectedRegions.includes(region.id) && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {formData.selectedRegions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">Selected:</span>
                  {formData.selectedRegions.map(id => {
                    const region = regions.find(r => r.id === id);
                    return region ? (
                      <Badge key={id} variant="secondary">
                        {region.name}
                        <button
                          type="button"
                          title={`Remove ${region.name}`}
                          className="ml-1 hover:text-destructive"
                          onClick={() => handleToggleRegion(id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{editingAdmin ? 'Update' : 'Create'} Admin</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Regional Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deleteAdmin?.email} as a regional admin. They will no longer
              have access to the admin panel. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
