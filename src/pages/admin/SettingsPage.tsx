import { useState } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Moon,
  Sun,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
// ExcelJS loaded dynamically in handleExportAllData

export default function SettingsPage() {
  const { toast } = useToast();
  const { adminUser } = useAuth();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    notifications: true,
    autoAssign: false,
    darkMode: document.documentElement.classList.contains('dark'),
  });

  const handleExportAllData = async () => {
    setIsExporting(true);
    try {
      const [inventoryRes, salesRes, tlRes, captainRes, dsrRes, zoneRes, regionRes] = await Promise.all([
        supabase.from('inventory').select('*'),
        supabase.from('sales_records').select('*'),
        supabase.from('team_leaders').select('*'),
        supabase.from('captains').select('*'),
        supabase.from('dsrs').select('*'),
        supabase.from('zones').select('*'),
        supabase.from('regions').select('*'),
      ]);

      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      
      const addSheet = (name: string, data: Record<string, unknown>[] | null) => {
        if (data && data.length > 0) {
          const ws = workbook.addWorksheet(name);
          ws.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
          ws.addRows(data);
        }
      };

      addSheet('Inventory', inventoryRes.data);
      addSheet('Sales', salesRes.data);
      addSheet('TeamLeaders', tlRes.data);
      addSheet('Captains', captainRes.data);
      addSheet('DSRs', dsrRes.data);
      addSheet('Zones', zoneRes.data);
      addSheet('Regions', regionRes.data);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stockflow_backup_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Success', description: 'All data exported successfully!' });
      setExportDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export data.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearSoldInventory = async () => {
    setIsClearing(true);
    try {
      const { error } = await supabase.from('inventory').delete().eq('status', 'sold');
      if (!error) {
        toast({ title: 'Success', description: 'Sold inventory cleared!' });
        setClearDialogOpen(false);
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to clear inventory.', variant: 'destructive' });
    } finally {
      setIsClearing(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !settings.darkMode;
    setSettings({ ...settings, darkMode: newMode });
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-3 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-3xl font-display font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Settings
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">Configure your StockFlow application</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <div className="grid gap-6">
              <GlassCard>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" /> Application Settings
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">Toggle dark/light theme</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      <Switch
                        checked={settings.darkMode}
                        onCheckedChange={toggleDarkMode}
                      />
                      <Moon className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Notifications</Label>
                      <p className="text-sm text-muted-foreground">Enable in-app notifications</p>
                    </div>
                    <Switch
                      checked={settings.notifications}
                      onCheckedChange={(v) => setSettings({ ...settings, notifications: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Auto-assign Stock</Label>
                      <p className="text-sm text-muted-foreground">Automatically assign new stock to TLs</p>
                    </div>
                    <Switch
                      checked={settings.autoAssign}
                      onCheckedChange={(v) => setSettings({ ...settings, autoAssign: v })}
                    />
                  </div>
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* Data Management */}
          <TabsContent value="data">
            <div className="grid gap-6">
              <GlassCard>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" /> Data Management
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div>
                      <p className="font-medium">Export All Data</p>
                      <p className="text-sm text-muted-foreground">
                        Download all data as Excel backup
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="glass-button"
                      onClick={() => setExportDialogOpen(true)}
                    >
                      <Download className="w-4 h-4 mr-2" /> Export
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div>
                      <p className="font-medium">Clear Sold Inventory</p>
                      <p className="text-sm text-muted-foreground">
                        Remove all sold items from inventory
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setClearDialogOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Clear
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div>
                      <p className="font-medium">Refresh Data</p>
                      <p className="text-sm text-muted-foreground">
                        Reload all application data
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="glass-button"
                      onClick={() => {
                        window.location.reload();
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </div>
          </TabsContent>

          {/* Account Settings */}
          <TabsContent value="account">
            <div className="grid gap-6">
              <GlassCard>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" /> Account Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={adminUser?.email || ''}
                      disabled
                      className="glass-input bg-muted/50"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Input
                      value={adminUser?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      disabled
                      className="glass-input bg-muted/50"
                    />
                  </div>
                  <div className="pt-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-2">
                      To change your password, please sign out and use the forgot password feature.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </TabsContent>
        </Tabs>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Export All Data</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              This will export all inventory, sales, team members, zones, and regions to an Excel file.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleExportAllData}
                disabled={isExporting}
                className="bg-gradient-to-r from-primary to-secondary"
              >
                {isExporting ? 'Exporting...' : 'Export Now'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear Dialog */}
        <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Clear Sold Inventory</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              This will permanently delete all inventory items with status "sold".
              This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearSoldInventory}
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear Sold Items'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
