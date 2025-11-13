import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";
import TreeReferralGalaxy from "../../components/TreeReferralGalaxy";
import { getAdminMeta } from "../../admin-panel/api/adminMeta";

function paletteStyles(key) {
  // Solid, high-contrast gradients for colored cards
  switch (key) {
    case "indigo":
      return {
        bg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        border: "rgba(99,102,241,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(99,102,241,0.35)",
      };
    case "blue":
      return {
        bg: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)",
        border: "rgba(59,130,246,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(59,130,246,0.35)",
      };
    case "green":
      return {
        bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        border: "rgba(16,185,129,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(16,185,129,0.35)",
      };
    case "red":
      return {
        bg: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
        border: "rgba(244,63,94,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(244,63,94,0.35)",
      };
    case "purple":
      return {
        bg: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
        border: "rgba(124,58,237,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(124,58,237,0.35)",
      };
    case "cyan":
      return {
        bg: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)",
        border: "rgba(14,165,233,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(14,165,233,0.35)",
      };
    case "amber":
      return {
        bg: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        border: "rgba(245,158,11,0.35)",
        text: "#0f172a",
        sub: "rgba(15,23,42,0.75)",
        shadow: "0 8px 18px rgba(245,158,11,0.35)",
      };
    case "teal":
      return {
        bg: "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)",
        border: "rgba(20,184,166,0.35)",
        text: "#0f172a",
        sub: "rgba(15,23,42,0.75)",
        shadow: "0 8px 18px rgba(20,184,166,0.35)",
      };
    default:
      return {
        bg: "#ffffff",
        border: "#e2e8f0",
        text: "#0f172a",
        sub: "#64748b",
        shadow: "0 1px 2px rgba(0,0,0,0.06)",
      };
  }
}

function Card({ title, value, subtitle, onClick, palette = "blue" }) {
  const pal = paletteStyles(palette);
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        cursor: onClick ? "pointer" : "default",
        background: pal.bg,
        border: `1px solid ${pal.border}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: pal.shadow,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "transform 120ms ease, box-shadow 120ms ease",
        color: pal.text,
        minHeight: 104,
      }}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 22px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = pal.shadow;
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3, opacity: 0.95 }}>
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, wordBreak: "break-word" }}>
        {value}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 12, color: pal.sub, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [ap, setAp] = useState(null);
  const nav = useNavigate();

  // Dynamic models (from Django Admin)
  const [modelsMeta, setModelsMeta] = useState([]);
  const [modelsErr, setModelsErr] = useState("");

  // Recent E‑Coupon assignments (compact dashboard widget)
  const [recentAssign, setRecentAssign] = useState([]);
  const [recentAssignLoading, setRecentAssignLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([API.get("/admin/metrics/"), API.get("/admin/autopool/summary/")])
      .then(([m, a]) => {
        if (mounted) {
          setData(m?.data || {});
          setAp(a?.data || {});
          setErr("");
        }
      })
      .catch(() => {
        setErr("Failed to load metrics");
      })
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Load admin model metadata for dashboard cards
  useEffect(() => {
    let mounted = true;
    getAdminMeta()
      .then((data) => {
        if (!mounted) return;
        setModelsMeta(data?.models || []);
        setModelsErr("");
      })
      .catch(() => {
        setModelsMeta([]);
        setModelsErr("Failed to load admin models");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const users = data?.users || {};
  const wallets = data?.wallets || {};
  const withdrawals = data?.withdrawals || {};
  const coupons = data?.coupons || {};
  const uploads = data?.uploads || {};
  const uploadsModels = data?.uploadsModels || {};
  const market = data?.market || {};

  const apSummary = ap || {};
  const prog = apSummary.progress || {};
  const acc = apSummary.accounts || {};
  const fiveProg = prog["FIVE_150"] || {};
  const three150Prog = prog["THREE_150"] || {};
  const three50Prog = prog["THREE_50"] || {};
  const threeUsers = (three150Prog.users || 0) + (three50Prog.users || 0);
  const threeEarned = Number(three150Prog.total_earned || 0) + Number(three50Prog.total_earned || 0);
  const activeAccounts = ["FIVE_150", "THREE_150", "THREE_50"].reduce(
    (sum, k) => sum + (acc[k]?.ACTIVE || 0),
    0
  );

  // Group models by app with de-duplication and build a filtered set for "All Admin Models"
  const modelsByApp = React.useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const seen = new Set();
    const grouped = {};
    for (const m of (modelsMeta || [])) {
      if (!m) continue;
      const app = norm(m.app_label);
      const model = norm(m.model);
      const key = `${app}.${model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      (grouped[m.app_label] = grouped[m.app_label] || []).push(m);
    }
    return grouped;
  }, [modelsMeta]);

  // Exclude apps that already have dedicated sections to avoid duplicates on the dashboard
  const modelsByAppAllFiltered = React.useMemo(() => {
    const excludedApps = new Set(["uploads", "market", "auth", "token_blacklist", "locations"]);
    const out = {};
    Object.keys(modelsByApp).forEach((appLabel) => {
      const appLower = String(appLabel).toLowerCase();
      if (excludedApps.has(appLower)) return;
      out[appLabel] = modelsByApp[appLabel];
    });
    return out;
  }, [modelsByApp]);

  async function loadRecentAssignments() {
    setRecentAssignLoading(true);
    try {
      const res = await API.get("/coupons/assignments/", { params: { page_size: 5 } });
      const items = res?.data?.results || res?.data || [];
      setRecentAssign(Array.isArray(items) ? items : []);
    } catch (_) {
      setRecentAssign([]);
    } finally {
      setRecentAssignLoading(false);
    }
  }

  useEffect(() => {
    loadRecentAssignments();
  }, []);

  return (
    <div>
      {/* Page heading - subtle and compact for desktop, wraps on mobile */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 900 }}>Overview</h2>
          <span style={{ color: "#64748b", fontSize: 12 }}>
            Quick metrics and shortcuts
          </span>
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {new Date().toLocaleDateString()}
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#64748b" }}>Loading...</div>
      ) : err ? (
        <div style={{ color: "#dc2626" }}>{err}</div>
      ) : (
        <>
          {/* Primary KPI cards (responsive) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <Card
              title="User Accounts"
              value={users.total ?? 0}
              subtitle={`Active: ${users.active ?? 0} • Today: ${users.todayNew ?? 0} • KYC pending: ${users.kycPending ?? 0}`}
              onClick={() => nav("/admin/users")}
              palette="indigo"
            />
            <Card
              title="User Tree"
              value={users.byRole ? Object.values(users.byRole).reduce((a, b) => a + b, 0) : 0}
              subtitle="Explore hierarchy by sponsor"
              onClick={() => nav("/admin/user-tree")}
              palette="blue"
            />
            <Card
              title="Wallets"
              value={`₹${Number(wallets.totalBalance || 0).toFixed(2)}`}
              subtitle={`Transactions today: ${wallets.transactionsToday || 0}`}
              onClick={() => nav("/admin/users")}
              palette="green"
            />
            <Card
              title="Withdrawals"
              value={withdrawals.pendingCount || 0}
              subtitle={`Pending amount: ₹${Number(withdrawals.pendingAmount || 0).toFixed(2)}`}
              onClick={() => nav("/admin/withdrawals")}
              palette="red"
            />
            <Card
              title="Coupons"
              value={coupons.total || 0}
              subtitle={`Assigned: ${coupons.assigned || 0} • Redeemed: ${coupons.redeemed || 0} • Pending: ${coupons.pendingSubmissions || 0}`}
              onClick={() => nav("/admin/e-coupons")}
              palette="purple"
            />
            <Card
              title="Uploads"
              value={uploads.total || 0}
              subtitle={`Today: ${uploads.todayNew || 0}`}
              onClick={() => nav("/admin/uploads")}
              palette="cyan"
            />
            <Card
              title="Lucky Draw (Create)"
              value={coupons.total || 0}
              subtitle="Create and manage lucky draw coupons"
              onClick={() => nav("/admin/lucky-draw")}
              palette="indigo"
            />
            <Card
              title="Business Registration"
              value={0}
              subtitle="Review and approve businesses"
              onClick={() => nav("/admin/business")}
              palette="amber"
            />
          </div>

          {/* Secondary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            <Card
              title="KYC"
              value={users.kycPending ?? 0}
              subtitle="Pending verifications"
              onClick={() => nav("/admin/kyc")}
              palette="blue"
            />
            <Card
              title="5‑Matrix"
              value={fiveProg.users || 0}
              subtitle={`Earned: ₹${Number(fiveProg.total_earned || 0).toFixed(2)}`}
              onClick={() => nav("/admin/matrix/five")}
              palette="purple"
            />
            <Card
              title="3‑Matrix"
              value={threeUsers || 0}
              subtitle={`Earned: ₹${Number(threeEarned || 0).toFixed(2)}`}
              onClick={() => nav("/admin/matrix/three")}
              palette="teal"
            />
            <Card
              title="Auto Commission Pool"
              value={activeAccounts || 0}
              subtitle="Active accounts"
              onClick={() => nav("/admin/autopool")}
              palette="amber"
            />
          </div>




          {/* Quick actions - fully responsive */}
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "8px 0", color: "#0f172a", fontSize: 16, fontWeight: 800 }}>Quick Actions</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => nav("/admin/user-tree")}
                style={{
                  padding: "10px 14px",
                  background: "#0f172a",
                  color: "#fff",
                  border: 0,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Open User Tree
              </button>
              <button
                onClick={() => nav("/admin/users")}
                style={{
                  padding: "10px 14px",
                  background: "#334155",
                  color: "#fff",
                  border: 0,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Browse Users
              </button>
              <button
                onClick={() => nav("/admin/e-coupons")}
                style={{
                  padding: "10px 14px",
                  background: "#7c3aed",
                  color: "#fff",
                  border: 0,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Manage E‑Coupons
              </button>
            </div>
          </div>

      {/* Recent E‑Coupon Assignments (compact) */}
      <div style={{ marginTop: 16 }}>
        <h3 style={{ margin: "8px 0", color: "#0f172a", fontSize: 16, fontWeight: 800 }}>Recent E‑Coupon Assignments</h3>
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                minWidth: 900,
                display: "grid",
                gridTemplateColumns: "120px 1fr 200px 120px 220px",
                gap: 8,
                padding: "10px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <div>Role</div>
              <div>Assignee</div>
              <div>Range</div>
              <div>Count</div>
              <div>Assigned At</div>
            </div>
            <div>
              {(recentAssign || []).map((a) => {
                const role = a.role || (a.agency_id ? "agency" : a.employee_id ? "employee" : "");
                const assignee =
                  a.assignee_name ||
                  (a.assignee && (a.assignee.username || a.assignee.name)) ||
                  a.agency_name ||
                  a.employee_name ||
                  (a.agency && (a.agency.username || a.agency.name)) ||
                  (a.employee && (a.employee.username || a.employee.name)) ||
                  `#${a.assignee_id || a.agency_id || a.employee_id || ""}`;
                const start = a.serial_start ?? a.start ?? a.range_start;
                const end = a.serial_end ?? a.end ?? a.range_end;
                const count =
                  a.count ?? (typeof start === "number" && typeof end === "number" ? end - start + 1 : "");
                const at = a.assigned_at || a.created_at || a.created || "";
                return (
                  <div
                    key={a.id || `${role}-${assignee}-${start}-${end}-${Math.random()}`}
                    style={{
                      minWidth: 900,
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 200px 120px 220px",
                      gap: 8,
                      padding: "10px",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ textTransform: "capitalize" }}>{role || "—"}</div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{assignee || "—"}</div>
                    <div>{(start ?? "—")} - {(end ?? "—")}</div>
                    <div>{count ?? "—"}</div>
                    <div>{at ? new Date(at).toLocaleString() : "—"}</div>
                  </div>
                );
              })}
              {!recentAssignLoading && (!recentAssign || recentAssign.length === 0) ? (
                <div style={{ padding: 12, color: "#64748b" }}>No recent assignments</div>
              ) : null}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button
            onClick={() => nav("/admin/e-coupons")}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            View all
          </button>
        </div>

        <h3 style={{ margin: "8px 0", color: "#0f172a", fontSize: 16, fontWeight: 800 }}>5‑Matrix Quick Viewer</h3>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                background: "#fff",
                overflow: "auto",
                maxHeight: 500,
              }}
            >
              <TreeReferralGalaxy mode="admin" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
