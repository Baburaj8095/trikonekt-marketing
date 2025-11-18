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

function humanDate(x) {
  try {
    return x ? new Date(x).toLocaleString() : "";
  } catch {
    return String(x || "");
  }
}

export default function AdminLuckyDraw() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState({
    search: "",
    pincode: "",
    status: "",
  });

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      // Staff users receive all submissions
      const res = await API.get("/uploads/lucky-draw/");
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load Lucky Draw submissions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line
  }, []);

  const statusOptions = [
    { value: "", label: "Any" },
    { value: "SUBMITTED", label: "SUBMITTED" },
    { value: "TRE_APPROVED", label: "TRE_APPROVED" },
    { value: "TRE_REJECTED", label: "TRE_REJECTED" },
    { value: "AGENCY_APPROVED", label: "AGENCY_APPROVED" },
    { value: "AGENCY_REJECTED", label: "AGENCY_REJECTED" },
  ];

  const shown = useMemo(() => {
    const s = (filters.search || "").trim().toLowerCase();
    const pin = (filters.pincode || "").trim().toLowerCase();
    const st = (filters.status || "").trim().toUpperCase();
    return (rows || []).filter((r) => {
      const okSearch =
        !s ||
        String(r.id || "").includes(s) ||
        String(r.username || "").toLowerCase().includes(s) ||
        String(r.phone || "").toLowerCase().includes(s) ||
        String(r.sl_number || "").toLowerCase().includes(s) ||
        String(r.ledger_number || "").toLowerCase().includes(s) ||
        String(r.agency_name || "").toLowerCase().includes(s) ||
        String(r.coupon_purchaser_name || "").toLowerCase().includes(s);
      const okPin = !pin || String(r.pincode || "").toLowerCase().includes(pin);
      const okStatus = !st || String(r.status || "").toUpperCase() === st;
      return okSearch && okPin && okStatus;
    });
  }, [rows, filters]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Manual Coupon Submissions</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Staff overview of all submissions (read-only). Approvals are performed by TRE/Agency roles in their respective apps.
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
          value={filters.search}
          onChange={(v) => setF("search", v)}
          placeholder="id / username / phone / SL / Ledger / Agency / Purchaser"
        />
        <TextInput
          label="Pincode"
          value={filters.pincode}
          onChange={(v) => setF("pincode", v)}
          placeholder="e.g., 560001"
        />
        <Select
          label="Status"
          value={filters.status}
          onChange={(v) => setF("status", v)}
          options={statusOptions}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={fetchRows}
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
          onClick={() => setFilters({ search: "", pincode: "", status: "" })}
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
          Reset Filters
        </button>
        {err ? <div style={{ color: "#dc2626" }}>{err}</div> : null}
      </div>

      {/* Listing */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              minWidth: 1100,
              display: "grid",
              gridTemplateColumns:
                "80px 140px 120px 120px 130px 120px 120px 160px 140px",
              gap: 8,
              padding: "10px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            <div>ID</div>
            <div>User</div>
            <div>Phone</div>
            <div>Pincode</div>
            <div>Status</div>
            <div>SL No.</div>
            <div>Ledger No.</div>
            <div>Agency</div>
            <div>Created</div>
          </div>
          <div>
            {shown.map((r) => (
              <div
                key={r.id}
                style={{
                  minWidth: 1100,
                  display: "grid",
                  gridTemplateColumns:
                    "80px 140px 120px 120px 130px 120px 120px 160px 140px",
                  gap: 8,
                  padding: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  alignItems: "center",
                }}
              >
                <div>#{r.id}</div>
                <div title={r.username || ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.username || "—"}
                </div>
                <div>{r.phone || "—"}</div>
                <div>{r.pincode || "—"}</div>
                <div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      color:
                        r.status === "AGENCY_APPROVED" || r.status === "TRE_APPROVED"
                          ? "#065f46"
                          : r.status && r.status.includes("REJECTED")
                          ? "#991b1b"
                          : "#0f172a",
                      background:
                        r.status === "AGENCY_APPROVED" || r.status === "TRE_APPROVED"
                          ? "#d1fae5"
                          : r.status && r.status.includes("REJECTED")
                          ? "#fee2e2"
                          : "#f1f5f9",
                      border:
                        r.status === "AGENCY_APPROVED" || r.status === "TRE_APPROVED"
                          ? "1px solid #10b98130"
                          : r.status && r.status.includes("REJECTED")
                          ? "1px solid #ef444430"
                          : "1px solid #e2e8f0",
                    }}
                  >
                    {r.status || "—"}
                  </span>
                </div>
                <div>{r.sl_number || "—"}</div>
                <div>{r.ledger_number || "—"}</div>
                <div title={r.agency_name || ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.agency_name || "—"}
                </div>
                <div>{humanDate(r.created_at)}</div>
              </div>
            ))}
            {!loading && shown.length === 0 ? (
              <div style={{ padding: 12, color: "#64748b" }}>No results</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
