import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";

function TextInput({ label, value, onChange, placeholder, type = "text", style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          outline: "none",
          background: "#fff",
          ...style,
        }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          outline: "none",
          background: "#fff",
          ...style,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TreeNode({ node, depth = 0 }) {
  const pad = depth * 16;
  return (
    <div style={{ paddingLeft: pad, paddingTop: 6, paddingBottom: 6, borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ fontWeight: 700, color: "#0f172a" }}>
        {node.username} <span style={{ color: "#64748b", fontWeight: 500 }}>#{node.id} • {node.full_name || "—"}</span>
      </div>
      {Array.isArray(node.children) && node.children.length > 0 ? (
        <div>
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminMatrixThree() {
  // Selected pool for 3-matrix view
  const [pool, setPool] = useState("THREE_150");

  // Progress list filters
  const [filters, setFilters] = useState({
    user: "",
    state: "",
    pincode: "",
    ordering: "-updated_at",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // Tree
  const [treeIdentifier, setTreeIdentifier] = useState("");
  const [tree, setTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeErr, setTreeErr] = useState("");

  // Accounts browser + Stats for 3‑matrix
  const [accFilters, setAccFilters] = useState({ user: "", sourceId: "", pageSize: 25 });
  const [accRows, setAccRows] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accErr, setAccErr] = useState("");

  const [statsSourceId, setStatsSourceId] = useState("");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState("");

  // 3‑Matrix transactions table (AUTOPOOL_BONUS_THREE)
  const [txRows, setTxRows] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txErr, setTxErr] = useState("");

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function fetchProgress() {
    setLoading(true);
    setErr("");
    try {
      const params = { pool };
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      const res = await API.get("/admin/matrix/progress/", { params });
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load matrix progress");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProgress();
  }, [pool]);

  async function loadTx() {
    setTxErr("");
    setTxRows([]);
    setTxLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("types", "AUTOPOOL_BONUS_THREE");
      params.set("page_size", "50");
      params.set("ordering", "-created_at");
      const res = await API.get(`/admin/autopool/transactions/?${params.toString()}`, { dedupe: "cancelPrevious" });
      setTxRows(res?.data?.results || []);
    } catch (e) {
      setTxErr(e?.response?.data?.detail || "Failed to load 3‑matrix transactions");
      setTxRows([]);
    } finally {
      setTxLoading(false);
    }
  }

  useEffect(() => {
    loadTx();
  }, [pool]);

  async function resolveRootId(identifier) {
    const idStr = (identifier || "").trim();
    if (!idStr) return null;
    if (/^\d+$/.test(idStr)) {
      return parseInt(idStr, 10);
    }
    // resolve via admin user root endpoint (supports username/email/unique_id/sponsor_id/phone)
    const res = await API.get("/admin/users/tree/root/", { params: { identifier: idStr } });
    return res?.data?.id || null;
  }

  async function loadTree() {
    setTreeErr("");
    setTree(null);
    const ident = treeIdentifier.trim();
    if (!ident) {
      setTreeErr("Enter user id / username / sponsor_id / phone / email / unique_id");
      return;
    }
    setTreeLoading(true);
    try {
      const rootId = await resolveRootId(ident);
      if (!rootId) {
        setTreeErr("Root user not found");
        setTree(null);
        return;
      }
      const res = await API.get("/admin/matrix/tree/", {
        params: { pool, root_user_id: rootId },
      });
      setTree(res?.data || null);
    } catch (e) {
      setTreeErr(e?.response?.data?.detail || "Failed to load tree");
      setTree(null);
    } finally {
      setTreeLoading(false);
    }
  }

  const poolOptions = useMemo(
    () => [
      { value: "THREE_150", label: "3-Matrix (THREE_150)" },
      { value: "THREE_50", label: "3-Matrix (THREE_50)" },
    ],
    []
  );

  const orderingOptions = useMemo(
    () => [
      { value: "-updated_at", label: "Recently updated" },
      { value: "updated_at", label: "Oldest updated" },
      { value: "-total_earned", label: "Earned desc" },
      { value: "total_earned", label: "Earned asc" },
      { value: "-level_reached", label: "Level desc" },
      { value: "level_reached", label: "Level asc" },
    ],
    []
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>3-Matrix</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Browse progress and view sponsor hierarchy for 3-matrix pools.
        </div>
      </div>

      {/* Pool Selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Select
          label="Pool"
          value={pool}
          onChange={setPool}
          options={poolOptions}
        />
      </div>

      {/* Progress Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <TextInput
          label="User"
          value={filters.user}
          onChange={(v) => setF("user", v)}
          placeholder="user id / username / name / phone"
        />
        <TextInput
          label="State ID"
          value={filters.state}
          onChange={(v) => setF("state", v)}
          placeholder="numeric state id"
        />
        <TextInput
          label="Pincode"
          value={filters.pincode}
          onChange={(v) => setF("pincode", v)}
          placeholder="contains"
        />
        <Select
          label="Ordering"
          value={filters.ordering}
          onChange={(v) => setF("ordering", v)}
          options={orderingOptions}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={fetchProgress}
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#0f172a",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Apply Filters"}
        </button>
        <button
          onClick={() =>
            setFilters({
              user: "",
              state: "",
              pincode: "",
              ordering: "-updated_at",
            })
          }
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#fff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Reset
        </button>
        {err ? <div style={{ color: "#dc2626" }}>{err}</div> : null}
      </div>

      {/* Progress Table */}
      <div
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
            display: "grid",
            gridTemplateColumns: "100px 160px 1fr 120px 120px 180px 180px 160px",
            gap: 8,
            padding: "10px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          <div>UserID</div>
          <div>Username</div>
          <div>Full Name</div>
          <div>Pool</div>
          <div>Level</div>
          <div>Per-Level Counts</div>
          <div>Per-Level Earned</div>
          <div>Total Earned</div>
        </div>
        <div>
          {rows.map((r, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "100px 160px 1fr 120px 120px 180px 180px 160px",
                gap: 8,
                padding: "10px",
                borderBottom: "1px solid #e2e8f0",
                alignItems: "center",
              }}
            >
              <div>{r.user_id}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.full_name || "—"}</div>
              <div>{r.pool_type}</div>
              <div>{r.level_reached ?? 0}</div>
              <div style={{ fontSize: 12, color: "#334155" }}>
                {r.per_level_counts ? JSON.stringify(r.per_level_counts) : "—"}
              </div>
              <div style={{ fontSize: 12, color: "#334155" }}>
                {r.per_level_earned ? JSON.stringify(r.per_level_earned) : "—"}
              </div>
              <div>₹{Number(r.total_earned || 0).toFixed(2)}</div>
            </div>
          ))}
          {!loading && rows.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b" }}>No results</div>
          ) : null}
        </div>
      </div>

      {/* 3‑Matrix Transactions */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: "12px 0 8px 0", color: "#0f172a" }}>3‑Matrix Transactions</h3>
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: 8, textAlign: "left", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Sr.No</th>
                  <th style={{ padding: 8, textAlign: "left", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Tr Username</th>
                  <th style={{ padding: 8, textAlign: "left", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Sponsor. Id</th>
                  <th style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Transaction Amount</th>
                  <th style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Autopool-phase-1 Income</th>
                  <th style={{ padding: 8, textAlign: "right", fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Payable Amt</th>
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", color: "#64748b", padding: 12, fontSize: 12 }}>Loading...</td>
                  </tr>
                ) : txErr ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", color: "#dc2626", padding: 12, fontSize: 12 }}>{txErr}</td>
                  </tr>
                ) : txRows.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", color: "#64748b", padding: 12, fontSize: 12 }}>No transactions</td>
                  </tr>
                ) : (
                  txRows.map((t, i) => {
                    const amount = Number(t?.amount ?? 0);
                    const net = t?.net_amount != null ? Number(t.net_amount) : amount;
                    const phase1Income = t?.level_index === 1 ? net : 0;
                    return (
                      <tr key={t.id}>
                        <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{i + 1}</td>
                        <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{t?.username || ""}</td>
                        <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{t?.sponsor_id || ""}</td>
                        <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", textAlign: "right" }}>₹{amount.toFixed(2)}</td>
                        <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", textAlign: "right" }}>{phase1Income ? `₹${phase1Income.toFixed(2)}` : "—"}</td>
                        <td style={{ padding: 8, fontSize: 12, color: "#0f172a", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", textAlign: "right" }}>₹{net.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tree Viewer */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: "12px 0 8px 0", color: "#0f172a" }}>Hierarchy Viewer</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <input
            value={treeIdentifier}
            onChange={(e) => setTreeIdentifier(e.target.value)}
            placeholder="Enter root user id / username / sponsor_id / phone / email / unique_id"
            style={{
              padding: "10px 12px",
              minWidth: 320,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              outline: "none",
              background: "#fff",
            }}
          />
          <button
            onClick={loadTree}
            disabled={treeLoading || !treeIdentifier.trim()}
            style={{
              padding: "10px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: treeIdentifier.trim() && !treeLoading ? "pointer" : "not-allowed",
            }}
          >
            {treeLoading ? "Loading..." : "Load Tree"}
          </button>
          {treeErr ? <span style={{ color: "#dc2626" }}>{treeErr}</span> : null}
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {!tree ? (
            <div style={{ padding: 12, color: "#64748b" }}>
              Enter an identifier and load to view the 3-matrix sponsor hierarchy.
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Root: {tree.username} #{tree.id} • {tree.full_name || "—"}
              </div>
              <TreeNode node={tree} />
            </div>
          )}
        </div>
      </div>

      {/* Matrix Accounts ({pool}) */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: "12px 0 8px 0", color: "#0f172a" }}>{pool} Accounts</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <TextInput
            label="Owner (id/username/name/phone)"
            value={accFilters.user}
            onChange={(v) => setAccFilters((f) => ({ ...f, user: v }))}
            placeholder="search owner"
          />
          <TextInput
            label="Source ID (Coupon ID)"
            value={accFilters.sourceId}
            onChange={(v) => setAccFilters((f) => ({ ...f, sourceId: v }))}
            placeholder="coupon id e.g. 123"
          />
          <TextInput
            label="Page Size"
            type="number"
            value={accFilters.pageSize}
            onChange={(v) => {
              const n = parseInt(v || "25", 10);
              setAccFilters((f) => ({ ...f, pageSize: isNaN(n) ? 25 : Math.max(1, Math.min(n, 200)) }));
            }}
            placeholder="25"
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={async () => {
              setAccErr("");
              setAccRows([]);
              setAccLoading(true);
              try {
                const params = {
                  pool,
                  page_size: accFilters.pageSize || 25,
                  ordering: "-created_at",
                };
                if (accFilters.user && accFilters.user.trim()) params.user = accFilters.user.trim();
                if (accFilters.sourceId && accFilters.sourceId.trim()) {
                  params.source_type = "ECOUPON";
                  params.source_id = accFilters.sourceId.trim();
                }
                const res = await API.get("/admin/matrix/accounts/", { params, dedupe: "cancelPrevious" });
                const items = res?.data?.results || res?.data || [];
                setAccRows(Array.isArray(items) ? items : []);
              } catch (e) {
                setAccErr(e?.response?.data?.detail || "Failed to load accounts");
                setAccRows([]);
              } finally {
                setAccLoading(false);
              }
            }}
            disabled={accLoading}
            style={{
              padding: "10px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: accLoading ? "not-allowed" : "pointer",
            }}
          >
            {accLoading ? "Loading..." : "Load Accounts"}
          </button>
          {accErr ? <div style={{ color: "#dc2626" }}>{accErr}</div> : null}
        </div>

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
              display: "grid",
              gridTemplateColumns: "80px 180px 180px 100px 80px 140px 160px 200px",
              gap: 8,
              padding: "10px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            <div>ID</div>
            <div>Owner</div>
            <div>Parent Owner</div>
            <div>Level</div>
            <div>Pos</div>
            <div>Source</div>
            <div>Source ID</div>
            <div>Created</div>
          </div>
          <div>
            {accRows.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 180px 180px 100px 80px 140px 160px 200px",
                  gap: 8,
                  padding: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  alignItems: "center",
                }}
              >
                <div>{a.id}</div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.username} <span style={{ color: "#64748b" }}>#{a.owner_id}</span>
                </div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.parent_owner?.username ? `${a.parent_owner.username} #${a.parent_owner.id}` : "—"}
                </div>
                <div>{a.level ?? "—"}</div>
                <div>{a.position ?? "—"}</div>
                <div>{a.source_type || "—"}</div>
                <div>{a.source_id || "—"}</div>
                <div>{a.created_at || "—"}</div>
              </div>
            ))}
            {!accLoading && accRows.length === 0 ? (
              <div style={{ padding: 12, color: "#64748b" }}>No accounts</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Level-wise Commission Stats (by Coupon ID) */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: "12px 0 8px 0", color: "#0f172a" }}>Level-wise Commission Stats</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <input
            value={statsSourceId}
            onChange={(e) => setStatsSourceId(e.target.value)}
            placeholder="Enter Coupon ID (source_id)"
            style={{
              padding: "10px 12px",
              minWidth: 320,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              outline: "none",
              background: "#fff",
            }}
          />
          <button
            onClick={async () => {
              setStatsErr("");
              setStats(null);
              const sid = (statsSourceId || "").trim();
              if (!sid) {
                setStatsErr("Enter coupon id");
                return;
              }
              setStatsLoading(true);
              try {
                const res = await API.get("/admin/matrix/account-stats/", {
                  params: { pool, source_type: "ECOUPON", source_id: sid },
                  dedupe: "cancelPrevious",
                });
                setStats(res?.data || null);
              } catch (e) {
                setStatsErr(e?.response?.data?.detail || "Failed to load stats");
                setStats(null);
              } finally {
                setStatsLoading(false);
              }
            }}
            disabled={statsLoading}
            style={{
              padding: "10px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: statsLoading ? "not-allowed" : "pointer",
            }}
          >
            {statsLoading ? "Loading..." : "Load Stats"}
          </button>
          {statsErr ? <span style={{ color: "#dc2626" }}>{statsErr}</span> : null}
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {!stats ? (
            <div style={{ padding: 12, color: "#64748b" }}>
              Enter a coupon id and load to view level-wise and total commission credited from {pool}.
            </div>
          ) : (
            <div style={{ padding: 12 }}>
              <div style={{ marginBottom: 8, color: "#0f172a", fontWeight: 700 }}>
                Total Transactions: {stats.tx_count} • Total Amount: ₹{Number(stats.total_amount || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: "#334155" }}>
                {stats.per_level ? JSON.stringify(stats.per_level) : "—"}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
