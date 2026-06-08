import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";

const STATUS_OPTIONS = ["APPROVED", "PENDING", "REJECTED"];

const today = new Date();

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
    backgroundColor: "#fff",
  },
};

function AdminPanelCard({ title, subtitle, children }) {
  return (
    <Card sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, boxShadow: "0 14px 35px rgba(15, 23, 42, 0.06)" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography sx={{ color: "#0f172a", fontWeight: 900, fontSize: { xs: "1rem", md: "1.12rem" } }}>
            {title}
          </Typography>
          <Typography sx={{ color: "#64748b", fontWeight: 600, fontSize: "0.86rem" }}>
            {subtitle}
          </Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

export default function AdminFranchiseWalletControls() {
  const defaultPeriod = useMemo(
    () => ({ year: today.getFullYear(), month: today.getMonth() + 1 }),
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({
    inactive_work_day: 30,
    inactive_work_enabled: true,
    reward_min_withdrawal: "1000.00",
  });
  const [rewardForm, setRewardForm] = useState({ username: "", amount: "", note: "" });
  const [approvalForm, setApprovalForm] = useState({
    username: "",
    year: defaultPeriod.year,
    month: defaultPeriod.month,
    status: "APPROVED",
    note: "",
  });
  const [approvals, setApprovals] = useState([]);

  const loadData = async () => {
    try {
      setError("");
      setLoading(true);
      const [settingsRes, approvalsRes] = await Promise.all([
        API.get("/accounts/admin/franchise/wallet/settings/", { dedupe: "cancelPrevious" }),
        API.get("/accounts/admin/franchise/wallet/work-approvals/", {
          params: { year: approvalForm.year, month: approvalForm.month },
          dedupe: "cancelPrevious",
        }),
      ]);
      setSettings(settingsRes?.data || settings);
      setApprovals(approvalsRes?.data?.results || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load franchise wallet controls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveSettings = async () => {
    try {
      setSaving("settings");
      setError("");
      setMessage("");
      const res = await API.patch("/accounts/admin/franchise/wallet/settings/", settings);
      setSettings(res?.data || settings);
      setMessage("Withdrawal window settings saved.");
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save settings.");
    } finally {
      setSaving("");
    }
  };

  const creditReward = async () => {
    try {
      setSaving("reward");
      setError("");
      setMessage("");
      const res = await API.post("/accounts/admin/franchise/wallet/reward-credit/", rewardForm);
      setMessage(res?.data?.detail || "Franchise reward credited.");
      setRewardForm({ username: "", amount: "", note: "" });
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to credit franchise reward.");
    } finally {
      setSaving("");
    }
  };

  const saveApproval = async () => {
    try {
      setSaving("approval");
      setError("");
      setMessage("");
      const res = await API.post("/accounts/admin/franchise/wallet/work-approvals/", approvalForm);
      setMessage(res?.data?.detail || "Work approval saved.");
      setApprovalForm((prev) => ({ ...prev, username: "", note: "" }));
      const approvalsRes = await API.get("/accounts/admin/franchise/wallet/work-approvals/", {
        params: { year: approvalForm.year, month: approvalForm.month },
      });
      setApprovals(approvalsRes?.data?.results || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to save work approval.");
    } finally {
      setSaving("");
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 0 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography sx={{ color: "#0f172a", fontWeight: 900, fontSize: { xs: "1.35rem", md: "1.75rem" } }}>
            Franchise Wallet Controls
          </Typography>
          <Typography sx={{ color: "#64748b", fontWeight: 600, fontSize: "0.92rem" }}>
            Manage inactive work withdrawal dates, reward credits, and active work approvals.
          </Typography>
        </Box>

        {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {message ? <Alert severity="success">{message}</Alert> : null}

        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={4}>
            <AdminPanelCard
              title="Withdrawal Window of Inactive Work"
              subtitle="Set the monthly date when inactive work can move into Withdrawal Wallet."
            >
              <Stack spacing={1.6}>
                <TextField
                  label="Inactive work day"
                  type="number"
                  value={settings.inactive_work_day}
                  onChange={(e) => setSettings((prev) => ({ ...prev, inactive_work_day: e.target.value }))}
                  inputProps={{ min: 1, max: 31 }}
                  sx={fieldSx}
                  fullWidth
                />
                <TextField
                  label="Window status"
                  select
                  value={settings.inactive_work_enabled ? "enabled" : "disabled"}
                  onChange={(e) => setSettings((prev) => ({ ...prev, inactive_work_enabled: e.target.value === "enabled" }))}
                  sx={fieldSx}
                  fullWidth
                >
                  <MenuItem value="enabled">Enabled</MenuItem>
                  <MenuItem value="disabled">Disabled</MenuItem>
                </TextField>
                <TextField
                  label="Reward minimum withdrawal"
                  type="number"
                  value={settings.reward_min_withdrawal}
                  onChange={(e) => setSettings((prev) => ({ ...prev, reward_min_withdrawal: e.target.value }))}
                  sx={fieldSx}
                  fullWidth
                />
                <Button
                  onClick={saveSettings}
                  disabled={saving === "settings"}
                  sx={{ borderRadius: 2, py: 1.1, bgcolor: "#2563eb", color: "#fff", fontWeight: 900, textTransform: "none", "&:hover": { bgcolor: "#1d4ed8" } }}
                >
                  {saving === "settings" ? "Saving..." : "Save Settings"}
                </Button>
              </Stack>
            </AdminPanelCard>
          </Grid>

          <Grid item xs={12} lg={4}>
            <AdminPanelCard
              title="Franchise Reward Point"
              subtitle="Credit withdrawable reward value for franchise users who do good work."
            >
              <Stack spacing={1.6}>
                <TextField
                  label="Franchise username"
                  value={rewardForm.username}
                  onChange={(e) => setRewardForm((prev) => ({ ...prev, username: e.target.value }))}
                  sx={fieldSx}
                  fullWidth
                />
                <TextField
                  label="Reward amount"
                  type="number"
                  value={rewardForm.amount}
                  onChange={(e) => setRewardForm((prev) => ({ ...prev, amount: e.target.value }))}
                  sx={fieldSx}
                  fullWidth
                />
                <TextField
                  label="Note"
                  value={rewardForm.note}
                  onChange={(e) => setRewardForm((prev) => ({ ...prev, note: e.target.value }))}
                  sx={fieldSx}
                  fullWidth
                  multiline
                  minRows={2}
                />
                <Button
                  onClick={creditReward}
                  disabled={saving === "reward" || !rewardForm.username || !rewardForm.amount}
                  sx={{ borderRadius: 2, py: 1.1, bgcolor: "#16a34a", color: "#fff", fontWeight: 900, textTransform: "none", "&:hover": { bgcolor: "#15803d" } }}
                >
                  {saving === "reward" ? "Crediting..." : "Credit Reward"}
                </Button>
              </Stack>
            </AdminPanelCard>
          </Grid>

          <Grid item xs={12} lg={4}>
            <AdminPanelCard
              title="Active Work Approval"
              subtitle="Approve the monthly work report so Active Work Wallet Pay can be enabled."
            >
              <Stack spacing={1.6}>
                <TextField
                  label="Franchise username"
                  value={approvalForm.username}
                  onChange={(e) => setApprovalForm((prev) => ({ ...prev, username: e.target.value }))}
                  sx={fieldSx}
                  fullWidth
                />
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      label="Year"
                      type="number"
                      value={approvalForm.year}
                      onChange={(e) => setApprovalForm((prev) => ({ ...prev, year: e.target.value }))}
                      sx={fieldSx}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Month"
                      type="number"
                      value={approvalForm.month}
                      onChange={(e) => setApprovalForm((prev) => ({ ...prev, month: e.target.value }))}
                      inputProps={{ min: 1, max: 12 }}
                      sx={fieldSx}
                      fullWidth
                    />
                  </Grid>
                </Grid>
                <TextField
                  label="Status"
                  select
                  value={approvalForm.status}
                  onChange={(e) => setApprovalForm((prev) => ({ ...prev, status: e.target.value }))}
                  sx={fieldSx}
                  fullWidth
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Note"
                  value={approvalForm.note}
                  onChange={(e) => setApprovalForm((prev) => ({ ...prev, note: e.target.value }))}
                  sx={fieldSx}
                  fullWidth
                />
                <Button
                  onClick={saveApproval}
                  disabled={saving === "approval" || !approvalForm.username}
                  sx={{ borderRadius: 2, py: 1.1, bgcolor: "#0f172a", color: "#fff", fontWeight: 900, textTransform: "none", "&:hover": { bgcolor: "#1e293b" } }}
                >
                  {saving === "approval" ? "Saving..." : "Save Approval"}
                </Button>
              </Stack>
            </AdminPanelCard>
          </Grid>
        </Grid>

        <AdminPanelCard
          title={`Work Approval History - ${approvalForm.month}/${approvalForm.year}`}
          subtitle="Latest approval records for the selected month."
        >
          <Stack spacing={1}>
            {approvals.length ? (
              approvals.map((row) => (
                <Stack
                  key={row.id}
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ p: 1.2, border: "1px solid #e2e8f0", borderRadius: 2, bgcolor: "#f8fafc" }}
                >
                  <Box>
                    <Typography sx={{ color: "#0f172a", fontWeight: 900 }}>{row.username}</Typography>
                    <Typography sx={{ color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>
                      {row.full_name || "No name"} {row.note ? `- ${row.note}` : ""}
                    </Typography>
                  </Box>
                  <Chip
                    label={row.status}
                    size="small"
                    sx={{
                      fontWeight: 900,
                      bgcolor: row.status === "APPROVED" ? "#dcfce7" : row.status === "REJECTED" ? "#fee2e2" : "#fef3c7",
                      color: row.status === "APPROVED" ? "#166534" : row.status === "REJECTED" ? "#991b1b" : "#92400e",
                    }}
                  />
                </Stack>
              ))
            ) : (
              <Typography sx={{ color: "#64748b", fontWeight: 700 }}>No approvals found for this period.</Typography>
            )}
          </Stack>
        </AdminPanelCard>
      </Stack>
    </Box>
  );
}
