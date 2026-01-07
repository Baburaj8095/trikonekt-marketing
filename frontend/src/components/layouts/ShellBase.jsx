import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NotificationsBell from "../NotificationsBell";
import { useCartStore } from "../../store/cartStore";

/**
 * ShellBase
 * - Dark, professional sidebar (matches AdminShell)
 * - Mobile top bar with burger menu
 * - Content area with light background
 *
 * Props:
 * - title: string (used in mobile header and sidebar title)
 * - menu: Array<{ to: string; label: string; icon?: string }>
 * - isActive?: (to: string, location: ReturnType<useLocation>) => boolean
 * - onLogout?: () => void (if provided, Logout button is shown in sidebar footer)
 * - footerText?: string
 * - children: ReactNode
 */
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

  function NavLink({ to, label, icon }) {
    const active = activeCheck(to, loc);
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
          cursor: "pointer"
        }}
        onClick={() => {
          if (isMobile) setSidebarOpen(false);
        }}
      >
        {icon ? <Icon name={icon} active={active} /> : null}
        <span style={{ fontWeight: active ? 700 : 600, fontSize: 14 }}>{label}</span>
      </Link>
    );
  }

  const headerHeightMobile = 56;
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
    <div className="role-shell-scope" style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      {/* Top bar: shown only on mobile */}
      {isMobile ? (
        <div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 30,
    height: 56,
    display: "grid",
    gridTemplateColumns: "48px 1fr max-content",
    alignItems: "center",
    padding: "0 8px",
    borderBottom: "1px solid #e2e8f0",
    background: "#ffffff",
  }}
>
  {/* LEFT */}
  {isRootScreen ? (
    <button
      aria-label="Toggle sidebar"
      onClick={() => setSidebarOpen((v) => !v)}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        background: "#fff",
        cursor: "pointer",
        justifySelf: "start",
      }}
    >
      ☰
    </button>
  ) : (
    <button
      aria-label="Go back"
      onClick={handleBack}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        background: "#fff",
        cursor: "pointer",
        justifySelf: "start",
      }}
    >
      ←
    </button>
  )}

  {/* CENTER */}
  <div
    style={{
      textAlign: "center",
      fontWeight: 700,
      fontSize: 16,
      color: "#0f172a",
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
        color: "#0f172a",
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
            zIndex: 20,
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
            zIndex: 25,
            width: isMobile ? (sidebarOpen ? sidebarWidth : 0) : sidebarWidth,
            minWidth: isMobile ? (sidebarOpen ? sidebarWidth : 0) : sidebarWidth,
            height: `calc(100dvh - ${topOffset}px)`,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
            transition: isMobile ? "width 200ms ease, min-width 200ms ease" : "none",
            background: "#0f172a",
            borderRight: "1px solid #0b1220",
            padding: (isMobile && !sidebarOpen) ? 0 : "12px",
          }}
        >
          {(isMobile && !sidebarOpen) ? null : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ color: "#cbd5e1", fontWeight: 900, fontSize: 14, padding: "2px 4px 10px" }}>
                {title} Menu
              </div>

              {(() => {
                const nodes = [];
                for (let i = 0; i < menu.length; i++) {
                  const it = menu[i];
                  // Start of a section group
                  if (it?.type === "section" || it?.section) {
                    const label = it.label || it.section;
                    const to = it.to;
                    const secIcon = it.icon;
                    // Collect children until next section (optional grouping)
                    const groupChildren = it?.groupChildren !== false;
                    const children = [];
                    let j = i + 1;
                    if (groupChildren) {
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
                      <div key={`secwrap-${label}-${i}`} style={{ marginTop: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 8px",
                            borderRadius: 8,
                            color: "#cbd5e1",
                            background: anyActive ? "rgba(14,165,233,0.08)" : "transparent",
                            border: "1px solid",
                            borderColor: anyActive ? "rgba(14,165,233,0.25)" : "transparent",
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
                              <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
                                {label}
                              </span>
                            </Link>
                          ) : (
                            <>
                              {secIcon ? <Icon name={secIcon} active={anyActive} /> : null}
                              <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
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
                                color: "#94a3b8",
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
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, paddingLeft: 8 }}>
                            {children.map((c, cidx) => (
                              <NavLink
                                key={c.to || c.label || `c${cidx}`}
                                to={c.to}
                                label={c.label}
                                icon={c.icon}
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
                    />
                  );
                }
                return nodes;
              })()}

              <div style={{ marginTop: 8, borderTop: "1px solid #0b1220" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 4px" }}>
                <div style={{ color: "#64748b", fontSize: 11 }}>
                  {footerText || `© ${new Date().getFullYear()}`}
                </div>
                {onLogout ? (
                  <button
                    onClick={onLogout}
                    style={{
                      border: "1px solid rgba(14,165,233,0.35)",
                      background: "linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)",
                      color: "#fff",
                      fontWeight: 700,
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Logout
                  </button>
                ) : null}
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
            {!isMobile ? (
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 8 }}>
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
                    color: "#0f172a",
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
