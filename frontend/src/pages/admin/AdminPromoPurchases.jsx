import React, { useEffect, useMemo, useState } from "react";
import {
  adminListPromoPurchases,
  adminApprovePromoPurchase,
  adminRejectPromoPurchase,
} from "../../api/api";

/**
 * Small UI helpers
 */
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

/**
 * Media helpers for payment proof and UTR display
 */
function isImageUrl(url = "") {
  const u = String(url || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(u);
}
function absUrl(url = "") {
  const s = String(url || "");
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  try {
    return new URL(s, window.location.origin).toString();
  } catch {
    return s;
  }
}
// Best-effort: extract UTR-like token from remarks when explicit UTR not present
function extractUTR(remarks = "") {
  const s = String(remarks || "");
  // UTRs are typically 10-16 alphanumeric (often 12). Pick first good candidate.
  const m = s.toUpperCase().match(/\b([A-Z0-9]{10,16})\b/);
  return m ? m[1] : "";
}

export default function AdminPromoPurchases() {
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [isMobile, setIsMobile] = useState(false);

  const statusOptions = useMemo(
    () => [
      { value: "PENDING", label: "Pending" },
      { value: "APPROVED", label: "Approved" },
      { value: "REJECTED", label: "Rejected" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
    []
  );

  useEffect(() => {
    const onResize = () => {
      try {
        setIsMobile(window.innerWidth < 1024); // lg breakpoint
      } catch {
        setIsMobile(false);
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  function PaymentCell({ proofUrl, utr, remarks }) {
    const url = absUrl(proofUrl || "");
    const guessedUtr = utr || extractUTR(remarks || "");
    const isImg = isImageUrl(url);

    return (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        {url ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>View Proof</a>
            {isImg ? (
              <a href={url} target="_blank" rel="noreferrer" style={{ display: "inline-block" }}>
                <img
                  src={url}
                  alt="payment-proof"
                  style={{
                    display: "block",
                    width: 96,
                    height: 64,
                    objectFit: "cover",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    background: "#fff",
                  }}
                />
              </a>
            ) : null}
          </div>
        ) : (
          <span style={{ color: "#64748b", fontSize: 12 }}>No file</span>
        )}
        <div style={{ fontSize: 12, color: "#0f172a" }}>
          <div><span style={{ color: "#64748b" }}>UTR:</span> {guessedUtr || "—"}</div>
          {remarks ? (
            <div style={{ color: "#475569", whiteSpace: "pre-wrap", marginTop: 2, maxWidth: 260, wordBreak: "break-word" }}>
              {remarks}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function DesktopTable() {
    return (
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflowX: "auto",
          overflowY: "hidden",
          background: "#fff",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              // Added dedicated Payment column
              "70px 160px 1.1fr 0.8fr 60px 120px 120px 140px 240px 140px",
            gap: 8,
            padding: "10px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            color: "#0f172a",
            minWidth: 1080,
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
          <div>Payment</div>
          <div>Actions</div>
        </div>

        {/* Rows */}
        <div>
          {rows.map((r) => {
            const pkg = r.package || {};
            const requestedAt = r.requested_at ? new Date(r.requested_at).toLocaleString() : "—";
            const proofUrl = r.payment_proof || "";
            const isMonthly = (pkg.type || "") === "MONTHLY";
            const monText = isMonthly ? ` • ${String(r.year || "")}-${String(r.month || "").toString().padStart(2, "0")}` : "";
            const userLabel = r.user_username ? r.user_username : (r.user_id ? `#${r.user_id}` : "—");
            const pkgName = pkg.name || pkg.code || "—";
            const pkgPrice = Number(pkg.price || 0);
            const amountPaid = Number(r.amount_paid || 0);

            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "70px 160px 1.1fr 0.8fr 60px 120px 120px 140px 240px 140px",
                  gap: 8,
                  padding: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  alignItems: "center",
                  minWidth: 1080,
                }}
              >
                <div>#{r.id}</div>
                <div style={{ wordBreak: "break-all" }}>{userLabel}</div>

                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{pkgName}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    ₹{pkgPrice.toFixed(2)}{monText}
                  </div>
                </div>

                <div>{pkg.type || "—"}</div>
                <div>{r.quantity ?? 1}</div>
                <div>₹{amountPaid.toFixed(2)}</div>
                <div>{renderStatusBadge(r.status)}</div>
                <div style={{ fontSize: 12 }}>{requestedAt}</div>

                <div>
                  <PaymentCell proofUrl={proofUrl} utr={r.utr} remarks={r.remarks} />
                </div>

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
    );
  }

  function MobileCards() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const pkg = r.package || {};
          const requestedAt = r.requested_at ? new Date(r.requested_at).toLocaleString() : "—";
          const proofUrl = r.payment_proof || "";
          const isMonthly = (pkg.type || "") === "MONTHLY";
          const monText = isMonthly ? ` • ${String(r.year || "")}-${String(r.month || "").toString().padStart(2, "0")}` : "";
          const userLabel = r.user_username ? r.user_username : (r.user_id ? `#${r.user_id}` : "—");
          const pkgName = pkg.name || pkg.code || "—";
          const pkgPrice = Number(pkg.price || 0);
          const amountPaid = Number(r.amount_paid || 0);

          return (
            <div
              key={r.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                background: "#fff",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>#{r.id}</div>
                <div>{renderStatusBadge(r.status)}</div>
              </div>

              <div style={{ fontSize: 12, color: "#64748b" }}>User</div>
              <div style={{ fontWeight: 600, wordBreak: "break-all" }}>{userLabel}</div>

              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Package</div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>{pkgName}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>
                Type: {pkg.type || "—"} • Price: ₹{pkgPrice.toFixed(2)}{monText}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>Qty</div>
                <div style={{ fontWeight: 600 }}>{r.quantity ?? 1}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Amount</div>
                <div style={{ fontWeight: 600 }}>₹{amountPaid.toFixed(2)}</div>
              </div>

              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Requested</div>
              <div style={{ fontWeight: 600 }}>{requestedAt}</div>

              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Payment</div>
              <PaymentCell proofUrl={proofUrl} utr={r.utr} remarks={r.remarks} />

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {String(r.status || "").toUpperCase() === "PENDING" ? (
                  <>
                    <button
                      onClick={() => handleApprove(r)}
                      style={{
                        padding: "8px 12px",
                        background: "#059669",
                        color: "#fff",
                        border: 0,
                        borderRadius: 8,
                        cursor: "pointer",
                        flex: 1,
                        fontWeight: 700,
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(r)}
                      style={{
                        padding: "8px 12px",
                        background: "#ef4444",
                        color: "#fff",
                        border: 0,
                        borderRadius: 8,
                        cursor: "pointer",
                        flex: 1,
                        fontWeight: 700,
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
    );
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
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))",
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

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
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
            fontWeight: 700,
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        {err ? <div style={{ color: "#dc2626" }}>{err}</div> : null}
      </div>

      {isMobile ? <MobileCards /> : <DesktopTable />}
    </div>
  );
}
