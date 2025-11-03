import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Auth/Login";
import Register from "./pages/OldRegister";
import LuckyDraw from "./pages/LuckyDraw";
import UserDashboard from "./pages/UserDashboard";
import AgencyDashboard from "./pages/AgencyDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import HomeScreen from "./pages/HomeScreen";
import RedeemCoupon from "./pages/RedeemCoupon";
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
import EnhancedLogin from "./pages/Auth/EnhancedLogin";
import Wallet from "./pages/Wallet";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        
        <Route path="/" element={<HomeScreen/>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/enhanced-login" element={<EnhancedLogin />} />
        {/* User Routes */}
        <Route
          path="/user/dashboard"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/lucky-draw"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <LuckyDraw />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/redeem-coupon"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <ConsumerShell>
                <RedeemCoupon />
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

        {/* Employee Routes */}
        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeDashboard />
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

        {/* Catch-all route for unknown paths */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
