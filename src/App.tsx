import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

// Public Pages
import PublicDashboard from "./pages/PublicDashboard";
import SearchStock from "./pages/SearchStock";
import UnpaidPage from "./pages/UnpaidPage";
import NoPackagePage from "./pages/NoPackagePage";
import UnassignedPage from "./pages/UnassignedPage";import AddSalePage from './pages/AddSalePage';
// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import InventoryPage from "./pages/admin/InventoryPage";
import SalesTeamPage from "./pages/admin/SalesTeamPage";
import SalesReportPage from "./pages/admin/SalesReportPage";
import RecordSalePage from "./pages/admin/RecordSalePage";
import AssignStockPage from "./pages/admin/AssignStockPage";
import ZonesRegionsPage from "./pages/admin/ZonesRegionsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import GlobalImportPage from "./pages/admin/GlobalImportPage";
import SalesManagementPage from "./pages/admin/SalesManagementPage";
import RegionalAdminPage from "./pages/admin/RegionalAdminPage";
import AdminSearchPage from "./pages/admin/AdminSearchPage";import SalesApprovalPage from './pages/admin/SalesApprovalPage';
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicDashboard />} />
            <Route path="/search" element={<SearchStock />} />
            <Route path="/unpaid" element={<UnpaidPage />} />
            <Route path="/no-package" element={<NoPackagePage />} />
            <Route path="/stock" element={<UnassignedPage />} />
            <Route path="/add-sale" element={<AddSalePage />} />
            
            {/* Admin Auth */}
            <Route path="/admin/login" element={<AdminLogin />} />
            
            {/* Admin Protected Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/inventory" element={<InventoryPage />} />
            <Route path="/admin/assign-stock" element={<AssignStockPage />} />
            <Route path="/admin/record-sales" element={<RecordSalePage />} />
            <Route path="/admin/sales-team" element={<SalesTeamPage />} />
            <Route path="/admin/zones-regions" element={<ZonesRegionsPage />} />
            <Route path="/admin/reports" element={<SalesReportPage />} />
            <Route path="/admin/sales-management" element={<SalesManagementPage />} />
            <Route path="/admin/search" element={<AdminSearchPage />} />
            <Route path="/admin/global-import" element={<GlobalImportPage />} />
            <Route path="/admin/sales-approval" element={<SalesApprovalPage />} />
            <Route path="/admin/regional-admins" element={<RegionalAdminPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
