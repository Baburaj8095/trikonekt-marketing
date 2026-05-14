import React from "react";
import API from "../../api/api";
import RequirePermission from "../../components/admin/RequirePermission";

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
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
        background: "rgba(15,23,42,0.35)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 760, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", background: "#f8fafc", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>{title}</div>
        </div>
        <div style={{ padding: 12 }}>{children}</div>
        <div style={{ padding: 12, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
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
  const [permissions, setPermissions] = React.useState([]);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    username: "",
    email: "",
    password: "",
    access_type: "custom",
    role_id: "",
    permission_ids: [],
  });
  const [createErr, setCreateErr] = React.useState("");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState(null);
  const [editForm, setEditForm] = React.useState({ email: "", password: "", role_id: "" });
  const [editErr, setEditErr] = React.useState("");
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewRow, setViewRow] = React.useState(null);

  // Load roles for dropdowns
  const loadRoles = React.useCallback(async () => {
    try {
      const res = await API.get("admin/roles/", { timeout: 8000, retryAttempts: 0 });
      const items = Array.isArray(res?.data) ? res.data : [];
      setRoles(items);
    } catch {
      setRoles([]);
    }
  }, []);

  const loadPermissions = React.useCallback(async () => {
    try {
      const res = await API.get("admin/permissions/", { timeout: 8000, retryAttempts: 0 });
      setPermissions(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setPermissions([]);
    }
  }, []);

  // Load admin users (staff only) using admin list API with large page_size
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("admin/users/", {
        params: { page: 1, page_size: 50, admin_only: 1, search: search || undefined },
        timeout: 8000,
        retryAttempts: 1,
        dedupe: "cancelPrevious",
      });
      const results = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
      setRows(results.filter((r) => r && r.username));
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to load admin users";
      setError(String(msg));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    loadRoles();
    loadPermissions();
  }, [loadRoles, loadPermissions]);

  const permissionsByModule = React.useMemo(() => {
    const grouped = {};
    permissions.forEach((p) => {
      const moduleName = p.module || String(p.code || "").split(".")[0] || "Other";
      (grouped[moduleName] = grouped[moduleName] || []).push(p);
    });
    return Object.keys(grouped)
      .sort()
      .map((name) => ({ name, items: grouped[name].sort((a, b) => String(a.code).localeCompare(String(b.code))) }));
  }, [permissions]);

  function toggleCreatePermission(permissionId) {
    const pid = Number(permissionId);
    setCreateForm((f) => {
      const current = Array.isArray(f.permission_ids) ? f.permission_ids : [];
      return {
        ...f,
        permission_ids: current.includes(pid) ? current.filter((x) => x !== pid) : [...current, pid],
      };
    });
  }

  React.useEffect(() => {
    const t = setTimeout(loadData, 300);
    return () => clearTimeout(t);
  }, [loadData]);

  function roleNameOf(row) {
    try {
      const r = row?.admin_role;
      if (!r) return "";
      return r.name || "";
    } catch {
      return "";
    }
  }

  async function toggleLive(row) {
    try {
      if (!row?.id) return;
      const active = !!row.is_active;
      if (active) {
        await API.post(`admin/users/${row.id}/deactivate/`, {});
      } else {
        await API.post(`admin/users/${row.id}/activate/`, {});
      }
      setNotice(active ? "User deactivated." : "User activated.");
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Operation failed";
      setError(String(msg));
    }
  }

  async function assignRole(userId, roleId) {
    try {
      await API.post(`admin/users/${userId}/assign-role/`, { role_id: roleId ? Number(roleId) : null });
      setNotice("Role updated.");
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Role update failed";
      setError(String(msg));
    }
  }

  function openEdit(row) {
    setEditRow(row);
    setEditErr("");
    setEditForm({
      email: row?.email || "",
      password: "",
      role_id: row?.admin_role?.id || "",
    });
    setEditOpen(true);
  }

  async function openView(row) {
    if (!row?.id) return;
    setViewRow(null);
    setViewOpen(true);
    try {
      const res = await API.get(`admin/users/${row.id}/`, { timeout: 8000, retryAttempts: 0 });
      const data = res?.data || {};
      // Merge detail payload with list row to retain admin_role for display
      setViewRow({ ...row, ...data });
    } catch (e) {
      setViewRow(row || null);
    }
  }

  async function saveEdit() {
    if (!editRow?.id) return;
    setEditErr("");
    try {
      const payload = {};
      if (editForm.email && editForm.email !== editRow.email) payload.email = editForm.email;
      if (editForm.password && editForm.password.length >= 8) payload.password = editForm.password;
      if (Object.keys(payload).length) {
        await API.patch(`admin/users/${editRow.id}/`, payload);
      }
      // role via dedicated endpoint
      if (String(editForm.role_id || "") !== String(editRow?.admin_role?.id || "")) {
        await API.post(`admin/users/${editRow.id}/assign-role/`, { role_id: editForm.role_id ? Number(editForm.role_id) : null });
      }
      setEditOpen(false);
      setNotice("User updated.");
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Update failed";
      setEditErr(String(msg));
    }
  }

  async function createUser() {
    setCreateErr("");
    try {
      const username = String(createForm.username || "").trim();
      const password = String(createForm.password || "");
      if (!username) {
        setCreateErr("Username is required.");
        return;
      }
      if (!password || password.length < 8) {
        setCreateErr("Password must be at least 8 characters.");
        return;
      }
      let roleId = createForm.role_id ? Number(createForm.role_id) : null;
      if (createForm.access_type === "super") {
        const superRole = roles.find((r) => r.is_super);
        if (!superRole) {
          setCreateErr("Super Admin role is missing. Seed default permissions first.");
          return;
        }
        roleId = Number(superRole.id);
      } else {
        const selectedPermissionIds = Array.isArray(createForm.permission_ids) ? createForm.permission_ids : [];
        if (!roleId && selectedPermissionIds.length === 0) {
          setCreateErr("Select at least one screen/action permission for a custom admin.");
          return;
        }
        if (!roleId) {
          const roleName = `${username} Admin`;
          const roleRes = await API.post("admin/roles/", {
            name: roleName,
            description: `Custom admin access for ${username}`,
            is_super: false,
          });
          roleId = Number(roleRes?.data?.id);
          if (!roleId) throw new Error("Could not create custom role.");
        }
        if (selectedPermissionIds.length > 0) {
          await API.put(`admin/roles/${roleId}/permissions/`, selectedPermissionIds);
        }
      }
      const payload = {
        username,
        email: String(createForm.email || "").trim() || undefined,
        password,
        is_active: true,
        role_id: roleId,
      };
      await API.post("admin/users/", payload);
      setCreateOpen(false);
      setCreateForm({ username: "", email: "", password: "", access_type: "custom", role_id: "", permission_ids: [] });
      setNotice("Admin user created.");
      loadRoles();
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Create failed";
      setCreateErr(String(msg));
    }
  }

  return (
    <RequirePermission anyOf={["manage_users", "show_users"]}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: "#0f172a", fontWeight: 900, fontSize: 18 }}>Admin Users</h2>
            <div style={{ color: "#64748b", fontSize: 12 }}>Manage staff accounts with RBAC roles.</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search by name/username/email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, minWidth: 240, background: "#fff" }}
            />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
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
              Add New
            </button>
          </div>
        </div>

        {error ? (
          <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>
            {error}
          </div>
        ) : null}
        {notice ? (
          <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 8 }}>
            {notice}
          </div>
        ) : null}

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
<div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1.5fr 1fr 1fr 1fr", gap: 0, padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 800, color: "#0f172a", fontSize: 12 }}>
            <div>Name</div>
            <div>Email</div>
            <div>Username</div>
            <div>Role</div>
            <div>Live</div>
            <div>Date</div>
            <div>Action</div>
          </div>
          {loading ? (
            <div style={{ padding: 12 }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b" }}>No records.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                style={{
display: "grid",
                  gridTemplateColumns: "2fr 2fr 1.5fr 1.5fr 1fr 1fr 1fr",
                  gap: 0,
                  padding: "10px 12px",
                  borderTop: "1px solid #e2e8f0",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    title="Edit"
                    onClick={() => openEdit(r)}
                    style={{ background: "transparent", border: 0, color: "#0ea5e9", cursor: "pointer", padding: 0, fontWeight: 700 }}
                  >
                    {r.full_name || ""}
                  </button>
                </div>
                <div>{r.email || ""}</div>
                <div>{r.username || ""}</div>
                <div>
                  <select
                    value={r.admin_role?.id || ""}
                    onChange={(e) => assignRole(r.id, e.target.value)}
                    style={{ padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", minWidth: 160 }}
                    title="Assign role"
                  >
                    <option value=""> None </option>
                    {roles.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}{x.is_super ? " (SUPER)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => toggleLive(r)}
                    style={{
                      borderRadius: 8,
                      padding: "4px 10px",
                      background: r.is_active ? "#16a34a" : "#ef4444",
                      color: "#fff",
                      border: r.is_active ? "1px solid #15803d" : "1px solid #b91c1c",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                    title={r.is_active ? "Deactivate" : "Activate"}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
<div>
                  {r.date_joined ? (() => { try { return new Date(r.date_joined).toLocaleString(); } catch { return r.date_joined; } })() : ""}
                </div>
                <div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => openView(r)}
                      style={{ padding: "6px 10px", borderRadius: 8, background: "#e5e7eb", border: "1px solid #cbd5e1", color: "#0f172a", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                      title="View"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      style={{ padding: "6px 10px", borderRadius: 8, background: "#0ea5e9", border: "1px solid #0284c7", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                      title="Edit"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* View Admin User */}
      <Modal open={viewOpen} title="View Admin User" onClose={() => setViewOpen(false)}>
        <div style={{ display: "grid", gap: 10 }}>
          <Field label="Name">{(viewRow && (viewRow.full_name || [viewRow.first_name, viewRow.last_name].filter(Boolean).join(" "))) || ""}</Field>
          <Field label="Email">{viewRow?.email || ""}</Field>
          <Field label="Username">{viewRow?.username || ""}</Field>
          <Field label="Role">{(viewRow && viewRow.admin_role && viewRow.admin_role.name) ? viewRow.admin_role.name : ""}</Field>
          <Field label="Active">{viewRow?.is_active ? "Yes" : "No"}</Field>
          <Field label="Date">
            {viewRow?.date_joined ? (() => { try { return new Date(viewRow.date_joined).toLocaleString(); } catch { return String(viewRow.date_joined); } })() : ""}
          </Field>
        </div>
      </Modal>

      {/* Create Admin User */}
      <Modal open={createOpen} title="Create Admin User" onClose={() => setCreateOpen(false)}>
        {createErr ? (
          <div style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>
            {createErr}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 10 }}>
          <Field label="Username">
            <input
              value={createForm.username}
              onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: "100%" }}
            />
          </Field>
          <Field label="Email">
            <input
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: "100%" }}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: "100%" }}
              placeholder="Min 8 characters"
            />
          </Field>
          <Field label="Access">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                <input
                  type="radio"
                  checked={createForm.access_type === "custom"}
                  onChange={() => setCreateForm((f) => ({ ...f, access_type: "custom", role_id: "" }))}
                />
                Custom Admin
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                <input
                  type="radio"
                  checked={createForm.access_type === "super"}
                  onChange={() => setCreateForm((f) => ({ ...f, access_type: "super", role_id: "", permission_ids: [] }))}
                />
                Super Admin
              </label>
            </div>
          </Field>

          {createForm.access_type === "custom" ? (
            <>
              <Field label="Use Role">
                <select
                  value={createForm.role_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role_id: e.target.value, permission_ids: [] }))}
                  style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: "100%", background: "#fff" }}
                >
                  <option value=""> Create new role from selected permissions </option>
                  {roles.filter((x) => !x.is_super).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              {!createForm.role_id ? (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, maxHeight: 260, overflow: "auto" }}>
                  <div style={{ fontWeight: 900, marginBottom: 8, color: "#0f172a" }}>Select Screens & Actions</div>
                  {permissionsByModule.length === 0 ? (
                    <div style={{ color: "#64748b" }}>No permissions found. Use Permissions > Seed Defaults first.</div>
                  ) : (
                    permissionsByModule.map((group) => (
                      <div key={group.name} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#334155", marginBottom: 6 }}>{group.name}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6 }}>
                          {group.items.map((p) => (
                            <label key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={(createForm.permission_ids || []).includes(Number(p.id))}
                                onChange={() => toggleCreatePermission(p.id)}
                              />
                              <span>
                                <strong>{p.code}</strong>
                                {p.name || p.label ? <span style={{ color: "#64748b" }}> - {p.name || p.label}</span> : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={{ padding: "8px 10px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 8, fontSize: 13 }}>
                  This user will receive the selected existing role. Edit role permissions from Roles or Role Permission Mapping.
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "8px 10px", border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 8, fontSize: 13 }}>
              Super Admin gets full access to every admin screen and action.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={createUser}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Admin User */}
      <Modal open={editOpen} title="Edit Admin User" onClose={() => setEditOpen(false)}>
        {editErr ? (
          <div style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>
            {editErr}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 10 }}>
          <Field label="Email">
            <input
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: "100%" }}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={editForm.password}
              onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: "100%" }}
              placeholder="Leave blank to keep"
            />
          </Field>
          <Field label="Role">
            <select
              value={editForm.role_id}
              onChange={(e) => setEditForm((f) => ({ ...f, role_id: e.target.value }))}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: "100%", background: "#fff" }}
            >
              <option value=""> None </option>
              {roles.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}{x.is_super ? " (SUPER)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={saveEdit}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </RequirePermission>
  );
}

