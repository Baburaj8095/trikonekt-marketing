import React, { useEffect, useMemo, useState } from "react";
import {
  adminListPromoPurchases,
  adminApprovePromoPurchase,
  adminRejectPromoPurchase,
} from "../../api/api";

function Select({ label, value, onChange, options, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label ? <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label> : null}
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

export default function AdminPromoPurchases() {
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  const statusOptions = useMemo(
    () => [
      { value: "PENDING", label: "Pending" },
      { value: "APPROVED", label: "Approved" },
      { value: "REJECTED", label: "Rejected" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
    []
  );

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      const items = await adminListPromoPurchases({ status });
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.detail || "Failed to load promo purchases");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, [status]);

  async function handleApprove(r) {
    if (!window.confirm(`Approve purchase #${r.id}?`)) return;
    try {
      await adminApprovePromoPurchase(r.id);
      await fetchRows();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to approve");
    }
  }

  async function handleReject(r) {
    const reason = window.prompt("Enter reject reason (optional):", "");
    if (reason === null) return;
    try {
      await adminRejectPromoPurchase(r.id, reason || "");
      await fetchRows();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to reject");
    }
  }

  function renderStatusBadge(s) {
    switch (String(s || "").toUpperCase()) {
      case "PENDING":
        return <Badge color="#b45309" bg="#ffedd5">Pending</Badge>;
      case "APPROVED":
        return <Badge color="#065f46" bg="#d1fae5">Approved</Badge>;
      case "REJECTED":
        return <Badge color="#991b1b" bg="#fee2e2">Rejected</Badge>;
      case "CANCELLED":
        return <Badge color="#374151" bg="#e5e7eb">Cancelled</Badge>;
      default:
        return <Badge>{s}</Badge>;
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Promo Purchases</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Approve or reject consumer promo purchases. This view is kept intentionally simple.
        </div>
      </div>

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
          value={status}
          onChange={setStatus}
          options={statusOptions}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={fetchRows}
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
          {loading ? "Loading..." : "Refresh"}
        </button>
        {err ? <div style={{ color: "#dc2626" }}>{err}</div> : null}
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflowX: "auto",
          overflowY: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "70px 160px 1.2fr 0.8fr 80px 120px 120px 120px 160px",
            gap: 8,
            padding: "10px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            color: "#0f172a",
            minWidth: 980,
          }}
        >
          <div>ID</div>
          <div>User</div>
          <div>Package</div>
          <div>Type</div>
          <div>Qty</div>
          <div>Amount</div>
          <div>Status</div>
          <div>Requested</div>
          <div>Actions</div>
        </div>
        <div>
          {rows.map((r) => {
            const pkg = r.package || {};
            const requestedAt = r.requested_at ? new Date(r.requested_at).toLocaleString() : "—";
            const proofUrl = r.payment_proof || "";
            const isMonthly = (pkg.type || "") === "MONTHLY";
            const monText = isMonthly ? ` • ${String(r.year || "")}-${String(r.month || "").toString().padStart(2, "0")}` : "";
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "70px 160px 1.2fr 0.8fr 80px 120px 120px 120px 160px",
                  gap: 8,
                  padding: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  alignItems: "center",
                  minWidth: 980,
                }}
              >
                <div>#{r.id}</div>
                <div>{r.user_username ? r.user_username : (r.user_id ? `#${r.user_id}` : "—")}</div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  <div style={{ fontWeight: 600 }}>{pkg.name || pkg.code || "—"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    ₹{Number(pkg.price || 0).toFixed(2)}{monText}
                  </div>
                  {proofUrl ? (
                    <div style={{ marginTop: 6 }}>
                      <a
                        href={proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12 }}
                      >
                        View Payment Proof
                      </a>
                    </div>
                  ) : null}
                  {r.remarks ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: "#475569", whiteSpace: "pre-wrap" }}>
                      {r.remarks}
                    </div>
                  ) : null}
                </div>
                <div>{pkg.type || "—"}</div>
                <div>{r.quantity ?? 1}</div>
                <div>₹{Number(r.amount_paid || 0).toFixed(2)}</div>
                <div>{renderStatusBadge(r.status)}</div>
                <div>{requestedAt}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {String(r.status || "").toUpperCase() === "PENDING" ? (
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
