import { useEffect, useState } from 'react';
import { PackageX, Search, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/layout/PublicLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface NoPackageSale {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  team_leader: { name: string } | null;
  captain: { name: string } | null;
  dsr: { name: string } | null;
}

export default function NoPackagePage() {
  const [sales, setSales] = useState<NoPackageSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<NoPackageSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNoPackageSales();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredSales(
        sales.filter(
          (s) =>
            s.smartcard_number.toLowerCase().includes(query) ||
            s.serial_number.toLowerCase().includes(query) ||
            s.customer_name?.toLowerCase().includes(query) ||
            s.team_leader?.name.toLowerCase().includes(query) ||
            s.dsr?.name.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredSales(sales);
    }
  }, [searchQuery, sales]);

  const fetchNoPackageSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_records')
        .select(`
          id, smartcard_number, serial_number, stock_type, customer_name, sale_date, payment_status,
          team_leaders:team_leader_id(name),
          captains:captain_id(name),
          dsrs:dsr_id(name)
        `)
        .eq('package_status', 'No Package')
        .order('sale_date', { ascending: false });

      if (!error && data) {
        setSales(
          data.map((item: any) => ({
            ...item,
            team_leader: item.team_leaders,
            captain: item.captains,
            dsr: item.dsrs,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching no package sales:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-3 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-destructive to-warning bg-clip-text text-transparent">
                No Package
              </span>
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-0.5">
              {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''} without package
            </p>
          </div>
          <Badge className="badge-destructive text-sm md:text-lg py-1 md:py-2 px-3 md:px-4 self-start">
            <PackageX className="h-5 w-5 mr-2" />
            {filteredSales.length} No Package
          </Badge>
        </div>

        {/* Search */}
        <GlassCard className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by smartcard, serial, customer, or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-glass"
            />
          </div>
        </GlassCard>

        {/* Table */}
        <GlassCard className="overflow-hidden p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-12 text-center">
              <PackageX className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">No records without package found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Sale Date</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-medium">
                        {sale.smartcard_number}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {sale.serial_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.stock_type}</Badge>
                      </TableCell>
                      <TableCell>{sale.customer_name || '-'}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(sale.sale_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            sale.payment_status === 'Paid'
                              ? 'badge-success'
                              : 'badge-warning'
                          }
                        >
                          {sale.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          {sale.team_leader && (
                            <span className="badge-blue block w-fit">TL: {sale.team_leader.name}</span>
                          )}
                          {sale.captain && (
                            <span className="badge-gold block w-fit">Capt: {sale.captain.name}</span>
                          )}
                          {sale.dsr && (
                            <span className="bg-muted px-2 py-0.5 rounded-full block w-fit">
                              DSR: {sale.dsr.name}
                            </span>
                          )}
                          {!sale.team_leader && !sale.captain && !sale.dsr && (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>
      </div>
    </PublicLayout>
  );
}
