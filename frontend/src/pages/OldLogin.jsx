import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Autocomplete,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/material";

export default function Login() {
  // Auth form
  const [form, setForm] = useState({ username: "", password: "" });
  const navigate = useNavigate();

  // Smart location state
  const [autoLoading, setAutoLoading] = useState(true);
  const [accuracy, setAccuracy] = useState(null);
  const [manualMode, setManualMode] = useState(false);

  const [pincode, setPincode] = useState("");
  const [branches, setBranches] = useState([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [stateVal, setStateVal] = useState("");
  const [countryVal, setCountryVal] = useState("");

  // Try auto-detection on mount
  useEffect(() => {
    let cancelled = false;

    async function autoDetect() {
      if (!navigator.geolocation) {
        setManualMode(true);
        setAutoLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude, accuracy: acc } = pos.coords;
            if (cancelled) return;

            setAccuracy(acc);

            // Reverse geocode via backend to avoid CORS
            const r = await API.get("/location/reverse/", {
              params: { lat: latitude, lon: longitude },
            });
            const rb = r?.data || {};

            const detectedPin = rb.pincode || "";
            const detectedState = rb.state || "";
            const detectedCountry = rb.country || "";

            setPincode((detectedPin || "").replace(/\D/g, "").slice(0, 6));
            setStateVal(detectedState);
            setCountryVal(detectedCountry);

            // If accuracy is poor or no postcode, enable manual flow
            const POOR_ACCURACY_THRESHOLD = 800; // meters
            if (!detectedPin || (typeof acc === "number" && acc > POOR_ACCURACY_THRESHOLD)) {
              setManualMode(true);
            } else {
              setManualMode(false);
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Reverse geocoding failed:", e);
            setManualMode(true);
          } finally {
            if (!cancelled) setAutoLoading(false);
          }
        },
        (error) => {
          // eslint-disable-next-line no-console
          console.error("Auto-detect error:", error.message);
          setManualMode(true);
          setAutoLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    autoDetect();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch post offices for the current pincode
  const handleFetchBranches = async () => {
    const pin = (pincode || "").replace(/\D/g, "");
    if (pin.length !== 6) {
      alert("Enter a valid 6-digit pincode");
      return;
    }
    setBranchLoading(true);
    setSelectedBranch(null);
    try {
      const resp = await API.get(`/location/pincode/${pin}/`);
      const payload = resp?.data || {};
      const list = Array.isArray(payload.post_offices) ? payload.post_offices : [];
      setBranches(list);
      if (!list.length) {
        setBranches([]);
        alert("Invalid or not found pincode");
      }
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert("Failed to fetch branches. Please try again.");
      setBranches([]);
    } finally {
      setBranchLoading(false);
    }
  };

  // When branch selected, lock state/country from selection
  const handleBranchSelect = (_, branch) => {
    setSelectedBranch(branch);
    if (branch) {
      const st = branch.state || branch.State || stateVal;
      const ct = branch.country || branch.Country || countryVal || "India";
      setStateVal(st);
      setCountryVal(ct);
    }
  };

  // Keep pincode digits only and reset branch list when changed
  const handlePincodeChange = (val) => {
    const next = (val || "").replace(/\D/g, "").slice(0, 6);
    setPincode(next);
    setBranches([]);
    setSelectedBranch(null);
  };

  // Auth submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await API.post("/accounts/login/", form);
      localStorage.setItem("token", data.access);
      if (data.refresh) {
        localStorage.setItem("refresh", data.refresh);
      }

      const base64Url = data.access.split(".")[1];
      const decoded = JSON.parse(atob(base64Url));
      const role = decoded.role || "user";
      localStorage.setItem("role", role);

      // Fetch profile so dashboards can read pincode/role/user details
      try {
        const meResp = await API.get("/accounts/me/");
        if (meResp?.data) {
          localStorage.setItem("user", JSON.stringify(meResp.data));
        }
      } catch (_) {}

      // Optionally persist final location snapshot for later use if needed
      const locationSnapshot = {
        pincode,
        branch: selectedBranch?.Name || null,
        district: selectedBranch?.District || null,
        state: stateVal || selectedBranch?.State || null,
        country: countryVal || selectedBranch?.Country || null,
        accuracy,
        manualMode,
      };
      try {
        localStorage.setItem("login_location", JSON.stringify(locationSnapshot));
      } catch {
        // ignore storage errors
      }

      if (role === "agency") navigate("/agency/dashboard");
      else if (role === "employee") navigate("/employee/dashboard");
      else navigate("/user/dashboard");
    } catch (err) {
      alert("Invalid credentials");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Login
      </Typography>

      {/* Smart Location inline */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          border: "1px solid #DFE8FF",
          borderRadius: 2,
          bgcolor: "#F7FAFF",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
          Location (Pincode first)
        </Typography>

        {autoLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Detecting your location…
            </Typography>
          </Box>
        ) : null}

        {!autoLoading && typeof accuracy === "number" && accuracy > 800 ? (
          <Alert severity="warning" sx={{ mb: 1 }}>
            GPS accuracy is low (±{Math.round(accuracy)}m). Select your branch manually.
          </Alert>
        ) : null}

        {/* Pincode first */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
          <TextField
            label="Pincode"
            value={pincode}
            size="small"
            onChange={(e) => handlePincodeChange(e.target.value)}
            inputProps={{ inputMode: "numeric", pattern: "\\d{6}", maxLength: 6 }}
            sx={{ width: 150 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleFetchBranches}
            disabled={(pincode || "").length !== 6 || branchLoading}
          >
            {branchLoading ? <CircularProgress size={18} color="inherit" /> : "Fetch branches"}
          </Button>
        </Box>

        {/* Branch dropdown appears when manual mode or user fetched branches */}
        {(manualMode || branches.length > 0) && (
          <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Autocomplete
              options={branches}
              value={selectedBranch}
              onChange={handleBranchSelect}
              getOptionLabel={(opt) =>
                opt
                  ? `${(opt.name || opt.Name) || ""} (${(opt.district || opt.District) || ""}, ${(opt.state || opt.State) || ""})`
                  : ""
              }
              renderInput={(params) => <TextField {...params} label="Select Post Office / Branch" size="small" />}
              sx={{ minWidth: 280, flex: 1 }}
            />
            <TextField
              label="State"
              size="small"
              value={stateVal}
              disabled
              sx={{ minWidth: 180 }}
            />
            <TextField
              label="Country"
              size="small"
              value={countryVal}
              disabled
              sx={{ minWidth: 160 }}
            />
          </Box>
        )}

        {/* If auto-detected and accurate, still show the disabled state/country fields */}
        {!manualMode && !autoLoading && (
          <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <TextField
              label="State"
              size="small"
              value={stateVal}
              disabled
              sx={{ minWidth: 180 }}
            />
            <TextField
              label="Country"
              size="small"
              value={countryVal}
              disabled
              sx={{ minWidth: 160 }}
            />
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Auth form */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
      >
        <TextField
          label="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          fullWidth
        />
        <Button type="submit" variant="contained">Login</Button>
      </Box>
    </Container>
  );
}
