import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ShellBase from "./ShellBase";

/**
 * AgencyShell
 * Updated to use the unified ShellBase layout (same template family as Admin/Consumer/Employee)
 * - Dark, professional sidebar
 * - Responsive mobile top bar and drawer
 * - Consistent header/sidebar styling across roles
 */
export default function AgencyShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_agency") || sessionStorage.getItem("user_agency");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Agency";

  const onLogout = () => {
    try {
      localStorage.removeItem("token_agency");
      localStorage.removeItem("refresh_agency");
      localStorage.removeItem("role_agency");
      localStorage.removeItem("user_agency");
      sessionStorage.removeItem("token_agency");
      sessionStorage.removeItem("refresh_agency");
      sessionStorage.removeItem("role_agency");
      sessionStorage.removeItem("user_agency");
    } catch (_) {}
    navigate("/", { replace: true });
  };

  // Sidebar menu (parity with previous AgencyShell)
  const menu = [
    { to: "/agency/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/agency/profile", label: "Profile", icon: "users" },

    // Lucky-coupons tabs
    { to: "/agency/lucky-coupons?tab=pending", label: "Lucky Draw Submissions", icon: "ticket" },
    { to: "/agency/lucky-coupons?tab=assign", label: "E Coupon", icon: "ticket" },
    { to: "/agency/lucky-coupons?tab=commission", label: "Commission Summary", icon: "chart" },

    { to: "/agency/my-team", label: "My Team", icon: "tree" },
    { to: "/agency/daily-report", label: "Daily Report", icon: "chart" },

    // Marketplace
    { to: "/agency/marketplace", label: "Marketplace", icon: "box" },

    // Refer & Earn
    { to: "/agency/refer-earn", label: "Refer & Earn", icon: "users" },

    // Resources
    { to: "/agency/banners", label: "Banners", icon: "image" },
    { to: "/agency/purchase-requests", label: "Purchase Requests", icon: "orders" },
  ];

  // Active link matcher with support for lucky-coupons tabs and marketplace nested routes
  const isActive = (to, loc) => {
    // Parse target
    const [toPath, toQuery] = to.split("?");
    const qTarget = new URLSearchParams(toQuery || "");

    // Lucky coupons tab matching
    if (toPath === "/agency/lucky-coupons") {
      if (!loc.pathname.startsWith("/agency/lucky-coupons")) return false;
      const q = new URLSearchParams(loc.search || "");
      const targetTab = (qTarget.get("tab") || "").toLowerCase();
      const currentTab = (q.get("tab") || "").toLowerCase();
      // pending entry should be active when tab is empty or 'pending'
      if (!targetTab) return currentTab === "" || currentTab === "pending";
      return currentTab === targetTab;
    }

    // Marketplace (including nested routes)
    if (toPath === "/agency/marketplace") {
      return loc.pathname === "/agency/marketplace" || loc.pathname.startsWith("/agency/marketplace/");
    }

    // Exact match including query for everything else
    return `${loc.pathname}${loc.search}` === to;
  };

  return (
    <ShellBase
      title="Agency"
      menu={menu}
      isActive={isActive}
      onLogout={onLogout}
      footerText={`Logged in as: ${displayName}`}
    >
      {children}
    </ShellBase>
  );
}
