import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ShellBase from "./ShellBase";

export default function ConsumerShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const loginContext = useMemo(() => {
    try {
      // Team Login vs normal consumer login context
      return String(localStorage.getItem("login_context_user") || sessionStorage.getItem("login_context_user") || "").toLowerCase();
    } catch {
      return "";
    }
  }, []);
  const isTeamLogin = loginContext === "team";

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

  const menu = useMemo(() => {
    // Team Login should only see:
    // kyc, team-wallet, history, support, withdrawal, genealogy-5, upload to wallet.
    if (isTeamLogin) {
      return [
        { to: "/user/genealogy-5", label: "Genealogy Tree", icon: "tree" },
        { to: "/user/kyc", label: "KYC", icon: "shield" },
        { to: "/user/team-wallet", label: "Team Wallet", icon: "wallet" },
        { to: "/user/upload-wallet", label: "Upload to Wallet", icon: "upload" },
        // Withdrawal screen is implemented as /user/wallet (Wallet component)
        { to: "/user/wallet", label: "Withdrawal", icon: "wallet" },
        { to: "/user/history", label: "History", icon: "orders" },
        { to: "/user/support", label: "Support", icon: "ticket" },
      ];
    }

    // Default full consumer menu
    return [
      { to: "/user/dashboard", label: "Dashboard", icon: "dashboard" },
      { to: "/user/profile", label: "Profile", icon: "users" },
      // { to: "/user/kyc", label: "KYC", icon: "shield" },
      { to: "/user/refer-earn", label: "Refer & Earn", icon: "upload" },
      { to: "/user/team-wallet", label: "Team Wallet", icon: "wallet" },
      { to: "/user/upload-wallet", label: "Upload to Wallet", icon: "upload" },
      { to: "/user/wallet", label: "Withdraw", icon: "wallet" },
      { to: "/user/history", label: "History", icon: "orders" },
      //{ to: "/user/my-team", label: "My Team", icon: "tree" },
      { to: "/user/genealogy-5", label: "Genealogy Tree", icon: "tree" },

      { to: "/user/promo-packages", label: "Join Prime", icon: "star" },
      { to: "/user/dashboard/upgrade", label: "Rank Upgrade", icon: "wallet" },
      { to: "/user/redeem-coupon", label: "My E coupons", icon: "ticket" },
      { to: "/user/my-orders", label: "My Orders", icon: "orders" },
      { to: "/trikonekt-products", label: "Trikonekt Products", icon: "box" },
      // { to: "/merchant-marketplace", label: "Merchant Marketplace", icon: "box" },
      // { to: "/agency-marketplace", label: "Agency Marketplace", icon: "box" },
      { to: "/user/support", label: "Support", icon: "ticket" },
      { to: "/user/cart", label: "Cart", icon: "orders" },
    ];
  }, [isTeamLogin]);

  const isActive = (to, loc) => {
    // Trikonekt Products should be active for nested routes too
    if (to === "/trikonekt-products") {
      return loc.pathname === "/trikonekt-products" || loc.pathname.startsWith("/trikonekt-products/");
    }
    // Agency Marketplace should be active for nested routes too
    if (to === "/agency-marketplace") {
      return loc.pathname === "/agency-marketplace" || loc.pathname.startsWith("/agency-marketplace/");
    }
    // Merchant Marketplace should be active for nested routes too
    if (to === "/merchant-marketplace") {
      return loc.pathname === "/merchant-marketplace" || loc.pathname.startsWith("/merchant-marketplace/");
    }
    return `${loc.pathname}${loc.search}` === to;
  };

  return (
    <ShellBase
      title=" "
      menu={menu}
      isActive={isActive}
      onLogout={onLogout}
      footerText={`Logged in as: ${displayName}`}
      rootPaths={isTeamLogin ? ["/user/genealogy-5"] : ["/user/dashboard"]}
      onBackFallbackPath={isTeamLogin ? "/user/genealogy-5" : "/user/dashboard"}
    >
      {children}
    </ShellBase>
  );
}
