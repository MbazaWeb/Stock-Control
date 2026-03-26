import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Eager-load the public landing page for fast first paint
import PublicDashboard from "./pages/PublicDashboard";

// Lazy-load all other pages
const SearchStock = lazy(() => import("./pages/SearchStock"));
const UnpaidPage = lazy(() => import("./pages/UnpaidPage"));
const NoPackagePage = lazy(() => import("./pages/NoPackagePage"));
const UnassignedPage = lazy(() => import("./pages/UnassignedPage"));
const AddSalePage = lazy(() => import("./pages/AddSalePage"));
const DSRPage = lazy(() => import("./pages/DSRPage"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const InventoryPage = lazy(() => import("./pages/admin/InventoryPage"));
const SalesTeamPage = lazy(() => import("./pages/admin/SalesTeamPage"));
const SalesReportPage = lazy(() => import("./pages/admin/SalesReportPage"));
const RecordSalePage = lazy(() => import("./pages/admin/RecordSalePage"));
const AssignStockPage = lazy(() => import("./pages/admin/AssignStockPage"));
const ZonesRegionsPage = lazy(() => import("./pages/admin/ZonesRegionsPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const GlobalImportPage = lazy(() => import("./pages/admin/GlobalImportPage"));
const SalesManagementPage = lazy(() => import("./pages/admin/SalesManagementPage"));
const RegionalAdminPage = lazy(() => import("./pages/admin/RegionalAdminPage"));
const AdminSearchPage = lazy(() => import("./pages/admin/AdminSearchPage"));
const SalesApprovalPage = lazy(() => import("./pages/admin/SalesApprovalPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="space-y-4 w-64">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<PublicDashboard />} />
            <Route path="/search" element={<SearchStock />} />
            <Route path="/unpaid" element={<UnpaidPage />} />
            <Route path="/no-package" element={<NoPackagePage />} />
            <Route path="/stock" element={<UnassignedPage />} />
            <Route path="/add-sale" element={<AddSalePage />} />
            <Route path="/dsrs" element={<DSRPage />} />
            
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
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
