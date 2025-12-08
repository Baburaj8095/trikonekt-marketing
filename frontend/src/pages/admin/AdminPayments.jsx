import React, { useEffect, useState } from "react";
import API from "../../api/api";
import normalizeMediaUrl from "../../utils/media";

/**
 * AdminPayments
 * Minimal, dedicated screen to configure a single global payment method (UPI QR)
 * used across:
 *  - Cart
 *  - Checkout
 *  - E‑Coupon Store
 */
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

function Section({ title, children, extraRight }) {
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
        {extraRight || null}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

export default function AdminPayments() {
  // Existing payment configs
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create form
  const [form, setForm] = useState({
    title: "",
    upi_id: "",
    payee_name: "",
    instructions: "",
    file: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/coupons/store/payment-configs/", { params: { page_size: 100 } });
      const list = res?.data?.results || res?.data || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr("Failed to load payment configs");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setSubmitting(true);
    setErr("");
    try {
      const fd = new FormData();
      if (form.title) fd.append("title", form.title);
      if (form.upi_id) fd.append("upi_id", form.upi_id);
      if (form.payee_name) fd.append("payee_name", form.payee_name);
      if (form.instructions) fd.append("instructions", form.instructions);
      if (form.file) fd.append("upi_qr_image", form.file);
      await API.post("/coupons/store/payment-configs/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({ title: "", upi_id: "", payee_name: "", instructions: "", file: null });
      await load();
      try { alert("Payment config saved."); } catch {}
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to save";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function setActive(id) {
    try {
      await API.post(`/coupons/store/payment-configs/${id}/set-active/`, {});
      await load();
      try { alert("Active payment config set."); } catch {}
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to set active";
      setErr(msg);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Payment Configure</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Configure a global UPI payment method. The active configuration will be shown in Cart, Checkout, and E‑Coupon store.
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

      <Section
        title="Add / Update Payment Method"
        extraRight={
          <button
            onClick={create}
            disabled={submitting}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: submitting ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <TextInput
            label="Title"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder="e.g., UPI Payments"
          />
          <TextInput
            label="UPI ID"
            value={form.upi_id}
            onChange={(v) => setForm((f) => ({ ...f, upi_id: v }))}
            placeholder="payee@upi"
          />
          <TextInput
            label="Payee Name"
            value={form.payee_name}
            onChange={(v) => setForm((f) => ({ ...f, payee_name: v }))}
            placeholder="Company Pvt Ltd"
          />
          <TextInput
            label="Instructions"
            value={form.instructions}
            onChange={(v) => setForm((f) => ({ ...f, instructions: v }))}
            placeholder="Steps for payment (optional)"
          />
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>QR Image</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setForm((f) => ({ ...f, file: e.target.files && e.target.files[0] ? e.target.files[0] : null }))
              }
            />
            {form.file ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{form.file.name}</div> : null}
          </div>
        </div>
      </Section>

      <Section
        title="Existing Configurations"
        extraRight={
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        {loading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (items || []).length === 0 ? (
          <div style={{ color: "#64748b" }}>No payment configs found.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {(items || []).map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 8,
                  background: "#fff",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {c.upi_qr_image_url ? (
                    <img
                      alt="QR"
                      src={normalizeMediaUrl(c.upi_qr_image_url)}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <div style={{ fontSize: 10, color: "#64748b", padding: 4, textAlign: "center" }}>No QR</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>{c.title || `#${c.id}`}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{c.payee_name || "—"}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{c.upi_id || ""}</div>
                </div>
                <div style={{ color: "#64748b", fontSize: 12, maxWidth: "100%", whiteSpace: "normal", wordBreak: "break-word", overflow: "visible", textOverflow: "clip", flex: "1 1 240px" }}>
                  {c.instructions || "—"}
                </div>
                <div style={{ color: c.is_active ? "#16a34a" : "#64748b", fontWeight: 700, marginLeft: 8 }}>
                  {c.is_active ? "ACTIVE" : "INACTIVE"}
                </div>
                <div style={{ marginLeft: "auto" }}>
                  {!c.is_active ? (
                    <button
                      onClick={() => setActive(c.id)}
                      style={{
                        padding: "6px 10px",
                        background: "#0f172a",
                        color: "#fff",
                        border: 0,
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Set Active
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
