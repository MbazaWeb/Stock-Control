import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Users,
  UserPlus,
  Phone,
  MapPin,
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  FileText,
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface TeamLeader {
  id: string;
  name: string;
  phone: string | null;
  region_id: string | null;
  created_at: string;
}

interface Captain {
  id: string;
  name: string;
  phone: string | null;
  team_leader_id: string | null;
  created_at: string;
}

interface DSR {
  id: string;
  name: string;
  phone: string | null;
  captain_id: string | null;
  created_at: string;
}

interface Region {
  id: string;
  name: string;
}

export default function SalesTeamPage() {
  const { toast } = useToast();
  const { isRegionalAdmin, assignedRegionIds } = useAuth();
  const [loading, setLoading] = useState(true);

  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  // Dialog states
  const [tlDialogOpen, setTlDialogOpen] = useState(false);
  const [captainDialogOpen, setCaptainDialogOpen] = useState(false);
  const [dsrDialogOpen, setDsrDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDsrDialogOpen, setBulkDsrDialogOpen] = useState(false);

  // Edit states
  const [editingTL, setEditingTL] = useState<TeamLeader | null>(null);
  const [editingCaptain, setEditingCaptain] = useState<Captain | null>(null);
  const [editingDSR, setEditingDSR] = useState<DSR | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  // Form states
  const [tlForm, setTlForm] = useState({ name: '', phone: '', region_id: '' });
  const [captainForm, setCaptainForm] = useState({ name: '', phone: '', team_leader_id: '' });
  const [dsrForm, setDsrForm] = useState({ name: '', phone: '', captain_id: '' });

  // Bulk DSR state
  const [bulkDsrData, setBulkDsrData] = useState({
    captain_id: '',
    dsrList: '',
  });
  const [parsedDsrs, setParsedDsrs] = useState<Array<{name: string, phone?: string}>>([]);
  const [processingBulk, setProcessingBulk] = useState(false);

  // Expanded rows for hierarchy view
  const [expandedTLs, setExpandedTLs] = useState<string[]>([]);
  const [expandedCaptains, setExpandedCaptains] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tlRes, captainRes, dsrRes, regionRes] = await Promise.all([
        supabase.from('team_leaders').select('*').order('name'),
        supabase.from('captains').select('*').order('name'),
        supabase.from('dsrs').select('*').order('name'),
        supabase.from('regions').select('*').order('name'),
      ]);

      // For regional admins, filter team leaders by assigned regions
      if (tlRes.data) {
        const filteredTLs = isRegionalAdmin && assignedRegionIds.length > 0
          ? tlRes.data.filter(tl => tl.region_id && assignedRegionIds.includes(tl.region_id))
          : tlRes.data;
        setTeamLeaders(filteredTLs);
        
        // Also filter captains by the TLs in assigned regions
        if (captainRes.data) {
          const tlIds = filteredTLs.map(tl => tl.id);
          const filteredCaptains = isRegionalAdmin && assignedRegionIds.length > 0
            ? captainRes.data.filter(c => c.team_leader_id && tlIds.includes(c.team_leader_id))
            : captainRes.data;
          setCaptains(filteredCaptains);
          
          // Also filter DSRs by the filtered captains
          if (dsrRes.data) {
            const captainIds = filteredCaptains.map(c => c.id);
            const filteredDSRs = isRegionalAdmin && assignedRegionIds.length > 0
              ? dsrRes.data.filter(d => d.captain_id && captainIds.includes(d.captain_id))
              : dsrRes.data;
            setDsrs(filteredDSRs);
          }
        }
      } else {
        if (captainRes.data) setCaptains(captainRes.data);
        if (dsrRes.data) setDsrs(dsrRes.data);
      }
      
      // For regional admins, only show their assigned regions
      if (regionRes.data) {
        const filteredRegions = isRegionalAdmin && assignedRegionIds.length > 0
          ? regionRes.data.filter(r => assignedRegionIds.includes(r.id))
          : regionRes.data;
        setRegions(filteredRegions);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Team Leader handlers
  const handleTLSubmit = async () => {
    if (!tlForm.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const data = {
      name: tlForm.name,
      phone: tlForm.phone || null,
      region_id: tlForm.region_id || null,
    };

    const { error } = editingTL
      ? await supabase.from('team_leaders').update(data).eq('id', editingTL.id)
      : await supabase.from('team_leaders').insert([data]);

    if (!error) {
      toast({ title: 'Success', description: editingTL ? 'Team Leader updated!' : 'Team Leader added!' });
      setTlDialogOpen(false);
      setEditingTL(null);
      setTlForm({ name: '', phone: '', region_id: '' });
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Captain handlers
  const handleCaptainSubmit = async () => {
    if (!captainForm.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const data = {
      name: captainForm.name,
      phone: captainForm.phone || null,
      team_leader_id: captainForm.team_leader_id || null,
    };

    const { error } = editingCaptain
      ? await supabase.from('captains').update(data).eq('id', editingCaptain.id)
      : await supabase.from('captains').insert([data]);

    if (!error) {
      toast({ title: 'Success', description: editingCaptain ? 'Captain updated!' : 'Captain added!' });
      setCaptainDialogOpen(false);
      setEditingCaptain(null);
      setCaptainForm({ name: '', phone: '', team_leader_id: '' });
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // DSR handlers
  const handleDSRSubmit = async () => {
    if (!dsrForm.name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    const data = {
      name: dsrForm.name,
      phone: dsrForm.phone || null,
      captain_id: dsrForm.captain_id || null,
    };

    const { error } = editingDSR
      ? await supabase.from('dsrs').update(data).eq('id', editingDSR.id)
      : await supabase.from('dsrs').insert([data]);

    if (!error) {
      toast({ title: 'Success', description: editingDSR ? 'DSR updated!' : 'DSR added!' });
      setDsrDialogOpen(false);
      setEditingDSR(null);
      setDsrForm({ name: '', phone: '', captain_id: '' });
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Parse DSR list from text input
  const parseDsrList = () => {
    if (!bulkDsrData.dsrList.trim()) {
      setParsedDsrs([]);
      return;
    }

    const lines = bulkDsrData.dsrList.split('\n');
    const parsed: Array<{name: string, phone?: string}> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for comma or tab separated values
      let name = '';
      let phone = '';

      if (trimmed.includes(',')) {
        const parts = trimmed.split(',').map(p => p.trim());
        name = parts[0] || '';
        phone = parts[1] || '';
      } else if (trimmed.includes('\t')) {
        const parts = trimmed.split('\t').map(p => p.trim());
        name = parts[0] || '';
        phone = parts[1] || '';
      } else {
        // Single value, assume it's a name
        name = trimmed;
      }

      if (name) {
        parsed.push({ name, phone: phone || undefined });
      }
    }

    setParsedDsrs(parsed);
  };

  // Handle bulk DSR import
  const handleBulkDsrImport = async () => {
    if (!bulkDsrData.captain_id) {
      toast({ title: 'Error', description: 'Please select a captain for the DSRs', variant: 'destructive' });
      return;
    }

    if (parsedDsrs.length === 0) {
      toast({ title: 'Error', description: 'No valid DSR data found', variant: 'destructive' });
      return;
    }

    setProcessingBulk(true);

    try {
      // Prepare DSR data for insertion
      const dsrData = parsedDsrs.map(dsr => ({
        name: dsr.name,
        phone: dsr.phone || null,
        captain_id: bulkDsrData.captain_id,
      }));

      // Insert DSRs in batches to avoid exceeding limits
      const batchSize = 50;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < dsrData.length; i += batchSize) {
        const batch = dsrData.slice(i, i + batchSize);
        const { error } = await supabase.from('dsrs').insert(batch);

        if (error) {
          console.error('Error inserting batch:', error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }

      // Show results
      if (successCount > 0) {
        toast({
          title: 'Bulk Import Complete',
          description: `Successfully imported ${successCount} DSRs${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        });
      } else {
        toast({
          title: 'Import Failed',
          description: 'Failed to import any DSRs. Please check the data and try again.',
          variant: 'destructive',
        });
      }

      // Reset and close
      if (successCount > 0) {
        setBulkDsrData({ captain_id: '', dsrList: '' });
        setParsedDsrs([]);
        setBulkDsrDialogOpen(false);
        fetchData();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to import DSRs',
        variant: 'destructive',
      });
    } finally {
      setProcessingBulk(false);
    }
  };

  // Download template CSV
  const downloadTemplate = () => {
    const template = "Name,Phone\nJohn Doe,1234567890\nJane Smith,0987654321\nMike Johnson,\nSarah Williams,1112223333";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dsr_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;

    let error;
    switch (deleteTarget.type) {
      case 'TL':
        ({ error } = await supabase.from('team_leaders').delete().eq('id', deleteTarget.id));
        break;
      case 'Captain':
        ({ error } = await supabase.from('captains').delete().eq('id', deleteTarget.id));
        break;
      case 'DSR':
        ({ error } = await supabase.from('dsrs').delete().eq('id', deleteTarget.id));
        break;
    }

    if (!error) {
      toast({ title: 'Deleted', description: `${deleteTarget.type} removed.` });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleTL = (id: string) => {
    setExpandedTLs((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleCaptain = (id: string) => {
    setExpandedCaptains((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Parse DSR list when text changes
  useEffect(() => {
    parseDsrList();
  }, [bulkDsrData.dsrList]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Sales Team Management
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">Manage Team Leaders, Captains, and DSRs</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <GlassCard className="text-center">
            <Users className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{teamLeaders.length}</p>
            <p className="text-xs text-muted-foreground">Team Leaders</p>
          </GlassCard>
          <GlassCard className="text-center">
            <UserPlus className="h-8 w-8 mx-auto text-secondary mb-2" />
            <p className="text-2xl font-bold">{captains.length}</p>
            <p className="text-xs text-muted-foreground">Captains</p>
          </GlassCard>
          <GlassCard className="text-center">
            <Users className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{dsrs.length}</p>
            <p className="text-xs text-muted-foreground">DSRs</p>
          </GlassCard>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="hierarchy" className="w-full">
          <TabsList className="glass-card w-full justify-start">
            <TabsTrigger value="hierarchy">Team Hierarchy</TabsTrigger>
            <TabsTrigger value="leaders">Team Leaders</TabsTrigger>
            <TabsTrigger value="captains">Captains</TabsTrigger>
            <TabsTrigger value="dsrs">DSRs</TabsTrigger>
          </TabsList>

          {/* Hierarchy View */}
          <TabsContent value="hierarchy" className="mt-4">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Team Structure</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setTlDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Team Leader
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCaptainDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Captain
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBulkDsrDialogOpen(true)}>
                    <Upload className="w-4 h-4 mr-1" /> Bulk DSRs
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDsrDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" /> DSR
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {teamLeaders.map((tl) => {
                  const tlCaptains = captains.filter((c) => c.team_leader_id === tl.id);
                  const isExpanded = expandedTLs.includes(tl.id);

                  return (
                    <div key={tl.id} className="border border-border/50 rounded-xl overflow-hidden">
                      <div
                        className="flex items-center justify-between p-4 bg-primary/5 cursor-pointer hover:bg-primary/10"
                        onClick={() => toggleTL(tl.id)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-primary" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-primary" />
                          )}
                          <Users className="h-5 w-5 text-primary" />
                          <div>
                            <span className="font-semibold">{tl.name}</span>
                            <Badge className="ml-2 bg-primary/20 text-primary text-xs">TL</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {tl.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {tl.phone}
                            </span>
                          )}
                          <Badge variant="outline">{tlCaptains.length} Captains</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTL(tl);
                              setTlForm({ name: tl.name, phone: tl.phone || '', region_id: tl.region_id || '' });
                              setTlDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ type: 'TL', id: tl.id, name: tl.name });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pl-8 border-t border-border/30">
                          {tlCaptains.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-4">No captains assigned</p>
                          ) : (
                            tlCaptains.map((captain) => {
                              const captainDsrs = dsrs.filter((d) => d.captain_id === captain.id);
                              const isCaptainExpanded = expandedCaptains.includes(captain.id);

                              return (
                                <div key={captain.id} className="border-b border-border/20 last:border-0">
                                  <div
                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/5"
                                    onClick={() => toggleCaptain(captain.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      {isCaptainExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-secondary" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-secondary" />
                                      )}
                                      <UserPlus className="h-4 w-4 text-secondary" />
                                      <span className="font-medium">{captain.name}</span>
                                      <Badge className="bg-secondary/20 text-secondary text-xs">Captain</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">{captainDsrs.length} DSRs</Badge>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingCaptain(captain);
                                          setCaptainForm({
                                            name: captain.name,
                                            phone: captain.phone || '',
                                            team_leader_id: captain.team_leader_id || '',
                                          });
                                          setCaptainDialogOpen(true);
                                        }}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteTarget({ type: 'Captain', id: captain.id, name: captain.name });
                                          setDeleteDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>

                                  {isCaptainExpanded && (
                                    <div className="pl-8 bg-muted/20">
                                      {captainDsrs.length === 0 ? (
                                        <p className="text-xs text-muted-foreground p-3">No DSRs assigned</p>
                                      ) : (
                                        captainDsrs.map((dsr) => (
                                          <div
                                            key={dsr.id}
                                            className="flex items-center justify-between p-2 border-b border-border/10 last:border-0"
                                          >
                                            <div className="flex items-center gap-2">
                                              <Users className="h-3 w-3 text-muted-foreground" />
                                              <span className="text-sm">{dsr.name}</span>
                                              {dsr.phone && (
                                                <span className="text-xs text-muted-foreground">({dsr.phone})</span>
                                              )}
                                            </div>
                                            <div className="flex gap-1">
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={() => {
                                                  setEditingDSR(dsr);
                                                  setDsrForm({
                                                    name: dsr.name,
                                                    phone: dsr.phone || '',
                                                    captain_id: dsr.captain_id || '',
                                                  });
                                                  setDsrDialogOpen(true);
                                                }}
                                              >
                                                <Edit className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={() => {
                                                  setDeleteTarget({ type: 'DSR', id: dsr.id, name: dsr.name });
                                                  setDeleteDialogOpen(true);
                                                }}
                                              >
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unassigned Captains */}
                {captains.filter((c) => !c.team_leader_id).length > 0 && (
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <div className="p-4 bg-muted/20">
                      <span className="font-semibold text-muted-foreground">Unassigned Captains</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {captains
                        .filter((c) => !c.team_leader_id)
                        .map((captain) => (
                          <div key={captain.id} className="flex items-center justify-between p-2 bg-muted/10 rounded-lg">
                            <span>{captain.name}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingCaptain(captain);
                                setCaptainForm({
                                  name: captain.name,
                                  phone: captain.phone || '',
                                  team_leader_id: '',
                                });
                                setCaptainDialogOpen(true);
                              }}
                            >
                              Assign
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Team Leaders Tab */}
          <TabsContent value="leaders" className="mt-4">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Team Leaders</h3>
                <Button
                  onClick={() => {
                    setEditingTL(null);
                    setTlForm({ name: '', phone: '', region_id: '' });
                    setTlDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Team Leader
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {teamLeaders.map((tl) => (
                  <div key={tl.id} className="glass-card p-4 rounded-xl border border-border/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{tl.name}</h4>
                        {tl.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {tl.phone}
                          </p>
                        )}
                        {tl.region_id && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {regions.find((r) => r.id === tl.region_id)?.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingTL(tl);
                            setTlForm({ name: tl.name, phone: tl.phone || '', region_id: tl.region_id || '' });
                            setTlDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setDeleteTarget({ type: 'TL', id: tl.id, name: tl.name });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <Badge className="mt-3 bg-primary/20 text-primary">
                      {captains.filter((c) => c.team_leader_id === tl.id).length} Captains
                    </Badge>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>

          {/* Captains Tab */}
          <TabsContent value="captains" className="mt-4">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Captains</h3>
                <Button
                  onClick={() => {
                    setEditingCaptain(null);
                    setCaptainForm({ name: '', phone: '', team_leader_id: '' });
                    setCaptainDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Captain
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {captains.map((captain) => (
                  <div key={captain.id} className="glass-card p-4 rounded-xl border border-border/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{captain.name}</h4>
                        {captain.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {captain.phone}
                          </p>
                        )}
                        {captain.team_leader_id && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Users className="h-3 w-3" /> {teamLeaders.find((t) => t.id === captain.team_leader_id)?.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingCaptain(captain);
                            setCaptainForm({
                              name: captain.name,
                              phone: captain.phone || '',
                              team_leader_id: captain.team_leader_id || '',
                            });
                            setCaptainDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setDeleteTarget({ type: 'Captain', id: captain.id, name: captain.name });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <Badge className="mt-3 bg-secondary/20 text-secondary">
                      {dsrs.filter((d) => d.captain_id === captain.id).length} DSRs
                    </Badge>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>

          {/* DSRs Tab */}
          <TabsContent value="dsrs" className="mt-4">
            <GlassCard>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">DSRs</h3>
                  <p className="text-sm text-muted-foreground">Total {dsrs.length} DSRs registered</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setBulkDsrDialogOpen(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Bulk Import
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingDSR(null);
                      setDsrForm({ name: '', phone: '', captain_id: '' });
                      setDsrDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add DSR
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dsrs.map((dsr) => (
                  <div key={dsr.id} className="glass-card p-4 rounded-xl border border-border/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{dsr.name}</h4>
                        {dsr.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {dsr.phone}
                          </p>
                        )}
                        {dsr.captain_id && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <UserPlus className="h-3 w-3" /> {captains.find((c) => c.id === dsr.captain_id)?.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingDSR(dsr);
                            setDsrForm({
                              name: dsr.name,
                              phone: dsr.phone || '',
                              captain_id: dsr.captain_id || '',
                            });
                            setDsrDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setDeleteTarget({ type: 'DSR', id: dsr.id, name: dsr.name });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* Team Leader Dialog */}
        <Dialog open={tlDialogOpen} onOpenChange={setTlDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingTL ? 'Edit Team Leader' : 'Add Team Leader'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={tlForm.name}
                  onChange={(e) => setTlForm({ ...tlForm, name: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={tlForm.phone}
                  onChange={(e) => setTlForm({ ...tlForm, phone: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Region</Label>
                <Select value={tlForm.region_id} onValueChange={(v) => setTlForm({ ...tlForm, region_id: v })}>
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTlDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleTLSubmit} className="bg-gradient-to-r from-primary to-secondary">
                {editingTL ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Captain Dialog */}
        <Dialog open={captainDialogOpen} onOpenChange={setCaptainDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingCaptain ? 'Edit Captain' : 'Add Captain'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={captainForm.name}
                  onChange={(e) => setCaptainForm({ ...captainForm, name: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={captainForm.phone}
                  onChange={(e) => setCaptainForm({ ...captainForm, phone: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Team Leader</Label>
                <Select
                  value={captainForm.team_leader_id}
                  onValueChange={(v) => setCaptainForm({ ...captainForm, team_leader_id: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select team leader" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamLeaders.map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>
                        {tl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCaptainDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCaptainSubmit} className="bg-gradient-to-r from-primary to-secondary">
                {editingCaptain ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DSR Dialog */}
        <Dialog open={dsrDialogOpen} onOpenChange={setDsrDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>{editingDSR ? 'Edit DSR' : 'Add DSR'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={dsrForm.name}
                  onChange={(e) => setDsrForm({ ...dsrForm, name: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={dsrForm.phone}
                  onChange={(e) => setDsrForm({ ...dsrForm, phone: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div>
                <Label>Captain</Label>
                <Select value={dsrForm.captain_id} onValueChange={(v) => setDsrForm({ ...dsrForm, captain_id: v })}>
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select captain" />
                  </SelectTrigger>
                  <SelectContent>
                    {captains.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDsrDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDSRSubmit} className="bg-gradient-to-r from-primary to-secondary">
                {editingDSR ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk DSR Import Dialog */}
        <Dialog open={bulkDsrDialogOpen} onOpenChange={setBulkDsrDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk DSR Import</DialogTitle>
              <DialogDescription>
                Import multiple DSRs at once. Each line should contain DSR details (Name, Phone optional).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Captain Selection */}
              <div>
                <Label className="text-base font-semibold">Select Captain *</Label>
                <p className="text-sm text-muted-foreground mb-2">All imported DSRs will be assigned to this captain</p>
                <Select
                  value={bulkDsrData.captain_id}
                  onValueChange={(v) => setBulkDsrData({ ...bulkDsrData, captain_id: v })}
                >
                  <SelectTrigger className="glass-input">
                    <SelectValue placeholder="Select captain for all DSRs" />
                  </SelectTrigger>
                  <SelectContent>
                    {captains.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.team_leader_id && `(TL: ${teamLeaders.find(t => t.id === c.team_leader_id)?.name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Import Instructions */}
              <div className="border border-border/30 rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">Import Format</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadTemplate}
                    className="h-8"
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Download Template
                  </Button>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">You can import DSRs using either format:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="font-medium">CSV Format (recommended):</p>
                      <pre className="text-xs bg-background/50 p-2 rounded border">
                        John Doe,1234567890{'\n'}
                        Jane Smith,0987654321{'\n'}
                        Mike Johnson{'\n'}
                        Sarah Williams,1112223333
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Line by Line:</p>
                      <pre className="text-xs bg-background/50 p-2 rounded border">
                        John Doe{'\n'}
                        Jane Smith 0987654321{'\n'}
                        Mike Johnson{'\n'}
                        Sarah Williams (1112223333)
                      </pre>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    <strong>Note:</strong> Phone numbers are optional. Names are required.
                  </p>
                </div>
              </div>

              {/* DSR Input Area */}
              <div>
                <Label className="text-base font-semibold">DSR List *</Label>
                <p className="text-sm text-muted-foreground mb-2">Enter one DSR per line. You can paste from Excel or CSV.</p>
                <Textarea
                  value={bulkDsrData.dsrList}
                  onChange={(e) => setBulkDsrData({ ...bulkDsrData, dsrList: e.target.value })}
                  className="glass-input min-h-[200px] font-mono text-sm"
                  placeholder="John Doe,1234567890&#10;Jane Smith,0987654321&#10;Mike Johnson&#10;Sarah Williams,1112223333"
                />
              </div>

              {/* Preview Section */}
              {parsedDsrs.length > 0 && (
                <div className="border border-border/30 rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/30 flex justify-between items-center">
                    <div>
                      <span className="font-semibold">Preview ({parsedDsrs.length} DSRs)</span>
                      <Badge variant="outline" className="ml-2">
                        {bulkDsrData.captain_id 
                          ? `Assigned to: ${captains.find(c => c.id === bulkDsrData.captain_id)?.name}`
                          : 'No captain selected'
                        }
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setParsedDsrs([])}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/20">
                        <tr>
                          <th className="text-left p-2 border-b border-border/30">#</th>
                          <th className="text-left p-2 border-b border-border/30">Name</th>
                          <th className="text-left p-2 border-b border-border/30">Phone</th>
                          <th className="text-left p-2 border-b border-border/30">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedDsrs.map((dsr, index) => (
                          <tr key={index} className="border-b border-border/10 hover:bg-muted/10">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2 font-medium">{dsr.name}</td>
                            <td className="p-2 text-muted-foreground">{dsr.phone || '-'}</td>
                            <td className="p-2">
                              <Badge variant={dsr.name ? "outline" : "destructive"}>
                                {dsr.name ? 'Ready' : 'Invalid'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {parsedDsrs.length === 0 && bulkDsrData.dsrList.trim() && (
                <div className="p-3 border border-warning/30 rounded-lg bg-warning/10">
                  <p className="text-warning text-sm">
                    No valid DSR data found. Please check the format and try again.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setBulkDsrDialogOpen(false);
                setBulkDsrData({ captain_id: '', dsrList: '' });
                setParsedDsrs([]);
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkDsrImport}
                disabled={!bulkDsrData.captain_id || parsedDsrs.length === 0 || processingBulk}
                className="bg-gradient-to-r from-primary to-secondary"
              >
                {processingBulk ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import {parsedDsrs.length} DSRs
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Delete {deleteTarget?.type}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
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