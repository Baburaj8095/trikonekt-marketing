import React, { useEffect, useState } from "react";
import { Paper, Typography, Box, Stack, LinearProgress, Alert } from "@mui/material";
import API from "../api/api";

function monthWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
  return { start, end };
}

function inMonthRange(dtStr, start, end) {
  if (!dtStr) return false;
  const d = new Date(dtStr);
  return d >= start && d <= end;
}

function TargetRow({ label, value, target }) {
  const v = Number(value || 0);
  const t = Number(target || 0);
  const pct = Math.max(0, Math.min(100, t > 0 ? (v / t) * 100 : 0));
  const remaining = Math.max(0, t - v);
  return (
    <Box sx={{ mb: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="body2" color="text.secondary">{v} of {t} (remaining {remaining})</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
    </Box>
  );
}

export default function RewardsTargetCard({ role = "employee" }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [countApproved, setCountApproved] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      // This endpoint is role-aware via server queryset:
      // - Employee: returns submissions for codes/coupons assigned to me
      // - Agency: returns submissions in my pincode
      const res = await API.get("/coupons/submissions/");
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const { start, end } = monthWindow();
      const approved = (list || []).filter((s) =>
        String(s.status || "").toUpperCase() === "AGENCY_APPROVED" &&
        inMonthRange(s.agency_reviewed_at || s.created_at, start, end)
      );
      setCountApproved(approved.length);
    } catch (e) {
      setErr("Failed to load monthly progress.");
      setCountApproved(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
          My Rewards Target (Monthly)
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Role: {role}
        </Typography>
      </Stack>

      {err ? <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert> : null}
      {loading ? <Typography variant="body2">Loading...</Typography> : (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Approved sales this month: {countApproved}
          </Alert>
          <TargetRow label="600 — Resort Trip / Mobile Fund" value={countApproved} target={600} />
          <TargetRow label="1500 — Bike Fund" value={countApproved} target={1500} />
          <TargetRow label="2800 — Thailand Trip" value={countApproved} target={2800} />
        </Box>
      )}
    </Paper>
  );
}
