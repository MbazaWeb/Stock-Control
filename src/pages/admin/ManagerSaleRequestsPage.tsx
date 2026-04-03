import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Eye, Search, XCircle } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/auth-context';
import { supabase } from '@/integrations/supabase/client';
import { getSaleCompletionBadgeClass, getSaleCompletionLabel } from '@/lib/saleCompletion';

interface PendingRequest {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  approval_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  dsr_id: string | null;
  teamLeaderName: string | null;
  captainName: string | null;
  dsrName: string | null;
}

export default function ManagerSaleRequestsPage() {
  const { toast } = useToast();
  const { adminUser, currentTeamLeader, currentCaptain, isCaptain } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);

  const ownerName = isCaptain ? currentCaptain?.name : currentTeamLeader?.name;
  const ownerLabel = isCaptain ? 'Captain' : 'Team Leader';

  const fetchRequests = useCallback(async () => {
    if (!adminUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_sales')
        .select(`
          id,
          smartcard_number,
          serial_number,
          stock_type,
          customer_name,
          sale_date,
          payment_status,
          package_status,
          approval_status,
          notes,
          created_at,
          updated_at,
          dsr_id,
          team_leaders:team_leader_id(name),
          captains:captain_id(name),
          dsrs:dsr_id(name)
        `)
        .eq('submitted_by_admin_user_id', adminUser.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const mapped = (data || []).map((item) => ({
        id: item.id,
        smartcard_number: item.smartcard_number,
        serial_number: item.serial_number,
        stock_type: item.stock_type,
        customer_name: item.customer_name,
        sale_date: item.sale_date,
        payment_status: item.payment_status,
        package_status: item.package_status,
        approval_status: item.approval_status,
        notes: item.notes,
        created_at: item.created_at,
        updated_at: item.updated_at,
        dsr_id: item.dsr_id,
        teamLeaderName: (item.team_leaders as { name?: string } | null)?.name || null,
        captainName: (item.captains as { name?: string } | null)?.name || null,
        dsrName: (item.dsrs as { name?: string } | null)?.name || null,
      })) as PendingRequest[];

      setRequests(mapped);
    } catch (error) {
      console.error('Error fetching manager sale requests:', error);
      toast({ title: 'Error', description: 'Failed to load submitted requests.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [adminUser, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return requests.filter((request) => {
      if (statusFilter !== 'all' && request.approval_status !== statusFilter) return false;
      if (!query) return true;

      return [
        request.smartcard_number,
        request.serial_number,
        request.customer_name,
        request.teamLeaderName,
        request.captainName,
        request.dsrName,
        request.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [requests, searchQuery, statusFilter]);

  const pendingCount = useMemo(() => filteredRequests.filter((request) => request.approval_status === 'pending').length, [filteredRequests]);
  const approvedCount = useMemo(() => filteredRequests.filter((request) => request.approval_status === 'approved').length, [filteredRequests]);
  const rejectedCount = useMemo(() => filteredRequests.filter((request) => request.approval_status === 'rejected').length, [filteredRequests]);

  const getStatusBadge = (status: string) => {
    if (status === 'approved') return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Approved</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Rejected</Badge>;
    return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Submitted Requests</h1>
          <p className="text-muted-foreground mt-1">Track sale requests submitted by {ownerLabel.toLowerCase()} {ownerName || 'your account'}.</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(3)].map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlassCard className="p-4 text-center"><Clock className="h-6 w-6 mx-auto text-amber-500 mb-2" /><p className="text-2xl font-bold">{pendingCount}</p><p className="text-sm text-muted-foreground">Pending</p></GlassCard>
              <GlassCard className="p-4 text-center"><CheckCircle2 className="h-6 w-6 mx-auto text-green-500 mb-2" /><p className="text-2xl font-bold">{approvedCount}</p><p className="text-sm text-muted-foreground">Approved</p></GlassCard>
              <GlassCard className="p-4 text-center"><XCircle className="h-6 w-6 mx-auto text-red-500 mb-2" /><p className="text-2xl font-bold">{rejectedCount}</p><p className="text-sm text-muted-foreground">Rejected</p></GlassCard>
            </div>

            <GlassCard className="p-4">
              <div className="flex flex-col md:flex-row gap-4 md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search smartcard, serial, customer, or team..." className="pl-9" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Smartcard</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No submitted requests found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="text-sm">{new Date(request.created_at).toLocaleDateString()}</div>
                            <div className="text-xs text-muted-foreground">Updated {new Date(request.updated_at).toLocaleDateString()}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm">{request.smartcard_number}</div>
                            <div className="text-xs text-muted-foreground">{request.serial_number}</div>
                          </TableCell>
                          <TableCell>{request.customer_name || '-'}</TableCell>
                          <TableCell>{getStatusBadge(request.approval_status)}</TableCell>
                          <TableCell>
                            <Badge className={getSaleCompletionBadgeClass(request.dsr_id)}>
                              {getSaleCompletionLabel(request.dsr_id)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {request.teamLeaderName && <div>TL: {request.teamLeaderName}</div>}
                              {request.captainName && <div>Captain: {request.captainName}</div>}
                              {request.dsrName && <div>DSR: {request.dsrName}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setSelectedRequest(request)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </GlassCard>
          </>
        )}

        <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Request Details</DialogTitle>
              <DialogDescription>See approval status and submission details for this sale request.</DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(selectedRequest.approval_status)}
                  <Badge className={getSaleCompletionBadgeClass(selectedRequest.dsr_id)}>{getSaleCompletionLabel(selectedRequest.dsr_id)}</Badge>
                  <span className="text-sm text-muted-foreground">Submitted {new Date(selectedRequest.created_at).toLocaleString()}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GlassCard className="p-4 space-y-2">
                    <div className="text-xs text-muted-foreground">Smartcard</div>
                    <div className="font-mono font-medium">{selectedRequest.smartcard_number}</div>
                    <div className="text-xs text-muted-foreground">Serial: {selectedRequest.serial_number}</div>
                    <div className="text-xs text-muted-foreground">Stock Type: {selectedRequest.stock_type}</div>
                  </GlassCard>
                  <GlassCard className="p-4 space-y-2">
                    <div className="text-xs text-muted-foreground">Customer</div>
                    <div className="font-medium">{selectedRequest.customer_name || 'No customer name'}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Sale Date: {selectedRequest.sale_date}</div>
                    <div className="text-xs text-muted-foreground">Updated: {new Date(selectedRequest.updated_at).toLocaleString()}</div>
                  </GlassCard>
                </div>

                <GlassCard className="p-4 space-y-2">
                  <div className="text-xs text-muted-foreground">Team Assignment</div>
                  <div className="text-sm">TL: {selectedRequest.teamLeaderName || '-'}</div>
                  <div className="text-sm">Captain: {selectedRequest.captainName || '-'}</div>
                  <div className="text-sm">DSR: {selectedRequest.dsrName || '-'}</div>
                </GlassCard>

                <div className="grid grid-cols-2 gap-4">
                  <GlassCard className="p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Payment</div>
                    <div className="font-medium">{selectedRequest.payment_status}</div>
                  </GlassCard>
                  <GlassCard className="p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Package</div>
                    <div className="font-medium">{selectedRequest.package_status}</div>
                  </GlassCard>
                </div>

                <GlassCard className="p-4">
                  <div className="text-xs text-muted-foreground mb-2">Notes</div>
                  <div className="text-sm whitespace-pre-wrap">{selectedRequest.notes || 'No notes provided.'}</div>
                </GlassCard>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}