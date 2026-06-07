import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/api";

function StatusPill({ active }) {
  const isActive = active !== false;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 76,
        padding: "5px 10px",
        borderRadius: 999,
        background: isActive ? "#dcfce7" : "#fee2e2",
        border: `1px solid ${isActive ? "#86efac" : "#fecaca"}`,
        color: isActive ? "#166534" : "#991b1b",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {isActive ? "Allowed" : "Blocked"}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return String(value);
  }
}

function getUserCode(row) {
  return row?.user_code || row?.prefixed_id || row?.sponsor_id || row?.username || "-";
}

export default function AdminTeamConsumerBlockUsers() {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil((Number(count) || 0) / pageSize));

  const params = useMemo(() => {
    const next = {
      role: "user",
      category: "consumer",
      page,
      page_size: pageSize,
    };
    const q = String(search || "").trim();
    if (q) next.search = q;
    if (status === "allowed") next.is_active = "1";
    if (status === "blocked") next.is_active = "0";
    return next;
  }, [page, search, status]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/admin/users/", {
        params,
        timeout: 30000,
        retryAttempts: 1,
        dedupe: "cancelPrevious",
      });
      const data = res?.data || {};
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setRows(list);
      setCount(Number(data?.count) || list.length);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to load consumers";
      setRows([]);
      setCount(0);
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    loadRows();
  }, [loadRows, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const toggleBlock = async (row) => {
    if (!row?.id) return;
    const currentlyAllowed = row.is_active !== false;
    const action = currentlyAllowed ? "deactivate" : "activate";
    const label = currentlyAllowed ? "block" : "unblock";
    const name = row.full_name || row.username || row.phone || `consumer ${row.id}`;
    const ok = window.confirm(`Are you sure you want to ${label} ${name}?`);
    if (!ok) return;

    setSavingId(row.id);
    setError("");
    try {
      await API.post(`/admin/users/${row.id}/${action}/`, {});
      setRows((prev) =>
        (prev || []).map((item) =>
          item.id === row.id ? { ...item, is_active: !currentlyAllowed } : item
        )
      );
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || `Failed to ${label} consumer`;
      setError(String(msg));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Block Team Consumers</h2>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
          Blocking uses access status. It sets login access off/on and does not change package activation or wallet eligibility.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1fr) 180px auto",
          gap: 10,
          alignItems: "end",
          marginBottom: 12,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#64748b", fontSize: 12 }}>
          Search consumer
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Phone, name, ID, username"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #dbe3ef",
              outline: "none",
              fontSize: 14,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, color: "#64748b", fontSize: 12 }}>
          Access
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #dbe3ef",
              outline: "none",
              background: "#fff",
              fontSize: 14,
            }}
          >
            <option value="all">All consumers</option>
            <option value="allowed">Allowed only</option>
            <option value="blocked">Blocked only</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #2563eb",
            background: loading ? "#93c5fd" : "#2563eb",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
          <thead>
            <tr style={{ background: "#f8fafc", color: "#475569", fontSize: 12, textAlign: "left" }}>
              <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Consumer</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Phone</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Consumer ID</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Package Status</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Access</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>Joined</th>
              <th style={{ padding: 12, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length ? (
              <tr>
                <td colSpan={7} style={{ padding: 18, color: "#64748b", fontWeight: 700 }}>
                  Loading consumers...
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => {
                const allowed = row.is_active !== false;
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid #eef2f7" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ color: "#0f172a", fontWeight: 800 }}>{row.full_name || row.username || "-"}</div>
                      <div style={{ color: "#64748b", fontSize: 12 }}>{row.username || "-"}</div>
                    </td>
                    <td style={{ padding: 12, color: "#0f172a", fontWeight: 700 }}>{row.phone || "-"}</td>
                    <td style={{ padding: 12, color: "#0f172a", fontWeight: 700 }}>{getUserCode(row)}</td>
                    <td style={{ padding: 12, color: row.account_active ? "#166534" : "#92400e", fontWeight: 800 }}>
                      {row.account_active ? "Active" : "Inactive"}
                    </td>
                    <td style={{ padding: 12 }}>
                      <StatusPill active={row.is_active} />
                    </td>
                    <td style={{ padding: 12, color: "#64748b", fontSize: 13 }}>{formatDate(row.date_joined)}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => toggleBlock(row)}
                        disabled={savingId === row.id}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `1px solid ${allowed ? "#dc2626" : "#16a34a"}`,
                          background: allowed ? "#dc2626" : "#16a34a",
                          color: "#fff",
                          cursor: savingId === row.id ? "not-allowed" : "pointer",
                          opacity: savingId === row.id ? 0.7 : 1,
                          fontWeight: 800,
                        }}
                      >
                        {savingId === row.id ? "Saving..." : allowed ? "Block" : "Unblock"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: 18, color: "#64748b", fontWeight: 700 }}>
                  No team consumers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Showing page {page} of {totalPages}. Total consumers: {count}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #dbe3ef",
              background: "#fff",
              cursor: page <= 1 || loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #dbe3ef",
              background: "#fff",
              cursor: page >= totalPages || loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
