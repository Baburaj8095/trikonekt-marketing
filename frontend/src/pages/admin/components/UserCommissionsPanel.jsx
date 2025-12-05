import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import API from "../../../api/api";
import DataTable from "../../../admin-panel/components/data/DataTable";

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#334155" }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  );
}

export default function UserCommissionsPanel({ open, onClose, userId, role, username }) {
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const latestFiltersRef = useRef({ status, dateFrom, dateTo });
  latestFiltersRef.current = { status, dateFrom, dateTo };

  const [summary, setSummary] = useState({
    counts: { earned: 0, paid: 0, reversed: 0, total: 0 },
    totals: { earned: "0.00", paid: "0.00", reversed: "0.00", total: "0.00" },
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  const resetFilters = () => {
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setRefreshKey((k) => k + 1);
  };

  const fetchSummary = useCallback(async () => {
    if (!open || !userId) return;
    const f = latestFiltersRef.current || {};
    const params = { recipient: userId };
    if ((role || "").trim()) params.role = String(role).trim();
    if ((f.status || "").trim()) params.status = f.status.trim();
    if ((f.dateFrom || "").trim()) params.date_from = f.dateFrom.trim();
    if ((f.dateTo || "").trim()) params.date_to = f.dateTo.trim();

    setSummaryLoading(true);
    try {
      const res = await API.get("/coupons/commissions/summary", {
        params,
        dedupe: "cancelPrevious",
        timeout: 12000,
      });
      const data = res?.data || {};
      setSummary({
        counts: data.counts || { earned: 0, paid: 0, reversed: 0, total: 0 },
        totals: data.totals || { earned: "0.00", paid: "0.00", reversed: "0.00", total: "0.00" },
      });
    } catch (_) {
      setSummary({
        counts: { earned: 0, paid: 0, reversed: 0, total: 0 },
        totals: { earned: "0.00", paid: "0.00", reversed: "0.00", total: "0.00" },
      });
    } finally {
      setSummaryLoading(false);
    }
  }, [open, userId, role]);

  useEffect(() => {
    if (open) {
      fetchSummary();
    }
  }, [open, fetchSummary, refreshKey, userId]);

  const fetcher = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      if (!open || !userId) return { results: [], count: 0 };
      const f = latestFiltersRef.current || {};
      const params = {
        page,
        page_size: pageSize,
        ordering,
        recipient: userId,
      };
      if ((role || "").trim()) params.role = String(role).trim();
      if ((search || "").trim()) params.search = search.trim();
      if ((f.status || "").trim()) params.status = f.status.trim();
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
    },
    [open, userId, role]
  );

  const columns = useMemo(() => {
    return [
      { field: "id", headerName: "ID", width: 90 },
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
      { field: "coupon_code", headerName: "Coupon Code", width: 160 },
      {
        field: "coupon_code_value",
        headerName: "Code Value",
        minWidth: 120,
        width: 140,
        renderCell: (p) => (p?.row?.coupon_code_value != null ? `₹${Number(p.row.coupon_code_value).toFixed(2)}` : "—"),
      },
    ];
  }, []);

  if (!open) return null;

  return (
    <div
      aria-label="User Commissions Drawer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        pointerEvents: "auto",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
        }}
      />
      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(860px, 96vw)",
          background: "#ffffff",
          borderLeft: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 24px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            Commissions — {username ? `${username}` : ""}{userId ? ` (#${userId})` : ""}{role ? ` [${role}]` : ""}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
            title="Close"
          >
            Close
          </button>
        </div>

        {/* KPI strip */}
        <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        </div>

        {/* Filters */}
        <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              onClick={() => { resetFilters(); fetchSummary(); }}
              style={{ height: 36, padding: "6px 12px", border: "none", borderRadius: 8, background: "#0ea5e9", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Body: DataTable */}
        <div style={{ padding: 12, overflow: "auto", flex: 1, minHeight: 0 }}>
          <DataTable
            key={`${userId}-${role}-${refreshKey}`}
            columns={columns}
            fetcher={fetcher}
            density="standard"
            checkboxSelection={false}
            toolbar={null}
            autoHeight={false}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 10,
            borderTop: "1px solid #e2e8f0",
            background: "#fff",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={fetchSummary}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
