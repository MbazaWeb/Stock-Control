import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShoppingCart,
  MapPin,
  Users,
  Shield,
  UserPlus,
  User,
  Package,
  Calendar,
  CreditCard,
  FileText,
  CheckCircle2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Zone { id: string; name: string; }
interface Region { id: string; name: string; zone_id: string | null; }
interface TeamLeader { id: string; name: string; region_id: string | null; }
interface Captain { id: string; name: string; team_leader_id: string | null; }
interface DSR { id: string; name: string; captain_id: string | null; }
interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
}

export default function AddSalePage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const prefilledInventoryId = searchParams.get('inventory_id');

  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [availableStock, setAvailableStock] = useState<InventoryItem[]>([]);
  const [stockTypeFilter, setStockTypeFilter] = useState('all');

  const [zoneId, setZoneId] = useState('');
  const [regionId, setRegionId] = useState('');
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [captainId, setCaptainId] = useState('');
  const [dsrId, setDsrId] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [packageStatus, setPackageStatus] = useState('No Package');
  const [paymentStatus, setPaymentStatus] = useState('Unpaid');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [zoneRes, regionRes, tlRes, captainRes, dsrRes] = await Promise.all([
        supabase.from('zones').select('id, name').order('name'),
        supabase.from('regions').select('id, name, zone_id').order('name'),
        supabase.from('team_leaders').select('id, name, region_id').order('name'),
        supabase.from('captains').select('id, name, team_leader_id').order('name'),
        supabase.from('dsrs').select('id, name, captain_id').order('name'),
      ]);
      setZones(zoneRes.data || []);
      setRegions(regionRes.data || []);
      setTeamLeaders(tlRes.data || []);
      setCaptains(captainRes.data || []);
      setDsrs(dsrRes.data || []);

      // If prefilled with inventory_id, auto-select hierarchy
      if (prefilledInventoryId) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('id, smartcard_number, serial_number, stock_type, zone_id, region_id, assigned_to_type, assigned_to_id')
          .eq('id', prefilledInventoryId)
          .single();

        if (inv) {
          if (inv.zone_id) setZoneId(inv.zone_id);
          if (inv.region_id) setRegionId(inv.region_id);

          if (inv.assigned_to_type === 'team_leader' && inv.assigned_to_id) {
            setTeamLeaderId(inv.assigned_to_id);
          } else if (inv.assigned_to_type === 'captain' && inv.assigned_to_id) {
            const { data: cap } = await supabase.from('captains').select('team_leader_id').eq('id', inv.assigned_to_id).single();
            if (cap?.team_leader_id) setTeamLeaderId(cap.team_leader_id);
            setCaptainId(inv.assigned_to_id);
          } else if (inv.assigned_to_type === 'dsr' && inv.assigned_to_id) {
            const { data: dsr } = await supabase.from('dsrs').select('captain_id').eq('id', inv.assigned_to_id).single();
            if (dsr?.captain_id) {
              const { data: cap } = await supabase.from('captains').select('team_leader_id').eq('id', dsr.captain_id).single();
              if (cap?.team_leader_id) setTeamLeaderId(cap.team_leader_id);
              setCaptainId(dsr.captain_id);
            }
            setDsrId(inv.assigned_to_id);
          }
          setInventoryId(prefilledInventoryId);
          setAvailableStock([{
            id: inv.id,
            smartcard_number: inv.smartcard_number,
            serial_number: inv.serial_number,
            stock_type: inv.stock_type,
          }]);
        }
      }

      setLoading(false);
    };
    loadData();
  }, [prefilledInventoryId]);

  // Fetch available stock when the assigned person changes
  useEffect(() => {
    if (!teamLeaderId || prefilledInventoryId) return;

    const fetchStock = async () => {
      // Get IDs to exclude (already pending or sold)
      const [pendingRes, soldRes] = await Promise.all([
        supabase.from('pending_sales').select('inventory_id').eq('approval_status', 'pending'),
        supabase.from('sales_records').select('inventory_id').not('inventory_id', 'is', null),
      ]);
      const excludeIds = [
        ...(pendingRes.data || []).map(p => p.inventory_id),
        ...(soldRes.data || []).map(s => s.inventory_id),
      ].filter(Boolean) as string[];

      let assignedType = 'team_leader';
      let assignedId = teamLeaderId;
      if (dsrId) { assignedType = 'dsr'; assignedId = dsrId; }
      else if (captainId) { assignedType = 'captain'; assignedId = captainId; }

      let query = supabase
        .from('inventory')
        .select('id, smartcard_number, serial_number, stock_type')
        .eq('assigned_to_type', assignedType)
        .eq('assigned_to_id', assignedId)
        .eq('status', 'assigned')
        .order('smartcard_number');

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data } = await query;
      setAvailableStock(data || []);
      setInventoryId('');
    };
    fetchStock();
  }, [teamLeaderId, captainId, dsrId, prefilledInventoryId]);

  const filteredRegions = zoneId ? regions.filter(r => r.zone_id === zoneId) : [];
  const filteredTLs = regionId ? teamLeaders.filter(tl => tl.region_id === regionId) : [];
  const filteredCaptains = teamLeaderId ? captains.filter(c => c.team_leader_id === teamLeaderId) : [];
  const filteredDSRs = captainId ? dsrs.filter(d => d.captain_id === captainId) : [];
  const filteredStock = stockTypeFilter === 'all'
    ? availableStock
    : availableStock.filter(s => s.stock_type === stockTypeFilter);

  const stockTypes = [...new Set(availableStock.map(s => s.stock_type))];

  const handleZoneChange = (val: string) => {
    setZoneId(val); setRegionId(''); setTeamLeaderId(''); setCaptainId(''); setDsrId(''); setInventoryId('');
  };
  const handleRegionChange = (val: string) => {
    setRegionId(val); setTeamLeaderId(''); setCaptainId(''); setDsrId(''); setInventoryId('');
  };
  const handleTLChange = (val: string) => {
    setTeamLeaderId(val); setCaptainId(''); setDsrId(''); setInventoryId('');
  };
  const handleCaptainChange = (val: string) => {
    setCaptainId(val); setDsrId(''); setInventoryId('');
  };
  const handleDSRChange = (val: string) => {
    setDsrId(val); setInventoryId('');
  };

  const handleSubmit = async () => {
    if (!inventoryId) {
      toast({ title: 'Error', description: 'Please select a stock item', variant: 'destructive' });
      return;
    }

    const selectedStock = availableStock.find(s => s.id === inventoryId);
    if (!selectedStock) {
      toast({ title: 'Error', description: 'Selected stock not found', variant: 'destructive' });
      return;
    }

    // Duplicate checks
    const { data: existingSale } = await supabase
      .from('sales_records').select('id').eq('inventory_id', inventoryId).limit(1);
    if (existingSale && existingSale.length > 0) {
      toast({ title: 'Error', description: 'This stock has already been sold', variant: 'destructive' });
      return;
    }

    const { data: existingPending } = await supabase
      .from('pending_sales').select('id').eq('inventory_id', inventoryId).eq('approval_status', 'pending').limit(1);
    if (existingPending && existingPending.length > 0) {
      toast({ title: 'Error', description: 'This stock already has a pending sale request', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const region = regions.find(r => r.id === regionId);

      const { error } = await supabase.from('pending_sales').insert([{
        inventory_id: inventoryId,
        smartcard_number: selectedStock.smartcard_number,
        serial_number: selectedStock.serial_number,
        stock_type: selectedStock.stock_type,
        customer_name: customerName.trim() || null,
        sale_date: saleDate,
        payment_status: paymentStatus,
        package_status: packageStatus,
        team_leader_id: teamLeaderId || null,
        captain_id: captainId || null,
        dsr_id: dsrId || null,
        zone_id: zoneId || region?.zone_id || null,
        region_id: regionId || null,
        notes: notes.trim() || null,
      }]);

      if (error) throw error;
      setSubmitted(true);
      toast({ title: 'Sale Submitted!', description: 'Your sale request is pending admin approval.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit sale';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  if (submitted) {
    return (
      <PublicLayout>
        <div className="max-w-lg mx-auto space-y-4">
          <GlassCard className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold">Sale Submitted!</h2>
            <p className="text-muted-foreground">
              Your sale request is now pending admin approval. You can check the status by searching for this stock.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Link to="/search">
                <Button variant="outline">Search Stock</Button>
              </Link>
              <Button onClick={() => {
                setSubmitted(false);
                setInventoryId('');
                setCustomerName('');
                setNotes('');
                setSaleDate(new Date().toISOString().split('T')[0]);
                setPaymentStatus('Unpaid');
                setPackageStatus('No Package');
              }}>
                Submit Another Sale
              </Button>
            </div>
          </GlassCard>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 md:gap-4">
          <Link to="/search">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Add Sale
              </span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">Submit a sale for admin approval</p>
          </div>
        </div>

        <GlassCard>
          <div className="space-y-4 md:space-y-5">
            {/* Step 1: Location */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Location
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Zone</Label>
                  <Select value={zoneId} onValueChange={handleZoneChange}>
                    <SelectTrigger><SelectValue placeholder="Select Zone" /></SelectTrigger>
                    <SelectContent>
                      {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Region</Label>
                  <Select value={regionId} onValueChange={handleRegionChange} disabled={!zoneId}>
                    <SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger>
                    <SelectContent>
                      {filteredRegions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 2: Team */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Team Assignment
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><Shield className="h-3 w-3" /> Team Leader</Label>
                  <Select value={teamLeaderId} onValueChange={handleTLChange} disabled={!regionId}>
                    <SelectTrigger><SelectValue placeholder="Select TL" /></SelectTrigger>
                    <SelectContent>
                      {filteredTLs.map(tl => <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><UserPlus className="h-3 w-3" /> Captain <span className="text-muted-foreground">(optional)</span></Label>
                  <Select value={captainId} onValueChange={handleCaptainChange} disabled={!teamLeaderId}>
                    <SelectTrigger><SelectValue placeholder="Select Captain" /></SelectTrigger>
                    <SelectContent>
                      {filteredCaptains.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> DSR <span className="text-muted-foreground">(optional)</span></Label>
                  <Select value={dsrId} onValueChange={handleDSRChange} disabled={!captainId}>
                    <SelectTrigger><SelectValue placeholder="Select DSR" /></SelectTrigger>
                    <SelectContent>
                      {filteredDSRs.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Step 3: Stock Selection */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Select Stock
              </h3>
              {teamLeaderId && (
                <div className="space-y-3">
                  {stockTypes.length > 1 && (
                    <div>
                      <Label className="text-xs">Stock Type</Label>
                      <Select value={stockTypeFilter} onValueChange={setStockTypeFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {stockTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Available Stock ({filteredStock.length})</Label>
                    {filteredStock.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3">No available stock for this assignment</p>
                    ) : (
                      <Select value={inventoryId} onValueChange={setInventoryId}>
                        <SelectTrigger><SelectValue placeholder="Select stock item" /></SelectTrigger>
                        <SelectContent>
                          {filteredStock.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.smartcard_number} — {s.serial_number} ({s.stock_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}
              {!teamLeaderId && (
                <p className="text-sm text-muted-foreground">Select a Team Leader to see available stock</p>
              )}
            </div>

            {/* Step 4: Sale Details */}
            {inventoryId && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Sale Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Package className="h-3 w-3" /> Package Status</Label>
                    <Select value={packageStatus} onValueChange={setPackageStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Packaged">Packaged</SelectItem>
                        <SelectItem value="No Package">No Package</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><CreditCard className="h-3 w-3" /> Payment Status</Label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Sale Date</Label>
                    <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Customer Name</Label>
                    <Input
                      placeholder="Customer name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea
                    placeholder="Any additional notes..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            {inventoryId && (
              <div className="pt-2 border-t">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-primary to-secondary text-white"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><ShoppingCart className="h-4 w-4 mr-2" /> Submit Sale for Approval</>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  This sale will be reviewed and approved by an admin
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </PublicLayout>
  );
}
