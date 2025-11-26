import React, { useEffect, useMemo, useState } from "react";
import {
  Typography,
  Box,
  Container,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert,
  TextField,
  Stack,
  Grid,
  MenuItem,
  Button,
  Pagination,
  Avatar,
  Chip,
  Switch,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import API from "../api/api";
import RewardsTargetCard from "../components/RewardsTargetCard";
import TreeReferralGalaxy from "../components/TreeReferralGalaxy";
import ReferAndEarn from "../components/ReferAndEarn";
import { CheckCircle, Cancel } from "@mui/icons-material";

export default function AgencyDashboard() {
  // Nav identity (for filtering employees by agency pincode)
  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_agency") || sessionStorage.getItem("user_agency");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const agencyPincode = (storedUser?.pincode || "").toString();
  const sponsorUsername = (storedUser?.username || storedUser?.user?.username || "");

  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  // Sidebar tabs (internal page tabs)
  const TABS = {
    LUCKY: "lucky",
    ASSIGN: "assign",
    EMPLOYEES: "employees",
  };
const [activeTab, setActiveTab] = useState(TABS.EMPLOYEES);
  const [showAllLucky, setShowAllLucky] = useState(false);

  // Lucky Draw history (agency scope: pincode)
  const [luckyList, setLuckyList] = useState([]);
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyError, setLuckyError] = useState("");
  const [commissionTotal, setCommissionTotal] = useState(0);
  // E‑Coupon summary for Agency
  const [ecSummary, setEcSummary] = useState(null);
  const [ecSummaryLoading, setEcSummaryLoading] = useState(false);
  const [ecSummaryError, setEcSummaryError] = useState("");

  // Packages assigned to this agency
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState("");

  // Agency E‑Coupon codes (history)
  const [agencyCodes, setAgencyCodes] = useState([]);
  const [agencyCodesLoading, setAgencyCodesLoading] = useState(false);
  const [agencyCodesError, setAgencyCodesError] = useState("");
  const [agencyCodesPage, setAgencyCodesPage] = useState(1);
  const [agencyCodesPageSize, setAgencyCodesPageSize] = useState(25);
  const [agencyCodesTotal, setAgencyCodesTotal] = useState(0);
  const [agencyStatusFilter, setAgencyStatusFilter] = useState("ALL");

  // Wallet (for agency dashboard display)
  const [wallet, setWallet] = useState({ balance: "0", updated_at: null });
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [me, setMe] = useState(null);

  const loadLuckyHistory = async () => {
    try {
      setLuckyLoading(true);
      setLuckyError("");
      // Prefer actionable pending list for agency; toggle to view all if needed
      const url = showAllLucky ? "/uploads/lucky-draw/" : "/uploads/lucky-draw/pending/agency/";
      const res = await API.get(url, { retryAttempts: 1 });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      if (!showAllLucky && (!arr || arr.length === 0)) {
        try {
          const alt = await API.get("/uploads/lucky-draw/", { retryAttempts: 0 });
          const data = alt.data;
          const arr2 = Array.isArray(data) ? data : data?.results || [];
          const filtered = (arr2 || []).filter((r) => {
            const st = String(r.status || "").toUpperCase();
            return st === "TRE_APPROVED" || st === "SUBMITTED";
          });
          setLuckyList(filtered);
        } catch (_) {
          setLuckyList(arr || []);
        }
      } else {
        setLuckyList(arr || []);
      }
    } catch (e) {
      // Fallback to "all" endpoint if pending/agency fails (e.g., permission edge-cases)
      try {
        const alt = await API.get("/uploads/lucky-draw/", { retryAttempts: 0 });
        const arr2 = Array.isArray(alt.data) ? alt.data : alt.data?.results || [];
        setLuckyList(arr2 || []);
        setLuckyError("");
      } catch (e2) {
        const msg =
          e2?.response?.data?.detail ||
          e2?.response?.data?.message ||
          (typeof e2?.response?.data === "string" ? e2.response.data : "") ||
          e2?.message ||
          "Failed to load Manual Coupon Submissions";
        setLuckyError(msg);
        setLuckyList([]);
      }
    } finally {
      setLuckyLoading(false);
    }
  };

  const loadCommission = async () => {
    try {
      const res = await API.get("/coupons/commissions/mine/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      const total = (arr || [])
        .filter((c) => ["earned", "paid"].includes(String(c.status || "").toLowerCase()))
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      setCommissionTotal(total);
    } catch (e) {
      // ignore
    }
  };

  // Load my wallet balance for dashboard
  const loadWallet = async () => {
    try {
      setWalletLoading(true);
      setWalletError("");
      const res = await API.get("/accounts/wallet/me/");
      setWallet({
        balance: res?.data?.balance ?? "0",
        updated_at: res?.data?.updated_at ?? null,
      });
    } catch (e) {
      setWalletError("Failed to load wallet.");
      setWallet({ balance: "0", updated_at: null });
    } finally {
      setWalletLoading(false);
    }
  };

  // Load agency E‑Coupon summary (available, assigned to employee, sold, redeemed, total)
  const loadEcSummary = async () => {
    try {
      setEcSummaryLoading(true);
      setEcSummaryError("");
      const res = await API.get("/coupons/codes/agency-summary/");
      setEcSummary(res?.data || null);
    } catch (e) {
      setEcSummary(null);
      setEcSummaryError("Failed to load E‑Coupon summary.");
    } finally {
      setEcSummaryLoading(false);
    }
  };
  
  // Load my own profile (to show Agency account status)
  const loadMe = async () => {
    try {
      const res = await API.get("/accounts/me/");
      setMe(res?.data || null);
    } catch (e) {
      setMe(null);
    }
  };
  
  // Load assigned packages for Agency Dashboard cards
  const loadAgencyPackages = async () => {
    try {
      setPackagesLoading(true);
      setPackagesError("");
      const res = await API.get("/business/agency-packages/", { retryAttempts: 1, cacheTTL: 5000 });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setPackages(arr || []);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load packages.";
      setPackagesError(msg);
      setPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  };

  // Load agency's own E‑Coupon codes (assigned_agency = me)
  const loadAgencyCodes = async () => {
    try {
      setAgencyCodesLoading(true);
      setAgencyCodesError("");
      const res = await API.get("/coupons/codes/", {
        params: {
          page: agencyCodesPage,
          page_size: agencyCodesPageSize,
          status: agencyStatusFilter === "ALL" ? undefined : agencyStatusFilter,
        },
      });
      const data = res.data;
      const arr = Array.isArray(data) ? data : data?.results || [];
      setAgencyCodes(arr || []);
      setAgencyCodesTotal(Array.isArray(data) ? (arr || []).length : (data?.count || (arr || []).length));
    } catch (e) {
      setAgencyCodes([]);
      setAgencyCodesError("Failed to load E‑Coupon codes.");
    } finally {
      setAgencyCodesLoading(false);
    }
  };

  // Approve / Reject lucky draw (pending for agency)
  const [busyId, setBusyId] = useState(null);
  const agencyApproveLucky = async (id) => {
    const comment = window.prompt("Agency comment (optional)", "") || "";
    try {
      setBusyId(id);
      await API.post(`/uploads/lucky-draw/${id}/agency-approve/`, { comment });
      await loadLuckyHistory();
    } catch (e) {
    } finally {
      setBusyId(null);
    }
  };
  const agencyRejectLucky = async (id) => {
    const comment = window.prompt("Agency comment (optional)", "") || "";
    try {
      setBusyId(id);
      await API.post(`/uploads/lucky-draw/${id}/agency-reject/`, { comment });
      await loadLuckyHistory();
    } catch (e) {
    } finally {
      setBusyId(null);
    }
  };

  // Employees (for assignment + details)
  const [myEmployees, setMyEmployees] = useState([]);
  const [assignableEmployees, setAssignableEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState("");
  const [empBusyId, setEmpBusyId] = useState(null);

  const loadEmployees = async () => {
    try {
      setEmpLoading(true);
      setEmpError("");

      // Single scoped call: backend enforces "assignable" employees for Agency
      const res = await API.get("/accounts/users/", {
        params: { role: "employee", assignable: 1 },
      });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];

      // Use the same list for details and assignment
      setAssignableEmployees(arr);
      setMyEmployees(arr);
    } catch (e) {
      setEmpError("Failed to load employees");
      setMyEmployees([]);
      setAssignableEmployees([]);
    } finally {
      setEmpLoading(false);
    }
  };

  // Activate/Deactivate an employee under this agency
  const toggleEmployeeActive = async (emp, desired) => {
    if (!emp || !emp.id) return;
    const value = typeof desired === "boolean" ? desired : !Boolean(emp.account_active);
    try {
      setEmpBusyId(emp.id);
      await API.patch(`/accounts/agency/employees/${emp.id}/activate/`, { account_active: value });
      await loadEmployees();
    } catch (e) {
      // ignore; UI will remain unchanged on failure
    } finally {
      setEmpBusyId(null);
    }
  };

  // Assignments
  const [assignForm, setAssignForm] = useState({ employee: "", quantity: "", note: "" });
  const onAssignChange = (e) => setAssignForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const [assignList, setAssignList] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignErrors, setAssignErrors] = useState({});
  const [quota, setQuota] = useState({ quota: 0, assigned: 0, remaining: 0, updated_at: null });

  // My 5‑Matrix tree (spillover-based)
  const [myTree, setMyTree] = useState(null);
  const [myTreeLoading, setMyTreeLoading] = useState(false);
  const [myTreeErr, setMyTreeErr] = useState("");

  const loadAssignments = async () => {
    try {
      setAssignLoading(true);
      setAssignError("");
      const res = await API.get("/uploads/lucky-assignments/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setAssignList(arr || []);
    } catch (e) {
      setAssignError("Failed to load assignments");
      setAssignList([]);
    } finally {
      setAssignLoading(false);
    }
  };

  const loadQuota = async () => {
    try {
      const res = await API.get("/uploads/agency-quota/");
      const data = res?.data || {};
      setQuota({
        quota: Number(data.quota || 0),
        assigned: Number(data.assigned || 0),
        remaining: Number(data.remaining || 0),
        updated_at: data.updated_at || null,
      });
    } catch (e) {
      setQuota((q) => ({ ...q, error: "Failed to load quota" }));
    }
  };

  const submitAssignment = async (e) => {
    e.preventDefault();
    if (!assignForm.employee || !assignForm.quantity) {
      alert("Please select employee and enter quantity.");
      return;
    }
    // Ensure selected employee is registered under this agency (assignable)
    const isAssignable = (assignableEmployees || []).some((u) => String(u.id) === String(assignForm.employee));
    if (!isAssignable) {
      setAssignErrors({ employee: ["Selected employee is not assignable. Choose an employee registered under your agency."] });
      return;
    }
    // Client-side quota validation to give immediate feedback (server enforces too)
    const qtyNum = Number(assignForm.quantity);
    if (Number.isFinite(qtyNum) && typeof quota?.remaining === "number" && qtyNum > quota.remaining) {
      setAssignErrors({ quantity: [`Cannot assign more than remaining quota (${quota.remaining}).`] });
      return;
    }
    try {
      setAssignErrors({});
      setAssignSubmitting(true);
      await API.post("/uploads/lucky-assignments/", {
        employee: assignForm.employee,
        quantity: Number(assignForm.quantity),
        note: assignForm.note || "",
      });
      await loadAssignments();
      await loadQuota();
      setAssignForm({ employee: "", quantity: "", note: "" });
      alert("Assigned successfully.");
    } catch (e) {
      const data = e?.response?.data || {};
      setAssignErrors(data || {});
      setAssignError(typeof data?.detail === "string" ? data.detail : "Failed to assign.");
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Load once (lazy-load employees/assignments/quota only when tabs are opened)
  useEffect(() => {
    // loadLuckyHistory() is invoked by the effect watching [showAllLucky, activeTab] when the Lucky tab is active
    //loadCommission();
    //loadWallet();
    loadEcSummary();
    loadMe();
  }, []);

  useEffect(() => {
    loadAgencyPackages();
  }, []);


  function MyTreeNode({ node, depth = 0 }) {
    const pad = depth * 16;
    return (
      <div style={{ paddingLeft: pad, paddingTop: 6, paddingBottom: 6, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>
          {node.username} <span style={{ color: "#64748b", fontWeight: 500 }}>#{node.id} • {node.full_name || "—"}</span>
        </div>
        {Array.isArray(node.children) && node.children.length > 0 ? (
          <div>
            {node.children.map((c) => (
              <MyTreeNode key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // Reload lucky list when toggle or tab changes
  // (Hidden: Lucky Draw Submission History not shown on Agency Dashboard)

  // Reload employees list when switching to Assign or Employees tabs
  useEffect(() => {
    if (activeTab === TABS.ASSIGN || activeTab === TABS.EMPLOYEES) {
      loadEmployees();
    }
    if (activeTab === TABS.ASSIGN) {
      loadQuota();
    }
  }, [activeTab]);


  return (
    <Container maxWidth="lg" sx={{ px: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
          Agency Dashboard
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Pincode: {agencyPincode || "-"}
        </Typography>
      </Box>
      {me && (
        <Alert severity={me.account_active ? "success" : "warning"} sx={{ mb: 2 }}>
          Account status: <b>{me.account_active ? "Active" : "Inactive"}</b>
        </Alert>
      )}

      {/* <Box sx={{ mb: 2 }}> 
        <ReferAndEarn title="Refer & Earn" sponsorUsername={sponsorUsername} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Share your referral links to invite Consumers, Employees, Sub‑Franchise agencies, and Merchants. Sponsor ID will be auto-filled.
        </Typography>
      </Box> */}

      {/* Assigned Package Cards */}
      <Box sx={{ mb: 2 }}>
        {packagesLoading ? (
          <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={20} /> <Typography variant="body2">Loading packages...</Typography>
          </Box>
        ) : packagesError ? (
          <Alert severity="error">{packagesError}</Alert>
        ) : (packages || []).length > 0 ? (
          <Grid container spacing={2} alignItems="stretch" sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "100%",
                        margin: "auto",
                      },
                    }}>
            {(packages || []).map((p) => {
              const status = String(p.status || "").toLowerCase();
              const isInactive = status === "inactive";
              const isPartial = status === "partial";
              const isActive = status === "active";
              const bg =
                isInactive
                  ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                  : isPartial
                  ? "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)"
                  : "linear-gradient(135deg, #10b981 0%, #059669 100%)";
              const color = isInactive ? "#fff" : "#0f172a";
              return (
                <Grid item xs={12} md={4} key={p.id} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "100%",
                        margin: "auto",
                      },
                    }}>
                  <Box sx={{ p: 2, borderRadius: 2, background: bg, color, boxShadow: "0 8px 18px rgba(0,0,0,0.15)", border: "1px solid rgba(0,0,0,0.05)", height: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {p?.package?.name || p?.package?.code || "Package"}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {(isActive || isPartial) ? (
                          <CheckCircle fontSize="small" sx={{ color: isPartial ? "#065f46" : "#065f46" }} />
                        ) : (
                          <Cancel fontSize="small" sx={{ color: "#fff" }} />
                        )}
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {isInactive ? "Inactive" : isPartial ? "Partial" : "Active"}
                        </Typography>
                      </Box>
                    </Stack>
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, borderRadius: 1, background: "rgba(255,255,255,0.15)", color: "#111827" }}>
                          <Typography variant="caption" sx={{ opacity: 0.9, color: isInactive ? "#f1f5f9" : "#0f172a" }}>Amount</Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900, color: isInactive ? "#fff" : "#0f172a" }}>
                            ₹{p.total_amount || "0.00"}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, borderRadius: 1, background: "rgba(255,255,255,0.15)", color: "#111827" }}>
                          <Typography variant="caption" sx={{ opacity: 0.9, color: isInactive ? "#f1f5f9" : "#0f172a" }}>Paid</Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900, color: isInactive ? "#fff" : "#0f172a" }}>
                            ₹{p.paid_amount || "0.00"}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, borderRadius: 1, background: "rgba(255,255,255,0.15)", color: "#111827" }}>
                          <Typography variant="caption" sx={{ opacity: 0.9, color: isInactive ? "#f1f5f9" : "#0f172a" }}>Remaining</Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900, color: isInactive ? "#fff" : "#0f172a" }}>
                            ₹{p.remaining_amount || "0.00"}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        Renewal: {typeof p.months_remaining === "number" ? `${p.months_remaining} month${p.months_remaining === 1 ? "" : "s"} remaining` : "—"}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Alert severity="info">No package assigned yet.</Alert>
        )}
      </Box>

      {/* Overview Cards */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} sx={{ display: "flex", "& > *": { width: "100%", flex: 1 } }}>
            <RewardsTargetCard role="agency" variant="basic-package" />
          </Grid>
        </Grid>
      </Box>

      {/* E‑Coupon Summary */}
      <Box sx={{ mb: 2 }}>
        {ecSummaryLoading ? (
          <Typography variant="body2">Loading E‑Coupon summary...</Typography>
        ) : ecSummaryError ? (
          <Alert severity="error">{ecSummaryError}</Alert>
        ) : ecSummary ? (
          <Grid container spacing={2} alignItems="stretch" >
            <Grid item xs={12} md={2} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)", color: "#fff", border: "1px solid rgba(124,58,237,0.35)", boxShadow: "0 8px 18px rgba(124,58,237,0.35)", height: "100%" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Available</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.available ?? 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)", color: "#0f172a", border: "1px solid rgba(20,184,166,0.35)", boxShadow: "0 8px 18px rgba(20,184,166,0.35)", height: "100%" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Assigned to Employee</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.assigned_employee ?? 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)", color: "#0f172a", border: "1px solid rgba(245,158,11,0.35)", boxShadow: "0 8px 18px rgba(245,158,11,0.35)", height: "100%" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Sold</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.sold ?? 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "1px solid rgba(16,185,129,0.35)", boxShadow: "0 8px 18px rgba(16,185,129,0.35)", height: "100%" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Redeemed</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.redeemed ?? 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(59,130,246,0.35)", boxShadow: "0 8px 18px rgba(59,130,246,0.35)", height: "100%" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Revoked</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.revoked ?? 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={2} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(14,165,233,0.35)", boxShadow: "0 8px 18px rgba(14,165,233,0.35)", height: "100%" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Total</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.total ?? 0}</Typography>
              </Box>
            </Grid>
          </Grid>
        ) : null}
      </Box>

      {/* <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
       
        <Button variant={activeTab === TABS.EMPLOYEES ? "contained" : "outlined"} onClick={() => setActiveTab(TABS.EMPLOYEES)}>
          Employee Details
        </Button>
      </Stack> */}

      {false && (
        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, backgroundColor: '#e3f2fd' }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
              Lucky Draw Submission History
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" variant="outlined" onClick={() => setShowAllLucky((v) => !v)}>
                {showAllLucky ? "Show Pending" : "Show All"}
              </Button>
              <Button size="small" onClick={loadLuckyHistory}>Refresh</Button>
            </Box>
          </Box>
          <Box sx={{ mb: 2 }}>
            <RewardsTargetCard role="agency" />
          </Box>
          
          {/* <Box sx={{ mb: 2 }}>
            <Alert severity="success">
              My commission earned: ₹{commissionTotal.toFixed(2)}
            </Alert>
          </Box> */}
          <Box sx={{ mb: 2 }}>
            {ecSummaryLoading ? (
              <Typography variant="body2">Loading E‑Coupon summary...</Typography>
            ) : ecSummaryError ? (
              <Alert severity="error">{ecSummaryError}</Alert>
            ) : ecSummary ? (
              <Grid container spacing={2}>
                <Grid item xs={6} md={2}>
                  <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)", color: "#fff", border: "1px solid rgba(124,58,237,0.35)", boxShadow: "0 8px 18px rgba(124,58,237,0.35)" }}>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Available</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.available ?? 0}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)", color: "#0f172a", border: "1px solid rgba(20,184,166,0.35)", boxShadow: "0 8px 18px rgba(20,184,166,0.35)" }}>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Assigned to Employee</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.assigned_employee ?? 0}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)", color: "#0f172a", border: "1px solid rgba(245,158,11,0.35)", boxShadow: "0 8px 18px rgba(245,158,11,0.35)" }}>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Sold</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.sold ?? 0}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "1px solid rgba(16,185,129,0.35)", boxShadow: "0 8px 18px rgba(16,185,129,0.35)" }}>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Redeemed</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.redeemed ?? 0}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(59,130,246,0.35)", boxShadow: "0 8px 18px rgba(59,130,246,0.35)" }}>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Revoked</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.revoked ?? 0}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(14,165,233,0.35)", boxShadow: "0 8px 18px rgba(14,165,233,0.35)" }}>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Total</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.total ?? 0}</Typography>
                  </Box>
                </Grid>
              </Grid>
            ) : null}
          </Box>

          {/* Agency E‑Coupon Codes (history) */}
          

          {luckyLoading ? (
            <Box sx={{ py: 4, display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
            </Box>
          ) : luckyError ? (
            <Alert severity="error">{luckyError}</Alert>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>SL</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Ledger</TableCell>
                    <TableCell>TR Username</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Pincode</TableCell>
                    <TableCell>Status</TableCell>
                     <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                {(luckyList || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{r.sl_number}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{r.ledger_number}</TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: { xs: 160, sm: 'unset' } }}>
                      {(r.username || "")}
                      {r.user ? ` (#${r.user})` : ""}
                      {r.tr_emp_id ? ` [TRE:${r.tr_emp_id}]` : ""}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{r.pincode}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    
                    <TableCell align="right">
                      {(() => {
                        const status = String(r.status).toUpperCase();
                        const isTreApproved = status === "TRE_APPROVED";
                        const agencyUsername = String(storedUser?.username || "").toLowerCase();
                        const directTarget = status === "SUBMITTED" && String(r.tr_emp_id || "").toLowerCase() === agencyUsername;
                        const canAct = isTreApproved || directTarget;
                        if (!canAct) return "-";
                        return (
                          <Box sx={{ display: "flex", gap: 1, justifyContent: { xs: "stretch", sm: "flex-end" }, flexDirection: { xs: "column", sm: "row" } }}>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={busyId === r.id}
                              onClick={() => agencyApproveLucky(r.id)}
                              sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" }, width: { xs: "100%", sm: "auto" } }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={busyId === r.id}
                              onClick={() => agencyRejectLucky(r.id)}
                              sx={{ width: { xs: "100%", sm: "auto" } }}
                            >
                              Reject
                            </Button>
                          </Box>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
                {(!luckyList || luckyList.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        No submissions in your pincode.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {activeTab === TABS.ASSIGN && (
        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 2, backgroundColor: '#e8f5e8' }}>
          {empError ? <Alert severity="warning" sx={{ mb: 2 }}>{empError}</Alert> : null}
          {typeof quota?.remaining === "number" ? (
            <Alert severity={quota.remaining > 0 ? "info" : "warning"} sx={{ mb: 2 }}>
              Quota: {quota.quota} | Assigned: {quota.assigned} | Remaining: {quota.remaining}
            </Alert>
          ) : null}
          <Box component="form" onSubmit={submitAssignment}>
            <Stack spacing={2}>
              <TextField
                select
                fullWidth
                label="Select Employee"
                name="employee"
                value={assignForm.employee}
                onChange={onAssignChange}
                error={Boolean(assignErrors?.employee)}
                helperText={
                  assignErrors?.employee?.[0] ||
                  (assignableEmployees?.length ? "" : "No employees found in your pincode or registered under your agency.")
                }
              >
                {(assignableEmployees || []).map((emp) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.username} — {emp.full_name || ""} — {emp.phone || ""} — {emp.email || ""}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Quantity"
                name="quantity"
                value={assignForm.quantity}
                onChange={onAssignChange}
                error={Boolean(assignErrors?.quantity)}
                helperText={assignErrors?.quantity?.[0] || (typeof quota?.remaining === "number" ? `Remaining: ${quota.remaining}` : "")}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 1 }}
                required
              />
              <TextField
                fullWidth
                label="Note (optional)"
                name="note"
                value={assignForm.note}
                onChange={onAssignChange}
                error={Boolean(assignErrors?.note)}
                helperText={assignErrors?.note?.[0] || ""}
                multiline
                minRows={2}
              />
              <Button type="submit" variant="contained" disabled={assignSubmitting || (typeof quota?.remaining === "number" && quota.remaining <= 0) || !(assignableEmployees && assignableEmployees.length)}>
                {assignSubmitting ? "Assigning..." : "Assign"}
              </Button>
            </Stack>
          </Box>

          <div style={{ height: 16 }} />

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Assignment History
          </Typography>
          {assignLoading ? (
            <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
            </Box>
          ) : assignError ? (
            <Alert severity="error">{assignError}</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Employee</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Full Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Pincode</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Sold</TableCell>
                  <TableCell>Remaining</TableCell>
                  <TableCell>Channel</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(assignList || []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</TableCell>
                    <TableCell>{a.employee_username || ""}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{a.employee_full_name || ""}</TableCell>
                    <TableCell>{a.employee_email || ""}</TableCell>
                    <TableCell>{a.employee_phone || ""}</TableCell>
                    <TableCell>{a.employee_pincode || ""}</TableCell>
                    <TableCell>{a.quantity}</TableCell>
                    <TableCell>{a.sold_count}</TableCell>
                    <TableCell>{a.remaining}</TableCell>
                    <TableCell>{a.channel}</TableCell>
                  </TableRow>
                ))}
                {(!assignList || assignList.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        No assignments yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {activeTab === TABS.EMPLOYEES && (
        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 2, backgroundColor: '#ffffff' }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
              Employee Details
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" onClick={loadEmployees}>Refresh</Button>
            </Box>
          </Box>
          {empLoading ? (
            <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
            </Box>
          ) : empError ? (
            <Alert severity="error">{empError}</Alert>
          ) : (
            <>
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <Grid container spacing={1.5}>
                  {(myEmployees || []).map((u) => (
                    <Grid item xs={12} key={u.id}>
                      <Paper
                        elevation={2}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          background: "linear-gradient(180deg,#f8fafc 0%,#ffffff 100%)",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 12px rgba(2,6,23,0.06)",
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: "#0C2D48", color: "#fff", width: 40, height: 40 }}>
                            {String(u.full_name || u.username || "").slice(0, 2).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {u.username}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {u.full_name || "—"}
                            </Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>📞 {u.phone || "—"}</Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>✉️ {u.email || "—"}</Typography>
                            </Box>
                            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5 }}>
                              {(u.pincode || "")}{u.city ? `, ${u.city}` : ""}{u.state ? `, ${u.state}` : ""}{u.country ? `, ${u.country}` : ""}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                              <Chip
                                size="small"
                                label={u.account_active ? "Active" : "Inactive"}
                                color={u.account_active ? "success" : "default"}
                              />
                              <Switch
                                checked={!!u.account_active}
                                disabled={empBusyId === u.id}
                                onChange={(e) => toggleEmployeeActive(u, e.target.checked)}
                                inputProps={{ "aria-label": "Toggle account active" }}
                              />
                            </Box>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                  {(!myEmployees || myEmployees.length === 0) && (
                    <Grid item xs={12}>
                      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: "1px dashed #cbd5e1", backgroundColor: "#f8fafc", textAlign: "center" }}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          No employees found.
                        </Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Box>

              <Box sx={{ display: { xs: "none", md: "block" } }}>
                <TableContainer sx={{ overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Username</TableCell>
                        <TableCell>Full Name</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Email</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Address</TableCell>
                        <TableCell>Account</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(myEmployees || []).map((u) => (
                        <TableRow key={u.id}>
                          <TableCell sx={{ whiteSpace: "normal", wordBreak: "break-word", maxWidth: { xs: 140, sm: "unset" } }}>{u.username}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "normal", wordBreak: "break-word", maxWidth: { xs: 160, sm: "unset" } }}>{u.full_name || ""}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "normal", wordBreak: "break-word" }}>{u.email || ""}</TableCell>
                          <TableCell sx={{ whiteSpace: "normal", wordBreak: "break-word" }}>{u.phone || ""}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, whiteSpace: "normal", wordBreak: "break-word" }}>
                            {u.pincode || ""}{u.city ? `, ${u.city}` : ""}{u.state ? `, ${u.state}` : ""}{u.country ? `, ${u.country}` : ""}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={u.account_active ? "Active" : "Inactive"}
                              color={u.account_active ? "success" : "default"}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Switch
                              checked={!!u.account_active}
                              disabled={empBusyId === u.id}
                              onChange={(e) => toggleEmployeeActive(u, e.target.checked)}
                              inputProps={{ "aria-label": "Toggle account active" }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!myEmployees || myEmployees.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              No employees found.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}
        </Paper>
      )}
      {/* My 5‑Matrix Team (click child card to drill down) */}
      {/* <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 2, backgroundColor: '#fce4ec' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
          My Team (5‑Matrix)
        </Typography>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff", padding: 12 }}>
          <TreeReferralGalaxy mode="self" />
        </div>
      </Paper> */}
    </Container>
  );
}
