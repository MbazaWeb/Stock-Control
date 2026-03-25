import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  UploadCloud,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Home,
  BarChart3,
  MapPin,
  FileUp,
  ClipboardList,
  Shield,
  Search,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/inventory', label: 'Inventory', icon: Package },
  { href: '/admin/assign-stock', label: 'Assign Stock', icon: UploadCloud },
  { href: '/admin/record-sales', label: 'Record Sales', icon: BarChart3 },
  { href: '/admin/sales-management', label: 'Sales Management', icon: ClipboardList },
  { href: '/admin/search', label: 'Admin Search', icon: Search },
  { href: '/admin/global-import', label: 'Global Import', icon: FileUp },
  { href: '/admin/sales-team', label: 'Sales Team', icon: Users },
  { href: '/admin/zones-regions', label: 'Zones & Regions', icon: MapPin },
  { href: '/admin/reports', label: 'Sales Reports', icon: BarChart3 },
  { href: '/admin/regional-admins', label: 'Regional Admins', icon: Shield, superAdminOnly: true },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, adminUser, isSuperAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const visibleMenuItems = menuItems.filter(item => 
    !item.superAdminOnly || isSuperAdmin
  );

  // Mobile top bar
  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
        <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 nav-glass">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/admin" className="flex items-center gap-2">
            <div className="icon-container-gold p-2">
              <Package className="h-4 w-4 text-foreground" />
            </div>
            <span className="font-display text-base font-bold">StockFlow</span>
          </Link>
          <div className="w-9" /> {/* Spacer for centering */}
        </header>

        {/* Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        <aside
          className={cn(
            'fixed top-0 left-0 h-full w-72 z-[60] sidebar-glass transition-transform duration-300 ease-in-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex flex-col h-full p-4">
            {/* Drawer header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="icon-container-gold p-2">
                  <Package className="h-4 w-4 text-foreground" />
                </div>
                <span className="font-display text-lg font-bold">StockFlow</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Back to Public */}
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-3 rounded-xl mb-3 text-sm font-medium glass-button"
            >
              <Home className="h-5 w-5 text-primary" />
              <span>Public Site</span>
            </Link>

            {/* Nav items */}
            <nav className="flex-1 space-y-1 overflow-y-auto min-h-0">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-blue'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User & Logout */}
            <div className="mt-auto pt-4 border-t border-border/50">
              {adminUser && (
                <div className="mb-3 px-3">
                  <p className="text-xs text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-medium truncate">{adminUser.email}</p>
                  <span className="badge-gold text-xs mt-1 inline-block">
                    {adminUser.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                </div>
              )}
              <Button
                onClick={handleSignOut}
                variant="ghost"
                className="w-full flex items-center gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </aside>
      </>
    );
  }

  // Desktop sidebar (unchanged)
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 sidebar-glass transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="icon-container-gold">
                <Package className="h-5 w-5 text-foreground" />
              </div>
              <span className="font-display text-lg font-bold">StockFlow</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Back to Public */}
        <Link
          to="/"
          className={cn(
            'flex items-center gap-3 px-3 py-3 rounded-xl mb-4 text-sm font-medium transition-all duration-200 glass-button',
            collapsed && 'justify-center'
          )}
        >
          <Home className="h-5 w-5 text-primary" />
          {!collapsed && <span>Public Site</span>}
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto min-h-0">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-blue'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  collapsed && 'justify-center'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="mt-auto pt-4 border-t border-border/50">
          {!collapsed && adminUser && (
            <div className="mb-3 px-3">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium truncate">{adminUser.email}</p>
              <span className="badge-gold text-xs mt-1 inline-block">
                {adminUser.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          )}
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className={cn(
              'w-full flex items-center gap-3 text-destructive hover:text-destructive hover:bg-destructive/10',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
