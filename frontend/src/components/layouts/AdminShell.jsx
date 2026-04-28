import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API, { ensureFreshAccess, getAccessToken } from "../../api/api";
import { getAdminMeta } from "../../admin-panel/api/adminMeta";
import ShellBase from "./ShellBase";

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
    if (to.startsWith("/admin/access-manager")) return "users";
    if (to.startsWith("/admin/users") || to.startsWith("/admin/user-tree") || to.startsWith("/admin/dashboard/models/auth/")) return "users";
    if (to.startsWith("/admin/e-coupons")) return "ecoupons";
    if (to.startsWith("/admin/kyc")) return "kyc";
    if (to.startsWith("/admin/withdrawals")) return "withdrawals";
    if (to.startsWith("/admin/support")) return "support";
    if (to.startsWith("/admin/autopool")) return "autopool";
    if (to.startsWith("/admin/commissions")) return "commissions";
    if (to.startsWith("/admin/reports") || to.startsWith("/admin/business")) return "reports_basic";
    if (
      to.startsWith("/admin/banners") ||
      to.startsWith("/admin/packages") ||
      to.startsWith("/admin/products") ||
      to.startsWith("/admin/payments") ||
      to.startsWith("/admin/agency-prime-requests") ||
      to.startsWith("/admin/lucky-draw") ||
      to.startsWith("/admin/promo-purchases") ||
      to.startsWith("/admin/promo-package-products") ||
      to.startsWith("/admin/agency-prime-requests") ||
      to.startsWith("/admin/tri/") ||
      to.startsWith("/admin/dashboard/models/business/")
    )
      return "promo";
    if (to.startsWith("/admin/notifications")) return "support";
    return null;
  }

  const groups = useMemo(
    () => [
      {
        key: "user",
        label: "User Management",
        items: [
          { to: "/admin/users", label: "Users", icon: "users" },
          { to: "/admin/user-tree", label: "Genealogy", icon: "tree" },
        ],
      },
      {
        key: "administration",
        label: "Administration",
        items: [
          { to: "/admin_user", label: "Admin Users", icon: "users", rbacAnyOf: ["manage_users", "show_users"] },
          { to: "/role", label: "Roles", icon: "shield", rbacAnyOf: ["manage_roles", "show_roles"] },
          { to: "/permission", label: "Permissions", icon: "shield", rbacAnyOf: ["manage_permissions", "show_permissions"] },
          {
            to: "/user_permission",
            label: "User Permission Mapping",
            icon: "shield",
            rbacAnyOf: ["manage_roles", "manage_permissions", "show_roles", "show_permissions"],
          },
        ],
      },
      {
        key: "catalog",
        label: "Catalog",
        items: [
          { to: "/admin/ecommerce-categories", label: "Categories", icon: "box" },
          { to: "/admin/products", label: "Products", icon: "box" },
          { to: "/admin/seed-demo", label: "Seed Demo Data", icon: "upload" },
        ],
      },
      {
        key: "ops",
        label: "Operations",
        items: [
          { to: "/admin/packages", label: "Packages", icon: "box" },
          { to: "/admin/payments", label: "Payments", icon: "wallet" },
          { to: "/admin/agency-prime-requests", label: "Agency Prime Requests", icon: "wallet" },
        ],
      },
      {
        key: "merchant_config",
        label: "Merchant Config",
        items: [
          { to: "/admin/merchant-categories", label: "Merchant Categories", icon: "box" },
          { to: "/admin/merchant-subcategories", label: "Merchant Subcategories", icon: "box" },
        ],
      },
      {
        key: "compliance",
        label: "Compliance & Finance",
        items: [
          { to: "/admin/kyc", label: "KYC", icon: "shield" },
          { to: "/admin/withdrawals", label: "Withdrawals", icon: "wallet" },
          { to: "/admin/support", label: "Support", icon: "ticket" },
        ],
      },
      {
        key: "promotions",
        label: "Promotions",
        items: [
          { to: "/admin/lucky-draw", label: "Lucky Draw", icon: "ticket" },
          { to: "/admin/e-coupons", label: "E‑Coupons", icon: "ticket" },
          { to: "/admin/dashboard/models/business/promopackage", label: "Promo Packages", icon: "box" },
          { to: "/admin/promo-package-products", label: "Upload Promo Products (₹750)", icon: "upload" },
          { to: "/admin/dashboard/models/business/promopackageproduct", label: "Promo Products (₹750)", icon: "box" },
          { to: "/admin/dashboard/models/business/promomonthlypackage", label: "Season Numbers", icon: "box" },
          { to: "/admin/dashboard/models/business/promomonthlybox", label: "Season Boxes (Paid)", icon: "box" },
          { to: "/admin/promo-purchases", label: "Promo Purchases", icon: "ticket" },
          { to: "/admin/rank-upgrades", label: "Rank Upgrades", icon: "wallet" },
        ],
      },
      {
        key: "tri",
        label: "TRI Apps",
        items: [
          { to: "/admin/tri/tri-holidays", label: "Manage TRI Holidays", icon: "box" },
          { to: "/admin/tri/tri-ev", label: "Manage TRI EV Vehicles", icon: "box" },
          { to: "/admin/tri/tri-furniture", label: "Manage TRI Furniture", icon: "box" },
          { to: "/admin/tri/tri-electronics", label: "Manage TRI Electronics", icon: "box" },
          { to: "/admin/tri/tri-properties", label: "Manage TRI Properties", icon: "box" },
          { to: "/admin/tri/tri-saving", label: "Manage TRI Saving", icon: "box" },
          { to: "/admin/tri/tri-local-store", label: "Manage Local Store", icon: "box" },
        ],
      },
      {
        key: "reports",
        label: "Reports & Business",
        items: [
          { to: "/admin/reports", label: "Reports", icon: "chart" },
          { to: "/admin/business", label: "Business", icon: "briefcase" },
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
        key: "dev",
        label: "Developer Tools",
        requiresSuperuser: true,
        items: [{ to: "/admin/dashboard/models", label: "Developer Service", icon: "box" }],
      },
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
      return any.some((c) => rbacPerms.includes(c));
    };

    const filterItem = (it) => {
      if (!allowRBAC(it)) return false;
      if (!mods) return true;
      const mk = routeToModule(it.to);
      return !mk || !!mods[mk];
    };

    const out = [];

    out.push({ to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" });

    // Quick user-category bifurcation (requested): each links to AdminUsers with query params.
    // AdminUsers already reads URLSearchParams(role/category) and applies server-side filters.
    out.push({ type: "section", label: "Users — Quick Filters", collapsible: true, groupChildren: true });
    out.push({ to: "/admin/users", label: "All Users", icon: "users" });
    out.push({ to: "/admin/users?category=consumer", label: "Consumers", icon: "users" });
    out.push({ to: "/admin/users?category=merchant", label: "Business / Merchant", icon: "briefcase" });
    out.push({ to: "/admin/users?category=employee", label: "Sarathi / Employee", icon: "users" });
    out.push({ to: "/admin/users?category=agency_state_coordinator", label: "Agency: State Coordinator", icon: "users" });
    out.push({ to: "/admin/users?category=agency_state", label: "Agency: State", icon: "users" });
    out.push({ to: "/admin/users?category=agency_district_coordinator", label: "Agency: District Coordinator", icon: "users" });
    out.push({ to: "/admin/users?category=agency_district", label: "Agency: District", icon: "users" });
    out.push({ to: "/admin/users?category=agency_pincode_coordinator", label: "Agency: Pincode Coordinator", icon: "users" });
    out.push({ to: "/admin/users?category=agency_pincode", label: "Agency: Pincode", icon: "users" });
    out.push({ to: "/admin/users?category=agency_sub_franchise", label: "Agency: Sub Franchise", icon: "users" });

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
    return location.pathname === toPath || location.pathname.startsWith(toPath + "/") || `${location.pathname}${location.search}` === toStr;
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
