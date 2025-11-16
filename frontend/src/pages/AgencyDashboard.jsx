import React, { useEffect, useMemo, useState } from "react";
import {
  Typography,
  Box,
  Container,
  Paper,
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
} from "@mui/material";
import API from "../api/api";
import RewardsTargetCard from "../components/RewardsTargetCard";
import TreeReferralGalaxy from "../components/TreeReferralGalaxy";

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

  // Sidebar tabs (internal page tabs)
  const TABS = {
    LUCKY: "lucky",
    ASSIGN: "assign",
    EMPLOYEES: "employees",
  };
  const [activeTab, setActiveTab] = useState(TABS.LUCKY);
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

  const loadLuckyHistory = async () => {
    try {
      setLuckyLoading(true);
      setLuckyError("");
      // Prefer actionable pending list for agency; toggle to view all if needed
      const url = showAllLucky ? "/uploads/lucky-draw/" : "/uploads/lucky-draw/pending/agency/";
      const res = await API.get(url);
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setLuckyList(arr || []);
    } catch (e) {
      setLuckyError("Failed to load lucky draw submissions");
      setLuckyList([]);
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
    loadLuckyHistory();
    loadCommission();
    loadWallet();
    loadEcSummary();
    loadAgencyCodes();
  }, []);

  // Load my 5‑matrix genealogy tree
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setMyTreeLoading(true);
        const res = await API.get("/accounts/my/matrix/tree/", { params: { max_depth: 6 } });
        if (!mounted) return;
        setMyTree(res?.data || null);
        setMyTreeErr("");
      } catch (e) {
        if (!mounted) return;
        setMyTree(null);
        setMyTreeErr(e?.response?.data?.detail || "Failed to load hierarchy.");
      } finally {
        if (mounted) setMyTreeLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
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
  useEffect(() => {
    if (activeTab === TABS.LUCKY) {
      loadLuckyHistory();
    }
  }, [showAllLucky, activeTab]);

  // Reload employees list when switching to Assign or Employees tabs
  useEffect(() => {
    if (activeTab === TABS.ASSIGN || activeTab === TABS.EMPLOYEES) {
      loadEmployees();
    }
    if (activeTab === TABS.ASSIGN) {
      loadQuota();
    }
  }, [activeTab]);

  // Reload agency codes when pagination or status filter changes
  useEffect(() => {
    loadAgencyCodes();
  }, [agencyCodesPage, agencyCodesPageSize, agencyStatusFilter]);

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

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {/* <Button variant={activeTab === TABS.LUCKY ? "contained" : "outlined"} onClick={() => setActiveTab(TABS.LUCKY)}>
          Lucky Draw Submission
        </Button>
         */}
        <Button variant={activeTab === TABS.EMPLOYEES ? "contained" : "outlined"} onClick={() => setActiveTab(TABS.EMPLOYEES)}>
          Employee Details
        </Button>
      </Stack>

      {activeTab === TABS.LUCKY && (
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
          <Box sx={{ mb: 2 }}>
            {walletLoading ? (
              <Typography variant="body2">Loading wallet...</Typography>
            ) : walletError ? (
              <Alert severity="error">{walletError}</Alert>
            ) : (
              <Alert severity="info">
                Wallet Balance: ₹{wallet.balance} {wallet.updated_at ? `— updated ${new Date(wallet.updated_at).toLocaleString()}` : ""}
              </Alert>
            )}
          </Box>
          <Box sx={{ mb: 2 }}>
            <Alert severity="success">
              My commission earned: ₹{commissionTotal.toFixed(2)}
            </Alert>
          </Box>
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
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>All My E‑Coupon Codes</Typography>
            <Grid container spacing={1} sx={{ mb: 1 }}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Status"
                  value={agencyStatusFilter}
                  onChange={(e) => { setAgencyStatusFilter(e.target.value); setAgencyCodesPage(1); }}
                  sx={{ minWidth: { sm: 180 } }}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="AVAILABLE">AVAILABLE</MenuItem>
                  <MenuItem value="ASSIGNED_AGENCY">ASSIGNED_AGENCY</MenuItem>
                  <MenuItem value="ASSIGNED_EMPLOYEE">ASSIGNED_EMPLOYEE</MenuItem>
                  <MenuItem value="SOLD">SOLD</MenuItem>
                  <MenuItem value="REDEEMED">REDEEMED</MenuItem>
                  <MenuItem value="REVOKED">REVOKED</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="Rows"
                  value={agencyCodesPageSize}
                  onChange={(e) => { setAgencyCodesPageSize(Number(e.target.value)); setAgencyCodesPage(1); }}
                  sx={{ minWidth: { sm: 120 } }}
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={2} md={2}>
                <Button
                  size="small"
                  onClick={loadAgencyCodes}
                  fullWidth
                >
                  Refresh
                </Button>
              </Grid>
            </Grid>
            {agencyCodesLoading ? (
              <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={18} /> <Typography variant="body2">Loading…</Typography>
              </Box>
            ) : agencyCodesError ? (
              <Alert severity="error">{agencyCodesError}</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Status</TableCell>
                
                    <TableCell>Value</TableCell>
                    <TableCell>Assigned Agency</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(agencyCodes || []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.code}</TableCell>
                      <TableCell>{c.status}</TableCell>
                     
                      <TableCell>{typeof c.value !== "undefined" ? `₹${c.value}` : ""}</TableCell>
                      <TableCell>{c.assigned_agency_username || ""}</TableCell>
                      <TableCell>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</TableCell>
                    </TableRow>
                  ))}
                  {(!agencyCodes || agencyCodes.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          No e‑coupons assigned to your agency.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            {!agencyCodesLoading && !agencyCodesError ? (
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {agencyCodesTotal} items
                </Typography>
                <Pagination
                  count={Math.max(1, Math.ceil(agencyCodesTotal / agencyCodesPageSize))}
                  page={agencyCodesPage}
                  onChange={(e, p) => setAgencyCodesPage(p)}
                  size="small"
                />
              </Box>
            ) : null}
          </Box>

          {luckyLoading ? (
            <Box sx={{ py: 4, display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
            </Box>
          ) : luckyError ? (
            <Alert severity="error">{luckyError}</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>SL</TableCell>
                  <TableCell>Ledger</TableCell>
                  <TableCell>Employee</TableCell>
                  <TableCell>Pincode</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>TRE Reviewer</TableCell>
                  <TableCell>Agency Reviewer</TableCell>
                  <TableCell>Comments</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(luckyList || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                    <TableCell>{r.sl_number}</TableCell>
                    <TableCell>{r.ledger_number}</TableCell>
                    <TableCell>
                      {(r.username || "")}
                      {r.user ? ` (#${r.user})` : ""}
                      {r.tr_emp_id ? ` [TRE:${r.tr_emp_id}]` : ""}
                    </TableCell>
                    <TableCell>{r.pincode}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      {r.tre_reviewer ? r.tre_reviewer : ""} {r.tre_reviewed_at ? `(${new Date(r.tre_reviewed_at).toLocaleString()})` : ""}
                    </TableCell>
                    <TableCell>
                      {r.agency_reviewer ? r.agency_reviewer : ""} {r.agency_reviewed_at ? `(${new Date(r.agency_reviewed_at).toLocaleString()})` : ""}
                    </TableCell>
                    <TableCell>
                      {r.tre_comment ? `TRE: ${r.tre_comment} ` : ""}
                      {r.agency_comment ? `AGENCY: ${r.agency_comment}` : ""}
                    </TableCell>
                    <TableCell align="right">
                      {String(r.status).toUpperCase() === "TRE_APPROVED" ? (
                        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                          <Button size="small" variant="contained" disabled={busyId === r.id} onClick={() => agencyApproveLucky(r.id)} sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" } }}>
                            Approve
                          </Button>
                          <Button size="small" variant="outlined" color="error" disabled={busyId === r.id} onClick={() => agencyRejectLucky(r.id)}>
                            Reject
                          </Button>
                        </Box>
                      ) : (
                        "-"
                      )}
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
                  <TableCell>Full Name</TableCell>
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
                    <TableCell>{a.employee_full_name || ""}</TableCell>
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
        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 2, backgroundColor: '#fff3e0' }}>
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
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Full Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Address</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(myEmployees || []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.username}</TableCell>
                    <TableCell>{u.full_name || ""}</TableCell>
                    <TableCell>{u.email || ""}</TableCell>
                    <TableCell>{u.phone || ""}</TableCell>
                    <TableCell>
                      {u.pincode || ""}{u.city ? `, ${u.city}` : ""}{u.state ? `, ${u.state}` : ""}{u.country ? `, ${u.country}` : ""}
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
