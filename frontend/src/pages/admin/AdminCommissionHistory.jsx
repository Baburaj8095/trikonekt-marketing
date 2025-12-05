import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#334155" }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

export default function AdminCommissionHistory() {
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [recipient, setRecipient] = useState("");
  const [code, setCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const latestFiltersRef = useRef({ role, status, recipient, code, dateFrom, dateTo });
  latestFiltersRef.current = { role, status, recipient, code, dateFrom, dateTo };

  const location = useLocation();
  const initRef = useRef(false);

  const [summary, setSummary] = useState({
    counts: { earned: 0, paid: 0, reversed: 0, total: 0 },
    totals: { earned: "0.00", paid: "0.00", reversed: "0.00", total: "0.00" },
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    const f = latestFiltersRef.current || {};
    const params = {};
    if ((f.role || "").trim()) params.role = f.role.trim();
    if ((f.status || "").trim()) params.status = f.status.trim();
    if ((f.recipient || "").trim()) params.recipient = f.recipient.trim();
    if ((f.code || "").trim()) params.code = f.code.trim();
    if ((f.dateFrom || "").trim()) params.date_from = f.dateFrom.trim();
    if ((f.dateTo || "").trim()) params.date_to = f.dateTo.trim();
    setSummaryLoading(true);
    try {
      const res = await API.get("/coupons/commissions/summary", {
        params,
        dedupe: "cancelPrevious",
        timeout: 15000,
      });
      const data = res?.data || {};
      setSummary({
        counts: data.counts || { earned: 0, paid: 0, reversed: 0, total: 0 },
        totals: data.totals || { earned: "0.00", paid: "0.00", reversed: "0.00", total: "0.00" },
      });
    } catch (e) {
      setSummary({
        counts: { earned: 0, paid: 0, reversed: 0, total: 0 },
        totals: { earned: "0.00", paid: "0.00", reversed: "0.00", total: "0.00" },
      });
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    try {
      const params = new URLSearchParams(location.search || "");
      const roleQ = params.get("role") || "";
      const statusQ = params.get("status") || "";
      const recipientQ = params.get("recipient") || params.get("recipient_id") || params.get("recipient_username") || "";
      const codeQ = params.get("code") || "";
      const fromQ = params.get("date_from") || params.get("from") || "";
      const toQ = params.get("date_to") || params.get("to") || "";
      if (roleQ || statusQ || recipientQ || codeQ || fromQ || toQ) {
        setRole(roleQ);
        setStatus(statusQ);
        setRecipient(recipientQ);
        setCode(codeQ);
        setDateFrom(fromQ);
        setDateTo(toQ);
        setRefreshKey((k) => k + 1);
        setTimeout(() => fetchSummary(), 0);
        return;
      }
    } catch (_) {}
    setTimeout(() => fetchSummary(), 0);
  }, [location.search, fetchSummary]);

  const fetcher = useCallback(async ({ page, pageSize, search, ordering }) => {
    const f = latestFiltersRef.current || {};
    const params = {
      page,
      page_size: pageSize,
      ordering,
    };
    if ((search || "").trim()) params.search = search.trim();
    if ((f.role || "").trim()) params.role = f.role.trim();
    if ((f.status || "").trim()) params.status = f.status.trim();
    if ((f.recipient || "").trim()) params.recipient = f.recipient.trim(); // id or username
    if ((f.code || "").trim()) params.code = f.code.trim(); // coupon code or submission code
    if ((f.dateFrom || "").trim()) params.date_from = f.dateFrom.trim();
    if ((f.dateTo || "").trim()) params.date_to = f.dateTo.trim();

    const res = await API.get("/coupons/commissions/", {
      params,
      dedupe: "cancelPrevious",
      timeout: 20000,
    });
    const data = res?.data || {};
    return {
      results: data.results || data || [],
      count: data.count || 0,
    };
  }, []);

  const handleReset = () => {
    setRole("");
    setStatus("");
    setRecipient("");
    setCode("");
    setDateFrom("");
    setDateTo("");
    setRefreshKey((k) => k + 1);
    fetchSummary();
  };

  const columns = useMemo(() => {
    return [
      { field: "id", headerName: "ID", width: 90 },
      { field: "recipient_username", headerName: "Recipient", minWidth: 160, flex: 1 },
      { field: "recipient", headerName: "Recipient ID", minWidth: 110, width: 140 },
      { field: "role", headerName: "Role", width: 120 },
      {
        field: "amount",
        headerName: "Amount",
        minWidth: 120,
        width: 160,
        renderCell: (params) => {
          const v = Number(params?.row?.amount ?? 0);
          return `₹${v.toFixed(2)}`;
        },
      },
      { field: "status", headerName: "Status", width: 120 },
      { field: "earned_at", headerName: "Earned At", minWidth: 180, width: 220 },
      { field: "paid_at", headerName: "Paid At", minWidth: 180, width: 220 },
      { field: "submission_id", headerName: "Submission ID", width: 140 },
      { field: "coupon_code", headerName: "CouponCode ID", width: 140 },
      {
        field: "coupon_code_value",
        headerName: "Code Value",
        minWidth: 120,
        width: 140,
        renderCell: (p) => (p?.row?.coupon_code_value != null ? `₹${Number(p.row.coupon_code_value).toFixed(2)}` : "—"),
      },
      {
        field: "__actions",
        headerName: "Actions",
        minWidth: 160,
        width: 180,
        renderCell: (params) => {
          const row = params?.row || {};
          const disabled = String(row.status).toLowerCase() !== "earned";
          return (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={disabled}
                onClick={async () => {
                  try {
                    await API.post(`/coupons/commissions/${row.id}/mark-paid/`, {});
                    setRefreshKey((k) => k + 1);
                  } catch (e) {
                    // no-op
                  }
                }}
                style={{
                  padding: "6px 10px",
                  background: disabled ? "#e5e7eb" : "#059669",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                title={disabled ? "Only 'earned' can be marked as paid" : "Mark as Paid"}
              >
                Mark Paid
              </button>
            </div>
          );
        },
      },
    ];
  }, []);

  const toolbar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Field label="Role">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ padding: 8, minWidth: 140, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
        >
          <option value="">All</option>
          <option value="agency">Agency</option>
          <option value="employee">Employee</option>
        </select>
      </Field>
      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: 8, minWidth: 140, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
        >
          <option value="">All</option>
          <option value="earned">Earned</option>
          <option value="paid">Paid</option>
          <option value="reversed">Reversed</option>
        </select>
      </Field>
      <Field label="Recipient (ID or Username)">
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="e.g., 42 or AG123"
          style={{ padding: 8, minWidth: 180, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
        />
      </Field>
      <Field label="Coupon/Submission Code">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Coupon code string"
          style={{ padding: 8, minWidth: 180, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
        />
      </Field>
      <Field label="From">
        <input
          type="datetime-local"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{ padding: 8, minWidth: 190, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
        />
      </Field>
      <Field label="To">
        <input
          type="datetime-local"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{ padding: 8, minWidth: 190, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" }}
        />
      </Field>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <button
          onClick={() => { setRefreshKey((k) => k + 1); fetchSummary(); }}
          style={{ height: 36, padding: "6px 12px", border: "none", borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          Apply
        </button>
        <button
          onClick={handleReset}
          style={{ height: 36, padding: "6px 12px", border: "none", borderRadius: 8, background: "#0ea5e9", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          Reset
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Commission History</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Complete commission log for agencies and employees with filters and mark-paid action.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ padding: 10, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Earned</div>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>{summary.counts.earned} • ₹{summary.totals.earned}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Paid</div>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>{summary.counts.paid} • ₹{summary.totals.paid}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Reversed</div>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>{summary.counts.reversed} • ₹{summary.totals.reversed}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Total</div>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>{summary.counts.total} • ₹{summary.totals.total}</div>
        </div>
        {summaryLoading ? <div style={{ color: "#64748b", fontSize: 12, alignSelf: "center" }}>Refreshing...</div> : null}
      </div>

      <DataTable
        key={refreshKey}
        columns={columns}
        fetcher={fetcher}
        density="standard"
        toolbar={toolbar}
        checkboxSelection={false}
        columnVisibilityModel={{ coupon_code_value: true }}
      />
      <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
        Note: Consumer earnings are credited via wallet transactions and are not part of the Commission model.
        Use wallet reports to view consumer payouts.
      </div>
    </div>
  );
}
