import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  Autocomplete,
  CircularProgress,
  Alert,
} from "@mui/material";
import API from "../api/api";

function SmartLocation() {
  const [autoDetected, setAutoDetected] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualPincode, setManualPincode] = useState("");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [finalLocation, setFinalLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchLoading, setBranchLoading] = useState(false);
  const [accuracy, setAccuracy] = useState(null);

  // STEP 1: Try auto-detection
  useEffect(() => {
    if (!navigator.geolocation) {
      setManualMode(true);
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          setAccuracy(accuracy);

          const r = await API.get("/location/reverse/", {
            params: { lat: latitude, lon: longitude },
          });
          const rb = r?.data || {};

          const detected = {
            latitude,
            longitude,
            accuracy,
            pincode: rb.pincode || "",
            city: rb.city || rb.town || rb.village || rb.district || "",
            district: rb.district || "",
            state: rb.state || "",
            country: rb.country || "",
          };

          // eslint-disable-next-line no-console
          console.log("Auto-detected:", detected);
          setAutoDetected(detected);
          setFinalLocation(detected);
          setLoading(false);

          // Check if accuracy is poor or city missing
          if (!detected.pincode || accuracy > 5000) {
            setManualMode(true);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Reverse geocoding failed:", err);
          setManualMode(true);
          setLoading(false);
        }
      },
      (error) => {
        // eslint-disable-next-line no-console
        console.error("Auto-detect error:", error.message);
        setManualMode(true);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // STEP 2: Manual pincode search
  const handleFetchBranches = async () => {
    const pin = (manualPincode || "").replace(/\D/g, "");
    if (!pin || pin.length !== 6) {
      alert("Enter a valid 6-digit pincode");
      return;
    }

    setBranchLoading(true);
    try {
      const resp = await API.get(`/location/pincode/${pin}/`);
      const payload = resp?.data || {};
      const list = Array.isArray(payload.post_offices) ? payload.post_offices : [];
      setBranches(list);
      if (!list.length) {
        alert("Invalid or not found pincode");
        setBranches([]);
      }
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert("Failed to fetch branches. Please try again.");
      setBranches([]);
    } finally {
      setBranchLoading(false);
    }
  };

  // STEP 3: Handle branch selection and correct location
  const handleBranchSelect = async (branch) => {
    if (!branch) return;
    setSelectedBranch(branch);
    const corrected = {
        pincode: branch.pincode || branch.Pincode,
        post_office: branch.name || branch.Name,
        district: branch.district || branch.District,
        state: branch.state || branch.State,
        country: branch.country || branch.Country || "India",
        latitude: "",
        longitude: "",
      };
    setFinalLocation(corrected);
  };

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <CardContent>
          {/* <Typography variant="h5" gutterBottom>
            📍 Smart Location Detector
          </Typography> */}

          {loading ? (
            <Typography variant="body2">Detecting location...</Typography>
          ) : (
            <>
              {/* {accuracy && accuracy > 5000 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Low GPS accuracy detected (~{Math.round(accuracy)}m). You may be connected via Wi-Fi or VPN.
                </Alert>
              )} */}

              {manualMode && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Auto-detection seems inaccurate or unavailable. Please enter your pincode manually.
                </Alert>
              )}

              {/* Auto-detected info */}
              {!manualMode && autoDetected && (
                <>
                  <Typography variant="subtitle1">Auto Detected Location</Typography>
                  <Box
                    component="pre"
                    sx={{
                      bgcolor: "#f6f6f6",
                      p: 1.5,
                      borderRadius: 1,
                      fontSize: 13,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(autoDetected, null, 2)}
                  </Box>
                  <Button
                    variant="outlined"
                    sx={{ mt: 1 }}
                    onClick={() => setManualMode(true)}
                  >
                    Enter Manually
                  </Button>
                </>
              )}

              {/* Manual entry */}
              {manualMode && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1">🔎 Manual Location Entry</Typography>

                  <Box sx={{ display: "flex", gap: 1, mt: 1, mb: 2 }}>
                    <TextField
                      label="Enter 6-digit Pincode"
                      variant="outlined"
                      size="small"
                      fullWidth
                      value={manualPincode}
                      onChange={(e) => setManualPincode(e.target.value.replace(/\D/g, ""))}
                      inputProps={{ maxLength: 6 }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleFetchBranches}
                      disabled={branchLoading}
                    >
                      {branchLoading ? <CircularProgress size={20} /> : "Search"}
                    </Button>
                  </Box>

                  {branches.length > 0 && (
                    <Autocomplete
                      options={branches}
                      getOptionLabel={(option) =>
                        `${(option.name || option.Name)} (${(option.district || option.District)}, ${(option.state || option.State)})`
                      }
                      renderInput={(params) => (
                        <TextField {...params} label="Select Post Office / Branch" />
                      )}
                      onChange={(e, val) => handleBranchSelect(val)}
                    />
                  )}
                </>
              )}

              {/* Final location */}
              {/* {finalLocation && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1">📦 Final Location</Typography>
                  <Box
                    component="pre"
                    sx={{
                      bgcolor: "#f6f6f6",
                      p: 1.5,
                      borderRadius: 1,
                      fontSize: 13,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(finalLocation, null, 2)}
                  </Box>
                </>
              )} */}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default SmartLocation;
