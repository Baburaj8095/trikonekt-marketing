import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { listMyPromoPurchases } from "../../api/api";
import "./V3Theme.css";

/**
 * v3 User Dashboard Shell
 * - Dark + gold UX shell that hosts nested v3 routes.
 * - Does not modify any existing files. Route snippet provided in README.
 * - Reuses the same user/prime detection logic as v2.
 */
export default function UserDashboard3Shell() {
  const navigate = useNavigate();
  const location = useLocation();

  // Stored user (mirrors v2 logic)
  const storedUser = useMemo(() => {
    try {
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const parsed = ls ? JSON.parse(ls) : {};
      return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object"
        ? parsed.user
        : parsed;
    } catch {
      return {};
    }
  }, []);

  const displayEmail = storedUser?.email || storedUser?.username || "Consumer";
  const initials =
    (storedUser?.full_name || storedUser?.username || "C")
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  // Prime flags (reuse v2)
  const [isPrime, setIsPrime] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await listMyPromoPurchases();
        const list = Array.isArray(res) ? res : res?.results || [];
        const valid = (list || []).filter(
          (pp) => String(pp?.status || "").toUpperCase() === "APPROVED"
        );
        let has150 = false,
          has750 = false,
          hasMonthly = false;
        for (const pp of valid) {
          const pkg = pp?.package || {};
          const type = String(pkg?.type || "");
          const name = String(pkg?.name || "").toLowerCase();
          const code = String(pkg?.code || "").toLowerCase();
          const price = Number(pkg?.price || 0);
          if (type === "MONTHLY") hasMonthly = true;
          else if (type === "PRIME") {
            if (Math.abs(price - 150) < 0.5 || name.includes("150") || code.includes("150"))
              has150 = true;
            if (Math.abs(price - 750) < 0.5 || name.includes("750") || code.includes("750"))
              has750 = true;
          }
        }
        if (mounted) setIsPrime(has150 || has750 || hasMonthly);
      } catch {
        if (mounted) setIsPrime(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const go = (tab) => {
    navigate(tab === "home" ? "/v3" : `/v3/${tab}`);
  };

  const activeTab = useMemo(() => {
    const p = (location.pathname || "").replace(/\/+$/, "");
    if (p.endsWith("/wallet")) return "wallet";
    if (p.endsWith("/history")) return "history";
    if (p.endsWith("/orders")) return "orders";
    if (p.endsWith("/profile")) return "profile";
    return "home";
  }, [location.pathname]);

  return (
    <div className="v3-root">
      <div className="v3-page" style={{ paddingBottom: 88 }}>
        {/* Top Bar */}
        <div className="v3-topbar">
          <div className="v3-topbar-avatar" aria-label="User avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
              {displayEmail}
            </div>
            <div className="v3-muted" style={{ fontSize: 12 }}>Welcome back</div>
          </div>
          <div className="v3-balance-pill">
            {isPrime ? "Prime" : "Non‑Prime"}
          </div>
        </div>

        {/* Routed content */}
        <div style={{ marginTop: 12 }}>
          <Outlet />
        </div>

        {/* Bottom Tabs */}
        <div className="v3-bottom-tabs">
          <button
            className={`v3-bottom-tab ${activeTab === "home" ? "v3-bottom-tab--active" : ""}`}
            onClick={() => go("home")}
            aria-label="Dashboard"
          >
            <div>🏠</div>
            <div>Dashboard</div>
          </button>
          <button
            className={`v3-bottom-tab ${activeTab === "wallet" ? "v3-bottom-tab--active" : ""}`}
            onClick={() => go("wallet")}
            aria-label="Wallet"
          >
            <div>💳</div>
            <div>Wallet</div>
          </button>
          <button
            className={`v3-bottom-tab ${activeTab === "history" ? "v3-bottom-tab--active" : ""}`}
            onClick={() => go("history")}
            aria-label="History"
          >
            <div>📜</div>
            <div>History</div>
          </button>
          <button
            className={`v3-bottom-tab ${activeTab === "orders" ? "v3-bottom-tab--active" : ""}`}
            onClick={() => go("orders")}
            aria-label="Orders"
          >
            <div>🧾</div>
            <div>Orders</div>
          </button>
          <button
            className={`v3-bottom-tab ${activeTab === "profile" ? "v3-bottom-tab--active" : ""}`}
            onClick={() => go("profile")}
            aria-label="Profile"
          >
            <div>👤</div>
            <div>Profile</div>
          </button>
        </div>
      </div>
    </div>
  );
}
