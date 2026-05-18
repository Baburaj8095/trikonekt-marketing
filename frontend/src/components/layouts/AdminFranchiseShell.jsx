import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API, { ensureFreshAccess, getAccessToken } from "../../api/api";
import ShellBase from "./ShellBase";

const FRANCHISE_MENU = [
  { to: "/admin/franchise/dashboard", label: "Main Dashboard", icon: "dashboard" },
  {
    type: "section",
    label: "Coordinator Dashboard",
    collapsible: true,
    items: [
      { to: "/admin/franchise/users?category=agency_state_coordinator", label: "State Coordinators", icon: "users" },
      { to: "/admin/franchise/users?category=agency_district_coordinator", label: "District Coordinators", icon: "users" },
      { to: "/admin/franchise/users?category=agency_pincode_coordinator", label: "Pincode Coordinators", icon: "users" },
      { to: "/admin/franchise/category/agency_state_coordinator", label: "State Coordinator Dashboard", icon: "dashboard" },
      { to: "/admin/franchise/category/agency_district_coordinator", label: "District Coordinator Dashboard", icon: "dashboard" },
      { to: "/admin/franchise/category/agency_pincode_coordinator", label: "Pincode Coordinator Dashboard", icon: "dashboard" },
    ],
  },
  {
    type: "section",
    label: "Code Dashboard",
    collapsible: true,
    items: [
      { to: "/admin/franchise/users?category=agency_state", label: "State Codes", icon: "tree" },
      { to: "/admin/franchise/users?category=agency_district", label: "District Codes", icon: "tree" },
      { to: "/admin/franchise/users?category=agency_pincode", label: "Pincode Codes", icon: "tree" },
      { to: "/admin/franchise/category/agency_state", label: "State Dashboard", icon: "dashboard" },
      { to: "/admin/franchise/category/agency_district", label: "District Dashboard", icon: "dashboard" },
      { to: "/admin/franchise/category/agency_pincode", label: "Pincode Dashboard", icon: "dashboard" },
    ],
  },
  {
    type: "section",
    label: "Finance & Operations",
    collapsible: true,
    items: [
      { to: "/admin/franchise/wallets", label: "Franchise Wallets", icon: "wallet" },
      { to: "/admin/franchise/withdrawals", label: "Withdrawals", icon: "wallet" },
      { to: "/admin/franchise/monthly-entry-report", label: "Monthly Entry Report", icon: "chart" },
      { to: "/admin/franchise/scanner-forms", label: "Shopping Scanner Forms", icon: "orders" },
    ],
  },
  {
    type: "section",
    label: "Profile & Compliance",
    collapsible: true,
    items: [
      { to: "/admin/franchise/profile", label: "Profile", icon: "users" },
      { to: "/admin/franchise/kyc", label: "KYC", icon: "shield" },
      { to: "/admin/franchise/register", label: "Franchise Register Form", icon: "file" },
      { to: "/admin/franchise/agreement", label: "Generate Agreement", icon: "file" },
      { to: "/admin/franchise/id-card", label: "Generate ID Card", icon: "file" },
    ],
  },
  {
    type: "section",
    label: "Content & Support",
    collapsible: true,
    items: [
      { to: "/admin/franchise/achievers", label: "Achievers", icon: "star" },
      { to: "/admin/franchise/wishing-banners", label: "Wishing Banners", icon: "image" },
      { to: "/admin/franchise/banners", label: "Banners", icon: "image" },
      { to: "/admin/franchise/pdfs", label: "Trikonekt PDF", icon: "file" },
      { to: "/admin/franchise/customer-care", label: "Customer Care Chat", icon: "ticket" },
    ],
  },

  // { type: "section", label: "Switch Workspace", collapsible: true, items: [{ to: "/admin/dashboard", label: "Team Consumer Admin", icon: "dashboard" }] },
];

export default function AdminFranchiseShell({ children }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [authErr, setAuthErr] = useState("");
  const [adminInfo, setAdminInfo] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        let tries = 0;
        while (!getAccessToken() && tries < 20) {
          await new Promise((r) => setTimeout(r, 100));
          tries += 1;
        }
        try {
          await ensureFreshAccess();
        } catch (_) {}
        const token = typeof getAccessToken === "function" ? getAccessToken() : null;
        const cfg = { timeout: 8000, retryAttempts: 0, dedupe: "cancelPrevious" };
        if (token) cfg.headers = { Authorization: `Bearer ${token}` };
        const res = await API.get("admin/ping/", cfg);
        if (cancelled) return;
        const data = res?.data || {};
        if (!data?.is_staff && !data?.is_superuser) {
          setAuthErr("Please sign in as an admin.");
          navigate("/admin/login", { replace: true, state: { from: { pathname: loc.pathname } } });
        } else {
          setAuthErr("");
          setAdminInfo({ username: data.user || "Admin", is_superuser: !!data.is_superuser });
        }
      } catch (e) {
        if (cancelled) return;
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          setAuthErr("Please sign in as an admin.");
          navigate("/admin/login", { replace: true, state: { from: { pathname: loc.pathname } } });
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [loc.pathname, navigate]);

  const isActive = (to, location) => {
    const toStr = String(to || "");
    const [path, query] = toStr.split("?");
    if (!query) return location.pathname === path || location.pathname.startsWith(path + "/");
    if (location.pathname !== path) return false;
    const expected = new URLSearchParams(query);
    const current = new URLSearchParams(location.search || "");
    for (const [key, value] of expected.entries()) {
      if (current.get(key) !== value) return false;
    }
    return true;
  };

  const rightPill = useMemo(
    () => (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid #dbe3ee",
          background: "#ffffff",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        Franchise Workspace · {adminInfo?.username || "Admin"}
      </span>
    ),
    [adminInfo]
  );

  return (
    <div className="admin-franchise-scope">
      <ShellBase
        title="Franchise Admin"
        menu={FRANCHISE_MENU}
        isActive={isActive}
        footerText={`© ${new Date().getFullYear()} Franchise Console`}
        rightHeaderContent={rightPill}
        rootPaths={["/admin/franchise/dashboard"]}
        onBackFallbackPath="/admin/franchise/dashboard"
      >
        <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <Link to="/admin/dashboard" style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            Team Consumer Admin
          </Link>
          <Link to="/admin/franchise/dashboard" style={{ color: "#2563eb", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            Franchise Admin
          </Link>
        </div>
        {authErr ? (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" }}>
            {authErr}
          </div>
        ) : null}
        {children}
      </ShellBase>
    </div>
  );
}
