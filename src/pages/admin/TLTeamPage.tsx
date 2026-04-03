import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Edit, Plus, UserPlus, Users } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';

interface CaptainRow {
  id: string;
  name: string;
  phone: string | null;
  team_leader_id: string | null;
}

interface DSRRow {
  id: string;
  name: string;
  phone: string | null;
  captain_id: string | null;
  dsr_number: string | null;
  has_fss_account: boolean;
  fss_username: string | null;
  district: string | null;
  ward: string | null;
  street_village: string | null;
}

const emptyCaptainForm = {
  name: '',
  phone: '',
};

const emptyDsrForm = {
  name: '',
  phone: '',
  captain_id: '',
  dsr_number: '',
  has_fss_account: false,
  fss_username: '',
  district: '',
  ward: '',
  street_village: '',
};

export default function TLTeamPage() {
  const { toast } = useToast();
  const { currentTeamLeader, currentCaptain, isCaptain, isTeamLeader } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [dsrs, setDsrs] = useState<DSRRow[]>([]);
  const [captainDialogOpen, setCaptainDialogOpen] = useState(false);
  const [dsrDialogOpen, setDsrDialogOpen] = useState(false);
  const [editingCaptain, setEditingCaptain] = useState<CaptainRow | null>(null);
  const [editingDsr, setEditingDsr] = useState<DSRRow | null>(null);
  const [captainForm, setCaptainForm] = useState(emptyCaptainForm);
  const [dsrForm, setDsrForm] = useState(emptyDsrForm);

  const fetchData = useCallback(async () => {
    if (isCaptain && currentCaptain) {
      setLoading(true);
      try {
        const { data: dsrRows, error } = await supabase
          .from('dsrs')
          .select('id, name, phone, captain_id, dsr_number, has_fss_account, fss_username, district, ward, street_village')
          .eq('captain_id', currentCaptain.id)
          .order('name');

        if (error) throw error;

        setCaptains([{ id: currentCaptain.id, name: currentCaptain.name, phone: currentCaptain.phone, team_leader_id: currentCaptain.team_leader_id }]);
        setDsrs(dsrRows || []);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load your team.';
        toast({ title: 'Error', description: message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!currentTeamLeader) return;

    setLoading(true);
    try {
      const { data: captainRows, error: captainError } = await supabase.from('captains').select('id, name, phone, team_leader_id').eq('team_leader_id', currentTeamLeader.id).order('name');
      if (captainError) throw captainError;
      const captainIds = (captainRows || []).map((captain) => captain.id);
      const { data: dsrRows, error: dsrError } = captainIds.length > 0
        ? await supabase.from('dsrs').select('id, name, phone, captain_id, dsr_number, has_fss_account, fss_username, district, ward, street_village').in('captain_id', captainIds).order('name')
        : { data: [] as DSRRow[], error: null };
      if (dsrError) throw dsrError;

      setCaptains(captainRows || []);
      setDsrs(dsrRows || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load your team.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentCaptain, currentTeamLeader, isCaptain, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableCaptains = useMemo(() => {
    if (isCaptain && currentCaptain) {
      return [{ id: currentCaptain.id, name: currentCaptain.name }];
    }

    return captains.map((captain) => ({ id: captain.id, name: captain.name }));
  }, [captains, currentCaptain, isCaptain]);

  const resetCaptainForm = () => {
    setEditingCaptain(null);
    setCaptainForm(emptyCaptainForm);
  };

  const resetDsrForm = () => {
    setEditingDsr(null);
    setDsrForm({
      ...emptyDsrForm,
      captain_id: isCaptain && currentCaptain ? currentCaptain.id : '',
    });
  };

  const openCaptainDialog = (captain?: CaptainRow) => {
    if (captain) {
      setEditingCaptain(captain);
      setCaptainForm({ name: captain.name, phone: captain.phone || '' });
    } else {
      resetCaptainForm();
    }
    setCaptainDialogOpen(true);
  };

  const openDsrDialog = (dsr?: DSRRow, captainId?: string) => {
    if (dsr) {
      setEditingDsr(dsr);
      setDsrForm({
        name: dsr.name,
        phone: dsr.phone || '',
        captain_id: dsr.captain_id || (isCaptain && currentCaptain ? currentCaptain.id : ''),
        dsr_number: dsr.dsr_number || '',
        has_fss_account: dsr.has_fss_account || false,
        fss_username: dsr.fss_username || '',
        district: dsr.district || '',
        ward: dsr.ward || '',
        street_village: dsr.street_village || '',
      });
    } else {
      resetDsrForm();
      setDsrForm((current) => ({
        ...current,
        captain_id: captainId || (isCaptain && currentCaptain ? currentCaptain.id : current.captain_id),
      }));
    }
    setDsrDialogOpen(true);
  };

  const handleCaptainSubmit = async () => {
    if (!isTeamLeader || !currentTeamLeader) return;
    if (!captainForm.name.trim()) {
      toast({ title: 'Error', description: 'Captain name is required.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: captainForm.name.trim(),
        phone: captainForm.phone.trim() || null,
        team_leader_id: currentTeamLeader.id,
      };

      const { error } = editingCaptain
        ? await supabase.from('captains').update(payload).eq('id', editingCaptain.id)
        : await supabase.from('captains').insert([payload]);

      if (error) throw error;

      toast({
        title: editingCaptain ? 'Captain updated' : 'Captain added',
        description: 'This creates the team record only. Admin can create the login later from Users Page.',
      });
      setCaptainDialogOpen(false);
      resetCaptainForm();
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save captain.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDsrSubmit = async () => {
    const targetCaptainId = isCaptain && currentCaptain ? currentCaptain.id : dsrForm.captain_id;

    if (!dsrForm.name.trim()) {
      toast({ title: 'Error', description: 'DSR name is required.', variant: 'destructive' });
      return;
    }

    if (!targetCaptainId) {
      toast({ title: 'Error', description: 'Select a captain first.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: dsrForm.name.trim(),
        phone: dsrForm.phone.trim() || null,
        captain_id: targetCaptainId,
        dsr_number: dsrForm.dsr_number.trim() || null,
        has_fss_account: dsrForm.has_fss_account,
        fss_username: dsrForm.has_fss_account ? dsrForm.fss_username.trim() || null : null,
        district: dsrForm.district.trim() || null,
        ward: dsrForm.ward.trim() || null,
        street_village: dsrForm.street_village.trim() || null,
      };

      const { error } = editingDsr
        ? await supabase.from('dsrs').update(payload).eq('id', editingDsr.id)
        : await supabase.from('dsrs').insert([payload]);

      if (error) throw error;

      toast({
        title: editingDsr ? 'DSR updated' : 'DSR added',
        description: 'This creates the team record only. Admin can create the login later from Users Page.',
      });
      setDsrDialogOpen(false);
      resetDsrForm();
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save DSR.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">{isCaptain ? 'My Team' : 'Team Setup'}</h1>
            <p className="text-muted-foreground mt-1">{isCaptain ? `Create and manage DSR team records under ${currentCaptain?.name || 'your account'}.` : `Create captains and DSRs under ${currentTeamLeader?.name || 'your account'}.`}</p>
            <p className="text-sm text-muted-foreground mt-2">Team records are created here. Logins are created later by Admin from Users Page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isTeamLeader && (
              <Button onClick={() => openCaptainDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Captain
              </Button>
            )}
            <Button variant="outline" onClick={() => openDsrDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add DSR
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="space-y-4">{[...Array(4)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>
        ) : captains.length === 0 ? (
          <GlassCard className="p-6"><p className="text-sm text-muted-foreground">{isCaptain ? 'No DSRs assigned to this captain yet.' : 'No captains added under this team leader yet.'}</p></GlassCard>
        ) : (
          <div className="space-y-4">
            {captains.map((captain) => {
              const captainDsrs = dsrs.filter((dsr) => dsr.captain_id === captain.id);
              return (
                <GlassCard key={captain.id} className="p-4">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" />{captain.name}</div>
                      <div className="text-sm text-muted-foreground">{captain.phone || 'No phone number'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{captainDsrs.length} DSRs</Badge>
                      {isTeamLeader && !isCaptain && (
                        <Button variant="ghost" size="icon" onClick={() => openCaptainDialog(captain)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openDsrDialog(undefined, captain.id)}>
                        <Plus className="h-4 w-4 mr-1" />
                        DSR
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {captainDsrs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No DSRs assigned under this captain.</p>
                    ) : (
                      captainDsrs.map((dsr) => (
                        <div key={dsr.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 gap-4">
                          <div>
                            <div className="flex items-center gap-2"><ChevronRight className="h-4 w-4 text-muted-foreground" /><span>{dsr.name}</span>{dsr.dsr_number && <Badge variant="outline" className="text-xs">{dsr.dsr_number}</Badge>}</div>
                            <div className="text-sm text-muted-foreground pl-6">{dsr.phone || 'No phone'}{dsr.has_fss_account && ` • FSS: ${dsr.fss_username || 'Yes'}`}</div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => openDsrDialog(dsr)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={captainDialogOpen} onOpenChange={setCaptainDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCaptain ? 'Edit Captain' : 'Add Captain'}</DialogTitle>
            <DialogDescription>This creates the captain team record only. Admin creates the login later from Users Page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="captain-name">Captain Name</Label>
              <Input id="captain-name" value={captainForm.name} onChange={(event) => setCaptainForm((current) => ({ ...current, name: event.target.value }))} placeholder="Captain name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="captain-phone">Phone</Label>
              <Input id="captain-phone" value={captainForm.phone} onChange={(event) => setCaptainForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaptainDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCaptainSubmit} disabled={saving}>{editingCaptain ? 'Update Captain' : 'Add Captain'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dsrDialogOpen} onOpenChange={setDsrDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDsr ? 'Edit DSR' : 'Add DSR'}</DialogTitle>
            <DialogDescription>This creates the DSR team record only. Admin creates the login later from Users Page.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dsr-name">DSR Name</Label>
              <Input id="dsr-name" value={dsrForm.name} onChange={(event) => setDsrForm((current) => ({ ...current, name: event.target.value }))} placeholder="DSR name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dsr-phone">Phone</Label>
              <Input id="dsr-phone" value={dsrForm.phone} onChange={(event) => setDsrForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" />
            </div>
            {!isCaptain && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dsr-captain">Assign To Captain</Label>
                <select id="dsr-captain" name="dsr-captain" aria-label="Assign to captain" title="Assign to captain" value={dsrForm.captain_id} onChange={(event) => setDsrForm((current) => ({ ...current, captain_id: event.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Choose captain</option>
                  {availableCaptains.map((captain) => (
                    <option key={captain.id} value={captain.id}>{captain.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="dsr-number">DSR Number</Label>
              <Input id="dsr-number" value={dsrForm.dsr_number} onChange={(event) => setDsrForm((current) => ({ ...current, dsr_number: event.target.value }))} placeholder="Optional DSR number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fss-username">FSS Username</Label>
              <Input id="fss-username" value={dsrForm.fss_username} onChange={(event) => setDsrForm((current) => ({ ...current, fss_username: event.target.value }))} placeholder="Only if FSS account exists" disabled={!dsrForm.has_fss_account} />
            </div>
            <div className="md:col-span-2 flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
              <Checkbox checked={dsrForm.has_fss_account} onCheckedChange={(checked) => setDsrForm((current) => ({ ...current, has_fss_account: checked === true, fss_username: checked === true ? current.fss_username : '' }))} />
              <div>
                <div className="font-medium text-sm">Has FSS Account</div>
                <div className="text-xs text-muted-foreground">Enable this if the DSR already has an FSS login.</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dsr-district">District</Label>
              <Input id="dsr-district" value={dsrForm.district} onChange={(event) => setDsrForm((current) => ({ ...current, district: event.target.value }))} placeholder="District" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dsr-ward">Ward</Label>
              <Input id="dsr-ward" value={dsrForm.ward} onChange={(event) => setDsrForm((current) => ({ ...current, ward: event.target.value }))} placeholder="Ward" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="dsr-street">Street / Village</Label>
              <Input id="dsr-street" value={dsrForm.street_village} onChange={(event) => setDsrForm((current) => ({ ...current, street_village: event.target.value }))} placeholder="Street or village" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDsrDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDsrSubmit} disabled={saving}>{editingDsr ? 'Update DSR' : 'Add DSR'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}