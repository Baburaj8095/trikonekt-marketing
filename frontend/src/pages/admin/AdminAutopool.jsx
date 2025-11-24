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

  // Transactions table state (Auto Pool related credits)
  const [txs, setTxs] = useState([]);
  const [txCount, setTxCount] = useState(0);
  const [txLoading, setTxLoading] = useState(true);
  const [txErr, setTxErr] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");

  const loadTransactions = async (pageIn = page, searchIn = search) => {
    setTxLoading(true);
    setTxErr("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageIn));
      params.set("page_size", String(pageSize));
      if ((searchIn || "").trim()) {
        params.set("user", (searchIn || "").trim());
      }
      const res = await API.get(`/admin/autopool/transactions/?${params.toString()}`);
      setTxs(res?.data?.results || []);
      setTxCount(res?.data?.count || 0);
    } catch (e) {
      setTxErr(e?.response?.data?.detail || "Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(1, "");
    // eslint-disable-next-line
  }, [pageSize]);

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
        <div>
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
        {/* Recent Auto Pool transactions (table) */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              overflow: "hidden",
              background: "#fff",
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
              <div style={{ fontWeight: 800, color: "#0f172a" }}>Recent Auto Pool Transactions</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by user/id/phone"
                  style={{
                    padding: "6px 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                    fontSize: 12,
                    outline: "none",
                    minWidth: 220,
                  }}
                />
                <button
                  onClick={() => {
                    const p = 1;
                    setPage(p);
                    loadTransactions(p, search);
                  }}
                  style={{
                    padding: "6px 10px",
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Search
                </button>
                <button
                  onClick={() => {
                    setSearch("");
                    const p = 1;
                    setPage(p);
                    loadTransactions(p, "");
                  }}
                  style={{
                    padding: "6px 10px",
                    background: "#0ea5e9",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: 8, textAlign: "left", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>TR</th>
                    <th style={{ padding: 8, textAlign: "left", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Username</th>
                    <th style={{ padding: 8, textAlign: "left", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Sponsor ID</th>
                    <th style={{ padding: 8, textAlign: "left", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Type</th>
                    <th style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Amount</th>
                    <th style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>After Tax (Withdrawable)</th>
                    <th style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Main Wallet</th>
                    <th style={{ padding: 8, textAlign: "left", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", color: "#64748b", padding: 12, fontSize: 12 }}>Loading...</td>
                    </tr>
                  ) : txErr ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", color: "#dc2626", padding: 12, fontSize: 12 }}>{txErr}</td>
                    </tr>
                  ) : txs.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", color: "#64748b", padding: 12, fontSize: 12 }}>No transactions</td>
                    </tr>
                  ) : (
                    txs.map((t) => {
                      const typeLabel = t?.source_type || t?.type || "";
                      const amount = Number(t?.amount ?? 0);
                      const net = t?.net_amount != null ? Number(t.net_amount) : amount;
                      const mainBal = t?.main_balance != null ? Number(t.main_balance) : null;
                      const dt = t?.created_at ? new Date(t.created_at) : null;
                      return (
                        <tr key={t.id}>
                          <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{t?.prefixed_id || ""}</td>
                          <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{t?.username || ""}</td>
                          <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{t?.sponsor_id || ""}</td>
                          <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{typeLabel}</td>
                          <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", textAlign: "right" }}>₹{amount.toFixed(2)}</td>
                          <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", textAlign: "right" }}>₹{net.toFixed(2)}</td>
                          <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", textAlign: "right" }}>
                            {mainBal == null ? "-" : `₹${mainBal.toFixed(2)}`}
                          </td>
                          <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                            {dt ? dt.toLocaleString() : ""}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px",
                borderTop: "1px solid #e2e8f0",
                background: "#fff",
              }}
            >
              <div style={{ color: "#64748b", fontSize: 12 }}>Total: {txCount}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  disabled={page <= 1 || txLoading}
                  onClick={() => {
                    if (page <= 1) return;
                    const p = Math.max(1, page - 1);
                    setPage(p);
                    loadTransactions(p, search);
                  }}
                  style={{
                    padding: "6px 10px",
                    background: "#e2e8f0",
                    color: "#0f172a",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: page <= 1 || txLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <div style={{ color: "#0f172a", fontSize: 12 }}>
                  Page {page} / {Math.max(1, Math.ceil(txCount / pageSize))}
                </div>
                <button
                  disabled={page * pageSize >= txCount || txLoading}
                  onClick={() => {
                    const p = page + 1;
                    if ((p - 1) * pageSize >= txCount) return;
                    setPage(p);
                    loadTransactions(p, search);
                  }}
                  style={{
                    padding: "6px 10px",
                    background: "#e2e8f0",
                    color: "#0f172a",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: page * pageSize >= txCount || txLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
