import { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Download,
  Loader2,
  Package,
  CreditCard,
  RefreshCw
} from 'lucide-react';
// ExcelJS loaded dynamically in upload/download functions
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface ImportRow {
  rowNumber: number;
  smartcard_number: string;
  serial_number: string;
  customer_name: string;
  customer_phone: string;
  payment_status: string;
  package_status: string;
  status: 'valid' | 'error' | 'warning' | 'duplicate';
  message: string;
  inventoryId?: string;
  existingStatus?: string;
}

interface ImportSummary {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  duplicates: number;
}

export default function GlobalImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [defaultPaymentStatus, setDefaultPaymentStatus] = useState('Unpaid');
  const [defaultPackageStatus, setDefaultPackageStatus] = useState('No Package');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportData([]);
    setSummary(null);

    try {
      const data = await file.arrayBuffer();
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      
      const worksheet = workbook.worksheets[0];
      const rows: ImportRow[] = [];
      const smartcardSet = new Set<string>();

      // Skip header row
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        
        const smartcard = String(row.getCell(1).value || '').trim();
        const serial = String(row.getCell(2).value || '').trim().toUpperCase();
        const customerName = String(row.getCell(3).value || '').trim();
        const customerPhone = String(row.getCell(4).value || '').trim();
        const paymentStatus = String(row.getCell(5).value || defaultPaymentStatus).trim();
        const packageStatus = String(row.getCell(6).value || defaultPackageStatus).trim();

        if (!smartcard && !serial) return; // Skip empty rows

        const importRow: ImportRow = {
          rowNumber,
          smartcard_number: smartcard,
          serial_number: serial,
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_status: paymentStatus || defaultPaymentStatus,
          package_status: packageStatus || defaultPackageStatus,
          status: 'valid',
          message: ''
        };

        // Check for duplicates in file
        if (smartcardSet.has(smartcard)) {
          importRow.status = 'duplicate';
          importRow.message = 'Duplicate smartcard in file';
        } else {
          smartcardSet.add(smartcard);
        }

        // Basic validation
        if (!smartcard) {
          importRow.status = 'error';
          importRow.message = 'Missing smartcard number';
        } else if (!serial) {
          importRow.status = 'error';
          importRow.message = 'Missing serial number';
        }

        rows.push(importRow);
      });

      // Validate against database
      const smartcards = rows.filter(r => r.status === 'valid').map(r => r.smartcard_number);
      
      if (smartcards.length > 0) {
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('id, smartcard_number, serial_number, status')
          .in('smartcard_number', smartcards);

        const inventoryMap = new Map(
          existingInventory?.map(inv => [inv.smartcard_number, inv]) || []
        );

        // Check existing sales
        const { data: existingSales } = await supabase
          .from('sales_records')
          .select('smartcard_number')
          .in('smartcard_number', smartcards);

        const salesSet = new Set(existingSales?.map(s => s.smartcard_number) || []);

        rows.forEach(row => {
          if (row.status !== 'valid') return;

          const inventory = inventoryMap.get(row.smartcard_number);
          
          if (!inventory) {
            row.status = 'error';
            row.message = 'Smartcard not found in inventory';
          } else if (inventory.serial_number !== row.serial_number) {
            row.status = 'warning';
            row.message = `Serial mismatch: DB has ${inventory.serial_number}`;
            row.inventoryId = inventory.id;
            row.existingStatus = inventory.status;
          } else if (salesSet.has(row.smartcard_number)) {
            row.status = 'warning';
            row.message = 'Already has a sales record (will update)';
            row.inventoryId = inventory.id;
            row.existingStatus = inventory.status;
          } else if (inventory.status === 'sold') {
            row.status = 'warning';
            row.message = 'Already marked as sold';
            row.inventoryId = inventory.id;
            row.existingStatus = inventory.status;
          } else {
            row.inventoryId = inventory.id;
            row.existingStatus = inventory.status;
            row.message = `Will update: ${inventory.status} → sold`;
          }
        });
      }

      setImportData(rows);
      setSummary({
        total: rows.length,
        valid: rows.filter(r => r.status === 'valid').length,
        errors: rows.filter(r => r.status === 'error').length,
        warnings: rows.filter(r => r.status === 'warning').length,
        duplicates: rows.filter(r => r.status === 'duplicate').length
      });

    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: 'Error',
        description: 'Failed to process the Excel file',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const validRows = importData.filter(r => r.status === 'valid' || r.status === 'warning');
    
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fix errors before importing',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setConfirmDialogOpen(false);

    let processed = 0;
    let success = 0;
    let failed = 0;

    for (const row of validRows) {
      try {
        // Update inventory status to sold
        if (row.inventoryId) {
          await supabase
            .from('inventory')
            .update({
              status: 'sold',
              payment_status: row.payment_status,
              package_status: row.package_status
            })
            .eq('id', row.inventoryId);

          // Check if sales record exists
          const { data: existingSale } = await supabase
            .from('sales_records')
            .select('id')
            .eq('smartcard_number', row.smartcard_number)
            .maybeSingle();

          if (existingSale) {
            // Update existing sales record
            await supabase
              .from('sales_records')
              .update({
                customer_name: row.customer_name || null,
                customer_phone: row.customer_phone || null,
                payment_status: row.payment_status,
                package_status: row.package_status
              })
              .eq('id', existingSale.id);
          } else {
            // Get inventory details for sales record
            const { data: inv } = await supabase
              .from('inventory')
              .select('*, zone_id, region_id, assigned_to_type, assigned_to_id')
              .eq('id', row.inventoryId)
              .single();

            if (inv) {
              // Create sales record
              await supabase.from('sales_records').insert({
                inventory_id: row.inventoryId,
                smartcard_number: row.smartcard_number,
                serial_number: row.serial_number,
                stock_type: inv.stock_type,
                customer_name: row.customer_name || null,
                customer_phone: row.customer_phone || null,
                payment_status: row.payment_status,
                package_status: row.package_status,
                zone_id: inv.zone_id,
                region_id: inv.region_id,
                team_leader_id: inv.assigned_to_type === 'team_leader' ? inv.assigned_to_id : null,
                captain_id: inv.assigned_to_type === 'captain' ? inv.assigned_to_id : null,
                dsr_id: inv.assigned_to_type === 'dsr' ? inv.assigned_to_id : null
              });
            }
          }

          success++;
        }
      } catch (error) {
        console.error('Error processing row:', row, error);
        failed++;
      }

      processed++;
      setImportProgress(Math.round((processed / validRows.length) * 100));
    }

    setIsImporting(false);
    
    toast({
      title: 'Import Complete',
      description: `Successfully processed ${success} items. ${failed > 0 ? `${failed} failed.` : ''}`,
      variant: failed > 0 ? 'destructive' : 'default'
    });

    // Reset state
    setImportData([]);
    setSummary(null);
  };

  const downloadTemplate = async () => {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Import');
    
    worksheet.columns = [
      { header: 'Smartcard Number', key: 'smartcard', width: 20 },
      { header: 'Serial Number', key: 'serial', width: 20 },
      { header: 'Customer Name', key: 'customer_name', width: 25 },
      { header: 'Customer Phone', key: 'customer_phone', width: 20 },
      { header: 'Payment Status', key: 'payment_status', width: 15 },
      { header: 'Package Status', key: 'package_status', width: 15 }
    ];

    // Add sample data
    worksheet.addRow({
      smartcard: '1234567890',
      serial: 'SN-ABC123',
      customer_name: 'John Doe',
      customer_phone: '+254712345678',
      payment_status: 'Paid',
      package_status: 'Packaged'
    });
    worksheet.addRow({
      smartcard: '0987654321',
      serial: 'SN-XYZ789',
      customer_name: 'Jane Smith',
      customer_phone: '+254798765432',
      payment_status: 'Unpaid',
      package_status: 'No Package'
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'global_sales_import_template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: ImportRow['status']) => {
    switch (status) {
      case 'valid':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'duplicate':
        return <RefreshCw className="h-4 w-4 text-orange-500" />;
    }
  };

  const getStatusBadge = (status: ImportRow['status']) => {
    switch (status) {
      case 'valid':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Valid</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Error</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Warning</Badge>;
      case 'duplicate':
        return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">Duplicate</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Global Import</h1>
            <p className="text-muted-foreground mt-1">
              Bulk import sales data and automatically update inventory status
            </p>
          </div>
          <Button variant="outline" className="glass-button" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        {/* Upload Section */}
        <GlassCard className="p-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Upload Sales File</h2>
            <p className="text-sm text-muted-foreground">
              Upload an Excel file with sales data. The system will automatically mark inventory items as sold.
            </p>

            {/* Default Status Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Payment Status</label>
                <Select value={defaultPaymentStatus} onValueChange={setDefaultPaymentStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Package Status</label>
                <Select value={defaultPackageStatus} onValueChange={setDefaultPackageStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Packaged">Packaged</SelectItem>
                    <SelectItem value="No Package">No Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">Processing file...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-lg font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">Excel files (.xlsx, .xls)</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload sales file"
              />
            </div>
          </div>
        </GlassCard>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <GlassCard className="p-4 text-center">
              <FileSpreadsheet className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total Rows</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold text-green-500">{summary.valid}</p>
              <p className="text-xs text-muted-foreground">Valid</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold text-yellow-500">{summary.warnings}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <XCircle className="h-6 w-6 mx-auto text-red-500 mb-2" />
              <p className="text-2xl font-bold text-red-500">{summary.errors}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </GlassCard>
            <GlassCard className="p-4 text-center">
              <RefreshCw className="h-6 w-6 mx-auto text-orange-500 mb-2" />
              <p className="text-2xl font-bold text-orange-500">{summary.duplicates}</p>
              <p className="text-xs text-muted-foreground">Duplicates</p>
            </GlassCard>
          </div>
        )}

        {/* Import Progress */}
        {isImporting && (
          <GlassCard className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Importing...</span>
                <span className="text-sm text-muted-foreground">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
          </GlassCard>
        )}

        {/* Data Preview */}
        {importData.length > 0 && !isImporting && (
          <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Preview</h2>
              <Button 
                onClick={() => setConfirmDialogOpen(true)}
                disabled={summary?.valid === 0 && summary?.warnings === 0}
                className="bg-gradient-to-r from-primary to-secondary"
              >
                <Package className="h-4 w-4 mr-2" />
                Import {(summary?.valid || 0) + (summary?.warnings || 0)} Items
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Smartcard</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.slice(0, 100).map((row, idx) => (
                    <TableRow key={idx} className={row.status === 'error' ? 'bg-red-500/5' : ''}>
                      <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(row.status)}
                          {getStatusBadge(row.status)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{row.smartcard_number}</TableCell>
                      <TableCell className="font-mono">{row.serial_number}</TableCell>
                      <TableCell>{row.customer_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={row.payment_status === 'Paid' ? 'default' : 'secondary'}>
                          <CreditCard className="h-3 w-3 mr-1" />
                          {row.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.package_status === 'Packaged' ? 'default' : 'secondary'}>
                          <Package className="h-3 w-3 mr-1" />
                          {row.package_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {row.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {importData.length > 100 && (
                <div className="p-3 text-center text-sm text-muted-foreground bg-muted/30">
                  Showing first 100 of {importData.length} rows
                </div>
              )}
            </div>
          </GlassCard>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard className="p-6">
            <h3 className="font-semibold mb-3">Expected File Format</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Column A:</strong> Smartcard Number (required)</p>
              <p><strong>Column B:</strong> Serial Number (required)</p>
              <p><strong>Column C:</strong> Customer Name (optional)</p>
              <p><strong>Column D:</strong> Customer Phone (optional)</p>
              <p><strong>Column E:</strong> Payment Status - Paid/Unpaid (optional)</p>
              <p><strong>Column F:</strong> Package Status - Packaged/No Package (optional)</p>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="font-semibold mb-3">What Happens on Import</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Inventory status changes from available/assigned → sold
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Sales record is created with customer details
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Payment & Package status are set (check later in Unpaid/No Package pages)
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                Items not found in inventory will be skipped
              </li>
            </ul>
          </GlassCard>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>
              You are about to import {(summary?.valid || 0) + (summary?.warnings || 0)} sales records. 
              This will:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm py-4">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Update inventory status to "sold"
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Create sales records with customer info
            </li>
            <li className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              {summary?.warnings || 0} items with warnings will also be processed
            </li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} className="bg-gradient-to-r from-primary to-secondary">
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
