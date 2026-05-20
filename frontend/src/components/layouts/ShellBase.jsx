import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NotificationsBell from "../NotificationsBell";
import { useCartStore } from "../../store/cartStore";

const shellTokens = {
  bg: "#F5F7FA",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  primary: "#2563eb",
  primarySoft: "rgba(37,99,235,0.08)",
  sidebar: "#F8FAFC",
  shadow: "0 14px 34px rgba(15,23,42,0.10)",
};

export default function ShellBase({
  title = "Console",
  menu = [],
  isActive,
  onLogout,
  footerText,
  rightHeaderContent,
  rootPaths,
  isRoot,
  onBackFallbackPath,
  children,
}) {
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
  // Collapsible sections state (e.g. "My E‑Coupon Club")
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    function onResize() {
      const m = window.innerWidth < 1024;
      setIsMobile(m);
      setSidebarOpen(!m); // force open on desktop, closed on mobile
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function openSidebar() {
      setSidebarOpen(true);
    }
    window.addEventListener("trikonekt:open-consumer-sidebar", openSidebar);
    return () => window.removeEventListener("trikonekt:open-consumer-sidebar", openSidebar);
  }, []);

  // Close drawer on route change (mobile only)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [loc.pathname, loc.search, isMobile]);

  function defaultIsActive(to, location) {
    // Default behavior: exact path match including query
    return `${location.pathname}${location.search}` === to;
  }
  const activeCheck = useMemo(() => isActive || defaultIsActive, [isActive]);

  function Icon({ name, active }) {
    const stroke = active ? shellTokens.primary : "#64748b";
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
      case "file":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
      case "star":
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15 8.5 22 9.5 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9.5 9 8.5" />
          </svg>
        );
      default:
        return null;
    }
  }



  function CartIcon({ size = 22, stroke = "#0f172a" }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="17" cy="20" r="1.5" />
        <path d="M2 3h2l2.6 10.4A2 2 0 0 0 8.5 15H17a2 2 0 0 0 2-1.6L21 7H6" />
      </svg>
    );
  }

  // Dynamic cart count from global store
  const cartItems = useCartStore((s) => s.items);
  const cartCount = Array.isArray(cartItems) ? cartItems.reduce((sum, i) => sum + (i.qty || 0), 0) : 0;

  function NavLink({ to, label, icon, badge }) {
    const active = activeCheck(to, loc);
    const badgeVal = typeof badge === "number" ? badge : (badge ? Number(badge) : 0);
    const showBadge = Number.isFinite(badgeVal) && badgeVal > 0;
    const badgeText = badgeVal > 99 ? "99+" : String(badgeVal);
    return (
      <Link
        to={to}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          position: "relative",
          minHeight: 48,
          padding: "8px 10px 8px 15px",
          borderRadius: 12,
          color: active ? shellTokens.primary : "#334155",
          textDecoration: "none",
          background: active ? shellTokens.primarySoft : "transparent",
          border: "1px solid transparent",
          cursor: "pointer",
          boxShadow: "none",
          transition: "background 160ms ease, color 160ms ease, transform 140ms ease, border-color 160ms ease"
        }}
        onClick={() => {
          if (isMobile) setSidebarOpen(false);
        }}
        onMouseDown={(e) => {
          try { e.currentTarget.style.transform = "scale(0.985)"; } catch {}
        }}
        onMouseUp={(e) => {
          try { e.currentTarget.style.transform = "scale(1)"; } catch {}
        }}
        onMouseLeave={(e) => {
          try { e.currentTarget.style.transform = "scale(1)"; } catch {}
        }}
      >
        {active ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 5,
              top: 10,
              bottom: 10,
              width: 3,
              borderRadius: 999,
              background: shellTokens.primary,
            }}
          />
        ) : null}
        {icon ? <Icon name={icon} active={active} /> : null}
        <span style={{ fontWeight: active ? 800 : 600, fontSize: 13.25, flex: 1, minWidth: 0, lineHeight: 1.2 }}>{label}</span>
        {showBadge ? (
          <span
            aria-label="count"
            style={{
              marginLeft: 8,
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
              flexShrink: 0,
            }}
            title={badgeText}
          >
            {badgeText}
          </span>
        ) : null}
      </Link>
    );
  }

  const headerHeightMobile = 54;
  const sidebarWidth = 260;
  const sidebarGap = 20;
  const topOffset = isMobile ? headerHeightMobile : 0;

  const cartPath = useMemo(() => {
    const p = loc.pathname || "";
    if (p.startsWith("/agency")) return "/agency/coupons?tab=cart";
    if (p.startsWith("/employee")) return "/employee/cart";
    return "/user/cart";
  }, [loc.pathname]);

  const defaultRootPath = useMemo(() => {
    try {
      const first = menu && menu[0] && typeof menu[0].to === "string" ? menu[0].to.split("?")[0] : "";
      return first || "";
    } catch {
      return "";
    }
  }, [menu]);

  const rootPathsList = useMemo(() => {
    const arr = Array.isArray(rootPaths) ? rootPaths : [];
    return arr.map((p) => String(p || "").split("?")[0]).filter(Boolean);
  }, [rootPaths]);

  const currentPath = loc.pathname;
  const isRootScreen = useMemo(() => {
    if (typeof isRoot === "function") return !!isRoot(loc);
    if (rootPathsList.length) return rootPathsList.includes(currentPath);
    return currentPath === defaultRootPath && !!defaultRootPath;
  }, [isRoot, loc, rootPathsList, currentPath, defaultRootPath]);

  const backFallback = onBackFallbackPath || defaultRootPath || "/";

  function handleBack() {
    try {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(backFallback, { replace: true });
      }
    } catch {
      navigate(backFallback, { replace: true });
    }
  }

  return (
    <div className="role-shell-scope" style={{ minHeight: "100vh", background: shellTokens.bg }}>
      {/* Top bar: shown only on mobile */}
      {isMobile ? (
        <div
  className="native-glass"
  style={{
    position: "sticky",
    top: 0,
    zIndex: 1060,
    height: 54,
    display: "grid",
    gridTemplateColumns: "46px 1fr max-content",
    alignItems: "center",
    padding: "0 10px",
    paddingTop: "env(safe-area-inset-top)",
    borderBottom: "1px solid rgba(226,232,240,0.92)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
  }}
>
  {/* LEFT */}
  {isRootScreen ? (
    <button
      aria-label="Toggle sidebar"
      onClick={() => setSidebarOpen((v) => !v)}
      style={{
        width: 34,
        height: 34,
        borderRadius: 14,
        border: "1px solid rgba(226,232,240,0.92)",
        background: "#ffffff",
        boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
        cursor: "pointer",
        justifySelf: "start",
        transition: "transform 140ms ease, box-shadow 160ms ease",
      }}
      onMouseDown={(e) => { try { e.currentTarget.style.transform = "scale(0.94)"; } catch {} }}
      onMouseUp={(e) => { try { e.currentTarget.style.transform = "scale(1)"; } catch {} }}
      onMouseLeave={(e) => { try { e.currentTarget.style.transform = "scale(1)"; } catch {} }}
      >
      ☰
    </button>
  ) : (
    <button
      aria-label="Go back"
      onClick={handleBack}
      style={{
        width: 34,
        height: 34,
        borderRadius: 14,
        border: "1px solid rgba(226,232,240,0.92)",
        background: "#ffffff",
        boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
        cursor: "pointer",
        justifySelf: "start",
        transition: "transform 140ms ease, box-shadow 160ms ease",
      }}
      onMouseDown={(e) => { try { e.currentTarget.style.transform = "scale(0.94)"; } catch {} }}
      onMouseUp={(e) => { try { e.currentTarget.style.transform = "scale(1)"; } catch {} }}
      onMouseLeave={(e) => { try { e.currentTarget.style.transform = "scale(1)"; } catch {} }}
      >
      ←
    </button>
  )}

  {/* CENTER */}
  <div
    style={{
      textAlign: "center",
      fontWeight: 850,
      fontSize: 15.5,
      color: shellTokens.text,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      pointerEvents: "none",
    }}
  >
    {title}
  </div>

  {/* RIGHT */}
  <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8 }}>
    <NotificationsBell />
    <Link
      to={cartPath}
      aria-label="Cart"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        textDecoration: "none",
        color: shellTokens.text,
        minHeight: 36,
        padding: "0 8px",
        borderRadius: 14,
        border: "1px solid rgba(226,232,240,0.92)",
        background: "#ffffff",
        boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
        transition: "transform 140ms ease",
      }}
      onMouseDown={(e) => { try { e.currentTarget.style.transform = "scale(0.96)"; } catch {} }}
      onMouseUp={(e) => { try { e.currentTarget.style.transform = "scale(1)"; } catch {} }}
      onMouseLeave={(e) => { try { e.currentTarget.style.transform = "scale(1)"; } catch {} }}
    >
      <CartIcon size={22} />
      <span
        style={{
          background: "#ef4444",
          color: "#fff",
          fontWeight: 700,
          fontSize: 11,
          borderRadius: 9999,
          minWidth: 18,
          height: 18,
          padding: "0 6px",
          boxShadow: "0 6px 14px rgba(239,68,68,0.26)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        {cartCount}
      </span>
    </Link>
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
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 1040,
          }}
        />
      ) : null}

      {/* Layout */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Sidebar */}
        <aside
          style={{
            position: "fixed",
            top: topOffset,
            left: 0,
            zIndex: 1050,
            width: isMobile ? (sidebarOpen ? sidebarWidth : 0) : sidebarWidth,
            minWidth: isMobile ? (sidebarOpen ? sidebarWidth : 0) : sidebarWidth,
            height: `calc(100dvh - ${topOffset}px)`,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
            transition: isMobile ? "width 220ms cubic-bezier(.2,.8,.2,1), min-width 220ms cubic-bezier(.2,.8,.2,1)" : "none",
            background: shellTokens.sidebar,
            borderRight: `1px solid ${shellTokens.border}`,
            boxShadow: isMobile ? "18px 0 50px rgba(15,23,42,0.16)" : "8px 0 24px rgba(15,23,42,0.04)",
            padding: (isMobile && !sidebarOpen) ? 0 : "10px",
          }}
        >
          {(isMobile && !sidebarOpen) ? null : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minHeight: "100%" }}>
              <div style={{ color: shellTokens.text, fontWeight: 850, fontSize: 14, padding: "6px 6px 10px", borderBottom: `1px solid rgba(226,232,240,0.72)`, marginBottom: 4 }}>
                {title} Menu
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minHeight: 0 }}>

              {(() => {
                const nodes = [];
                for (let i = 0; i < menu.length; i++) {
                  const it = menu[i];
                  // Start of a section group
                  if (it?.type === "section" || it?.section) {
                    const label = it.label || it.section;
                    const to = it.to;
                    const secIcon = it.icon;
                    // Children handling:
                    // 1) Preferred: explicit items array on the section object (does NOT consume following menu items)
                    // 2) Backward-compatible: group following items until next section
                    const explicitChildren = Array.isArray(it?.items) ? it.items : null;
                    const groupChildren = explicitChildren ? false : (it?.groupChildren !== false);
                    const children = explicitChildren ? explicitChildren : [];

                    let j = i + 1;
                    if (!explicitChildren && groupChildren) {
                      for (; j < menu.length; j++) {
                        const nxt = menu[j];
                        if (nxt?.type === "section" || nxt?.section) break;
                        children.push(nxt);
                      }
                      i = j - 1; // advance outer loop when grouping
                    }

                    const anyActive = children.some((c) => c?.to && activeCheck(c.to, loc));
                    const collapsible = it?.collapsible !== false ? true : false;
                    const open = collapsible ? ((openSections[label] ?? true) || anyActive) : true;

                    nodes.push(
                      <div key={`secwrap-${label}-${i}`} style={{ marginTop: 5, paddingTop: 3 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            padding: "6px 6px 5px",
                            borderRadius: 10,
                            color: "#94A3B8",
                            background: "transparent",
                            border: "1px solid transparent",
                          }}
                        >
                          {to ? (
                            <Link
                              to={to}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                color: "inherit",
                                textDecoration: "none",
                                flex: 1,
                                cursor: "pointer"
                              }}
                              onClick={() => {
                                if (isMobile) setSidebarOpen(false);
                              }}
                              aria-label={`${label} section`}
                              aria-expanded={open ? "true" : "false"}
                            >
                              {secIcon ? <Icon name={secIcon} active={anyActive} /> : null}
                              <span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {label}
                              </span>
                            </Link>
                          ) : (
                            <>
                              {secIcon ? <Icon name={secIcon} active={anyActive} /> : null}
                              <span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                {label}
                              </span>
                            </>
                          )}
                          {collapsible && children.length ? (
                            <button
                              aria-label={`Toggle ${label}`}
                              onClick={() => setOpenSections((s) => ({ ...s, [label]: !open }))}
                              style={{
                                marginLeft: "auto",
                                background: "transparent",
                                border: "none",
                                color: shellTokens.muted,
                                cursor: "pointer",
                                fontSize: 14,
                                lineHeight: 1,
                              }}
                            >
                              {open ? "▾" : "▸"}
                            </button>
                          ) : null}
                        </div>

                        {open ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2, paddingLeft: 2 }}>
                            {children.map((c, cidx) => (
                              <NavLink
                                key={c.to || c.label || `c${cidx}`}
                                to={c.to}
                                label={c.label}
                                icon={c.icon}
                                badge={c.badge}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                    continue;
                  }

                  // Regular link
                  nodes.push(
                    <NavLink
                      key={it.to || it.label || i}
                      to={it.to}
                      label={it.label}
                      icon={it.icon}
                      badge={it.badge}
                    />
                  );
                }
                return nodes;
              })()}
              </div>

              <div style={{ marginTop: "auto", paddingTop: 8 }}>
                <div style={{ borderTop: `1px solid ${shellTokens.border}` }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 4px", flexWrap: "wrap" }}>
                <div style={{ color: shellTokens.muted, fontSize: 11, lineHeight: 1.35 }}>
                  {footerText || `© ${new Date().getFullYear()}`}
                </div>
                {onLogout ? (
                  <button
                    onClick={onLogout}
                    style={{
                      border: "1px solid rgba(37,99,235,0.25)",
                      background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
                      color: "#fff",
                      fontWeight: 700,
                      borderRadius: 12,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Logout
                  </button>
                ) : null}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: isMobile ? 10 : 16,
            paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom))" : 16,
            marginLeft: isMobile ? 0 : (sidebarWidth + sidebarGap),
            width: "100%",
          }}
        >
          <div style={{ width: "100%", margin: "0 auto", maxWidth: 1400 }}>
            {!isMobile ? (
              <div
                className="native-glass"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  padding: "8px 10px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.90)",
                  border: "1px solid rgba(226,232,240,0.92)",
                  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
                }}
              >
                {rightHeaderContent ? <div>{rightHeaderContent}</div> : null}
                <NotificationsBell />
                <Link
                  to={cartPath}
                  aria-label="Cart"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    textDecoration: "none",
                    color: shellTokens.text,
                    minHeight: 38,
                    padding: "0 8px",
                    borderRadius: 14,
                    border: "1px solid rgba(226,232,240,0.92)",
                    background: "#ffffff",
                    boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
                  }}
                >
                  <CartIcon size={22} />
                  <span
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11,
                      borderRadius: 9999,
                      minWidth: 18,
                      height: 18,
                      padding: "0 6px",
                      boxShadow: "0 6px 14px rgba(239,68,68,0.26)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                    }}
                  >
                    {cartCount}
                  </span>
                </Link>
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
