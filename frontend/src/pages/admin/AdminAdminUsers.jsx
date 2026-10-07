import React from "react";
import API from "../../api/api";
import RequirePermission from "../../components/admin/RequirePermission";

function Field({ label, children, hint }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 10, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: "#94a3b8" }}>{hint}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 16 }}>{title}</div>
          <button
            onClick={onClose}
            style={{ border: 0, background: "transparent", color: "#64748b", fontSize: 20, cursor: "pointer", fontWeight: 700, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20, maxHeight: "75vh", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

export default function AdminAdminUsers() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [rows, setRows] = React.useState([]);
  const [roles, setRoles] = React.useState([]);

  // Create Modal state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    is_superuser: true,
    role: "Super Admin",
  });
  const [createErr, setCreateErr] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Edit Modal state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState(null);
  const [editForm, setEditForm] = React.useState({
    full_name: "",
    email: "",
    phone: "",
    role: "Super Admin",
    password: "",
  });
  const [editErr, setEditErr] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Load roles
  const loadRoles = React.useCallback(async () => {
    try {
      const res = await API.get("admin/roles/", { timeout: 8000, retryAttempts: 0 });
      const items = Array.isArray(res?.data) ? res.data : [];
      setRoles(items);
    } catch {
      setRoles([]);
    }
  }, []);

  // Load staff admin users
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("admin/users/", {
        params: { admin_only: 1, search: search || undefined },
        timeout: 8000,
        retryAttempts: 1,
      });
      const results = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
      setRows(results);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to load sub-admin accounts";
      setError(String(msg));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  React.useEffect(() => {
    const t = setTimeout(loadData, 300);
    return () => clearTimeout(t);
  }, [loadData]);

  // Toggle Live/Active
  async function toggleLive(row) {
    try {
      if (!row?.id) return;
      const active = !!row.is_active;
      if (active) {
        await API.post(`admin/users/${row.id}/deactivate/`, {});
      } else {
        await API.post(`admin/users/${row.id}/activate/`, {});
      }
      setNotice(active ? `Account @${row.username} deactivated.` : `Account @${row.username} activated.`);
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Operation failed";
      setError(String(msg));
    }
  }

  // Reset 2FA
  async function reset2FA(row) {
    if (!window.confirm(`Are you sure you want to reset 2FA for @${row.username}? They will be prompted to scan a new Google Authenticator QR code upon next login.`)) {
      return;
    }
    try {
      await API.post("admin/login/2fa/reset/", { username: row.username });
      setNotice(`2FA reset successfully for @${row.username}. User can scan a fresh QR code on next login.`);
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to reset 2FA";
      setError(String(msg));
    }
  }

  // Delete Sub-Admin
  async function deleteAdmin(row) {
    if (row.username === "admin") {
      alert("Root company super admin account cannot be deleted.");
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently remove admin account @${row.username}? This action cannot be undone.`)) {
      return;
    }
    try {
      await API.delete(`admin/users/${row.id}/`);
      setNotice(`Admin account @${row.username} deleted.`);
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to delete user";
      setError(String(msg));
    }
  }

  // Open Edit
  function openEdit(row) {
    setEditRow(row);
    setEditErr("");
    setEditForm({
      full_name: row?.full_name || "",
      email: row?.email || "",
      phone: row?.phone || "",
      role: row?.role || "Super Admin",
      password: "",
    });
    setEditOpen(true);
  }

  // Save Edit
  async function saveEdit() {
    if (!editRow?.id) return;
    setEditErr("");
    setSaving(true);
    try {
      const payload = {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
      };
      if (editForm.password && editForm.password.trim().length >= 8) {
        payload.password = editForm.password.trim();
      }
      await API.patch(`admin/users/${editRow.id}/`, payload);
      setEditOpen(false);
      setNotice(`Sub-admin @${editRow.username} updated successfully.`);
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Update failed";
      setEditErr(String(msg));
    } finally {
      setSaving(false);
    }
  }

  // Create Sub-Admin
  async function createSubAdmin() {
    setCreateErr("");
    const username = String(createForm.username || "").trim().toLowerCase();
    const password = String(createForm.password || "").trim();
    if (!username) {
      setCreateErr("Username is required.");
      return;
    }
    if (!password || password.length < 8) {
      setCreateErr("Password must be at least 8 characters.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        username,
        password,
        full_name: String(createForm.full_name || "").trim() || username,
        email: String(createForm.email || "").trim(),
        phone: String(createForm.phone || "").trim(),
        role: createForm.role || "Super Admin",
        is_superuser: createForm.is_superuser,
      };
      await API.post("admin/users/", payload);
      setCreateOpen(false);
      setCreateForm({
        full_name: "",
        username: "",
        email: "",
        phone: "",
        password: "",
        is_superuser: true,
        role: "Super Admin",
      });
      setNotice(`New Sub-Admin @${username} created! They can now log in and set up Google Authenticator 2FA.`);
      loadData();
    } catch (e) {
      const data = e?.response?.data;
      let msg = "Create failed";
      if (typeof data === "object") {
        const errors = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ");
        if (errors) msg = errors;
      } else if (e?.message) {
        msg = e.message;
      }
      setCreateErr(msg);
    } finally {
      setCreating(false);
    }
  }

  // Stats
  const totalCount = rows.length;
  const activeCount = rows.filter((r) => r.is_active).length;
  const totpCount = rows.filter((r) => r.totp_enabled).length;

  return (
    <RequirePermission anyOf={["manage_users", "show_users"]}>
      <div style={{ padding: "0 4px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: "#0f172a", fontWeight: 900, fontSize: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🛡️</span> Sub-Admin & Staff Management
            </h2>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 2 }}>
              Dedicated administrative portal credentials with Google Authenticator (TOTP 2FA).
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search by name, username, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                minWidth: 260,
                background: "#fff",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => {
                setCreateErr("");
                setCreateOpen(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
              }}
            >
              <span>+</span> Add Sub-Admin
            </button>
          </div>
        </div>

        {/* KPI Stats Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "#fff", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#2563eb" }}>
              👥
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Sub-Admins</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{totalCount}</div>
            </div>
          </div>
          <div style={{ background: "#fff", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#16a34a" }}>
              ✅
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Accounts</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#16a34a" }}>{activeCount}</div>
            </div>
          </div>
          <div style={{ background: "#fff", padding: "12px 16px", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#059669" }}>
              🔐
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>2FA Protected</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#059669" }}>{totpCount} of {totalCount}</div>
            </div>
          </div>
        </div>

        {/* Notices */}
        {error ? (
          <div style={{ marginBottom: 12, padding: "10px 14px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        ) : null}
        {notice ? (
          <div style={{ marginBottom: 12, padding: "10px 14px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 8, fontSize: 13 }}>
            {notice}
          </div>
        ) : null}

        {/* Table */}
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 2fr 1.2fr 1.2fr 1fr 1.6fr", gap: 0, padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 800, color: "#334155", fontSize: 12, letterSpacing: "0.03em" }}>
            <div>NAME / USERNAME</div>
            <div>EMAIL & PHONE</div>
            <div>ROLE</div>
            <div>2FA TOTP</div>
            <div>STATUS</div>
            <div style={{ textAlign: "right" }}>ACTIONS</div>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 14 }}>Loading admin users...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 14 }}>No sub-admin accounts found. Click "+ Add Sub-Admin" to create one.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.8fr 2fr 1.2fr 1.2fr 1fr 1.6fr",
                  gap: 0,
                  padding: "12px 16px",
                  borderTop: "1px solid #f1f5f9",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{r.full_name || r.username}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f1f5f9", padding: "1px 6px", borderRadius: 4, fontSize: 11, color: "#475569", marginTop: 2, fontFamily: "monospace" }}>
                    @{r.username}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#334155" }}>{r.email || <span style={{ color: "#94a3b8" }}>No email</span>}</div>
                  {r.phone ? <div style={{ fontSize: 11, color: "#64748b" }}>📞 {r.phone}</div> : null}
                </div>

                <div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      background: r.is_superuser || r.role === "Super Admin" ? "#eff6ff" : "#f1f5f9",
                      color: r.is_superuser || r.role === "Super Admin" ? "#1d4ed8" : "#475569",
                      border: r.is_superuser || r.role === "Super Admin" ? "1px solid #bfdbfe" : "1px solid #cbd5e1",
                    }}
                  >
                    {r.is_superuser || r.role === "Super Admin" ? "⭐ Super Admin" : r.role || "Custom Admin"}
                  </span>
                </div>

                <div>
                  {r.totp_enabled ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#16a34a", fontWeight: 800, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
                      Enabled
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#d97706", fontWeight: 800, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706" }} />
                      Not Setup
                    </span>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => toggleLive(r)}
                    style={{
                      borderRadius: 6,
                      padding: "3px 8px",
                      background: r.is_active ? "#ecfdf5" : "#fef2f2",
                      color: r.is_active ? "#059669" : "#dc2626",
                      border: r.is_active ? "1px solid #a7f3d0" : "1px solid #fecaca",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                    title={r.is_active ? "Click to Deactivate" : "Click to Activate"}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      color: "#334155",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    title="Edit Sub-Admin Details"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => reset2FA(r)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      color: "#92400e",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    title="Reset Google Authenticator 2FA Key"
                  >
                    🔐 Reset 2FA
                  </button>
                  {r.username !== "admin" ? (
                    <button
                      type="button"
                      onClick={() => deleteAdmin(r)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: "#fff1f2",
                        border: "1px solid #fecdd3",
                        color: "#be123c",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      title="Delete Sub-Admin"
                    >
                      🗑️
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Create Sub-Admin */}
        <Modal open={createOpen} title="Create New Sub-Admin" onClose={() => setCreateOpen(false)}>
          {createErr ? (
            <div style={{ marginBottom: 14, padding: "8px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
              {createErr}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Full Name" hint="Display Name">
              <input
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Xavier Prakash"
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>
            <Field label="Username" hint="Unique Login ID">
              <input
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                placeholder="e.g. xavier"
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13, fontFamily: "monospace" }}
              />
            </Field>
            <Field label="Email Address">
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. xavier@trikonekt.in"
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>
            <Field label="Phone Number">
              <input
                type="tel"
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. +91 9876543210"
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>
            <Field label="Password" hint="Min 8 characters">
              <input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••••••"
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>
            <Field label="Access Tier">
              <div style={{ display: "flex", gap: 16 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={createForm.is_superuser}
                    onChange={() => setCreateForm((f) => ({ ...f, is_superuser: true, role: "Super Admin" }))}
                  />
                  Super Admin (Full Access)
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="radio"
                    checked={!createForm.is_superuser}
                    onChange={() => setCreateForm((f) => ({ ...f, is_superuser: false, role: "Custom Admin" }))}
                  />
                  Custom Role
                </label>
              </div>
            </Field>

            {!createForm.is_superuser ? (
              <Field label="Role Name">
                <input
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Support Admin / Finance Admin"
                  style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
                />
              </Field>
            ) : null}

            <div style={{ padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#166534" }}>
              💡 <strong>Security Note:</strong> The user will be required to configure their personal Google Authenticator 2FA upon their initial login.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={createSubAdmin}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: creating ? "not-allowed" : "pointer",
                  fontSize: 13,
                }}
              >
                {creating ? "Creating..." : "Create Account"}
              </button>
            </div>
          </div>
        </Modal>

        {/* Modal: Edit Sub-Admin */}
        <Modal open={editOpen} title={`Edit Sub-Admin (@${editRow?.username})`} onClose={() => setEditOpen(false)}>
          {editErr ? (
            <div style={{ marginBottom: 14, padding: "8px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
              {editErr}
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Full Name">
              <input
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>
            <Field label="Email Address">
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>
            <Field label="Phone Number">
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>
            <Field label="Role">
              <input
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Super Admin / Finance"
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>
            <Field label="New Password" hint="Optional">
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to keep unchanged"
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", fontSize: 13 }}
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveEdit}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: 13,
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </RequirePermission>
  );
}
