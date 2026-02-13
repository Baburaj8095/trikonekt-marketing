import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api/api";
import normalizeMediaUrl from "../../utils/media";
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

export default function AdminMerchants() {
  // Fixed base filters for merchants
  const BASE = { role: "user" };

  // Extra filters
  const [filters, setFilters] = useState({
    category: "business",
    phone: "",
    pincode: "",
    state: "",
    kyc: "",
    account_active: "",
  });
  const [density, setDensity] = useState("standard");
  const [reloadKey, setReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [apiErr, setApiErr] = useState("");
  const [exporting, setExporting] = useState(false);

  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const accountStatusOptions = useMemo(
    () => [
      { value: "", label: "Any account status" },
      { value: "1", label: "Active" },
      { value: "0", label: "Inactive" },
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
      { value: "business", label: "business" },
      { value: "merchant", label: "merchant" },
    ],
    []
  );

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  const openEdit = useCallback(async (row) => {
    try {
      if (!row || !row.id) return;
      const res = await API.get(`/admin/users/${row.id}/`);
      const data = res?.data || row;
      setSelected({ id: row.id, ...row, ...data });
      setEditOpen(true);
    } catch {
      setSelected(row);
      setEditOpen(true);
    }
  }, []);

  // Edit meta (reuse from /admin/users/edit-meta/)
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
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    (async () => {
      try {
        const res = await API.get("/admin/users/edit-meta/", {
          timeout: 30000,
          retryAttempts: 1,
          dedupe: "none",
          signal: controller ? controller.signal : undefined,
          cacheTTL: 300000,
        });
        const arr = res?.data?.fields;
        if (mounted && Array.isArray(arr) && arr.length) {
          const mapped = arr.map((f) =>
            f && f.name === "password"
              ? { ...f, type: "PasswordField", required: false, label: f.label || "Set New Password" }
              : f
          );
          setEditFields(mapped);
        }
      } catch (_) {
        // fallback defaults
      }
    })();
    return () => {
      mounted = false;
      try {
        controller && controller.abort();
      } catch {}
    };
  }, []);

  const editFieldsWithNames = useMemo(() => {
    const names = {
      country: selected?.country_name || "",
      state: selected?.state_name || "",
      city: selected?.district_name || "",
    };
    const prettify = (name) => {
      if (name === "city") return "District/City";
      return name.charAt(0).toUpperCase() + name.slice(1);
    };
    return (editFields || []).map((f) => {
      if (f && ["country", "state", "city"].includes(f.name)) {
        const baseLabel =
          (f.label ? String(f.label).replace(/\s*\(ID\)\s*$/i, "") : prettify(f.name));
        const help = names[f.name]
          ? `Current: ${names[f.name]}`
          : (f.help_text || "");
        return { ...f, label: baseLabel, help_text: help };
      }
      return f;
    });
  }, [editFields, selected]);

  // Allow important merchant fields in edit dialog
  const editFieldsRestricted = useMemo(() => {
    const allowed = new Set([
      "email",
      "full_name",
      "username",
      "phone",
      "sponsor_id",
      "pincode",
      "state",
      "city",
      "account_active",
      "commission_percent",
      "service_mode",
      // Optional extra merchant profile fields (will show only if backend meta exposes them)
      "business_name",
      "business_category",
      "address",
    ]);
    let arr = (editFieldsWithNames || []).filter(
      (f) => f && allowed.has(String(f.name || ""))
    );
    // Ensure Username is present if not provided by meta
    const hasUsername = arr.some((f) => String(f.name) === "username");
    if (!hasUsername) {
      arr = [{ name: "username", type: "CharField", required: false, label: "Username" }, ...arr];
    }
    // Ensure Sponsor ID is present if not provided by meta
    const hasSponsor = arr.some((f) => String(f.name) === "sponsor_id");
    if (!hasSponsor) {
      arr = [...arr, { name: "sponsor_id", type: "CharField", required: false, label: "Sponsor ID" }];
    }
    // Never render password in this dialog
    arr = arr.filter((f) => f && String(f.name || "").toLowerCase() !== "password");
    return arr;
  }, [editFieldsWithNames]);

  const columns = useMemo(
    () => [
      { field: "id", headerName: "ID", minWidth: 90, width: 90 },
      {
        field: "avatar",
        headerName: "Profile",
        minWidth: 80,
        renderCell: (params) => {
          const urlRaw = params?.row?.avatar_url || params?.row?.avatar?.url || params?.row?.avatar || "";
          const src = urlRaw ? normalizeMediaUrl(urlRaw) : "";
          return src ? (
            <img src={src} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid #e2e8f0" }} />
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
          const uname = row.username || "";
          return (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => openEdit(row)}
                style={{ color: "#0ea5e9", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                title="Edit merchant"
              >
                {uname}
              </button>
            </div>
          );
        },
      },
      { field: "full_name", headerName: "Full Name", minWidth: 180, flex: 1 },
      { field: "sponsor_id", headerName: "Sponsor ID", minWidth: 160 },
      { field: "phone", headerName: "Mobile", minWidth: 140 },
      { field: "email", headerName: "Email", minWidth: 200, flex: 1 },
      {
        field: "commission_percent",
        headerName: "Commission %",
        minWidth: 140,
        valueFormatter: (v) => {
          const n = parseFloat(v);
          return Number.isFinite(n) ? `${n}%` : "";
        },
      },
      {
        field: "service_mode",
        headerName: "Service Mode",
        minWidth: 140,
      },
      // Optional merchant profile extras (will render when present in payload)
      { field: "business_name", headerName: "Business Name", minWidth: 200, flex: 1 },
      { field: "business_category", headerName: "Category", minWidth: 160 },
      { field: "address", headerName: "Address", minWidth: 240, flex: 1 },
      { field: "pincode", headerName: "Pincode", minWidth: 110 },
      { field: "area", headerName: "Area", minWidth: 160 },
      { field: "taluk_name", headerName: "Taluk", minWidth: 160 },
      { field: "district_name", headerName: "District", minWidth: 150 },
      { field: "state_name", headerName: "State", minWidth: 150 },
      { field: "country_name", headerName: "Country", minWidth: 150 },
      {
        field: "wallet_balance",
        headerName: "Wallet",
        minWidth: isMobile ? 220 : 300,
        renderCell: (params) => {
          const row = params?.row || {};
          const balNum = Number(row.wallet_balance);
          const bal = Number.isFinite(balNum) ? balNum.toFixed(2) : (row.wallet_balance ?? "");
          const onAdjust = async (action) => {
            try {
              if (!row?.id) return;
              const amtStr = window.prompt(`Enter amount to ${action}:`, "");
              if (amtStr === null) return; // cancelled
              const amt = parseFloat(String(amtStr).trim());
              if (!Number.isFinite(amt) || amt <= 0) {
                window.alert("Amount must be a positive number.");
                return;
              }
              const note = window.prompt("Optional note (stored in transaction meta):", "") || "";
              await API.post(`/admin/users/${row.id}/wallet-adjust/`, {
                action,
                amount: amt,
                note,
              });
              setReloadKey((k) => k + 1);
            } catch (e) {
              const msg = e?.response?.data?.detail || e?.message || "Wallet adjust failed";
              window.alert(String(msg));
            }
          };
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span title="Main wallet balance" style={{ minWidth: 64 }}>{bal}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation?.(); onAdjust("credit"); }}
                title="Credit wallet"
                style={{
                  borderRadius: 6,
                  padding: "2px 6px",
                  background: "#16a34a",
                  color: "#fff",
                  border: "1px solid #15803d",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                + Credit
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation?.(); onAdjust("debit"); }}
                title="Debit wallet"
                style={{
                  borderRadius: 6,
                  padding: "2px 6px",
                  background: "#ef4444",
                  color: "#fff",
                  border: "1px solid #b91c1c",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                - Debit
              </button>
            </div>
          );
        },
      },
      { field: "wallet_status", headerName: "Wallet Status", minWidth: 140 },
      {
        field: "account_active",
        headerName: "Account",
        minWidth: 160,
        renderCell: (params) => {
          const row = params?.row || {};
          const active = !!row.account_active;
          const onToggle = async (e) => {
            e?.stopPropagation?.();
            if (!row?.id) return;
            try {
              await API.patch(`/admin/users/${row.id}/`, { account_active: !active });
              setReloadKey((k) => k + 1);
            } catch (_) {}
          };
          const trackStyle = {
            width: 44,
            height: isMobile ? 18 : 22,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            padding: 2,
            backgroundColor: active ? "#16a34a" : "#ef4444",
            border: active ? "1px solid #15803d" : "1px solid #b91c1c",
            cursor: "pointer",
            transition: "background-color 120ms ease, border-color 120ms ease",
          };
          const knobStyle = {
            width: isMobile ? 12 : 16,
            height: isMobile ? 12 : 16,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            transform: active ? `translateX(${isMobile ? 22 : 24}px)` : "translateX(0px)",
            transition: "transform 120ms ease",
          };
          const title = active ? "Active" : "Inactive";
          return (
            <div
              role="switch"
              aria-checked={active}
              tabIndex={0}
              onClick={onToggle}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(e); } }}
              title={title}
              style={trackStyle}
            >
              <div style={knobStyle} />
            </div>
          );
        },
      },
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
        field: "__edit",
        headerName: "Edit",
        minWidth: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params?.row || {};
          const onEdit = (e) => {
            e?.stopPropagation?.();
            openEdit(row);
          };
          return (
            <button
              type="button"
              onClick={onEdit}
              title="Edit merchant"
              style={{
                borderRadius: 8,
                padding: "6px 10px",
                background: "#0ea5e9",
                color: "#fff",
                border: "1px solid #0284c7",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Edit
            </button>
          );
        },
      },
    ],
    [openEdit, isMobile]
  );

  // Server-side fetcher
  const fetcher = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const params = { page, page_size: pageSize, ...BASE };
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          params[k] = v;
        }
      });
      if (search && String(search).trim()) params.search = String(search).trim();
      if (ordering) params.ordering = ordering;

      try {
        const res = await API.get("/api/admin/users/", {
          params,
          dedupe: "cancelPrevious",
          timeout: 60000,
          retryAttempts: 1,
          cacheTTL: 8000,
        });
        const data = res?.data;
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        let count;
        const rawCount = data?.count;
        if (typeof rawCount === "number" && Number.isFinite(rawCount)) {
          count = rawCount;
        } else if (typeof rawCount === "string") {
          const s = rawCount.trim().toLowerCase();
          if (s !== "" && s !== "null" && s !== "none" && s !== "nan") {
            const n = parseInt(rawCount, 10);
            if (Number.isFinite(n)) count = n;
          }
        }
        if (typeof count !== "number") {
          const baseIndex = Math.max(0, (Number(page) - 1) * Number(pageSize));
          const hasNext = !!data?.has_next;
          count = baseIndex + results.length + (hasNext ? 1 : 0);
        }
        setApiErr("");
        return { results, count };
      } catch (e) {
        const isCanceled =
          e?.__canceled === true ||
          e?.code === "ERR_CANCELED" ||
          e?.name === "CanceledError" ||
          (typeof e?.message === "string" && /aborted|abort|canceled|cancelled/i.test(e.message));
        if (isCanceled) throw e;
        const status = e?.response?.status;
        const msg = e?.response?.data?.detail || e?.message || "Request failed";
        setApiErr(`${status || ""} ${msg}`.trim());
        return { results: [], count: 0 };
      }
    },
    [filters, reloadKey]
  );

  const handleExport = async () => {
    setExporting(true);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const params = { ...BASE };
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== null && v !== undefined && String(v).trim() !== "") params[k] = v;
    });

    try {
      // Prefer backend excel if available
      const res = await API.get("/api/admin/users/export-xlsx", {
        params,
        responseType: "blob",
        timeout: 120000,
        dedupe: "cancelPrevious",
        retryAttempts: 0,
      });
      const blob = new Blob([res?.data || res], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-merchants-${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    } catch (e) {
      // Fallback client-side .xls export
      try {
        const pageSize = 500;
        let page = 1;
        let all = [];
        let total = null;

        while (true) {
          const pageParams = { ...params, page, page_size: pageSize };
          const resp = await API.get("/api/admin/users/", {
            params: pageParams,
            dedupe: "none",
            retryAttempts: 1,
            timeout: 30000,
          });
          const data = resp?.data;
          const results = Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data)
            ? data
            : [];
          let countRaw = data?.count;
          let countNum = Number(countRaw);
          const count = Number.isFinite(countNum) ? countNum : results.length;
          if (total == null) total = count;
          if (!results.length) break;
          all = all.concat(results);
          if (all.length >= total) break;
          page += 1;
        }

        if (!all.length) {
          window.alert("No data to export for current filters.");
          return;
        }

        const cols = [
          ["ID", (r) => r.id ?? r.pk ?? ""],
          ["Username", (r) => r.username ?? ""],
          ["Full Name", (r) => r.full_name ?? ""],
          ["Phone", (r) => r.phone ?? ""],
          ["Email", (r) => r.email ?? ""],
          ["Commission %", (r) => (Number.isFinite(Number(r.commission_percent)) ? `${Number(r.commission_percent)}%` : "")],
          ["Service Mode", (r) => r.service_mode ?? ""],
          ["Business Name", (r) => r.business_name ?? ""],
          ["Business Category", (r) => r.business_category ?? ""],
          ["Address", (r) => r.address ?? ""],
          ["Sponsor ID", (r) => r.sponsor_id ?? ""],
          ["Pincode", (r) => r.pincode ?? ""],
          ["Area", (r) => r.area ?? ""],
          ["Taluk", (r) => r.taluk_name ?? ""],
          ["District", (r) => r.district_name ?? ""],
          ["State", (r) => r.state_name ?? ""],
          ["Country", (r) => r.country_name ?? ""],
          ["Wallet Balance", (r) => r.wallet_balance ?? ""],
          ["Wallet Status", (r) => r.wallet_status ?? ""],
          ["Account Active", (r) => (r.account_active ? "Active" : "Inactive")],
          ["Date Joined", (r) => r.date_joined ?? ""],
        ];

        const escapeHtml = (val) => {
          if (val === null || val === undefined) return "";
          return String(val).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
        };

        const headerCells = cols
          .map((c) => `<th style="border:1px solid #999;padding:4px;background:#eef2ff">${escapeHtml(c[0])}</th>`)
          .join("");
        const rowsHtml = all
          .map((r) => {
            const cells = cols
              .map(([, getter]) => `<td style="border:1px solid #999;padding:4px">${escapeHtml(getter(r))}</td>`)
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
  <table border="1" cellspacing="0" cellpadding="0">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `admin-merchants-${ts}.xls`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return;
      } catch (err) {
        const msg = err?.response?.data?.detail || err?.message || "Export failed";
        window.alert(String(msg));
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Merchants</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Manage merchant users. Use the search box in the table to find specific entries.
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
          label="Category"
          value={filters.category}
          onChange={(v) => setF("category", v)}
          options={categoryOptions}
        />
        <Select
          label="KYC"
          value={filters.kyc}
          onChange={(v) => setF("kyc", v)}
          options={kycOptions}
        />
        <Select
          label="Account status"
          value={filters.account_active}
          onChange={(v) => setF("account_active", v)}
          options={accountStatusOptions}
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
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
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #1d4ed8",
            background: exporting ? "#93c5fd" : "#2563eb",
            color: "#fff",
            cursor: exporting ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
          title="Download Excel of merchants"
        >
          {exporting ? "Exporting..." : "Export Excel"}
        </button>
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

      {apiErr ? (
        <div
          style={{
            margin: "8px 0",
            padding: "8px 10px",
            borderRadius: 8,
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            fontSize: 13,
            fontWeight: 600,
          }}
          title="API error"
        >
          {apiErr}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        fetcher={fetcher}
        density={density}
        extraKey={JSON.stringify(filters) + ":" + reloadKey}
        checkboxSelection={true}
        onSelectionChange={() => {}}
        instanceKey="admin-merchants"
      />

      <ModelFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        route="/admin/users/"
        record={selected}
        fields={editFieldsRestricted}
        onSaved={() => setReloadKey((k) => k + 1)}
        title={selected?.id ? `Edit ${selected.username || selected.full_name || selected.id}` : "Create Merchant"}
      />
    </div>
  );
}
