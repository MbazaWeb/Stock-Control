import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Search, 
  CreditCard, 
  PackageX, 
  Package,
  LogIn,
  Menu,
  X,
  ShoppingCart,
  Users
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/unpaid', label: 'Unpaid', icon: CreditCard },
  { href: '/no-package', label: 'No Package', icon: PackageX },
  { href: '/stock', label: 'Stock', icon: Package },
  { href: '/add-sale', label: 'Add Sale', icon: ShoppingCart },
  { href: '/dsrs', label: 'DSRs', icon: Users },
];

export default function PublicNav() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="nav-glass">
      <div className="container mx-auto px-2 md:px-4">
        <div className="flex h-14 md:h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 md:gap-3">
            <div className="icon-container-blue p-2 md:p-3">
              <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <span className="font-display text-base md:text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              StockFlow
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-blue"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Admin Login */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/admin/login">
              <Button className="btn-gold-gradient flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-xl glass-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                to="/admin/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium btn-gold-gradient mt-2"
              >
                <LogIn className="h-5 w-5" />
                Admin Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
