import React, { useEffect, useMemo, useState } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import API from "../../api/api";

function q2(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return 0;
  // Match backend style: 2 decimals
  return Math.floor(x * 100) / 100;
}

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

function Badge({ children, color = "#1f2937", bg = "#e5e7eb" }) {
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

function PrimaryButton({ children, disabled, onClick, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        background: "#0f172a",
        color: "#fff",
        border: 0,
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, disabled, onClick, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        background: "#fff",
        color: "#0f172a",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ActionButton({ children, onClick, disabled, variant = "neutral" }) {
  const stylesByVariant = {
    approve: { background: "#059669", color: "#fff" },
    reject: { background: "#ef4444", color: "#fff" },
    neutral: { background: "#0f172a", color: "#fff" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        border: 0,
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        ...stylesByVariant[variant],
      }}
    >
      {children}
    </button>
  );
}

export default function AdminWithdrawals() {
  // Breakpoints
  // Mobile: <600px, Tablet: 600-1024px, Desktop: >1024px
  const isMobile = useMediaQuery("(max-width:599.95px)");
  const isDesktop = useMediaQuery("(min-width:1024.05px)");

  const [filters, setFilters] = useState({
    status: "pending",
    user: "",
    date_from: "",
    date_to: "",
    min_amount: "",
    max_amount: "",
    method: "",
    ordering: "-requested_at",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Withdrawal tax percent (TDS) configured by admin
  const [withdrawTaxPercent, setWithdrawTaxPercent] = useState(0);

  // Admin-configurable withdrawals window
  const weekdayOptions = useMemo(
    () => [
      { value: 0, label: "Monday" },
      { value: 1, label: "Tuesday" },
      { value: 2, label: "Wednesday" },
      { value: 3, label: "Thursday" },
      { value: 4, label: "Friday" },
      { value: 5, label: "Saturday" },
      { value: 6, label: "Sunday" },
    ],
    []
  );
  const [windowCfg, setWindowCfg] = useState({ enabled: true, weekday: 2, start_time: "00:00", end_time: "23:59" });
  const [windowSaving, setWindowSaving] = useState(false);
  const [windowErr, setWindowErr] = useState("");
  const [windowOk, setWindowOk] = useState("");

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  const methodOptions = useMemo(
    () => [
      { value: "", label: "Any method" },
      { value: "upi", label: "UPI" },
      { value: "bank", label: "Bank Transfer" },
    ],
    []
  );
  const statusOptions = useMemo(
    () => [
      { value: "", label: "Any status" },
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
    ],
    []
  );

  async function fetchWithdrawals() {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      const res = await API.get("/admin/withdrawals/", { params });
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load withdrawals");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWithdrawTax() {
    try {
      const res = await API.get("/admin/commission/master/", { cacheTTL: 10_000, dedupe: "cancelPrevious" });
      const pct = Number(res?.data?.tax?.percent ?? 0);
      setWithdrawTaxPercent(Number.isFinite(pct) ? pct : 0);

      const wwin = res?.data?.withdrawals_window;
      if (wwin) {
        setWindowCfg({
          enabled: Boolean(wwin?.enabled ?? true),
          weekday: Number(wwin?.weekday ?? 2),
          start_time: String(wwin?.start_time ?? "00:00").slice(0, 5),
          end_time: String(wwin?.end_time ?? "23:59").slice(0, 5),
        });
      }
    } catch (_) {
      setWithdrawTaxPercent(0);
    }
  }

  async function saveWithdrawalsWindow() {
    setWindowSaving(true);
    setWindowErr("");
    setWindowOk("");
    try {
      const payload = {
        withdrawals_window: {
          enabled: Boolean(windowCfg.enabled),
          weekday: Number(windowCfg.weekday),
          start_time: String(windowCfg.start_time || "00:00").slice(0, 5),
          end_time: String(windowCfg.end_time || "23:59").slice(0, 5),
        },
      };
      const res = await API.patch("/admin/commission/master/", payload);
      const wwin = res?.data?.withdrawals_window;
      if (wwin) {
        const cfg = {
          enabled: Boolean(wwin?.enabled ?? true),
          weekday: Number(wwin?.weekday ?? 2),
          start_time: String(wwin?.start_time ?? "00:00").slice(0, 5),
          end_time: String(wwin?.end_time ?? "23:59").slice(0, 5),
        };
        setWindowCfg(cfg);
        try {
          localStorage.setItem("tk_withdrawals_window", JSON.stringify(cfg));
        } catch (_) {}
      }
      setWindowOk("Saved");
      // auto-hide
      setTimeout(() => setWindowOk(""), 2500);
    } catch (e) {
      setWindowErr(e?.response?.data?.detail || "Failed to save withdrawal window");
    } finally {
      setWindowSaving(false);
    }
  }

  useEffect(() => {
    fetchWithdrawTax();
    fetchWithdrawals();
  }, []);

  async function handleApprove(row) {
    const payout_ref = window.prompt("Enter payout reference (optional):", row.payout_ref || "");
    if (payout_ref === null) return;
    try {
      await API.patch(`/admin/withdrawals/${row.id}/approve/`, { payout_ref });
      await fetchWithdrawals();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to approve");
    }
  }

  async function handleReject(row) {
    const reason = window.prompt("Enter reject reason (optional):", "");
    if (reason === null) return;
    try {
      await API.patch(`/admin/withdrawals/${row.id}/reject/`, { reason });
      await fetchWithdrawals();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to reject");
    }
  }

  // Bulk Approve Selected
  async function handleBulkApprove() {
    if (!selectedIds.length) return;
    const ok = window.confirm(`Approve all ${selectedIds.length} selected withdrawals?`);
    if (!ok) return;
    setBulkLoading(true);
    try {
      for (const id of selectedIds) {
        await API.patch(`/admin/withdrawals/${id}/approve/`, { payout_ref: "BULK_DISBURSED" });
      }
      setSelectedIds([]);
      await fetchWithdrawals();
      alert(`Successfully approved ${selectedIds.length} withdrawals.`);
    } catch (e) {
      alert(e?.response?.data?.detail || "Bulk approval completed with some errors.");
    } finally {
      setBulkLoading(false);
    }
  }

  // Export Bank Batch CSV (Standard HDFC / ICICI / SBI format)
  function handleExportBankBatch() {
    const targetRows = selectedIds.length
      ? rows.filter((r) => selectedIds.includes(r.id))
      : rows.filter((r) => r.status === "pending");

    if (!targetRows.length) {
      alert("No withdrawals available to export.");
      return;
    }

    const headers = [
      "Payment Type",
      "Beneficiary Name",
      "Beneficiary Account No",
      "IFSC Code",
      "Net Amount (INR)",
      "Remarks / User ID",
      "Digital Rank",
      "Purchased Packages",
      "Debit Account No",
    ];

    const csvRows = targetRows.map((r) => {
      const gross = Number(r.amount || 0);
      const taxAmt = gross * Number(taxLabel || 0) / 100;
      const net = (gross - taxAmt).toFixed(2);
      const rankStr = r.rank_label || r.rank_name || (r.rank_level ? `Level ${r.rank_level}` : "Free Tier (L0)");
      const pkgsStr = Array.isArray(r.package_badges) && r.package_badges.length > 0 ? r.package_badges.join(" | ") : "None";
      return [
        "NEFT",
        `"${(r.full_name || r.username || "User").replace(/"/g, '""')}"`,
        `"${r.bank_account_number || r.account_number || ""}"`,
        r.ifsc_code || r.ifsc || "",
        net,
        `"TR-${r.username || r.id}"`,
        `"${rankStr.replace(/"/g, '""')}"`,
        `"${pkgsStr.replace(/"/g, '""')}"`,
        "COMPANY_MAIN_ACCOUNT",
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `bank_batch_payout_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const summary = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending");
    const totalPending = pending.reduce((s, r) => s + Number(r.amount || 0), 0);
    return { pendingCount: pending.length, pendingAmount: totalPending };
  }, [rows]);

  const taxLabel = useMemo(() => {
    const pct = Number(withdrawTaxPercent || 0);
    return Number.isFinite(pct) ? pct : 0;
  }, [withdrawTaxPercent]);

  const formatDateTime = (value) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  };

  const getStatusBadge = (r) =>
    r.status === "pending" ? (
      <Badge color="#b45309" bg="#ffedd5">
        Pending
      </Badge>
    ) : r.status === "approved" ? (
      <Badge color="#065f46" bg="#d1fae5">
        Approved
      </Badge>
    ) : (
      <Badge color="#991b1b" bg="#fee2e2">
        Rejected
      </Badge>
    );

  const resetFilters = () =>
    setFilters({
      status: "pending",
      user: "",
      date_from: "",
      date_to: "",
      min_amount: "",
      max_amount: "",
      method: "",
      ordering: "-requested_at",
    });

  return (
    <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#0f172a" }}>Withdrawals</h2>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Approve or reject pending withdrawal requests. Filters help narrow results.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: 8,
              width: isMobile ? "100%" : "auto",
            }}
          >
            {isMobile ? (
              <SecondaryButton
                disabled={loading}
                onClick={() => setShowFilters((s) => !s)}
                style={{ width: "100%" }}
              >
                {showFilters ? "Hide Filters" : "Show Filters"}
              </SecondaryButton>
            ) : null}

            <div
              style={{
                color: "#334155",
                fontSize: 14,
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#fff",
                width: isMobile ? "100%" : "auto",
              }}
            >
              Pending: <b>{summary.pendingCount}</b> • Amount: <b>₹{summary.pendingAmount.toFixed(2)}</b>
            </div>

          <div
            style={{
              color: "#334155",
              fontSize: 14,
              padding: "10px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              background: "#fff",
              width: isMobile ? "100%" : "auto",
            }}
          >
            Withdrawal Tax: <b>{Number(taxLabel).toFixed(2)}%</b>
          </div>

          <button
            type="button"
            onClick={handleExportBankBatch}
            disabled={loading || rows.length === 0}
            style={{
              padding: "10px 14px",
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            📥 Bank Batch CSV {selectedIds.length ? `(${selectedIds.length})` : ""}
          </button>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={bulkLoading}
              style={{
                padding: "10px 14px",
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {bulkLoading ? "Disbursing..." : `⚡ Bulk Approve (${selectedIds.length})`}
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Withdrawals Window Config */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>Withdrawals Window</div>
            <div style={{ color: "#64748b", fontSize: 13 }}>
              Configure when users can request withdrawals (IST). This affects both frontend messages and backend enforcement.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {windowOk ? <Badge color="#065f46" bg="#d1fae5">{windowOk}</Badge> : null}
            {windowErr ? <Badge color="#991b1b" bg="#fee2e2">{windowErr}</Badge> : null}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "repeat(4, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <Select
            label="Enabled"
            value={windowCfg.enabled ? "yes" : "no"}
            onChange={(v) => setWindowCfg((s) => ({ ...s, enabled: v === "yes" }))}
            options={[
              { value: "yes", label: "Enabled" },
              { value: "no", label: "Disabled" },
            ]}
          />
          <Select
            label="Weekday"
            value={String(windowCfg.weekday)}
            onChange={(v) => setWindowCfg((s) => ({ ...s, weekday: Number(v) }))}
            options={weekdayOptions.map((o) => ({ value: String(o.value), label: o.label }))}
          />
          <TextInput
            label="Start Time (24h)"
            type="time"
            value={windowCfg.start_time}
            onChange={(v) => setWindowCfg((s) => ({ ...s, start_time: v }))}
          />
          <TextInput
            label="End Time (24h)"
            type="time"
            value={windowCfg.end_time}
            onChange={(v) => setWindowCfg((s) => ({ ...s, end_time: v }))}
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <PrimaryButton disabled={windowSaving} onClick={saveWithdrawalsWindow} style={{ width: isMobile ? "100%" : 180 }}>
            {windowSaving ? "Saving..." : "Save"}
          </PrimaryButton>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          marginBottom: 12,
          display: !isMobile || showFilters ? "block" : "none",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop
              ? "repeat(4, minmax(0, 1fr))"
              : "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <Select
            label="Status"
            value={filters.status}
            onChange={(v) => setF("status", v)}
            options={statusOptions}
            style={{ width: "100%" }}
          />
          <TextInput
            label="User"
            value={filters.user}
            onChange={(v) => setF("user", v)}
            placeholder="user id / username / name / phone"
            style={{ width: "100%" }}
          />
          <TextInput
            label="From Date"
            type="date"
            value={filters.date_from}
            onChange={(v) => setF("date_from", v)}
            placeholder=""
            style={{ width: "100%" }}
          />
          <TextInput
            label="To Date"
            type="date"
            value={filters.date_to}
            onChange={(v) => setF("date_to", v)}
            placeholder=""
            style={{ width: "100%" }}
          />
          <TextInput
            label="Min Amount"
            value={filters.min_amount}
            onChange={(v) => setF("min_amount", v)}
            placeholder="e.g. 100"
            style={{ width: "100%" }}
          />
          <TextInput
            label="Max Amount"
            value={filters.max_amount}
            onChange={(v) => setF("max_amount", v)}
            placeholder="e.g. 5000"
            style={{ width: "100%" }}
          />
          <Select
            label="Method"
            value={filters.method}
            onChange={(v) => setF("method", v)}
            options={methodOptions}
            style={{ width: "100%" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 8,
            marginTop: 12,
            alignItems: isMobile ? "stretch" : "center",
          }}
        >
          <PrimaryButton
            onClick={fetchWithdrawals}
            disabled={loading}
            style={{ width: isMobile ? "100%" : "auto" }}
          >
            {loading ? "Loading..." : "Apply Filters"}
          </PrimaryButton>
          <SecondaryButton
            onClick={resetFilters}
            disabled={loading}
            style={{ width: isMobile ? "100%" : "auto" }}
          >
            Reset
          </SecondaryButton>
          {err ? (
            <div style={{ color: "#dc2626", fontSize: 13, marginLeft: isMobile ? 0 : "auto" }}>
              {err}
            </div>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {isMobile ? (
        // Mobile: Cards (avoid heavy table rendering)
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => {
            const statusBadge = getStatusBadge(r);
            const gross = Number(r.amount || 0);
            const taxAmt = q2(gross * Number(taxLabel || 0) / 100);
            const net = q2(gross - taxAmt);
            return (
              <div
                key={r.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                        {r.full_name || r.username || "User"}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: (r.rank_level > 0) ? "#e0e7ff" : "#f1f5f9",
                          color: (r.rank_level > 0) ? "#3730a3" : "#475569",
                          border: `1px solid ${(r.rank_level > 0) ? "#c7d2fe" : "#e2e8f0"}`,
                        }}
                      >
                        {r.rank_label || r.rank_name || (r.rank_level ? `Level ${r.rank_level}` : "Free Tier (L0)")}
                      </span>
                      {r.rank_upgrades_count > 0 && (
                        <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 700 }}>
                          ⚡ {r.rank_upgrades_count} upgrade{r.rank_upgrades_count > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.username ? `@${r.username}` : ""}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>{statusBadge}</div>
                </div>

                {/* Purchased Packages (Mobile) */}
                <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                    Purchased Packages
                  </div>
                  {Array.isArray(r.package_badges) && r.package_badges.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {r.package_badges.map((b, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: b.toLowerCase().includes("spp") ? "#ecfdf5" : "#eff6ff",
                            color: b.toLowerCase().includes("spp") ? "#065f46" : "#1e40af",
                            border: `1px solid ${b.toLowerCase().includes("spp") ? "#a7f3d0" : "#bfdbfe"}`,
                          }}
                        >
                          📦 {b}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>No packages purchased</span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Amount</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      ₹{Number(r.amount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>After Tax</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                      ₹{Number(net || 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      Tax {Number(taxLabel).toFixed(2)}% = ₹{Number(taxAmt || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Method</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {r.method?.toUpperCase?.() || ""}
                    </div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Requested</div>
                    <div style={{ fontSize: 13, color: "#0f172a" }}>{formatDateTime(r.requested_at)}</div>
                  </div>

                  {/* Extra details (if present in API response) */}
                  {r?.phone ? (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Phone</div>
                      <div style={{ fontSize: 13, color: "#0f172a" }}>{r.phone}</div>
                    </div>
                  ) : null}
                  {r?.pincode ? (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Pincode</div>
                      <div style={{ fontSize: 13, color: "#0f172a" }}>{r.pincode}</div>
                    </div>
                  ) : null}
                  {r?.bank_account_number || r?.account_number ? (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Bank Account</div>
                      <div style={{ fontSize: 13, color: "#0f172a" }}>{r.bank_account_number || r.account_number}</div>
                    </div>
                  ) : null}
                  {r?.ifsc_code || r?.ifsc ? (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: 11, color: "#64748b" }}>IFSC</div>
                      <div style={{ fontSize: 13, color: "#0f172a" }}>{r.ifsc_code || r.ifsc}</div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {r.status === "pending" ? (
                    <>
                      <ActionButton onClick={() => handleApprove(r)} variant="approve">
                        Approve
                      </ActionButton>
                      <ActionButton onClick={() => handleReject(r)} variant="reject">
                        Reject
                      </ActionButton>
                    </>
                  ) : (
                    <div style={{ color: "#64748b", fontSize: 12 }}>No actions</div>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && rows.length === 0 ? <div style={{ padding: 12, color: "#64748b" }}>No results</div> : null}
        </div>
      ) : (
        // Tablet/Desktop: Table
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
            width: "100%",
          }}
        >
          <div
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              style={{
                minWidth: 1580,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 55px 120px 130px 145px 180px 95px 110px 95px 85px 145px 80px 95px 95px 130px 160px",
                  gap: 8,
                  padding: 12,
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  fontWeight: 800,
                  color: "#0f172a",
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <div>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedIds.length === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(rows.map((r) => r.id));
                      else setSelectedIds([]);
                    }}
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                </div>
                <div>ID</div>
                <div>User</div>
                <div>Name</div>
                <div>Rank & Level</div>
                <div>Purchased Packages</div>
                <div>Solvency</div>
                <div>Phone</div>
                <div>Amount</div>
                <div>Method</div>
                <div>Bank / IFSC</div>
                <div>Tax %</div>
                <div>Final</div>
                <div>Status</div>
                <div>Requested</div>
                <div>Actions</div>
              </div>

              <div>
                {rows.map((r) => {
                  const statusBadge = getStatusBadge(r);
                  const gross = Number(r.amount || 0);
                  const taxAmt = q2(gross * Number(taxLabel || 0) / 100);
                  const net = q2(gross - taxAmt);
                  const isChecked = selectedIds.includes(r.id);
                  const isSolvent = Number(r.user_wallet_balance || gross) >= gross;
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 55px 120px 130px 145px 180px 95px 110px 95px 85px 145px 80px 95px 95px 130px 160px",
                        gap: 8,
                        padding: 12,
                        borderBottom: "1px solid #e2e8f0",
                        alignItems: "center",
                        fontSize: 13,
                        backgroundColor: isChecked ? "#f0f9ff" : "#fff",
                      }}
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds((s) => [...s, r.id]);
                            else setSelectedIds((s) => s.filter((id) => id !== r.id));
                          }}
                          style={{ cursor: "pointer", width: 16, height: 16 }}
                        />
                      </div>
                      <div style={{ color: "#0f172a", fontWeight: 700 }}>{r.id}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.full_name || ""}</div>
                      
                      {/* Rank & Upgrade Level */}
                      <div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: (r.rank_level > 0) ? "#e0e7ff" : "#f1f5f9",
                              color: (r.rank_level > 0) ? "#3730a3" : "#475569",
                              border: `1px solid ${(r.rank_level > 0) ? "#c7d2fe" : "#e2e8f0"}`,
                              whiteSpace: "nowrap",
                              display: "inline-block",
                              width: "fit-content",
                            }}
                          >
                            {r.rank_label || r.rank_name || (r.rank_level ? `Level ${r.rank_level}` : "Free Tier (L0)")}
                          </span>
                          {r.rank_upgrades_count > 0 && (
                            <span style={{ fontSize: 10.5, color: "#6366f1", fontWeight: 700 }}>
                              ⚡ {r.rank_upgrades_count} upgrade{r.rank_upgrades_count > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Purchased Packages */}
                      <div>
                        {Array.isArray(r.package_badges) && r.package_badges.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {r.package_badges.map((b, idx) => (
                              <span
                                key={idx}
                                title={b}
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: b.toLowerCase().includes("spp")
                                    ? "#ecfdf5"
                                    : b.toLowerCase().includes("tour")
                                    ? "#fffbeb"
                                    : "#f8fafc",
                                  color: b.toLowerCase().includes("spp")
                                    ? "#065f46"
                                    : b.toLowerCase().includes("tour")
                                    ? "#92400e"
                                    : "#334155",
                                  border: `1px solid ${
                                    b.toLowerCase().includes("spp")
                                      ? "#a7f3d0"
                                      : b.toLowerCase().includes("tour")
                                      ? "#fde68a"
                                      : "#e2e8f0"
                                  }`,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                📦 {b}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>No packages</span>
                        )}
                      </div>

                      <div>
                        <span
                          title={isSolvent ? "Verified against wallet balance" : "Risk: check wallet audit"}
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: isSolvent ? "#dcfce7" : "#fee2e2",
                            color: isSolvent ? "#15803d" : "#991b1b",
                            border: `1px solid ${isSolvent ? "#86efac" : "#fca5a5"}`,
                          }}
                        >
                          {isSolvent ? "🟢 Clean" : "🔴 Review"}
                        </span>
                      </div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.phone || ""}</div>
                      <div style={{ fontWeight: 700 }}>₹{Number(r.amount || 0).toFixed(2)}</div>
                      <div>{r.method?.toUpperCase?.() || ""}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(r.bank_account_number || r.account_number) ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 700 }}>{r.bank_account_number || r.account_number}</span>
                            <span style={{ color: "#64748b", fontSize: 12 }}>{r.ifsc_code || r.ifsc || ""}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </div>
                      <div>{Number(taxLabel).toFixed(2)}%</div>
                      <div style={{ fontWeight: 800 }}>₹{Number(net || 0).toFixed(2)}</div>
                      <div>{statusBadge}</div>
                      <div style={{ color: "#334155", fontSize: 12 }}>{formatDateTime(r.requested_at)}</div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "flex-start",
                        }}
                      >
                        {r.status === "pending" ? (
                          <>
                            <ActionButton onClick={() => handleApprove(r)} variant="approve">
                              Approve
                            </ActionButton>
                            <ActionButton onClick={() => handleReject(r)} variant="reject">
                              Reject
                            </ActionButton>
                          </>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: 12 }}>No actions</span>
                        )}
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
        </div>
      )}
    </div>
  );
}





