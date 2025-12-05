import React, { useState, useEffect } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Grid,
  Paper,
  Avatar,
  InputAdornment,
  Checkbox,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";

const HomeScreen = () => {
  const [mode, setMode] = useState("login"); // login | register
  const [role, setRole] = useState("user");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();


  const handleModeChange = () => setMode(mode === "login" ? "register" : "login");
  const handleRoleChange = (e) => setRole(e.target.value);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    full_name: "",
    phone: "",
  });
  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  // Cascading location dropdown state
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [pincode, setPincode] = useState("");
  // Geoapify-derived location fields
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoCountryCode, setGeoCountryCode] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");
  const [sponsorId, setSponsorId] = useState("");
  const [remember, setRemember] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpUsername, setFpUsername] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load countries on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await API.get("/location/countries/");
        setCountries(res.data || []);
      } catch (err) {
        console.error("Failed to load countries", err);
      }
    };
    loadCountries();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("remember_username");
    if (saved) {
      setFormData((fd) => ({ ...fd, username: saved }));
      setRemember(true);
    }
  }, []);

  const loadStates = async (countryId) => {
    try {
      const res = await API.get("/location/states/", { params: { country: countryId } });
      setStates(res.data || []);
    } catch (err) {
      console.error("Failed to load states", err);
    }
  };

  const loadCities = async (stateId) => {
    try {
      const res = await API.get("/location/cities/", { params: { state: stateId } });
      setCities(res.data || []);
    } catch (err) {
      console.error("Failed to load cities", err);
    }
  };

  const handleCountryChange = (e) => {
    const value = e.target.value;
    setSelectedCountry(value);
    // reset dependents
    setSelectedState("");
    setSelectedCity("");
    setStates([]);
    setCities([]);
    setPincode("");
    if (value) loadStates(value);
  };

  const handleStateChange = (e) => {
    const value = e.target.value;
    setSelectedState(value);
    // reset dependent
    setSelectedCity("");
    setCities([]);
    setPincode("");
    if (value) loadCities(value);
  };

  const handleCityChange = (e) => {
    const value = e.target.value;
    setSelectedCity(value);
    setPincode("");
  };

  // Geoapify pincode -> location autofill
  const GEOAPIFY_KEY = "655e1106608c4df1a2d9adcc05b05476";
  const fetchFromGeoapify = async (code) => {
    try {
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
        code
      )}&type=postcode&limit=1&format=json&apiKey=${GEOAPIFY_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const first = data?.results?.[0];
      if (!first) return;

      const country_name = first.country || "";
      const country_code = (first.country_code || "").toUpperCase();
      const state_name = first.state || "";
      // As per requirement, use "county" as "city" and normalize by removing 'taluku' and extra spaces
      const raw_city = first.county || "";
      const city_name = (raw_city || "").replace(/\b(taluk|taluka|taluku)\b/gi, "").replace(/\s+/g, " ").trim();
      //alert(city_name);
      setGeoCountryName(country_name);
      setGeoCountryCode(country_code);
      setGeoStateName(state_name);
      setGeoCityName(city_name);

      // Try to auto-select IDs in our dropdowns
      const countryMatch =
        countries.find(
          (c) =>
            (c.iso2 && c.iso2.toUpperCase() === country_code) ||
            (c.name && c.name.toLowerCase() === country_name.toLowerCase())
        ) || null;
      if (countryMatch) {
        setSelectedCountry(countryMatch.id);
        try {
          const stRes = await API.get("/location/states/", {
            params: { country: countryMatch.id },
          });
          const stList = stRes.data || [];
          setStates(stList);
          const stMatch =
            stList.find(
              (s) =>
                (s.name && s.name.toLowerCase() === state_name.toLowerCase()) ||
                (s.name && s.name.toLowerCase().includes(state_name.toLowerCase()))
            ) || null;
          if (stMatch) {
            setSelectedState(stMatch.id);
            // Do not auto-compare city with internal API; use Geoapify county directly in city text field
          }
        } catch (_) {}
      }
    } catch (e) {
      console.error("Geoapify lookup failed", e);
    }
  };

  useEffect(() => {
    const code = (pincode || "").trim();
    if (code.length >= 4) {
      fetchFromGeoapify(code);
    }
  }, [pincode]);

  // Read sponsor id from URL (?sponsor= / ?sponsor_id= / ?ref=)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("sponsor") || params.get("sponsor_id") || params.get("ref");
      if (s) setSponsorId(s);
    } catch {}
  }, []);

  const handlePasswordReset = async () => {
    const username = fpUsername || formData.username;
    const newPassword = fpNewPassword;
    if (!username || !newPassword) {
      alert("Please provide username and new password.");
      return;
    }
    try {
      setFpLoading(true);
      const res = await API.post("/accounts/password/reset/", {
        username,
        new_password: newPassword,
      });
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

  const isLogin = mode === "login";
  const loginField = {
    label:
      role === "user"
        ? "Phone Number"
        : role === "employee"
        ? "User Name"
        : "User Name",
    type: role === "user" ? "tel" : "text",
    inputMode: role === "user" ? "numeric" : "text",
    placeholder:
      role === "user"
        ? "Enter your phone number"
        : role === "employee"
        ? "Enter your employee username"
        : "Enter your agency username",
    pattern: role === "user" ? "[0-9]*" : undefined,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "login") {
      try {
        const res = await API.post("/accounts/login/", {
          username: formData.username,
          password: formData.password,
          role,
        });

        const access = res?.data?.access || res?.data?.token || res?.data?.data?.token;
        const refreshTok = res?.data?.refresh;
        if (!access) {
          throw new Error("No access token returned from server");
        }

        // Decode JWT to verify role from server-side
        const payload = JSON.parse(atob(access.split(".")[1] || ""));
        const tokenRole = payload?.role;
        const tokenUsername = payload?.username;
        const tokenFullName = payload?.full_name;

        if (!tokenRole) {
          throw new Error("Token missing role claim");
        }

        if (tokenRole !== role) {
          setErrorMsg("Role mismatch. Please select the correct role for this account.");
          return;
        }

        const storage = remember ? localStorage : sessionStorage;
        storage.setItem("token", access);
        if (refreshTok) storage.setItem("refresh", refreshTok);
        storage.setItem("role", tokenRole);
        storage.setItem("user", JSON.stringify({ role: tokenRole, username: tokenUsername, full_name: tokenFullName }));
        if (remember) {
          localStorage.setItem("remember_username", formData.username);
        } else {
          localStorage.removeItem("remember_username");
        }

        navigate(`/${tokenRole}/dashboard`, { replace: true });
      } catch (err) {
        console.error(err);
        const msg =
          err?.response?.data?.detail ||
          (err?.response?.data ? JSON.stringify(err.response.data) : "Login failed!");
        setErrorMsg(typeof msg === "string" ? msg : String(msg));
      }
    } else {
      // Register
      if (!formData.username) {
        setErrorMsg("Username is required");
        return;
      }
      if (!formData.password) {
        setErrorMsg("Password is required");
        return;
      }
      if (formData.password !== confirmPassword) {
        setErrorMsg("Password and Confirm Password do not match");
        return;
      }
      if (role === "employee" && !formData.email) {
        setErrorMsg("Email is required for employee registration");
        return;
      }
      const hasSelected = selectedCountry && selectedState;
      const hasGeo = geoCountryName && geoStateName;
      if (!(hasSelected || hasGeo)) {
        setErrorMsg("Select Country & State or enter a valid Pincode to auto-fill");
        return;
      }
      if (!geoCityName) {
        setErrorMsg("Please enter/confirm City");
        return;
      }
      if (!pincode) {
        setErrorMsg("Please enter Pincode");
        return;
      }

      const payload = {
        username: formData.username,
        password: formData.password,
        email: formData.email,
        role,
        full_name: formData.full_name,
        phone: formData.phone,
        sponsor_id: sponsorId || "",
        country: selectedCountry || null,
        state: selectedState || null,
        city: selectedCity || null,
        pincode,
        // Geoapify-derived helpers (backend will resolve if IDs are null)
        country_name: geoCountryName || "",
        country_code: geoCountryCode || "",
        state_name: geoStateName || "",
        city_name: geoCityName || "",
      };

      try {
        await API.post("/accounts/register/", payload);
        setSuccessMsg("Registration successful. Please login.");
        setMode("login");
        // Optionally clear fields
        setFormData({ username: "", password: "", email: "", full_name: "", phone: "" });
        setConfirmPassword("");
        setSelectedCountry("");
        setSelectedState("");
        setSelectedCity("");
        setPincode("");
        setStates([]);
        setCities([]);
      } catch (err) {
        console.error(err);
        const msg =
          err?.response?.data
            ? JSON.stringify(err.response.data)
            : "Registration failed!";
        setErrorMsg(typeof msg === "string" ? msg : String(msg));
      }
    }
  };

  const renderRegistrationFields = () => {
    switch (role) {
      case "employee":
        return (
          <>
            <TextField
              fullWidth
              label="Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              fullWidth
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              sx={{ mb: 2 }}
              type="tel"
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              required
            />
            {/* <TextField fullWidth label="Employee ID" sx={{ mb: 2 }} required /> */}
            {/* <TextField fullWidth label="Sub Franchise" sx={{ mb: 2 }} required /> */}
          </>
        );
      case "agency":
        return (
          <>
            <TextField
              fullWidth
              label="Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
            />
            {/* <TextField fullWidth label="License Number" sx={{ mb: 2 }} required /> */}
            <TextField
              fullWidth
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              sx={{ mb: 2 }}
              type="tel"
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              required
            />
          </>
        );
      case "user":
        return (
          <>
            <TextField
              fullWidth
              label="Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
            />
            {/* <TextField fullWidth label="Phone Number" sx={{ mb: 2 }} required /> */}
            {/* <TextField fullWidth label="Address" sx={{ mb: 2 }} required /> */}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #EEF3F7 0%, #FFFFFF 70%)",
      }}
    >
      {/* Navbar */}
      <AppBar
        position="sticky"
        sx={{
          backgroundColor: "#0C2D48",
          color: "#fff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <Toolbar>
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
            <img src={LOGO} alt="Trikonekt" style={{ height: 40, marginRight: 10 }} />
          </Box>
          <Button color="inherit" sx={{ fontWeight: 500, textTransform: "none" }}>
            Home
          </Button>
          <Button color="inherit" sx={{ fontWeight: 500, textTransform: "none" }}>
            About
          </Button>
          <Button color="inherit" sx={{ fontWeight: 500, textTransform: "none" }}>
            Login
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container
        maxWidth="sm"
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 8,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            width: "100%",
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            backgroundColor: "#fff",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <Typography
            variant="h5"
            align="center"
            sx={{
              fontWeight: 700,
              mb: 3,
              color: "#0C2D48",
              fontSize: { xs: 22, md: 26 },
            }}
          >
            {isLogin ? "Login to Trikonekt" : "Register for Trikonekt"}
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Typography
            variant="subtitle1"
            sx={{ mb: 1, fontWeight: 500, color: "#555" }}
          >
            Select Role:
          </Typography>
          <RadioGroup
            row
            value={role}
            onChange={handleRoleChange}
            sx={{
              mb: 3,
              justifyContent: "center",
              p: 1,
              borderRadius: 2,
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}
          >
            <FormControlLabel value="user" control={<Radio />} label="Consumer" />
            <FormControlLabel value="agency" control={<Radio />} label="Agency" />
            <FormControlLabel value="employee" control={<Radio />} label="Employee" />
            <FormControlLabel value="business" control={<Radio />} label="Business" />
          </RadioGroup>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg("")}>
              {errorMsg}
            </Alert>
          )}
          {successMsg && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>
              {successMsg}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} className="auth-mobile-full">
            {!isLogin && renderRegistrationFields()}

            <TextField
              fullWidth
              name="username"
              value={formData.username}
              label={loginField.label}
              placeholder={loginField.placeholder}
              type={loginField.type}
              inputProps={{
                inputMode: loginField.inputMode,
                pattern: loginField.pattern,
              }}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
            />

            <TextField
              fullWidth
              name="password"
              value={formData.password}
              label="Password"
              type={showPassword ? "text" : "password"}
              onChange={handleChange}
              sx={{ mb: isLogin ? 2.5 : 3 }}
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      size="small"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {!isLogin && (
              <TextField
                fullWidth
                label="Confirm Password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                sx={{ mb: 2 }}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirm((prev) => !prev)}
                        size="small"
                      >
                        {showConfirm ? "Hide" : "Show"}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}

            {/* Cascading Country → State → City dropdowns (only in registration) */}
            {!isLogin && (
              <>
                {/* Sponsor ID (optional; auto-filled from ?sponsor= / ?sponsor_id= / ?ref=) */}
                <TextField
                  fullWidth
                  label="Sponsor ID"
                  value={sponsorId}
                  onChange={(e) => setSponsorId(e.target.value)}
                  sx={{ mb: 3 }}
                />
                {/* Pincode first */}
                <TextField
                  fullWidth
                  label="Pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  sx={{ mb: 3 }}
                  type="tel"
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  helperText={
                    geoStateName || geoCityName || geoCountryName
                      ? `Detected: ${[geoCityName, geoStateName, geoCountryCode || geoCountryName].filter(Boolean).join(", ")}`
                      : ""
                  }
                  required
                />

                {/* City (non-editable) */}
                <TextField
                  fullWidth
                  label="City"
                  value={geoCityName}
                  disabled
                  sx={{ mb: 2 }}
                />

                {/* State (non-editable) */}
                <TextField
                  fullWidth
                  label="State"
                  value={geoStateName}
                  disabled
                  sx={{ mb: 2 }}
                />

                {/* Country (non-editable) */}
                <TextField
                  fullWidth
                  label="Country"
                  value={geoCountryName}
                  disabled
                  sx={{ mb: 2 }}
                />
              </>
            )}

            {isLogin && (
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
                  label="Remember me"
                />
                <Button
                  size="small"
                  sx={{ textTransform: "none" }}
                  onClick={() => setForgotOpen(true)}
                >
                  Forgot password?
                </Button>
              </Box>
            )}

            <Button
              fullWidth
              type="submit"
              variant="contained"
              sx={{
                backgroundColor: "#145DA0",
                py: 1.2,
                fontWeight: 600,
                borderRadius: 2,
                "&:hover": { backgroundColor: "#0C4B82" },
              }}
            >
              {isLogin ? "Login" : "Register"}
            </Button>

            <Typography
              variant="body2"
              align="center"
              sx={{ mt: 2, color: "text.secondary" }}
            >
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <Box
                component="span"
                sx={{ color: "#145DA0", fontWeight: 600, cursor: "pointer" }}
                onClick={handleModeChange}
              >
                {isLogin ? "Register" : "Login"}
              </Box>
            </Typography>
          </Box>

          <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>Reset Password</DialogTitle>
            <DialogContent>
              <TextField
                margin="dense"
                label="Username"
                fullWidth
                value={fpUsername}
                onChange={(e) => setFpUsername(e.target.value)}
              />
              <TextField
                margin="dense"
                label="New Password"
                type="password"
                fullWidth
                value={fpNewPassword}
                onChange={(e) => setFpNewPassword(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setForgotOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={handlePasswordReset} disabled={fpLoading}>
                {fpLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogActions>
          </Dialog>

        </Paper>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          py: 3,
          textAlign: "center",
          backgroundColor: "rgba(255,255,255,0.85) !important",
          color: "#000",
          boxShadow: "10 20px 10px rgba(0,0,0,0.06) !important",
        }}
      >
        <Typography variant="body2">
            © {new Date().getFullYear()} Trikonekt. All rights reserved.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Contact us:{" "}
            <Link
              href="mailto:contact@trikonekt.com"
              underline="hover"
              color="inherit"
              sx={{ fontWeight: 500 }}
            >
              contact@trikonekt.com
            </Link>
          </Typography>
      </Box>
    </Box>
  );
};

export default HomeScreen;
