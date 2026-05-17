import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";

const WORKFLOWS = {
  "franchise-reference-reward": {
    title: "Franchise Reference Reward",
    description: "Validate a consumer username, then credit the Franchise Reference Reward box in the consumer Team Wallet.",
    status: "Live wallet credit",
    rewardType: "franchise_reference",
    links: [
      { to: "/admin/reward-distribution", label: "Reward Distribution" },
      { to: "/admin/wallet-ledger", label: "Ledger" },
    ],
  },
  "zonal-reward": {
    title: "Zonal Reward",
    description: "Validate a consumer username, then credit the Zonal Reward box in the consumer Team Wallet.",
    status: "Live wallet credit",
    rewardType: "zonal",
    links: [
      { to: "/admin/reward-distribution", label: "Reward Distribution" },
      { to: "/admin/team-wallet-dashboard", label: "Team Wallet" },
    ],
  },
  "redeem-point-coupon-summary": {
    title: "Redeem Point Coupon Summary",
    description: "Summary entry for redeem-point coupon visibility. Existing reward points and voucher reports remain available below.",
    status: "Linked workflow",
    links: [
      { to: "/admin/rewards/points", label: "Reward Points" },
      { to: "/admin/wallet-vouchers", label: "Coupon Summary" },
      { to: "/admin/wallet-ledger", label: "Ledger" },
    ],
  },
  "social-media-links": {
    title: "Social Media Links",
    description: "Configuration checklist for WhatsApp, YouTube, Instagram, Facebook, and other public links.",
    status: "Configuration shell",
    fields: [
      { name: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/..." },
      { name: "youtube", label: "YouTube", placeholder: "https://youtube.com/..." },
      { name: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
      { name: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
      { name: "other", label: "Other", placeholder: "https://..." },
    ],
    links: [{ to: "/admin/ui-config", label: "UI Configuration" }],
  },
  "tree-toggle": {
    title: "Tree",
    description: "On/off control placeholder for tree visibility. Existing genealogy and matrix screens are linked below.",
    status: "Toggle shell",
    toggle: true,
    links: [
      { to: "/admin/user-tree", label: "Genealogy" },
      { to: "/admin/matrix/five", label: "Five Matrix" },
      { to: "/admin/matrix/three", label: "Three Matrix" },
    ],
  },
  "team-admin-board": {
    title: "Team Admin Board",
    description: "Board view/edit entry for team consumer details. Existing users and team wallet analytics remain the source screens.",
    status: "Linked workflow",
    links: [
      { to: "/admin/users?category=consumer", label: "Team Consumers" },
      { to: "/admin/team-wallet-dashboard", label: "Team Wallet Dashboard" },
      { to: "/admin/team-consumer/top-achievers", label: "Team Achievers" },
    ],
  },
  "generate-coupon": {
    title: "Generate Coupon",
    description: "Coupon generation entry for Trizone, Near Store, Online, and Package Purchase coupons. Existing voucher maintenance is linked.",
    status: "Workflow shell",
    fields: [
      { name: "coupon_type", label: "Coupon Type", select: ["Trizone", "Near Store", "Online", "Package Purchase"] },
      { name: "user_id", label: "User ID / Phone", placeholder: "Enter receiver" },
      { name: "amount", label: "Amount", type: "number", placeholder: "0.00" },
    ],
    links: [{ to: "/admin/wallet-vouchers", label: "Coupon Summary" }],
  },
  "crm-connect": {
    title: "CRM Connect",
    description: "CRM connection entry point. Existing user, merchant, support, and reports screens remain intact.",
    status: "Linked workflow",
    links: [
      { to: "/admin/users", label: "Users" },
      { to: "/admin/merchants", label: "Merchants" },
      { to: "/admin/support", label: "Support" },
      { to: "/admin/reports", label: "Reports" },
    ],
  },
  "ecommerce-digital-education-frontpage": {
    title: "E-Commerce / Digital Education Front Page",
    description: "Front-page management entry for digital education/e-commerce content.",
    status: "Linked workflow",
    links: [
      { to: "/admin/ui-config", label: "UI Configuration" },
      { to: "/admin/home-cards", label: "Home Cards" },
      { to: "/admin/team-consumer/educational-videos", label: "Educational Videos" },
    ],
  },
};

function initialForm(fields = []) {
  return fields.reduce((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});
}

function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export default function AdminWorkflowScreen() {
  const { slug } = useParams();
  const config = WORKFLOWS[slug] || {
    title: "Admin Workflow",
    description: "This admin workflow has not been configured yet.",
    status: "Missing config",
    links: [{ to: "/admin/dashboard", label: "Dashboard" }],
  };
  const fields = config.fields || [];
  const [form, setForm] = useState(() => initialForm(fields));
  const [enabled, setEnabled] = useState(true);
  const [notice, setNotice] = useState("");
  const [rewardForm, setRewardForm] = useState({ username: "", amount: "", note: "" });
  const [consumer, setConsumer] = useState(null);
  const [rewardError, setRewardError] = useState("");
  const [rewardSuccess, setRewardSuccess] = useState("");
  const [validating, setValidating] = useState(false);
  const [submittingReward, setSubmittingReward] = useState(false);

  const hasFields = fields.length > 0;
  const isRewardWorkflow = !!config.rewardType;
  const summary = useMemo(
    () => fields.map((field) => `${field.label}: ${form[field.name] || "-"}`).join(" | "),
    [fields, form]
  );

  useEffect(() => {
    setRewardForm({ username: "", amount: "", note: "" });
    setConsumer(null);
    setRewardError("");
    setRewardSuccess("");
  }, [slug]);

  const validateConsumer = async () => {
    const username = rewardForm.username.trim();
    setRewardError("");
    setRewardSuccess("");
    setConsumer(null);
    if (!username) {
      setRewardError("Enter consumer username first.");
      return;
    }
    setValidating(true);
    try {
      const res = await API.get("adminapi/rewards/team/validate-consumer/", { params: { username } });
      setConsumer(res?.data?.consumer || null);
    } catch (err) {
      setRewardError(err?.response?.data?.detail || "Consumer username validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const submitReward = async () => {
    setRewardError("");
    setRewardSuccess("");
    const username = rewardForm.username.trim();
    if (!consumer) {
      setRewardError("Validate the consumer username before submitting reward.");
      return;
    }
    if (!rewardForm.amount || Number(rewardForm.amount) <= 0) {
      setRewardError("Enter a reward amount greater than 0.");
      return;
    }
    setSubmittingReward(true);
    try {
      const res = await API.post("adminapi/rewards/team/credit/", {
        username,
        amount: rewardForm.amount,
        note: rewardForm.note,
        reward_type: config.rewardType,
      });
      setRewardSuccess(res?.data?.detail || "Reward credited successfully.");
      setConsumer(res?.data?.consumer || consumer);
      setRewardForm((prev) => ({ ...prev, amount: "", note: "" }));
    } catch (err) {
      setRewardError(err?.response?.data?.detail || "Reward credit failed.");
    } finally {
      setSubmittingReward(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1200, mx: "auto" }}>
      <Stack spacing={2}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>
              {config.title}
            </Typography>
            <Chip size="small" label={config.status} />
          </Stack>
          <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.75 }}>{config.description}</Typography>
        </Box>

        {notice ? <Alert severity="info">{notice}</Alert> : null}

        {config.toggle ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>Enable Tree</Typography>
                <Typography sx={{ color: "#64748b", fontSize: 13 }}>UI state only until backend persistence is connected.</Typography>
              </Box>
              <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </Stack>
          </Paper>
        ) : null}

        {isRewardWorkflow ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={2}>
              {rewardError ? <Alert severity="error">{rewardError}</Alert> : null}
              {rewardSuccess ? <Alert severity="success">{rewardSuccess}</Alert> : null}

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) auto" }, gap: 1.5, alignItems: "end" }}>
                <TextField
                  label="Consumer Username"
                  value={rewardForm.username}
                  placeholder="Enter consumer username"
                  size="small"
                  fullWidth
                  onChange={(e) => {
                    setRewardForm((prev) => ({ ...prev, username: e.target.value }));
                    setConsumer(null);
                    setRewardSuccess("");
                    setRewardError("");
                  }}
                />
                <Button
                  variant="contained"
                  onClick={validateConsumer}
                  disabled={validating}
                  sx={{ textTransform: "none", fontWeight: 800, minWidth: 170 }}
                >
                  {validating ? <CircularProgress size={18} color="inherit" /> : "Validate Consumer"}
                </Button>
              </Box>

              {consumer ? (
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc" }}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>{consumer.full_name || consumer.username}</Typography>
                      <Typography sx={{ color: "#64748b", fontSize: 13 }}>
                        {consumer.username} {consumer.prefixed_id ? `| ${consumer.prefixed_id}` : ""} {consumer.phone ? `| ${consumer.phone}` : ""}
                      </Typography>
                    </Box>
                    <Chip label="Validated consumer" color="success" variant="outlined" />
                  </Stack>
                </Paper>
              ) : null}

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px 1fr" }, gap: 1.5 }}>
                <TextField
                  label="Reward Amount"
                  type="number"
                  value={rewardForm.amount}
                  placeholder="0.00"
                  disabled={!consumer}
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, step: "0.01" }}
                  onChange={(e) => setRewardForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
                <TextField
                  label="Note"
                  value={rewardForm.note}
                  placeholder="Optional admin note"
                  disabled={!consumer}
                  size="small"
                  fullWidth
                  onChange={(e) => setRewardForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </Box>

              <Divider />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <Button
                  variant="contained"
                  onClick={submitReward}
                  disabled={!consumer || submittingReward}
                  sx={{ textTransform: "none", fontWeight: 800, minWidth: 150 }}
                >
                  {submittingReward ? <CircularProgress size={18} color="inherit" /> : "Submit Reward"}
                </Button>
                {rewardForm.amount ? (
                  <Typography sx={{ color: "#64748b", fontSize: 13 }}>
                    Amount to credit: Rs. {money(rewardForm.amount)}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
          </Paper>
        ) : hasFields ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 1.5 }}>
              {fields.map((field) => (
                <TextField
                  key={field.name}
                  select={!!field.select}
                  label={field.label}
                  type={field.type || "text"}
                  value={form[field.name] || ""}
                  disabled={!!field.disabled}
                  placeholder={field.placeholder || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  size="small"
                  fullWidth
                >
                  {(field.select || []).map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="contained"
                onClick={() => setNotice(`Draft captured locally. Connect API save for: ${summary || config.title}`)}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                Submit Draft
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setForm(initialForm(fields));
                  setNotice("");
                }}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                Clear
              </Button>
            </Stack>
          </Paper>
        ) : null}

        {Array.isArray(config.links) && config.links.length ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>Related Existing Screens</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
              {config.links.map((link) => (
                <Button key={link.to} component={Link} to={link.to} variant="outlined" sx={{ textTransform: "none", fontWeight: 800 }}>
                  {link.label}
                </Button>
              ))}
            </Stack>
          </Paper>
        ) : null}
      </Stack>
    </Box>
  );
}
