import React from "react";
import API from "../../../api/api";

export default function AgencyPackageCardsPanel({ open, onClose, agencyId, username }) {
  // Assigned package cards for this agency (assignments)
  const [cards, setCards] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Catalog of eligible packages for this agency (admin override)
  const [catalog, setCatalog] = React.useState([]);
  const [catLoading, setCatLoading] = React.useState(false);
  const [catError, setCatError] = React.useState("");

  // Assign in-flight
  const [assigningId, setAssigningId] = React.useState(null);

  // Payment modal state
  const [payOpen, setPayOpen] = React.useState(false);
  const [payForm, setPayForm] = React.useState({ assignmentId: null, amount: "", reference: "", notes: "", title: "" });
  const [payErr, setPayErr] = React.useState("");

  const statusBg = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "inactive") return "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
    if (s === "partial") return "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)";
    return "linear-gradient(135deg, #10b981 0%, #059669 100%)";
  };

  const loadCatalog = React.useCallback(async () => {
    if (!open || !agencyId) return;
    try {
      setCatLoading(true);
      setCatError("");
      const res = await API.get("/business/agency-packages/catalog/", {
        params: { agency_id: agencyId },
        retryAttempts: 1,
        cacheTTL: 5000,
      });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setCatalog(arr || []);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load catalog.";
      setCatError(String(msg));
      setCatalog([]);
    } finally {
      setCatLoading(false);
    }
  }, [open, agencyId]);

  const loadCards = React.useCallback(async () => {
    if (!open || !agencyId) return;
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/business/agency-packages/", {
        params: { agency_id: agencyId },
        retryAttempts: 1,
      });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setCards(arr || []);
      // If no assignments yet, also fetch catalog so admin can assign directly
      if (!arr || arr.length === 0) {
        await loadCatalog();
      }
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load packages.";
      setError(String(msg));
      setCards([]);
      // Try loading catalog even if assignments failed (best effort)
      try {
        await loadCatalog();
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  }, [open, agencyId, loadCatalog]);

  React.useEffect(() => {
    if (open) {
      // Reset any stale state when opening for a different user
      setError("");
      setCatError("");
      setCards([]);
      setCatalog([]);
      loadCards();
    }
  }, [open, agencyId, loadCards]);

  const openPay = (assignmentId, title) => {
    setPayErr("");
    setPayForm({ assignmentId, amount: "", reference: "", notes: "", title });
    setPayOpen(true);
  };

  const submitPay = async () => {
    setPayErr("");
    const amt = Number(payForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPayErr("Enter a valid amount greater than 0.");
      return;
    }
    try {
      await API.post(`/business/agency-packages/${payForm.assignmentId}/payments/`, {
        amount: amt,
        reference: payForm.reference || "",
        notes: payForm.notes || "",
      });
      setPayOpen(false);
      await loadCards();
      // Optional: toast/alert
      try {
        window.alert("Payment recorded.");
      } catch {}
    } catch (e) {
      const data = e?.response?.data;
      const msg =
        (data && typeof data === "object" && Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ")) ||
        e?.message ||
        "Failed to add payment.";
      setPayErr(String(msg));
    }
  };

  const assignPackage = async (pkgId) => {
    if (!agencyId || !pkgId) return;
    try {
      setAssigningId(pkgId);
      await API.post("/business/admin/agency-packages/assign/", {
        agency_id: agencyId,
        package_id: pkgId,
      });
      // After assignment, reload cards; they should now appear and replace the catalog view
      await loadCards();
      try {
        window.alert("Package assigned.");
      } catch {}
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to assign package.";
      setCatError(String(msg));
    } finally {
      setAssigningId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      aria-label="Agency Packages Drawer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        pointerEvents: "auto",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
        }}
      />
      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(520px, 95vw)",
          background: "#ffffff",
          borderLeft: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 24px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            Packages â€” {username ? `${username}` : ""}{agencyId ? ` (#${agencyId})` : ""}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
            title="Close"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 12, overflow: "auto", flex: 1 }}>
          {/* Assigned package cards (if any) */}
          {loading ? (
            <div style={{ color: "#64748b" }}>Loading packages...</div>
          ) : error ? (
            <div style={{ color: "#dc2626" }}>{error}</div>
          ) : (cards || []).length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {(cards || []).map((p) => {
                const st = String(p.status || "").toLowerCase();
                const inactive = st === "inactive";
                const bg = statusBg(st);
                const color = inactive ? "#fff" : "#0f172a";
                const title = p?.package?.name || p?.package?.code || "Package";
                const mark = inactive ? "âœ—" : "âœ“";
                const stText = inactive ? "Inactive" : st === "partial" ? "Partial" : "Active";
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: bg,
                      color,
                      boxShadow: "0 6px 14px rgba(0,0,0,0.10)",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 900 }}>{title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800 }}>
                        <span>{mark}</span>
                        <span>{stText}</span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.15)" }}>
                        <div style={{ fontSize: 12, opacity: 0.9, color: inactive ? "#f1f5f9" : "#0f172a" }}>Amount</div>
                        <div style={{ fontWeight: 900, color: inactive ? "#fff" : "#0f172a" }}>â‚¹{p.total_amount || "0.00"}</div>
                      </div>
                      <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.15)" }}>
                        <div style={{ fontSize: 12, opacity: 0.9, color: inactive ? "#f1f5f9" : "#0f172a" }}>Paid</div>
                        <div style={{ fontWeight: 900, color: inactive ? "#fff" : "#0f172a" }}>â‚¹{p.paid_amount || "0.00"}</div>
                      </div>
                      <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.15)" }}>
                        <div style={{ fontSize: 12, opacity: 0.9, color: inactive ? "#f1f5f9" : "#0f172a" }}>Remaining</div>
                        <div style={{ fontWeight: 900, color: inactive ? "#fff" : "#0f172a" }}>â‚¹{p.remaining_amount || "0.00"}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        Renewal: {typeof p.months_remaining === "number" ? `${p.months_remaining} month${p.months_remaining === 1 ? "" : "s"} remaining` : "â€”"}
                      </div>
                      <button
                        onClick={() => openPay(p.id, title)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #1d4ed8",
                          background: "#2563eb",
                          color: "#fff",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                        title="Record a payment for this package"
                      >
                        Add Payment
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // No assignments â€” show catalog so admin can assign directly
            <div>
              <div style={{ marginBottom: 8, color: "#64748b" }}>No package assigned for this agency.</div>
              {catLoading ? (
                <div style={{ color: "#64748b" }}>Loading eligible packagesâ€¦</div>
              ) : catError ? (
                <div style={{ color: "#dc2626" }}>{catError}</div>
              ) : (catalog || []).length === 0 ? (
                <div style={{ color: "#64748b" }}>No eligible packages found for this agency's category.</div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  {(catalog || []).map((c) => {
                    const assigned = !!c.assigned;
                    const amt = c.amount ? `â‚¹${c.amount}` : "â€”";
                    return (
                      <div
                        key={c.id}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          background: "#f8fafc",
                          color: "#0f172a",
                          boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ fontWeight: 900 }}>{c.name || c.code || `#${c.id}`}</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{amt}</div>
                        </div>
                        {c.description ? (
                          <div style={{ fontSize: 12, color: "#334155" }}>{c.description}</div>
                        ) : null}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                          <button
                            onClick={() => assignPackage(c.id)}
                            disabled={assigned || assigningId === c.id}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #0284c7",
                              background: assigned ? "#94a3b8" : "#0ea5e9",
                              color: "#fff",
                              fontWeight: 800,
                              cursor: assigned || assigningId === c.id ? "not-allowed" : "pointer",
                            }}
                            title={assigned ? "Already assigned" : "Assign this package to the agency"}
                          >
                            {assigned ? "Assigned" : assigningId === c.id ? "Assigningâ€¦" : "Assign"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 10,
            borderTop: "1px solid #e2e8f0",
            background: "#fff",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={loadCards}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Payment modal */}
      {payOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 90,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              width: 420,
              maxWidth: "95vw",
              padding: 16,
              boxShadow: "0 12px 24px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
              Add Payment â€” {payForm.title || ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#64748b" }}>Amount *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                  style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#64748b" }}>Reference</label>
                <input
                  type="text"
                  value={payForm.reference}
                  onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g., NEFT #123"
                  style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#64748b" }}>Notes</label>
                <textarea
                  value={payForm.notes}
                  onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, resize: "vertical" }}
                />
              </div>
              {payErr ? (
                <div style={{ color: "#dc2626", fontSize: 12 }}>{payErr}</div>
              ) : (
                <div style={{ fontSize: 12, color: "transparent" }}>.</div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setPayOpen(false)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitPay}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #1d4ed8", background: "#2563eb", color: "#fff", fontWeight: 800, cursor: "pointer" }}
                >
                  Add Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

