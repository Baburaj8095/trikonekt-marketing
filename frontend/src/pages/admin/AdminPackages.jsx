import React from "react";
import API from "../../api/api";
import ModelListSimple from "../../admin-panel/dynamic/ModelListSimple";

function Section({ title, children, right }) {
  return (
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
          padding: "10px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, color: "#0f172a" }}>{title}</div>
        {right || null}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

export default function AdminPackages() {
  const tabs = [
    { key: "packages", label: "Packages", app: "business", model: "package" },
    { key: "assignments", label: "Assignments", app: "business", model: "agencypackageassignment" },
    { key: "payments", label: "Payments", app: "business", model: "agencypackagepayment" },
  ];
  const [active, setActive] = React.useState(tabs[0].key);

  const activeTab = React.useMemo(() => tabs.find((t) => t.key === active) || tabs[0], [active]);

  // Agency Package Cards (Admin view)
  const [agencyQuery, setAgencyQuery] = React.useState("");
  const [resolvedAgency, setResolvedAgency] = React.useState(null);
  const [pkgCards, setPkgCards] = React.useState([]);
  const [cardsLoading, setCardsLoading] = React.useState(false);
  const [cardsError, setCardsError] = React.useState("");

  // Payment modal state
  const [payOpen, setPayOpen] = React.useState(false);
  const [payForm, setPayForm] = React.useState({ assignmentId: null, amount: "", reference: "", notes: "", title: "" });
  const [payErr, setPayErr] = React.useState("");

  const resolveAgencyId = async (q) => {
    const s = String(q || "").trim();
    if (!s) throw new Error("Enter agency username or numeric ID");
    if (/^\d+$/.test(s)) return { id: Number(s), username: s };
    // Resolve by username using Admin Users endpoint
    const res = await API.get("/admin/users/", { params: { search: s, role: "agency", page_size: 10 } });
    const data = res?.data;
    const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    if (!results.length) throw new Error("Agency not found");
    // Prefer exact username match (case-insensitive), else first result
    const exact = results.find((u) => String(u.username || "").toLowerCase() === s.toLowerCase());
    const picked = exact || results[0];
    if (!picked?.id) throw new Error("Agency not found");
    return { id: picked.id, username: picked.username || s };
  };

  const loadAgencyCards = async () => {
    try {
      setCardsLoading(true);
      setCardsError("");
      const found = await resolveAgencyId(agencyQuery);
      const id = found.id;
      setResolvedAgency(found);
      const res = await API.get("/business/agency-packages/", { params: { agency_id: id }, retryAttempts: 1 });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setPkgCards(arr || []);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load packages";
      setCardsError(msg);
      setPkgCards([]);
    } finally {
      setCardsLoading(false);
    }
  };

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
      await loadAgencyCards();
    } catch (e) {
      const data = e?.response?.data;
      const msg =
        (data && typeof data === "object" && Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("; ")) ||
        e?.message ||
        "Failed to add payment.";
      setPayErr(msg);
    }
  };

  const statusBg = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "inactive") return "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
    if (s === "partial") return "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)";
    return "linear-gradient(135deg, #10b981 0%, #059669 100%)";
  };

  return (
    <div>
      {/* Heading */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Packages</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Create and manage Packages (amounts are defined here), assign them to Agencies, and record payments.
        </div>
      </div>

      {/* Agency Package Cards (Admin) */}
      <Section
        title="Agency Package Cards"
        right={
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Enter an agency username or numeric ID to view their package status cards.
          </div>
        }
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Agency username or ID"
            value={agencyQuery}
            onChange={(e) => setAgencyQuery(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              minWidth: 220,
              outline: "none",
            }}
          />
          <button
            onClick={loadAgencyCards}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #93c5fd",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Load
          </button>
          {resolvedAgency ? (
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Showing for ID #{resolvedAgency.id} ({resolvedAgency.username})
            </div>
          ) : null}
        </div>

        {cardsLoading ? (
          <div style={{ color: "#64748b" }}>Loading packages...</div>
        ) : cardsError ? (
          <div style={{ color: "#dc2626" }}>{cardsError}</div>
        ) : (pkgCards || []).length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              alignItems: "stretch",
              minWidth: 0,
              width: "100%",
            }}
          >
            {(pkgCards || []).map((p) => {
              const st = String(p.status || "").toLowerCase();
              const inactive = st === "inactive";
              const bg = statusBg(st);
              const color = inactive ? "#fff" : "#0f172a";
              const title = p?.package?.name || p?.package?.code || "Package";
              const mark = inactive ? "✗" : "✓";
              const stText = inactive ? "Inactive" : st === "partial" ? "Partial" : "Active";
              return (
                <div
                  key={p.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: bg,
                    color,
                    boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxSizing: "border-box",
                    minWidth: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0, flexWrap: "wrap", width: "100%" }}>
                    <div style={{ fontWeight: 900 }}>{title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800 }}>
                      <span>{mark}</span>
                      <span>{stText}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.15)" }}>
                      <div style={{ fontSize: 12, opacity: 0.9, color: inactive ? "#f1f5f9" : "#0f172a" }}>Amount</div>
                      <div style={{ fontWeight: 900, color: inactive ? "#fff" : "#0f172a" }}>₹{p.total_amount || "0.00"}</div>
                    </div>
                    <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.15)" }}>
                      <div style={{ fontSize: 12, opacity: 0.9, color: inactive ? "#f1f5f9" : "#0f172a" }}>Paid</div>
                      <div style={{ fontWeight: 900, color: inactive ? "#fff" : "#0f172a" }}>₹{p.paid_amount || "0.00"}</div>
                    </div>
                    <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.15)" }}>
                      <div style={{ fontSize: 12, opacity: 0.9, color: inactive ? "#f1f5f9" : "#0f172a" }}>Remaining</div>
                      <div style={{ fontWeight: 900, color: inactive ? "#fff" : "#0f172a" }}>₹{p.remaining_amount || "0.00"}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      Renewal: {typeof p.months_remaining === "number" ? `${p.months_remaining} month${p.months_remaining === 1 ? "" : "s"} remaining` : "—"}
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
          <div style={{ color: "#64748b" }}>No package assigned for this agency.</div>
        )}
      </Section>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Packages navigation"
        style={{
          display: "inline-flex",
          gap: 6,
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          background: "#fff",
          padding: 6,
          marginBottom: 12,
        }}
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid " + (isActive ? "#93c5fd" : "transparent"),
                background: isActive ? "#eff6ff" : "transparent",
                color: isActive ? "#1d4ed8" : "#0f172a",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active view */}
      <Section
        title={`${activeTab.label}`}
        right={
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {activeTab.key === "packages"
              ? "Define package name, code, and amount here. Toggle default to auto‑assign to agencies."
              : activeTab.key === "assignments"
              ? "Assign packages to agencies. One (agency, package) per row."
              : "Record payments for a specific assignment (amount, reference, notes)."}
          </div>
        }
      >
        <ModelListSimple app={activeTab.app} model={activeTab.model} />
      </Section>

      {/* Helpful guidance */}
      <Section title="How this appears to Agencies">
        <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", lineHeight: 1.6 }}>
          <li>The Agency Dashboard shows assigned Packages as cards with Amount, Paid, and Remaining.</li>
          <li>Status shows:
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Inactive (✗) when paid amount is 0</li>
              <li>Partial (✓) when paid is greater than 0 but less than total</li>
              <li>Active (✓) when fully paid</li>
            </ul>
          </li>
          <li>Admins set package amounts here and can add payments under the Payments tab or via inline forms.</li>
        </ul>
      </Section>

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
            zIndex: 50,
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
              Add Payment — {payForm.title || ""}
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
