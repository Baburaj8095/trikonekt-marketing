import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ShellBase from "./ShellBase";

/**
 * BusinessShell (Merchant)
 * Reuses the unified ShellBase layout similar to Agency/Employee shells.
 * Provides a minimal navigation for merchants to manage profile and shops.
 */
export default function BusinessShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_business") || sessionStorage.getItem("user_business");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Merchant";

  const onLogout = () => {
    try {
      localStorage.removeItem("token_business");
      localStorage.removeItem("refresh_business");
      localStorage.removeItem("role_business");
      localStorage.removeItem("user_business");
      sessionStorage.removeItem("token_business");
      sessionStorage.removeItem("refresh_business");
      sessionStorage.removeItem("role_business");
      sessionStorage.removeItem("user_business");
    } catch (_) {}
    navigate("/", { replace: true });
  };

  // Sidebar menu for merchant
  const menu = [
    { to: "/business/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/business/profile", label: "Profile", icon: "users" },
    { to: "/business/shops", label: "Shops", icon: "box" },
    { to: "/business/support", label: "Support", icon: "ticket" },
  ];

  const isActive = (to, loc) => {
    // Simple exact path + query match with nested route support for /business/shops
    const [toPath] = to.split("?");
    if (toPath === "/business/shops") {
      return loc.pathname === "/business/shops";
    }
    return `${loc.pathname}${loc.search}` === to;
  };

  return (
    <ShellBase
      title={displayName}
      menu={menu}
      isActive={isActive}
      onLogout={onLogout}
      footerText={`Logged in as: ${displayName}`}
      rootPaths={["/business/dashboard"]}
      onBackFallbackPath="/business/dashboard"
    >
      {children}
    </ShellBase>
  );
}
