import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ShellBase from "./ShellBase";

export default function ConsumerShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";

  const onLogout = () => {
    try {
      localStorage.removeItem("token_user");
      localStorage.removeItem("refresh_user");
      localStorage.removeItem("role_user");
      localStorage.removeItem("user_user");
      sessionStorage.removeItem("token_user");
      sessionStorage.removeItem("refresh_user");
      sessionStorage.removeItem("role_user");
      sessionStorage.removeItem("user_user");
    } catch (_) {}
    navigate("/", { replace: true });
  };

  const menu = [
    { to: "/user/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/user/wealth-galaxy", label: "Wealth Galaxy", icon: "chart" },
    { to: "/user/app-hub", label: "App Hub", icon: "box" },
    { to: "/user/profile", label: "Profile", icon: "users" },
    { to: "/user/lucky-draw", label: "Manual Lucky Coupon", icon: "ticket" },
    { to: "/trikonekt-products", label: "Trikonekt Products", icon: "box" },
    { to: "/agency-marketplace", label: "Agency Marketplace", icon: "box" },
    { to: "/marketplace/my-orders", label: "My Orders", icon: "orders" },
    { to: "/user/redeem-coupon", label: "E-Coupon", icon: "ticket" },
    { to: "/user/e-coupon-store", label: "E-Coupon Store", icon: "box" },
    { to: "/user/wallet", label: "Wallet", icon: "wallet" },
    { to: "/user/history", label: "History", icon: "orders" },
    { to: "/user/kyc", label: "KYC", icon: "shield" },
    { to: "/user/my-team", label: "My Team", icon: "tree" },
    { to: "/user/refer-earn", label: "Refer & Earn", icon: "upload" },
    { to: "/user/support", label: "Support", icon: "ticket" },
  ];

  const isActive = (to, loc) => {
    // Trikonekt Products should be active for nested routes too
    if (to === "/trikonekt-products") {
      return loc.pathname === "/trikonekt-products" || loc.pathname.startsWith("/trikonekt-products/");
    }
    // Agency Marketplace should be active for nested routes too
    if (to === "/agency-marketplace") {
      return loc.pathname === "/agency-marketplace" || loc.pathname.startsWith("/agency-marketplace/");
    }
    return `${loc.pathname}${loc.search}` === to;
  };

  return (
    <ShellBase
      title="Consumer"
      menu={menu}
      isActive={isActive}
      onLogout={onLogout}
      footerText={`Logged in as: ${displayName}`}
    >
      {children}
    </ShellBase>
  );
}
