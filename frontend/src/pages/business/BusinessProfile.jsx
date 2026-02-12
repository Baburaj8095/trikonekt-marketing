import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { getMerchantProfile, updateMerchantProfile } from "../../api/api";

export default function BusinessProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    business_name: "",
    mobile_number: "",
    commission_percent: "",
    service_mode: "BOTH",
    address: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await getMerchantProfile();
        if (!cancelled) {
          setProfile(p || {});
          setForm({
            business_name: p?.business_name || "",
            mobile_number: p?.mobile_number || "",
            commission_percent:
              p?.commission_percent != null && p.commission_percent !== ""
                ? String(p.commission_percent)
                : "",
            service_mode: (p?.service_mode || "BOTH").toString().toUpperCase(),
            address: p?.address || "",
          });
        }
      } catch (e) {
        if (!cancelled) setError("Failed to load merchant profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target || {};
    if (!name) return;
    if (name === "mobile_number") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
      setForm((prev) => ({ ...prev, [name]: digits }));
      return;
    }
    if (name === "commission_percent") {
      // keep as string but restrict to numeric characters and dot, max 6 chars
      const v = String(value || "")
        .replace(/[^0-9.]/g, "")
        .slice(0, 6);
      setForm((prev) => ({ ...prev, [name]: v }));
      return;
    }
    if (name === "service_mode") {
      setForm((prev) => ({ ...prev, [name]: String(value || "").toUpperCase() }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      // Basic client validation
      if (!form.business_name.trim()) {
        throw new Error("Business Name is required.");
      }
      if (!/^\d{10}$/.test(String(form.mobile_number || ""))) {
        throw new Error("Enter a valid 10-digit Mobile Number.");
      }
      const cp = parseFloat(String(form.commission_percent || "").trim());
      const commissionValid =
        String(form.commission_percent || "").trim() === "" ||
        (Number.isFinite(cp) && cp >= 0 && cp <= 100);
      if (!commissionValid) {
        throw new Error("Commission must be a number between 0 and 100.");
      }
      const sm = String(form.service_mode || "BOTH").toUpperCase();
      const serviceValid = ["ONLINE", "OFFLINE", "BOTH"].includes(sm);
      if (!serviceValid) {
        throw new Error("Service Mode must be one of: ONLINE, OFFLINE, BOTH.");
      }

      const payload = {
        business_name: form.business_name || "",
        mobile_number: form.mobile_number || "",
        // Only send commission if provided (avoid overwriting with empty when backend has value)
        ...(String(form.commission_percent || "").trim() !== "" && {
          commission_percent: parseFloat(form.commission_percent),
        }),
        service_mode: sm,
        address: form.address || "",
      };
      const updated = await updateMerchantProfile(payload);
      setProfile(updated || {});
      setSuccess("Profile updated successfully.");
    } catch (e) {
      const msg =
        e?.response?.data
          ? JSON.stringify(e.response.data)
          : e?.message || "Failed to update profile.";
      setError(typeof msg === "string" ? msg : String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        Merchant Profile
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      ) : null}

      <Paper elevation={2} sx={{ p: 2.5 }}>
        {loading ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Business Name"
                name="business_name"
                value={form.business_name}
                onChange={handleChange}
                sx={{ mb: { xs: 0, md: 1 } }}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Mobile Number"
                name="mobile_number"
                value={form.mobile_number}
                onChange={handleChange}
                sx={{ mb: { xs: 0, md: 1 } }}
                inputProps={{ inputMode: "tel", maxLength: 10 }}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Commission Percentage (%)"
                name="commission_percent"
                value={form.commission_percent}
                onChange={handleChange}
                sx={{ mb: { xs: 0, md: 1 } }}
                type="number"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText="0 - 100"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={{ mb: { xs: 0, md: 1 } }}>
                <InputLabel>Service Mode</InputLabel>
                <Select
                  label="Service Mode"
                  name="service_mode"
                  value={form.service_mode}
                  onChange={handleChange}
                >
                  <MenuItem value="BOTH">Both</MenuItem>
                  <MenuItem value="ONLINE">Online</MenuItem>
                  <MenuItem value="OFFLINE">Offline</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                value={form.address}
                onChange={handleChange}
                sx={{ mb: { xs: 0, md: 1 } }}
                multiline
                minRows={2}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Username"
                value={profile?.username || ""}
                disabled
                helperText="Linked user account (read-only)"
              />
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: "flex", alignItems: "center" }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Verification
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    size="small"
                    label={profile?.is_verified ? "Verified" : "Pending"}
                    color={profile?.is_verified ? "success" : "default"}
                    variant={profile?.is_verified ? "filled" : "outlined"}
                  />
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        )}
      </Paper>
    </Box>
  );
}
