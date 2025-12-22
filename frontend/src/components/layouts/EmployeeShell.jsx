import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ShellBase from "./ShellBase";

export default function EmployeeShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_employee") || sessionStorage.getItem("user_employee");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Employee";

  const onLogout = () => {
    try {
      localStorage.removeItem("token_employee");
      localStorage.removeItem("refresh_employee");
      localStorage.removeItem("role_employee");
      localStorage.removeItem("user_employee");
      sessionStorage.removeItem("token_employee");
      sessionStorage.removeItem("refresh_employee");
      sessionStorage.removeItem("role_employee");
      sessionStorage.removeItem("user_employee");
    } catch (_) {}
    navigate("/", { replace: true });
  };

  const menu = [
    { to: "/employee/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/employee/profile", label: "Profile", icon: "users" },

    // Dashboard tabs via query param
    { to: "/employee/dashboard?tab=lucky_draw_history", label: "Lucky Draw Submission", icon: "ticket" },
    { to: "/employee/dashboard?tab=my_team", label: "Genealogy", icon: "tree" },
    { to: "/employee/dashboard?tab=refer_earn", label: "Refer & Earn", icon: "upload" },
    { to: "/employee/dashboard?tab=rewards", label: "Rewards", icon: "chart" },
    { to: "/employee/dashboard?tab=e_coupons", label: "My E‑Coupons", icon: "ticket" },
    { to: "/employee/e-coupon-store", label: "E-Coupon Store", icon: "box" },
    { to: "/employee/cart", label: "Cart", icon: "orders" },
    { to: "/employee/trikonekt-products", label: "Trikonekt Products", icon: "box" },
    { to: "/employee/dashboard?tab=offer_letter", label: "Offer Letter", icon: "file" },
    { to: "/employee/wallet", label: "Wallet", icon: "wallet" },
    { to: "/employee/history", label: "History", icon: "orders" },
    { to: "/employee/support", label: "Support", icon: "ticket" },

    { to: "/employee/daily-report", label: "Daily Report", icon: "box" },
  ];

  const isActive = (to, loc) => {
    // Normalize and compare
    const [toPath, toQuery] = to.split("?");
    if (toPath === "/employee/dashboard") {
      const q = new URLSearchParams(loc.search);
      const tab = (q.get("tab") || "").toLowerCase();
      const targetTab = new URLSearchParams(toQuery || "").get("tab");
      if (!targetTab) {
        // base dashboard active when no 'tab' present
        return loc.pathname === "/employee/dashboard" && !q.get("tab");
      }
      return loc.pathname === "/employee/dashboard" && tab === String(targetTab).toLowerCase();
    }
    // Trikonekt Products (including nested routes)
    if (toPath === "/employee/trikonekt-products") {
      return loc.pathname === "/employee/trikonekt-products" || loc.pathname.startsWith("/employee/trikonekt-products/");
    }
    // Exact path match for other pages
    return `${loc.pathname}${loc.search}` === to;
  };

  return (
    <ShellBase
      title="Employee"
      menu={menu}
      isActive={isActive}
      onLogout={onLogout}
      footerText={`Logged in as: ${displayName}`}
    >
      {children}
    </ShellBase>
  );
}
