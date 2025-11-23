import React, { useCallback, useMemo, useState } from "react";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";

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
  const [density, setDensity] = useState("standard");
  const [reloadKey, setReloadKey] = useState(0);

  // Client/server filters (API in market app usually supports pagination)
  const [filters, setFilters] = useState({
    q: "",
    active: "",
  });

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  const activeOptions = useMemo(
    () => [
      { value: "", label: "Any status" },
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
    []
  );

  const columns = useMemo(
    () => [
      { field: "id", headerName: "ID", minWidth: 90 },
      { field: "title", headerName: "Title", minWidth: 220, flex: 1 },
      { field: "category", headerName: "Category", minWidth: 140 },
      {
        field: "price",
        headerName: "Price",
        minWidth: 120,
        renderCell: (params) => {
          const v = Number(params?.row?.price || 0);
          return `₹${v.toFixed(2)}`;
        }
      },
      { field: "stock", headerName: "Stock", minWidth: 100 },
      {
        field: "active",
        headerName: "Status",
        minWidth: 120,
        renderCell: (params) => {
          const active = !!params?.row?.active;
          return (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                color: active ? "#065f46" : "#991b1b",
                background: active ? "#d1fae5" : "#fee2e2",
                border: `1px solid ${active ? "#10b981" : "#ef4444"}30`,
              }}
            >
              {active ? "Active" : "Inactive"}
            </span>
          );
        }
      },
    ],
    []
  );

  // Server-side fetcher mapped to market app endpoint
  const fetcher = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const params = { page, page_size: pageSize };

      // Merge filters
      if (filters.q && filters.q.trim()) params.q = filters.q.trim();
      if (filters.active) params.active = filters.active;

      // Quick search from table search
      if (search && String(search).trim()) {
        // Use same query param as filter-search to maximize compatibility
        params.q = String(search).trim();
      }
      if (ordering) params.ordering = ordering; // if backend supports ?ordering

      // Products endpoint is mounted at /api/products (see core/urls.py)
      const res = await API.get("/products", { params });
      const data = res?.data;
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const count = typeof data?.count === "number" ? data.count : results.length;
      return { results, count };
    },
    [filters, reloadKey]
  );

  const toolbar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label style={{ fontSize: 12, color: "#64748b" }}>Density</label>
        <div style={{ display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => setDensity("comfortable")}
            aria-pressed={density === "comfortable"}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: density === "comfortable" ? "#0f172a" : "#fff",
              color: density === "comfortable" ? "#fff" : "#0f172a",
              border: 0,
              cursor: "pointer",
            }}
          >
            Comfortable
          </button>
          <button
            onClick={() => setDensity("standard")}
            aria-pressed={density === "standard"}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: density === "standard" ? "#0f172a" : "#fff",
              color: density === "standard" ? "#fff" : "#0f172a",
              border: 0,
              borderLeft: "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            Standard
          </button>
          <button
            onClick={() => setDensity("compact")}
            aria-pressed={density === "compact"}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: density === "compact" ? "#0f172a" : "#fff",
              color: density === "compact" ? "#fff" : "#0f172a",
              border: 0,
              borderLeft: "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            Compact
          </button>
        </div>
      </div>
      <button
        onClick={() => setReloadKey((k) => k + 1)}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          background: "#fff",
          color: "#0f172a",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Refresh
      </button>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Products</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Manage marketplace products. Use toolbar search for quick lookup; server-side pagination and sorting enabled.
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

      <DataTable
        columns={columns}
        fetcher={fetcher}
        density={density}
        toolbar={toolbar}
        checkboxSelection={true}
        onSelectionChange={() => {}}
      />
    </div>
  );
}
