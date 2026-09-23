import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SettingsSuggestRoundedIcon from "@mui/icons-material/SettingsSuggestRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import API from "../../api/api";

export default function AdminCommissionConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [config, setConfig] = useState({
    // Royalty Settings
    royalty_tier1_share: 40,
    royalty_tier1_cap: 10000,
    royalty_tier1_days: 40,
    royalty_tier2_share: 60,
    royalty_tier2_cap: 40000,
    royalty_tier2_days: 7,
    special_approval_enabled: true,

    // Self Rebirth Settings
    rebirth_total_amount: 250,
    rebirth_district_pool: 50,
    rebirth_5matrix_share: 80,
    rebirth_3matrix_share: 20,
    rebirth_direct_sponsor: 40,

    // Franchise Settings
    franchise_total_pool: 10,
    franchise_holder_share: 6,
    captain_share: 4,
    franchise_2x_limit_enabled: true,
    renewal_required: true,

    // Digital Education & Layer Matrix
    de_net_consumer_share: 50,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await API.get("/coupons/store/payment-configs/");
        if (res?.data?.commission_config) {
          setConfig((prev) => ({ ...prev, ...res.data.commission_config }));
        }
      } catch (err) {
        // Fall back to default state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (field) => (event) => {
    const val = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setConfig((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await API.post("/coupons/store/payment-configs/", { commission_config: config });
      setSuccess("Commission configuration updated successfully.");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: "#0f172a" }}>
            Admin Commission & Distribution Control Panel
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Configure dynamic percentages, pools, time limits, 2X caps, and royalty rules across the platform.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveRoundedIcon />}
          disabled={saving || loading}
          onClick={handleSave}
          sx={{ fontWeight: 900, bgcolor: "#1e1b4b", px: 3 }}
        >
          Save Configuration
        </Button>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* 1. Royalty System Configuration */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: "100%" }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
              <WorkspacePremiumRoundedIcon color="warning" />
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
                District Royalty Settings (40% / 60%)
              </Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#64748b", mb: 1 }}>
              TIER 1 ROYALTY (RANK 2 TO RANK 7)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Share Ratio (%)"
                  type="number"
                  value={config.royalty_tier1_share}
                  onChange={handleChange("royalty_tier1_share")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Max Cap (₹)"
                  type="number"
                  value={config.royalty_tier1_cap}
                  onChange={handleChange("royalty_tier1_cap")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Timer (Days)"
                  type="number"
                  value={config.royalty_tier1_days}
                  onChange={handleChange("royalty_tier1_days")}
                  fullWidth
                />
              </Grid>
            </Grid>

            <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#64748b", mb: 1 }}>
              TIER 2 ROYALTY (RANK 7 TO RANK 10)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Share Ratio (%)"
                  type="number"
                  value={config.royalty_tier2_share}
                  onChange={handleChange("royalty_tier2_share")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Max Cap (₹)"
                  type="number"
                  value={config.royalty_tier2_cap}
                  onChange={handleChange("royalty_tier2_cap")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Timer (Days)"
                  type="number"
                  value={config.royalty_tier2_days}
                  onChange={handleChange("royalty_tier2_days")}
                  fullWidth
                />
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Switch
                  checked={config.special_approval_enabled}
                  onChange={handleChange("special_approval_enabled")}
                  color="primary"
                />
              }
              label={
                <Typography sx={{ fontSize: 13, fontWeight: 800 }}>
                  Enable Admin Special Approval Override (Grant extensions for missed deadlines)
                </Typography>
              }
            />
          </Paper>
        </Grid>

        {/* 2. Self Rebirth Configuration */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, height: "100%" }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
              <AutorenewRoundedIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
                Self Re-birth Allocation Settings
              </Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <TextField
                  size="small"
                  label="Rebirth ID Cost (₹)"
                  type="number"
                  value={config.rebirth_total_amount}
                  onChange={handleChange("rebirth_total_amount")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  size="small"
                  label="District Pool Share (₹)"
                  type="number"
                  value={config.rebirth_district_pool}
                  onChange={handleChange("rebirth_district_pool")}
                  fullWidth
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="5-Matrix (₹)"
                  type="number"
                  value={config.rebirth_5matrix_share}
                  onChange={handleChange("rebirth_5matrix_share")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="3-Matrix (₹)"
                  type="number"
                  value={config.rebirth_3matrix_share}
                  onChange={handleChange("rebirth_3matrix_share")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Direct Sponsor (₹)"
                  type="number"
                  value={config.rebirth_direct_sponsor}
                  onChange={handleChange("rebirth_direct_sponsor")}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* 3. Franchise & Captain Settings */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
              <StorefrontRoundedIcon color="secondary" />
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
                Franchise & Captain 2X Controls
              </Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Total Pool (%)"
                  type="number"
                  value={config.franchise_total_pool}
                  onChange={handleChange("franchise_total_pool")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Franchise Share (%)"
                  type="number"
                  value={config.franchise_holder_share}
                  onChange={handleChange("franchise_holder_share")}
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small"
                  label="Captain Share (%)"
                  type="number"
                  value={config.captain_share}
                  onChange={handleChange("captain_share")}
                  fullWidth
                />
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Switch
                  checked={config.franchise_2x_limit_enabled}
                  onChange={handleChange("franchise_2x_limit_enabled")}
                  color="secondary"
                />
              }
              label={<Typography sx={{ fontSize: 13, fontWeight: 800 }}>Enforce 2X Income Limit Cap</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.renewal_required}
                  onChange={handleChange("renewal_required")}
                  color="secondary"
                />
              }
              label={<Typography sx={{ fontSize: 13, fontWeight: 800 }}>Require Renewal to Resume Earnings</Typography>}
            />
          </Paper>
        </Grid>

        {/* 4. Digital Education Level Share */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
              <SchoolRoundedIcon color="success" />
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
                Digital Education Net Level Share
              </Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            <TextField
              size="small"
              label="Consumer Level Payout Share (%)"
              type="number"
              value={config.de_net_consumer_share}
              onChange={handleChange("de_net_consumer_share")}
              fullWidth
              helperText="Percentage of Net Pool (after GST) allocated to upline Level Income"
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
