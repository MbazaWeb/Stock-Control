import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, CreditCard, FileText, Loader2, Package, ShoppingCart, User, UserPlus, Users } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';

interface Captain {
  id: string;
  name: string;
}

interface DSR {
  id: string;
  name: string;
  captain_id: string | null;
}

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  zone_id: string | null;
  region_id: string | null;
}

export default function ManagerRecordSalePage() {
  const { toast } = useToast();
  const { adminUser, currentTeamLeader, currentCaptain, isCaptain, isTeamLeader } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [availableStock, setAvailableStock] = useState<InventoryItem[]>([]);
  const [stockTypeFilter, setStockTypeFilter] = useState('all');
  const [selectedCaptainId, setSelectedCaptainId] = useState('');
  const [selectedDsrId, setSelectedDsrId] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [packageStatus, setPackageStatus] = useState('No Package');
  const [paymentStatus, setPaymentStatus] = useState('Unpaid');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const ownerName = isCaptain ? currentCaptain?.name : currentTeamLeader?.name;
  const fixedTeamLeaderId = isCaptain ? currentCaptain?.team_leader_id || null : currentTeamLeader?.id || null;
  const effectiveCaptainId = isCaptain ? currentCaptain?.id || null : selectedCaptainId || null;
  const effectiveDsrId = selectedDsrId || null;

  const sellerType = effectiveDsrId ? 'dsr' : effectiveCaptainId ? 'captain' : 'team_leader';
  const sellerId = effectiveDsrId || effectiveCaptainId || fixedTeamLeaderId;

  const filteredDsrs = useMemo(
    () => (effectiveCaptainId ? dsrs.filter((dsr) => dsr.captain_id === effectiveCaptainId) : []),
    [dsrs, effectiveCaptainId]
  );

  const filteredStock = useMemo(
    () => (stockTypeFilter === 'all' ? availableStock : availableStock.filter((item) => item.stock_type === stockTypeFilter)),
    [availableStock, stockTypeFilter]
  );

  const stockTypes = useMemo(() => Array.from(new Set(availableStock.map((item) => item.stock_type))).sort(), [availableStock]);

  const loadScopeData = useCallback(async () => {
    if ((!isTeamLeader || !currentTeamLeader) && (!isCaptain || !currentCaptain)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isTeamLeader && currentTeamLeader) {
        const { data: captainRows } = await supabase
          .from('captains')
          .select('id, name')
          .eq('team_leader_id', currentTeamLeader.id)
          .order('name');

        const captainData = captainRows || [];
        setCaptains(captainData);

        const captainIds = captainData.map((captain) => captain.id);
        if (captainIds.length > 0) {
          const { data: dsrRows } = await supabase
            .from('dsrs')
            .select('id, name, captain_id')
            .in('captain_id', captainIds)
            .order('name');

          setDsrs(dsrRows || []);
        } else {
          setDsrs([]);
        }
      } else if (isCaptain && currentCaptain) {
        const { data: dsrRows } = await supabase
          .from('dsrs')
          .select('id, name, captain_id')
          .eq('captain_id', currentCaptain.id)
          .order('name');

        setCaptains([]);
        setDsrs(dsrRows || []);
      }
    } catch (error) {
      console.error('Error loading sales scope:', error);
      toast({ title: 'Error', description: 'Failed to load team sales scope.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentCaptain, currentTeamLeader, isCaptain, isTeamLeader, toast]);

  const fetchAvailableStock = useCallback(async () => {
    if (!sellerId) {
      setAvailableStock([]);
      setInventoryId('');
      return;
    }

    try {
      const [pendingRes, soldRes] = await Promise.all([
        supabase.from('pending_sales').select('inventory_id').eq('approval_status', 'pending'),
        supabase.from('sales_records').select('inventory_id').not('inventory_id', 'is', null),
      ]);

      const excludeIds = [
        ...(pendingRes.data || []).map((item) => item.inventory_id),
        ...(soldRes.data || []).map((item) => item.inventory_id),
      ].filter(Boolean) as string[];

      let query = supabase
        .from('inventory')
        .select('id, smartcard_number, serial_number, stock_type, zone_id, region_id')
        .eq('assigned_to_type', sellerType)
        .eq('assigned_to_id', sellerId)
        .eq('status', 'assigned')
        .order('smartcard_number');

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setAvailableStock(data || []);
      setInventoryId('');
    } catch (error) {
      console.error('Error loading available stock:', error);
      toast({ title: 'Error', description: 'Failed to load available stock.', variant: 'destructive' });
    }
  }, [sellerId, sellerType, toast]);

  useEffect(() => {
    loadScopeData();
  }, [loadScopeData]);

  useEffect(() => {
    fetchAvailableStock();
  }, [fetchAvailableStock]);

  const handleCaptainChange = (value: string) => {
    setSelectedCaptainId(value);
    setSelectedDsrId('');
  };

  const handleSubmit = async () => {
    if (!inventoryId || !fixedTeamLeaderId || !adminUser) {
      toast({ title: 'Error', description: 'Please select stock to submit.', variant: 'destructive' });
      return;
    }

    const selectedStock = availableStock.find((item) => item.id === inventoryId);
    if (!selectedStock) {
      toast({ title: 'Error', description: 'Selected stock not found.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: existingPending } = await supabase
        .from('pending_sales')
        .select('id')
        .eq('inventory_id', inventoryId)
        .eq('approval_status', 'pending')
        .limit(1);

      if (existingPending && existingPending.length > 0) {
        toast({ title: 'Error', description: 'This stock already has a pending request.', variant: 'destructive' });
        return;
      }

      const { data: existingSale } = await supabase
        .from('sales_records')
        .select('id')
        .eq('inventory_id', inventoryId)
        .limit(1);

      if (existingSale && existingSale.length > 0) {
        toast({ title: 'Error', description: 'This stock has already been sold.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('pending_sales').insert([{
        inventory_id: selectedStock.id,
        smartcard_number: selectedStock.smartcard_number,
        serial_number: selectedStock.serial_number,
        stock_type: selectedStock.stock_type,
        customer_name: customerName.trim() || null,
        sale_date: saleDate,
        payment_status: paymentStatus,
        package_status: packageStatus,
        team_leader_id: fixedTeamLeaderId,
        captain_id: effectiveCaptainId,
        dsr_id: effectiveDsrId,
        submitted_by_admin_user_id: adminUser.id,
        submitted_by_role: adminUser.role,
        zone_id: selectedStock.zone_id,
        region_id: selectedStock.region_id,
        notes: notes.trim() || null,
      }]);

      if (error) throw error;

      toast({ title: 'Sale submitted', description: 'Your sale is now pending admin approval.' });
      setSubmitted(true);
      setInventoryId('');
      setCustomerName('');
      setNotes('');
      setPaymentStatus('Unpaid');
      setPackageStatus('No Package');
      setSaleDate(new Date().toISOString().split('T')[0]);
      await fetchAvailableStock();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit sale.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AdminLayout>
        <div className="max-w-lg space-y-4">
          <GlassCard className="text-center space-y-4 p-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold">Sale Submitted</h2>
            <p className="text-muted-foreground">Your sale request is pending admin approval.</p>
            <Button onClick={() => setSubmitted(false)} className="w-full">
              Submit Another Sale
            </Button>
          </GlassCard>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Record Sales</h1>
          <p className="text-muted-foreground mt-1">Submit sales for {ownerName || 'your team'} and wait for admin approval.</p>
        </div>

        <GlassCard className="p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Team Assignment
            </h3>
            <div className={`grid gap-3 ${isTeamLeader ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {isTeamLeader && (
                <div>
                  <Label className="text-xs flex items-center gap-1"><UserPlus className="h-3 w-3" /> Captain <span className="text-muted-foreground">(optional)</span></Label>
                  <Select value={selectedCaptainId} onValueChange={handleCaptainChange}>
                    <SelectTrigger><SelectValue placeholder="Use team leader stock or choose captain" /></SelectTrigger>
                    <SelectContent>
                      {captains.map((captain) => (
                        <SelectItem key={captain.id} value={captain.id}>{captain.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> DSR <span className="text-muted-foreground">(optional)</span></Label>
                <Select value={selectedDsrId} onValueChange={setSelectedDsrId} disabled={!effectiveCaptainId}>
                  <SelectTrigger><SelectValue placeholder="Use current seller stock or choose DSR" /></SelectTrigger>
                  <SelectContent>
                    {filteredDsrs.map((dsr) => (
                      <SelectItem key={dsr.id} value={dsr.id}>{dsr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Team leader details are pulled from your account. Choose captain or DSR only when you are selling from their assigned stock.</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Assigned Stock
            </h3>
            <div className="space-y-3">
              {stockTypes.length > 1 && (
                <div>
                  <Label className="text-xs">Stock Type</Label>
                  <Select value={stockTypeFilter} onValueChange={setStockTypeFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {stockTypes.map((stockType) => (
                        <SelectItem key={stockType} value={stockType}>{stockType}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Available Stock ({filteredStock.length})</Label>
                <Select value={inventoryId} onValueChange={setInventoryId} disabled={filteredStock.length === 0}>
                  <SelectTrigger><SelectValue placeholder={filteredStock.length === 0 ? 'No available stock for this seller' : 'Select stock item'} /></SelectTrigger>
                  <SelectContent>
                    {filteredStock.map((stock) => (
                      <SelectItem key={stock.id} value={stock.id}>
                        {stock.smartcard_number} - {stock.serial_number} ({stock.stock_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {inventoryId && (
            <>
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Sale Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Customer Name</Label>
                    <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" />
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Any follow-up notes..." rows={3} />
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><ShoppingCart className="h-4 w-4 mr-2" /> Submit Sale for Admin Approval</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">Managers submit pending sales. Admins approve them from Sales Approval.</p>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </AdminLayout>
  );
}