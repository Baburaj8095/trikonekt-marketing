import React, { useCallback, useMemo, useState, useEffect } from "react";
import API from "../../api/api";
import normalizeMediaUrl from "../../utils/media";
import DataTable from "../../admin-panel/components/data/DataTable";
import ModelFormDialog from "../../admin-panel/dynamic/ModelFormDialog";
import { useLocation } from "react-router-dom";
import AgencyPackageCardsPanel from "./components/AgencyPackageCardsPanel";

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
  const [filters, setFilters] = useState(() => {
    // Initialize from URL so first request uses the correct filters, avoiding an initial unfiltered call
    let activated = "";
    let account_active = "";
    try {
      const qs = typeof window !== "undefined" ? (window.location.search || "") : "";
      const params = new URLSearchParams(qs);
      const rawActivated = (params.get("activated") || "").toLowerCase();
      activated = ["1","true","yes","activated"].includes(rawActivated)
        ? "1"
        : (["0","false","no","inactive","not_activated","unactivated","notactivated"].includes(rawActivated) ? "0" : "");
      const rawAccountActive = (params.get("account_active") || "").toLowerCase();
      account_active = ["1","true","yes","active"].includes(rawAccountActive)
        ? "1"
        : (["0","false","no","inactive"].includes(rawAccountActive) ? "0" : "");
    } catch (_) {}
    return {
      role: "",
      phone: "",
      category: "",
      pincode: "",
      state: "",
      kyc: "",
      account_active,
      activated,
    };
  });
  const [density, setDensity] = useState("standard");
  const [reloadKey, setReloadKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tempPw, setTempPw] = useState({});
  const [apiErr, setApiErr] = useState("");
  const [exporting, setExporting] = useState(false);
  // Packages drawer (agency-only)
  const [pkgOpen, setPkgOpen] = useState(false);
  const [pkgUser, setPkgUser] = useState(null);
  // Mobile responsiveness hint
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Hide less important columns on small screens for better readability
  const mobileHiddenCols = useMemo(
    () =>
      isMobile
        ? {
            email: false,
            sponsor_id: false,
            country_name: false,
            district_name: false,
            state_name: false,
            wallet_status: false,
            kyc_verified_at: false,
            pincode: false,
          }
        : {},
    [isMobile]
  );
  const [colVis, setColVis] = useState({});
  useEffect(() => {
    setColVis(mobileHiddenCols);
  }, [mobileHiddenCols]);

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

  // Sync '?activated=1|0|true|false' and '?account_active=1|0|true|false|active|inactive' from URL
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const rawActivated = (params.get("activated") || "").toLowerCase();
    const normActivated = ["1","true","yes","activated"].includes(rawActivated)
      ? "1"
      : (["0","false","no","inactive","not_activated","unactivated","notactivated"].includes(rawActivated) ? "0" : "");
    const rawAccountActive = (params.get("account_active") || "").toLowerCase();
    const normAccountActive = ["1","true","yes","active"].includes(rawAccountActive)
      ? "1"
      : (["0","false","no","inactive"].includes(rawAccountActive) ? "0" : "");
    setFilters((f) => {
      let next = f;
      if ((f.activated || "") !== normActivated) {
        next = { ...next, activated: normActivated };
      }
      if ((f.account_active || "") !== normAccountActive) {
        next = { ...next, account_active: normAccountActive };
      }
      return next;
    });
  }, [location.search]);


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

  const accountStatusOptions = useMemo(
    () => [
      { value: "", label: "Any account status" },
      { value: "1", label: "Active" },
      { value: "0", label: "Inactive" },
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
            <img src={normalizeMediaUrl(url)} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid #e2e8f0" }} />
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
            </div>
          );
        },
      },
      {
        field: "__login",
        headerName: "Login",
        minWidth: 110,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params?.row || {};
          const onLogin = async (e) => {
            e?.stopPropagation?.();
            try {
              if (!row?.id) return;
              const res = await API.post(`/admin/users/${row.id}/impersonate/`);
              const { access, refresh, role } = res?.data || {};
              if (!access || !refresh) return;
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
            <button
              type="button"
              onClick={onLogin}
              title="Login as this user"
              style={{
                borderRadius: 8,
                padding: "6px 10px",
                background: "#2563eb",
                color: "#fff",
                border: "1px solid #1d4ed8",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Login
            </button>
          );
        },
      },
      {
        field: "__packages",
        headerName: "Packages",
        minWidth: 130,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params?.row || {};
          const role = String(row.role || "").toLowerCase();
          const cat = String(row.category || "").toLowerCase();
          const isAgency = role === "agency" || cat.startsWith("agency");
          if (!isAgency) return "—";
          const onOpen = (e) => {
            e?.stopPropagation?.();
            setPkgUser({ id: row.id, username: row.username, full_name: row.full_name });
            setPkgOpen(true);
          };
          return (
            <button
              type="button"
              onClick={onOpen}
              title="View packages for this agency"
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
              Packages
            </button>
          );
        },
      },
      {
        field: "__commissions",
        headerName: "Commissions",
        minWidth: 140,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params?.row || {};
          const r = String(row.role || "").toLowerCase();
          const c = String(row.category || "").toLowerCase();
          const isAgency = r === "agency" || c.startsWith("agency");
          const isEmployee = r === "employee" || c === "employee";
          if (!isAgency && !isEmployee) return "—";
          const onOpen = (e) => {
            e?.stopPropagation?.();
            const roleParam = isAgency ? "agency" : "employee";
            const url = `/admin/commissions/history?recipient=${encodeURIComponent(row.id)}&role=${encodeURIComponent(roleParam)}`;
            window.location.assign(url);
          };
          return (
            <button
              type="button"
              onClick={onOpen}
              title="View commission history"
              style={{
                borderRadius: 8,
                padding: "6px 10px",
                background: "#16a34a",
                color: "#fff",
                border: "1px solid #15803d",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Commissions
            </button>
          );
        },
      },
      { field: "full_name", headerName: "Full Name", minWidth: 180, flex: 1 },
      { field: "sponsor_id", headerName: "Sponsor ID", minWidth: 160 },
      { field: "phone", headerName: "Mobile", minWidth: 140 },
      { field: "email", headerName: "Email", minWidth: 200, flex: 1 },
      {
        field: "activated_ecoupon_count",
        headerName: "E‑Coupons (Activated)",
        minWidth: 170,
        renderCell: (params) => {
          const n = Number(params?.row?.activated_ecoupon_count ?? 0);
          const label = Number.isFinite(n) ? String(n) : "";
          const active = n > 0;
          return (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: isMobile ? "2px 8px" : "3px 8px",
                borderRadius: 8,
                fontSize: isMobile ? 11 : 12,
                fontWeight: 700,
                lineHeight: 1,
                backgroundColor: active ? "#0ea5e9" : "#f1f5f9",
                border: active ? "1px solid #0284c7" : "1px solid #cbd5e1",
                color: active ? "#ffffff" : "#0f172a",
                minWidth: 40,
              }}
              title={active ? `${n} activated` : "0"}
            >
              {label}
            </div>
          );
        },
      },
      {
        field: "last_promo_package",
        headerName: "Promo Package",
        minWidth: 180,
      },
      {
        field: "kyc_status",
        headerName: "KYC",
        minWidth: 120,
        renderCell: (params) => {
          const row = params?.row || {};
          const verified = !!row.kyc_verified;
          const label = verified ? "Verified" : (row.kyc_status || "Pending");
          const bg = verified ? "#10b981" : "#ffffff"; // green / white
          const color = verified ? "#ffffff" : "#b45309"; // white on green, amber-700 text
          const border = verified ? "1px solid #059669" : "1px solid #f59e0b";
          // Button-like styling for Pending and Verified
          const btnStyles = verified
            ? { backgroundColor: "#10b981", border: "1px solid #059669", color: "#ffffff" }
            : { backgroundColor: "#f59e0b", border: "1px solid #d97706", color: "#ffffff" };
          return (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: isMobile ? "2px 8px" : "3px 8px",
                borderRadius: 8,
                fontSize: isMobile ? 11 : 12,
                fontWeight: 700,
                lineHeight: 1,
                ...btnStyles,
              }}
              title={label}
            >
              {label}
            </div>
          );
        },
      },
      {
        field: "kyc_verified_at",
        headerName: "KYC Verified At",
        minWidth: 170,
        valueFormatter: (v) => {
          if (!v) return "";
          try { return new Date(v).toLocaleString(); } catch (_) { return String(v); }
        },
      },
      { field: "pincode", headerName: "Pincode", minWidth: 110 },
      { field: "district_name", headerName: "District", minWidth: 150 },
      { field: "state_name", headerName: "State", minWidth: 150 },
      { field: "country_name", headerName: "Country", minWidth: 150 },
      {
        field: "commission_level",
        headerName: isMobile ? "Level" : "Commission Level",
        minWidth: isMobile ? 110 : 150,
        renderCell: (params) => {
          const lvl = Number(params?.row?.commission_level || 0);
          const baseStyle = {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "2px 8px" : "3px 8px",
            borderRadius: 8,
            fontSize: isMobile ? 11 : 12,
            fontWeight: 700,
            lineHeight: 1,
          };
          if (!lvl) {
            return (
              <div
                style={{
                  ...baseStyle,
                  backgroundColor: "#f1f5f9", // slate-100
                  border: "1px solid #cbd5e1", // slate-300
                  color: "#0f172a",
                }}
                title="No level"
              >
                —
              </div>
            );
          }
          return (
            <div
              style={{
                ...baseStyle,
                backgroundColor: "#7c3aed", // violet-600
                border: "1px solid #6d28d9", // violet-700
                color: "#ffffff",
              }}
              title={`Level L${lvl}`}
            >
              L{lvl}
            </div>
          );
        },
      },
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
              const note = window.prompt("Optional note (will be stored in transaction meta):", "") || "";
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
          const r = String(row.role || "").toLowerCase();
          const c = String(row.category || "").toLowerCase();
          const isAgency = r === "agency" || c.startsWith("agency");

          const onToggle = async (e) => {
            e?.stopPropagation?.();
            if (!row?.id) return;
            if (isAgency) {
              // For agencies, activation is driven by package payment.
              // Open Packages panel to record payment instead of manual toggle.
              setPkgUser({ id: row.id, username: row.username, full_name: row.full_name });
              setPkgOpen(true);
              return;
            }
            try {
              await API.patch(`/admin/users/${row.id}/`, { account_active: !active });
              setReloadKey((k) => k + 1);
            } catch (_) {}
          };

          const disabled = isAgency;
          const trackStyle = {
            width: 44,
            height: isMobile ? 18 : 22,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            padding: 2,
            backgroundColor: disabled ? (active ? "#6ee7b7" : "#cbd5e1") : (active ? "#16a34a" : "#ef4444"),
            border: disabled ? "1px solid #94a3b8" : (active ? "1px solid #15803d" : "1px solid #b91c1c"),
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.8 : 1,
            transition: "background-color 120ms ease, border-color 120ms ease, opacity 120ms ease",
          };
          const knobStyle = {
            width: isMobile ? 12 : 16,
            height: isMobile ? 12 : 16,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            transform: active ? `translateX(${isMobile ? 22 : 24}px)` : "translateX(0px)",
            transition: "transform 120ms ease",
          };
          const title = isAgency
            ? (active ? "Active (set by package payment). Click to manage Packages." : "Inactive. Activate via Packages (record payment).")
            : (active ? "Active" : "Inactive");

          return (
            <div
              role="switch"
              aria-checked={active}
              aria-disabled={disabled}
              tabIndex={0}
              onClick={onToggle}
              onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onToggle(e); } }}
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
        field: "__delete",
        headerName: "Delete",
        minWidth: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params?.row || {};
          const onDelete = async (e) => {
            e?.stopPropagation?.();
            try {
              if (!row?.id) return;
              const ok = window.confirm("Delete this user permanently?");
              if (!ok) return;
              await API.delete(`/admin/users/${row.id}/`);
              setReloadKey((k) => k + 1);
            } catch (e) {
              const msg = e?.response?.data?.detail || e?.message || "Delete failed";
              window.alert(String(msg));
            }
          };
          return (
            <button
              type="button"
              onClick={onDelete}
              title="Delete user"
              style={{
                borderRadius: 8,
                padding: "6px 10px",
                background: "#ef4444",
                color: "#fff",
                border: "1px solid #b91c1c",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Delete
            </button>
          );
        },
      },
    ],
    [openEdit, setReloadKey, tempPw, isMobile, setPkgOpen, setPkgUser]
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

      try {
        const res = await API.get("/admin/users/", {
          params,
          dedupe: "none",
          timeout: 12000,
          retryAttempts: 1,
          cacheTTL: 8000, // short-lived cache to avoid repeat hits during quick UI changes
        });
        const data = res?.data;
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        const count = typeof data?.count === "number" ? data.count : results.length;
        setApiErr("");
        return { results, count };
      } catch (e) {
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
    const params = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        params[k] = v;
      }
    });

    // Try backend export endpoint first (if available), otherwise fall back to client-side CSV export
    try {
      const res = await API.get("/admin/users/export/", {
        params: { ...params, format: "xlsx" },
        responseType: "blob",
        timeout: 60000,
        dedupe: "none",
        retryAttempts: 0,
      });
      const blob = new Blob([res?.data || res], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-users-${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    } catch (e) {
      // Fall back to client-side Excel (.xls) export by paging through the list API
      try {
        const pageSize = 500;
        let page = 1;
        let all = [];
        let total = null;

        // Fetch all pages with current filters (no table search term available here)
        while (true) {
          const pageParams = { ...params, page, page_size: pageSize };
          const resp = await API.get("/admin/users/", {
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
          const count = typeof data?.count === "number" ? data.count : results.length;
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

        // Build Excel-compatible HTML table (.xls)
        const cols = [
          ["ID", (r) => r.id ?? r.pk ?? ""],
          ["Username", (r) => r.username ?? ""],
          ["Full Name", (r) => r.full_name ?? ""],
          ["Phone", (r) => r.phone ?? ""],
          ["Email", (r) => r.email ?? ""],
          ["Role", (r) => r.role ?? ""],
          ["Category", (r) => r.category ?? ""],
          ["KYC Status", (r) => (r.kyc_verified ? "Verified" : (r.kyc_status || "Pending"))],
          ["KYC Verified At", (r) => r.kyc_verified_at ?? ""],
          ["E‑Coupons Activated", (r) => r.activated_ecoupon_count ?? ""],
          ["Promo Package", (r) => r.last_promo_package ?? ""],
          ["Sponsor ID", (r) => r.sponsor_id ?? ""],
          ["Pincode", (r) => r.pincode ?? ""],
          ["District", (r) => r.district_name ?? ""],
          ["State", (r) => r.state_name ?? ""],
          ["Country", (r) => r.country_name ?? ""],
          ["Commission Level", (r) => r.commission_level ?? ""],
          ["Wallet Balance", (r) => r.wallet_balance ?? ""],
          ["Wallet Status", (r) => r.wallet_status ?? ""],
          ["Account Active", (r) => (r.account_active ? "Active" : "Inactive")],
          ["Date Joined", (r) => r.date_joined ?? ""],
        ];

        const escapeHtml = (val) => {
          if (val === null || val === undefined) return "";
          return String(val)
            .replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">");
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
        a.download = `admin-users-${ts}.xls`;
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
        title="Download Excel of all users"
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
  );

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
        <Select
          label="Account status"
          value={filters.account_active}
          onChange={(v) => setF("account_active", v)}
          options={accountStatusOptions}
        />
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
        toolbar={toolbar}
        checkboxSelection={true}
        onSelectionChange={() => {}}
        columnVisibilityModel={colVis}
        onColumnVisibilityModelChange={setColVis}
        instanceKey="admin-users"
      />
      <ModelFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        route="/admin/users/"
        record={selected}
        fields={editFieldsWithNames}
        onSaved={() => setReloadKey((k) => k + 1)}
        title={selected ? `Edit ${selected.username || selected.full_name || selected.id}` : "Edit User"}
      />

      <AgencyPackageCardsPanel
        open={pkgOpen}
        onClose={() => setPkgOpen(false)}
        agencyId={pkgUser?.id}
        username={pkgUser?.username || pkgUser?.full_name}
      />
    </div>
  );
}
