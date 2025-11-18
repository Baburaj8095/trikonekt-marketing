import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Auth/Login";
import LuckyDraw from "./pages/LuckyDraw";
import UserDashboard from "./pages/UserDashboard";
import AgencyDashboard from "./pages/AgencyDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import HomeScreen from "./pages/HomeScreen";
import ConsumerCoupon from "./pages/ConsumerCoupon";
import ConsumerKYC from "./pages/ConsumerKYC";
import AgencyLuckyCoupons from "./pages/AgencyLuckyCoupons";
import EmployeeLuckyCoupons from "./pages/EmployeeLuckyCoupons";
import ProductUpload from "./pages/agency/products/ProductUpload";
import ProductList from "./pages/agency/products/ProductList";
import PurchaseRequests from "./pages/agency/purchase/PurchaseRequests";
import Marketplace from "./pages/market/Marketplace";
import ProductDetails from "./pages/market/ProductDetails";
import MyOrders from "./pages/market/MyOrders";
import BannerDetails from "./pages/market/BannerDetails";
import BannerManage from "./pages/agency/banners/BannerManage";
import ConsumerShell from "./components/layouts/ConsumerShell";
import AgencyShell from "./components/layouts/AgencyShell";
import EmployeeShell from "./components/layouts/EmployeeShell";
import EnhancedLogin from "./pages/Auth/EnhancedLogin";
import Wallet from "./pages/Wallet";
import LoadingOverlay from "./components/LoadingOverlay";
import MyTeam from "./pages/team/MyTeam";
import EmployeeDailyReport from "./pages/reports/EmployeeDailyReport";
import AgencyDailyReport from "./pages/reports/AgencyDailyReport";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminShell from "./components/layouts/AdminShell";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUserTree from "./pages/admin/AdminUserTree";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminKYC from "./pages/admin/AdminKYC";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminMatrixFive from "./pages/admin/AdminMatrixFive";
import AdminMatrixThree from "./pages/admin/AdminMatrixThree";
import AdminAutopool from "./pages/admin/AdminAutopool";
import AdminECoupons from "./pages/admin/AdminECoupons";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUploads from "./pages/admin/AdminUploads";
import AdminBusiness from "./pages/admin/AdminBusiness";
import AdminReports from "./pages/admin/AdminReports";
import AdminDashboardCards from "./pages/admin/AdminDashboardCards";
import AdminHomeCards from "./pages/admin/AdminHomeCards";
import AdminLuckyDraw from "./pages/admin/AdminLuckyDraw";
import Profile from "./pages/Profile";
import RoleSelect from "./pages/Auth/RoleSelect";
import ReferAndEarnPage from "./pages/ReferAndEarn";
import AgencyReferAndEarn from "./pages/AgencyReferAndEarn";
import WealthGalaxy from "./pages/WealthGalaxy";
import AppHub from "./pages/AppHub";
import ModelsIndex from "./admin-panel/dynamic/ModelsIndex";
import ModelList from "./admin-panel/dynamic/ModelList";
import UsersPage from "./admin-panel/examples/UsersPage";
import ProductPage from "./admin-panel/examples/ProductPage";
import Support from "./pages/Support";
import AdminSupport from "./pages/admin/AdminSupport";

function App() {
  return (
    <BrowserRouter>
      <LoadingOverlay />
      <Routes>
        {/* Public Routes */}
        
        <Route path="/" element={<HomeScreen/>} />
        <Route path="/auth/select" element={<RoleSelect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<EnhancedLogin />} />
        <Route path="/enhanced-login" element={<EnhancedLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        {/* User Routes */}
        <Route
          path="/user/dashboard"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <UserDashboard embedded />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/lucky-draw"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <LuckyDraw embedded />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/redeem-coupon"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <ConsumerCoupon />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/wallet"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <Wallet />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/kyc"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <ConsumerKYC />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/profile"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <Profile />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/my-team"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <MyTeam />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/wealth-galaxy"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <WealthGalaxy />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/app-hub"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <AppHub />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/support"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <Support />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={<Navigate to="/user/lucky-draw" replace />}
        />

        {/* Agency Routes */}
        <Route
          path="/agency/dashboard"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <AgencyDashboard />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/lucky-coupons"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <AgencyLuckyCoupons />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/my-team"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <MyTeam />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/daily-report"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <AgencyDailyReport />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/profile"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <Profile />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/wallet"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <Wallet />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/refer-earn"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <AgencyReferAndEarn />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/support"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <Support />
              </AgencyShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/agency/marketplace"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <Marketplace />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/marketplace/products/:id"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <ProductDetails />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/marketplace/banners/:id"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <BannerDetails />
              </AgencyShell>
            </ProtectedRoute>
          }
        />

        {/* Employee Routes */}
        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeShell>
                <EmployeeDashboard embedded />
              </EmployeeShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/lucky-coupons"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeLuckyCoupons />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/my-team"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <MyTeam />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/daily-report"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeShell>
                <EmployeeDailyReport />
              </EmployeeShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/profile"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeShell>
                <Profile />
              </EmployeeShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/wallet"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeShell>
                <Wallet />
              </EmployeeShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/support"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeShell>
                <Support />
              </EmployeeShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/user/refer-earn"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <ReferAndEarnPage />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />
        {/* Marketplace (Public + Consumer) */}
        <Route path="/marketplace" element={<ConsumerShell><Marketplace /></ConsumerShell>} />
        <Route path="/marketplace/products/:id" element={<ConsumerShell><ProductDetails /></ConsumerShell>} />
        <Route path="/marketplace/banners/:id" element={<ConsumerShell><BannerDetails /></ConsumerShell>} />
        <Route
          path="/marketplace/my-orders"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <MyOrders />
              </ConsumerShell>
            </ProtectedRoute>
          }
        />

        {/* Agency - Products and Purchase Requests */}
        <Route
          path="/agency/products/upload"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <ProductUpload />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/products"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <ProductList />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/banners"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <BannerManage />
              </AgencyShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/agency/purchase-requests"
          element={
            <ProtectedRoute allowedRoles={["agency"]}>
              <AgencyShell>
                <PurchaseRequests />
              </AgencyShell>
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminDashboard />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/user-tree"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminUserTree />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminUsers />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/kyc"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminKYC />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/withdrawals"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminWithdrawals />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/matrix/five"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminMatrixFive />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/matrix/three"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminMatrixThree />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/autopool"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminAutopool />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/e-coupons"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminECoupons />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminProducts />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/banners"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminBanners />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminOrders />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/uploads"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminUploads />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/business"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminBusiness />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminReports />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/support"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminSupport />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard-cards"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminDashboardCards />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/home-cards"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminHomeCards />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/lucky-draw"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <AdminLuckyDraw />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard/models"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <ModelsIndex />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard/models/:app/:model"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <ModelList />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard/examples/users"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <UsersPage />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard/examples/products"
          element={
            <AdminProtectedRoute>
              <AdminShell>
                <ProductPage />
              </AdminShell>
            </AdminProtectedRoute>
          }
        />
        {/* Catch-all route for unknown paths */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
