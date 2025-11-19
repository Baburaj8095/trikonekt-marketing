import React, { useMemo, useState, useEffect } from "react";
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
  TextField,
  InputAdornment,
  Stack,
  Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import API from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";

const drawerWidth = 220;

export default function LuckyDraw({ embedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Responsive drawer state (used only in standalone mode)
  const theme = useTheme();
  useMediaQuery(theme.breakpoints.up("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);

  // Active route highlighting (used only in standalone mode)
  const isDashboard = location.pathname === "/user/dashboard";
  const isLuckyDraw = location.pathname === "/user/lucky-draw";
  const isMarketplace =
    location.pathname === "/marketplace" || location.pathname.startsWith("/marketplace/");
  const isMyOrders = location.pathname === "/marketplace/my-orders";
  const isECoupon = location.pathname === "/user/redeem-coupon";
  const isWallet = location.pathname === "/user/wallet";
  const isKYC = location.pathname === "/user/kyc";
  const isMyTeam = location.pathname === "/user/my-team";

  // Identity for navbar
  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      localStorage.removeItem("role");
      sessionStorage.removeItem("role");
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
    } catch (e) {}
    navigate("/", { replace: true });
  };

  // Lucky Draw (fields only)
  const [form, setForm] = useState({
    sl_number: "",
    ledger_number: "",
    pincode: "",
    phone: "",
    // Additional details
    coupon_purchaser_name: "",
    purchase_date: "",
    address: "",
    tr_referral_id: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // My Lucky Draw submissions
  const [lucky, setLucky] = useState([]);
  const [luckyLoading, setLuckyLoading] = useState(false);
  const [luckyError, setLuckyError] = useState("");
  // TR resolve (Manual Lucky Coupon)
  const [trResolving, setTrResolving] = useState(false);
  const [trResolved, setTrResolved] = useState(null);
  const [trError, setTrError] = useState("");


  const [luckyEnabled, setLuckyEnabled] = useState(true);

  // Prefill pincode from logged-in profile if empty
  useEffect(() => {
    try {
      const pin = String(storedUser?.pincode || "").trim();
      if (pin) {
        setForm((f) => (f.pincode ? f : { ...f, pincode: pin }));
      }
    } catch (e) {}
  }, [storedUser?.pincode]);

  // Prefill purchaser name from logged-in profile if empty
  useEffect(() => {
    try {
      const name = String(storedUser?.full_name || storedUser?.username || "").trim();
      if (name) {
        setForm((f) => (f.coupon_purchaser_name ? f : { ...f, coupon_purchaser_name: name }));
      }
    } catch (e) {}
  }, [storedUser?.full_name, storedUser?.username]);

  // Prefill phone from stored username if it looks like a mobile number
  useEffect(() => {
    try {
      const uname = String(storedUser?.username || "").trim();
      if (/^\d{10}$/.test(uname)) {
        setForm((f) => (f.phone ? f : { ...f, phone: uname }));
      }
    } catch (e) {}
  }, [storedUser?.username]);

  useEffect(() => {
    const fetchFlag = async () => {
      try {
        const res = await API.get("/uploads/cards/");
        const data = Array.isArray(res.data) ? res.data : [];
        const hasLucky = data.some(
          (c) =>
            String(c.key).toLowerCase() === "lucky_draw" ||
            String(c.key).toLowerCase() === "lucky-draw"
        );
        setLuckyEnabled(hasLucky);
      } catch (e) {
        setLuckyEnabled(true);
      }
    };
    fetchFlag();
  }, []);

  // Load user's Lucky Draw submissions
  useEffect(() => {
    let active = true;
    const loadLucky = async () => {
      try {
        setLuckyLoading(true);
        setLuckyError("");
        const res = await API.get("/uploads/lucky-draw/");
        const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
        if (active) setLucky(arr || []);
      } catch (e) {
        if (active) {
          setLucky([]);
          setLuckyError("Failed to load Lucky Draw submissions");
        }
      } finally {
        if (active) setLuckyLoading(false);
      }
    };
    loadLucky();
    return () => {
      active = false;
    };
  }, []);

  // Human readable status and "pending with" indicator
  const statusMeta = (status) => {
    const s = String(status || "").toUpperCase();
    switch (s) {
      case "SUBMITTED":
        return { label: "Submitted" };
      case "TRE_APPROVED":
        return { label: "Pending with Agency", pending_with: "AGENCY" };
      case "TRE_REJECTED":
        return { label: "Rejected by TRE", pending_with: null };
      case "AGENCY_APPROVED":
        return { label: "Approved by Agency", pending_with: null };
      case "AGENCY_REJECTED":
        return { label: "Rejected by Agency", pending_with: null };
      default:
        return { label: s || "Unknown", pending_with: null };
    }
  };

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type || !f.type.startsWith("image/")) {
      alert("Only image files are allowed.");
      e.target.value = null;
      return;
    }
    setFile(f);
  };

  // Resolve TR user (by TR Referral ID) for confirmation
  const resolveTR = async () => {
    const u = String(form.tr_referral_id || "").trim();
    if (!u) return;
    try {
      setTrResolving(true);
      setTrError("");
      setTrResolved(null);
      const res = await API.get("/coupons/codes/resolve-user", { params: { username: u } });
      setTrResolving(false);
      setTrResolved(res?.data || null);
    } catch (e) {
      setTrResolving(false);
      const msg = e?.response?.data?.detail || "User not found.";
      setTrResolved(null);
      setTrError(msg);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!luckyEnabled) {
      alert("Lucky draw participation is currently disabled.");
      return;
    }
    if (!form.sl_number || !form.ledger_number || !form.pincode) {
      alert("Please fill SL Number, Ledger Number and Pincode.");
      return;
    }
    if (!/^\d{6}$/.test(String(form.pincode).trim())) {
      alert("Enter a valid 6-digit pincode.");
      return;
    }
    if (!/^\d{10}$/.test(String(form.phone).trim())) {
      alert("Enter a valid 10-digit phone number.");
      return;
    }
    if (!String(form.tr_referral_id || "").trim()) {
      alert("TR Referral ID is required.");
      return;
    }
    if (!file) {
      alert("Please choose an image file to upload.");
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("sl_number", String(form.sl_number).trim());
      fd.append("ledger_number", String(form.ledger_number).trim());
      fd.append("pincode", String(form.pincode).trim());
      if (form.phone) fd.append("phone", String(form.phone).trim());
      if (storedUser?.username) fd.append("username", storedUser.username);
      if (storedUser?.role) fd.append("role", storedUser.role);
      // Additional fields (send if present)
      if (form.coupon_purchaser_name) fd.append("coupon_purchaser_name", String(form.coupon_purchaser_name).trim());
      if (form.purchase_date) fd.append("purchase_date", String(form.purchase_date));
      if (form.address) fd.append("address", String(form.address).trim());
      if (form.tr_referral_id) fd.append("tr_referral_id", String(form.tr_referral_id).trim());
      fd.append("image", file);

      await API.post("/uploads/lucky-draw/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Lucky draw submission uploaded successfully.");
      // refresh list after successful submit
      try {
        setLuckyLoading(true);
        const res = await API.get("/uploads/lucky-draw/");
        const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setLucky(arr || []);
      } catch {
        // ignore
      } finally {
        setLuckyLoading(false);
      }
      navigate("/user/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Upload failed");
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Main content (shared for embedded and standalone)
  const MainContent = (
    <Container maxWidth="sm" sx={{ px: 0, ml: 0, mr: "auto" }}>
      {/* Lucky Draw Section */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          backgroundColor: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
          Manual Lucky Coupon (Lucky Draw)
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
          Enter your details and upload the coupon image. Only images are accepted.
        </Typography>

        {!luckyEnabled && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Lucky draw participation is currently disabled by admin.
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="SL Number"
              name="sl_number"
              value={form.sl_number}
              onChange={onChange}
              disabled={!luckyEnabled}
              required
            />
            <TextField
              fullWidth
              label="Ledger Number"
              name="ledger_number"
              value={form.ledger_number}
              onChange={onChange}
              disabled={!luckyEnabled}
              required
            />
            <TextField
              fullWidth
              label="Pincode"
              name="pincode"
              value={form.pincode}
              onChange={onChange}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              disabled={!luckyEnabled}
              required
            />
            <TextField
              fullWidth
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={onChange}
              type="tel"
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              InputProps={{
                startAdornment: <InputAdornment position="start">+91</InputAdornment>,
              }}
              disabled={!luckyEnabled}
              required
            />

            {/* Additional Fields */}
            <TextField
              fullWidth
              label="Coupon Purchaser Name"
              name="coupon_purchaser_name"
              value={form.coupon_purchaser_name}
              onChange={onChange}
              disabled={!luckyEnabled}
            />
            <TextField
              fullWidth
              label="Purchase Date"
              name="purchase_date"
              type="date"
              value={form.purchase_date}
              onChange={onChange}
              InputLabelProps={{ shrink: true }}
              disabled={!luckyEnabled}
            />
            <TextField
              fullWidth
              label="Address"
              name="address"
              value={form.address}
              onChange={onChange}
              multiline
              minRows={2}
              disabled={!luckyEnabled}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                fullWidth
                label="TR Referral ID"
                name="tr_referral_id"
                value={form.tr_referral_id}
                onChange={onChange}
                onBlur={resolveTR}
                required
                error={Boolean(trError)}
                helperText={trError ? trError : "Required — routes this submission to the specified TR."}
                disabled={!luckyEnabled}
              />
              <Button variant="outlined" size="small" onClick={resolveTR} disabled={!luckyEnabled || trResolving}>
                {trResolving ? "Checking..." : "Check"}
              </Button>
            </Stack>
            {trResolved ? (
              <Box sx={{ p: 1, border: "1px solid #eee", borderRadius: 1, backgroundColor: "#fafafa" }}>
                <Typography variant="body2"><strong>TR:</strong> {trResolved.username}</Typography>
                <Typography variant="body2"><strong>Name:</strong> {trResolved.full_name || "-"}</Typography>
                <Typography variant="body2"><strong>Pincode:</strong> {trResolved.pincode || "-"}</Typography>
              </Box>
            ) : null}

            <Button variant="outlined" component="label" fullWidth disabled={!luckyEnabled}>
              {file ? `Selected: ${file.name}` : "Choose Coupon Image"}
              <input type="file" accept="image/*" hidden onChange={onFileChange} />
            </Button>
            {file ? (
              <Box sx={{ mt: 1 }}>
                <Box
                  component="img"
                  src={URL.createObjectURL(file)}
                  alt="Preview"
                  sx={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 1, border: "1px solid #eee" }}
                />
                <Typography variant="caption" color="text.secondary">Accepted: JPG/PNG images up to ~5MB.</Typography>
              </Box>
            ) : null}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={submitting || !luckyEnabled}
              sx={{
                backgroundColor: "#145DA0",
                py: 1.2,
                fontWeight: 600,
                borderRadius: 2,
                "&:hover": { backgroundColor: "#0C4B82" },
              }}
            >
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* My Lucky Draw Submissions */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          backgroundColor: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          mt: 3,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
          My Manual Coupon Submissions
        </Typography>
        {luckyLoading ? (
          <Typography variant="body2">Loading...</Typography>
        ) : luckyError ? (
          <Typography variant="body2" color="error">{luckyError}</Typography>
        ) : lucky.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No submissions yet.
          </Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {lucky.map((s) => {
              const meta = statusMeta(s.status);
              return (
                <li key={s.id} style={{ marginBottom: 8 }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>SL:</strong> {s.sl_number} — <strong>Ledger:</strong> {s.ledger_number} — {s.pincode} — {meta.label}
                    {s.assigned_tre_username ? ` — TRE: ${s.assigned_tre_username}` : ""}
                    {s.created_at ? ` — ${new Date(s.created_at).toLocaleString()}` : ""}
                  </Typography>
                  {s.image ? (
                    <a href={s.image} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      View Image
                    </a>
                  ) : null}
                </li>
              );
            })}
          </Box>
        )}
      </Paper>
    </Container>
  );

  // Embedded mode: render only the page body so ConsumerShell controls the layout and sidebar
  if (embedded) {
    return <Box sx={{}}>{MainContent}</Box>;
  }

  // Standalone mode: keep the previous self-contained layout (AppBar + Drawer)
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fb" }}>
      {/* App Top Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          backgroundColor: "#0C2D48",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="img" src={LOGO} alt="Trikonekt" sx={{ height: 36 }} />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}></Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" sx={{ mr: 2 }}>
            {displayName}
          </Typography>
          <Button color="inherit" size="small" sx={{ fontWeight: 500, textTransform: "none" }} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Sidebar - Mobile temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid #e5e7eb",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            <ListItemButton
              selected={isDashboard}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                navigate("/user/dashboard");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton
              selected={isLuckyDraw}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                navigate("/user/lucky-draw");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="Manual Lucky Coupon" />
            </ListItemButton>
            <ListItemButton
              selected={isMarketplace}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                navigate("/marketplace");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="Marketplace" />
            </ListItemButton>
            <ListItemButton
              selected={isECoupon}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                navigate("/user/redeem-coupon");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="E-Coupon" />
            </ListItemButton>
            <ListItemButton
              selected={isWallet}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                navigate("/user/wallet");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="Wallet" />
            </ListItemButton>
            <ListItemButton
              selected={isKYC}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                navigate("/user/kyc");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="KYC" />
            </ListItemButton>
            <ListItemButton
              selected={isMyTeam}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                navigate("/user/my-team");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="My Team" />
            </ListItemButton>
            <ListItemButton
              selected={isMyOrders}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                navigate("/marketplace/my-orders");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="My Orders" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}></Box>
        </Box>
      </Drawer>

      {/* Sidebar - Permanent on sm+ */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid #e5e7eb",
          },
        }}
        open
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            <ListItemButton
              selected={isDashboard}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => navigate("/user/dashboard")}
            >
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton
              selected={isLuckyDraw}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => navigate("/user/lucky-draw")}
            >
              <ListItemText primary="Manual Lucky Coupon" />
            </ListItemButton>
            <ListItemButton
              selected={isMarketplace}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => navigate("/marketplace")}
            >
              <ListItemText primary="Marketplace" />
            </ListItemButton>
            <ListItemButton
              selected={isECoupon}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => navigate("/user/redeem-coupon")}
            >
              <ListItemText primary="E-Coupon" />
            </ListItemButton>
            <ListItemButton
              selected={isWallet}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => navigate("/user/wallet")}
            >
              <ListItemText primary="Wallet" />
            </ListItemButton>
            <ListItemButton
              selected={isKYC}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => navigate("/user/kyc")}
            >
              <ListItemText primary="KYC" />
            </ListItemButton>
            <ListItemButton
              selected={isMyTeam}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => navigate("/user/my-team")}
            >
              <ListItemText primary="My Team" />
            </ListItemButton>
            <ListItemButton
              selected={isMyOrders}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => navigate("/marketplace/my-orders")}
            >
              <ListItemText primary="My Orders" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }} />
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
        }}
      >
        <Toolbar />
        {MainContent}
      </Box>
    </Box>
  );
}
