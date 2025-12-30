/**
 * LoginV2.jsx — UI-only refactor (NO logic changes)
 * - Fintech-grade, native app-style layout
 * - All auth logic, API calls, redirects, handlers, field names and labels preserved
 * - Primary CTA text unchanged: "Sign In"
 * - No new flows; optional back arrow allowed by spec
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Link,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import {
  AccountCircle,
  Lock,
  Visibility,
  VisibilityOff,
  ArrowBackIosNew,
} from "@mui/icons-material";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import API from "../../../api/api";
import LOGO from "../../../assets/TRIKONEKT.png";
// Removed NavbarV2 and FooterV2 (no website nav on this screen)
import V2Button from "../components/V2Button";
import "../styles/v2-theme.css";

export default function LoginV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role: roleParam } = useParams();

  const ALLOWED_ROLES = ["user", "agency", "employee", "business"];
  const lockedRole = ALLOWED_ROLES.includes(String(roleParam || "").toLowerCase())
    ? String(roleParam).toLowerCase()
    : null;

  const [role, setRole] = useState(lockedRole || "user");

  useEffect(() => {
    if (lockedRole && role !== lockedRole) setRole(lockedRole);
    // eslint-disable-next-line
  }, [lockedRole]);

  // Basic state
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Forgot password dialog
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpUsername, setFpUsername] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpLoading, setFpLoading] = useState(false);

  // Prefill username from remember_username
  useEffect(() => {
    const saved = localStorage.getItem("remember_username");
    if (saved) {
      setFormData((fd) => ({ ...fd, username: saved }));
      setRemember(true);
    }
  }, []);

  // Pretty role text
  const prettyRole = (r) =>
    ({
      user: "Consumer",
      agency: "Agency",
      employee: "Employee",
      business: "Merchant",
    }[String(r || "").toLowerCase()] || String(r || ""));

  // Resolve user's actually registered role to prevent mismatch
  const resolveRegisteredRole = async (uname) => {
    try {
      const r = await API.get("/accounts/hierarchy/", { params: { username: String(uname || "").trim() } });
      const u = r?.data?.user || r?.data || {};
      let ro = (u?.role || "").toLowerCase();
      if (!ro) {
        const c = (u?.category || "").toLowerCase();
        if (c.startsWith("agency")) ro = "agency";
        else if (c === "consumer") ro = "user";
        else if (c === "employee") ro = "employee";
        else if (c === "business") ro = "business";
      }
      return ro || null;
    } catch {
      return null;
    }
  };

  // Submit login (unchanged logic)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let username = (formData.username || "").trim();
      const submitRole = role;

      // Role mismatch guard
      const resolved = await resolveRegisteredRole(username);
      if (resolved && resolved !== submitRole) {
        setErrorMsg(`You are registered as ${prettyRole(resolved)} but trying to login as ${prettyRole(submitRole)}.`);
        return;
      }

      const res = await API.post("/accounts/login/", {
        username,
        password: formData.password,
        role: submitRole,
      });

      const access = res?.data?.access || res?.data?.token || res?.data?.data?.token;
      const refreshTok = res?.data?.refresh;
      if (!access) throw new Error("No access token returned from server");

      const payload = JSON.parse(atob(access.split(".")[1] || ""));
      const tokenRole = payload?.role;
      const tokenUsername = payload?.username;
      const tokenFullName = payload?.full_name;

      if (!tokenRole) throw new Error("Token missing role claim");

      const roleEffective =
        payload?.role_effective ||
        (String(payload?.category || "").toLowerCase() === "business" ? "business" : tokenRole);

      const ns = (payload?.is_staff || payload?.is_superuser) ? "admin" : (roleEffective || tokenRole || "user");
      const store = remember ? localStorage : sessionStorage;

      // Clean old non-namespaced keys
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("refresh");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("refresh");
        sessionStorage.removeItem("role");
        sessionStorage.removeItem("user");
      } catch (_) {}

      store.setItem(`token_${ns}`, access);
      if (refreshTok) store.setItem(`refresh_${ns}`, refreshTok);
      store.setItem(`role_${ns}`, roleEffective || tokenRole || "user");

      try {
        const authHeaders = { headers: { Authorization: `Bearer ${access}` } };
        const meResp = await API.get("/accounts/me/", authHeaders);
        if (meResp?.data) {
          store.setItem(`user_${ns}`, JSON.stringify(meResp.data));
        } else {
          store.setItem(`user_${ns}`, JSON.stringify({ role: tokenRole, username: tokenUsername, full_name: tokenFullName }));
        }
      } catch (_) {
        store.setItem(`user_${ns}`, JSON.stringify({ role: tokenRole, username: tokenUsername, full_name: tokenFullName }));
      }

      if (remember) localStorage.setItem("remember_username", username);
      else localStorage.removeItem("remember_username");

      // Redirects
      if (payload?.is_staff || payload?.is_superuser) {
        navigate("/admin/dashboard", { replace: true });
      } else {
        const eff = String(roleEffective || tokenRole || "user").toLowerCase();
        if (eff === "user") navigate("/user/dashboard2", { replace: true });
        else navigate(`/${eff}/dashboard`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      const data = err?.response?.data;
      if (data?.multiple_accounts && Array.isArray(data.multiple_accounts)) {
        const choices = data.multiple_accounts.map((a) => a.username).join(", ");
        setErrorMsg(`Multiple accounts ambiguity. Please enter one of these usernames: ${choices}`);
      } else {
        const msg = data?.detail || (data ? JSON.stringify(data) : "Login failed!");
        setErrorMsg(typeof msg === "string" ? msg : String(msg));
      }
    }
  };

  const handleChange = (e) => setFormData((fd) => ({ ...fd, [e.target.name]: e.target.value }));

  // Forgot password
  const handlePasswordReset = async () => {
    const username = fpUsername || formData.username;
    const newPassword = fpNewPassword;
    if (!username || !newPassword) {
      alert("Please provide username and new password.");
      return;
    }
    try {
      setFpLoading(true);
      const res = await API.post("/accounts/password/reset/", { username, new_password: newPassword });
      alert(res?.data?.detail || "Password reset successful.");
      setForgotOpen(false);
      setFpUsername("");
      setFpNewPassword("");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Password reset failed!");
      alert(msg);
    } finally {
      setFpLoading(false);
    }
  };

  // Extract sponsor from query to forward to Register link
  const sponsorFromQS = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      return (
        params.get("sponsor") ||
        params.get("sponsor_id") ||
        params.get("agencyid") ||
        params.get("ref") ||
        ""
      );
    } catch {
      return "";
    }
  }, [location.search]);

  const handleGoRegister = () => {
    const parts = [];
    if (sponsorFromQS) parts.push(`sponsor=${encodeURIComponent(sponsorFromQS)}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    navigate(`/v2/register/${role}${qs}`);
  };

  // Common sx tokens for inputs
  const inputSx = {
    mb: 2,
    "& .MuiOutlinedInput-root": {
      height: 48,
      bgcolor: "#FFFFFF",
      borderRadius: 1.5,
      "& fieldset": { borderColor: "#E5E7EB" },
      "&:hover fieldset": { borderColor: "#D1D5DB" },
      "&.Mui-focused fieldset": { borderColor: "#FF7B00" },
      "&.Mui-focused": { boxShadow: "0 0 0 4px rgba(255, 123, 0, 0.12)" },
    },
    "& .MuiInputLabel-root": { color: "#6B7280" },
    "& input": { color: "#1F2937", fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" },
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#FFFFFF",
        px: 2,
        py: 4,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <Container maxWidth="sm" sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 480,
            p: { xs: 2.5, sm: 3 },
            borderRadius: 2,
            position: "relative",
            bgcolor: "#FFFFFF",
            border: "1px solid #F3F4F6",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          {/* Accent strip */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              bgcolor: "#FFF4DF",
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
            }}
          />

          {/* Header: optional back + centered logo */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <IconButton aria-label="Back" onClick={() => navigate(-1)} size="small" sx={{ color: "#6B7280" }}>
              <ArrowBackIosNew fontSize="small" />
            </IconButton>
            <Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
              <img src={LOGO} alt="Trikonekt" style={{ height: 28 }} />
            </Box>
            {/* Spacer to balance the back button width */}
            <Box sx={{ width: 40 }} />
          </Box>

          {/* Title */}
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography sx={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>Login</Typography>
            <Typography sx={{ fontSize: 14, color: "#6B7280", mt: 0.5 }}>
              Secure access to your account
            </Typography>
          </Box>

          {/* Alerts (unchanged logic) */}
          {errorMsg ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg("")}>
              {errorMsg}
            </Alert>
          ) : null}
          {successMsg ? (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>
              {successMsg}
            </Alert>
          ) : null}

          {/* Form (unchanged handlers and field names) */}
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <TextField
              fullWidth
              name="username"
              value={formData.username}
              onChange={handleChange}
              label="Username"
              placeholder="AE470455"
              sx={inputSx}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AccountCircle sx={{ color: "#6B7280" }} />
                  </InputAdornment>
                ),
              }}
              required
            />

            <TextField
              fullWidth
              name="password"
              value={formData.password}
              onChange={handleChange}
              label="Password"
              type={showPassword ? "text" : "password"}
              sx={{ ...inputSx, mb: 1.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: "#6B7280" }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((p) => !p)}
                      size="small"
                      sx={{ color: "#6B7280" }}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              required
            />

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                    Remember me
                  </Typography>
                }
              />
              <Link
                component="button"
                onClick={() => setForgotOpen(true)}
                sx={{ color: "#FF7B00", fontWeight: 600, fontSize: 14, textDecoration: "none" }}
              >
                Forgot password?
              </Link>
            </Box>

            {/* Enforce CTA style even if V2Button drops sx by wrapping in selector */}
            <Box
              sx={{
                "& .MuiButton-root": {
                  backgroundColor: "#FF7B00",
                  color: "#FFFFFF",
                  height: 48,
                  borderRadius: 1.5,
                  fontWeight: 600,
                  textTransform: "none",
                  boxShadow: "none",
                },
                "& .MuiButton-root:hover": {
                  backgroundColor: "#E86F00",
                  boxShadow: "none",
                },
              }}
            >
              <V2Button fullWidth type="submit" sx={{ backgroundColor: "#FF7B00" }}>
                Sign In
              </V2Button>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 14, color: "#6B7280" }}>
                Don't have an account?{" "}
                <Link
                  component="button"
                  onClick={handleGoRegister}
                  sx={{ color: "#FF7B00", fontWeight: 600, textDecoration: "none" }}
                >
                  Register Here
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>

      {/* Forgot Password Dialog (logic unchanged) */}
      <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Username"
            fullWidth
            value={fpUsername}
            onChange={(e) => setFpUsername(e.target.value)}
            sx={inputSx}
          />
          <TextField
            margin="dense"
            label="New Password"
            type="password"
            fullWidth
            value={fpNewPassword}
            onChange={(e) => setFpNewPassword(e.target.value)}
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions>
          <V2Button variant="secondary" onClick={() => setForgotOpen(false)}>Cancel</V2Button>
          <V2Button onClick={handlePasswordReset} disabled={fpLoading}>
            {fpLoading ? "Resetting..." : "Reset Password"}
          </V2Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
