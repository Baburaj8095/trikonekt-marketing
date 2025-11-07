import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";

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
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      {subtitle ? <div style={{ color: "#94a3b8", fontSize: 12 }}>{subtitle}</div> : null}
    </div>
  );
}

export default function AdminAutopool() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchSummary() {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/admin/autopool/summary/");
      setData(res?.data || {});
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load autopool summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
  }, []);

  const pools = useMemo(() => ["FIVE_150", "THREE_150", "THREE_50"], []);
  const progress = data?.progress || {};
  const accounts = data?.accounts || {};

  const totals = useMemo(() => {
    let users = 0;
    let earned = 0;
    let active = 0;
    pools.forEach((p) => {
      users += Number(progress[p]?.users || 0);
      earned += Number(progress[p]?.total_earned || 0);
      active += Number(accounts[p]?.ACTIVE || 0);
    });
    return { users, earned, active };
  }, [data, pools, progress, accounts]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Auto Commission Pool</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Overview of matrix progress and autopool accounts status across pools.
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#64748b" }}>Loading...</div>
      ) : err ? (
        <div style={{ color: "#dc2626" }}>{err}</div>
      ) : (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <Card
              title="Total Users in Pools"
              value={totals.users}
              subtitle="Users with any matrix progress"
              color="#2563eb"
            />
            <Card
              title="Total Earned"
              value={`₹${totals.earned.toFixed(2)}`}
              subtitle="Sum of earnings across pools"
              color="#059669"
            />
            <Card
              title="Active Accounts"
              value={totals.active}
              subtitle="Active autopool accounts"
              color="#f59e0b"
            />
          </div>

          {/* Per-pool tables */}
          {pools.map((pool) => {
            const p = progress[pool] || {};
            const acc = accounts[pool] || {};
            return (
              <div
                key={pool}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fff",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{pool}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {pool === "FIVE_150" ? (
                      <a
                        href="/admin/matrix/five"
                        style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                      >
                        Open 5-Matrix
                      </a>
                    ) : (
                      <a
                        href="/admin/matrix/three"
                        style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                      >
                        Open 3-Matrix
                      </a>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: 8,
                    padding: 12,
                  }}
                >
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>Users</div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{p.users || 0}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>Total Earned</div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>
                      ₹{Number(p.total_earned || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>Accounts Active</div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{acc.ACTIVE || 0}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>Accounts Pending / Closed</div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>
                      {(acc.PENDING || 0)} / {(acc.CLOSED || 0)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
