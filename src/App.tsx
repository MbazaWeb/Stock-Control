import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/auth-context";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import PWAInstallBanner from "@/components/PWAInstallBanner";

// Lazy-load page modules so route trees initialize consistently.
const PublicDashboard = lazy(() => import("./pages/PublicDashboard"));
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
const TLDashboardPage = lazy(() => import("./pages/admin/TLDashboardPage"));
const TSMDashboardPage = lazy(() => import("./pages/admin/TSMDashboardPage"));
const TLTeamPage = lazy(() => import("./pages/admin/TLTeamPage"));
const TLAssignedStockPage = lazy(() => import("./pages/admin/TLAssignedStockPage"));
const TSMStockPage = lazy(() => import("./pages/admin/TSMStockPage"));
const TLSalesRecordsPage = lazy(() => import("./pages/admin/TLSalesRecordsPage"));
const TLUnpaidPage = lazy(() => import("./pages/admin/TLUnpaidPage"));
const TLNoPackagePage = lazy(() => import("./pages/admin/TLNoPackagePage"));
const ManagerAuditPage = lazy(() => import("./pages/admin/ManagerAuditPage"));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage"));
const ManagerRecordSalePage = lazy(() => import("./pages/admin/ManagerRecordSalePage"));
const ManagerSaleRequestsPage = lazy(() => import("./pages/admin/ManagerSaleRequestsPage"));
const SalesTargetPage = lazy(() => import("./pages/admin/SalesTargetPage"));
const TLSalesTargetPage = lazy(() => import("./pages/TLSalesTargetPage"));
const TSMSalesTargetPage = lazy(() => import("./pages/TSMSalesTargetPage"));
const CaptainSalesTargetPage = lazy(() => import("./pages/CaptainSalesTargetPage"));
const PublicSalesTargetPage = lazy(() => import("./pages/PublicSalesTargetPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // 2 min — avoid redundant refetches
      gcTime: 5 * 60 * 1000,      // 5 min — keep cache a bit longer
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="space-y-4 w-64">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

const AdminHomeRoute = () => {
  const { isTeamLeader, isCaptain, isDSR, isTSM, isRegionalAdmin } = useAuth();

  if (isTSM || isRegionalAdmin) return <TSMDashboardPage />;
  if (isTeamLeader || isCaptain) return <TLDashboardPage />;
  if (isDSR) return <TLSalesRecordsPage />;
  return <AdminDashboard />;
};

function StandardAdminRoute({ children }: { children: JSX.Element }) {
  const { isTeamLeader, isCaptain, isDSR } = useAuth();
  return isTeamLeader || isCaptain || isDSR ? <Navigate to="/admin" replace /> : children;
}

function NonRegionalAdminRoute({ children }: { children: JSX.Element }) {
  const { isRegionalAdmin, isTeamLeader, isCaptain, isDSR } = useAuth();
  return isRegionalAdmin || isTeamLeader || isCaptain || isDSR ? <Navigate to="/admin" replace /> : children;
}

function AdminUserRoute({ children }: { children: JSX.Element }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/admin/login" replace />;
}

function ManagerOnlyRoute({ children }: { children: JSX.Element }) {
  const { isManager } = useAuth();
  return isManager ? children : <Navigate to="/admin" replace />;
}

function TeamLeaderOnlyRoute({ children }: { children: JSX.Element }) {
  const { isTeamLeader } = useAuth();
  return isTeamLeader ? children : <Navigate to="/admin" replace />;
}

function TsmOnlyRoute({ children }: { children: JSX.Element }) {
  const { isTSM } = useAuth();
  return isTSM ? children : <Navigate to="/admin" replace />;
}

function DsrOnlyRoute({ children }: { children: JSX.Element }) {
  const { isDSR } = useAuth();
  return isDSR ? children : <Navigate to="/admin" replace />;
}

function CaptainOrDsrRoute({ children }: { children: JSX.Element }) {
  const { isCaptain, isDSR } = useAuth();
  return isCaptain || isDSR ? children : <Navigate to="/admin" replace />;
}

function NonDsrRoute({ children }: { children: JSX.Element }) {
  const { isDSR } = useAuth();
  return isDSR ? <Navigate to="/admin" replace /> : children;
}

const AuditPageRoute = () => {
  const { isManager } = useAuth();
  return isManager ? <ManagerAuditPage /> : <AdminAuditPage />;
};

const RecordSalesRoute = () => {
  const { isManager, isDSR } = useAuth();
  if (isDSR) return <Navigate to="/admin" replace />;
  return isManager ? <ManagerRecordSalePage /> : <RecordSalePage />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallBanner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
            <Route path="/admin" element={<AdminHomeRoute />} />
            <Route path="/admin/inventory" element={<StandardAdminRoute><InventoryPage /></StandardAdminRoute>} />
            <Route path="/admin/assign-stock" element={<StandardAdminRoute><AssignStockPage /></StandardAdminRoute>} />
            <Route path="/admin/record-sales" element={<NonDsrRoute><RecordSalesRoute /></NonDsrRoute>} />
            <Route path="/admin/sales-team" element={<StandardAdminRoute><SalesTeamPage /></StandardAdminRoute>} />
            <Route path="/admin/zones-regions" element={<NonRegionalAdminRoute><ZonesRegionsPage /></NonRegionalAdminRoute>} />
            <Route path="/admin/reports" element={<StandardAdminRoute><SalesReportPage /></StandardAdminRoute>} />
            <Route path="/admin/sales-management" element={<StandardAdminRoute><SalesManagementPage /></StandardAdminRoute>} />
            <Route path="/admin/search" element={<StandardAdminRoute><AdminSearchPage /></StandardAdminRoute>} />
            <Route path="/admin/global-import" element={<StandardAdminRoute><GlobalImportPage /></StandardAdminRoute>} />
            <Route path="/admin/sales-approval" element={<StandardAdminRoute><SalesApprovalPage /></StandardAdminRoute>} />
            <Route path="/admin/regional-admins" element={<StandardAdminRoute><RegionalAdminPage /></StandardAdminRoute>} />
            <Route path="/admin/settings" element={<AdminUserRoute><SettingsPage /></AdminUserRoute>} />
            <Route path="/admin/tsm-team" element={<TsmOnlyRoute><SalesTeamPage /></TsmOnlyRoute>} />
            <Route path="/admin/tsm-stock" element={<TsmOnlyRoute><TSMStockPage /></TsmOnlyRoute>} />
            <Route path="/admin/tl-team" element={<ManagerOnlyRoute><TLTeamPage /></ManagerOnlyRoute>} />
            <Route path="/admin/tl-stock" element={<ManagerOnlyRoute><TLAssignedStockPage /></ManagerOnlyRoute>} />
            <Route path="/admin/tl-sales" element={<DsrOnlyRoute><TLSalesRecordsPage /></DsrOnlyRoute>} />
            <Route path="/admin/tl-unpaid" element={<TeamLeaderOnlyRoute><TLUnpaidPage /></TeamLeaderOnlyRoute>} />
            <Route path="/admin/tl-no-package" element={<TeamLeaderOnlyRoute><TLNoPackagePage /></TeamLeaderOnlyRoute>} />
            <Route path="/admin/sale-requests" element={<ManagerOnlyRoute><ManagerSaleRequestsPage /></ManagerOnlyRoute>} />
            <Route path="/admin/audits" element={<NonDsrRoute><AuditPageRoute /></NonDsrRoute>} />
            <Route path="/admin/sales-targets" element={<AdminUserRoute><SalesTargetPage /></AdminUserRoute>} />
            <Route path="/admin/tl-sales-targets" element={<TeamLeaderOnlyRoute><TLSalesTargetPage /></TeamLeaderOnlyRoute>} />
            <Route path="/admin/tsm-sales-targets" element={<TsmOnlyRoute><TSMSalesTargetPage /></TsmOnlyRoute>} />
            <Route path="/admin/captain-sales-targets" element={<CaptainOrDsrRoute><CaptainSalesTargetPage /></CaptainOrDsrRoute>} />
            <Route path="/public/sales-targets" element={<PublicSalesTargetPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
