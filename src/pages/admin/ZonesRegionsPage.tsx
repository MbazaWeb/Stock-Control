import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  MapPin,
  Map,
  Save,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Zone {
  id: string;
  name: string;
  created_at: string;
}

interface Region {
  id: string;
  name: string;
  zone_id: string | null;
  created_at: string;
}

export default function ZonesRegionsPage() {
  const { toast } = useToast();
  const { isSuperAdmin, isRegionalAdmin, assignedRegionIds } = useAuth();
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  // Zone dialog
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [deleteZoneDialogOpen, setDeleteZoneDialogOpen] = useState(false);
  const [deleteZone, setDeleteZone] = useState<Zone | null>(null);

  // Region dialog
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [regionName, setRegionName] = useState('');
  const [regionZoneId, setRegionZoneId] = useState('');
  const [deleteRegionDialogOpen, setDeleteRegionDialogOpen] = useState(false);
  const [deleteRegion, setDeleteRegion] = useState<Region | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [zoneRes, regionRes] = await Promise.all([
        supabase.from('zones').select('*').order('name'),
        supabase.from('regions').select('*').order('name'),
      ]);
      if (zoneRes.data) setZones(zoneRes.data);
      // For regional admins, only show their assigned regions
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
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Zone handlers
  const handleZoneSubmit = async () => {
    if (!zoneName.trim()) {
      toast({ title: 'Error', description: 'Zone name is required', variant: 'destructive' });
      return;
    }

    if (editingZone) {
      const { error } = await supabase.from('zones').update({ name: zoneName }).eq('id', editingZone.id);
      if (!error) {
        toast({ title: 'Success', description: 'Zone updated!' });
        setZoneDialogOpen(false);
        setEditingZone(null);
        setZoneName('');
        fetchData();
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      const { error } = await supabase.from('zones').insert([{ name: zoneName }]);
      if (!error) {
        toast({ title: 'Success', description: 'Zone created!' });
        setZoneDialogOpen(false);
        setZoneName('');
        fetchData();
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleDeleteZone = async () => {
    if (!deleteZone) return;
    const { error } = await supabase.from('zones').delete().eq('id', deleteZone.id);
    if (!error) {
      toast({ title: 'Deleted', description: 'Zone removed.' });
      setDeleteZoneDialogOpen(false);
      setDeleteZone(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Region handlers
  const handleRegionSubmit = async () => {
    if (!regionName.trim()) {
      toast({ title: 'Error', description: 'Region name is required', variant: 'destructive' });
      return;
    }

    const regionData = {
      name: regionName,
      zone_id: regionZoneId || null,
    };

    if (editingRegion) {
      const { error } = await supabase.from('regions').update(regionData).eq('id', editingRegion.id);
      if (!error) {
        toast({ title: 'Success', description: 'Region updated!' });
        setRegionDialogOpen(false);
        setEditingRegion(null);
        setRegionName('');
        setRegionZoneId('');
        fetchData();
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      const { error } = await supabase.from('regions').insert([regionData]);
      if (!error) {
        toast({ title: 'Success', description: 'Region created!' });
        setRegionDialogOpen(false);
        setRegionName('');
        setRegionZoneId('');
        fetchData();
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleDeleteRegion = async () => {
    if (!deleteRegion) return;
    const { error } = await supabase.from('regions').delete().eq('id', deleteRegion.id);
    if (!error) {
      toast({ title: 'Deleted', description: 'Region removed.' });
      setDeleteRegionDialogOpen(false);
      setDeleteRegion(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Zones & Regions
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">Manage geographical areas for your sales team</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlassCard className="text-center">
            <Map className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{zones.length}</p>
            <p className="text-xs text-muted-foreground">Zones</p>
          </GlassCard>
          <GlassCard className="text-center">
            <MapPin className="h-8 w-8 mx-auto text-secondary mb-2" />
            <p className="text-2xl font-bold">{regions.length}</p>
            <p className="text-xs text-muted-foreground">Regions</p>
          </GlassCard>
        </div>

        <Tabs defaultValue="zones" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="zones">Zones</TabsTrigger>
            <TabsTrigger value="regions">Regions</TabsTrigger>
          </TabsList>

          {/* Zones Tab */}
          <TabsContent value="zones">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Map className="h-5 w-5 text-primary" /> Zones
                </h2>
                <Button
                  className="bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                  onClick={() => {
                    setEditingZone(null);
                    setZoneName('');
                    setZoneDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Zone
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Regions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No zones created yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    zones.map((zone) => (
                      <TableRow key={zone.id} className="border-border/30 hover:bg-primary/5">
                        <TableCell className="font-medium">{zone.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {regions.filter((r) => r.zone_id === zone.id).length} regions
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(zone.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingZone(zone);
                              setZoneName(zone.name);
                              setZoneDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeleteZone(zone);
                              setDeleteZoneDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </GlassCard>
          </TabsContent>

          {/* Regions Tab */}
          <TabsContent value="regions">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-secondary" /> Regions
                </h2>
                <Button
                  className="bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                  onClick={() => {
                    setEditingRegion(null);
                    setRegionName('');
                    setRegionZoneId('');
                    setRegionDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Region
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No regions created yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    regions.map((region) => (
                      <TableRow key={region.id} className="border-border/30 hover:bg-primary/5">
                        <TableCell className="font-medium">{region.name}</TableCell>
                        <TableCell>
                          <Badge className="bg-primary/20 text-primary border-primary/30">
                            {zones.find((z) => z.id === region.zone_id)?.name || 'Unassigned'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(region.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingRegion(region);
                              setRegionName(region.name);
                              setRegionZoneId(region.zone_id || '');
                              setRegionDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeleteRegion(region);
                              setDeleteRegionDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* Zone Dialog */}
        <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingZone ? 'Edit Zone' : 'Add Zone'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Zone Name *</Label>
                <Input
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  className="glass-input"
                  placeholder="e.g., North Region"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setZoneDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleZoneSubmit} className="bg-gradient-to-r from-primary to-secondary">
                <Save className="w-4 h-4 mr-2" />
                {editingZone ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Zone Dialog */}
        <Dialog open={deleteZoneDialogOpen} onOpenChange={setDeleteZoneDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Delete Zone</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Are you sure you want to delete zone <strong>{deleteZone?.name}</strong>?
              This will unlink all regions from this zone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteZoneDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteZone}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Region Dialog */}
        <Dialog open={regionDialogOpen} onOpenChange={setRegionDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingRegion ? 'Edit Region' : 'Add Region'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Region Name *</Label>
                <Input
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  className="glass-input"
                  placeholder="e.g., Downtown Area"
                />
              </div>
              <div>
                <Label>Zone</Label>
                <Select
                  value={regionZoneId || "__none__"}
                  onValueChange={(v) => setRegionZoneId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Zone</SelectItem>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRegionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRegionSubmit} className="bg-gradient-to-r from-primary to-secondary">
                <Save className="w-4 h-4 mr-2" />
                {editingRegion ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Region Dialog */}
        <Dialog open={deleteRegionDialogOpen} onOpenChange={setDeleteRegionDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Delete Region</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Are you sure you want to delete region <strong>{deleteRegion?.name}</strong>?
              This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteRegionDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteRegion}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
