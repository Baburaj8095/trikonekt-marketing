import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function AdminShell({ children }) {
  const loc = useLocation();

  // Responsive flags
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  // Sidebar: open on desktop, closed by default on mobile
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );

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

  // Nav definition
  const items = [
    { to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/admin/user-tree", label: "Genealogy", icon: "tree" },
    { to: "/admin/users", label: "Users", icon: "users" },
    { to: "/admin/products", label: "Products", icon: "box" },
    { to: "/admin/banners", label: "Banners", icon: "image" },
    { to: "/admin/orders", label: "Orders", icon: "orders" },
    { to: "/admin/uploads", label: "Uploads", icon: "upload" },
    { to: "/admin/dashboard-cards", label: "Dashboard Cards", icon: "image" },
    { to: "/admin/home-cards", label: "Home Cards", icon: "image" },
    { to: "/admin/lucky-draw", label: "Lucky Draw", icon: "ticket" },
    { to: "/admin/kyc", label: "KYC", icon: "shield" },
    { to: "/admin/withdrawals", label: "Withdrawals", icon: "wallet" },
    { to: "/admin/e-coupons", label: "E‑Coupons", icon: "ticket" },
    { to: "/admin/business", label: "Business", icon: "briefcase" },
    { to: "/admin/reports", label: "Reports", icon: "chart" },
    { to: "/admin/matrix/five", label: "5‑Matrix", icon: "matrix5" },
    { to: "/admin/matrix/three", label: "3‑Matrix", icon: "matrix3" },
    { to: "/admin/autopool", label: "Auto Commission", icon: "pool" },
  ];

  function isActive(to) {
    if (to === "/admin/matrix/five" || to === "/admin/matrix/three") {
      return loc.pathname.startsWith("/admin/matrix");
    }
    return loc.pathname === to;
  }

  function Icon({ name, active }) {
    const stroke = active ? "#0ea5e9" : "#94a3b8";
    const size = 18;
    // Minimal, generic icons to avoid external deps
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

  function NavLink({ to, label, icon }) {
    const active = isActive(to);
    return (
      <Link
        to={to}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 8,
          color: active ? "#0ea5e9" : "#cbd5e1",
          textDecoration: "none",
          background: active ? "rgba(14,165,233,0.12)" : "transparent",
          border: active ? "1px solid rgba(14,165,233,0.35)" : "1px solid transparent",
        }}
      >
        <Icon name={icon} active={active} />
        <span style={{ fontWeight: active ? 700 : 600, fontSize: 14 }}>{label}</span>
      </Link>
    );
  }

  const headerHeightMobile = 56;
  const sidebarWidth = 260;
  const sidebarGap = 20;
  const topOffset = isMobile ? headerHeightMobile : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
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
            width: isMobile ? (sidebarOpen ? sidebarWidth : 0) : sidebarWidth,
            minWidth: isMobile ? (sidebarOpen ? sidebarWidth : 0) : sidebarWidth,
            height: `calc(100vh - ${topOffset}px)`,
            overflowY: "auto",
            transition: isMobile ? "width 200ms ease, min-width 200ms ease" : "none",
            background: "#0f172a",
            borderRight: "1px solid #0b1220",
            padding: (isMobile && !sidebarOpen) ? 0 : "12px",
          }}
        >
          {(isMobile && !sidebarOpen) ? null : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ color: "#cbd5e1", fontWeight: 900, fontSize: 14, padding: "2px 4px 10px" }}>
                Admin Menu
              </div>
              {items.map((it) => (
                <NavLink key={it.to} to={it.to} label={it.label} icon={it.icon} />
              ))}
              <div style={{ marginTop: 8, borderTop: "1px solid #0b1220" }} />
              <div style={{ color: "#64748b", fontSize: 11, padding: "8px 4px" }}>
                © {new Date().getFullYear()} Admin Console
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: isMobile ? 12 : 16,
            marginLeft: isMobile ? 0 : (sidebarWidth + sidebarGap),
            width: "100%",
          }}
        >
          <div style={{ width: "100%", margin: "0 auto", maxWidth: 1400 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
