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
  CircularProgress,
  Alert,
  TextField,
  Stack,
  MenuItem,
  Grid,
  Button,
} from "@mui/material";
import API from "../api/api";
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
      // Try multiple sources similar to AgencyDashboard (simplified here)
      let arr1 = [];
      try {
        const res1 = await API.get("/accounts/users/", { params: { role: "employee", pincode: "me" } });
        arr1 = Array.isArray(res1.data) ? res1.data : res1.data?.results || [];
      } catch (_) {}

      let arr3 = [];
      try {
        const res3 = await API.get("/accounts/users/", { params: { role: "employee", registered_by: "me" } });
        arr3 = Array.isArray(res3.data) ? res3.data : res3.data?.results || [];
      } catch (_) {}

      let arr2 = [];
      try {
        const res2 = await API.get("/accounts/my/employees/");
        arr2 = Array.isArray(res2.data) ? res2.data : res2.data?.results || [];
      } catch (_) {}

      let arr4 = [];
      try {
        const res4 = await API.get("/accounts/users/", { params: { role: "employee" } });
        arr4 = Array.isArray(res4.data) ? res4.data : res4.data?.results || [];
      } catch (_) {}

      const byId = new Map();
      [...arr1, ...arr2, ...arr3, ...arr4].forEach((u) => {
        if (u && typeof u.id !== "undefined" && !byId.has(u.id)) byId.set(u.id, u);
      });
      const merged = Array.from(byId.values());
      setEmployees(merged);
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
  
  const loadCodes = async () => {
    try {
      setCodesLoading(true);
      setCodesError("");
      const res = await API.get("/coupons/codes/", { params: { status: "ASSIGNED_AGENCY" } });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setCodes(arr || []);
    } catch (e) {
      setCodesError("Failed to load e-coupon codes.");
      setCodes([]);
    } finally {
      setCodesLoading(false);
    }
  };
  
  const [sellForm, setSellForm] = useState({ codeId: "", consumerUsername: "", pincode: "", notes: "" });
  const [sellBusy, setSellBusy] = useState(false);
  const onSellChange = (e) => setSellForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const submitSell = async (e) => {
    e.preventDefault();
    if (!sellForm.codeId || !sellForm.consumerUsername || !sellForm.pincode) {
      alert("Select code, consumer username and pincode.");
      return;
    }
    try {
      setSellBusy(true);
      await API.post(`/coupons/codes/${sellForm.codeId}/assign-consumer/`, {
        consumer_username: String(sellForm.consumerUsername).trim(),
        pincode: String(sellForm.pincode).trim(),
        notes: String(sellForm.notes || "").trim(),
      });
      alert("E-Coupon assigned to consumer.");
      setSellForm({ codeId: "", consumerUsername: "", pincode: "", notes: "" });
      await loadCodes();
      await loadCommissions();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Failed to assign.";
      alert(msg);
    } finally {
      setSellBusy(false);
    }
  };
  
  const [assignForm, setAssignForm] = useState({
    batch_id: "",
    employee_id: "",
    serial_start: "",
    serial_end: "",
  });
  const onAssignChange = (e) =>
    setAssignForm((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  const [assignBusy, setAssignBusy] = useState(false);

  const submitAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.batch_id || !assignForm.employee_id || !assignForm.serial_start || !assignForm.serial_end) {
      alert("Please select batch, employee and serial range.");
      return;
    }
    try {
      setAssignBusy(true);
      await API.post(`/coupons/batches/${assignForm.batch_id}/assign-employee/`, {
        employee_id: Number(assignForm.employee_id),
        serial_start: Number(assignForm.serial_start),
        serial_end: Number(assignForm.serial_end),
      });
      alert("Assigned successfully.");
      setAssignForm({ batch_id: "", employee_id: "", serial_start: "", serial_end: "" });
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
    loadBatches();
    loadEmployees();
    loadCodes();
    loadCommissions();
  }, []);

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
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Coupon Code</TableCell>
                  <TableCell>Pincode</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Consumer</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(pending || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                    <TableCell>{r.coupon_code}</TableCell>
                    <TableCell>{r.pincode}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>{r.consumer_username || ""}</TableCell>
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
          )}
        </Paper>
      )}

      {activeTab === TABS.ASSIGN && (
        <Grid container spacing={2}>
          {/* Sell E-Coupon to Consumer */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                Sell E-Coupon to Consumer
              </Typography>
              <Box component="form" onSubmit={submitSell}>
                <Stack spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="Select Code"
                    name="codeId"
                    value={sellForm.codeId}
                    onChange={onSellChange}
                    helperText={codesLoading ? "Loading..." : (codesError || "")}
                  >
                    {(codes || []).map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.code} {typeof c.value !== "undefined" ? `(₹${c.value})` : ""}
                      </MenuItem>
                    ))}
                    {(!codes || codes.length === 0) && (
                      <MenuItem disabled value="">
                        {codesLoading ? "Loading..." : "No e-coupons in your pool"}
                      </MenuItem>
                    )}
                  </TextField>
                  <TextField
                    fullWidth
                    label="Consumer Username"
                    name="consumerUsername"
                    value={sellForm.consumerUsername}
                    onChange={onSellChange}
                  />
                  <TextField
                    fullWidth
                    label="Pincode"
                    name="pincode"
                    value={sellForm.pincode}
                    onChange={onSellChange}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
                  />
                  <TextField
                    fullWidth
                    label="Notes"
                    name="notes"
                    value={sellForm.notes}
                    onChange={onSellChange}
                  />
                  <Button type="submit" variant="contained" disabled={sellBusy || !sellForm.codeId || !sellForm.consumerUsername || !sellForm.pincode}>
                    {sellBusy ? "Assigning..." : "Assign"}
                  </Button>
                </Stack>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                Assign Coupons to Employee (by Serial Range)
              </Typography>
              <Box component="form" onSubmit={submitAssign}>
                <Stack spacing={2}>
                  <TextField
                    select
                    fullWidth
                    label="Batch"
                    name="batch_id"
                    value={assignForm.batch_id}
                    onChange={onAssignChange}
                    helperText={batchesError || ""}
                  >
                    {(batches || []).map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.prefix}{String(b.serial_start).padStart(b.serial_width, "0")} - {b.prefix}{String(b.serial_end).padStart(b.serial_width, "0")} — {b.coupon_title || ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    fullWidth
                    label="Employee"
                    name="employee_id"
                    value={assignForm.employee_id}
                    onChange={onAssignChange}
                    helperText={empError || ""}
                  >
                    {(employees || []).map((emp) => (
                      <MenuItem key={emp.id} value={emp.id}>
                        {emp.username} — {emp.full_name || ""} — {emp.phone || ""} — {emp.email || ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    label="Serial Start"
                    name="serial_start"
                    value={assignForm.serial_start}
                    onChange={onAssignChange}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 1 }}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Serial End"
                    name="serial_end"
                    value={assignForm.serial_end}
                    onChange={onAssignChange}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 1 }}
                    required
                  />
                  <Button type="submit" variant="contained" disabled={assignBusy}>
                    {assignBusy ? "Assigning..." : "Assign"}
                  </Button>
                </Stack>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
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
          </Grid>
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
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Coupon Code</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(commissions || []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.earned_at ? new Date(c.earned_at).toLocaleString() : ""}</TableCell>
                    <TableCell>{c.role}</TableCell>
                    <TableCell>₹{c.amount}</TableCell>
                    <TableCell>{c.status}</TableCell>
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
          )}
        </Paper>
      )}
    </Container>
  );
}
