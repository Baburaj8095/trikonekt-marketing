import React, { useEffect, useState } from "react";
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
  TableContainer,
  CircularProgress,
  Alert,
  TextField,
  Stack,
  MenuItem,
  Grid,
  Button,
  Pagination,
} from "@mui/material";
import API, { assignConsumerByCount, assignEmployeeByCount } from "../api/api";
import { useLocation } from "react-router-dom";

export default function AgencyLuckyCoupons() {
  const location = useLocation();

  // Tabs
  const TABS = {
    PENDING: "pending",
    ASSIGN: "assign",
    COMMISSION: "commission",
  };
  const [activeTab, setActiveTab] = useState(TABS.PENDING);

  // Sync active tab with URL query param ?tab=...
  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const t = (qp.get("tab") || "").toLowerCase();
    if (t === "assign") setActiveTab(TABS.ASSIGN);
    else if (t === "commission") setActiveTab(TABS.COMMISSION);
    else setActiveTab(TABS.PENDING);
  }, [location.search]);

  // Pending redemptions (awaiting agency approval)
  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingBusy, setPendingBusy] = useState(false);

  const loadPending = async () => {
    try {
      setPendingLoading(true);
      setPendingError("");
      const res = await API.get("/coupons/submissions/pending-agency/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setPending(arr || []);
    } catch (e) {
      setPendingError("Failed to load pending redemptions.");
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const agencyApprove = async (id) => {
    try {
      setPendingBusy(true);
      await API.post(`/coupons/submissions/${id}/agency-approve/`, { comment: "" });
      await loadPending();
    } catch (e) {
      // ignore
    } finally {
      setPendingBusy(false);
    }
  };

  const agencyReject = async (id) => {
    try {
      setPendingBusy(true);
      await API.post(`/coupons/submissions/${id}/agency-reject/`, { comment: "" });
      await loadPending();
    } catch (e) {
      // ignore
    } finally {
      setPendingBusy(false);
    }
  };

  // Assign to employees (within batch, by serial range)
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState("");

  const loadBatches = async () => {
    try {
      setBatchesLoading(true);
      setBatchesError("");
      const res = await API.get("/coupons/batches/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setBatches(arr || []);
    } catch (e) {
      setBatchesError("Failed to load batches.");
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  };

  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState("");

  const loadEmployees = async () => {
    try {
      setEmpLoading(true);
      setEmpError("");

      // Single scoped call: backend enforces "assignable" employees for Agency
      const res = await API.get("/accounts/users/", { params: { role: "employee", assignable: 1 } });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setEmployees(arr);
    } catch (e) {
      setEmpError("Failed to load employees.");
      setEmployees([]);
    } finally {
      setEmpLoading(false);
    }
  };
  
  // E-Coupon codes (assigned to this agency) and Sell-to-Consumer flow
  const [codes, setCodes] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  
  const loadCodes = async () => {
    try {
      setCodesLoading(true);
      setCodesError("");
      // Load my agency codes (paginated)
      const res = await API.get("/coupons/codes/", {
        params: {
          page,
          page_size: pageSize,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          issued_channel: "e_coupon",
        },
      });
      const data = res.data;
      const arr = Array.isArray(data) ? data : data?.results || [];
      setCodes(arr || []);
      setTotalCount(Array.isArray(data) ? (arr || []).length : (data?.count || (arr || []).length));
    } catch (e) {
      const msg = String(e?.message || "");
      const code = e?.code || "";
      // Ignore cancellation/abort errors from request de-duplication to prevent false "failed load" UI
      if (code === "ERR_CANCELED" || msg.toLowerCase().includes("canceled") || msg.toLowerCase().includes("cancelled") || msg.toLowerCase().includes("abort")) {
        return;
      }
      setCodesError("Failed to load e-coupon codes.");
      setCodes([]);
    } finally {
      setCodesLoading(false);
    }
  };

  // Agency summary (counts by status)
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const loadSummary = async () => {
    try {
      setSummaryLoading(true);
      setSummaryError("");
      const res = await API.get("/coupons/codes/agency-summary/");
      setSummary(res.data || null);
    } catch (e) {
      setSummary(null);
      setSummaryError("Failed to load summary.");
    } finally {
      setSummaryLoading(false);
    }
  };
  
  const [sellForm, setSellForm] = useState({ codeId: "", consumerUsername: "" });
  const [sellBusy, setSellBusy] = useState(false);
  const onSellChange = (e) => setSellForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolvedUser, setResolvedUser] = useState(null);
  const [resolveError, setResolveError] = useState("");
  useEffect(() => {
    const u = String(sellForm.consumerUsername || "").trim();
    if (!u) {
      setResolvedUser(null);
      setResolveError("");
      return;
    }
    let cancelled = false;
    setResolveLoading(true);
    API.get("/coupons/codes/resolve-user/", { params: { username: u } })
      .then((res) => {
        if (cancelled) return;
        setResolvedUser(res.data || null);
        setResolveError("");
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedUser(null);
        setResolveError("User not found or invalid.");
      })
      .finally(() => {
        if (!cancelled) setResolveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sellForm.consumerUsername]);
  const submitSell = async (e) => {
    e.preventDefault();
    if (!sellForm.codeId || !sellForm.consumerUsername) {
      alert("Select code and consumer username.");
      return;
    }
    try {
      setSellBusy(true);
      await API.post(`/coupons/codes/${sellForm.codeId}/assign-consumer/`, {
        consumer_username: String(sellForm.consumerUsername).trim(),
      });
      alert("E-Coupon assigned to consumer.");
      setSellForm({ codeId: "", consumerUsername: "" });
      await loadCodes();
      await loadCommissions();
      await loadSummary();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Failed to assign.";
      alert(msg);
    } finally {
      setSellBusy(false);
    }
  };

  // Bulk sell by count to consumer (with optional employee attribution and batch)
  const [bulkSell, setBulkSell] = useState({ targetType: "", username: "", count: "" });
  const onBulkChange = (e) => setBulkSell((f) => ({ ...f, [e.target.name]: e.target.value }));
  const [bulkBusy, setBulkBusy] = useState(false);

  const [bulkResolveLoading, setBulkResolveLoading] = useState(false);
  const [bulkResolvedUser, setBulkResolvedUser] = useState(null);
  const [bulkResolveError, setBulkResolveError] = useState("");

  useEffect(() => {
    const u = String(bulkSell.username || "").trim();
    if (!u) {
      setBulkResolvedUser(null);
      setBulkResolveError("");
      return;
    }
    let cancelled = false;
    setBulkResolveLoading(true);
    API.get("/coupons/codes/resolve-user/", { params: { username: u } })
      .then((res) => {
        if (cancelled) return;
        setBulkResolvedUser(res.data || null);
        setBulkResolveError("");
      })
      .catch(() => {
        if (cancelled) return;
        setBulkResolvedUser(null);
        setBulkResolveError("User not found or invalid.");
      })
      .finally(() => {
        if (!cancelled) setBulkResolveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bulkSell.username]);

  const submitBulkSell = async (e) => {
    e.preventDefault();
    const role = String(bulkSell.targetType || "").toLowerCase();
    const uname = String(bulkSell.username || "").trim();
    const cnt = Number(bulkSell.count || 0);
    if (!role || !uname || !cnt || cnt <= 0) {
      alert("Select target type, enter TR username and a positive count.");
      return;
    }
    try {
      setBulkBusy(true);
      let res;
      if (role === "consumer") {
        res = await assignConsumerByCount({ consumer_username: uname, count: cnt });
      } else if (role === "employee") {
        res = await assignEmployeeByCount({ employee_username: uname, count: cnt });
      } else {
        alert("Invalid target type.");
        return;
      }
      const assigned = res?.assigned ?? 0;
      const after = res?.available_after;
      alert(`Assigned ${assigned} codes to ${uname} (${role}).`);
      setBulkSell({ targetType: "", username: "", count: "" });
      // Update summary counts inline if available
      if (typeof after === "number") {
        setSummary((s) => (s ? { ...s, available: after } : s));
      } else {
        await loadSummary();
      }
      await loadCodes();
      await loadCommissions();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Failed to assign by count.";
      alert(msg);
    } finally {
      setBulkBusy(false);
    }
  };
  
  const [assignForm, setAssignForm] = useState({
    batch_id: "",
    employee_id: "",
    count: "",
  });
  const onAssignChange = (e) =>
    setAssignForm((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  const [assignBusy, setAssignBusy] = useState(false);

  const submitAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.batch_id || !assignForm.employee_id || !assignForm.count) {
      alert("Please select batch, employee and count.");
      return;
    }
    try {
      setAssignBusy(true);
      await API.post(`/coupons/batches/${assignForm.batch_id}/agency-assign-employee-count/`, {
        employee_id: Number(assignForm.employee_id),
        count: Number(assignForm.count),
      });
      alert("Assigned successfully.");
      setAssignForm({ batch_id: "", employee_id: "", count: "" });
      await loadSummary();
    } catch (e) {
      alert("Failed to assign. Check serial range and permissions.");
    } finally {
      setAssignBusy(false);
    }
  };

  // Commission summary
  const [commissions, setCommissions] = useState([]);
  const [comLoading, setComLoading] = useState(false);
  const [comError, setComError] = useState("");

  const loadCommissions = async () => {
    try {
      setComLoading(true);
      setComError("");
      const res = await API.get("/coupons/commissions/mine/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setCommissions(arr || []);
    } catch (e) {
      setComError("Failed to load commissions.");
      setCommissions([]);
    } finally {
      setComLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
    //loadBatches();
    //loadEmployees();
    loadCommissions();
    loadSummary();
  }, []);

  // Reload codes when pagination or status changes
  useEffect(() => {
    loadCodes();
  }, [page, pageSize, statusFilter]);

  return (
    <Container maxWidth="lg" sx={{ px: 0 }}>
      {/* Section Header aligned to Shell navigation */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
       
        <Typography variant="caption" color="text.secondary">
          {activeTab === TABS.PENDING ? "Pending Redemptions" : activeTab === TABS.ASSIGN ? "Assign Coupons" : "Commission Summary"}
        </Typography>
      </Box>

      {activeTab === TABS.PENDING && (
        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
            Pending Redemptions (Agency)
          </Typography>
          {pendingLoading ? (
            <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
            </Box>
          ) : pendingError ? (
            <Alert severity="error">{pendingError}</Alert>
          ) : (
            <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Coupon Code</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Pincode</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Consumer</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                {(pending || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                    <TableCell>{r.coupon_code}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{r.pincode}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{r.consumer_username || ""}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="contained" disabled={pendingBusy} onClick={() => agencyApprove(r.id)} sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" } }}>
                          Approve
                        </Button>
                        <Button size="small" variant="outlined" color="error" disabled={pendingBusy} onClick={() => agencyReject(r.id)}>
                          Reject
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {(!pending || pending.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        No pending submissions in your coverage.
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
        <Grid container spacing={2} alignItems="stretch" columns={{ xs: 12, sm: 12, md: 12 }}>
          {/* Agency Summary */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                My E-Coupon Summary
              </Typography>
              {summaryLoading ? (
                <Box sx={{ py: 1 }}><Typography variant="body2">Loading...</Typography></Box>
              ) : summaryError ? (
                <Alert severity="error">{summaryError}</Alert>
              ) : summary ? (
                <Grid container spacing={2}>
                  <Grid item xs={6} md={2} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
                    <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)", color: "#fff", border: "1px solid rgba(124,58,237,0.35)", boxShadow: "0 8px 18px rgba(124,58,237,0.35)" }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>Available</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{summary.available ?? 0}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
                    <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)", color: "#0f172a", border: "1px solid rgba(20,184,166,0.35)", boxShadow: "0 8px 18px rgba(20,184,166,0.35)" }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>Assigned to Employee</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{summary.assigned_employee ?? 0}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
                    <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)", color: "#0f172a", border: "1px solid rgba(245,158,11,0.35)", boxShadow: "0 8px 18px rgba(245,158,11,0.35)" }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>Sold</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{summary.sold ?? 0}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
                    <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "1px solid rgba(16,185,129,0.35)", boxShadow: "0 8px 18px rgba(16,185,129,0.35)" }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>Redeemed</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{summary.redeemed ?? 0}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
                    <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(59,130,246,0.35)", boxShadow: "0 8px 18px rgba(59,130,246,0.35)" }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>Revoked</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{summary.revoked ?? 0}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={2} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
                    <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(14,165,233,0.35)", boxShadow: "0 8px 18px rgba(14,165,233,0.35)" }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>Total</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900 }}>{summary.total ?? 0}</Typography>
                    </Box>
                  </Grid>
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary">No data.</Typography>
              )}
            </Paper>
          </Grid>
          {/* All My E‑Coupon Codes (full list with status) */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1, flexWrap: "wrap" }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
                  All My E‑Coupon Codes
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                >
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Status"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
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
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Rows"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    sx={{ minWidth: { sm: 120 } }}
                  >
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={25}>25</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                  </TextField>
                  <Button
                    size="small"
                    onClick={loadCodes}
                    sx={{ width: { xs: "100%", sm: "auto" }, alignSelf: { xs: "stretch", sm: "auto" } }}
                  >
                    Refresh
                  </Button>
                </Stack>
              </Box>

              {codesLoading ? (
                <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
                </Box>
              ) : codesError ? (
                <Alert severity="error">{codesError}</Alert>
              ) : (
                <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Code</TableCell>
                        <TableCell>Status</TableCell>
                        
                        <TableCell>Value</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Assigned Employee</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Assigned Consumer</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Assigned Agency</TableCell>
                        <TableCell>Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                    {(codes || [])
                      .filter((c) => statusFilter === "ALL" ? true : String(c.status).toUpperCase() === statusFilter)
                      .map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.code}</TableCell>
                          <TableCell>{c.status}</TableCell>
                          <TableCell>{typeof c.value !== "undefined" ? `₹${c.value}` : ""}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{c.assigned_employee_username || ""}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{c.assigned_consumer_username || ""}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{c.assigned_agency_username || ""}</TableCell>
                          <TableCell>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</TableCell>
                        </TableRow>
                      ))}
                    {(!codes || codes.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            No e‑coupon codes found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  </Table>
                </TableContainer>
              )}
              {!codesLoading && !codesError ? (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {totalCount} items
                  </Typography>
                  <Pagination
                    count={Math.max(1, Math.ceil(totalCount / pageSize))}
                    page={page}
                    onChange={(e, p) => setPage(p)}
                    size="small"
                  />
                </Box>
              ) : null}
            </Paper>
          </Grid>

          {/* Sell E-Coupon to Consumer */}
          
          <Grid item xs={12} sm={12} md={6} sx={{ display: "flex", width: "100%" }}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, height: "100%", width: "100%" }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                Sell E-Coupons by Count
              </Typography>
              <Box component="form" onSubmit={submitBulkSell}>
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Available in Agency Pool: {summary?.available ?? 0}
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    label="Target Type"
                    name="targetType"
                    value={bulkSell.targetType}
                    onChange={onBulkChange}
                    required
                  >
                    <MenuItem value="consumer">Consumer</MenuItem>
                    <MenuItem value="employee">Employee</MenuItem>
                  </TextField>
                  <TextField
                    fullWidth
                    label="TR Username"
                    name="username"
                    value={bulkSell.username}
                    onChange={onBulkChange}
                    required
                  />
                  {bulkResolveLoading ? (
                    <Typography variant="caption" color="text.secondary">Resolving username…</Typography>
                  ) : bulkResolvedUser ? (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {bulkResolvedUser.full_name || bulkResolvedUser.username} · PIN {bulkResolvedUser.pincode || "-"}
                        {bulkResolvedUser.city ? ` · ${bulkResolvedUser.city}` : ""}{bulkResolvedUser.state ? `, ${bulkResolvedUser.state}` : ""}
                      </Typography>
                      {bulkSell.targetType && (
                        ((bulkSell.targetType === "employee" && !((bulkResolvedUser?.role === "employee") || (bulkResolvedUser?.category === "employee"))) ||
                         (bulkSell.targetType === "consumer" && !((bulkResolvedUser?.role === "user") && (bulkResolvedUser?.category === "consumer"))))
                          ? <Alert severity="warning">Selected type is {bulkSell.targetType}, but this username belongs to role {bulkResolvedUser?.role || bulkResolvedUser?.category}.</Alert>
                          : null
                      )}
                    </Stack>
                  ) : bulkResolveError ? (
                    <Alert severity="warning">{bulkResolveError}</Alert>
                  ) : null}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      fullWidth
                      label="Count"
                      name="count"
                      value={bulkSell.count}
                      onChange={onBulkChange}
                      inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 1 }}
                      required
                    />
                    
                  </Stack>
                  <Button type="submit" variant="contained" disabled={bulkBusy || !bulkSell.targetType || !bulkSell.username || !bulkSell.count}>
                    {bulkBusy ? "Assigning..." : "Assign by Count"}
                  </Button>
                </Stack>
              </Box>
            </Paper>
          </Grid>

          
          {/* <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                Batches
              </Typography>
              {batchesLoading ? (
                <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
                </Box>
              ) : batchesError ? (
                <Alert severity="error">{batchesError}</Alert>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Batch</TableCell>
                      <TableCell>Coupon</TableCell>
                      <TableCell>Count</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(batches || []).map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          {b.prefix}{String(b.serial_start).padStart(b.serial_width, "0")} - {b.prefix}{String(b.serial_end).padStart(b.serial_width, "0")}
                        </TableCell>
                        <TableCell>{b.coupon_title || ""}</TableCell>
                        <TableCell>{b.count}</TableCell>
                        <TableCell>{b.created_at ? new Date(b.created_at).toLocaleString() : ""}</TableCell>
                      </TableRow>
                    ))}
                    {(!batches || batches.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            No batches visible.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </Grid> */}
        </Grid>
      )}

      {activeTab === TABS.COMMISSION && (
        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
            Commission Summary
          </Typography>
          {comLoading ? (
            <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
            </Box>
          ) : comError ? (
            <Alert severity="error">{comError}</Alert>
          ) : (
            <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Role</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Coupon Code</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                {(commissions || []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.earned_at ? new Date(c.earned_at).toLocaleString() : ""}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{c.role}</TableCell>
                    <TableCell>₹{c.amount}</TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{c.coupon_code || ""}</TableCell>
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
            </TableContainer>
          )}
        </Paper>
      )}
    </Container>
  );
}
