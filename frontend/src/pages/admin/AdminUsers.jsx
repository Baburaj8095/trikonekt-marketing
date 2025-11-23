import React, { useCallback, useMemo, useState, useEffect } from "react";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";
import ModelFormDialog from "../../admin-panel/dynamic/ModelFormDialog";

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

export default function AdminUsers() {
  // Filters applied to server fetch
  const [filters, setFilters] = useState({
    role: "",
    phone: "",
    category: "",
    pincode: "",
    state: "",
    kyc: "",
  });
  const [density, setDensity] = useState("standard");
  const [reloadKey, setReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tempPw, setTempPw] = useState({});

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  const openEdit = useCallback(async (row) => {
    try {
      if (!row || !row.id) return;
      const res = await API.get(`/admin/users/${row.id}/`);
      const data = res?.data || row;
      setSelected({ id: row.id, ...data });
      setEditOpen(true);
    } catch {
      setSelected(row);
      setEditOpen(true);
    }
  }, []);

  // Dynamic admin edit fields: default fallback + fetch from backend meta
  const DEFAULT_EDIT_FIELDS = [
    { name: "email", type: "EmailField", required: false, label: "Email" },
    { name: "full_name", type: "CharField", required: false, label: "Full Name" },
    { name: "phone", type: "CharField", required: false, label: "Mobile" },
    { name: "pincode", type: "CharField", required: false, label: "Pincode" },
    { name: "country", type: "IntegerField", required: false, label: "Country (ID)" },
    { name: "state", type: "IntegerField", required: false, label: "State (ID)" },
    { name: "city", type: "IntegerField", required: false, label: "District/City (ID)" },
    { name: "role", type: "CharField", required: false, label: "Role" },
    { name: "category", type: "CharField", required: false, label: "Category" },
    { name: "is_active", type: "BooleanField", required: false, label: "Active" },
    { name: "password", type: "PasswordField", required: false, label: "Set New Password" },
  ];
  const [editFields, setEditFields] = useState(DEFAULT_EDIT_FIELDS);

  useEffect(() => {
    let mounted = true;
    // Cache edit-meta locally to prevent repeated fetches and avoid cancellations during dev StrictMode
    const LS_KEY = "admin.users.editMeta.json";
    const LS_TS_KEY = "admin.users.editMeta.ts";
    const TTL = 5 * 60 * 1000; // 5 minutes

    const mapPassword = (arr) =>
      arr.map((f) =>
        f && f.name === "password"
          ? { ...f, type: "PasswordField", required: false, label: f.label || "Set New Password" }
          : f
      );

    const readCached = () => {
      try {
        const ts = parseInt(localStorage.getItem(LS_TS_KEY) || "0", 10);
        if (ts && Date.now() - ts < TTL) {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data)) return data;
          }
        }
      } catch (_) {}
      return null;
    };

    const writeCached = (fields) => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(fields || []));
        localStorage.setItem(LS_TS_KEY, String(Date.now()));
      } catch (_) {}
    };

    // Serve cache first if fresh
    const cached = readCached();
    if (cached && mounted) {
      const mapped = mapPassword(cached);
      setEditFields(mapped.length ? mapped : DEFAULT_EDIT_FIELDS);
      return () => {
        mounted = false;
      };
    }

    // Network load with retry, timeout and dedupe disabled (to avoid "cancelled" due to StrictMode double invoke)
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;

    (async () => {
      try {
        const res = await API.get("/admin/users/edit-meta/", {
          timeout: 12000,
          retryAttempts: 1,
          dedupe: "none",
          signal: controller ? controller.signal : undefined,
          cacheTTL: 300000, // in-memory short cache as additional shield
        });
        const arr = res?.data?.fields;
        if (mounted && Array.isArray(arr) && arr.length) {
          const normalized = mapPassword(arr);
          setEditFields(normalized);
          writeCached(normalized);
        }
      } catch (_) {
        // fallback to default fields
      }
    })();

    return () => {
      mounted = false;
      try {
        controller && controller.abort();
      } catch (_) {}
    };
  }, []);

  const roleOptions = useMemo(
    () => [
      { value: "", label: "Any role" },
      { value: "user", label: "User" },
      { value: "agency", label: "Agency" },
      { value: "employee", label: "Employee" },
    ],
    []
  );

  const kycOptions = useMemo(
    () => [
      { value: "", label: "Any KYC" },
      { value: "pending", label: "KYC Pending" },
      { value: "verified", label: "KYC Verified" },
    ],
    []
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Any category" },
      { value: "consumer", label: "consumer" },
      { value: "employee", label: "employee" },
      { value: "agency_state_coordinator", label: "agency_state_coordinator" },
      { value: "agency_state", label: "agency_state" },
      { value: "agency_district_coordinator", label: "agency_district_coordinator" },
      { value: "agency_district", label: "agency_district" },
      { value: "agency_pincode_coordinator", label: "agency_pincode_coordinator" },
      { value: "agency_pincode", label: "agency_pincode" },
      { value: "agency_sub_franchise", label: "agency_sub_franchise" },
    ],
    []
  );

  // DataGrid columns (flex + minWidth for responsive)
  const columns = useMemo(
    () => [
      {
        field: "avatar",
        headerName: "Profile",
        minWidth: 80,
        renderCell: (params) => {
          const url = params?.row?.avatar_url;
          return url ? (
            <img src={url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid #e2e8f0" }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e2e8f0", display: "inline-block" }} />
          );
        },
      },
      {
        field: "username",
        headerName: "Username",
        minWidth: 160,
        flex: 1,
        renderCell: (params) => {
          const row = params?.row || {};
          const uname = row.username || "—";

          const onLogin = async (e) => {
            e?.stopPropagation?.();
            try {
              if (!row?.id) return;
              const res = await API.post(`/admin/users/${row.id}/impersonate/`);
              const { access, refresh, role } = res?.data || {};
              if (!access || !refresh) return;
              // Robust namespace detection: use API role or row.role/category
              const r = String(role || row?.role || "").toLowerCase();
              const c = String(row?.category || "").toLowerCase();
              const pickNs = (s) => (s.startsWith("agency") ? "agency" : s.startsWith("employee") ? "employee" : "");
              let ns = pickNs(r) || pickNs(c) || (r === "agency" ? "agency" : r === "employee" ? "employee" : "user");
              const base = ns === "user" ? "" : `/${ns}`;
              const url = `${base}/impersonate?access=${encodeURIComponent(access)}&refresh=${encodeURIComponent(refresh)}&ns=${encodeURIComponent(ns)}`;
              window.location.assign(url);
            } catch (_) {}
          };

          return (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => openEdit(row)}
                style={{ color: "#0ea5e9", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                title="Edit user"
              >
                {uname}
              </button>
              <button
                type="button"
                onClick={onLogin}
                title="Login as this TR"
                style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", background: "#fff", cursor: "pointer" }}
              >
                🔑
              </button>
            </div>
          );
        },
      },
      { field: "full_name", headerName: "Full Name", minWidth: 180, flex: 1 },
      { field: "sponsor_id", headerName: "Sponsor ID", minWidth: 160 },
      { field: "phone", headerName: "Mobile", minWidth: 140 },
      { field: "email", headerName: "Email", minWidth: 200, flex: 1 },
      { field: "pincode", headerName: "Pincode", minWidth: 110 },
      { field: "district_name", headerName: "District", minWidth: 150 },
      { field: "state_name", headerName: "State", minWidth: 150 },
      { field: "country_name", headerName: "Country", minWidth: 150 },
      {
        field: "wallet_balance",
        headerName: "Wallet",
        minWidth: 120,
        valueFormatter: (v) => {
          const num = Number(v);
          if (Number.isFinite(num)) return num.toFixed(2);
          return String(v || "");
        },
      },
      { field: "wallet_status", headerName: "Wallet Status", minWidth: 140 },
      {
        field: "date_joined",
        headerName: "Joined",
        minWidth: 180,
        valueFormatter: (v) => {
          if (!v) return "";
          try { return new Date(v).toLocaleString(); } catch (_) { return String(v); }
        },
      },
      {
        field: "is_active",
        headerName: "Status",
        minWidth: 150,
        renderCell: (params) => {
          const row = params?.row || {};
          const checked = !!row.is_active;
          const onToggle = async (e) => {
            e?.stopPropagation?.();
            try {
              await API.patch(`/admin/users/${row.id}/`, { is_active: !checked });
              setReloadKey((k) => k + 1);
            } catch (_) {}
          };
          return (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={onToggle}
                onClick={(e) => e.stopPropagation()}
              />
              <span>{checked ? "Active" : "Inactive"}</span>
            </label>
          );
        },
      },
    ],
    [openEdit, setReloadKey, tempPw]
  );

  // Server-side fetcher for DataTable
  const fetcher = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const params = { page, page_size: pageSize };
      // merge active filters
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      if (search && String(search).trim()) params.search = String(search).trim();
      if (ordering) params.ordering = ordering;

      const res = await API.get("/admin/users/", { params });
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
        <h2 style={{ margin: 0, color: "#0f172a" }}>Users</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Filter and browse users. Use the search box in the table toolbar to quickly find specific entries.
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
          label="Role"
          value={filters.role}
          onChange={(v) => setF("role", v)}
          options={roleOptions}
        />
        <Select
          label="Category"
          value={filters.category}
          onChange={(v) => setF("category", v)}
          options={categoryOptions}
        />
        <TextInput
          label="Phone"
          value={filters.phone}
          onChange={(v) => setF("phone", v)}
          placeholder="digits/contains"
        />
        <TextInput
          label="Pincode"
          value={filters.pincode}
          onChange={(v) => setF("pincode", v)}
          placeholder="exact or contains"
        />
        <TextInput
          label="State ID"
          value={filters.state}
          onChange={(v) => setF("state", v)}
          placeholder="numeric state pk"
        />
        <Select
          label="KYC"
          value={filters.kyc}
          onChange={(v) => setF("kyc", v)}
          options={kycOptions}
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
      <ModelFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        route="/admin/users/"
        record={selected}
        fields={editFields}
        onSaved={() => setReloadKey((k) => k + 1)}
        title={selected ? `Edit ${selected.username || selected.full_name || selected.id}` : "Edit User"}
      />
    </div>
  );
}
