import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";
import TreeReferralGalaxy from "../../components/TreeReferralGalaxy";

function Card({ title, value, subtitle, onClick, color = "#0f172a" }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {subtitle ? (
        <div style={{ color: "#94a3b8", fontSize: 12 }}>{subtitle}</div>
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

  // 5-Matrix quick viewer (dashboard)
  const [matrixIdent, setMatrixIdent] = useState("");
  const [matrixTree, setMatrixTree] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixErr, setMatrixErr] = useState("");

  async function loadMatrixTree() {
    const ident = (matrixIdent || "").trim();
    if (!ident) {
      setMatrixErr("Enter user id / username / sponsor_id / phone / email / unique_id");
      setMatrixTree(null);
      return;
    }
    try {
      setMatrixLoading(true);
      setMatrixErr("");
      const res = await API.get("/admin/matrix/tree5/", { params: { identifier: ident, max_depth: 6 } });
      setMatrixTree(res?.data || null);
    } catch (e) {
      setMatrixTree(null);
      setMatrixErr(e?.response?.data?.detail || "Failed to load hierarchy");
    } finally {
      setMatrixLoading(false);
    }
  }

  function DashTreeNode({ node, depth = 0 }) {
    const pad = depth * 16;
    return (
      <div style={{ paddingLeft: pad, paddingTop: 6, paddingBottom: 6, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>
          {node.username} <span style={{ color: "#64748b", fontWeight: 500 }}>#{node.id} • {node.full_name || "—"}</span>
        </div>
        {Array.isArray(node.children) && node.children.length > 0 ? (
          <div>
            {node.children.map((c) => (
              <DashTreeNode key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      API.get("/admin/metrics/"),
      API.get("/admin/autopool/summary/"),
    ])
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

  const users = data?.users || {};
  const wallets = data?.wallets || {};
  const withdrawals = data?.withdrawals || {};
  const coupons = data?.coupons || {};
  const uploads = data?.uploads || {};

  const apSummary = ap || {};
  const prog = apSummary.progress || {};
  const acc = apSummary.accounts || {};
  const fiveProg = prog["FIVE_150"] || {};
  const three150Prog = prog["THREE_150"] || {};
  const three50Prog = prog["THREE_50"] || {};
  const threeUsers = (three150Prog.users || 0) + (three50Prog.users || 0);
  const threeEarned =
    Number(three150Prog.total_earned || 0) + Number(three50Prog.total_earned || 0);
  const activeAccounts = ["FIVE_150", "THREE_150", "THREE_50"].reduce(
    (sum, k) => sum + (acc[k]?.ACTIVE || 0),
    0
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Admin Dashboard</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Quick overview. Click a card to drill down.
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#64748b" }}>Loading...</div>
      ) : err ? (
        <div style={{ color: "#dc2626" }}>{err}</div>
      ) : (
        <>
          {/* Header cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <Card
              title="Accounts / Users"
              value={users.total ?? 0}
              subtitle={`Active: ${users.active ?? 0} • Today: ${users.todayNew ?? 0} • KYC pending: ${users.kycPending ?? 0}`}
              onClick={() => nav("/admin/user-tree")}
            />
            <Card
              title="User Tree"
              value={users.byRole ? Object.values(users.byRole).reduce((a, b) => a + b, 0) : 0}
              subtitle="Explore hierarchy by sponsor"
              onClick={() => nav("/admin/user-tree")}
              color="#2563eb"
            />
            <Card
              title="Wallets"
              value={`₹${Number(wallets.totalBalance || 0).toFixed(2)}`}
              subtitle={`Transactions today: ${wallets.transactionsToday || 0}`}
              onClick={() => nav("/admin/users")}
              color="#059669"
            />
            <Card
              title="Withdrawals"
              value={withdrawals.pendingCount || 0}
              subtitle={`Pending amount: ₹${Number(withdrawals.pendingAmount || 0).toFixed(2)}`}
              onClick={() => nav("/admin/withdrawals")}
              color="#e11d48"
            />
            <Card
              title="Coupons"
              value={coupons.total || 0}
              subtitle={`Assigned: ${coupons.assigned || 0} • Redeemed: ${coupons.redeemed || 0} • Pending: ${coupons.pendingSubmissions || 0}`}
              onClick={() => nav("/admin/e-coupons")}
              color="#7c3aed"
            />
            <Card
              title="Uploads"
              value={uploads.total || 0}
              subtitle={`Today: ${uploads.todayNew || 0}`}
              onClick={() => nav("/admin/users")}
              color="#0ea5e9"
            />
          </div>

          {/* Additional admin cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            <Card
              title="KYC"
              value={users.kycPending ?? 0}
              subtitle="Pending verifications"
              onClick={() => nav("/admin/kyc")}
              color="#0ea5e9"
            />
            <Card
              title="5-Matrix"
              value={fiveProg.users || 0}
              subtitle={`Earned: ₹${Number(fiveProg.total_earned || 0).toFixed(2)}`}
              onClick={() => nav("/admin/matrix/five")}
              color="#9333ea"
            />
            <Card
              title="3-Matrix"
              value={threeUsers || 0}
              subtitle={`Earned: ₹${Number(threeEarned || 0).toFixed(2)}`}
              onClick={() => nav("/admin/matrix/three")}
              color="#14b8a6"
            />
            <Card
              title="Auto Commission Pool"
              value={activeAccounts || 0}
              subtitle="Active accounts"
              onClick={() => nav("/admin/autopool")}
              color="#f59e0b"
            />
          </div>

          {/* Quick actions */}
          <div style={{ marginTop: 20 }}>
            <h3 style={{ margin: "12px 0 8px 0", color: "#0f172a" }}>Quick Actions</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => nav("/admin/user-tree")}
                style={{
                  padding: "8px 12px",
                  background: "#0f172a",
                  color: "#fff",
                  border: 0,
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Open User Tree
              </button>
              <button
                onClick={() => nav("/admin/users")}
                style={{
                  padding: "8px 12px",
                  background: "#334155",
                  color: "#fff",
                  border: 0,
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Browse Users
              </button>
              <button
                onClick={() => nav("/admin/e-coupons")}
                style={{
                  padding: "8px 12px",
                  background: "#7c3aed",
                  color: "#fff",
                  border: 0,
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Manage E‑Coupons
              </button>
            </div>
          </div>

          {/* 5-Matrix Quick Viewer */}
          <div style={{ marginTop: 20 }}>
          <h3 style={{ margin: "12px 0 8px 0", color: "#0f172a" }}>5‑Matrix Quick Viewer</h3>
          <TreeReferralGalaxy mode="admin" />
          </div>
        </>
      )}
    </div>
  );
}
