import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ShellBase from "../layouts/ShellBase";

export default function FranchiseShell({ children }) {
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

  const displayName = storedUser?.full_name || storedUser?.username || "Franchise Owner";

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
    navigate("/auth/login/user", { replace: true });
  };

  const menu = [
    { to: "/user/franchise-dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/user/franchise-growth", label: "Growth Overview", icon: "trending_up" },
    { to: "/user/franchise-users", label: "User Management", icon: "users" },
    { to: "/user/franchise-hierarchy", label: "Hierarchy", icon: "tree" },
    { to: "/user/franchise-orders", label: "Orders", icon: "orders" },
    { to: "/user/franchise-commissions", label: "Commissions", icon: "wallet" },
    { to: "/user/franchise-reports", label: "Reports", icon: "chart" },
    { to: "/user/franchise-support", label: "Support", icon: "ticket" },
    { to: "/user/franchise-settings", label: "Settings", icon: "shield" },
  ];

  const isActive = (to, loc) => {
    if (to === "/user/franchise-dashboard") {
      return loc.pathname === to || loc.pathname === "/demo/franchise-dashboard";
    }
    return loc.pathname.startsWith(to);
  };

  return (
    <ShellBase
      title="Franchise Console"
      menu={menu}
      isActive={isActive}
      onLogout={onLogout}
      footerText={`Logged in as ${displayName}`}
      rootPaths={["/user/franchise-dashboard", "/demo/franchise-dashboard"]}
      onBackFallbackPath="/user/franchise-dashboard"
      hideTopBar={true}
    >
      {children}
    </ShellBase>
  );
}
