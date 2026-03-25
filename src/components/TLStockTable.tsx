import { useEffect, useState } from 'react';
import { Package, Users, TrendingUp, BoxIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlassCard from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface TLStock {
  id: string;
  name: string;
  assigned: number;
  inHand: number;
  sold: number;
  received: number;
}

export default function TLStockTable() {
  const [loading, setLoading] = useState(true);
  const [tlStocks, setTLStocks] = useState<TLStock[]>([]);
  const [totals, setTotals] = useState({ assigned: 0, inHand: 0, sold: 0, received: 0 });

  useEffect(() => {
    fetchTLStock();
  }, []);

  const fetchTLStock = async () => {
    try {
      const [tlRes, inventoryRes, salesRes] = await Promise.all([
        supabase.from('team_leaders').select('*').order('name'),
        supabase.from('inventory').select('*'),
        supabase.from('sales_records').select('*'),
      ]);

      const teamLeaders = tlRes.data || [];
      const inventory = inventoryRes.data || [];
      const sales = salesRes.data || [];

      const tlData: TLStock[] = teamLeaders.map((tl) => {
        // Assigned: Total inventory assigned to this TL
        const tlInventory = inventory.filter(
          (i) => i.assigned_to_id === tl.id && i.assigned_to_type === 'team_leader'
        );
        const assigned = tlInventory.length;

        // In Hand: Assigned inventory that's still available (not sold)
        const inHand = tlInventory.filter((i) => i.status === 'available').length;

        // Sold: Sales records attributed to this TL
        const sold = sales.filter((s) => s.team_leader_id === tl.id).length;

        // Received: Total inventory ever assigned (same as assigned for now, could track history)
        const received = assigned;

        return {
          id: tl.id,
          name: tl.name,
          assigned,
          inHand,
          sold,
          received,
        };
      });

      setTLStocks(tlData);

      // Calculate totals
      const totalAssigned = tlData.reduce((sum, tl) => sum + tl.assigned, 0);
      const totalInHand = tlData.reduce((sum, tl) => sum + tl.inHand, 0);
      const totalSold = tlData.reduce((sum, tl) => sum + tl.sold, 0);
      const totalReceived = tlData.reduce((sum, tl) => sum + tl.received, 0);

      setTotals({
        assigned: totalAssigned,
        inHand: totalInHand,
        sold: totalSold,
        received: totalReceived,
      });
    } catch (error) {
      console.error('Error fetching TL stock:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <GlassCard>
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64" />
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        Team Leader Stock Status
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-primary/10 rounded-xl p-3 text-center">
          <BoxIcon className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold">{totals.received}</p>
          <p className="text-xs text-muted-foreground">Received</p>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-3 text-center">
          <Package className="h-5 w-5 mx-auto text-blue-500 mb-1" />
          <p className="text-xl font-bold">{totals.assigned}</p>
          <p className="text-xs text-muted-foreground">Assigned</p>
        </div>
        <div className="bg-green-500/10 rounded-xl p-3 text-center">
          <Package className="h-5 w-5 mx-auto text-green-500 mb-1" />
          <p className="text-xl font-bold">{totals.inHand}</p>
          <p className="text-xs text-muted-foreground">In Hand</p>
        </div>
        <div className="bg-secondary/10 rounded-xl p-3 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-secondary mb-1" />
          <p className="text-xl font-bold">{totals.sold}</p>
          <p className="text-xs text-muted-foreground">Sold</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">Team Leader</th>
              <th className="text-center py-2 px-3 font-medium text-muted-foreground">Received</th>
              <th className="text-center py-2 px-3 font-medium text-muted-foreground">Assigned</th>
              <th className="text-center py-2 px-3 font-medium text-muted-foreground">In Hand</th>
              <th className="text-center py-2 px-3 font-medium text-muted-foreground">Sold</th>
            </tr>
          </thead>
          <tbody>
            {tlStocks.map((tl) => (
              <tr key={tl.id} className="border-b border-border/30 hover:bg-primary/5">
                <td className="py-2 px-3 font-medium">{tl.name}</td>
                <td className="py-2 px-3 text-center">
                  <Badge variant="outline" className="bg-primary/10">{tl.received}</Badge>
                </td>
                <td className="py-2 px-3 text-center">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600">{tl.assigned}</Badge>
                </td>
                <td className="py-2 px-3 text-center">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">{tl.inHand}</Badge>
                </td>
                <td className="py-2 px-3 text-center">
                  <Badge variant="outline" className="bg-secondary/10 text-secondary">{tl.sold}</Badge>
                </td>
              </tr>
            ))}
            {tlStocks.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">
                  No team leaders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
