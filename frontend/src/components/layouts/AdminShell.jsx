import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API, { ensureFreshAccess, getAccessToken } from "../../api/api";
import { getAdminMeta } from "../../admin-panel/api/adminMeta";
import ShellBase from "./ShellBase";
import { hasPermission } from "../../admin/permissions";

/**
 * AdminShell (ShellBase-powered)
 *
 * Refactored to use the shared ShellBase layout (same family as AgencyShell) so
 * the admin UI stays consistent and it is easier to add additional navigation
 * such as user-category bifurcation tabs.
 */
export default function AdminShell({ children }) {
  const loc = useLocation();
  const navigate = useNavigate();

  // Force API namespace to "admin" while inside AdminShell to ensure Authorization uses admin tokens
  useEffect(() => {
    try {
      if (typeof window !== "undefined") window.__tk_force_namespace = "admin";
    } catch (_) {}
    return () => {
      try {
        if (typeof window !== "undefined") delete window.__tk_force_namespace;
      } catch (_) {}
    };
  }, []);

  const [authErr, setAuthErr] = useState("");
  const [adminInfo, setAdminInfo] = useState(null);
  const [rbacPerms, setRbacPerms] = useState(null);

  // Ensure admin/staff auth; redirect to admin login on 401/403
  useEffect(() => {
    let cancelled = false;
    setAuthErr("");

    async function run() {
      try {
        // Wait for any access token (namespaced or fallback) to exist, then refresh to mint admin namespace
        let tries = 0;
        while (!getAccessToken() && tries < 20) {
          await new Promise((r) => setTimeout(r, 100));
          tries += 1;
        }
        try {
          await ensureFreshAccess();
        } catch (_) {}

        const __tk = (typeof getAccessToken === "function" ? getAccessToken() : null) || null;
        const __cfg = { timeout: 8000, retryAttempts: 0, dedupe: "cancelPrevious" };
        if (__tk) __cfg.headers = { Authorization: `Bearer ${__tk}` };

        const res = await API.get("admin/ping/", __cfg);
        if (cancelled) return;

        const d = res?.data || {};
        if (!d?.is_staff && !d?.is_superuser) {
          setAuthErr("Not authorized for admin area.");
          try {
            navigate("/admin/login", { replace: true, state: { from: { pathname: loc.pathname } } });
          } catch (_) {}
        } else {
          setAdminInfo({
            is_superuser: !!d.is_superuser,
            is_staff: !!d.is_staff,
            username: d.user,
            modules: d.modules || null,
          });
        }
      } catch (e) {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          setAuthErr("Please sign in as an admin.");
          try {
            navigate("/admin/login", { replace: true, state: { from: { pathname: loc.pathname } } });
          } catch (_) {}
        } else {
          // Soft network error: don't block page
          setAuthErr("");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [loc.pathname, navigate]);

  // Fetch RBAC permissions from /api/admin/me/ once adminInfo is available
  useEffect(() => {
    let cancelled = false;
    if (!adminInfo) {
      setRbacPerms(null);
      return () => {};
    }

    async function fetchPerms() {
      try {
        let tries = 0;
        while (!getAccessToken() && tries < 20) {
          await new Promise((r) => setTimeout(r, 100));
          tries += 1;
        }
        try {
          await ensureFreshAccess();
        } catch (_) {}

        const __tk2 = (typeof getAccessToken === "function" ? getAccessToken() : null) || null;
        const __cfg2 = { timeout: 8000, retryAttempts: 0 };
        if (__tk2) __cfg2.headers = { Authorization: `Bearer ${__tk2}` };

        const res = await API.get("admin/me/", __cfg2);
        if (!cancelled) {
          const perms = Array.isArray(res?.data?.permissions) ? res.data.permissions : [];
          setRbacPerms(perms);
        }
      } catch {
        if (!cancelled) setRbacPerms([]);
      }
    }

    fetchPerms();
    return () => {
      cancelled = true;
    };
  }, [adminInfo]);

  // Admin metrics for badges (KYC, Withdrawals) — fetch only on dashboard route
  const [metrics, setMetrics] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const onDashboardRoot = loc.pathname === "/admin/dashboard";
    if (!onDashboardRoot) {
      setMetrics(null);
      return () => {};
    }
    const fetchMetrics = () => {
      API.get("admin/metrics/", { timeout: 12000, retryAttempts: 1, cacheTTL: 15000, dedupe: "cancelPrevious" })
        .then((res) => {
          if (!cancelled) setMetrics(res?.data || null);
        })
        .catch((e) => {
          const msg = (e && (e.message || e.code)) || "";
          if (msg === "deduped" || msg === "ERR_CANCELED" || msg === "canceled") return;
        });
    };
    fetchMetrics();
    timer = setInterval(fetchMetrics, 60000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [loc.pathname]);

  // Dynamic admin models metadata (loaded only for models route)
  const [models, setModels] = useState([]);
  const [modelsErr, setModelsErr] = useState("");
  useEffect(() => {
    let mounted = true;
    const needsMeta = loc.pathname.startsWith("/admin/dashboard/models");
    if (!needsMeta) {
      return () => {
        mounted = false;
      };
    }
    getAdminMeta()
      .then((data) => {
        if (!mounted) return;
        setModels(data?.models || []);
        setModelsErr("");
      })
      .catch(() => setModelsErr("Failed to load admin models"));
    return () => {
      mounted = false;
    };
  }, [loc.pathname]);
  const modelsByApp = useMemo(() => {
    const g = {};
    const seen = new Set();
    (models || []).forEach((m) => {
      const key = `${String(m.app_label || "").toLowerCase()}.${String(m.model || "").toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      (g[m.app_label] = g[m.app_label] || []).push(m);
    });
    return g;
  }, [models]);

  // Module gating: map routes to admin module keys returned by /api/admin/ping
  function routeToModule(to) {
    if (!to) return null;
    if (
      to.startsWith("/admin/access-manager") ||
      to.startsWith("/admin/sub-admins") ||
      to.startsWith("/admin/roles") ||
      to.startsWith("/admin/permissions") ||
      to.startsWith("/admin/user-permissions")
    )
      return "users";
    if (
      to.startsWith("/admin/users") ||
      to.startsWith("/admin/user-tree") ||
      to.startsWith("/admin/team-consumer/block-users") ||
      to.startsWith("/admin/dashboard/models/auth/")
    )
      return "users";
    if (to.startsWith("/admin/e-coupons")) return "ecoupons";
    if (to.startsWith("/admin/kyc")) return "kyc";
    if (to.startsWith("/admin/withdrawals")) return "withdrawals";
    if (
      to.startsWith("/admin/wallet-command-center") ||
      to.startsWith("/admin/wallet-ledger") ||
      to.startsWith("/admin/team-wallet-dashboard") ||
      to.startsWith("/admin/wallet-monitoring") ||
      to.startsWith("/admin/wallet-settlements") ||
      to.startsWith("/admin/wallet-upload-approvals") ||
      to.startsWith("/admin/package-management") ||
      to.startsWith("/admin/reward-distribution") ||
      to.startsWith("/admin/wallets") ||
      to.startsWith("/admin/wallet-vouchers") ||
      to.startsWith("/admin/wallet-reconcile") ||
      to.startsWith("/admin/ledger-statement") ||
      to.startsWith("/admin/analytics")
    )
      return "reports_finance";
    if (to.startsWith("/admin/support")) return "support";
    if (to.startsWith("/admin/autopool")) return "autopool";
    if (to.startsWith("/admin/commissions")) return "commissions";
    if (to.startsWith("/admin/reports") || to.startsWith("/admin/business")) return "reports_basic";
    if (
      to.startsWith("/admin/banners") ||
      to.startsWith("/admin/packages") ||
      to.startsWith("/admin/products") ||
      to.startsWith("/admin/payments") ||
      to.startsWith("/admin/wallet-upload-approvals") ||
      to.startsWith("/admin/agency-prime-requests") ||
      to.startsWith("/admin/lucky-draw") ||
      to.startsWith("/admin/promo-purchases") ||
      to.startsWith("/admin/promo-package-products") ||
      to.startsWith("/admin/agency-prime-requests") ||
      to.startsWith("/admin/rank-upgrades") ||
      to.startsWith("/admin/ledger/") ||
      to.startsWith("/admin/tri/") ||
      to.startsWith("/admin/dashboard/models/business/")
    )
      return "promo";
    if (to.startsWith("/admin/notifications")) return "support";
    if (to.startsWith("/admin/franchise/")) return "promo";
    if (to.startsWith("/admin/team-consumer/")) return "promo";
    if (
      to.startsWith("/admin/workflows/franchise-reference-reward") ||
      to.startsWith("/admin/workflows/zonal-reward") ||
      to.startsWith("/admin/workflows/redeem-point-coupon-summary") ||
      to.startsWith("/admin/workflows/generate-coupon")
    )
      return "reports_finance";
    if (to.startsWith("/admin/workflows/")) return "promo";
    return null;
  }

  const groups = useMemo(
    () => [
      {
        key: "user",
        label: "User Management",
        items: [
          { to: "/admin/users", label: "Team Consumers", icon: "users" },
          { to: "/admin/user-tree", label: "Genealogy", icon: "tree" },
        ],
      },
      {
        key: "administration",
        label: "Administration",
        items: [
          { to: "/admin/sub-admins", label: "Sub Admins", icon: "users", rbacAnyOf: ["users.read", "users.write"] },
          { to: "/admin/roles", label: "Roles", icon: "shield", rbacAnyOf: ["roles.read", "roles.manage"] },
          { to: "/admin/permissions", label: "Permissions", icon: "shield", rbacAnyOf: ["permissions.read", "permissions.manage"] },
          {
            to: "/admin/user-permissions",
            label: "Role Permission Mapping",
            icon: "shield",
            rbacAnyOf: ["roles.manage", "permissions.manage", "roles.read", "permissions.read"],
          },
        ],
      },
      // {
      //   key: "catalog",
      //   label: "Catalog",
      //   items: [
      //     { to: "/admin/ecommerce-categories", label: "Categories", icon: "box" },
      //     { to: "/admin/products", label: "Products", icon: "box" },
      //     { to: "/admin/seed-demo", label: "Seed Demo Data", icon: "upload" },
      //   ],
      // },
      {
        key: "ops",
        label: "Payment Config",
        items: [
          // { to: "/admin/packages", label: "Packages", icon: "box" },
          { to: "/admin/payments", label: "Payments", icon: "wallet" },
          // { to: "/admin/payments?view=gateway", label: "Gateway", icon: "wallet" },
          // { to: "/admin/payments?view=scanner", label: "Payment Scanner", icon: "upload" },
          // { to: "/admin/agency-prime-requests", label: "Agency Prime Requests", icon: "wallet" },
        ],
      },
      {
        key: "package_management_requested",
        label: "All Packages",
        items: [
          { to: "/admin/packages", label: "All Packages (Edit)", icon: "box" },
          { to: "/admin/package-management", label: "Package Management", icon: "box" },
          { to: "/admin/dashboard/models/business/promopackage", label: "Promo Package Setup", icon: "box" },
          // { to: "/admin/packages/join-subscription", label: "Join Subscription", icon: "ticket" },
          // { to: "/admin/packages/spp", label: "Smart Product Package", icon: "ticket" },
          // { to: "/admin/packages/spp-seasons", label: "SPP Seasons", icon: "box" },
          // { to: "/admin/packages/digital-education-prime", label: "Digital Education Prime Approval", icon: "ticket" },
          // { to: "/admin/tri/tri-holidays", label: "Tri Tour Setup", icon: "box" },
          // { to: "/admin/packages/tri-tour", label: "Tri Tour", icon: "ticket" },
        ],
      },
      {
        key: "rewards_requested",
        label: "Rewards",
        items: [
         
          { to: "/admin/workflows/franchise-reference-reward", label: "Franchise Reference Reward", icon: "wallet" },
          { to: "/admin/workflows/zonal-reward", label: "Zonal Reward", icon: "wallet" },
        ],
      },
      {
        key: "configuration_requested",
        label: "Configuration",
        items: [
          { to: "/admin/workflows/social-media-links", label: "Social Media Links", icon: "file" },
          { to: "/admin/workflows/tree-toggle", label: "Tree On / Off", icon: "tree" },
          { to: "/admin/ui-config", label: "UI Configuration", icon: "box" },
        ],
      },
      {
        key: "coupon_requested",
        label: "Coupon",
        items: [
          { to: "/admin/workflows/generate-coupon", label: "Generate Coupon", icon: "ticket" },
          { to: "/admin/wallet-vouchers", label: "Coupon Summary", icon: "ticket" },
        ],
      },
      // {
      //   key: "merchant_config",
      //   label: "Merchant Categories",
      //   items: [
      //     { to: "/admin/merchant-categories", label: "Merchant Categories", icon: "box" },
      //     { to: "/admin/merchant-subcategories", label: "Merchant Subcategories", icon: "box" },
      //   ],
      // },
      {
        key: "compliance",
        label: "Kyc & Withdrawals",
        items: [
          { to: "/admin/kyc", label: "KYC", icon: "shield" },
          { to: "/admin/support", label: "Support", icon: "ticket" },
        ],
      },
      {
        key: "finance_wallet_ops",
        label: "Finance & Wallet Operations",
        items: [
          { to: "/admin/wallet-command-center", label: "Wallet Command Center", icon: "dashboard" },
          { to: "/admin/team-wallet-dashboard", label: "Team Wallet Dashboard", icon: "chart" },
          { to: "/admin/wallet-ledger", label: "Central Ledger", icon: "wallet" },
          { to: "/admin/wallets", label: "Wallet Overview", icon: "wallet" },
          { to: "/admin/wallet-upload-approvals", label: "Add Money Requests", icon: "upload" },
          { to: "/admin/withdrawals", label: "Withdrawal Requests", icon: "wallet" },
          { to: "/admin/wallet-vouchers", label: "Voucher Maintenance", icon: "ticket" },
          { to: "/admin/package-management", label: "Package Management", icon: "box" },
          { to: "/admin/reward-distribution", label: "Reward Distribution", icon: "wallet" },
          { to: "/admin/wallet-reconcile", label: "Wallet Reconcile", icon: "chart" },
          { to: "/admin/ledger-statement", label: "Ledger Statement", icon: "receipt_long" },
          { to: "/admin/analytics", label: "Demographic & Cash Flow", icon: "chart" },
          { to: "/admin/wallet-settlements", label: "Settlement Reports", icon: "chart" },
          { to: "/admin/wallet-monitoring", label: "Risk & OTP Monitoring", icon: "shield" },
        ],
      },
      {
        key: "promotions",
        label: "Package Approval",
        items: [
          { to: "/admin/lucky-draw", label: "Lucky Draw", icon: "ticket" },
          // { to: "/admin/e-coupons", label: "E‑Coupons", icon: "ticket" },
          // { to: "/admin/dashboard/models/business/promopackage", label: "Promo Packages", icon: "box" },
          // { to: "/admin/promo-package-products", label: "Upload Promo Products (₹750)", icon: "upload" },
          // { to: "/admin/dashboard/models/business/promopackageproduct", label: "Promo Products (₹750)", icon: "box" },
          // { to: "/admin/dashboard/models/business/promomonthlypackage", label: "Season Numbers", icon: "box" },
          // { to: "/admin/dashboard/models/business/promomonthlybox", label: "Season Boxes (Paid)", icon: "box" },
          // { to: "/admin/promo-purchases", label: "Promo Purchases", icon: "ticket" },

          // Package-specific approval screens (requested)
          { to: "/admin/packages/join-subscription", label: "Approvals: Join Subscription", icon: "ticket" },
          { to: "/admin/packages/spp", label: "Approvals: SPP", icon: "ticket" },
          { to: "/admin/packages/spp-seasons", label: "Manage SPP Seasons", icon: "box" },
          { to: "/admin/packages/digital-education-prime", label: "Approvals: Digital Education Prime", icon: "wallet" },
          { to: "/admin/packages/tri-tour", label: "Approvals: Tri Tour", icon: "ticket" },

          { to: "/admin/rank-upgrades", label: "All Rank Upgrades", icon: "wallet" },
          { to: "/admin/ledger/join-prime", label: "Ledger: Join Prime", icon: "ticket" },
          { to: "/admin/ledger/spp", label: "Ledger: SPP", icon: "ticket" },
          { to: "/admin/ledger/digital-education", label: "Ledger: Digital Education", icon: "wallet" },
          { to: "/admin/ledger/tri-tour", label: "Ledger: Tri Tour", icon: "ticket" },
        ],
      },

      
      {
        key: "team_consumer",
        label: "Team / Consumer",
        items: [
          { to: "/admin/workflows/team-admin-board", label: "Team Admin Board", icon: "dashboard" },
          { to: "/admin/users?category=consumer", label: "ID Card / Team Consumers", icon: "users" },
          { to: "/admin/team-consumer/block-users", label: "Block Team Consumers", icon: "users" },
          { to: "/admin/team-consumer/wishing-banners", label: "Wishing Banners", icon: "box" },
          { to: "/admin/team-consumer/top-achievers", label: "Top Achievers", icon: "users" },
          { to: "/admin/team-consumer/educational-videos", label: "Educational Videos", icon: "file" },
          { to: "/admin/team-consumer/pdf-uploads", label: "Trikonekt PDF Uploads", icon: "file" },
          { to: "/admin/team-consumer/certificate-uploads", label: "Certificate Uploads", icon: "file" },
          // { to: "/admin/team-consumer/certificate-uploads?view=training", label: "Training Certificate", icon: "file" },
        ],
      },
      {
        key: "content_requested",
        label: "Content / Front Page",
        items: [
          { to: "/admin/team-consumer/pdf-uploads?view=business", label: "Trikonekt Business PDF", icon: "file" },
          { to: "/admin/workflows/crm-connect", label: "CRM Connect", icon: "briefcase" },
          { to: "/admin/workflows/ecommerce-digital-education-frontpage", label: "E-Commerce / Digital Education Front Page", icon: "box" },
          { to: "/admin/home-cards", label: "Home Cards", icon: "box" },
          { to: "/admin/dashboard-cards", label: "Dashboard Cards", icon: "dashboard" },
        ],
      },
      {
        key: "tri",
        label: "TRI Apps",
        items: [
          { to: "/admin/tri/tri-holidays", label: "Manage TRI Holidays", icon: "box" },
        ],
      },
      {
        key: "reports",
        label: "Reports & Business",
        items: [
          { to: "/admin/reports", label: "Reports", icon: "chart" },
          // { to: "/admin/business", label: "Business", icon: "briefcase" },
        ],
      },
      {
        key: "commissions",
        label: "Commissions & Matrix",
        items: [
          { to: "/admin/commissions/distribute", label: "Commission Distribute", icon: "wallet" },
          { to: "/admin/commissions/history", label: "Commission History", icon: "wallet" },
          { to: "/admin/autopool", label: "Auto Commission", icon: "pool" },
        ],
      },
      {
        key: "engagement",
        label: "Engagement",
        items: [{ to: "/admin/notifications", label: "Notifications", icon: "ticket" }],
      },
      {
        key: "franchise",
        label: "Franchise",
        items: [
          { to: "/admin/franchise/dashboard", label: "Franchise Dashboard", icon: "dashboard" },
          { to: "/admin/franchise/achievers", label: "Achievers", icon: "users" },
          { to: "/admin/franchise/wishing-banners", label: "Wishing Banners", icon: "box" },
        ],
      },
      {
        key: "analytics",
        label: "Analytics",
        items: [
          { to: "/admin/analytics/debugger", label: "Wallet Debugger", icon: "shield" },
          { to: "/admin/analytics/sales", label: "Daily Sales Report", icon: "chart" },
        ],
      },

      // {
      //   key: "dev",
      //   label: "Developer Tools",
      //   requiresSuperuser: true,
      //   items: [{ to: "/admin/dashboard/models", label: "Developer Service", icon: "box" }],
      // },
    ],
    []
  );

  const visibleGroups = useMemo(() => {
    if (!adminInfo) return groups.filter((g) => !g.requiresSuperuser);
    return groups.filter((g) => (g.requiresSuperuser ? !!adminInfo.is_superuser : true));
  }, [adminInfo, groups]);

  const menu = useMemo(() => {
    const mods = adminInfo?.modules || null;

    const allowRBAC = (it) => {
      if (adminInfo?.is_superuser) return true;
      const any = it?.rbacAnyOf;
      if (!any || !Array.isArray(any) || any.length === 0) return true;
      if (!Array.isArray(rbacPerms)) return false;
      return hasPermission(rbacPerms, any);
    };

    const filterItem = (it) => {
      if (!allowRBAC(it)) return false;
      if (!mods) return true;
      const mk = routeToModule(it.to);
      return !mk || !!mods[mk];
    };

    const out = [];

    out.push({ to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" });

    // AdminUsers is consumer-only. Franchise/agency admin gets a separate flow.
    out.push({ type: "section", label: "Team Consumer", collapsible: true, groupChildren: true });
    out.push({ to: "/admin/users", label: "Team Consumers", icon: "users" });
    // out.push({ to: "/admin/users?category=merchant", label: "Business / Merchant", icon: "briefcase" });
    // out.push({ to: "/admin/users?category=employee", label: "Sarathi / Employee", icon: "users" });
    // out.push({ to: "/admin/users?category=agency_state_coordinator", label: "Agency: State Coordinator", icon: "users" });
    // out.push({ to: "/admin/users?category=agency_state", label: "Agency: State", icon: "users" });
    // out.push({ to: "/admin/users?category=agency_district_coordinator", label: "Agency: District Coordinator", icon: "users" });
    // out.push({ to: "/admin/users?category=agency_district", label: "Agency: District", icon: "users" });
    // out.push({ to: "/admin/users?category=agency_pincode_coordinator", label: "Agency: Pincode Coordinator", icon: "users" });
    // out.push({ to: "/admin/users?category=agency_pincode", label: "Agency: Pincode", icon: "users" });
    // out.push({ to: "/admin/users?category=agency_sub_franchise", label: "Agency: Sub Franchise", icon: "users" });

    visibleGroups.forEach((g) => {
      const items = (g.items || []).filter(filterItem);
      if (!items.length) return;
      out.push({ type: "section", label: g.label, collapsible: true, groupChildren: true });
      // Attach badge counts to specific routes if available
      out.push(
        ...items.map((it) => {
          if (typeof it?.to !== "string") return it;
          if (it.to.startsWith("/admin/kyc")) return { ...it, badge: getBadgeFor("/admin/kyc") };
          if (it.to.startsWith("/admin/withdrawals")) return { ...it, badge: getBadgeFor("/admin/withdrawals") };
          return it;
        })
      );
    });

    if (modelsErr) {
      out.push({ type: "section", label: `Models: ${modelsErr}`, collapsible: false, groupChildren: false });
    }

    return out;
  }, [adminInfo, rbacPerms, visibleGroups, modelsErr, metrics]);

  function getBadgeFor(to) {
    try {
      const m = metrics || {};
      if (to.startsWith("/admin/kyc")) {
        const v = m.users && m.users.kycPending;
        return typeof v === "number" ? v : 0;
      }
      if (to.startsWith("/admin/withdrawals")) {
        const v = m.withdrawals && m.withdrawals.pendingCount;
        return typeof v === "number" ? v : 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  // ShellBase's isActive checks exact including query by default; for admin we want nested paths too.
  const isActive = (to, location) => {
    const toStr = String(to || "");
    const toPath = toStr.split("?")[0];
    if (toPath === "/admin/dashboard/models") return String(location.pathname || "").startsWith("/admin/dashboard/models");

    const queryMatches = (candidate) => {
      const candidateStr = String(candidate || "");
      if (!candidateStr.includes("?")) return false;
      const candidatePath = candidateStr.split("?")[0];
      if (location.pathname !== candidatePath) return false;
      const candidateQuery = candidateStr.split("?")[1] || "";
      const candidateParams = new URLSearchParams(candidateQuery);
      const locParams = new URLSearchParams(location.search || "");
      for (const [k, v] of candidateParams.entries()) {
        if (locParams.get(k) !== v) return false;
      }
      return true;
    };

    // If the menu item includes query params, treat it as a *filter selector*.
    // In that case, mark active when:
    //  - pathname matches, AND
    //  - all query params in `to` match the current URL (allowing extra params like page=2)
    if (toStr.includes("?")) {
      return queryMatches(toStr);
    }

    // Special-case: keep "All Users" un-highlighted when any quick-filter query is present.
    if (toPath === "/admin/users" && (location.search || "")) return false;

    // When an alias item with query params points at the same screen, only that
    // alias should highlight. This prevents "Payments", "Gateway", and
    // "Payment Scanner" all lighting up together on the same component.
    if (location.search) {
      const hasMatchingQueryAlias = (menu || []).some((item) => {
        const itemTo = String(item?.to || "");
        return itemTo !== toStr && itemTo.split("?")[0] === toPath && queryMatches(itemTo);
      });
      if (hasMatchingQueryAlias) return false;
    }

    return location.pathname === toPath || location.pathname.startsWith(toPath + "/");
  };

  const rightPill = useMemo(() => {
    const who = adminInfo?.username ? String(adminInfo.username) : "Admin";
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
        title={who}
      >
        {who}
      </span>
    );
  }, [adminInfo]);

  return (
    <div className="admin-scope">
      <ShellBase
        title="Admin"
        menu={menu}
        isActive={isActive}
        footerText={`© ${new Date().getFullYear()} Admin Console`}
        rightHeaderContent={rightPill}
        rootPaths={["/admin/dashboard", "/admin/users"]}
        onBackFallbackPath="/admin/dashboard"
      >
        {authErr ? (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#FEF2F2",
              color: "#991B1B",
              border: "1px solid #FCA5A5",
            }}
          >
            {authErr}
          </div>
        ) : null}

        {children}
      </ShellBase>
    </div>
  );
}
