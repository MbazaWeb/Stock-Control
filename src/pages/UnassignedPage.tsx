import { useEffect, useState } from 'react';
import { AlertTriangle, Search, Calendar } from 'lucide-react';
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

interface UnassignedSale {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  zone: { name: string } | null;
  region: { name: string } | null;
}

export default function UnassignedPage() {
  const [sales, setSales] = useState<UnassignedSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<UnassignedSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnassignedSales();
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
            s.zone?.name.toLowerCase().includes(query) ||
            s.region?.name.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredSales(sales);
    }
  }, [searchQuery, sales]);

  const fetchUnassignedSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_records')
        .select(`
          id, smartcard_number, serial_number, stock_type, customer_name, sale_date, payment_status, package_status,
          zones:zone_id(name),
          regions:region_id(name)
        `)
        .is('team_leader_id', null)
        .is('captain_id', null)
        .is('dsr_id', null)
        .order('sale_date', { ascending: false });

      if (!error && data) {
        setSales(
          data.map((item: any) => ({
            ...item,
            zone: item.zones,
            region: item.regions,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching unassigned sales:', error);
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
              <span className="bg-gradient-to-r from-warning to-primary bg-clip-text text-transparent">
                Unassigned Sales
              </span>
            </h1>
            <p className="text-xs md:text-base text-muted-foreground mt-0.5">
              {filteredSales.length} sold item{filteredSales.length !== 1 ? 's' : ''} without team assignment
            </p>
          </div>
          <Badge className="bg-warning text-warning-foreground text-sm md:text-lg py-1 md:py-2 px-3 md:px-4 self-start">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {filteredSales.length} Unassigned
          </Badge>
        </div>

        {/* Search */}
        <GlassCard className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by smartcard, serial, customer, zone, or region..."
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
              <AlertTriangle className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">No unassigned sales found</p>
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
                    <TableHead>Package</TableHead>
                    <TableHead>Location</TableHead>
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
                        <Badge
                          className={
                            sale.package_status === 'Packaged'
                              ? 'badge-success'
                              : 'badge-destructive'
                          }
                        >
                          {sale.package_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {sale.zone && <span className="badge-blue block w-fit mb-1">{sale.zone.name}</span>}
                          {sale.region && <span className="bg-muted px-2 py-0.5 rounded-full block w-fit">{sale.region.name}</span>}
                          {!sale.zone && !sale.region && <span className="text-muted-foreground">-</span>}
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
