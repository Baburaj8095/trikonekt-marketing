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
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
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

export default function PermissionsPage() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ code: "", label: "" });
  const [createErr, setCreateErr] = React.useState("");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState(null);
  const [editErr, setEditErr] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("admin/permissions/", { params: { page_size: 500 }, timeout: 10000, retryAttempts: 0, dedupe: "cancelPrevious" });
      const arr = Array.isArray(res?.data?.results) ? res.data.results : (Array.isArray(res?.data) ? res.data : []);
      setRows(arr);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to load permissions";
      setErr(String(msg));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function createPermission() {
    setCreateErr("");
    try {
      const code = String(createForm.code || "").trim();
      if (!code) {
        setCreateErr("Code is required.");
        return;
      }
      await API.post("admin/permissions/", { code, label: String(createForm.label || "").trim() });
      setCreateOpen(false);
      setCreateForm({ code: "", label: "" });
      setNotice("Permission created.");
      load();
    } catch (e) {
      const msg = e?.response?.data?.code?.[0] || e?.response?.data?.detail || e?.message || "Create failed";
      setCreateErr(String(msg));
    }
  }

  function openEdit(r) {
    setEditRow(r);
    setEditErr("");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editRow?.id) return;
    setEditErr("");
    try {
      await API.patch(`admin/permissions/${editRow.id}/`, { code: editRow.code, label: editRow.label });
      setEditOpen(false);
      setNotice("Permission updated.");
      load();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Update failed";
      setEditErr(String(msg));
    }
  }

  async function remove(r) {
    if (!r?.id) return;
    const ok = window.confirm(`Delete permission "${r.code}"? This action cannot be undone.`);
    if (!ok) return;
    try {
      await API.delete(`admin/permissions/${r.id}/`);
      setNotice("Permission deleted.");
      load();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Delete failed";
      setErr(String(msg));
    }
  }

  return (
    <RequirePermission anyOf={["manage_permissions", "show_permissions"]}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: "#0f172a" }}>Permissions</h2>
            <div style={{ color: "#64748b", fontSize: 12 }}>List, create, edit and delete permissions.</div>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}
          >
            Add New
          </button>
        </div>

        {err ? <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>{err}</div> : null}
        {notice ? <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 8 }}>{notice}</div> : null}

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 800, color: "#0f172a", fontSize: 12 }}>
            <div>Code</div>
            <div>Label</div>
            <div>Action</div>
          </div>
          {loading ? (
            <div style={{ padding: 12 }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b" }}>No records.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", padding: "10px 12px", borderTop: "1px solid #e2e8f0", alignItems: "center" }}>
                <div>{r.code}</div>
                <div>{r.label || ""}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(r)} style={{ padding: "6px 10px", borderRadius: 8, background: "#0ea5e9", border: "1px solid #0284c7", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                    Edit
                  </button>
                  <button
                    onClick={() => remove(r)}
                    style={{ padding: "6px 10px", borderRadius: 8, background: "#ef4444", border: "1px solid #b91c1c", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={createOpen}
        title="Add Permission"
        onClose={() => setCreateOpen(false)}
        footer={
          <button onClick={createPermission} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}>
            Create
          </button>
        }
      >
        {createErr ? <div style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>{createErr}</div> : null}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Code</div>
            <input value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }} placeholder="e.g. manage_users" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Label</div>
            <input value={createForm.label} onChange={(e) => setCreateForm((f) => ({ ...f, label: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }} placeholder="Optional label" />
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        title="Edit Permission"
        onClose={() => setEditOpen(false)}
        footer={
          <button onClick={saveEdit} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}>
            Save
          </button>
        }
      >
        {editErr ? <div style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>{editErr}</div> : null}
        {editRow ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Code</div>
              <input value={editRow.code || ""} onChange={(e) => setEditRow((r) => ({ ...r, code: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Label</div>
              <input value={editRow.label || ""} onChange={(e) => setEditRow((r) => ({ ...r, label: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8 }} />
            </div>
          </div>
        ) : null}
      </Modal>
    </RequirePermission>
  );
}

