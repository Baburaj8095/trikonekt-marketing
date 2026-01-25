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

function defaultHomeJSON() {
  return JSON.stringify(
    {
      sections: [
        { id: "hero", type: "hero_banner", title: "", data_source: { endpoint: "/api/uploads/hero-banners/" }, enabled: true },
        { id: "promotions", type: "promotion_strip", title: "Offers for you", data_source: { endpoint: "/api/uploads/promotions/" }, enabled: true },
        { id: "categories", type: "category_grid", title: "Shop by Category", data_source: { endpoint: "/api/business/tri/apps/" }, enabled: true },
        { id: "nearby_shops", type: "nearby_shops", title: "Nearby Shops", data_source: { endpoint: "/api/shops/nearby", params: { radius_km: 5, limit: 20 } }, enabled: true },
      ],
    },
    null,
    2
  );
}

function defaultCategoryJSON() {
  return JSON.stringify(
    {
      sections: [
        { id: "products", type: "product_grid", title: "", data_source: { endpoint: "/api/products", params: {} }, enabled: true },
      ],
    },
    null,
    2
  );
}

function validateConfigJSON(obj) {
  if (!obj || typeof obj !== "object") return "config must be an object";
  if (!Array.isArray(obj.sections)) return "config.sections must be a list";
  for (let i = 0; i < obj.sections.length; i++) {
    const sec = obj.sections[i];
    if (!sec || typeof sec !== "object") return `sections[${i}] must be an object`;
    if (typeof sec.id !== "string" || !sec.id.trim()) return `sections[${i}].id must be a non-empty string`;
    if (typeof sec.type !== "string" || !sec.type.trim()) return `sections[${i}].type must be a non-empty string`;
    if (sec.title !== undefined && sec.title !== null && typeof sec.title !== "string")
      return `sections[${i}].title must be a string when provided`;
    if (!sec.data_source || typeof sec.data_source !== "object") return `sections[${i}].data_source must be an object`;
    if (typeof sec.data_source.endpoint !== "string" || !sec.data_source.endpoint.trim())
      return `sections[${i}].data_source.endpoint must be a non-empty string`;
    if (sec.data_source.params !== undefined && sec.data_source.params !== null && typeof sec.data_source.params !== "object")
      return `sections[${i}].data_source.params must be an object when provided`;
    if (sec.enabled !== undefined && typeof sec.enabled !== "boolean")
      return `sections[${i}].enabled must be boolean when provided`;
  }
  return null;
}

function EditModal({ row, onClose, onSaved }) {
  const [title, setTitle] = useState(row?.title || "");
  const [isActive, setIsActive] = useState(row?.is_active !== false);
  const [version, setVersion] = useState(row?.version ?? 1);
  const [configText, setConfigText] = useState(() => JSON.stringify(row?.config || { sections: [] }, null, 2));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSave = async () => {
    try {
      setBusy(true);
      setErr("");
      let parsed;
      try {
        parsed = JSON.parse(configText);
      } catch (e) {
        setErr("Invalid JSON: " + (e?.message || "parse error"));
        return;
      }
      const v = validateConfigJSON(parsed);
      if (v) {
        setErr(v);
        return;
      }
      const payload = { title, is_active: !!isActive, version: Number(version) || 1, config: parsed };
      await API.patch(`/ui/admin/pages/${encodeURIComponent(row.id)}/`, payload);
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ width: "98%", maxWidth: 900, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: 12, fontWeight: 800, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          Edit UI Config â€” {row?.key}
        </div>
        <div style={{ padding: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            <TextInput label="Title" value={title} onChange={setTitle} placeholder="Optional title" />
            <TextInput label="Version" type="number" value={version} onChange={setVersion} placeholder="1" />
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Checkbox label="Active" checked={isActive} onChange={setIsActive} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b" }}>Config JSON</label>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={20}
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", fontFamily: "monospace", fontSize: 12 }}
            />
          </div>
          {err ? <div style={{ color: "#dc2626" }}>{err}</div> : null}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid #e2e8f0", cursor: busy ? "not-allowed" : "pointer" }}>
            Cancel
          </button>
          <button onClick={onSave} disabled={busy} style={{ padding: "8px 12px", borderRadius: 8, background: "#0f172a", color: "#fff", border: 0, cursor: busy ? "not-allowed" : "pointer", fontWeight: 700 }}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUIConfig() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Create form
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);
  const [newVersion, setNewVersion] = useState(1);
  const [newConfigText, setNewConfigText] = useState(defaultHomeJSON());
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/ui/admin/pages/", { params: { page_size: 500 } });
      const items = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
      setRows(items);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load UI configs");
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
      const hay = `${r?.id || ""} ${r?.key || ""} ${r?.title || ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  const createConfig = async () => {
    if (!newKey.trim()) {
      alert("Key is required.");
      return;
    }
    try {
      setCreating(true);
      let parsed;
      try {
        parsed = JSON.parse(newConfigText);
      } catch (e) {
        alert("Invalid JSON: " + (e?.message || "parse error"));
        return;
      }
      const v = validateConfigJSON(parsed);
      if (v) {
        alert(v);
        return;
      }
      await API.post("/ui/admin/pages/", {
        key: String(newKey).trim(),
        title: String(newTitle || ""),
        is_active: !!newIsActive,
        version: Number(newVersion) || 1,
        config: parsed,
      });
      setNewKey("");
      setNewTitle("");
      setNewIsActive(true);
      setNewVersion(1);
      setNewConfigText(defaultHomeJSON());
      await load();
      alert("Config created.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Create failed";
      alert(typeof msg === "string" ? msg : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (row) => {
    if (!row?.id) return;
    try {
      setBusyId(row.id);
      await API.patch(`/ui/admin/pages/${encodeURIComponent(row.id)}/`, { is_active: !(row?.is_active !== false) });
      await load();
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete config "${row?.key}"?`)) return;
    try {
      setBusyId(row.id);
      await API.delete(`/ui/admin/pages/${encodeURIComponent(row.id)}/`);
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
        <h2 style={{ margin: 0, color: "#0f172a" }}>UI Page Configs</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Manage config-driven pages. Keys: ecommerce_home, category_default, category:slug
        </div>
      </div>

      <Section
        title="Create Config"
        extraRight={
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value="__none__"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "home") setNewConfigText(defaultHomeJSON());
                if (v === "category") setNewConfigText(defaultCategoryJSON());
                e.target.value = "__none__";
              }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#0f172a" }}
            >
              <option value="__none__">Templatesâ€¦</option>
              <option value="home">Ecommerce Home</option>
              <option value="category">Category Default</option>
            </select>
            <button
              onClick={createConfig}
              disabled={creating || !newKey.trim()}
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
          </div>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          <TextInput label="Key (unique)" value={newKey} onChange={setNewKey} placeholder="e.g., ecommerce_home, category_default, category:electronics" />
          <TextInput label="Title" value={newTitle} onChange={setNewTitle} placeholder="Optional title" />
          <TextInput label="Version" type="number" value={newVersion} onChange={setNewVersion} placeholder="1" />
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <Checkbox label="Active" checked={newIsActive} onChange={setNewIsActive} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: "#64748b" }}>Config JSON</label>
          <textarea
            value={newConfigText}
            onChange={(e) => setNewConfigText(e.target.value)}
            rows={12}
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", fontFamily: "monospace", fontSize: 12 }}
          />
        </div>
      </Section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
        <TextInput label="Search" value={q} onChange={setQ} placeholder="id / key / title" />
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
            gridTemplateColumns: "80px 220px 1fr 100px 130px 220px",
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
          <div>Title</div>
          <div>Version</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div>
          {filtered.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 220px 1fr 100px 130px 220px",
                gap: 8,
                padding: "10px",
                borderBottom: "1px solid #e2e8f0",
                alignItems: "center",
              }}
            >
              <div>#{r.id}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.key}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.title || "â€”"}</div>
              <div>{r.version ?? 1}</div>
              <div>
                <button
                  onClick={() => toggleActive(r)}
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
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setEditRow(r)}
                  style={{ padding: "4px 8px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0", fontSize: 12, cursor: "pointer" }}
                >
                  Edit JSON
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

      {editRow ? <EditModal row={editRow} onSaved={load} onClose={() => setEditRow(null)} /> : null}
    </div>
  );
}

