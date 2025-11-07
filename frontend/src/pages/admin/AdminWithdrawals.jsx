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

function Badge({ children, color = "#1f2937", bg = "#e5e7eb" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 12,
        borderRadius: 999,
        color,
        background: bg,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

export default function AdminWithdrawals() {
  const [filters, setFilters] = useState({
    status: "pending",
    user: "",
    date_from: "",
    date_to: "",
    min_amount: "",
    max_amount: "",
    method: "",
    ordering: "-requested_at",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  const methodOptions = useMemo(
    () => [
      { value: "", label: "Any method" },
      { value: "upi", label: "UPI" },
      { value: "bank", label: "Bank Transfer" },
    ],
    []
  );
  const statusOptions = useMemo(
    () => [
      { value: "", label: "Any status" },
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
    ],
    []
  );

  async function fetchWithdrawals() {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      const res = await API.get("/admin/withdrawals/", { params });
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load withdrawals");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  async function handleApprove(row) {
    const payout_ref = window.prompt("Enter payout reference (optional):", row.payout_ref || "");
    if (payout_ref === null) return;
    try {
      await API.patch(`/admin/withdrawals/${row.id}/approve/`, { payout_ref });
      await fetchWithdrawals();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to approve");
    }
  }

  async function handleReject(row) {
    const reason = window.prompt("Enter reject reason (optional):", "");
    if (reason === null) return;
    try {
      await API.patch(`/admin/withdrawals/${row.id}/reject/`, { reason });
      await fetchWithdrawals();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to reject");
    }
  }

  const summary = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending");
    const totalPending = pending.reduce((s, r) => s + Number(r.amount || 0), 0);
    return { pendingCount: pending.length, pendingAmount: totalPending };
  }, [rows]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Withdrawals</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Approve or reject pending withdrawal requests. Filters help narrow results.
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Select
          label="Status"
          value={filters.status}
          onChange={(v) => setF("status", v)}
          options={statusOptions}
        />
        <TextInput
          label="User"
          value={filters.user}
          onChange={(v) => setF("user", v)}
          placeholder="user id / username / name / phone"
        />
        <TextInput
          label="From Date"
          type="date"
          value={filters.date_from}
          onChange={(v) => setF("date_from", v)}
          placeholder=""
        />
        <TextInput
          label="To Date"
          type="date"
          value={filters.date_to}
          onChange={(v) => setF("date_to", v)}
          placeholder=""
        />
        <TextInput
          label="Min Amount"
          value={filters.min_amount}
          onChange={(v) => setF("min_amount", v)}
          placeholder="e.g. 100"
        />
        <TextInput
          label="Max Amount"
          value={filters.max_amount}
          onChange={(v) => setF("max_amount", v)}
          placeholder="e.g. 5000"
        />
        <Select
          label="Method"
          value={filters.method}
          onChange={(v) => setF("method", v)}
          options={methodOptions}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={fetchWithdrawals}
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
              status: "pending",
              user: "",
              date_from: "",
              date_to: "",
              min_amount: "",
              max_amount: "",
              method: "",
              ordering: "-requested_at",
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
        <div style={{ marginLeft: "auto", color: "#334155", fontSize: 14 }}>
          Pending: <b>{summary.pendingCount}</b> • Amount:{" "}
          <b>₹{summary.pendingAmount.toFixed(2)}</b>
        </div>
        {err ? <div style={{ color: "#dc2626" }}>{err}</div> : null}
      </div>

      {/* Table */}
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
            gridTemplateColumns:
              "90px 140px 1fr 120px 120px 120px 120px 160px",
            gap: 8,
            padding: "10px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          <div>ID</div>
          <div>User</div>
          <div>Name</div>
          <div>Amount</div>
          <div>Method</div>
          <div>Status</div>
          <div>Requested</div>
          <div>Actions</div>
        </div>
        <div>
          {rows.map((r) => {
            const statusBadge =
              r.status === "pending" ? (
                <Badge color="#b45309" bg="#ffedd5">Pending</Badge>
              ) : r.status === "approved" ? (
                <Badge color="#065f46" bg="#d1fae5">Approved</Badge>
              ) : (
                <Badge color="#991b1b" bg="#fee2e2">Rejected</Badge>
              );
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "90px 140px 1fr 120px 120px 120px 120px 160px",
                  gap: 8,
                  padding: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  alignItems: "center",
                }}
              >
                <div>{r.id}</div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.username}
                </div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.full_name || "—"}
                </div>
                <div>₹{Number(r.amount || 0).toFixed(2)}</div>
                <div>{r.method?.toUpperCase?.() || "—"}</div>
                <div>{statusBadge}</div>
                <div>{new Date(r.requested_at).toLocaleString()}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {r.status === "pending" ? (
                    <>
                      <button
                        onClick={() => handleApprove(r)}
                        style={{
                          padding: "6px 10px",
                          background: "#059669",
                          color: "#fff",
                          border: 0,
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(r)}
                        style={{
                          padding: "6px 10px",
                          background: "#ef4444",
                          color: "#fff",
                          border: 0,
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span style={{ color: "#64748b", fontSize: 12 }}>No actions</span>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && rows.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b" }}>No results</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
