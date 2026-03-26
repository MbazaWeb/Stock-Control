import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Download, FileText, Filter, Package, CreditCard, Users,
  CheckCircle2, XCircle, Clock, RefreshCw, Calendar,
} from 'lucide-react';
// ExcelJS, jsPDF, autoTable loaded dynamically in export functions
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

interface InventoryItem {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  status: string;
  payment_status: string;
  package_status: string;
  assigned_to_type: string | null;
  assigned_to_id: string | null;
  zone_id: string | null;
  region_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SaleRecord {
  id: string;
  smartcard_number: string;
  serial_number: string;
  stock_type: string;
  customer_name: string | null;
  sale_date: string;
  payment_status: string;
  package_status: string;
  team_leader_id: string | null;
  captain_id: string | null;
  dsr_id: string | null;
  zone_id: string | null;
  region_id: string | null;
  created_at: string;
}

interface Summary {
  totalInventory: number;
  available: number;
  assigned: number;
  sold: number;
  paid: number;
  unpaid: number;
  packaged: number;
  noPackage: number;
  totalSales: number;
  salesPaid: number;
  salesUnpaid: number;
  salesPackaged: number;
  salesNoPackage: number;
}

interface NameMap { [id: string]: string }

export default function SalesReportPage() {
  const { toast } = useToast();
  const { isRegionalAdmin, assignedRegionIds } = useAuth();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');

  // Filters
  const [zoneFilter, setZoneFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [tlFilter, setTlFilter] = useState('all');
  const [captainFilter, setCaptainFilter] = useState('all');
  const [dsrFilter, setDsrFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Lookup data
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [teamLeaders, setTeamLeaders] = useState<Array<{ id: string; name: string }>>([]);
  const [captains, setCaptains] = useState<Array<{ id: string; name: string }>>([]);
  const [dsrs, setDsrs] = useState<Array<{ id: string; name: string }>>([]);
  const [tlNames, setTlNames] = useState<NameMap>({});
  const [captainNames, setCaptainNames] = useState<NameMap>({});
  const [dsrNames, setDsrNames] = useState<NameMap>({});
  const [zoneNames, setZoneNames] = useState<NameMap>({});
  const [regionNames, setRegionNames] = useState<NameMap>({});

  const fetchLookups = useCallback(async () => {
    const [zRes, rRes, tlRes, cRes, dRes] = await Promise.all([
      supabase.from('zones').select('id, name').order('name'),
      supabase.from('regions').select('id, name').order('name'),
      supabase.from('team_leaders').select('id, name').order('name'),
      supabase.from('captains').select('id, name').order('name'),
      supabase.from('dsrs').select('id, name').order('name'),
    ]);

    const z = zRes.data || [];
    let r = rRes.data || [];
    const tl = tlRes.data || [];
    const c = cRes.data || [];
    const d = dRes.data || [];

    if (isRegionalAdmin && assignedRegionIds.length > 0) {
      r = r.filter(reg => assignedRegionIds.includes(reg.id));
    }

    setZones(z);
    setRegions(r);
    setTeamLeaders(tl);
    setCaptains(c);
    setDsrs(d);
    setZoneNames(Object.fromEntries(z.map(x => [x.id, x.name])));
    setRegionNames(Object.fromEntries(r.map(x => [x.id, x.name])));
    setTlNames(Object.fromEntries(tl.map(x => [x.id, x.name])));
    setCaptainNames(Object.fromEntries(c.map(x => [x.id, x.name])));
    setDsrNames(Object.fromEntries(d.map(x => [x.id, x.name])));
  }, [isRegionalAdmin, assignedRegionIds]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let invQuery = supabase.from('inventory').select('*').limit(5000);
      let salesQuery = supabase.from('sales_records').select('*').order('sale_date', { ascending: false }).limit(5000);

      if (isRegionalAdmin && assignedRegionIds.length > 0) {
        invQuery = invQuery.in('region_id', assignedRegionIds);
        salesQuery = salesQuery.in('region_id', assignedRegionIds);
      }

      const [invRes, salesRes] = await Promise.all([invQuery, salesQuery]);
      setInventory(invRes.data || []);
      setSales(salesRes.data || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [isRegionalAdmin, assignedRegionIds, toast]);

  useEffect(() => {
    fetchLookups().then(() => fetchData());
  }, [fetchLookups, fetchData]);

  // Apply filters
  const filteredInventory = inventory.filter(item => {
    if (zoneFilter !== 'all' && item.zone_id !== zoneFilter) return false;
    if (regionFilter !== 'all' && item.region_id !== regionFilter) return false;
    if (tlFilter !== 'all' && !(item.assigned_to_type === 'team_leader' && item.assigned_to_id === tlFilter)) return false;
    if (captainFilter !== 'all' && !(item.assigned_to_type === 'captain' && item.assigned_to_id === captainFilter)) return false;
    if (dsrFilter !== 'all' && !(item.assigned_to_type === 'dsr' && item.assigned_to_id === dsrFilter)) return false;
    if (dateFrom && item.created_at < dateFrom) return false;
    if (dateTo && item.created_at > dateTo + 'T23:59:59') return false;
    return true;
  });

  const filteredSales = sales.filter(item => {
    if (zoneFilter !== 'all' && item.zone_id !== zoneFilter) return false;
    if (regionFilter !== 'all' && item.region_id !== regionFilter) return false;
    if (tlFilter !== 'all' && item.team_leader_id !== tlFilter) return false;
    if (captainFilter !== 'all' && item.captain_id !== captainFilter) return false;
    if (dsrFilter !== 'all' && item.dsr_id !== dsrFilter) return false;
    if (dateFrom && item.sale_date < dateFrom) return false;
    if (dateTo && item.sale_date > dateTo) return false;
    return true;
  });

  // Summary
  const summary: Summary = {
    totalInventory: filteredInventory.length,
    available: filteredInventory.filter(i => i.status === 'available').length,
    assigned: filteredInventory.filter(i => i.status === 'assigned').length,
    sold: filteredInventory.filter(i => i.status === 'sold').length,
    paid: filteredInventory.filter(i => i.payment_status === 'Paid').length,
    unpaid: filteredInventory.filter(i => i.payment_status === 'Unpaid' || i.payment_status === 'Pending').length,
    packaged: filteredInventory.filter(i => i.package_status === 'Packaged').length,
    noPackage: filteredInventory.filter(i => i.package_status === 'No Package' || i.package_status === 'Pending').length,
    totalSales: filteredSales.length,
    salesPaid: filteredSales.filter(s => s.payment_status === 'Paid').length,
    salesUnpaid: filteredSales.filter(s => s.payment_status === 'Unpaid').length,
    salesPackaged: filteredSales.filter(s => s.package_status === 'Packaged').length,
    salesNoPackage: filteredSales.filter(s => s.package_status === 'No Package').length,
  };

  const resetFilters = () => {
    setZoneFilter('all');
    setRegionFilter('all');
    setTlFilter('all');
    setCaptainFilter('all');
    setDsrFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const getFilterLabel = () => {
    const parts: string[] = [];
    if (zoneFilter !== 'all') parts.push(`Zone: ${zoneNames[zoneFilter]}`);
    if (regionFilter !== 'all') parts.push(`Region: ${regionNames[regionFilter]}`);
    if (tlFilter !== 'all') parts.push(`TL: ${tlNames[tlFilter]}`);
    if (captainFilter !== 'all') parts.push(`Captain: ${captainNames[captainFilter]}`);
    if (dsrFilter !== 'all') parts.push(`DSR: ${dsrNames[dsrFilter]}`);
    if (dateFrom) parts.push(`From: ${dateFrom}`);
    if (dateTo) parts.push(`To: ${dateTo}`);
    return parts.length > 0 ? parts.join(' | ') : 'All Data';
  };

  // Export Excel
  const exportExcel = async () => {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();

    // Summary sheet
    const ws1 = wb.addWorksheet('Summary');
    ws1.columns = [{ header: 'Metric', key: 'metric', width: 30 }, { header: 'Count', key: 'count', width: 15 }];
    ws1.addRow({ metric: 'Filter', count: getFilterLabel() });
    ws1.addRow({ metric: '', count: '' });
    ws1.addRow({ metric: 'Total Inventory', count: summary.totalInventory });
    ws1.addRow({ metric: 'Available (Not Assigned)', count: summary.available });
    ws1.addRow({ metric: 'In Hand (Assigned)', count: summary.assigned });
    ws1.addRow({ metric: 'Sold', count: summary.sold });
    ws1.addRow({ metric: 'Inv - Paid', count: summary.paid });
    ws1.addRow({ metric: 'Inv - Unpaid', count: summary.unpaid });
    ws1.addRow({ metric: 'Inv - Packaged', count: summary.packaged });
    ws1.addRow({ metric: 'Inv - No Package', count: summary.noPackage });
    ws1.addRow({ metric: '', count: '' });
    ws1.addRow({ metric: 'Total Sales', count: summary.totalSales });
    ws1.addRow({ metric: 'Sales - Paid', count: summary.salesPaid });
    ws1.addRow({ metric: 'Sales - Unpaid', count: summary.salesUnpaid });
    ws1.addRow({ metric: 'Sales - Packaged', count: summary.salesPackaged });
    ws1.addRow({ metric: 'Sales - No Package', count: summary.salesNoPackage });

    // Inventory sheet
    const ws2 = wb.addWorksheet('Inventory');
    ws2.columns = [
      { header: 'Smartcard', key: 'sc', width: 18 },
      { header: 'Serial', key: 'sn', width: 18 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Payment', key: 'payment', width: 12 },
      { header: 'Package', key: 'pkg', width: 14 },
      { header: 'Assigned To', key: 'assigned', width: 22 },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Region', key: 'region', width: 16 },
    ];
    filteredInventory.forEach(i => {
      let assigned = '-';
      if (i.assigned_to_id) {
        const name = i.assigned_to_type === 'team_leader' ? tlNames[i.assigned_to_id]
          : i.assigned_to_type === 'captain' ? captainNames[i.assigned_to_id]
          : dsrNames[i.assigned_to_id];
        assigned = `${i.assigned_to_type === 'team_leader' ? 'TL' : i.assigned_to_type === 'captain' ? 'Capt' : 'DSR'}: ${name || 'Unknown'}`;
      }
      ws2.addRow({
        sc: i.smartcard_number, sn: i.serial_number, type: i.stock_type,
        status: i.status === 'assigned' ? 'In Hand' : i.status,
        payment: i.payment_status, pkg: i.package_status,
        assigned, zone: i.zone_id ? zoneNames[i.zone_id] || '-' : '-',
        region: i.region_id ? regionNames[i.region_id] || '-' : '-',
      });
    });

    // Sales sheet
    const ws3 = wb.addWorksheet('Sales');
    ws3.columns = [
      { header: 'Smartcard', key: 'sc', width: 18 },
      { header: 'Serial', key: 'sn', width: 18 },
      { header: 'Customer', key: 'cust', width: 20 },
      { header: 'Sale Date', key: 'date', width: 14 },
      { header: 'Payment', key: 'payment', width: 12 },
      { header: 'Package', key: 'pkg', width: 14 },
      { header: 'TL', key: 'tl', width: 18 },
      { header: 'Captain', key: 'captain', width: 18 },
      { header: 'DSR', key: 'dsr', width: 18 },
      { header: 'Zone', key: 'zone', width: 16 },
      { header: 'Region', key: 'region', width: 16 },
    ];
    filteredSales.forEach(s => {
      ws3.addRow({
        sc: s.smartcard_number, sn: s.serial_number, cust: s.customer_name || '-',
        date: s.sale_date, payment: s.payment_status, pkg: s.package_status,
        tl: s.team_leader_id ? tlNames[s.team_leader_id] || '-' : '-',
        captain: s.captain_id ? captainNames[s.captain_id] || '-' : '-',
        dsr: s.dsr_id ? dsrNames[s.dsr_id] || '-' : '-',
        zone: s.zone_id ? zoneNames[s.zone_id] || '-' : '-',
        region: s.region_id ? regionNames[s.region_id] || '-' : '-',
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stocky_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Excel report downloaded' });
  };

  // Export PDF
  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF('landscape');
    const title = `Stocky Report - ${getFilterLabel()}`;
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    // Summary table
    doc.setFontSize(13);
    doc.text('Summary', 14, 32);
    autoTable(doc, {
      startY: 36,
      head: [['Metric', 'Count']],
      body: [
        ['Total Inventory', String(summary.totalInventory)],
        ['Available (Not Assigned)', String(summary.available)],
        ['In Hand (Assigned)', String(summary.assigned)],
        ['Sold', String(summary.sold)],
        ['Inv - Paid', String(summary.paid)],
        ['Inv - Unpaid', String(summary.unpaid)],
        ['Inv - Packaged', String(summary.packaged)],
        ['Inv - No Package', String(summary.noPackage)],
        ['', ''],
        ['Total Sales', String(summary.totalSales)],
        ['Sales - Paid', String(summary.salesPaid)],
        ['Sales - Unpaid', String(summary.salesUnpaid)],
        ['Sales - Packaged', String(summary.salesPackaged)],
        ['Sales - No Package', String(summary.salesNoPackage)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Inventory table
    doc.addPage();
    doc.setFontSize(13);
    doc.text('Inventory', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Smartcard', 'Serial', 'Type', 'Status', 'Payment', 'Package', 'Assigned To']],
      body: filteredInventory.slice(0, 200).map(i => {
        let assigned = '-';
        if (i.assigned_to_id) {
          const name = i.assigned_to_type === 'team_leader' ? tlNames[i.assigned_to_id]
            : i.assigned_to_type === 'captain' ? captainNames[i.assigned_to_id] : dsrNames[i.assigned_to_id];
          assigned = `${i.assigned_to_type === 'team_leader' ? 'TL' : i.assigned_to_type === 'captain' ? 'Capt' : 'DSR'}: ${name || '?'}`;
        }
        return [i.smartcard_number, i.serial_number, i.stock_type,
          i.status === 'assigned' ? 'In Hand' : i.status, i.payment_status, i.package_status, assigned];
      }),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 7 },
    });

    // Sales table
    doc.addPage();
    doc.setFontSize(13);
    doc.text('Sales Records', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Smartcard', 'Serial', 'Customer', 'Date', 'Payment', 'Package', 'TL', 'Captain', 'DSR']],
      body: filteredSales.slice(0, 200).map(s => [
        s.smartcard_number, s.serial_number, s.customer_name || '-', s.sale_date,
        s.payment_status, s.package_status,
        s.team_leader_id ? tlNames[s.team_leader_id] || '-' : '-',
        s.captain_id ? captainNames[s.captain_id] || '-' : '-',
        s.dsr_id ? dsrNames[s.dsr_id] || '-' : '-',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 7 },
    });

    doc.save(`stocky_report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'Exported', description: 'PDF report downloaded' });
  };

  const SummaryCard = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }) => (
    <div className={`p-4 rounded-lg border ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-8 w-8 opacity-50" />
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-3 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Sales Reports
              </span>
            </h1>
            <p className="text-muted-foreground">Generate and export detailed reports</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportExcel} disabled={loading} className="gap-2">
              <Download className="h-4 w-4" />Excel
            </Button>
            <Button variant="outline" onClick={exportPDF} disabled={loading} className="gap-2">
              <FileText className="h-4 w-4" />PDF
            </Button>
            <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />Filters
            </h3>
            <Button variant="outline" size="sm" onClick={resetFilters}>Clear All</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Zone</label>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger><SelectValue placeholder="All Zones" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Region</label>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger><SelectValue placeholder="All Regions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Team Leader</label>
              <Select value={tlFilter} onValueChange={setTlFilter}>
                <SelectTrigger><SelectValue placeholder="All TLs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Leaders</SelectItem>
                  {teamLeaders.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Captain</label>
              <Select value={captainFilter} onValueChange={setCaptainFilter}>
                <SelectTrigger><SelectValue placeholder="All Captains" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Captains</SelectItem>
                  {captains.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">DSR</label>
              <Select value={dsrFilter} onValueChange={setDsrFilter}>
                <SelectTrigger><SelectValue placeholder="All DSRs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All DSRs</SelectItem>
                  {dsrs.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Date From</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Date To</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          {getFilterLabel() !== 'All Data' && (
            <div className="mt-3 text-sm text-muted-foreground">
              Active: <span className="font-medium text-primary">{getFilterLabel()}</span>
            </div>
          )}
        </GlassCard>

        {/* Report Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="glass-card">
            <TabsTrigger value="summary"><BarChart3 className="h-4 w-4 mr-2" />Summary</TabsTrigger>
            <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-2" />Inventory</TabsTrigger>
            <TabsTrigger value="sales"><CreditCard className="h-4 w-4 mr-2" />Sales</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard label="Total Inventory" value={summary.totalInventory} icon={Package} color="bg-blue-500/10 border-blue-500/30" />
              <SummaryCard label="Available (Not Assigned)" value={summary.available} icon={CheckCircle2} color="bg-green-500/10 border-green-500/30" />
              <SummaryCard label="In Hand (Assigned)" value={summary.assigned} icon={Users} color="bg-purple-500/10 border-purple-500/30" />
              <SummaryCard label="Sold" value={summary.sold} icon={CreditCard} color="bg-amber-500/10 border-amber-500/30" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard label="Inventory Paid" value={summary.paid} icon={CheckCircle2} color="bg-emerald-500/10 border-emerald-500/30" />
              <SummaryCard label="Inventory Unpaid" value={summary.unpaid} icon={Clock} color="bg-red-500/10 border-red-500/30" />
              <SummaryCard label="Inventory Packaged" value={summary.packaged} icon={Package} color="bg-teal-500/10 border-teal-500/30" />
              <SummaryCard label="Inventory No Package" value={summary.noPackage} icon={XCircle} color="bg-orange-500/10 border-orange-500/30" />
            </div>
            <GlassCard>
              <h3 className="text-lg font-semibold mb-4">Sales Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard label="Total Sales" value={summary.totalSales} icon={CreditCard} color="bg-blue-500/10 border-blue-500/30" />
                <SummaryCard label="Sales Paid" value={summary.salesPaid} icon={CheckCircle2} color="bg-emerald-500/10 border-emerald-500/30" />
                <SummaryCard label="Sales Unpaid" value={summary.salesUnpaid} icon={Clock} color="bg-red-500/10 border-red-500/30" />
                <SummaryCard label="Sales No Package" value={summary.salesNoPackage} icon={XCircle} color="bg-orange-500/10 border-orange-500/30" />
              </div>
            </GlassCard>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Inventory ({filteredInventory.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Smartcard</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Region</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredInventory.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No inventory matches filters</TableCell></TableRow>
                    ) : (
                      filteredInventory.slice(0, 100).map(item => {
                        let assignedLabel = '-';
                        if (item.assigned_to_id && item.assigned_to_type) {
                          const name = item.assigned_to_type === 'team_leader' ? tlNames[item.assigned_to_id]
                            : item.assigned_to_type === 'captain' ? captainNames[item.assigned_to_id]
                            : dsrNames[item.assigned_to_id];
                          const prefix = item.assigned_to_type === 'team_leader' ? 'TL' : item.assigned_to_type === 'captain' ? 'Capt' : 'DSR';
                          assignedLabel = `${prefix}: ${name || 'Unknown'}`;
                        }
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.smartcard_number}</TableCell>
                            <TableCell className="font-mono text-sm">{item.serial_number}</TableCell>
                            <TableCell>{item.stock_type}</TableCell>
                            <TableCell>
                              {item.status === 'available' && !item.assigned_to_id && (
                                <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30">Not Assigned</Badge>
                              )}
                              {item.status === 'available' && item.assigned_to_id && (
                                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Available</Badge>
                              )}
                              {item.status === 'assigned' && (
                                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">In Hand</Badge>
                              )}
                              {item.status === 'sold' && (
                                <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Sold</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.payment_status === 'Paid'
                                ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>
                                : <Badge className="bg-red-500/20 text-red-500 border-red-500/30">{item.payment_status}</Badge>
                              }
                            </TableCell>
                            <TableCell>
                              {item.package_status === 'Packaged'
                                ? <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Packaged</Badge>
                                : <Badge className="bg-pink-500/20 text-pink-500 border-pink-500/30">{item.package_status}</Badge>
                              }
                            </TableCell>
                            <TableCell className="text-sm">{assignedLabel}</TableCell>
                            <TableCell>{item.zone_id ? zoneNames[item.zone_id] || '-' : '-'}</TableCell>
                            <TableCell>{item.region_id ? regionNames[item.region_id] || '-' : '-'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {filteredInventory.length > 100 && (
                <p className="text-sm text-muted-foreground mt-4">Showing 100 of {filteredInventory.length}. Export to see all.</p>
              )}
            </GlassCard>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales">
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Sales Records ({filteredSales.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Smartcard</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>TL</TableHead>
                      <TableHead>Captain</TableHead>
                      <TableHead>DSR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredSales.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No sales match filters</TableCell></TableRow>
                    ) : (
                      filteredSales.slice(0, 100).map(sale => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-mono">{sale.smartcard_number}</TableCell>
                          <TableCell className="font-mono text-sm">{sale.serial_number}</TableCell>
                          <TableCell>{sale.customer_name || '-'}</TableCell>
                          <TableCell>{sale.sale_date}</TableCell>
                          <TableCell>
                            {sale.payment_status === 'Paid'
                              ? <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Paid</Badge>
                              : <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Unpaid</Badge>
                            }
                          </TableCell>
                          <TableCell>
                            {sale.package_status === 'Packaged'
                              ? <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Packaged</Badge>
                              : <Badge className="bg-pink-500/20 text-pink-500 border-pink-500/30">No Package</Badge>
                            }
                          </TableCell>
                          <TableCell>{sale.team_leader_id ? tlNames[sale.team_leader_id] || '-' : '-'}</TableCell>
                          <TableCell>{sale.captain_id ? captainNames[sale.captain_id] || '-' : '-'}</TableCell>
                          <TableCell>{sale.dsr_id ? dsrNames[sale.dsr_id] || '-' : '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {filteredSales.length > 100 && (
                <p className="text-sm text-muted-foreground mt-4">Showing 100 of {filteredSales.length}. Export to see all.</p>
              )}
            </GlassCard>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
