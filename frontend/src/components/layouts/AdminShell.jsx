import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function AdminShell({ children }) {
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);

  const NavLink = ({ to, children: txt }) => {
    const active = loc.pathname === to;
    return (
      <Link
        to={to}
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          background: active ? "#0f172a" : "transparent",
          color: active ? "#fff" : "#0f172a",
          textDecoration: "none",
          fontWeight: 600,
          border: "1px solid #0f172a20",
          marginRight: isMobile ? 0 : 8,
          display: "inline-block",
        }}
      >
        {txt}
      </Link>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e2e8f0",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>
              Admin Panel
            </span>
            {!isMobile ? (
              <span style={{ color: "#94a3b8" }}>|</span>
            ) : null}
          </div>

          {/* Right side: info text on desktop, hamburger on mobile */}
          {!isMobile ? (
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Tools to manage users, wallets, withdrawals, KYC, coupons and uploads
            </div>
          ) : (
            <button
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: "transparent",
                border: "1px solid #e2e8f0",
                color: "#0f172a",
                padding: "6px 10px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
              Menu
            </button>
          )}
        </div>

        {/* Nav row */}
        <nav
          style={{
            display: isMobile ? (menuOpen ? "flex" : "none") : "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            gap: isMobile ? 8 : 0,
            marginTop: 8,
            overflowX: isMobile ? "visible" : "auto",
            whiteSpace: isMobile ? "normal" : "nowrap",
            paddingTop: 4,
          }}
        >
          <div
            style={{
              display: isMobile ? "grid" : "flex",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "none",
              gap: isMobile ? 8 : 0,
            }}
          >
            <NavLink to="/admin/dashboard">Dashboard</NavLink>
            <NavLink to="/admin/user-tree">User Tree</NavLink>
            <NavLink to="/admin/users">Users</NavLink>
            <NavLink to="/admin/kyc">KYC</NavLink>
            <NavLink to="/admin/e-coupons">E-Coupons</NavLink>
            <NavLink to="/admin/withdrawals">Withdrawals</NavLink>
            <NavLink to="/admin/matrix/five">5-Matrix</NavLink>
            <NavLink to="/admin/matrix/three">3-Matrix</NavLink>
            <NavLink to="/admin/autopool">Auto Commission</NavLink>
          </div>
        </nav>

        {/* Info text on mobile below nav */}
        {isMobile ? (
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
            Tools to manage users, wallets, withdrawals, KYC, coupons and uploads
          </div>
        ) : null}
      </header>

      <main style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
