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

export default function AdminHomeCards() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  async function fetchCards() {
    setLoading(true);
    setErr("");
    try {
      // Backend endpoint: /api/uploads/homecard/ (active-only)
      const res = await API.get("/uploads/homecard/");
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load home cards");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line
  }, []);

  const filtered = useMemo(() => {
    const term = (q || "").toLowerCase().trim();
    if (!term) return rows;
    return rows.filter((c) => {
      const t = (c.title || "").toLowerCase();
      const id = String(c.id || "");
      return t.includes(term) || id.includes(term);
    });
  }, [rows, q]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Home Cards</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Active banners on the public home screen (read-only list).
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
          value={q}
          onChange={setQ}
          placeholder="id / title"
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
          onClick={() => setQ("")}
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
            gridTemplateColumns: "80px 120px 1fr 120px 140px",
            gap: 8,
            padding: "10px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          <div>ID</div>
          <div>Image</div>
          <div>Title</div>
          <div>Order</div>
          <div>Active</div>
        </div>
        <div>
          {filtered.map((c) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 120px 1fr 120px 140px",
                gap: 8,
                padding: "10px",
                borderBottom: "1px solid #e2e8f0",
                alignItems: "center",
              }}
            >
              <div>{c.id}</div>
              <div>
                {c.image_url || c.image ? (
                  <img
                    src={c.image_url || c.image}
                    alt={c.title || "Home Card"}
                    style={{ width: 100, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }}
                  />
                ) : (
                  <div style={{ width: 100, height: 56, background: "#f1f5f9", borderRadius: 6, border: "1px solid #e2e8f0" }} />
                )}
              </div>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.title || "—"}</div>
              <div>{c.order ?? "—"}</div>
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
