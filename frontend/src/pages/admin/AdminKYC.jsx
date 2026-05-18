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
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1px 6px",
        lineHeight: 1,
        height: 18,
        fontSize: 10,
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

const FRANCHISE_CATEGORY_OPTIONS = [
  { value: "", label: "All franchise levels" },
  { value: "agency_state_coordinator", label: "State Coordinator" },
  { value: "agency_state", label: "State" },
  { value: "agency_district_coordinator", label: "District Coordinator" },
  { value: "agency_district", label: "District" },
  { value: "agency_pincode_coordinator", label: "Pincode Coordinator" },
  { value: "agency_pincode", label: "Pincode" },
];

function categoryLabel(value) {
  const option = FRANCHISE_CATEGORY_OPTIONS.find((item) => item.value === value);
  return option?.label || value || "";
}

export default function AdminKYC({ audience = "consumer" }) {
  const isFranchise = audience === "franchise";
  // View mode bifurcation: 'kyc' vs 'nominee'
  const [viewMode, setViewMode] = useState("kyc"); // 'kyc' | 'nominee'

  // KYC filters
  const [kycFilters, setKycFilters] = useState({
    status: "submitted", // default tab
    user: "",
    state: "",
    pincode: "",
    category: "",
    date_from: "",
    date_to: "",
  });

  // Nominee filters (aligned to UserNominee fields where possible)
  const [nomineeFilters, setNomineeFilters] = useState({
    user: "",
    name: "",
    relationship: "",
    date_from: "",
    date_to: "",
    status: "", // e.g. "completed" | "incomplete" (backend optional)
  });

  const [density, setDensity] = useState("standard");
  const [reloadKeyKyc, setReloadKeyKyc] = useState(0);
  const [reloadKeyNominee, setReloadKeyNominee] = useState(0);

  function setKycF(key, val) {
    setKycFilters((f) => ({ ...f, [key]: val }));
  }
  function setNomineeF(key, val) {
    setNomineeFilters((f) => ({ ...f, [key]: val }));
  }

  const statusOptions = useMemo(
    () => [
      { value: "", label: "Any" },
      { value: "pending", label: "Pending" },
      { value: "submitted", label: "Submitted" },
      { value: "verified", label: "Verified" },
    ],
    []
  );

  const nomineeRelationshipOptions = useMemo(
    () => [
      { value: "", label: "Any" },
      { value: "Spouse", label: "Spouse" },
      { value: "Parent", label: "Parent" },
      { value: "Child", label: "Child" },
      { value: "Sibling", label: "Sibling" },
      { value: "Other", label: "Other" },
    ],
    []
  );

  const nomineeStatusOptions = useMemo(
    () => [
      { value: "", label: "Any" },
      { value: "completed", label: "Completed" },
      { value: "incomplete", label: "Incomplete" },
    ],
    []
  );

  async function handleVerify(row) {
    if (!window.confirm(`Verify KYC for ${row.username}?`)) return;
    try {
      await API.patch(`/admin/kyc/${row.user_id}/verify/`);
      setReloadKeyKyc((k) => k + 1);
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to verify KYC");
    }
  }

  async function handleReject(row) {
    if (!window.confirm(`Reject KYC for ${row.username}?`)) return;
    try {
      await API.patch(`/admin/kyc/${row.user_id}/reject/`);
      setReloadKeyKyc((k) => k + 1);
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to reject KYC");
    }
  }

  // KYC DataGrid columns (responsive with flex + minWidth)
  const columnsKyc = useMemo(
    () => [
      { field: "user_id", headerName: "UserID", minWidth: 110 },
      { field: "username", headerName: "Username", minWidth: 160, flex: 1 },
      { field: "full_name", headerName: "Full Name", minWidth: 200, flex: 1 },
      { field: "phone", headerName: "Phone", minWidth: 140 },
      ...(isFranchise
        ? [
            {
              field: "category",
              headerName: "Franchise Level",
              minWidth: 190,
              renderCell: (params) => categoryLabel(params?.row?.category),
              valueGetter: (_, row) => categoryLabel(row?.category),
            },
          ]
        : []),
      { field: "pincode", headerName: "Pincode", minWidth: 120 },
      {
        field: "bank",
        headerName: "Bank",
        minWidth: 200,
        renderCell: (params) => {
          const r = params?.row || {};
          return r.bank_name ? `${r.bank_name} (${r.ifsc_code})` : "";
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
          if (!s) return "";
          if (s.length <= 4) return s;
          return s;
        },
        valueGetter: (_, row) => (row && row.bank_account_number) || "",
      },
      {
        field: "verified",
        headerName: "Status",
        minWidth: 120,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          const verified = !!params?.row?.verified;
          return verified ? <Badge color="#065f46" bg="#d1fae5">Verified</Badge> : <Badge>Pending</Badge>;
        },
        valueFormatter: (v) => (!!v ? "Verified" : "Pending"),
      },
      {
        field: "__actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        minWidth: 200,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          const r = params?.row || {};
          return (
            <div style={{ display: "flex", gap: 8, width: "100%", height: "100%", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
              {!r.verified ? (
                <button
                  onClick={() => handleVerify(r)}
                  style={{
                    padding: "4px 8px",
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
                  padding: "4px 8px",
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
    [isFranchise]
  );

  // Nominee DataGrid columns (aligned with accounts.UserNomineeSerializer; admin endpoint may include user fields optionally)
  const columnsNominee = useMemo(
    () => [
      // Show user info if admin endpoint provides it; falls back to empty if not present
      { field: "user_id", headerName: "UserID", minWidth: 100 },
      { field: "username", headerName: "Username", minWidth: 160, flex: 1 },

      // Core nominee fields from accounts.UserNomineeSerializer
      { field: "name", headerName: "Nominee Name", minWidth: 200, flex: 1 },
      { field: "relationship", headerName: "Relationship", minWidth: 140 },
      { field: "phone", headerName: "Phone", minWidth: 140 },
      { field: "share_percent", headerName: "Share %", minWidth: 100, align: "right", headerAlign: "right",
        valueFormatter: (v) => (v == null || v === "" ? "" : `${v}%`) },

      // Timestamps
      { field: "updated_at", headerName: "Updated At", minWidth: 180 },
      { field: "created_at", headerName: "Created At", minWidth: 180 },

      // Optional status column if backend provides
      { field: "status", headerName: "Status", minWidth: 120, align: "center", headerAlign: "center",
        renderCell: (params) => {
          const status = String(params?.row?.status || "").toLowerCase();
          if (status === "completed") return <Badge color="#065f46" bg="#d1fae5">Completed</Badge>;
          if (status === "incomplete") return <Badge color="#92400e" bg="#fef3c7">Incomplete</Badge>;
          return String(params?.row?.status || "");
        },
      },
    ],
    []
  );

  // Server-side fetchers
  const fetcherKyc = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const params = { page, page_size: pageSize };
      params.audience = isFranchise ? "franchise" : "consumer";
      // Merge active filters (omit empty)
      Object.entries(kycFilters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      // Map quick search to backend-supported "user" filter
      if (search && String(search).trim()) {
        params.user = String(search).trim();
      }
      if (ordering) params.ordering = ordering;

      const res = await API.get("/admin/kyc/", { params });
      const data = res?.data;
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const count = typeof data?.count === "number" ? data.count : results.length;
      return { results, count };
    },
    [isFranchise, kycFilters, reloadKeyKyc]
  );

  // Note: This expects an admin endpoint to list nominee records. If not present yet,
  // backend should implement GET /admin/nominees/ returning {count, results}.
  // We map search to both user and name so backend can choose which to honor.
  const fetcherNominee = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const params = { page, page_size: pageSize };
      Object.entries(nomineeFilters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      if (search && String(search).trim()) {
        params.user = String(search).trim();
        params.name = String(search).trim();
      }
      if (ordering) params.ordering = ordering;

      const res = await API.get("/admin/nominees/", { params });
      const data = res?.data;
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const count = typeof data?.count === "number" ? data.count : results.length;
      return { results, count };
    },
    [nomineeFilters, reloadKeyNominee]
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
        onClick={() => (viewMode === "kyc" ? setReloadKeyKyc((k) => k + 1) : setReloadKeyNominee((k) => k + 1))}
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
      {/* Page header + view toggle */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, color: "#0f172a" }}>{viewMode === "kyc" ? (isFranchise ? "Franchise KYC Verification" : "KYC Verification") : "Nominee Details"}</h2>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            {viewMode === "kyc"
              ? isFranchise
                ? "Review only franchise hierarchy KYC records. Consumer KYC is excluded from this workspace."
                : "Review and decide consumer KYC. Use filters to find records quickly, and quick filter in the table toolbar."
              : "Review consumer nominee details. Use filters to find records quickly, and quick filter in the table toolbar."}
          </div>
        </div>
        <div
          role="tablist"
          aria-label="View mode"
          style={{ display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}
        >
          <button
            role="tab"
            aria-selected={viewMode === "kyc"}
            onClick={() => setViewMode("kyc")}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              background: viewMode === "kyc" ? "#0f172a" : "#fff",
              color: viewMode === "kyc" ? "#fff" : "#0f172a",
              border: 0,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            KYC
          </button>
          <button
            role="tab"
            aria-selected={viewMode === "nominee"}
            onClick={() => setViewMode("nominee")}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              background: viewMode === "nominee" ? "#0f172a" : "#fff",
              color: viewMode === "nominee" ? "#fff" : "#0f172a",
              border: 0,
              borderLeft: "1px solid #e5e7eb",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Nominee
          </button>
        </div>
      </div>

      {/* Filters */}
      {viewMode === "kyc" ? (
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
            value={kycFilters.status}
            onChange={(v) => setKycF("status", v)}
            options={statusOptions}
          />
          <TextInput
            label="User"
            value={kycFilters.user}
            onChange={(v) => setKycF("user", v)}
            placeholder="user id / username / name / phone"
          />
          <TextInput
            label="State ID"
            value={kycFilters.state}
            onChange={(v) => setKycF("state", v)}
            placeholder="numeric state id"
          />
          <TextInput
            label="Pincode"
            value={kycFilters.pincode}
            onChange={(v) => setKycF("pincode", v)}
            placeholder="contains"
          />
          {isFranchise ? (
            <Select
              label="Franchise Level"
              value={kycFilters.category}
              onChange={(v) => setKycF("category", v)}
              options={FRANCHISE_CATEGORY_OPTIONS}
            />
          ) : null}
          <TextInput
            label="Updated From"
            type="date"
            value={kycFilters.date_from}
            onChange={(v) => setKycF("date_from", v)}
            placeholder=""
          />
          <TextInput
            label="Updated To"
            type="date"
            value={kycFilters.date_to}
            onChange={(v) => setKycF("date_to", v)}
            placeholder=""
          />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <TextInput
            label="User"
            value={nomineeFilters.user}
            onChange={(v) => setNomineeF("user", v)}
            placeholder="user id / username (if supported by backend)"
          />
          <TextInput
            label="Nominee Name"
            value={nomineeFilters.name}
            onChange={(v) => setNomineeF("name", v)}
            placeholder="full or partial name"
          />
          <Select
            label="Relationship"
            value={nomineeFilters.relationship}
            onChange={(v) => setNomineeF("relationship", v)}
            options={nomineeRelationshipOptions}
          />
          <Select
            label="Status"
            value={nomineeFilters.status}
            onChange={(v) => setNomineeF("status", v)}
            options={nomineeStatusOptions}
          />
          <TextInput
            label="Updated From"
            type="date"
            value={nomineeFilters.date_from}
            onChange={(v) => setNomineeF("date_from", v)}
            placeholder=""
          />
          <TextInput
            label="Updated To"
            type="date"
            value={nomineeFilters.date_to}
            onChange={(v) => setNomineeF("date_to", v)}
            placeholder=""
          />
        </div>
      )}

      {/* Table */}
      {viewMode === "kyc" ? (
        <DataTable
          columns={columnsKyc}
          fetcher={fetcherKyc}
          density={density}
          toolbar={toolbar}
          checkboxSelection={true}
          onSelectionChange={() => {}}
          instanceKey="kyc"
          extraKey={String(reloadKeyKyc)}
        />
      ) : (
        <DataTable
          columns={columnsNominee}
          fetcher={fetcherNominee}
          density={density}
          toolbar={toolbar}
          checkboxSelection={true}
          onSelectionChange={() => {}}
          instanceKey="nominee"
          extraKey={String(reloadKeyNominee)}
        />
      )}
    </div>
  );
}
