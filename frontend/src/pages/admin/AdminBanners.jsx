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

export default function AdminBanners() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState({
    q: "",
    active: "1",
    state: "",
    pincode: "",
  });

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function fetchBanners() {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      if (filters.active) params.active = filters.active;
      if (filters.state.trim()) params.state = filters.state.trim();
      if (filters.pincode.trim()) params.pincode = filters.pincode.trim();
      // Server-side list
      const res = await API.get("/banners", { params });
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load banners");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBanners();
    // eslint-disable-next-line
  }, []);

  const activeOptions = useMemo(
    () => [
      { value: "1", label: "Active only" },
      { value: "", label: "All" },
    ],
    []
  );

  const filtered = useMemo(() => {
    let out = rows;
    const q = (filters.q || "").toLowerCase().trim();
    if (q) {
      out = out.filter((b) => {
        const t = (b.title || "").toLowerCase();
        const d = (b.description || "").toLowerCase();
        const st = (b.state || "").toLowerCase();
        const pc = (b.pincode || "").toLowerCase();
        return (
          t.includes(q) ||
          d.includes(q) ||
          st.includes(q) ||
          pc.includes(q) ||
          String(b.id || "").includes(q)
        );
      });
    }
    return out;
  }, [rows, filters.q]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Banners</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          View marketplace banners configured by agencies. Create/Edit can be added next.
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
          placeholder="id / title / description / state / pincode"
        />
        <Select
          label="Status"
          value={filters.active}
          onChange={(v) => setF("active", v)}
          options={activeOptions}
        />
        <TextInput
          label="State"
          value={filters.state}
          onChange={(v) => setF("state", v)}
          placeholder="exact state name"
        />
        <TextInput
          label="Pincode"
          value={filters.pincode}
          onChange={(v) => setF("pincode", v)}
          placeholder="6-digit"
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={fetchBanners}
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
          onClick={() => setFilters({ q: "", active: "1", state: "", pincode: "" })}
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
              "80px 1fr 140px 160px 120px 120px",
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
          <div>State</div>
          <div>Pincode</div>
          <div>Items</div>
          <div>Status</div>
        </div>
        <div>
          {filtered.map((b) => (
            <div
              key={b.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "80px 1fr 140px 160px 120px 120px",
                gap: 8,
                padding: "10px",
                borderBottom: "1px solid #e2e8f0",
                alignItems: "center",
              }}
            >
              <div>{b.id}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {b.title || "—"}
              </div>
              <div>{b.state || "—"}</div>
              <div>{b.pincode || "—"}</div>
              <div>{Array.isArray(b.items) ? b.items.length : 0}</div>
              <div>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    color: b.is_active ? "#065f46" : "#991b1b",
                    background: b.is_active ? "#d1fae5" : "#fee2e2",
                    border: `1px solid ${b.is_active ? "#10b981" : "#ef4444"}30`,
                  }}
                >
                  {b.is_active ? "Active" : "Inactive"}
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
