import React, { useEffect, useMemo, useState } from "react";
import {
  adminListWalletUploadRequests,
  adminApproveWalletUploadRequest,
  adminRejectWalletUploadRequest,
} from "../../api/api";
import normalizeMediaUrl from "../../utils/media";

function Select({ label, value, onChange, options }) {
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

function renderStatusBadge(s) {
  switch (String(s || "").toUpperCase()) {
    case "PENDING":
      return <Badge color="#b45309" bg="#ffedd5">Pending</Badge>;
    case "APPROVED":
      return <Badge color="#065f46" bg="#d1fae5">Approved</Badge>;
    case "REJECTED":
      return <Badge color="#991b1b" bg="#fee2e2">Rejected</Badge>;
    default:
      return <Badge>{s}</Badge>;
  }
}

export default function AdminWalletUploadApprovals() {
  const tableMinWidth = 960;
  const tableColumns = "140px 160px minmax(260px, 1fr) 120px 120px 160px";
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  const statusOptions = useMemo(
    () => [
      { value: "PENDING", label: "Pending" },
      { value: "APPROVED", label: "Approved" },
      { value: "REJECTED", label: "Rejected" },
    ],
    []
  );

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      const items = await adminListWalletUploadRequests({ status });
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load wallet upload requests");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, [status]);

  async function handleApprove(r) {
    if (!window.confirm(`Approve wallet upload request #${r.id} for ₹${r.amount}?`)) return;
    try {
      await adminApproveWalletUploadRequest(r.id);
      await fetchRows();
      alert("Approved. Amount is now visible in Add Money Pocket.");
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to approve");
    }
  }

  async function handleReject(r) {
    const reason = window.prompt("Enter reject reason (optional):", "");
    if (reason === null) return;
    try {
      await adminRejectWalletUploadRequest(r.id, reason || "");
      await fetchRows();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to reject");
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: "100%", overflowX: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Wallet Upload Approvals</h2>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
            Approve will credit <b>Add Money Pocket</b> for package purchase payments.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Select label="Status" value={status} onChange={setStatus} options={statusOptions} />
          <button
            onClick={fetchRows}
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <div style={{ marginTop: 12, padding: 10, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, color: "#991b1b" }}>
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 16, border: "1px solid #e2e8f0", borderRadius: 12, overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: tableMinWidth }}>
        <div style={{ display: "grid", gridTemplateColumns: tableColumns, background: "#f8fafc", padding: 10, fontSize: 12, color: "#475569", fontWeight: 700 }}>
          <div>ID</div>
          <div>User</div>
          <div>Payment</div>
          <div>Amount</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading ? (
          <div style={{ padding: 14 }}>Loading...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 14, color: "#64748b" }}>No requests.</div>
        ) : (
          rows.map((r) => {
            const proofUrl = normalizeMediaUrl(r?.proof);
            return (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: tableColumns,
                  padding: 10,
                  borderTop: "1px solid #e2e8f0",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>#{r.id}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{r?.requested_at ? new Date(r.requested_at).toLocaleString() : ""}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{r?.username || "-"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{r?.full_name || ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <div>UTR: <b>{r?.utr || "-"}</b></div>
                  {proofUrl ? (
                    <a href={proofUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      View proof
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>No proof</span>
                  )}
                  {r?.remarks ? <div style={{ fontSize: 12, color: "#64748b", wordBreak: "break-word" }}>Remarks: {r.remarks}</div> : null}
                  {r?.reject_reason ? <div style={{ fontSize: 12, color: "#991b1b", wordBreak: "break-word" }}>Reject: {r.reject_reason}</div> : null}
                </div>
                <div style={{ fontWeight: 900 }}>₹{Number(r?.amount || 0).toLocaleString("en-IN")}</div>
                <div>{renderStatusBadge(r?.status)}</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {String(r?.status || "").toUpperCase() === "PENDING" ? (
                    <>
                      <button
                        onClick={() => handleApprove(r)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #86efac",
                          background: "#dcfce7",
                          color: "#166534",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(r)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #fecaca",
                          background: "#fee2e2",
                          color: "#991b1b",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: "#64748b" }}>—</span>
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
