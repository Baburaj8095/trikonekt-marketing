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

export default function AdminDashboardCards() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState({
    q: "",
    role: "",
  });

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function fetchCards() {
    setLoading(true);
    setErr("");
    try {
      // Backend endpoint: /api/uploads/cards/ (active-only, optionally filtered by role)
      const params = {};
      if ((filters.role || "").trim()) params.role = filters.role.trim();
      const res = await API.get("/uploads/cards/", { params });
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load dashboard cards");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line
  }, []);

  const roleOptions = useMemo(
    () => [
      { value: "", label: "Any role" },
      { value: "user", label: "Consumer" },
      { value: "agency", label: "Agency" },
      { value: "employee", label: "Employee" },
    ],
    []
  );

  const filtered = useMemo(() => {
    let out = rows;
    const q = (filters.q || "").toLowerCase().trim();
    if (q) {
      out = out.filter((c) => {
        const t = (c.title || "").toLowerCase();
        const k = (c.key || "").toLowerCase();
        const d = (c.description || "").toLowerCase?.() || "";
        const r = (c.role || "").toLowerCase?.() || "";
        const ro = (c.route || "").toLowerCase?.() || "";
        return (
          t.includes(q) ||
          k.includes(q) ||
          d.includes(q) ||
          r.includes(q) ||
          ro.includes(q) ||
          String(c.id || "").includes(q)
        );
      });
    }
    if ((filters.role || "").trim()) {
      out = out.filter((c) => String(c.role || "").toLowerCase() === String(filters.role).toLowerCase());
    }
    return out;
  }, [rows, filters]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Dashboard Cards</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Active tiles shown on user/agency/employee dashboards.
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
          placeholder="id / title / key / description / route"
        />
        <Select
          label="Role"
          value={filters.role}
          onChange={(v) => setF("role", v)}
          options={roleOptions}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={fetchCards}
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
          onClick={() => setFilters({ q: "", role: "" })}
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
              "80px 160px 1fr 160px 120px 160px",
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
          <div>Role</div>
          <div>Active</div>
          <div>Route</div>
        </div>
        <div>
          {filtered.map((c) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "80px 160px 1fr 160px 120px 160px",
                gap: 8,
                padding: "10px",
                borderBottom: "1px solid #e2e8f0",
                alignItems: "center",
              }}
            >
              <div>{c.id}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.key || "—"}</div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.title || "—"}</div>
              <div>{c.role || "—"}</div>
              <div>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    color: c.is_active ? "#065f46" : "#991b1b",
                    background: c.is_active ? "#d1fae5" : "#fee2e2",
                    border: `1px solid ${c.is_active ? "#10b981" : "#ef4444"}30`,
                  }}
                >
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.route || "—"}</div>
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
