import React, { useEffect, useMemo, useState } from "react";
import {
  Typography,
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Stack,
  Alert,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import API from "../api/api";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ClubHeader from "../components/ecoupon/ClubHeader";
import ECouponStore from "./ECouponStore";

const CHANNELS = [
  { value: "e_coupon", label: "E-Coupon" },
];

const ACTIONS = [
  { value: "ACTIVATE", label: "Activate Account" },
  { value: "REDEEM", label: "Redeem" },
];

const COUPON_TYPES = [
  { value: "150", label: "₹150 Coupon" },
  { value: "50", label: "₹50 Coupon" },
];

export default function ConsumerCoupon() {
  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_user") || sessionStorage.getItem("user_user") || localStorage.getItem("user") || sessionStorage.getItem("user");
      const parsed = ls ? JSON.parse(ls) : {};
      return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";
  const defaultPincode = (storedUser?.pincode || "").toString();

  const [form, setForm] = useState({
    channel: "e_coupon",
    coupon_type: "150",
    action: "ACTIVATE",
    coupon_code: "",
    referral_id: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [walletInfo, setWalletInfo] = useState({ balance: "0" });
  const [walletMsg, setWalletMsg] = useState("");

  const [mySubs, setMySubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [errorSubs, setErrorSubs] = useState("");
  // Summary of my submissions
  const [mySummary, setMySummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [errorSummary, setErrorSummary] = useState("");

  // My owned E‑Coupons (direct assignments)
  const [myCodes, setMyCodes] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState("");
  // Inline transfer per owned code id
  const [transferCodeForms, setTransferCodeForms] = useState({});
  const [transferCodeBusy, setTransferCodeBusy] = useState({});
  const [activateCodeBusy, setActivateCodeBusy] = useState({});

  // Manual lucky coupon submission
  const [manual, setManual] = useState({
    coupon_code: "",
    tr_username: "",
    consumer_tr_username: String(storedUser?.username || ""),
    notes: "",
    file: null,
    resolving: false,
    resolved: null,
    error: "",
    submitting: false,
  });

  const [activeTab, setActiveTab] = useState("summary");

  // Transfer dialog (consumer -> consumer)
  const [transferDialog, setTransferDialog] = useState({
    open: false,
    code: null,
    username: "",
    userInfo: null,
    resolving: false,
    submitting: false,
    error: "",
  });

  const openTransferDialog = (code) => {
    setTransferDialog({
      open: true,
      code,
      username: "",
      userInfo: null,
      resolving: false,
      submitting: false,
      error: "",
    });
  };

  const closeTransferDialog = () => setTransferDialog((d) => ({ ...d, open: false }));

  const resolveUsername = async () => {
    const u = String(transferDialog.username || "").trim();
    if (!u) return;
    try {
      setTransferDialog((d) => ({ ...d, resolving: true, error: "" }));
      const res = await API.get("/coupons/codes/resolve-user", { params: { username: u } });
      setTransferDialog((d) => ({ ...d, resolving: false, userInfo: res.data || null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "User not found.";
      setTransferDialog((d) => ({ ...d, resolving: false, userInfo: null, error: msg }));
    }
  };

  const submitTransfer = async () => {
    const codeId = transferDialog?.code?.id;
    const u = String(transferDialog.username || "").trim();
    if (!codeId || !u) {
      try { alert("Enter TR Username."); } catch {}
      return;
    }
    try {
      setTransferDialog((d) => ({ ...d, submitting: true, error: "" }));
      await API.post(`/coupons/codes/${codeId}/transfer/`, { to_username: u });
      try { alert("Transfer successful."); } catch {}
      setTransferDialog((d) => ({ ...d, submitting: false, open: false }));
      // Immediately reflect transferred state locally
      setMyCodes((prev) => prev.map((x) => x.id === codeId ? { ...x, display_status: "TRANSFERRED", can_transfer: false, can_activate: false } : x));
      await loadMyCodes();
      await loadMySummary();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Transfer failed.";
      setTransferDialog((d) => ({ ...d, submitting: false, error: msg }));
    }
  };

  // Inline transfer forms per submission id
  const [transferForms, setTransferForms] = useState({});
  const [transferBusy, setTransferBusy] = useState({});

  const useSubmissionCode = (s) => {
    if (!s?.coupon_code) return;
    setForm((f) => ({ ...f, channel: "e_coupon", coupon_code: s.coupon_code }));
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  };

  const onTransferChange = (id, field, value) => {
    setTransferForms((m) => ({ ...m, [id]: { ...(m[id] || {}), [field]: value } }));
  };

  const doTransfer = async (s) => {
    const id = s?.id;
    if (!id || !s?.code_ref) return;
    const data = transferForms[id] || {};
    const to = String(data.to_username || "").trim();
    if (!to) {
      alert("Enter target TR username.");
      return;
    }
    try {
      setTransferBusy((m) => ({ ...m, [id]: true }));
      await API.post(`/coupons/codes/${s.code_ref}/transfer/`, {
        to_username: to,
        pincode: String(data.pincode || "").trim(),
        notes: String(data.notes || "").trim(),
      });
      alert("Transfer submitted.");
      setTransferForms((m) => ({ ...m, [id]: { to_username: "", pincode: "", notes: "" } }));
      await loadMySubmissions();
      await loadMySummary();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Transfer failed.";
      alert(msg);
    } finally {
      setTransferBusy((m) => ({ ...m, [id]: false }));
    }
  };

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const statusLabel = (s) => {
    const x = String(s || "").toUpperCase();
    switch (x) {
      case "SUBMITTED":
        return "Pending Employee Approval";
      case "EMPLOYEE_APPROVED":
        return "Pending Agency Approval";
      case "AGENCY_APPROVED":
        return "Completed";
      case "REJECTED":
        return "Rejected";
      default:
        return x || "Unknown";
    }
  };

  const loadMySubmissions = async () => {
    try {
      setLoadingSubs(true);
      setErrorSubs("");
      const res = await API.get("/coupons/submissions/my/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setMySubs(arr || []);
    } catch (e) {
      setErrorSubs("Failed to load your submissions.");
      setMySubs([]);
    } finally {
      setLoadingSubs(false);
    }
  };

  const loadMySummary = async () => {
    try {
      setLoadingSummary(true);
      setErrorSummary("");
      const res = await API.get("/coupons/codes/consumer-summary/");
      setMySummary(res.data || null);
    } catch (e) {
      setMySummary(null);
      setErrorSummary("Failed to load summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadMyCodes = async () => {
    try {
      setCodesLoading(true);
      setCodesError("");
      const res = await API.get("/coupons/codes/mine-consumer/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setMyCodes(arr || []);
    } catch (e) {
      setMyCodes([]);
      setCodesError("Failed to load my e‑coupons.");
    } finally {
      setCodesLoading(false);
    }
  };

  const onCodeTransferChange = (codeId, field, value) => {
    setTransferCodeForms((m) => ({ ...m, [codeId]: { ...(m[codeId] || {}), [field]: value } }));
  };

  const doTransferCode = async (code) => {
    const codeId = code?.id;
    if (!codeId) return;
    const data = transferCodeForms[codeId] || {};
    const to = String(data.to_username || "").trim();
    if (!to) {
      alert("Enter target TR username.");
      return;
    }
    try {
      setTransferCodeBusy((m) => ({ ...m, [codeId]: true }));
      await API.post(`/coupons/codes/${codeId}/transfer/`, {
        to_username: to,
        pincode: String(data.pincode || "").trim(),
        notes: String(data.notes || "").trim(),
      });
      alert("Transfer successful.");
      // Immediately reflect transferred state locally
      setMyCodes((prev) => prev.map((x) => x.id === codeId ? { ...x, display_status: "TRANSFERRED", can_transfer: false, can_activate: false } : x));
      setTransferCodeForms((m) => ({ ...m, [codeId]: { to_username: "", pincode: "", notes: "" } }));
      await loadMyCodes();
      await loadMySummary();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Transfer failed.";
      alert(msg);
    } finally {
      setTransferCodeBusy((m) => ({ ...m, [codeId]: false }));
    }
  };

  // Quick Activate button per owned e‑coupon
  const handleActivateCode = async (code) => {
    if (!code?.id) return;
    const codeId = code.id;
    const denom = Number(code?.value) || 150;
    let t = "150";
    if (denom <= 50) t = "50";
    else if (Math.abs(denom - 759) < 0.01 || Math.abs(denom - 750) < 0.01) t = "759";
    try {
      setActivateCodeBusy((m) => ({ ...m, [codeId]: true }));
      const src = {
        channel: "e_coupon",
        code: String(code.code).trim(),
      };
      const ref = String(form.referral_id || "").trim();
      if (ref) src.referral_id = ref;
      await API.post("/v1/coupon/activate/", {
        type: t,
        source: src,
      });
      try { alert(`Activated (${t}).`); } catch {}
      // Immediately disable actions locally for this code
      setMyCodes((prev) => prev.map((x) => x.id === codeId ? { ...x, display_status: "ACTIVATED", can_activate: false, can_transfer: false } : x));
      await loadMySummary();
      await loadMyCodes();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Activation failed.";
      alert(msg);
    } finally {
      setActivateCodeBusy((m) => ({ ...m, [codeId]: false }));
    }
  };

  const loadWallet = async () => {
    try {
      const res = await API.get("/accounts/wallet/me/");
      setWalletInfo({ balance: res?.data?.balance ?? "0" });
    } catch {
      // ignore
    }
  };

  const onManualChange = (field, value) => {
    setManual((m) => ({ ...m, [field]: value }));
  };

  const resolveTR = async () => {
    const u = String(manual.tr_username || "").trim();
    if (!u) return;
    try {
      setManual((m) => ({ ...m, resolving: true, error: "", resolved: null }));
      const res = await API.get("/coupons/codes/resolve-user", { params: { username: u } });
      setManual((m) => ({ ...m, resolving: false, resolved: res.data || null }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "User not found.";
      setManual((m) => ({ ...m, resolving: false, resolved: null, error: msg }));
    }
  };

  const submitManual = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const code = String(manual.coupon_code || "").trim();
    const tr = String(manual.tr_username || "").trim();
    if (!code) { try { alert("Coupon Code is required."); } catch {} return; }
    if (!tr) { try { alert("TR Username is required."); } catch {} return; }
    try {
      setManual((m) => ({ ...m, submitting: true, error: "" }));
      const fd = new FormData();
      fd.append("coupon_code", code);
      fd.append("tr_username", tr);
      const ctr = String(manual.consumer_tr_username || "").trim();
      if (ctr) fd.append("consumer_tr_username", ctr);
      const notes = String(manual.notes || "");
      if (notes) fd.append("notes", notes);
      if (manual.file) fd.append("file", manual.file);
      await API.post("/coupons/submissions/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      try { alert("Manual submission created."); } catch {}
      setManual({
        coupon_code: "",
        tr_username: "",
        consumer_tr_username: String(storedUser?.username || ""),
        notes: "",
        file: null,
        resolving: false,
        resolved: null,
        error: "",
        submitting: false,
      });
      await loadMySubmissions();
    } catch (e) {
      const err = e?.response?.data;
      const msg = (typeof err === "string" ? err : (err?.detail || JSON.stringify(err || {}))) || "Submission failed.";
      setManual((m) => ({ ...m, submitting: false, error: msg }));
      try { alert(msg); } catch {}
    } finally {
      setManual((m) => ({ ...m, submitting: false }));
    }
  };

  useEffect(() => {
    loadWallet();
    loadMySummary();
    loadMyCodes();
  }, []);

  const validate = () => {
    if (!form.coupon_code) {
      alert("Coupon Code is required.");
      return false;
    }
    if (!form.referral_id) {
      alert("TR Referral ID is required.");
      return false;
    }
    if (form.action === "REDEEM" && form.coupon_type === "50") {
      alert("₹50 coupon cannot be redeemed. Choose Activate.");
      return false;
    }
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setWalletMsg("");

      // Physical/Lucky Draw coupons are not available on the consumer e‑coupon screen
      if (form.action === "ACTIVATE") {
        const t = form.coupon_type === "50" ? "50" : "150";
        await API.post("/v1/coupon/activate/", {
          type: t,
          source: {
            channel: "e_coupon",
            code: String(form.coupon_code).trim(),
            referral_id: String(form.referral_id).trim(),
          },
        });
        alert(t === "150" ? "Activated: 5-matrix + 3-matrix opened." : "Activated: 3-matrix opened.");
      } else {
        await API.post("/v1/coupon/redeem/", {
          type: "150",
          source: {
            channel: "e_coupon",
            code: String(form.coupon_code).trim(),
            referral_id: String(form.referral_id).trim(),
          },
        });
        await loadWallet();
        setWalletMsg("₹140 has been credited to your wallet.");
        alert("Redeem successful. Wallet credited.");
      }

      setForm((f) => ({ ...f, coupon_code: "", notes: "" }));
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Request failed");
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ px: { xs: 0, md: 2 }, py: { xs: 1, md: 2 } }}>
      <ClubHeader />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
          My E‑Coupons
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {displayName}
        </Typography>
      </Box>

      <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", mb: 2, border: "1px solid #e2e8f0" }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          variant="scrollable"
          allowScrollButtonsMobile
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="E‑Coupon Store" value="store" />
          <Tab label="Manual Lucky Coupon" value="manual" />
          <Tab label="Coupon Summary" value="summary" />
        </Tabs>
      </Box>

      {activeTab === "store" ? (
        <Box sx={{ mb: 2 }}>
          <ECouponStore />
        </Box>
      ) : null}

      {activeTab === "manual" ? (
        <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
            Manual Lucky Coupon
          </Typography>
          <Box component="form" onSubmit={submitManual}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Coupon Code"
                  value={manual.coupon_code}
                  onChange={(e) => onManualChange("coupon_code", e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    size="small"
                    label="TR Username"
                    value={manual.tr_username}
                    onChange={(e) => onManualChange("tr_username", e.target.value)}
                    onBlur={resolveTR}
                    required
                  />
                  <Button variant="outlined" size="small" onClick={resolveTR} disabled={manual.resolving}>
                    {manual.resolving ? "Checking..." : "Check"}
                  </Button>
                </Stack>
              </Grid>
              {manual.error ? (
                <Grid item xs={12}>
                  <Alert severity="error">{manual.error}</Alert>
                </Grid>
              ) : null}
              {manual.resolved ? (
                <Grid item xs={12}>
                  <Box sx={{ p: 1, border: "1px solid #eee", borderRadius: 1 }}>
                    <Typography variant="body2"><strong>Username:</strong> {manual.resolved.username}</Typography>
                    <Typography variant="body2"><strong>Name:</strong> {manual.resolved.full_name || "-"}</Typography>
                    <Typography variant="body2"><strong>Pincode:</strong> {manual.resolved.pincode || "-"}</Typography>
                  </Box>
                </Grid>
              ) : null}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Consumer TR Username"
                  value={manual.consumer_tr_username}
                  onChange={(e) => onManualChange("consumer_tr_username", e.target.value)}
                  helperText="Your username will be sent as Consumer TR."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                >
                  {manual.file ? "Change File" : "Attach File (optional)"}
                  <input
                    type="file"
                    hidden
                    onChange={(e) => onManualChange("file", e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                    accept="image/*,application/pdf"
                  />
                </Button>
                {manual.file ? (
                  <Typography variant="caption" sx={{ ml: 1 }}>{manual.file.name}</Typography>
                ) : null}
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes (optional)"
                  value={manual.notes}
                  onChange={(e) => onManualChange("notes", e.target.value)}
                  multiline
                  minRows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button type="submit" variant="contained" disabled={manual.submitting} sx={{ backgroundColor: "#145DA0", "&:hover": { backgroundColor: "#0C4B82" } }}>
                    {manual.submitting ? "Submitting..." : "Submit"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      ) : null}

      {walletMsg ? <Alert severity="success" sx={{ mb: 2 }}>{walletMsg}</Alert> : null}

      {/* <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Channel"
                name="channel"
                value={form.channel}
                onChange={onChange}
              >
                {CHANNELS.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Coupon Type"
                name="coupon_type"
                value={form.coupon_type}
                onChange={onChange}
              >
                {COUPON_TYPES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Action"
                name="action"
                value={form.action}
                onChange={onChange}
                helperText={form.coupon_type === "50" && form.action === "REDEEM" ? "₹50 cannot be redeemed" : ""}
                error={form.coupon_type === "50" && form.action === "REDEEM"}
              >
                {ACTIONS.map((a) => (
                  <MenuItem key={a.value} value={a.value} disabled={form.coupon_type === "50" && a.value === "REDEEM"}>
                    {a.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                name="coupon_code"
                label="Coupon Code"
                value={form.coupon_code}
                onChange={onChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                name="referral_id"
                label="TR Referral ID"
                value={form.referral_id}
                onChange={onChange}
                required
              />
            </Grid>

            {form.channel === "physical" ? (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  name="pincode"
                  label="Pincode (optional)"
                  value={form.pincode}
                  onChange={onChange}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                />
              </Grid>
            ) : null}

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                name="notes"
                label="Notes (optional)"
                value={form.notes}
                onChange={onChange}
                multiline
                minRows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{ backgroundColor: "#145DA0", "&:hover": { backgroundColor: "#0C4B82" } }}
                >
                  {submitting ? "Processing..." : "Submit"}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper> */}

      {/* <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
          Manual Lucky Coupon Submission (Physical only)
        </Typography>
        <Box component="form" onSubmit={submitManual}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Coupon Code"
                value={manual.coupon_code}
                onChange={(e) => onManualChange("coupon_code", e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  label="TR Username"
                  value={manual.tr_username}
                  onChange={(e) => onManualChange("tr_username", e.target.value)}
                  onBlur={resolveTR}
                  required
                />
                <Button variant="outlined" size="small" onClick={resolveTR} disabled={manual.resolving}>
                  {manual.resolving ? "Checking..." : "Check"}
                </Button>
              </Stack>
            </Grid>
            {manual.error ? (
              <Grid item xs={12}>
                <Alert severity="error">{manual.error}</Alert>
              </Grid>
            ) : null}
            {manual.resolved ? (
              <Grid item xs={12}>
                <Box sx={{ p: 1, border: "1px solid #eee", borderRadius: 1 }}>
                  <Typography variant="body2"><strong>Username:</strong> {manual.resolved.username}</Typography>
                  <Typography variant="body2"><strong>Name:</strong> {manual.resolved.full_name || "-"}</Typography>
                  <Typography variant="body2"><strong>Pincode:</strong> {manual.resolved.pincode || "-"}</Typography>
                </Box>
              </Grid>
            ) : null}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Consumer TR Username"
                value={manual.consumer_tr_username}
                onChange={(e) => onManualChange("consumer_tr_username", e.target.value)}
                helperText="Your username will be sent as Consumer TR."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Button
                component="label"
                variant="outlined"
                size="small"
              >
                {manual.file ? "Change File" : "Attach File (optional)"}
                <input
                  type="file"
                  hidden
                  onChange={(e) => onManualChange("file", e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  accept="image/*,application/pdf"
                />
              </Button>
              {manual.file ? (
                <Typography variant="caption" sx={{ ml: 1 }}>{manual.file.name}</Typography>
              ) : null}
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Notes (optional)"
                value={manual.notes}
                onChange={(e) => onManualChange("notes", e.target.value)}
                multiline
                minRows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button type="submit" variant="contained" disabled={manual.submitting} sx={{ backgroundColor: "#145DA0", "&:hover": { backgroundColor: "#0C4B82" } }}>
                  {manual.submitting ? "Submitting..." : "Submit"}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper> */}

      {activeTab === "summary" && (
        <>
      {/* My E-Coupon Summary */}
      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
          My E-Coupon Summary
        </Typography>
        {loadingSummary ? (
          <Typography variant="body2">Loading...</Typography>
        ) : errorSummary ? (
          <Alert severity="error">{errorSummary}</Alert>
        ) : mySummary ? (
          <>
          <Grid container spacing={2} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
            <Grid item xs={6} md={3} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)", color: "#fff", border: "1px solid rgba(124,58,237,0.35)", boxShadow: "0 8px 18px rgba(124,58,237,0.35)" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Available</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{mySummary.available ?? 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)", color: "#fff", border: "1px solid rgba(244,63,94,0.35)", boxShadow: "0 8px 18px rgba(244,63,94,0.35)" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Redeemed</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{mySummary.redeemed ?? 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "1px solid rgba(16,185,129,0.35)", boxShadow: "0 8px 18px rgba(16,185,129,0.35)" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Activated</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{mySummary.activated ?? 0}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3} sx={{
           
            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
              <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(59,130,246,0.35)", boxShadow: "0 8px 18px rgba(59,130,246,0.35)" }}>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>Transferred</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{mySummary.transferred ?? 0}</Typography>
              </Box>
            </Grid>
          </Grid>
          {mySummary.by_value ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0C2D48", mb: 1 }}>
                By Denomination
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(mySummary.by_value).map(([v, ent]) => (
                  <Grid item xs={12} sm={6} md={4} key={v}>
                    <Box sx={{ p: 2, borderRadius: 2, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>₹{v}</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip size="small" label={`Avail ${ent.available ?? 0}`} color="primary" variant="outlined" />
                        <Chip size="small" label={`Act ${ent.activated ?? 0}`} color="success" variant="outlined" />
                        <Chip size="small" label={`Red ${ent.redeemed ?? 0}`} color="error" variant="outlined" />
                        <Chip size="small" label={`Trans ${ent.transferred ?? 0}`} color="info" variant="outlined" />
                      </Stack>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : null}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">No data.</Typography>
        )}
      </Paper>


      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
          All My E‑Coupon Codes
        </Typography>
        {codesLoading ? (
          <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} /> <Typography variant="body2">Loading...</Typography>
          </Box>
        ) : codesError ? (
          <Alert severity="error">{codesError}</Alert>
        ) : (myCodes || []).length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No e‑coupon entries.
          </Typography>
        ) : (
          <>
          <Box sx={{ display: { xs: "block", sm: "none" } }}>
            {(myCodes || []).map((c) => {
              const status = String(c.display_status || c.status || "").toUpperCase();
              const isActivated = status === "ACTIVATED";
              const isPending = status === "PENDING";
              const isRedeemed = status === "REDEEMED";
              const canAct = !!c.can_activate;
              const canTrans = !!c.can_transfer;
              const busy = !!transferCodeBusy[c.id];
              const forceEnable = isPending;
              const dialogBusyThis = Boolean(transferDialog.submitting && transferDialog.code && transferDialog.code.id === c.id);
              const isTransferred = status === "TRANSFERRED";
              const disableActivate = (isActivated || isTransferred) ? true : (Boolean(activateCodeBusy[c.id]) || busy || dialogBusyThis || (!forceEnable && !canAct));
              const disableTransfer = forceEnable
                ? (!!busy || Boolean(activateCodeBusy[c.id]) || dialogBusyThis)
                : (busy || !canTrans || Boolean(activateCodeBusy[c.id]) || isActivated || isTransferred || dialogBusyThis);
              const chipColor = isActivated ? "success" : (isRedeemed ? "error" : (isPending ? "warning" : (isTransferred ? "info" : "default")));
              return (
                <Paper key={c.id} sx={{ p: 1.5, mb: 1.5, borderRadius: 2 }}>
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{c.code}</Typography>
                      <Chip size="small" label={c.display_status || c.status} color={chipColor} />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {typeof c.value !== "undefined" ? `₹${c.value}` : ""}{c.created_at ? ` • ${new Date(c.created_at).toLocaleString()}` : ""}
                    </Typography>
                    {!isRedeemed ? (
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant={isActivated ? "outlined" : "contained"}
                          color={isActivated ? "success" : "primary"}
                          disabled={disableActivate}
                          sx={{
                            flex: 1,
                            "&.Mui-disabled": isActivated
                              ? { borderColor: "#10b981", color: "#10b981", backgroundColor: "#ecfdf5" }
                              : { backgroundColor: "#9e9e9e", color: "#fff" },
                          }}
                          onClick={() => !isActivated && handleActivateCode(c)}
                          startIcon={isActivated ? <CheckCircleIcon /> : undefined}
                        >
                          {isActivated
                            ? "Activated"
                            : (activateCodeBusy[c.id] ? "Activating..." : "Activate")}
                        </Button>
                        <Button
                          size="small"
                          variant={isTransferred ? "outlined" : (disableTransfer ? "outlined" : "contained")}
                          color={isTransferred ? "success" : (disableTransfer ? "inherit" : "primary")}
                          disabled={isTransferred || disableTransfer}
                          sx={{
                            flex: 1,
                            ...(isTransferred
                              ? { "&.Mui-disabled": { borderColor: "#10b981", color: "#10b981", backgroundColor: "#ecfdf5" } }
                              : {
                                  backgroundColor: disableTransfer ? "#e0e0e0 !important" : undefined,
                                  color: disableTransfer ? "#757575 !important" : undefined,
                                  borderColor: disableTransfer ? "#bdbdbd !important" : undefined,
                                  "&:hover": {
                                    backgroundColor: disableTransfer ? "#e0e0e0 !important" : undefined,
                                    borderColor: disableTransfer ? "#bdbdbd !important" : undefined
                                  },
                                  "&.Mui-disabled": {
                                    backgroundColor: "#e0e0e0 !important",
                                    color: "#9e9e9e !important",
                                    borderColor: "#bdbdbd !important"
                                  }
                                }),
                          }}
                          onClick={() => openTransferDialog(c)}
                          startIcon={isTransferred ? <CheckCircleIcon /> : (disableTransfer ? <LockOutlinedIcon /> : undefined)}
                        >
                          {isTransferred ? "Transferred" : (busy ? "Processing..." : "Transfer")}
                        </Button>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Redeemed</Typography>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
          <TableContainer sx={{ maxWidth: "100%", overflowX: "auto", display: { xs: "none", sm: "block" } }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Status</TableCell>
                   <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Value</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Assigned Agency</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
              {(myCodes || []).map((c) => {
                const status = String(c.display_status || c.status || "").toUpperCase();
                const isActivated = status === "ACTIVATED";
                const isPending = status === "PENDING";
                const isRedeemed = status === "REDEEMED";
                const canAct = !!c.can_activate;
                const canTrans = !!c.can_transfer;
                const tf = transferCodeForms[c.id] || {};
                const busy = !!transferCodeBusy[c.id];
                const forceEnable = isPending;
                const dialogBusyThis = Boolean(transferDialog.submitting && transferDialog.code && transferDialog.code.id === c.id);
                const isTransferred = status === "TRANSFERRED";
                const disableActivate = (isActivated || isTransferred) ? true : (Boolean(activateCodeBusy[c.id]) || busy || dialogBusyThis || (!forceEnable && !canAct));
                const disableTransfer = forceEnable
                  ? (!!busy || Boolean(activateCodeBusy[c.id]) || dialogBusyThis)
                  : (busy || !canTrans || Boolean(activateCodeBusy[c.id]) || isActivated || isTransferred || dialogBusyThis);
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.code}</TableCell>
                    <TableCell>{c.display_status || c.status}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{typeof c.value !== "undefined" ? `₹${c.value}` : ""}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{c.assigned_agency_username || ""}</TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</TableCell>
                    <TableCell>
                      {!isRedeemed ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            size="small"
                            variant={isActivated ? "outlined" : "contained"}
                            color={isActivated ? "success" : "primary"}
                            disabled={disableActivate}
                            sx={{
                              "&.Mui-disabled": isActivated
                                ? { borderColor: "#10b981", color: "#10b981", backgroundColor: "#ecfdf5" }
                                : { backgroundColor: "#9e9e9e", color: "#fff" },
                            }}
                            onClick={() => !isActivated && handleActivateCode(c)}
                            startIcon={isActivated ? <CheckCircleIcon /> : undefined}
                          >
                            {isActivated
                              ? "Activated"
                              : (activateCodeBusy[c.id] ? "Activating..." : "Activate")}
                          </Button>
                          <Button
                            size="small"
                            variant={isTransferred ? "outlined" : (disableTransfer ? "outlined" : "contained")}
                            color={isTransferred ? "success" : (disableTransfer ? "inherit" : "primary")}
                            disabled={isTransferred || disableTransfer}
                            sx={{
                              ...(isTransferred
                                ? { "&.Mui-disabled": { borderColor: "#10b981", color: "#10b981", backgroundColor: "#ecfdf5" } }
                                : {
                                    backgroundColor: disableTransfer ? "#e0e0e0 !important" : undefined,
                                    color: disableTransfer ? "#757575 !important" : undefined,
                                    borderColor: disableTransfer ? "#bdbdbd !important" : undefined,
                                    "&:hover": {
                                      backgroundColor: disableTransfer ? "#e0e0e0 !important" : undefined,
                                      borderColor: disableTransfer ? "#bdbdbd !important" : undefined
                                    },
                                    "&.Mui-disabled": {
                                      backgroundColor: "#e0e0e0 !important",
                                      color: "#9e9e9e !important",
                                      borderColor: "#bdbdbd !important"
                                    }
                                  }),
                            }}
                            onClick={() => openTransferDialog(c)}
                            startIcon={isTransferred ? <CheckCircleIcon /> : (disableTransfer ? <LockOutlinedIcon /> : undefined)}
                          >
                            {isTransferred ? "Transferred" : (busy ? "Processing..." : "Transfer")}
                          </Button>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">Redeemed</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          </TableContainer>
          </>
        )}
      </Paper>
        </>
      )}

      {/* <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
          My E-Coupon Requests
        </Typography>
        {loadingSubs ? (
          <Typography variant="body2">Loading...</Typography>
        ) : errorSubs ? (
          <Alert severity="error">{errorSubs}</Alert>
        ) : (mySubs || []).length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No submissions yet.
          </Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {(mySubs || []).map((s) => {
              const canTransfer = Boolean(s.code_ref) && String(s.status).toUpperCase() === "SUBMITTED";
              const tf = transferForms[s.id] || {};
              const busy = !!transferBusy[s.id];
              return (
                <li key={s.id} style={{ marginBottom: 12, listStyle: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      <strong>Code:</strong> {s.coupon_code} — <strong>Status:</strong> {statusLabel(s.status)}{" "}
                      {s.created_at ? `— ${new Date(s.created_at).toLocaleString()}` : ""}
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => useSubmissionCode(s)}>
                      Use
                    </Button>
                  </div>
                  {canTransfer ? (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                      <TextField
                        size="small"
                        label="Transfer To (TR Username)"
                        value={tf.to_username || ""}
                        onChange={(e) => onTransferChange(s.id, "to_username", e.target.value)}
                      />
                      <TextField
                        size="small"
                        label="Pincode"
                        value={tf.pincode || ""}
                        onChange={(e) => onTransferChange(s.id, "pincode", e.target.value)}
                        inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                      />
                      <TextField
                        size="small"
                        label="Notes"
                        value={tf.notes || ""}
                        onChange={(e) => onTransferChange(s.id, "notes", e.target.value)}
                      />
                      <Button size="small" variant="contained" disabled={busy} onClick={() => doTransfer(s)}>
                        {busy ? "Transferring..." : "Transfer"}
                      </Button>
                    </Stack>
                  ) : null}
                </li>
              );
            })}
          </Box>
        )}
      </Paper> */}
      <Dialog open={transferDialog.open} onClose={closeTransferDialog} fullWidth maxWidth="sm">
        <DialogTitle>Transfer E-Coupon</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="TR Username"
              value={transferDialog.username}
              onChange={(e) => setTransferDialog((d) => ({ ...d, username: e.target.value, userInfo: null }))}
              onBlur={resolveUsername}
            />
            <Button variant="outlined" size="small" onClick={resolveUsername} disabled={transferDialog.resolving}>
              {transferDialog.resolving ? "Checking..." : "Check"}
            </Button>
            {transferDialog.error ? <Alert severity="error">{transferDialog.error}</Alert> : null}
            {transferDialog.userInfo ? (
              <Box sx={{ p: 1, border: "1px solid #eee", borderRadius: 1 }}>
                <Typography variant="body2"><strong>Username:</strong> {transferDialog.userInfo.username}</Typography>
                <Typography variant="body2"><strong>Name:</strong> {transferDialog.userInfo.full_name || "-"}</Typography>
                <Typography variant="body2"><strong>Pincode:</strong> {transferDialog.userInfo.pincode || "-"}</Typography>
                <Typography variant="body2"><strong>City/State:</strong> {transferDialog.userInfo.city || "-"}{transferDialog.userInfo.state ? `, ${transferDialog.userInfo.state}` : ""}</Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">Enter TR Username to view details.</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTransferDialog}>Close</Button>
          <Button variant="contained" onClick={submitTransfer} disabled={transferDialog.submitting || !transferDialog.username}>
            {transferDialog.submitting ? "Transferring..." : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}
