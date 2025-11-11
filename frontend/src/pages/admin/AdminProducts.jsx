import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";

function TextInput({ label, value, onChange, placeholder, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function Select({ label, value, onChange, options, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          outline: "none",
          background: "#fff",
          ...style,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminProducts() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // Client-side filters (server API in market app may not expose rich filters)
  const [filters, setFilters] = useState({
    q: "",
    active: "",
  });

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function fetchProducts() {
    setLoading(true);
    setErr("");
    try {
      // Market app endpoints mounted at /api/ (see backend/core/urls.py)
      // Products endpoint: /api/products
      const res = await API.get("/products");
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load products");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const activeOptions = useMemo(
    () => [
      { value: "", label: "Any status" },
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
    []
  );

  const filtered = useMemo(() => {
    let out = rows;
    const q = (filters.q || "").toLowerCase().trim();
    if (q) {
      out = out.filter((p) => {
        const t = (p.title || "").toLowerCase();
        const d = (p.description || "").toLowerCase?.() || "";
        const c = (p.category || "").toLowerCase?.() || "";
        return (
          t.includes(q) ||
          d.includes(q) ||
          c.includes(q) ||
          String(p.id || "").includes(q)
        );
      });
    }
    if (filters.active === "true") {
      out = out.filter((p) => !!p.active);
    } else if (filters.active === "false") {
      out = out.filter((p) => !p.active);
    }
    return out;
  }, [rows, filters]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Products</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Manage marketplace products (read/list view). Create/Edit can be added next.
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <TextInput
          label="Search"
          value={filters.q}
          onChange={(v) => setF("q", v)}
          placeholder="id / title / description / category"
        />
        <Select
          label="Status"
          value={filters.active}
          onChange={(v) => setF("active", v)}
          options={activeOptions}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={fetchProducts}
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
        <button
          onClick={() => {
            setFilters({ q: "", active: "" });
          }}
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#fff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Reset
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
            gridTemplateColumns:
              "80px 1fr 140px 120px 120px 120px",
            gap: 8,
            padding: "10px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          <div>ID</div>
          <div>Title</div>
          <div>Category</div>
          <div>Price</div>
          <div>Stock</div>
          <div>Status</div>
        </div>
        <div>
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "80px 1fr 140px 120px 120px 120px",
                gap: 8,
                padding: "10px",
                borderBottom: "1px solid #e2e8f0",
                alignItems: "center",
              }}
            >
              <div>{p.id}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.title || "—"}</div>
              <div>{p.category || "—"}</div>
              <div>₹{Number(p.price || 0).toFixed(2)}</div>
              <div>{p.stock ?? "—"}</div>
              <div>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    color: p.active ? "#065f46" : "#991b1b",
                    background: p.active ? "#d1fae5" : "#fee2e2",
                    border: `1px solid ${p.active ? "#10b981" : "#ef4444"}30`,
                  }}
                >
                  {p.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b" }}>No results</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
