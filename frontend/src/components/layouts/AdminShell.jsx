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
      to.startsWith("/admin/overhead-income") ||
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
      to.startsWith("/admin/user-audit") ||
      to.startsWith("/admin/ledger-statement") ||
      to.startsWith("/admin/reports/daily-report") ||
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
      to.startsWith("/admin/workflows/generate-coupon") ||
      to.startsWith("/admin/total-admin-charges")
    )
      return "reports_finance";
    if (to.startsWith("/admin/workflows/")) return "promo";
    return null;
  }

  const isFranchise =
    loc.pathname.startsWith("/admin/franchise") ||
    loc.pathname.startsWith("/admin/workflows/franchise") ||
    loc.pathname.startsWith("/admin/workflows/zonal");

  const communityGroups = useMemo(
    () => [
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
      {
        key: "community",
        label: "Community Consumers",
        items: [
          { to: "/admin/users", label: "Community Consumers (996)", icon: "users" },
          { to: "/admin/workflows/team-admin-board", label: "Community Admin Board", icon: "dashboard" },
          { to: "/admin/team-consumer/block-users", label: "Block Community Consumers", icon: "users" },
          { to: "/admin/team-consumer/top-achievers", label: "Top Achievers", icon: "users" },
        ],
      },
      {
        key: "finance_wallet_ops",
        label: "Finance & Treasury",
        items: [
          { to: "/admin/payments", label: "Payment Gateways", icon: "wallet" },
          { to: "/admin/overhead-income", label: "Daily 24h Overhead Incomes", icon: "wallet" },
          { to: "/admin/total-admin-charges", label: "Total Admin Charges", icon: "wallet" },
          { to: "/admin/wallet-upload-approvals", label: "Add Money Requests", icon: "upload" },
          { to: "/admin/withdrawals", label: "Withdrawal Requests", icon: "wallet" },
          { to: "/admin/wallet-ledger", label: "Central Ledger", icon: "wallet" },
          { to: "/admin/wallets", label: "Consumer Wallets", icon: "wallet" },
          { to: "/admin/wallet-reconcile", label: "Wallet Reconcile", icon: "chart" },
          { to: "/admin/user-audit", label: "User Earnings Audit", icon: "chart" },
        ],
      },
      {
        key: "commissions",
        label: "Commissions & Royalties",
        items: [
          { to: "/admin/commissions/distribute", label: "Commission & Layer Royalty Rules", icon: "wallet" },
          { to: "/admin/autopool", label: "Auto Commission Pool Monitor", icon: "pool" },
        ],
      },
      {
        key: "reports_consolidated",
        label: "Reports & Analytics",
        items: [
          { to: "/admin/analytics/sales", label: "Daily Sales & Cash Flow", icon: "chart" },
          { to: "/admin/reports/users-today", label: "Users Today Report", icon: "users" },
          { to: "/admin/reports/internal-wallet", label: "Internal Wallet Daily Report", icon: "wallet" },
          { to: "/admin/ledger-statement", label: "Ledger Statement", icon: "file" },
        ],
      },
      {
        key: "coupon_requested",
        label: "Coupons & Rewards",
        items: [
          { to: "/admin/workflows/generate-coupon", label: "Generate Coupon", icon: "ticket" },
          { to: "/admin/wallet-vouchers", label: "Coupon / Voucher Maintenance", icon: "ticket" },
          { to: "/admin/lucky-draw", label: "Lucky Draw", icon: "ticket" },
        ],
      },
      {
        key: "media_content",
        label: "Education & Certificates",
        items: [
          { to: "/admin/team-consumer/pdf-uploads", label: "Education PDFs", icon: "file" },
          { to: "/admin/team-consumer/certificate-uploads", label: "Certified Training Certificates", icon: "file" },
          { to: "/admin/team-consumer/wishing-banners", label: "Wishing Banners", icon: "box" },
        ],
      },
      {
        key: "compliance",
        label: "Compliance & Security",
        items: [
          { to: "/admin/kyc", label: "KYC Verification", icon: "shield" },
          { to: "/admin/support", label: "Support Tickets", icon: "ticket" },
          { to: "/admin/notifications", label: "Notifications", icon: "ticket" },
          { to: "/admin/analytics/debugger", label: "Wallet Debugger", icon: "shield" },
        ],
      },
    ],
    []
  );

  const franchiseGroups = useMemo(
    () => [
      {
        key: "franchise_hierarchy",
        label: "Franchise Hierarchy & Users",
        items: [
          { to: "/admin/franchise/users", label: "All Franchise Users", icon: "users" },
          { to: "/admin/franchise/category/agency_state_coordinator", label: "State Coordinators", icon: "users" },
          { to: "/admin/franchise/category/agency_state", label: "State Franchises", icon: "users" },
          { to: "/admin/franchise/category/agency_district_coordinator", label: "District Coordinators", icon: "users" },
          { to: "/admin/franchise/category/agency_district", label: "District Franchises", icon: "users" },
          { to: "/admin/franchise/category/agency_pincode_coordinator", label: "Pincode Coordinators", icon: "users" },
          { to: "/admin/franchise/category/agency_pincode", label: "Pincode Franchises", icon: "users" },
          { to: "/admin/franchise/category/agency_sub_franchise", label: "Sub Franchises", icon: "users" },
          { to: "/admin/franchise/category/merchant", label: "B2B Merchants", icon: "briefcase" },
        ],
      },
      {
        key: "franchise_wallets",
        label: "Franchise Wallets & Controls",
        items: [
          { to: "/admin/franchise/wallets", label: "Franchise Wallets", icon: "wallet" },
          { to: "/admin/franchise/wallet-controls", label: "Wallet Settings & Approvals", icon: "shield" },
          { to: "/admin/withdrawals", label: "Franchise Withdrawals", icon: "wallet" },
        ],
      },
      {
        key: "franchise_pools",
        label: "Zonal & Referral Pools",
        items: [
          { to: "/admin/workflows/franchise-reference-reward", label: "Franchise Reference Rewards", icon: "wallet" },
          { to: "/admin/workflows/zonal-reward", label: "Zonal Royalty Pool", icon: "wallet" },
        ],
      },
      {
        key: "franchise_media",
        label: "Documents & Recognition",
        items: [
          { to: "/admin/franchise/achievers", label: "Franchise Achievers", icon: "users" },
          { to: "/admin/franchise/wishing-banners", label: "Wishing Banners", icon: "box" },
          { to: "/admin/franchise/documents", label: "Agreements & Templates", icon: "file" },
          { to: "/admin/franchise/pdfs", label: "Franchise PDFs", icon: "file" },
          { to: "/admin/franchise/id-card", label: "Generate ID Card", icon: "shield" },
        ],
      },
      {
        key: "franchise_compliance",
        label: "Compliance & Security",
        items: [
          { to: "/admin/kyc?workspace=franchise", label: "Franchise KYC Verification", icon: "shield" },
          { to: "/admin/support", label: "Support Tickets", icon: "ticket" },
        ],
      },
    ],
    []
  );

  const activeGroups = isFranchise ? franchiseGroups : communityGroups;

  const visibleGroups = useMemo(() => {
    if (!adminInfo) return activeGroups.filter((g) => !g.requiresSuperuser);
    return activeGroups.filter((g) => (g.requiresSuperuser ? !!adminInfo.is_superuser : true));
  }, [adminInfo, activeGroups]);

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

    if (isFranchise) {
      out.push({ to: "/admin/franchise/dashboard", label: "Franchise Dashboard", icon: "dashboard" });
    } else {
      out.push({ to: "/admin/dashboard", label: "Community Dashboard", icon: "dashboard" });
    }

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
  }, [adminInfo, rbacPerms, visibleGroups, modelsErr, metrics, isFranchise]);

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

    if (toStr.includes("?")) {
      return queryMatches(toStr);
    }

    if (toPath === "/admin/users" && (location.search || "")) return false;

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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => navigate(isFranchise ? "/admin/dashboard" : "/admin/franchise/dashboard")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 8,
            border: isFranchise ? "1px solid #7c3aed" : "1px solid #2563eb",
            background: isFranchise ? "#f5f3ff" : "#eff6ff",
            color: isFranchise ? "#6d28d9" : "#1d4ed8",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            transition: "all 120ms ease",
          }}
          title={`Switch to ${isFranchise ? "Community Admin" : "Franchise Admin"}`}
        >
          <span>{isFranchise ? "🏢 Franchise Workspace" : "👤 Community Workspace"}</span>
          <span style={{ fontSize: 10, textDecoration: "underline", opacity: 0.85 }}>
            (Switch to {isFranchise ? "Community" : "Franchise"})
          </span>
        </button>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
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
      </div>
    );
  }, [adminInfo, isFranchise, navigate]);

  return (
    <div className="admin-scope">
      <ShellBase
        title={isFranchise ? "Franchise Admin" : "Community Admin"}
        menu={menu}
        isActive={isActive}
        footerText={`© ${new Date().getFullYear()} asiyapp Admin Console`}
        rightHeaderContent={rightPill}
        rootPaths={isFranchise ? ["/admin/franchise/dashboard", "/admin/franchise/users"] : ["/admin/dashboard", "/admin/users"]}
        onBackFallbackPath={isFranchise ? "/admin/franchise/dashboard" : "/admin/dashboard"}
        showBottomNav={false}
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
