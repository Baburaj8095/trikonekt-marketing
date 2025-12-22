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
} from "@mui/material";
import { getMerchantProfile, updateMerchantProfile } from "../../api/api";

export default function BusinessProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    business_name: "",
    mobile_number: "",
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const payload = {
        business_name: form.business_name || "",
        mobile_number: form.mobile_number || "",
      };
      const updated = await updateMerchantProfile(payload);
      setProfile(updated || {});
      setSuccess("Profile updated successfully.");
    } catch (e) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : "Failed to update profile.";
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
                inputProps={{ inputMode: "tel" }}
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
                <Typography variant="caption" color="text.secondary">Verification</Typography>
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
