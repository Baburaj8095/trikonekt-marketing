import React, { useEffect, useMemo, useState } from "react";
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
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert,
  Stack,
  TextField,
  MenuItem,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import LOGO from "../assets/TRIKONEKT.png";
import API, { assignConsumerByCount } from "../api/api";

const drawerWidth = 220;

export default function EmployeeLuckyCoupons() {
  const theme = useTheme();
  useMediaQuery(theme.breakpoints.up("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Employee";

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
    window.location.href = "/";
  };

  const TABS = {
    PENDING: "pending",
    CODES: "codes",
    COMMISSION: "commission",
  };
  const [activeTab, setActiveTab] = useState(TABS.PENDING);

  // Pending submissions
  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingBusy, setPendingBusy] = useState(false);

  const loadPending = async () => {
    try {
      setPendingLoading(true);
      setPendingError("");
      const res = await API.get("/uploads/lucky-draw/pending/tre/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setPending(arr || []);
    } catch (e) {
      setPendingError("Failed to load pending submissions.");
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const empApprove = async (id) => {
    try {
      setPendingBusy(true);
      await API.post(`/uploads/lucky-draw/${id}/tre-approve/`, { comment: "" });
      await loadPending();
    } catch (e) {
      // ignore
    } finally {
      setPendingBusy(false);
    }
  };

  const empReject = async (id) => {
    try {
      setPendingBusy(true);
      await API.post(`/uploads/lucky-draw/${id}/tre-reject/`, { comment: "" });
      await loadPending();
    } catch (e) {
      // ignore
    } finally {
      setPendingBusy(false);
    }
  };

  // Codes assigned to me
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
      setCodesError("Failed to load my codes.");
      setCodes([]);
    } finally {
      setCodesLoading(false);
    }
  };

  // Commissions
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
    loadCodes();
    loadCommissions();
  }, []);

  // Assign e-coupon to consumer (creates submission and triggers normal flow)
  const [assign, setAssign] = useState({ codeId: "", consumerUsername: "", notes: "" });
  const [assignBusy, setAssignBusy] = useState(false);

  const doAssign = async () => {
    try {
      if (!assign.codeId || !assign.consumerUsername) return;
      setAssignBusy(true);
      await API.post(`/coupons/codes/${assign.codeId}/assign-consumer/`, {
        consumer_username: assign.consumerUsername,
        notes: assign.notes || "",
      });
      alert("Assigned successfully.");
      setAssign({ codeId: "", consumerUsername: "", notes: "" });
      await loadCodes();
      await loadCommissions();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Failed to assign code.";
      alert(msg);
    } finally {
      setAssignBusy(false);
    }
  };

  // Bulk sell by count to consumer (employee)
  const [bulkSell, setBulkSell] = useState({ consumerUsername: "", count: "", notes: "" });
  const onBulkChange = (e) => setBulkSell((f) => ({ ...f, [e.target.name]: e.target.value }));
  const [bulkBusy, setBulkBusy] = useState(false);

  // Resolve consumer for bulk
  const [bulkResolveLoading, setBulkResolveLoading] = useState(false);
  const [bulkResolvedUser, setBulkResolvedUser] = useState(null);
  const [bulkResolveError, setBulkResolveError] = useState("");

  useEffect(() => {
    const u = String(bulkSell.consumerUsername || "").trim();
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
  }, [bulkSell.consumerUsername]);

  const availableMine = useMemo(
    () => (codes || []).filter((c) => String(c.status) === "ASSIGNED_EMPLOYEE" && !c.assigned_consumer).length,
    [codes]
  );

  const submitBulkSell = async () => {
    const consumer = String(bulkSell.consumerUsername || "").trim();
    const cnt = Number(bulkSell.count || 0);
    if (!consumer || !cnt || cnt <= 0) {
      alert("Enter consumer username and a positive count.");
      return;
    }
    try {
      setBulkBusy(true);
      const payload = { consumer_username: consumer, count: cnt };
      if (bulkSell.notes) payload.notes = String(bulkSell.notes);
      const res = await assignConsumerByCount(payload);
      const assigned = res?.assigned ?? 0;
      alert(`Assigned ${assigned} codes to ${res?.consumer?.username || consumer}.`);
      setBulkSell({ consumerUsername: "", count: "", notes: "" });
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

  const drawer = (
    <Box sx={{ overflow: "auto" }}>
      <List>
        <ListItemButton
          selected={activeTab === TABS.PENDING}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => setActiveTab(TABS.PENDING)}
        >
          <ListItemText primary="Pending Redemptions" />
        </ListItemButton>
        <ListItemButton
          selected={activeTab === TABS.CODES}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => setActiveTab(TABS.CODES)}
        >
          <ListItemText primary="My Coupon Codes" />
        </ListItemButton>
        <ListItemButton
          selected={activeTab === TABS.COMMISSION}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => setActiveTab(TABS.COMMISSION)}
        >
          <ListItemText primary="My Commissions" />
        </ListItemButton>
      </List>
      <Divider />
      <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>
        Logged in as: {displayName}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fb" }}>
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

      {/* Main */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        <Container maxWidth="lg" sx={{ px: 0 }}>
          {activeTab === TABS.PENDING && (
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                Pending Redemptions (My Review)
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
                      <TableCell>SL Number</TableCell>
                      <TableCell>Ledger Number</TableCell>
                      <TableCell>Pincode</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(pending || []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</TableCell>
                        <TableCell>{r.sl_number}</TableCell>
                        <TableCell>{r.ledger_number}</TableCell>
                        <TableCell>{r.pincode}</TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="contained" disabled={pendingBusy} onClick={() => empApprove(r.id)} sx={{ backgroundColor: "#2E7D32", "&:hover": { backgroundColor: "#1B5E20" } }}>
                              Approve
                            </Button>
                            <Button size="small" variant="outlined" color="error" disabled={pendingBusy} onClick={() => empReject(r.id)}>
                              Reject
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!pending || pending.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            No pending submissions.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </Paper>
          )}

          {activeTab === TABS.CODES && (
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                My Coupon Codes
              </Typography>

              {/* Assign to Consumer */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: "#fbfdff" }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                  Assign E-Coupon to Consumer
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    select
                    size="small"
                    label="Select Code"
                    value={assign.codeId}
                    onChange={(e) => setAssign((a) => ({ ...a, codeId: e.target.value }))}
                    sx={{ minWidth: 200 }}
                  >
                    {(codes || [])
                      .filter((c) => c.status === "ASSIGNED_EMPLOYEE" || c.status === "AVAILABLE")
                      .map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.code} {c.value ? `(₹${c.value})` : ""}
                        </MenuItem>
                      ))}
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
                    label="Notes"
                    value={assign.notes}
                    onChange={(e) => setAssign((a) => ({ ...a, notes: e.target.value }))}
                    sx={{ minWidth: 200 }}
                  />
                  <Button
                    variant="contained"
                    onClick={doAssign}
                    disabled={assignBusy || !assign.codeId || !assign.consumerUsername}
                  >
                    {assignBusy ? "Assigning..." : "Assign"}
                  </Button>
                </Stack>
              </Paper>

              {/* Sell E-Coupons by Count */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: "#fbfdff" }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                  Sell E-Coupons by Count
                </Typography>
                <Stack direction={{ xs: "column" }} spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Available in My Pool: {availableMine}
                  </Typography>
                  <TextField
                    size="small"
                    label="Consumer Username"
                    name="consumerUsername"
                    value={bulkSell.consumerUsername}
                    onChange={onBulkChange}
                    sx={{ minWidth: 200 }}
                  />
                  {bulkResolveLoading ? (
                    <Typography variant="caption" color="text.secondary">Resolving username…</Typography>
                  ) : bulkResolvedUser ? (
                    <Typography variant="caption" color="text.secondary">
                      This TR username belongs to {bulkResolvedUser.full_name || bulkResolvedUser.username} · PIN {bulkResolvedUser.pincode || "-"}
                      {bulkResolvedUser.city ? ` · ${bulkResolvedUser.city}` : ""}{bulkResolvedUser.state ? `, ${bulkResolvedUser.state}` : ""}
                    </Typography>
                  ) : bulkResolveError ? (
                    <Alert severity="warning">{bulkResolveError}</Alert>
                  ) : null}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      label="Count"
                      name="count"
                      value={bulkSell.count}
                      onChange={onBulkChange}
                      inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 1 }}
                      sx={{ minWidth: 140 }}
                    />
                    <TextField
                      size="small"
                      label="Notes (optional)"
                      name="notes"
                      value={bulkSell.notes}
                      onChange={onBulkChange}
                      sx={{ minWidth: 200 }}
                    />
                    <Button
                      variant="contained"
                      onClick={submitBulkSell}
                      disabled={bulkBusy || !bulkSell.consumerUsername || !bulkSell.count}
                    >
                      {bulkBusy ? "Assigning..." : "Assign by Count"}
                    </Button>
                  </Stack>
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
          )}

          {activeTab === TABS.COMMISSION && (
            <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
                My Commissions
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
      </Box>
    </Box>
  );
}
