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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function fetchKyc() {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      const res = await API.get("/admin/kyc/", { params });
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load KYC");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKyc();
  }, []);

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
      await fetchKyc();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to verify KYC");
    }
  }

  async function handleReject(row) {
    if (!window.confirm(`Reject KYC for ${row.username}?`)) return;
    try {
      await API.patch(`/admin/kyc/${row.user_id}/reject/`);
      await fetchKyc();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to reject KYC");
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>KYC Verification</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Review and decide user KYC. Use filters to find records quickly.
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

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={fetchKyc}
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
          onClick={() =>
            setFilters({
              status: "pending",
              user: "",
              state: "",
              pincode: "",
              date_from: "",
              date_to: "",
            })
          }
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
              "110px 160px 1fr 120px 120px 160px 120px 220px",
            gap: 8,
            padding: "10px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          <div>UserID</div>
          <div>Username</div>
          <div>Full Name</div>
          <div>Phone</div>
          <div>Pincode</div>
          <div>Bank</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div>
          {rows.map((r) => {
            const statusBadge = r.verified ? (
              <Badge color="#065f46" bg="#d1fae5">
                Verified
              </Badge>
            ) : (
              <Badge>Pending</Badge>
            );
            return (
              <div
                key={r.user_id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "110px 160px 1fr 120px 120px 160px 120px 220px",
                  gap: 8,
                  padding: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  alignItems: "center",
                }}
              >
                <div>{r.user_id}</div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.username}
                </div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.full_name || "—"}
                </div>
                <div>{r.phone || "—"}</div>
                <div>{r.pincode || "—"}</div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.bank_name ? `${r.bank_name} (${r.ifsc_code})` : "—"}
                </div>
                <div>{statusBadge}</div>
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
              </div>
            );
          })}
          {!loading && rows.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b" }}>No results</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
