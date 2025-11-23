import React, { useCallback, useMemo, useState } from "react";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";

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

function Badge({ children, color = "#0369a1", bg = "#e0f2fe" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 12,
        borderRadius: 999,
        color,
        background: bg,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

export default function AdminKYC() {
  const [filters, setFilters] = useState({
    status: "pending", // default tab
    user: "",
    state: "",
    pincode: "",
    date_from: "",
    date_to: "",
  });
  const [density, setDensity] = useState("standard");
  const [reloadKey, setReloadKey] = useState(0);

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  const statusOptions = useMemo(
    () => [
      { value: "", label: "Any" },
      { value: "pending", label: "Pending" },
      { value: "verified", label: "Verified" },
    ],
    []
  );

  async function handleVerify(row) {
    if (!window.confirm(`Verify KYC for ${row.username}?`)) return;
    try {
      await API.patch(`/admin/kyc/${row.user_id}/verify/`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to verify KYC");
    }
  }

  async function handleReject(row) {
    if (!window.confirm(`Reject KYC for ${row.username}?`)) return;
    try {
      await API.patch(`/admin/kyc/${row.user_id}/reject/`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to reject KYC");
    }
  }

  // DataGrid columns (responsive with flex + minWidth)
  const columns = useMemo(
    () => [
      { field: "user_id", headerName: "UserID", minWidth: 110 },
      { field: "username", headerName: "Username", minWidth: 160, flex: 1 },
      { field: "full_name", headerName: "Full Name", minWidth: 200, flex: 1 },
      { field: "phone", headerName: "Phone", minWidth: 140 },
      { field: "pincode", headerName: "Pincode", minWidth: 120 },
      {
        field: "bank",
        headerName: "Bank",
        minWidth: 200,
        renderCell: (params) => {
          const r = params?.row || {};
          return r.bank_name ? `${r.bank_name} (${r.ifsc_code})` : "—";
        },
        valueGetter: (_, row) => {
          if (!row) return "";
          return row.bank_name ? `${row.bank_name} (${row.ifsc_code})` : "";
        },
      },
      {
        field: "bank_account_number",
        headerName: "Account No.",
        minWidth: 160,
        renderCell: (params) => {
          const v = params?.row?.bank_account_number || "";
          const s = String(v || "");
          if (!s) return "—";
          if (s.length <= 4) return s;
          return "•••• " + s.slice(-4);
        },
        valueGetter: (_, row) => (row && row.bank_account_number) || "",
      },
      {
        field: "verified",
        headerName: "Status",
        minWidth: 120,
        renderCell: (params) => {
          const verified = !!params?.row?.verified;
          return verified ? (
            <Badge color="#065f46" bg="#d1fae5">Verified</Badge>
          ) : (
            <Badge>Pending</Badge>
          );
        },
        valueFormatter: (v) => (!!v ? "Verified" : "Pending"),
      },
      {
        field: "__actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        minWidth: 200,
        renderCell: (params) => {
          const r = params?.row || {};
          return (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!r.verified ? (
                <button
                  onClick={() => handleVerify(r)}
                  style={{
                    padding: "6px 10px",
                    background: "#059669",
                    color: "#fff",
                    border: 0,
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Verify
                </button>
              ) : null}
              <button
                onClick={() => handleReject(r)}
                style={{
                  padding: "6px 10px",
                  background: "#ef4444",
                  color: "#fff",
                  border: 0,
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Reject
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  // Server-side fetcher mapped to admin KYC endpoint
  const fetcher = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const params = { page, page_size: pageSize };
      // Merge active filters (omit empty)
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      // Map quick search to backend-supported "user" filter
      if (search && String(search).trim()) {
        params.user = String(search).trim();
      }
      // Pass ordering if backend supports it
      if (ordering) params.ordering = ordering;

      const res = await API.get("/admin/kyc/", { params });
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
        <h2 style={{ margin: 0, color: "#0f172a" }}>KYC Verification</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Review and decide user KYC. Use filters to find records quickly, and quick filter in the table toolbar.
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
        <Select
          label="Status"
          value={filters.status}
          onChange={(v) => setF("status", v)}
          options={statusOptions}
        />
        <TextInput
          label="User"
          value={filters.user}
          onChange={(v) => setF("user", v)}
          placeholder="user id / username / name / phone"
        />
        <TextInput
          label="State ID"
          value={filters.state}
          onChange={(v) => setF("state", v)}
          placeholder="numeric state id"
        />
        <TextInput
          label="Pincode"
          value={filters.pincode}
          onChange={(v) => setF("pincode", v)}
          placeholder="contains"
        />
        <TextInput
          label="Updated From"
          type="date"
          value={filters.date_from}
          onChange={(v) => setF("date_from", v)}
          placeholder=""
        />
        <TextInput
          label="Updated To"
          type="date"
          value={filters.date_to}
          onChange={(v) => setF("date_to", v)}
          placeholder=""
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
