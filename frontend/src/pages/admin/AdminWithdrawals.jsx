import React, { useEffect, useMemo, useState } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
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

function PrimaryButton({ children, disabled, onClick, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        background: "#0f172a",
        color: "#fff",
        border: 0,
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, disabled, onClick, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        background: "#fff",
        color: "#0f172a",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ActionButton({ children, onClick, disabled, variant = "neutral" }) {
  const stylesByVariant = {
    approve: { background: "#059669", color: "#fff" },
    reject: { background: "#ef4444", color: "#fff" },
    neutral: { background: "#0f172a", color: "#fff" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        border: 0,
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        ...stylesByVariant[variant],
      }}
    >
      {children}
    </button>
  );
}

export default function AdminWithdrawals() {
  // Breakpoints
  // Mobile: <600px, Tablet: 600-1024px, Desktop: >1024px
  const isMobile = useMediaQuery("(max-width:599.95px)");
  const isDesktop = useMediaQuery("(min-width:1024.05px)");

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
  const [showFilters, setShowFilters] = useState(false);

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

  const formatDateTime = (value) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  };

  const getStatusBadge = (r) =>
    r.status === "pending" ? (
      <Badge color="#b45309" bg="#ffedd5">
        Pending
      </Badge>
    ) : r.status === "approved" ? (
      <Badge color="#065f46" bg="#d1fae5">
        Approved
      </Badge>
    ) : (
      <Badge color="#991b1b" bg="#fee2e2">
        Rejected
      </Badge>
    );

  const resetFilters = () =>
    setFilters({
      status: "pending",
      user: "",
      date_from: "",
      date_to: "",
      min_amount: "",
      max_amount: "",
      method: "",
      ordering: "-requested_at",
    });

  return (
    <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#0f172a" }}>Withdrawals</h2>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Approve or reject pending withdrawal requests. Filters help narrow results.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: 8,
              width: isMobile ? "100%" : "auto",
            }}
          >
            {isMobile ? (
              <SecondaryButton
                disabled={loading}
                onClick={() => setShowFilters((s) => !s)}
                style={{ width: "100%" }}
              >
                {showFilters ? "Hide Filters" : "Show Filters"}
              </SecondaryButton>
            ) : null}

            <div
              style={{
                color: "#334155",
                fontSize: 14,
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#fff",
                width: isMobile ? "100%" : "auto",
              }}
            >
              Pending: <b>{summary.pendingCount}</b> • Amount: <b>₹{summary.pendingAmount.toFixed(2)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          marginBottom: 12,
          display: !isMobile || showFilters ? "block" : "none",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop
              ? "repeat(4, minmax(0, 1fr))"
              : "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <Select
            label="Status"
            value={filters.status}
            onChange={(v) => setF("status", v)}
            options={statusOptions}
            style={{ width: "100%" }}
          />
          <TextInput
            label="User"
            value={filters.user}
            onChange={(v) => setF("user", v)}
            placeholder="user id / username / name / phone"
            style={{ width: "100%" }}
          />
          <TextInput
            label="From Date"
            type="date"
            value={filters.date_from}
            onChange={(v) => setF("date_from", v)}
            placeholder=""
            style={{ width: "100%" }}
          />
          <TextInput
            label="To Date"
            type="date"
            value={filters.date_to}
            onChange={(v) => setF("date_to", v)}
            placeholder=""
            style={{ width: "100%" }}
          />
          <TextInput
            label="Min Amount"
            value={filters.min_amount}
            onChange={(v) => setF("min_amount", v)}
            placeholder="e.g. 100"
            style={{ width: "100%" }}
          />
          <TextInput
            label="Max Amount"
            value={filters.max_amount}
            onChange={(v) => setF("max_amount", v)}
            placeholder="e.g. 5000"
            style={{ width: "100%" }}
          />
          <Select
            label="Method"
            value={filters.method}
            onChange={(v) => setF("method", v)}
            options={methodOptions}
            style={{ width: "100%" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 8,
            marginTop: 12,
            alignItems: isMobile ? "stretch" : "center",
          }}
        >
          <PrimaryButton
            onClick={fetchWithdrawals}
            disabled={loading}
            style={{ width: isMobile ? "100%" : "auto" }}
          >
            {loading ? "Loading..." : "Apply Filters"}
          </PrimaryButton>
          <SecondaryButton
            onClick={resetFilters}
            disabled={loading}
            style={{ width: isMobile ? "100%" : "auto" }}
          >
            Reset
          </SecondaryButton>
          {err ? (
            <div style={{ color: "#dc2626", fontSize: 13, marginLeft: isMobile ? 0 : "auto" }}>
              {err}
            </div>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {isMobile ? (
        // Mobile: Cards (avoid heavy table rendering)
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => {
            const statusBadge = getStatusBadge(r);
            return (
              <div
                key={r.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                      {r.full_name || r.username || "User"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.username ? `@${r.username}` : ""}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>{statusBadge}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Amount</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      ₹{Number(r.amount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Method</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {r.method?.toUpperCase?.() || ""}
                    </div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Requested</div>
                    <div style={{ fontSize: 13, color: "#0f172a" }}>{formatDateTime(r.requested_at)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {r.status === "pending" ? (
                    <>
                      <ActionButton onClick={() => handleApprove(r)} variant="approve">
                        Approve
                      </ActionButton>
                      <ActionButton onClick={() => handleReject(r)} variant="reject">
                        Reject
                      </ActionButton>
                    </>
                  ) : (
                    <div style={{ color: "#64748b", fontSize: 12 }}>No actions</div>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && rows.length === 0 ? <div style={{ padding: 12, color: "#64748b" }}>No results</div> : null}
        </div>
      ) : (
        // Tablet/Desktop: Table
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
            width: "100%",
          }}
        >
          <div
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              style={{
                minWidth: 980,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 160px 1.2fr 120px 120px 120px 180px 220px",
                  gap: 8,
                  padding: 12,
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  fontWeight: 800,
                  color: "#0f172a",
                  fontSize: 13,
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
                  const statusBadge = getStatusBadge(r);
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "80px 160px 1.2fr 120px 120px 120px 180px 220px",
                        gap: 8,
                        padding: 12,
                        borderBottom: "1px solid #e2e8f0",
                        alignItems: "center",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ color: "#0f172a", fontWeight: 700 }}>{r.id}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.full_name || ""}</div>
                      <div style={{ fontWeight: 700 }}>₹{Number(r.amount || 0).toFixed(2)}</div>
                      <div>{r.method?.toUpperCase?.() || ""}</div>
                      <div>{statusBadge}</div>
                      <div style={{ color: "#334155" }}>{formatDateTime(r.requested_at)}</div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "flex-start",
                        }}
                      >
                        {r.status === "pending" ? (
                          <>
                            <ActionButton onClick={() => handleApprove(r)} variant="approve">
                              Approve
                            </ActionButton>
                            <ActionButton onClick={() => handleReject(r)} variant="reject">
                              Reject
                            </ActionButton>
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
        </div>
      )}
    </div>
  );
}


