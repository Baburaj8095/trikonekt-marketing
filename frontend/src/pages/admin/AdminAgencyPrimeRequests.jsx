import React, { useEffect, useState } from "react";
import {
  adminListAgencyPackagePaymentRequests,
  adminApproveAgencyPackagePaymentRequest,
  adminRejectAgencyPackagePaymentRequest,
} from "../../api/api";

/**
 * AdminAgencyPrimeRequests
 * - Lists Agency Prime Package payment requests
 * - Tabs: Pending / Approved / Rejected
 * - Actions on Pending: Approve, Reject (optional admin notes)
 *
 * Endpoints used:
 *  GET  /business/admin/agency-packages/payment-requests/?status=PENDING|APPROVED|REJECTED
 *  POST /business/admin/agency-packages/payment-requests/{id}/approve/ { admin_notes? }
 *  POST /business/admin/agency-packages/payment-requests/{id}/reject/  { admin_notes? }
 */
export default function AdminAgencyPrimeRequests() {
  const [statusTab, setStatusTab] = useState("PENDING");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load(tab = statusTab) {
    setLoading(true);
    setErr("");
    try {
      const res = await adminListAgencyPackagePaymentRequests({ status: tab });
      const list = Array.isArray(res) ? res : res?.results || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load requests.";
      setErr(String(msg));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("PENDING");
  }, []);

  function fmtAmount(amt) {
    try {
      const n = Number(amt);
      if (!isFinite(n)) return `₹${String(amt ?? "")}`;
      return `₹${n.toLocaleString("en-IN")}`;
    } catch {
      return `₹${String(amt ?? "")}`;
    }
  }

  function fmtDate(ts) {
    try {
      if (!ts) return "—";
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return String(ts);
      return d.toLocaleString();
    } catch {
      return String(ts ?? "—");
    }
  }

  async function handleApprove(id) {
    const notes = window.prompt("Admin notes (optional):", "");
    try {
      await adminApproveAgencyPackagePaymentRequest(id, notes || "");
      try {
        alert("Approved.");
      } catch {}
      await load(statusTab);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to approve.";
      alert(String(msg));
    }
  }

  async function handleReject(id) {
    const notes = window.prompt("Reason / Admin notes (optional):", "");
    try {
      await adminRejectAgencyPackagePaymentRequest(id, notes || "");
      try {
        alert("Rejected.");
      } catch {}
      await load(statusTab);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to reject.";
      alert(String(msg));
    }
  }

  function TabButton({ tab, active, onClick }) {
    return (
      <button
        onClick={onClick}
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid " + (active ? "#0f172a" : "#e2e8f0"),
          background: active ? "#0f172a" : "#fff",
          color: active ? "#fff" : "#0f172a",
          cursor: "pointer",
          fontWeight: 800,
        }}
      >
        {tab}
      </button>
    );
  }

  function StatusBadge({ status }) {
    const s = String(status || "").toUpperCase();
    const bg =
      s === "APPROVED" ? "#DCFCE7" : s === "REJECTED" ? "#FEE2E2" : "#E0F2FE";
    const fg =
      s === "APPROVED" ? "#166534" : s === "REJECTED" ? "#991B1B" : "#075985";
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 800,
          background: bg,
          color: fg,
        }}
      >
        {s || "—"}
      </span>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Agency Prime Payment Requests</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Review agency-submitted payment requests for Prime packages. Approve to record a payment against the assignment.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <TabButton
          tab="Pending"
          active={statusTab === "PENDING"}
          onClick={() => {
            setStatusTab("PENDING");
            load("PENDING");
          }}
        />
        <TabButton
          tab="Approved"
          active={statusTab === "APPROVED"}
          onClick={() => {
            setStatusTab("APPROVED");
            load("APPROVED");
          }}
        />
        <TabButton
          tab="Rejected"
          active={statusTab === "REJECTED"}
          onClick={() => {
            setStatusTab("REJECTED");
            load("REJECTED");
          }}
        />
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={() => load(statusTab)}
            disabled={loading}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#FEF2F2",
            color: "#991B1B",
            border: "1px solid #FCA5A5",
          }}
        >
          {err}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: "#64748b" }}>Loading...</div>
      ) : (items || []).length === 0 ? (
        <div style={{ color: "#64748b" }}>No requests in this tab.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {(items || []).map((r) => {
            const pkgName =
              r?.package?.name ||
              r?.package?.code ||
              `#${r?.package?.id || ""}` ||
              "Prime Package";
            const proofUrl = r?.payment_proof_url || "";
            return (
              <div
                key={r.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  background: "#fff",
                  padding: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>{pkgName}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    Agency: <b>{r.agency_username || "—"}</b>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <StatusBadge status={r.status} />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <Info title="Amount" value={fmtAmount(r.amount)} />
                  <Info title="Method" value={r.method || "UPI"} />
                  <Info title="UTR / Ref" value={r.utr || "—"} />
                  <Info title="Requested At" value={fmtDate(r.created_at)} />
                  {r.approved_at ? (
                    <Info title="Actioned At" value={fmtDate(r.approved_at)} />
                  ) : null}
                  {r.admin_notes ? (
                    <Info title="Admin Notes" value={r.admin_notes} />
                  ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {proofUrl ? (
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: "#0f172a", textDecoration: "underline" }}
                    >
                      View Payment Proof
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: "#64748b" }}>No proof uploaded</span>
                  )}

                  {String(statusTab) === "PENDING" ? (
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleApprove(r.id)}
                        style={{
                          padding: "8px 12px",
                          background: "#16a34a",
                          color: "#fff",
                          border: 0,
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        style={{
                          padding: "8px 12px",
                          background: "#991B1B",
                          color: "#fff",
                          border: 0,
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ title, value }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "8px 10px",
        background: "#f8fafc",
        minHeight: 56,
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b" }}>{title}</div>
      <div
        style={{
          fontSize: 13,
          color: "#0f172a",
          fontWeight: 700,
          whiteSpace: "normal",
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}
