import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";

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

function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#0f172a" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
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

function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const k of ["results", "data", "items", "rows"]) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
}

function normalizeMediaUrl(url) {
  if (!url) return "";
  const s = String(url);
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) return s;
  return s; // keep same-origin relative
}

function EditRow({ row, onSaved, onClose }) {
  const [form, setForm] = useState(() => ({
    key: row?.key || row?.slug || "",
    label: row?.label || row?.name || "",
    route: row?.route || "",
    order: row?.order ?? 0,
    home_limit: row?.home_limit ?? 10,
    is_active: row?.is_active !== false,
    show_on_home: row?.show_on_home !== false,
    hide_when_empty: !!row?.hide_when_empty,
    image: null,
  }));
  const [busy, setBusy] = useState(false);

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async () => {
    if (!row?.id) return;
    try {
      setBusy(true);
      const fd = new FormData();
      if (form.key !== undefined) fd.append("key", String(form.key || ""));
      if (form.label !== undefined) {
        fd.append("label", String(form.label || ""));
        fd.append("name", String(form.label || "")); // compat
      }
      if (form.route !== undefined) fd.append("route", String(form.route || ""));
      if (form.order !== undefined) fd.append("order", String(form.order || 0));
      if (form.home_limit !== undefined) fd.append("home_limit", String(form.home_limit || 0));
      fd.append("is_active", form.is_active ? "true" : "false");
      fd.append("show_on_home", form.show_on_home ? "true" : "false");
      fd.append("hide_when_empty", form.hide_when_empty ? "true" : "false");
      if (form.image) fd.append("image", form.image);

      await API.patch(`/uploads/category-banners/${encodeURIComponent(row.id)}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSaved && onSaved();
      onClose && onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: "96%",
          maxWidth: 560,
          background: "#fff",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ padding: 12, fontWeight: 800, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          Edit Category
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            <TextInput label="Key (slug, unique)" value={form.key} onChange={(v) => setF("key", v)} placeholder="e.g., electronics" />
            <TextInput label="Label (display name)" value={form.label} onChange={(v) => setF("label", v)} placeholder="e.g., Electronics" />
            <TextInput label="Route (optional)" value={form.route} onChange={(v) => setF("route", v)} placeholder="/user/tri/tri-electronics" />
            <TextInput label="Order" type="number" value={form.order} onChange={(v) => setF("order", v)} placeholder="0" />
            <TextInput label="Home Limit" type="number" value={form.home_limit} onChange={(v) => setF("home_limit", v)} placeholder="10" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#64748b" }}>Image</label>
              <input type="file" accept="image/*" onChange={(e) => setF("image", e.target.files?.[0] || null)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <Checkbox label="Active" checked={form.is_active} onChange={(v) => setF("is_active", v)} />
            <Checkbox label="Show on Home" checked={form.show_on_home} onChange={(v) => setF("show_on_home", v)} />
            <Checkbox label="Hide Strip When Empty" checked={form.hide_when_empty} onChange={(v) => setF("hide_when_empty", v)} />
          </div>
        </div>
        <div style={{ padding: 12, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", cursor: busy ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={busy}
            style={{ padding: "8px 12px", borderRadius: 8, background: "#0f172a", color: "#fff", border: 0, cursor: busy ? "not-allowed" : "pointer", fontWeight: 700 }}
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminEcommerceCategories() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Create form
  const [newCat, setNewCat] = useState({
    key: "",
    label: "",
    route: "",
    order: 0,
    home_limit: 10,
    is_active: true,
    show_on_home: true,
    hide_when_empty: false,
    image: null,
  });
  const [creating, setCreating] = useState(false);

  // UI
  const [q, setQ] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/uploads/category-banners/", { params: { page_size: 500 } });
      const items = ensureArray(res?.data);
      setRows(items);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load categories");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return rows || [];
    return (rows || []).filter((r) => {
      const hay = `${r?.id || ""} ${r?.key || r?.slug || ""} ${r?.label || r?.name || ""} ${r?.route || ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  const createCategory = async () => {
    if (!newCat.key.trim() || !newCat.label.trim()) {
      alert("Key and Label are required.");
      return;
    }
    try {
      setCreating(true);
      const fd = new FormData();
      fd.append("key", String(newCat.key).trim());
      fd.append("label", String(newCat.label).trim());
      fd.append("name", String(newCat.label).trim()); // compat
      if (newCat.route) fd.append("route", String(newCat.route).trim());
      fd.append("order", String(newCat.order || 0));
      fd.append("home_limit", String(newCat.home_limit || 0));
      fd.append("is_active", newCat.is_active ? "true" : "false");
      fd.append("show_on_home", newCat.show_on_home ? "true" : "false");
      fd.append("hide_when_empty", newCat.hide_when_empty ? "true" : "false");
      if (newCat.image) fd.append("image", newCat.image);

      await API.post("/uploads/category-banners/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setNewCat({
        key: "",
        label: "",
        route: "",
        order: 0,
        home_limit: 10,
        is_active: true,
        show_on_home: true,
        hide_when_empty: false,
        image: null,
      });
      await load();
      alert("Category created.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Create failed";
      alert(typeof msg === "string" ? msg : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const toggleFlag = async (row, field) => {
    if (!row?.id) return;
    try {
      setBusyId(row.id);
      const payload = {};
      payload[field] = !(row?.[field] !== false);
      await API.patch(`/uploads/category-banners/${encodeURIComponent(row.id)}/`, payload);
      await load();
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Delete this category?")) return;
    try {
      setBusyId(row.id);
      await API.delete(`/uploads/category-banners/${encodeURIComponent(row.id)}/`);
      await load();
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>E‑commerce Categories</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Create and manage categories that drive the new consumer home. These map to <code>/uploads/category-banners/</code>.
        </div>
      </div>

      {/* Create */}
      <Section
        title="Create Category"
        extraRight={
          <button
            onClick={createCategory}
            disabled={creating || !newCat.key.trim() || !newCat.label.trim()}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: creating ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {creating ? "Creating..." : "Create"}
          </button>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          <TextInput label="Key (slug, unique)" value={newCat.key} onChange={(v) => setNewCat((s) => ({ ...s, key: v }))} placeholder="e.g., electronics" />
          <TextInput label="Label (display name)" value={newCat.label} onChange={(v) => setNewCat((s) => ({ ...s, label: v }))} placeholder="e.g., Electronics" />
          <TextInput label="Route (optional)" value={newCat.route} onChange={(v) => setNewCat((s) => ({ ...s, route: v }))} placeholder="/trikonekt-products?category=electronics" />
          <TextInput label="Order" type="number" value={newCat.order} onChange={(v) => setNewCat((s) => ({ ...s, order: v }))} placeholder="0" />
          <TextInput label="Home Limit" type="number" value={newCat.home_limit} onChange={(v) => setNewCat((s) => ({ ...s, home_limit: v }))} placeholder="10" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>Image</label>
            <input type="file" accept="image/*" onChange={(e) => setNewCat((s) => ({ ...s, image: e.target.files?.[0] || null }))} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <Checkbox label="Active" checked={newCat.is_active} onChange={(v) => setNewCat((s) => ({ ...s, is_active: v }))} />
          <Checkbox label="Show on Home" checked={newCat.show_on_home} onChange={(v) => setNewCat((s) => ({ ...s, show_on_home: v }))} />
          <Checkbox label="Hide Strip When Empty" checked={newCat.hide_when_empty} onChange={(v) => setNewCat((s) => ({ ...s, hide_when_empty: v }))} />
        </div>
      </Section>

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
        <TextInput label="Search" value={q} onChange={setQ} placeholder="id / key / label / route" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#0f172a",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        {err ? <div style={{ color: "#dc2626" }}>{err}</div> : null}
      </div>

      {/* Table */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px 160px 1fr 100px 100px 110px 80px 110px 180px",
            gap: 8,
            padding: "10px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          <div>ID</div>
          <div>Key</div>
          <div>Label</div>
          <div>Order</div>
          <div>Limit</div>
          <div>Status</div>
          <div>Home</div>
          <div>Hide Empty</div>
          <div>Actions</div>
        </div>
        <div>
          {filtered.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 160px 1fr 100px 100px 110px 80px 110px 180px",
                gap: 8,
                padding: "10px",
                borderBottom: "1px solid #e2e8f0",
                alignItems: "center",
              }}
            >
              <div>#{r.id}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.key || r.slug || ""}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.label || r.name || ""}</div>
              <div>{r.order ?? 0}</div>
              <div>{r.home_limit ?? 0}</div>
              <div>
                <button
                  onClick={() => toggleFlag(r, "is_active")}
                  disabled={busyId === r.id}
                  title="Toggle Active"
                  style={{
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    color: r.is_active !== false ? "#065f46" : "#991b1b",
                    background: r.is_active !== false ? "#d1fae5" : "#fee2e2",
                    border: `1px solid ${r.is_active !== false ? "#10b981" : "#ef4444"}30`,
                    cursor: busyId === r.id ? "not-allowed" : "pointer",
                  }}
                >
                  {r.is_active !== false ? "Active" : "Inactive"}
                </button>
              </div>
              <div>
                <button
                  onClick={() => toggleFlag(r, "show_on_home")}
                  disabled={busyId === r.id}
                  title="Toggle Show on Home"
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: r.show_on_home !== false ? "#eff6ff" : "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    cursor: busyId === r.id ? "not-allowed" : "pointer",
                  }}
                >
                  {r.show_on_home !== false ? "Shown" : "Hidden"}
                </button>
              </div>
              <div>
                <button
                  onClick={() => toggleFlag(r, "hide_when_empty")}
                  disabled={busyId === r.id}
                  title="Toggle hide when empty"
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: r.hide_when_empty ? "#fde68a" : "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    cursor: busyId === r.id ? "not-allowed" : "pointer",
                  }}
                >
                  {r.hide_when_empty ? "Hide" : "Show"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {r.image_url || r.image ? (
                  <a
                    href={normalizeMediaUrl(r.image_url || r.image)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: "4px 8px", borderRadius: 6, background: "#0ea5e9", color: "#fff", textDecoration: "none", fontSize: 12 }}
                  >
                    Image
                  </a>
                ) : null}
                <button
                  onClick={() => setEditRow(r)}
                  style={{ padding: "4px 8px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0", fontSize: 12, cursor: "pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(r)}
                  disabled={busyId === r.id}
                  style={{ padding: "4px 8px", borderRadius: 6, background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 12, cursor: busyId === r.id ? "not-allowed" : "pointer" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 ? <div style={{ padding: 12, color: "#64748b" }}>No results</div> : null}
        </div>
      </div>

      {editRow ? <EditRow row={editRow} onSaved={load} onClose={() => setEditRow(null)} /> : null}
    </div>
  );
}

