import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../../api/api";
import RequirePermission from "../../components/admin/RequirePermission";

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function RolePermissionCreate() {
  const navigate = useNavigate();
  const qp = useQuery();

  const [roles, setRoles] = React.useState([]);
  const [perms, setPerms] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const [roleId, setRoleId] = React.useState("");
  const [selected, setSelected] = React.useState(() => new Set());

  // Load roles and permissions
  React.useEffect(() => {
    let cancel = false;
    async function loadBase() {
      setErr("");
      try {
        const [r1, r2] = await Promise.all([
          API.get("admin/roles/", { params: { page_size: 500 }, timeout: 10000, retryAttempts: 0 }),
          API.get("admin/permissions/", { params: { page_size: 1000 }, timeout: 10000, retryAttempts: 0 }),
        ]);
        const arrRoles = Array.isArray(r1?.data?.results) ? r1.data.results : (Array.isArray(r1?.data) ? r1.data : []);
        const arrPerms = Array.isArray(r2?.data?.results) ? r2.data.results : (Array.isArray(r2?.data) ? r2.data : []);
        if (!cancel) {
          setRoles(arrRoles);
          setPerms(arrPerms);
        }
      } catch (e) {
        if (!cancel) {
          const msg = e?.response?.data?.detail || e?.message || "Failed to load metadata";
          setErr(String(msg));
          setRoles([]);
          setPerms([]);
        }
      }
    }
    loadBase();
    return () => {
      cancel = true;
    };
  }, []);

  // Autofill role from ?role or ?role_id
  React.useEffect(() => {
    const rid = qp.get("role") || qp.get("role_id") || qp.get("roleId");
    if (rid) {
      setRoleId(String(rid));
    }
  }, [qp]);

  // When role changes, load assigned permissions to pre-check
  React.useEffect(() => {
    let cancel = false;
    async function loadAssigned() {
      if (!roleId) {
        setSelected(new Set());
        return;
      }
      setLoading(true);
      setErr("");
      try {
        const res = await API.get(`admin/roles/${roleId}/permissions/`, { timeout: 10000, retryAttempts: 0 });
        const arr = Array.isArray(res?.data) ? res.data : [];
        const ids = new Set(arr.map((x) => Number(x.id)));
        if (!cancel) setSelected(ids);
      } catch (e) {
        if (!cancel) {
          const msg = e?.response?.data?.detail || e?.message || "Failed to load assigned permissions";
          setErr(String(msg));
          setSelected(new Set());
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    loadAssigned();
    return () => {
      cancel = true;
    };
  }, [roleId]);

  function toggle(pid) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  function toggleAll(check) {
    if (check) {
      setSelected(new Set(perms.map((p) => Number(p.id))));
    } else {
      setSelected(new Set());
    }
  }

  async function submit() {
    if (!roleId) {
      setErr("Select a role first.");
      return;
    }
    setLoading(true);
    setErr("");
    setNotice("");
    try {
      const ids = Array.from(selected.values());
      await API.put(`admin/roles/${roleId}/permissions/`, { permission_ids: ids });
      setNotice("Permissions saved.");
      // Redirect back to listing
      try {
        navigate("/permission_role", { replace: true });
      } catch (_) {}
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Save failed";
      setErr(String(msg));
    } finally {
      setLoading(false);
    }
  }

  const allChecked = perms.length > 0 && selected.size === perms.length;
  const someChecked = selected.size > 0 && selected.size < perms.length;

  return (
    <RequirePermission anyOf={["manage_roles", "manage_permissions", "show_roles", "show_permissions"]}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: "#0f172a", fontWeight: 900, fontSize: 18 }}>Create Role Permission</h2>
            <div style={{ color: "#64748b", fontSize: 12 }}>Select role and assign permissions. Submit replaces the full set.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate("/permission_role")}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontWeight: 800, cursor: "pointer" }}
            >
              Back
            </button>
            <button
              onClick={submit}
              disabled={!roleId || loading}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: (!roleId || loading) ? "not-allowed" : "pointer" }}
            >
              {loading ? "Saving..." : "Submit"}
            </button>
          </div>
        </div>

        {err ? (
          <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>
            {err}
          </div>
        ) : null}
        {notice ? (
          <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 8 }}>
            {notice}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Select Role</div>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, minWidth: 260, background: "#fff" }}
            >
              <option value="">”” Select Role ””</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.is_super ? " (SUPER)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>All Permissions</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0f172a", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  Select All
                </label>
              </div>
            </div>
            <div style={{ padding: 12 }}>
              {perms.length === 0 ? (
                <div style={{ color: "#64748b" }}>No permissions defined.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {perms.map((p) => {
                    const id = Number(p.id);
                    const checked = selected.has(id);
                    return (
                      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8, background: checked ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(id)} />
                        <div>
                          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 12 }}>{p.code}</div>
                          <div style={{ color: "#64748b", fontSize: 11 }}>{p.label || ""}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}

