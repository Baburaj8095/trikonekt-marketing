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
    // team-dashboard, profile, join prime, rank upgrade + essentials.
    if (isTeamLogin) {
      return [
        { to: "/user/team-dashboard", label: "Dashboard", icon: "dashboard" },
        { to: "/user/upload-wallet", label: "Add Money", icon: "upload" },

        {
          type: "section",
          label: "Buy Packages",
          icon: "box",
          collapsible: true,
          groupChildren: false,
          items: [
            { to: "/user/packages/join-subscription", label: "Join Subscription", icon: "star" },
            { to: "/user/packages/spp", label: "Smart Product Purchase (SPP)", icon: "box" },
            { to: "/user/packages/digital-education-prime", label: "Digital Education Prime Purchase", icon: "wallet" },
            { to: "/user/tri/tri-holidays", label: "Tri Tour", icon: "ticket" },
          ],
        },

        { to: "/user/gift-card-summary", label: "Gift Card Summary", icon: "ticket" },
        { to: "/user/promo-packages", label: "Package Summary", icon: "orders" },
        { to: "/user/packages/digital-education-prime", label: "Educational Video Summary", icon: "file" },
        { to: "/user/team-dashboard?action=id-card", label: "Generate ID Card", icon: "users" },
        { to: "/user/support", label: "Support", icon: "ticket" },
        { to: "/user/trikonekt-pdf", label: "Trikonekt PDF", icon: "file" },
        { to: "/user/certificate-download", label: "Certificate Download", icon: "file" },
        { to: "/user/team-wallet", label: "Team Wallet", icon: "wallet" },
        { to: "/user/team-history", label: "Team History", icon: "orders" },
        { to: "/user/wallet", label: "Withdrawal", icon: "wallet" },
        { to: "/user/coupon-pocket", label: "Coupon Pocket", icon: "ticket" },
        { to: "/user/package-coupon-pocket", label: "Package Purchase Coupon", icon: "ticket" },
        { to: "/trikonekt-products", label: "E-Commerce", icon: "box" },
        { to: "/user/tri/tri-holidays", label: "TRI Tour", icon: "ticket" },
        { to: "/user/refer-earn", label: "Refer & Earn", icon: "upload" },
        { to: "/user/kyc", label: "KYC", icon: "shield" },
      ];
    }

    // Default full consumer menu
    return [
      { to: "/user/dashboard", label: "Dashboard", icon: "dashboard" },
      { to: "/user/profile", label: "Profile", icon: "users" },
      // { to: "/user/kyc", label: "KYC", icon: "shield" },
      { to: "/user/refer-earn", label: "Refer & Earn", icon: "upload" },
      { to: "/user/gift-card-summary", label: "Gift Card Summary", icon: "ticket" },
      { to: "/user/gift-cards", label: "Hubble Gift Cards", icon: "ticket" },
      { to: "/user/team-wallet", label: "Team Wallet", icon: "wallet" },
      { to: "/user/team-history", label: "Team History", icon: "orders" },
      { to: "/user/coupon-pocket", label: "Coupon Pocket", icon: "ticket" },
      { to: "/user/upload-wallet", label: "Upload to Wallet", icon: "upload" },
      { to: "/user/wallet", label: "Withdraw", icon: "wallet" },
      { to: "/user/history", label: "History", icon: "orders" },
      //{ to: "/user/my-team", label: "My Team", icon: "tree" },
      { to: "/user/genealogy-5", label: "Genealogy Tree", icon: "tree" },

      // Packages accordion (consumer login)
      {
        type: "section",
        label: "Packages",
        icon: "box",
        collapsible: true,
        groupChildren: false,
        items: [
          { to: "/user/packages/join-subscription", label: "Join Subscription", icon: "star" },
          { to: "/user/packages/spp", label: "Smart Product Purchase (SPP)", icon: "box" },
          { to: "/user/packages/digital-education-prime", label: "Digital Education Prime Purchase", icon: "wallet" },
          { to: "/user/tri/tri-holidays", label: "Tri Tour", icon: "ticket" },
        ],
      },

      // Keep legacy entries for backward compatibility / direct access
      { to: "/user/promo-packages", label: "Package Summary", icon: "orders" },
      { to: "/user/dashboard/upgrade", label: "Rank Upgrade (Legacy)", icon: "wallet" },
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
      rootPaths={isTeamLogin ? ["/user/team-dashboard"] : ["/user/dashboard"]}
      onBackFallbackPath={isTeamLogin ? "/user/team-dashboard" : "/user/dashboard"}
    >
      {children}
    </ShellBase>
  );
}
