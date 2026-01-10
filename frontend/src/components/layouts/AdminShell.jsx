import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API from "../../api/api";
import { getAdminMeta } from "../../admin-panel/api/adminMeta";

export default function AdminShell({ children }) {
  const loc = useLocation();
  const navigate = useNavigate();

  // Responsive flags
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  // Sidebar: open on desktop, closed by default on mobile
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );

  // Desktop mini/rail mode (icons only)
  const [mini, setMini] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin.sidebar.mini") === "1";
  });

  // Collapsible group open state (persisted)
  const [groupOpen, setGroupOpen] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("admin.sidebar.groups") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    function onResize() {
      const m = window.innerWidth < 1024;
      setIsMobile(m);
      setSidebarOpen(!m); // force open on desktop, closed on mobile
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close drawer on route change (mobile only)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [loc.pathname, isMobile]);

  // Persist mini mode (desktop only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("admin.sidebar.mini", mini ? "1" : "0");
    }
  }, [mini]);

  // Persist group states
  function updateGroupOpen(updater) {
    setGroupOpen((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem("admin.sidebar.groups", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  function toggleGroup(key) {
    updateGroupOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function isGroupOpen(key, hasActive, effectiveMini) {
    if (effectiveMini) return true; // always show children when mini (no headers)
    const v = groupOpen[key];
    if (v === undefined) return hasActive; // default open if a child is active
    return v;
  }

  // Admin auth ping removed to avoid extra network call
  const [authErr, setAuthErr] = useState("");
  const [adminInfo, setAdminInfo] = useState(null);

  // Ensure admin/staff auth; redirect to admin login on 401/403
  useEffect(() => {
    let cancelled = false;
    setAuthErr("");
    API.get("admin/ping/", { timeout: 8000, retryAttempts: 0, dedupe: "cancelPrevious" })
      .then((res) => {
        if (cancelled) return;
        const d = res?.data || {};
        if (!d?.is_staff && !d?.is_superuser) {
          setAuthErr("Not authorized for admin area.");
          try {
            navigate("/admin/login", { replace: true, state: { from: { pathname: loc.pathname } } });
          } catch (_) {}
        } else {
          setAdminInfo({ is_superuser: !!d.is_superuser, is_staff: !!d.is_staff, username: d.user });
        }
      })
      .catch((e) => {
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
      });
    return () => { cancelled = true; };
  }, [loc.pathname, navigate]);

  // Admin metrics for badges (KYC, Withdrawals) – fetch only on dashboard route
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

  // Dynamic admin models metadata (loaded, not yet displayed by default)
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

  // Route active detection
  function isRouteActive(to) {
    // Keep models index active for nested routes
    if (to === "/admin/dashboard/models") {
      return loc.pathname.startsWith("/admin/dashboard/models");
    }
    // Default: active if exact or nested under this specific link
    return loc.pathname === to || loc.pathname.startsWith(to + "/");
  }

  // Minimal, generic icons to avoid external deps
  function Icon({ name, active }) {
    const stroke = active ? "#0ea5e9" : "#94a3b8";
    const size = 18;
    switch (name) {
      case "dashboard":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="10" width="7" height="11" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        );
      case "users":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case "tree":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2v7" />
            <circle cx="12" cy="11" r="2" />
            <path d="M6 22v-6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6" />
          </svg>
        );
      case "upload":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        );
      case "shield":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      case "wallet":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="16" cy="12" r="1.5" />
          </svg>
        );
      case "ticket":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9h18v6H3z" />
            <path d="M7 9v6M17 9v6" />
          </svg>
        );
      case "briefcase":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="7" width="18" height="14" rx="2" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        );
      case "chart":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="21" x2="21" y2="21" />
            <rect x="7" y="10" width="3" height="8" />
            <rect x="12" y="6" width="3" height="12" />
            <rect x="17" y="13" width="3" height="5" />
          </svg>
        );
      case "matrix5":
      case "matrix3":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="5" r="2" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
            <path d="M12 7v3M10 12h4" />
          </svg>
        );
      case "pool":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" />
            <path d="M2 14c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" />
          </svg>
        );
      case "box":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 16V8a2 2 0 0 0-1.2-1.8l-6-3a2 2 0 0 0-1.6 0l-6 3A2 2 0 0 0 5 8v8a2 2 0 0 0 1.2 1.8l6 3a2 2 0 0 0 1.6 0l6-3A2 2 0 0 0 21 16z" />
            <path d="M3.3 7L12 12l8.7-5" />
          </svg>
        );
      case "image":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        );
      case "orders":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="14" rx="2" />
            <path d="M7 8h10M7 12h6" />
          </svg>
        );
      default:
        return null;
    }
  }

  // Navigation groups
  const groups = [
    {
      key: "user",
      label: "User Management",
      items: [
        { to: "/admin/users", label: "Users", icon: "users" },
        { to: "/admin/user-tree", label: "Genealogy", icon: "tree" },
      ],
    },
    {
      key: "ops",
      label: "Operations",
      items: [
        { to: "/admin/packages", label: "Packages", icon: "box" },
        { to: "/admin/products", label: "Products", icon: "box" },
        { to: "/admin/banners", label: "Banners", icon: "image" },
        // { to: "/admin/orders", label: "Orders", icon: "orders" },
        { to: "/admin/payments", label: "Payments", icon: "wallet" },
        { to: "/admin/agency-prime-requests", label: "Agency Prime Requests", icon: "wallet" },
        // { to: "/admin/uploads", label: "Uploads", icon: "upload" },
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
        // Promo packages and related admin models inside AdminShell
        { to: "/admin/dashboard/models/business/promopackage", label: "Promo Packages", icon: "box" },
        { to: "/admin/dashboard/models/business/promoebook", label: "Promo E‑Books (Library)", icon: "box" },
        { to: "/admin/dashboard/models/business/promopackageebook", label: "Package → E‑Books Mapping", icon: "box" },
        { to: "/admin/promo-package-products", label: "Upload Promo Products (₹750)", icon: "upload" },
        { to: "/admin/dashboard/models/business/promopackageproduct", label: "Promo Products (₹750)", icon: "box" },
        { to: "/admin/dashboard/models/business/promomonthlypackage", label: "Season Numbers", icon: "box" },
        // Optional: inspect paid boxes if needed
        { to: "/admin/dashboard/models/business/promomonthlybox", label: "Season Boxes (Paid)", icon: "box" },
        { to: "/admin/promo-purchases", label: "Promo Purchases", icon: "ticket" },
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
      key: "administration",
      label: "Administration",
      items: [
        { to: "/admin/dashboard/models/auth/user", label: "Admin Users", icon: "users" },
        { to: "/admin/dashboard/models/auth/group", label: "Roles", icon: "shield" },
        { to: "/admin/dashboard/models/auth/permission", label: "Permissions", icon: "shield" },
        { to: "/admin/dashboard/models/auth/group", label: "Role Permissions", icon: "shield" }
      ],
    },
    {
      key: "commissions",
      label: "Commissions & Matrix",
      items: [
        // { to: "/admin/matrix/five", label: "5‑Matrix", icon: "matrix5" },
        // { to: "/admin/matrix/three", label: "3‑Matrix", icon: "matrix3" },
        // { to: "/admin/commissions/matrix", label: "Matrix Commission", icon: "wallet" },
        // { to: "/admin/commissions/levels", label: "Level Commission", icon: "wallet" },
        { to: "/admin/commissions/distribute", label: "Commission Distribute", icon: "wallet" },
        { to: "/admin/commissions/history", label: "Commission History", icon: "wallet" },
        // { to: "/admin/rewards/points", label: "Rewards Points", icon: "chart" },
        { to: "/admin/autopool", label: "Auto Commission", icon: "pool" },
      ],
    },
    {
      key: "engagement",
      label: "Engagement",
      items: [
        { to: "/admin/notifications", label: "Notifications", icon: "ticket" }
      ],
    },
    {
      key: "dev",
      label: "Developer Tools",
      requiresSuperuser: true,
      items: [{ to: "/admin/dashboard/models", label: "Developer Service", icon: "box" }],
    },
  ];

  const visibleGroups = useMemo(() => {
    if (!adminInfo) {
      // Hide superuser-only sections until we know privileges
      return groups.filter((g) => !g.requiresSuperuser);
    }
    return groups.filter((g) => (g.requiresSuperuser ? !!adminInfo.is_superuser : true));
  }, [adminInfo]);

  const flatItems = visibleGroups.flatMap((g) => g.items);

  function NavLink({ to, label, icon, compact, badge }) {
    const active = isRouteActive(to);
    const badgeVal = typeof badge === "number" ? badge : (badge ? Number(badge) : 0);
    const showBadge = !!badgeVal && badgeVal > 0;
    const badgeText = badgeVal > 99 ? "99+" : String(badgeVal);
    return (
      <Link
        to={to}
        title={label}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: compact ? 0 : 10,
          justifyContent: compact ? "center" : "flex-start",
          padding: compact ? "10px 0" : "10px 12px",
          borderRadius: 8,
          color: active ? "#0ea5e9" : "#cbd5e1",
          textDecoration: "none",
          background: active ? "rgba(14,165,233,0.12)" : "transparent",
          border: active ? "1px solid rgba(14,165,233,0.35)" : "1px solid transparent",
        }}
      >
        <Icon name={icon} active={active} />
        {!compact ? (
          <>
            <span style={{ fontWeight: active ? 700 : 600, fontSize: 14 }}>{label}</span>
            {showBadge ? (
              <span
                aria-label="count"
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: "18px",
                }}
              >
                {badgeText}
              </span>
            ) : null}
          </>
        ) : null}
        {compact && showBadge ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 4,
              right: 6,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "#ef4444",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              lineHeight: "16px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {badgeText}
          </span>
        ) : null}
      </Link>
    );
  }

  const headerHeightMobile = 56;
  const sidebarWidthFull = 260;
  const sidebarWidthMini = 72;
  const sidebarGap = 20;
  const topOffset = isMobile ? headerHeightMobile : 0;
  const effectiveMini = !isMobile && mini;

  // Helpers to compute group active/open
  function groupHasActive(g) {
    return g.items.some((it) => isRouteActive(it.to));
  }

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

  return (
    <div className="admin-scope" style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Top bar: shown only on mobile */}
      {isMobile ? (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            height: headerHeightMobile,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            borderBottom: "1px solid #e2e8f0",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              aria-label="Toggle sidebar"
              onClick={() => setSidebarOpen((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontWeight: 900, color: "#0f172a", fontSize: 18 }}>Admin</span>
              <span style={{ color: "#64748b", fontSize: 12 }}>Control Panel</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Backdrop for mobile drawer */}
      {isMobile && sidebarOpen ? (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.35)",
            zIndex: 20,
          }}
        />
      ) : null}

      {/* Layout */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Sidebar: permanent on desktop, drawer on mobile */}
        <aside
          style={{
            position: "fixed",
            top: topOffset,
            left: 0,
            zIndex: 25,
            width: isMobile ? (sidebarOpen ? sidebarWidthFull : 0) : (effectiveMini ? sidebarWidthMini : sidebarWidthFull),
            minWidth: isMobile ? (sidebarOpen ? sidebarWidthFull : 0) : (effectiveMini ? sidebarWidthMini : sidebarWidthFull),
            height: `calc(100dvh - ${topOffset}px)`,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
            transition: isMobile ? "width 200ms ease, min-width 200ms ease" : "width 150ms ease, min-width 150ms ease",
            background: "#0f172a",
            borderRight: "1px solid #0b1220",
            padding: isMobile && !sidebarOpen ? 0 : "12px",
          }}
        >
          {isMobile && !sidebarOpen ? null : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Desktop header inside sidebar */}
              {!isMobile ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: effectiveMini ? "center" : "space-between", padding: "4px 4px 8px" }}>
                  {!effectiveMini ? (
                    <div style={{ color: "#cbd5e1", fontWeight: 900, fontSize: 14 }}>Admin Menu</div>
                  ) : null}
                  <button
                    aria-label="Toggle mini sidebar"
                    onClick={() => setMini((v) => !v)}
                    title={effectiveMini ? "Expand sidebar" : "Collapse to icons"}
                    style={{
                      marginLeft: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid #0b1220",
                      background: "#0c1427",
                      cursor: "pointer",
                    }}
                  >
                    {/* Simple chevron icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {effectiveMini ? (
                        <>
                          <polyline points="9 18 15 12 9 6" />
                        </>
                      ) : (
                        <>
                          <polyline points="15 18 9 12 15 6" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              ) : (
                <div style={{ color: "#cbd5e1", fontWeight: 900, fontSize: 14, padding: "2px 4px 6px" }}>Admin Menu</div>
              )}

              {/* Always show Dashboard on top */}
              <NavLink to="/admin/dashboard" label="Dashboard" icon="dashboard" compact={effectiveMini} badge={getBadgeFor("/admin/dashboard")} />

              {/* In mini mode, flatten all links; in full mode, show collapsible groups */}
              {effectiveMini ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {flatItems.map((it) => (
                    <NavLink key={it.to} to={it.to} label={it.label} icon={it.icon} compact badge={getBadgeFor(it.to)} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {visibleGroups.map((g) => {
                    const active = groupHasActive(g);
                    const open = isGroupOpen(g.key, active, effectiveMini);
                    return (
                      <div key={g.key} style={{}}>
                        <button
                          onClick={() => toggleGroup(g.key)}
                          aria-expanded={open}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #0b1220",
                            background: active ? "#0c1427" : "#0a1120",
                            color: active ? "#93c5fd" : "#94a3b8",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.2 }}>{g.label}</span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={active ? "#93c5fd" : "#94a3b8"}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 120ms ease" }}
                            aria-hidden="true"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                        {open ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
                            {g.items.map((it) => (
                              <NavLink key={it.to} to={it.to} label={it.label} icon={it.icon} compact={false} badge={getBadgeFor(it.to)} />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 8, borderTop: "1px solid #0b1220" }} />
              <div style={{ color: "#64748b", fontSize: 11, padding: "8px 4px" }}>
                © {new Date().getFullYear()} Admin Console
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main
          className="tk-main"
          style={{
            flex: 1,
            minWidth: 0,
            padding: isMobile ? 12 : 16,
            marginLeft: isMobile ? 0 : ((effectiveMini ? sidebarWidthMini : sidebarWidthFull) + sidebarGap),
            width: "100%",
          }}
        >
          <div style={{ width: "100%", margin: "0 auto", maxWidth: 1400 }}>
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
          </div>
        </main>
      </div>
    </div>
  );
}
