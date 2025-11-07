import React, { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Stack,
  Alert,
  MenuItem,
  Grid,
} from "@mui/material";
import API from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";

const CHANNELS = [
  { value: "e_coupon", label: "E-Coupon" },
  { value: "physical", label: "Physical Coupon" },
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
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
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
    pincode: defaultPincode,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [walletInfo, setWalletInfo] = useState({ balance: "0" });
  const [walletMsg, setWalletMsg] = useState("");

  const [mySubs, setMySubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [errorSubs, setErrorSubs] = useState("");

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

  const loadWallet = async () => {
    try {
      const res = await API.get("/accounts/wallet/me/");
      setWalletInfo({ balance: res?.data?.balance ?? "0" });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadMySubmissions();
    loadWallet();
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
    if (form.channel === "physical") {
      // No upload required for Physical Coupon. Pincode optional.
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

      // E-Coupon → immediate API
      if (form.channel === "e_coupon") {
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
          // REDEEM (only 150)
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
      } else {
        // Physical → direct activation/redeem without upload
        if (form.action === "ACTIVATE") {
          const t = form.coupon_type === "50" ? "50" : "150";
          await API.post("/v1/coupon/activate/", {
            type: t,
            source: {
              channel: "physical",
              code: String(form.coupon_code).trim(),
              referral_id: String(form.referral_id).trim(),
              pincode: String(form.pincode || "").trim(),
            },
          });
          alert(t === "150" ? "Activated: 5-matrix + 3-matrix opened." : "Activated: 3-matrix opened.");
        } else {
          // REDEEM (only 150)
          await API.post("/v1/coupon/redeem/", {
            type: "150",
            source: {
              channel: "physical",
              code: String(form.coupon_code).trim(),
              referral_id: String(form.referral_id).trim(),
              pincode: String(form.pincode || "").trim(),
            },
          });
          await loadWallet();
          setWalletMsg("₹140 has been credited to your wallet.");
          alert("Redeem successful. Wallet credited.");
        }
      }

      // Reset some fields
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
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fb" }}>
      <AppBar position="fixed" sx={{ backgroundColor: "#0C2D48" }}>
        <Toolbar>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="img" src={LOGO} alt="Trikonekt" sx={{ height: 36 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}></Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2">{displayName}</Typography>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
        <Toolbar />

        <Container maxWidth="md" sx={{ px: 0, ml: 0, mr: "auto" }}>
          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
              Coupon Actions
            </Typography>

            {walletMsg ? <Alert severity="success" sx={{ mb: 2 }}>{walletMsg}</Alert> : null}

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
          </Paper>

          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
              My Coupon Requests (Physical Channel)
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
                {(mySubs || []).map((s) => (
                  <li key={s.id} style={{ marginBottom: 8 }}>
                    <Typography variant="body2">
                      <strong>Code:</strong> {s.coupon_code} — <strong>Status:</strong> {statusLabel(s.status)}{" "}
                      {s.created_at ? `— ${new Date(s.created_at).toLocaleString()}` : ""}
                    </Typography>
                  </li>
                ))}
              </Box>
            )}
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
