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
  const [filters, setFilters] = useState({
    role: "",
    phone: "",
    category: "",
    pincode: "",
    state: "",
    kyc: "",
    search: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // Mobile detection for responsiveness
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function fetchUsers() {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      const res = await API.get("/admin/users/", { params });
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load users");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
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

  function MobileRow({ u }) {
    function Item({ label, value }) {
      return (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 88, color: "#64748b", fontSize: 12, flexShrink: 0 }}>
            {label}
          </div>
          <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
            {value}
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          borderBottom: "1px solid #e2e8f0",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>#{u.id}</div>
        </div>
        <Item label="Username" value={u.username} />
        <Item label="Full Name" value={u.full_name || "—"} />
        <Item label="Role" value={u.role || "—"} />
        <Item label="Category" value={u.category || "—"} />
        <Item label="Phone" value={u.phone || "—"} />
        <Item label="Pincode" value={u.pincode || "—"} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Users</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Filter and browse users. Click the User Tree tab for hierarchy.
        </div>
      </div>

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
        <TextInput
          label="Search"
          value={filters.search}
          onChange={(v) => setF("search", v)}
          placeholder="username / full name / email / unique_id"
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={fetchUsers}
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
          {loading ? "Loading..." : "Apply Filters"}
        </button>
        <button
          onClick={() => {
            setFilters({
              role: "",
              phone: "",
              category: "",
              pincode: "",
              state: "",
              kyc: "",
              search: "",
            });
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

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {!isMobile ? (
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                minWidth: 900,
                display: "grid",
                gridTemplateColumns: "80px 160px 1fr 120px 120px 120px 120px",
                gap: 8,
                padding: "10px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <div>ID</div>
              <div>Username</div>
              <div>Full Name</div>
              <div>Role</div>
              <div>Category</div>
              <div>Phone</div>
              <div>Pincode</div>
            </div>
            <div>
              {rows.map((u) => (
                <div
                  key={u.id}
                  style={{
                    minWidth: 900,
                    display: "grid",
                    gridTemplateColumns: "80px 160px 1fr 120px 120px 120px 120px",
                    gap: 8,
                    padding: "10px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <div>{u.id}</div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.username}
                  </div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.full_name || "—"}
                  </div>
                  <div>{u.role || "—"}</div>
                  <div>{u.category || "—"}</div>
                  <div>{u.phone || "—"}</div>
                  <div>{u.pincode || "—"}</div>
                </div>
              ))}
              {!loading && rows.length === 0 ? (
                <div style={{ padding: 12, color: "#64748b" }}>No results</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div>
            {rows.map((u) => (
              <MobileRow key={u.id} u={u} />
            ))}
            {!loading && rows.length === 0 ? (
              <div style={{ padding: 12, color: "#64748b" }}>No results</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
