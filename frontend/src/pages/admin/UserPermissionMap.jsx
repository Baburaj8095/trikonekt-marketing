import React from "react";
import API from "../../api/api";
import RequirePermission from "../../components/admin/RequirePermission";

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", background: "#f8fafc", borderTopLeftRadius: 12, borderTopRightRadius: 12, fontWeight: 900, color: "#0f172a" }}>
          {title}
        </div>
        <div style={{ padding: 12 }}>{children}</div>
        <div style={{ padding: 12, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {footer}
          <button onClick={onClose} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserPermissionMap() {
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const [adminUsers, setAdminUsers] = React.useState([]);
  const [roles, setRoles] = React.useState([]);
  const [perms, setPerms] = React.useState([]);

  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [selectedRoleId, setSelectedRoleId] = React.useState("");
  const [checkedPermIds, setCheckedPermIds] = React.useState([]);

  const [createRoleOpen, setCreateRoleOpen] = React.useState(false);
  const [newRole, setNewRole] = React.useState({ name: "", is_super: false });
  const [createRoleErr, setCreateRoleErr] = React.useState("");

  // Load admin users (staff)
  const loadUsers = React.useCallback(async (q) => {
    try {
      const res = await API.get("admin/users/", {
        params: { page: 1, page_size: 50, admin_only: 1, search: q || undefined },
        timeout: 8000,
        retryAttempts: 1,
        dedupe: "cancelPrevious",
      });
      const results = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
      setAdminUsers(results.filter((r) => r && r.username));
    } catch {
      setAdminUsers([]);
    }
  }, []);

  // Load roles and permissions
  const loadRoles = React.useCallback(async () => {
    try {
      const res = await API.get("admin/roles/", { timeout: 10000, retryAttempts: 0 });
      setRoles(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setRoles([]);
    }
  }, []);

  const loadPerms = React.useCallback(async () => {
    try {
      const res = await API.get("admin/permissions/", { timeout: 10000, retryAttempts: 0 });
      setPerms(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setPerms([]);
    }
  }, []);

  React.useEffect(() => {
    loadUsers();
    loadRoles();
    loadPerms();
  }, [loadUsers, loadRoles, loadPerms]);

  // When user selection changes, preselect their current role (if any)
  React.useEffect(() => {
    if (!selectedUserId) return;
    const u = adminUsers.find((x) => String(x.id) === String(selectedUserId));
    const rid = u?.admin_role?.id || "";
    setSelectedRoleId(rid ? String(rid) : "");
  }, [selectedUserId, adminUsers]);

  // When role selection changes, fetch its permissions and pre-check
  React.useEffect(() => {
    async function loadRolePerms() {
      if (!selectedRoleId) {
        setCheckedPermIds([]);
        return;
      }
      try {
        const res = await API.get(`admin/roles/${selectedRoleId}/permissions/`, { timeout: 10000, retryAttempts: 0 });
        const ids = Array.isArray(res?.data) ? res.data.map((x) => Number(x.id)) : [];
        setCheckedPermIds(ids);
      } catch {
        setCheckedPermIds([]);
      }
    }
    loadRolePerms();
  }, [selectedRoleId]);

  function togglePerm(pid) {
    setCheckedPermIds((prev) => {
      const n = Number(pid);
      return prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n];
    });
  }

  async function handleSave() {
    setErr("");
    setNotice("");
    if (!selectedUserId) {
      setErr("Please select an admin user.");
      return;
    }
    if (!selectedRoleId) {
      setErr("Please select a role/group.");
      return;
    }
    setLoading(true);
    try {
      // 1) Replace permissions for selected role
      await API.put(`admin/roles/${selectedRoleId}/permissions/`, checkedPermIds);
      // 2) Assign role to selected user
      await API.post(`admin/users/${selectedUserId}/assign-role/`, { role_id: Number(selectedRoleId) });
      setNotice("Mapping saved. User role and permissions updated.");
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Save failed";
      setErr(String(msg));
    } finally {
      setLoading(false);
    }
  }

  async function createRole() {
    setCreateRoleErr("");
    try {
      const name = String(newRole.name || "").trim();
      if (!name) {
        setCreateRoleErr("Role name is required.");
        return;
      }
      const res = await API.post("admin/roles/", { name, is_super: !!newRole.is_super });
      const role = res?.data;
      setCreateRoleOpen(false);
      setNewRole({ name: "", is_super: false });
      // refresh roles and preselect the created role
      await loadRoles();
      if (role?.id) {
        setSelectedRoleId(String(role.id));
      }
    } catch (e) {
      const msg = e?.response?.data?.name?.[0] || e?.response?.data?.detail || e?.message || "Create failed";
      setCreateRoleErr(String(msg));
    }
  }

  return (
    <RequirePermission anyOf={["manage_roles", "manage_permissions", "show_roles", "show_permissions"]}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: "#0f172a", fontWeight: 900, fontSize: 18 }}>User â†’ Permission Mapping</h2>
            <div style={{ color: "#64748b", fontSize: 12 }}>Assign a role/group to an admin user and control that role's permissions via checkboxes.</div>
          </div>
          <button
            onClick={() => setCreateRoleOpen(true)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}
          >
            Add Role/Group
          </button>
        </div>

        {err ? <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>{err}</div> : null}
        {notice ? <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 8 }}>{notice}</div> : null}

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8, color: "#0f172a" }}>Select Admin User</div>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}
              >
                <option value=""> Select Admin User </option>
                {adminUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.username} ({u.username})
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Search users..."
                  onChange={(e) => loadUsers(e.target.value)}
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8, color: "#0f172a" }}>Select Role/Group</div>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff" }}
              >
                <option value=""> Select Role/Group </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.is_super ? " (SUPER)" : ""}
                  </option>
                ))}
              </select>
              {selectedRoleId ? (
                <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                  Editing permissions for role: <strong>{roles.find((r) => String(r.id) === String(selectedRoleId))?.name || ""}</strong>
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 800, color: "#0f172a", fontSize: 12 }}>
              All Permissions
            </div>
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {perms.length === 0 ? (
                <div style={{ color: "#64748b" }}>No permissions defined.</div>
              ) : (
                perms.map((p) => {
                  const checked = checkedPermIds.includes(Number(p.id));
                  return (
                    <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={checked} onChange={() => togglePerm(p.id)} />
                      <span style={{ fontWeight: 700 }}>{p.code}</span>
                      <span style={{ color: "#64748b" }}>{p.label || ""}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              disabled={loading}
              onClick={handleSave}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}
            >
              {loading ? "Saving..." : "Save Mapping"}
            </button>
          </div>
        </div>
      </div>

      {/* Create Role Modal */}
      <Modal
        open={createRoleOpen}
        title="Add Role/Group"
        onClose={() => setCreateRoleOpen(false)}
        footer={
          <button onClick={createRole} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}>
            Create
          </button>
        }
      >
        {createRoleErr ? <div style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>{createRoleErr}</div> : null}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Name</div>
            <input value={newRole.name} onChange={(e) => setNewRole((f) => ({ ...f, name: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Super Admin</div>
            <input type="checkbox" checked={!!newRole.is_super} onChange={(e) => setNewRole((f) => ({ ...f, is_super: e.target.checked }))} />
          </div>
        </div>
      </Modal>
    </RequirePermission>
  );
}

