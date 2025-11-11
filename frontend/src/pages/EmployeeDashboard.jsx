import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  IconButton,
  Button,
  Container,
  Paper,
  Grid,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import LOGO from "../assets/TRIKONEKT.png";
import API from "../api/api";
import RewardsTargetCard from "../components/RewardsTargetCard";
import ReferAndEarn from "../components/ReferAndEarn";
import TreeReferralGalaxy from "../components/TreeReferralGalaxy";

const drawerWidth = 220;

export default function EmployeeDashboard({ embedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Identity
  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Employee";

  // Layout
  const theme = useTheme();
  useMediaQuery(theme.breakpoints.up("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      localStorage.removeItem("refresh");
      sessionStorage.removeItem("refresh");
      localStorage.removeItem("role");
      sessionStorage.removeItem("role");
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
    } catch (e) {}
    navigate("/", { replace: true });
  };

  // Sidebar tabs (Lucky Draw only)
  const TABS = {
    LUCKY: "lucky",
    ASSIGN: "assignments",
    ECOUPONS: "ecoupons",
    WALLET: "wallet",
  };
  const [activeTab, setActiveTab] = useState(() => {
    const q = new URLSearchParams(location.search);
    const t = (q.get("tab") || "").toLowerCase();
    if (t === "ecoupons") return TABS.ECOUPONS;
    if (t === "wallet") return TABS.WALLET;
    return TABS.LUCKY;
  });

  // Keep URL and local tab state in sync (so shell highlight matches)
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const t = (q.get("tab") || "").toLowerCase();
    const next = t === "ecoupons" ? TABS.ECOUPONS : t === "wallet" ? TABS.WALLET : TABS.LUCKY;
    setActiveTab(next);
  }, [location.search]);

  // Lucky draw pending (TRE)
  const [luckyPending, setLuckyPending] = useState([]);
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyError, setLuckyError] = useState("");
  const [luckyActionBusy, setLuckyActionBusy] = useState(false);

  // Stats (employee review counts)
  const [luckyStats, setLuckyStats] = useState({ approved: 0, rejected: 0, total: 0 });
  // Approved history list
  const [approvedList, setApprovedList] = useState([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedError, setApprovedError] = useState("");

  // Commission earned
  const [commissionTotal, setCommissionTotal] = useState(0);
  const [commissions, setCommissions] = useState([]);

  // My assignments (employee)
  const [assignList, setAssignList] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [soldEdits, setSoldEdits] = useState({});

  const loadMyAssignments = async () => {
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

  const handleSoldChange = (id, val) => {
    setSoldEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), value: val } }));
  };

  const saveSold = async (row) => {
    const id = row.id;
    let val = (soldEdits[id]?.value ?? row.sold_count ?? 0);
    const qty = Number(row.quantity || 0);
    const parsed = Number(val);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setSoldEdits((p) => ({ ...p, [id]: { ...(p[id] || {}), error: "Enter a non-negative number" } }));
      return;
    }
    if (parsed > qty) {
      setSoldEdits((p) => ({ ...p, [id]: { ...(p[id] || {}), error: `Cannot exceed assigned (${qty})` } }));
      return;
    }
    try {
      setSoldEdits((p) => ({ ...p, [id]: { ...(p[id] || {}), saving: true, error: "" } }));
      const resp = await API.patch(`/uploads/lucky-assignments/${id}/`, { sold_count: parsed });
      const updated = resp?.data;
      setAssignList((list) => list.map((it) => (it.id === id ? updated : it)));
      setSoldEdits((p) => ({ ...p, [id]: { value: updated?.sold_count ?? parsed, saving: false, error: "" } }));
    } catch (e) {
      const msg = e?.response?.data?.sold_count?.[0] || e?.response?.data?.detail || "Update failed";
      setSoldEdits((p) => ({ ...p, [id]: { ...(p[id] || {}), saving: false, error: String(msg) } }));
    }
  };

  const loadLuckyPending = async () => {
    try {
      setLuckyLoading(true);
      setLuckyError("");
      const res = await API.get("/uploads/lucky-draw/pending/tre/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setLuckyPending(arr || []);
    } catch (e) {
      setLuckyError("Failed to load lucky draw pending");
      setLuckyPending([]);
    } finally {
      setLuckyLoading(false);
    }
  };


  const loadLuckyStats = async () => {
    try {
      const res = await API.get("/uploads/lucky-draw/tre/history/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      const approved = (arr || []).filter((r) => String(r.status).toUpperCase() === "TRE_APPROVED").length;
      const rejected = (arr || []).filter((r) => String(r.status).toUpperCase() === "TRE_REJECTED").length;
      setLuckyStats({ approved, rejected, total: approved + rejected });
    } catch (e) {
      // keep previous stats on failure
    }
  };

  const loadApprovedHistory = async () => {
    try {
      setApprovedLoading(true);
      setApprovedError("");
      const res = await API.get("/uploads/lucky-draw/tre/history/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      const onlyApproved = (arr || []).filter((r) => {
        const st = String(r.status || "").toUpperCase();
        return st === "TRE_APPROVED" || st === "AGENCY_APPROVED";
      });
      setApprovedList(onlyApproved);
    } catch (e) {
      setApprovedError("Failed to load approved submissions");
      setApprovedList([]);
    } finally {
      setApprovedLoading(false);
    }
  };

  const loadMyCommissions = async () => {
    try {
      const res = await API.get("/coupons/commissions/mine/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setCommissions(arr || []);
      const total = (arr || [])
        .filter((c) => ["earned", "paid"].includes(String(c.status || "").toLowerCase()))
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      setCommissionTotal(total);
    } catch (e) {
      // ignore
    }
  };

  // My E‑Coupon codes (assigned to me)
  const [codes, setCodes] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState("");

  const loadCodes = async () => {
    try {
      setCodesLoading(true);
      setCodesError("");
      const res = await API.get("/coupons/codes/mine/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setCodes(arr || []);
    } catch (e) {
      setCodesError("Failed to load my e‑coupon codes.");
      setCodes([]);
    } finally {
      setCodesLoading(false);
    }
  };

  // Assign e‑coupon to consumer (employee flow)
  const [assign, setAssign] = useState({ codeId: "", consumerUsername: "", pincode: "", notes: "" });
  const [assignBusy, setAssignBusy] = useState(false);
  const doAssign = async () => {
    try {
      if (!assign.codeId || !assign.consumerUsername || !assign.pincode) {
        alert("Select code, enter consumer username and pincode.");
        return;
      }
      setAssignBusy(true);
      await API.post(`/coupons/codes/${assign.codeId}/assign-consumer/`, {
        consumer_username: String(assign.consumerUsername).trim(),
        pincode: String(assign.pincode).trim(),
        notes: String(assign.notes || "").trim(),
      });
      alert("E‑Coupon assigned to consumer.");
      setAssign({ codeId: "", consumerUsername: "", pincode: "", notes: "" });
      await loadCodes();
      await loadMyCommissions();
      await loadPendingSubs();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Failed to assign code.";
      alert(msg);
    } finally {
      setAssignBusy(false);
    }
  };

  // Pending E‑Coupon submissions awaiting my (employee) approval
  const [pendingSubs, setPendingSubs] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingBusy, setPendingBusy] = useState(false);

  const loadPendingSubs = async () => {
    try {
      setPendingLoading(true);
      setPendingError("");
      const res = await API.get("/coupons/submissions/pending-mine/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setPendingSubs(arr || []);
    } catch (e) {
      setPendingError("Failed to load pending e‑coupon submissions.");
      setPendingSubs([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const empApprove = async (id) => {
    try {
      setPendingBusy(true);
      await API.post(`/coupons/submissions/${id}/employee-approve/`, { comment: "" });
      await loadPendingSubs();
      await loadMyCommissions();
    } catch (e) {
      const err = e?.response?.data;
      alert(err?.detail || "Approve failed.");
    } finally {
      setPendingBusy(false);
    }
  };

  const empReject = async (id) => {
    try {
      setPendingBusy(true);
      await API.post(`/coupons/submissions/${id}/employee-reject/`, { comment: "" });
      await loadPendingSubs();
    } catch (e) {
      const err = e?.response?.data;
      alert(err?.detail || "Reject failed.");
    } finally {
      setPendingBusy(false);
    }
  };

  // Wallet panel (balance + transactions)
  const [wallet, setWallet] = useState({ balance: "0", updated_at: null });
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");

  const [txs, setTxs] = useState([]);
  const [txsLoading, setTxsLoading] = useState(false);
  const [txsError, setTxsError] = useState("");

  // Withdrawals
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [wdrErr, setWdrErr] = useState("");
  const [wdrSubmitting, setWdrSubmitting] = useState(false);
  const [wdrForm, setWdrForm] = useState({
    amount: "",
    method: "upi",
    upi_id: "",
    bank_name: "",
    bank_account_number: "",
    ifsc_code: "",
  });
  const onWdrChange = (e) => setWdrForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const cooldownUntil = useMemo(() => {
    try {
      const last = (myWithdrawals || []).find((w) => String(w.status).toLowerCase() !== "rejected");
      if (!last || !last.requested_at) return null;
      const dt = new Date(last.requested_at);
      dt.setDate(dt.getDate() + 7);
      return dt;
    } catch {
      return null;
    }
  }, [myWithdrawals]);
  const onCooldown = Boolean(cooldownUntil && cooldownUntil > new Date());

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

  const loadTransactions = async () => {
    try {
      setTxsLoading(true);
      setTxsError("");
      const res = await API.get("/accounts/wallet/me/transactions/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setTxs(arr || []);
    } catch (e) {
      setTxsError("Failed to load wallet transactions.");
      setTxs([]);
    } finally {
      setTxsLoading(false);
    }
  };

  const loadMyWithdrawals = async () => {
    try {
      const res = await API.get("/accounts/withdrawals/me/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setMyWithdrawals(arr || []);
    } catch (e) {
      setMyWithdrawals([]);
    }
  };

  const submitWithdrawal = async (e) => {
    e.preventDefault();
    setWdrErr("");
    if (onCooldown) return;
    const amtNum = Number(wdrForm.amount);
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      setWdrErr("Enter a valid amount.");
      return;
    }
    const payload = {
      amount: amtNum,
      method: wdrForm.method,
    };
    if (wdrForm.method === "upi") {
      if (!wdrForm.upi_id.trim()) {
        setWdrErr("UPI ID is required for UPI withdrawals.");
        return;
      }
      payload.upi_id = wdrForm.upi_id.trim();
    } else {
      if (wdrForm.bank_name) payload.bank_name = wdrForm.bank_name.trim();
      if (wdrForm.bank_account_number) payload.bank_account_number = wdrForm.bank_account_number.trim();
      if (wdrForm.ifsc_code) payload.ifsc_code = wdrForm.ifsc_code.trim().toUpperCase();
    }
    try {
      setWdrSubmitting(true);
      await API.post("/accounts/withdrawals/", payload);
      await Promise.all([loadWallet(), loadTransactions(), loadMyWithdrawals()]);
      setWdrForm({
        amount: "",
        method: wdrForm.method,
        upi_id: "",
        bank_name: "",
        bank_account_number: "",
        ifsc_code: "",
      });
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (e?.response?.data ? JSON.stringify(e.response.data) : "Failed to submit withdrawal.");
      setWdrErr(String(msg));
    } finally {
      setWdrSubmitting(false);
    }
  };

  const treApproveLucky = async (id) => {
    try {
      setLuckyActionBusy(true);
      await API.post(`/uploads/lucky-draw/${id}/tre-approve/`, { comment: "" });
      await loadLuckyPending();
      await loadLuckyStats();
      await loadApprovedHistory();
    } catch (e) {
    } finally {
      setLuckyActionBusy(false);
    }
  };

  const treRejectLucky = async (id) => {
    try {
      setLuckyActionBusy(true);
      await API.post(`/uploads/lucky-draw/${id}/tre-reject/`, { comment: "" });
      await loadLuckyPending();
      await loadLuckyStats();
      await loadApprovedHistory();
    } catch (e) {
    } finally {
      setLuckyActionBusy(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadLuckyPending();
    loadLuckyStats();
    loadApprovedHistory();
    loadMyCommissions();
    loadMyAssignments();
    loadCodes();
    loadPendingSubs();
    loadWallet();
    loadTransactions();
    loadMyWithdrawals();
  }, []);

  // Sidebar UI
  const drawer = (
    <Box sx={{ overflow: "auto" }}>
      <List>
        <ListItemButton
          selected={location.pathname === "/employee/profile"}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => { navigate("/employee/profile"); }}
        >
          <ListItemText primary="Profile" />
        </ListItemButton>
        <ListItemButton
          selected={activeTab === TABS.LUCKY}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => { setActiveTab(TABS.LUCKY); navigate("/employee/dashboard?tab=lucky"); }}
        >
          <ListItemText primary="Lucky Draw Submission" />
        </ListItemButton>
        {/* <ListItemButton
          selected={activeTab === TABS.ASSIGN}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => setActiveTab(TABS.ASSIGN)}
        >
          <ListItemText primary="My Assignments" />
        </ListItemButton> */}
        <ListItemButton
          selected={activeTab === TABS.ECOUPONS}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => { setActiveTab(TABS.ECOUPONS); navigate("/employee/dashboard?tab=ecoupons"); }}
        >
          <ListItemText primary="My E‑Coupons" />
        </ListItemButton>
        <ListItemButton
          selected={activeTab === TABS.WALLET}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => { setActiveTab(TABS.WALLET); navigate("/employee/dashboard?tab=wallet"); }}
        >
          <ListItemText primary="My Wallet" />
        </ListItemButton>
        <ListItemButton
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => navigate("/employee/daily-report")}
        >
          <ListItemText primary="Daily Report" />
        </ListItemButton>
      </List>
      <Divider />
      <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>
        Logged in as: {displayName}
      </Box>
    </Box>
  );

  if (embedded) {
    return (
        <Container maxWidth="lg" sx={{ px: 0 }}>
          <ReferAndEarn title="Refer & Earn" />
          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
              My Team (5‑Matrix)
            </Typography>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff", padding: 12 }}>
              <TreeReferralGalaxy mode="self" />
            </div>
          </Paper>
        {activeTab === TABS.LUCKY && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <RewardsTargetCard role="employee" />
            </Grid>
            {/* Lucky draw submissions awaiting my (TRE) approval */}
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                  Lucky Draw Submissions Awaiting My Approval
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Alert severity="info">
                    My reviews — Approved: {luckyStats.approved} | Rejected: {luckyStats.rejected}
                  </Alert>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Alert severity="success">
                    My commission earned: ₹{commissionTotal.toFixed(2)}
                  </Alert>
                </Box>
                {luckyLoading ? (
                  <Box sx={{ py: 3, display: "flex", alignItems: "center", gap: 1 }}>
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
                        <TableCell>Pincode</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(luckyPending || []).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                          <TableCell>{r.sl_number}</TableCell>
                          <TableCell>{r.ledger_number}</TableCell>
                          <TableCell>{r.pincode}</TableCell>
                          <TableCell>{r.status}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="contained"
                                disabled={luckyActionBusy}
                                onClick={() => treApproveLucky(r.id)}
                                sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" } }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled={luckyActionBusy}
                                onClick={() => treRejectLucky(r.id)}
                              >
                                Reject
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!luckyPending || luckyPending.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              No pending lucky draw submissions.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>

            {/* My Approved Submissions */}
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                  My Approved Submissions
                </Typography>
                {approvedLoading ? (
                  <Box sx={{ py: 3, display: "flex", alignItems: "center", gap: 1 }}>
                    <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
                  </Box>
                ) : approvedError ? (
                  <Alert severity="error">{approvedError}</Alert>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>SL</TableCell>
                        <TableCell>Ledger</TableCell>
                        <TableCell>Pincode</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Agency Reviewer</TableCell>
                        <TableCell>Comments</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(approvedList || []).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                          <TableCell>{r.sl_number}</TableCell>
                          <TableCell>{r.ledger_number}</TableCell>
                          <TableCell>{r.pincode}</TableCell>
                          <TableCell>{r.status}</TableCell>
                          <TableCell>
                            {r.agency_reviewer ? r.agency_reviewer : ""} {r.agency_reviewed_at ? `(${new Date(r.agency_reviewed_at).toLocaleString()})` : ""}
                          </TableCell>
                          <TableCell>
                            {r.tre_comment ? `TRE: ${r.tre_comment} ` : ""}
                              {r.agency_comment ? `AGENCY: ${r.agency_comment}` : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!approvedList || approvedList.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              No approved submissions yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
        {activeTab === TABS.ASSIGN && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
                    My Lucky Draw Coupon Assignments
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button size="small" onClick={loadMyAssignments}>Refresh</Button>
                  </Box>
                </Box>
                {assignError ? <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert> : null}
                {assignLoading ? (
                  <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                    <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
                  </Box>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Agency</TableCell>
                        <TableCell>Assigned</TableCell>
                        <TableCell>Sold</TableCell>
                        <TableCell>Remaining</TableCell>
                        <TableCell>Note</TableCell>
                        <TableCell align="right">Update</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(assignList || []).map((row) => {
                        const edit = soldEdits[row.id] || {};
                        const value = edit.value !== undefined ? edit.value : row.sold_count || 0;
                        return (
                          <TableRow key={row.id}>
                            <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : ""}</TableCell>
                            <TableCell>{row.created_by_username || ""}</TableCell>
                            <TableCell>{row.quantity}</TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={value}
                                onChange={(e) => handleSoldChange(row.id, e.target.value)}
                                error={Boolean(edit.error)}
                                helperText={edit.error || ""}
                                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 0 }}
                                sx={{ width: 120 }}
                              />
                            </TableCell>
                            <TableCell>{row.remaining}</TableCell>
                            <TableCell>{row.note || ""}</TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => saveSold(row)}
                                disabled={Boolean(edit.saving)}
                              >
                                {edit.saving ? "Saving..." : "Save"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!assignList || assignList.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7}>
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
            </Grid>
          </Grid>
        )}
        {activeTab === TABS.ECOUPONS && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                  My E‑Coupon Codes
                </Typography>

                {/* Pending E‑Coupon submissions awaiting my approval */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: "#fff" }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                    Pending E‑Coupon Submissions Awaiting My Approval
                  </Typography>
                  {pendingLoading ? (
                    <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={18} /> <Typography variant="body2">Loading…</Typography>
                    </Box>
                  ) : pendingError ? (
                    <Alert severity="error">{pendingError}</Alert>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Consumer</TableCell>
                          <TableCell>Coupon Code</TableCell>
                          <TableCell>Pincode</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(pendingSubs || []).map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>{s.created_at ? new Date(s.created_at).toLocaleString() : ""}</TableCell>
                            <TableCell>{s.consumer_username || s.consumer || ""}</TableCell>
                            <TableCell>{s.coupon_code || (s.code_ref && s.code_ref.code) || ""}</TableCell>
                            <TableCell>{s.pincode || ""}</TableCell>
                            <TableCell>{s.status}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={pendingBusy}
                                  onClick={() => empApprove(s.id)}
                                  sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" } }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  disabled={pendingBusy}
                                  onClick={() => empReject(s.id)}
                                >
                                  Reject
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!pendingSubs || pendingSubs.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                No pending e‑coupon submissions.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>

                {/* Assign to Consumer */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: "#fbfdff" }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                    Assign E‑Coupon to Consumer
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      select
                      size="small"
                      label="Select Code"
                      value={assign.codeId}
                      onChange={(e) => setAssign((a) => ({ ...a, codeId: e.target.value }))}
                      sx={{ minWidth: 220 }}
                      helperText={codesLoading ? "Loading..." : (codesError || "")}
                    >
                      {(codes || [])
                        .filter((c) => c.status === "ASSIGNED_EMPLOYEE" || c.status === "AVAILABLE")
                        .map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.code} {typeof c.value !== "undefined" ? `(₹${c.value})` : ""}
                          </MenuItem>
                        ))}
                      {(!codes || codes.length === 0) && (
                        <MenuItem disabled value="">
                          {codesLoading ? "Loading..." : "No codes assigned to you"}
                        </MenuItem>
                      )}
                    </TextField>
                    <TextField
                      size="small"
                      label="Consumer Username"
                      value={assign.consumerUsername}
                      onChange={(e) => setAssign((a) => ({ ...a, consumerUsername: e.target.value }))}
                      sx={{ minWidth: 200 }}
                    />
                    <TextField
                      size="small"
                      label="Pincode"
                      value={assign.pincode}
                      onChange={(e) => setAssign((a) => ({ ...a, pincode: e.target.value }))}
                      inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
                      sx={{ minWidth: 140 }}
                    />
                    <TextField
                      size="small"
                      label="Notes"
                      value={assign.notes}
                      onChange={(e) => setAssign((a) => ({ ...a, notes: e.target.value }))}
                      sx={{ minWidth: 200 }}
                    />
                    <Button
                      variant="contained"
                      onClick={doAssign}
                      disabled={assignBusy || !assign.codeId || !assign.consumerUsername || !assign.pincode}
                    >
                      {assignBusy ? "Assigning..." : "Assign"}
                    </Button>
                  </Stack>
                </Paper>

                {codesLoading ? (
                  <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                    <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
                  </Box>
                ) : codesError ? (
                  <Alert severity="error">{codesError}</Alert>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Code</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Batch</TableCell>
                        <TableCell>Serial</TableCell>
                        <TableCell>Value</TableCell>
                        <TableCell>Assigned Agency</TableCell>
                        <TableCell>Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(codes || []).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.code}</TableCell>
                          <TableCell>{c.status}</TableCell>
                          <TableCell>{c.batch || ""}</TableCell>
                          <TableCell>{c.serial || ""}</TableCell>
                          <TableCell>{typeof c.value !== "undefined" ? `₹${c.value}` : ""}</TableCell>
                          <TableCell>{c.assigned_agency_username || ""}</TableCell>
                          <TableCell>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</TableCell>
                        </TableRow>
                      ))}
                      {(!codes || codes.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              No codes assigned to you.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>

            {/* Commissions list */}
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                  My Commissions
                </Typography>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Commission earned (lifetime): ₹{commissionTotal.toFixed(2)}
                </Alert>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Coupon Code</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(commissions || []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.earned_at ? new Date(c.earned_at).toLocaleString() : ""}</TableCell>
                        <TableCell>₹{c.amount}</TableCell>
                        <TableCell>{c.status}</TableCell>
                        <TableCell>{c.role}</TableCell>
                        <TableCell>{c.coupon_code || ""}</TableCell>
                      </TableRow>
                    ))}
                    {(!commissions || commissions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            No commissions yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          </Grid>
        )}
        {activeTab === TABS.WALLET && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                  My Wallet
                </Typography>
                {walletLoading ? (
                  <Typography variant="body2">Loading...</Typography>
                ) : walletError ? (
                  <Alert severity="error">{walletError}</Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Balance: ₹{wallet.balance} {wallet.updated_at ? `— updated ${new Date(wallet.updated_at).toLocaleString()}` : ""}
                  </Alert>
                )}

                <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                  Request Withdrawal
                </Typography>
                {wdrErr ? <Alert severity="error" sx={{ mb: 1 }}>{wdrErr}</Alert> : null}
                {onCooldown ? (
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    Only one withdrawal is allowed per week. Next available:{" "}
                    {cooldownUntil ? cooldownUntil.toLocaleString() : "-"}
                  </Alert>
                ) : null}
                <Box component="form" onSubmit={submitWithdrawal} sx={{ mb: 2 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Amount (₹)"
                      name="amount"
                      value={wdrForm.amount}
                      onChange={(e) => setWdrForm((f) => ({ ...f, amount: e.target.value }))}
                      inputProps={{ inputMode: "decimal" }}
                      required
                    />
                    <TextField
                      fullWidth
                      size="small"
                      select
                      label="Method"
                      name="method"
                      value={wdrForm.method}
                      onChange={onWdrChange}
                    >
                      <MenuItem value="upi">UPI</MenuItem>
                      <MenuItem value="bank">Bank</MenuItem>
                    </TextField>
                  </Stack>
                  {wdrForm.method === "upi" ? (
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="UPI ID"
                        name="upi_id"
                        value={wdrForm.upi_id}
                        onChange={onWdrChange}
                        required
                      />
                    </Box>
                  ) : (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Bank Name"
                        name="bank_name"
                        value={wdrForm.bank_name}
                        onChange={onWdrChange}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Account Number"
                        name="bank_account_number"
                        value={wdrForm.bank_account_number}
                        onChange={onWdrChange}
                        inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="IFSC Code"
                        name="ifsc_code"
                        value={wdrForm.ifsc_code}
                        onChange={onWdrChange}
                        inputProps={{ maxLength: 11, style: { textTransform: "uppercase" } }}
                      />
                    </Stack>
                  )}
                  <Button type="submit" variant="contained" disabled={onCooldown || wdrSubmitting} sx={{ mt: 1 }}>
                    {wdrSubmitting ? "Requesting..." : "Request Withdrawal"}
                  </Button>
                </Box>

                <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                  Recent Transactions
                </Typography>
                {txsLoading ? (
                  <Typography variant="body2">Loading...</Typography>
                ) : txsError ? (
                  <Alert severity="error">{txsError}</Alert>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Balance After</TableCell>
                        <TableCell>Source</TableCell>
                        <TableCell>Meta</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(txs || []).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{t.created_at ? new Date(t.created_at).toLocaleString() : ""}</TableCell>
                          <TableCell>{t.type}</TableCell>
                          <TableCell>₹{t.amount}</TableCell>
                          <TableCell>₹{t.balance_after}</TableCell>
                          <TableCell>{t.source_type || ""} {t.source_id ? `(${t.source_id})` : ""}</TableCell>
                          <TableCell style={{ maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {t.meta ? JSON.stringify(t.meta) : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!txs || txs.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              No transactions yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fb" }}>
      {/* Top Bar */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, backgroundColor: "#0C2D48" }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: "none" } }}>
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="img" src={LOGO} alt="Trikonekt" sx={{ height: 36 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}></Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" sx={{ mr: 2 }}>{displayName}</Typography>
          <Button color="inherit" size="small" sx={{ fontWeight: 500, textTransform: "none" }} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Sidebar - mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box", borderRight: "1px solid #e5e7eb" },
        }}
      >
        <Toolbar />
        {drawer}
      </Drawer>

      {/* Sidebar - desktop */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box", borderRight: "1px solid #e5e7eb" },
        }}
        open
      >
        <Toolbar />
        {drawer}
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        <Container maxWidth="lg" sx={{ px: 0 }}>
          <ReferAndEarn title="Refer & Earn" />
          {activeTab === TABS.LUCKY && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <RewardsTargetCard role="employee" />
              </Grid>
              {/* Lucky draw submissions awaiting my (TRE) approval */}
              <Grid item xs={12}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                    Lucky Draw Submissions Awaiting My Approval
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Alert severity="info">
                      My reviews — Approved: {luckyStats.approved} | Rejected: {luckyStats.rejected}
                    </Alert>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Alert severity="success">
                      My commission earned: ₹{commissionTotal.toFixed(2)}
                    </Alert>
                  </Box>
                  {luckyLoading ? (
                    <Box sx={{ py: 3, display: "flex", alignItems: "center", gap: 1 }}>
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
                          <TableCell>Pincode</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(luckyPending || []).map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                            <TableCell>{r.sl_number}</TableCell>
                            <TableCell>{r.ledger_number}</TableCell>
                            <TableCell>{r.pincode}</TableCell>
                            <TableCell>{r.status}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={luckyActionBusy}
                                  onClick={() => treApproveLucky(r.id)}
                                  sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" } }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  disabled={luckyActionBusy}
                                  onClick={() => treRejectLucky(r.id)}
                                >
                                  Reject
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!luckyPending || luckyPending.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                No pending lucky draw submissions.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </Grid>

              {/* My Approved Submissions */}
              <Grid item xs={12}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                    My Approved Submissions
                  </Typography>
                  {approvedLoading ? (
                    <Box sx={{ py: 3, display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
                    </Box>
                  ) : approvedError ? (
                    <Alert severity="error">{approvedError}</Alert>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>SL</TableCell>
                          <TableCell>Ledger</TableCell>
                          <TableCell>Pincode</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Agency Reviewer</TableCell>
                          <TableCell>Comments</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(approvedList || []).map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                            <TableCell>{r.sl_number}</TableCell>
                            <TableCell>{r.ledger_number}</TableCell>
                            <TableCell>{r.pincode}</TableCell>
                            <TableCell>{r.status}</TableCell>
                            <TableCell>
                              {r.agency_reviewer ? r.agency_reviewer : ""} {r.agency_reviewed_at ? `(${new Date(r.agency_reviewed_at).toLocaleString()})` : ""}
                            </TableCell>
                            <TableCell>
                              {r.tre_comment ? `TRE: ${r.tre_comment} ` : ""}
                              {r.agency_comment ? `AGENCY: ${r.agency_comment}` : ""}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!approvedList || approvedList.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                No approved submissions yet.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
          {activeTab === TABS.ASSIGN && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
                      My Lucky Draw Coupon Assignments
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button size="small" onClick={loadMyAssignments}>Refresh</Button>
                    </Box>
                  </Box>
                  {assignError ? <Alert severity="error" sx={{ mb: 2 }}>{assignError}</Alert> : null}
                  {assignLoading ? (
                    <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
                    </Box>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Agency</TableCell>
                          <TableCell>Assigned</TableCell>
                          <TableCell>Sold</TableCell>
                          <TableCell>Remaining</TableCell>
                          <TableCell>Note</TableCell>
                          <TableCell align="right">Update</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(assignList || []).map((row) => {
                          const edit = soldEdits[row.id] || {};
                          const value = edit.value !== undefined ? edit.value : row.sold_count || 0;
                          return (
                            <TableRow key={row.id}>
                              <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString() : ""}</TableCell>
                              <TableCell>{row.created_by_username || ""}</TableCell>
                              <TableCell>{row.quantity}</TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={value}
                                  onChange={(e) => handleSoldChange(row.id, e.target.value)}
                                  error={Boolean(edit.error)}
                                  helperText={edit.error || ""}
                                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 0 }}
                                  sx={{ width: 120 }}
                                />
                              </TableCell>
                              <TableCell>{row.remaining}</TableCell>
                              <TableCell>{row.note || ""}</TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => saveSold(row)}
                                  disabled={Boolean(edit.saving)}
                                >
                                  {edit.saving ? "Saving..." : "Save"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {(!assignList || assignList.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7}>
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
              </Grid>
            </Grid>
          )}

          {activeTab === TABS.ECOUPONS && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                    My E‑Coupon Codes
                  </Typography>

                  {/* Pending E‑Coupon submissions awaiting my approval */}
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: "#fff" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                      Pending E‑Coupon Submissions Awaiting My Approval
                    </Typography>
                    {pendingLoading ? (
                      <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                        <CircularProgress size={18} /> <Typography variant="body2">Loading…</Typography>
                      </Box>
                    ) : pendingError ? (
                      <Alert severity="error">{pendingError}</Alert>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell>Consumer</TableCell>
                            <TableCell>Coupon Code</TableCell>
                            <TableCell>Pincode</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(pendingSubs || []).map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.created_at ? new Date(s.created_at).toLocaleString() : ""}</TableCell>
                              <TableCell>{s.consumer_username || s.consumer || ""}</TableCell>
                              <TableCell>{s.coupon_code || (s.code_ref && s.code_ref.code) || ""}</TableCell>
                              <TableCell>{s.pincode || ""}</TableCell>
                              <TableCell>{s.status}</TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={pendingBusy}
                                    onClick={() => empApprove(s.id)}
                                    sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" } }}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    disabled={pendingBusy}
                                    onClick={() => empReject(s.id)}
                                  >
                                    Reject
                                  </Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!pendingSubs || pendingSubs.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={6}>
                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                  No pending e‑coupon submissions.
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </Paper>

                  {/* Assign to Consumer */}
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: "#fbfdff" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                      Assign E‑Coupon to Consumer
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        select
                        size="small"
                        label="Select Code"
                        value={assign.codeId}
                        onChange={(e) => setAssign((a) => ({ ...a, codeId: e.target.value }))}
                        sx={{ minWidth: 220 }}
                        helperText={codesLoading ? "Loading..." : (codesError || "")}
                      >
                        {(codes || [])
                          .filter((c) => c.status === "ASSIGNED_EMPLOYEE" || c.status === "AVAILABLE")
                          .map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                              {c.code} {typeof c.value !== "undefined" ? `(₹${c.value})` : ""}
                            </MenuItem>
                          ))}
                        {(!codes || codes.length === 0) && (
                          <MenuItem disabled value="">
                            {codesLoading ? "Loading..." : "No codes assigned to you"}
                          </MenuItem>
                        )}
                      </TextField>
                      <TextField
                        size="small"
                        label="Consumer Username"
                        value={assign.consumerUsername}
                        onChange={(e) => setAssign((a) => ({ ...a, consumerUsername: e.target.value }))}
                        sx={{ minWidth: 200 }}
                      />
                      <TextField
                        size="small"
                        label="Pincode"
                        value={assign.pincode}
                        onChange={(e) => setAssign((a) => ({ ...a, pincode: e.target.value }))}
                        inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
                        sx={{ minWidth: 140 }}
                      />
                      <TextField
                        size="small"
                        label="Notes"
                        value={assign.notes}
                        onChange={(e) => setAssign((a) => ({ ...a, notes: e.target.value }))}
                        sx={{ minWidth: 200 }}
                      />
                      <Button
                        variant="contained"
                        onClick={doAssign}
                        disabled={assignBusy || !assign.codeId || !assign.consumerUsername || !assign.pincode}
                      >
                        {assignBusy ? "Assigning..." : "Assign"}
                      </Button>
                    </Stack>
                  </Paper>

                  {codesLoading ? (
                    <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
                    </Box>
                  ) : codesError ? (
                    <Alert severity="error">{codesError}</Alert>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Code</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Batch</TableCell>
                          <TableCell>Serial</TableCell>
                          <TableCell>Value</TableCell>
                          <TableCell>Assigned Agency</TableCell>
                          <TableCell>Created</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(codes || []).map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.code}</TableCell>
                            <TableCell>{c.status}</TableCell>
                            <TableCell>{c.batch || ""}</TableCell>
                            <TableCell>{c.serial || ""}</TableCell>
                            <TableCell>{typeof c.value !== "undefined" ? `₹${c.value}` : ""}</TableCell>
                            <TableCell>{c.assigned_agency_username || ""}</TableCell>
                            <TableCell>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</TableCell>
                          </TableRow>
                        ))}
                        {(!codes || codes.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                No codes assigned to you.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </Grid>

              {/* Commissions list */}
              <Grid item xs={12}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                    My Commissions
                  </Typography>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Commission earned (lifetime): ₹{commissionTotal.toFixed(2)}
                  </Alert>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Coupon Code</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(commissions || []).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.earned_at ? new Date(c.earned_at).toLocaleString() : ""}</TableCell>
                          <TableCell>₹{c.amount}</TableCell>
                          <TableCell>{c.status}</TableCell>
                          <TableCell>{c.role}</TableCell>
                          <TableCell>{c.coupon_code || ""}</TableCell>
                        </TableRow>
                      ))}
                      {(!commissions || commissions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              No commissions yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Paper>
              </Grid>
            </Grid>
          )}

          {activeTab === TABS.WALLET && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                    My Wallet
                  </Typography>
                  {walletLoading ? (
                    <Typography variant="body2">Loading...</Typography>
                  ) : walletError ? (
                    <Alert severity="error">{walletError}</Alert>
                  ) : (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Balance: ₹{wallet.balance} {wallet.updated_at ? `— updated ${new Date(wallet.updated_at).toLocaleString()}` : ""}
                    </Alert>
                  )}

                  <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                    Request Withdrawal
                  </Typography>
                  {wdrErr ? <Alert severity="error" sx={{ mb: 1 }}>{wdrErr}</Alert> : null}
                  {onCooldown ? (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      Only one withdrawal is allowed per week. Next available:{" "}
                      {cooldownUntil ? cooldownUntil.toLocaleString() : "-"}
                    </Alert>
                  ) : null}
                  <Box component="form" onSubmit={submitWithdrawal} sx={{ mb: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Amount (₹)"
                        name="amount"
                        value={wdrForm.amount}
                        onChange={(e) => setWdrForm((f) => ({ ...f, amount: e.target.value }))}
                        inputProps={{ inputMode: "decimal" }}
                        required
                      />
                      <TextField
                        fullWidth
                        size="small"
                        select
                        label="Method"
                        name="method"
                        value={wdrForm.method}
                        onChange={onWdrChange}
                      >
                        <MenuItem value="upi">UPI</MenuItem>
                        <MenuItem value="bank">Bank</MenuItem>
                      </TextField>
                    </Stack>
                    {wdrForm.method === "upi" ? (
                      <Box sx={{ mt: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="UPI ID"
                          name="upi_id"
                          value={wdrForm.upi_id}
                          onChange={onWdrChange}
                          required
                        />
                      </Box>
                    ) : (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Bank Name"
                          name="bank_name"
                          value={wdrForm.bank_name}
                          onChange={onWdrChange}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="Account Number"
                          name="bank_account_number"
                          value={wdrForm.bank_account_number}
                          onChange={onWdrChange}
                          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="IFSC Code"
                          name="ifsc_code"
                          value={wdrForm.ifsc_code}
                          onChange={onWdrChange}
                          inputProps={{ maxLength: 11, style: { textTransform: "uppercase" } }}
                        />
                      </Stack>
                    )}
                    <Button type="submit" variant="contained" disabled={onCooldown || wdrSubmitting} sx={{ mt: 1 }}>
                      {wdrSubmitting ? "Requesting..." : "Request Withdrawal"}
                    </Button>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                    Recent Transactions
                  </Typography>
                  {txsLoading ? (
                    <Typography variant="body2">Loading...</Typography>
                  ) : txsError ? (
                    <Alert severity="error">{txsError}</Alert>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Balance After</TableCell>
                          <TableCell>Source</TableCell>
                          <TableCell>Meta</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(txs || []).map((t) => (
                          <TableRow key={t.id}>
                            <TableCell>{t.created_at ? new Date(t.created_at).toLocaleString() : ""}</TableCell>
                            <TableCell>{t.type}</TableCell>
                            <TableCell>₹{t.amount}</TableCell>
                            <TableCell>₹{t.balance_after}</TableCell>
                            <TableCell>{t.source_type || ""} {t.source_id ? `(${t.source_id})` : ""}</TableCell>
                            <TableCell style={{ maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {t.meta ? JSON.stringify(t.meta) : ""}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!txs || txs.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                No transactions yet.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
        </Container>
      </Box>
    </Box>
  );
}
