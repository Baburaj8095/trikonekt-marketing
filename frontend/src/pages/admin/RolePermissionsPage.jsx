import React from "react";
import { Link } from "react-router-dom";
import API from "../../api/api";
import RequirePermission from "../../components/admin/RequirePermission";

export default function RolePermissionsPage() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("admin/role-permissions/", { timeout: 10000, retryAttempts: 0, dedupe: "cancelPrevious" });
      const data = res?.data;
      const arr = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setRows(arr);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to load role-permission mappings";
      setErr(String(msg));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  return (
    <RequirePermission anyOf={["manage_roles", "manage_permissions", "show_roles", "show_permissions"]}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: "#0f172a" }}>Role Permissions</h2>
            <div style={{ color: "#64748b", fontSize: 12 }}>Mapping table of Roles to Permissions.</div>
          </div>
          <Link
            to="/permission_role/create"
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, textDecoration: "none" }}
          >
            Add New
          </Link>
        </div>

        {err ? <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>{err}</div> : null}

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 800, color: "#0f172a", fontSize: 12 }}>
            <div>Role Name</div>
            <div>Permission</div>
            <div>Date</div>
          </div>
          {loading ? (
            <div style={{ padding: 12 }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b" }}>No records.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", padding: "10px 12px", borderTop: "1px solid #e2e8f0", alignItems: "center" }}>
                <div>{r.role_name || r.role || "””"}</div>
                <div>{r.permission_code || r.permission || "””"}</div>
                <div>
                  {r.created_at ? (() => { try { return new Date(r.created_at).toLocaleString(); } catch { return r.created_at; } })() : "””"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </RequirePermission>
  );
}

