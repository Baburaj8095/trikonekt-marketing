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
  const [me, setMe] = useState(null);

  useEffect(() => {
    // Load my profile to filter audit logs by current actor
    (async () => {
      try {
        const r = await API.get("/accounts/me/", { cacheTTL: 30000, retryAttempts: 1 });
        setMe(r?.data || null);
      } catch (_) {
        setMe(null);
      }
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    setErr("");
    let total = 0;
    let gotAny = false;
    const errors = [];

    try {
      const { start, end } = monthWindow();

      // 1) Physical coupon approvals in my scope (role-aware by server)
      try {
        const subRes = await API.get("/coupons/submissions/", { params: { page_size: 500 }, retryAttempts: 1 });
        const subList = Array.isArray(subRes.data) ? subRes.data : (subRes.data?.results || []);
        const approvedSubs = (subList || []).filter(
          (s) =>
            String(s.status || "").toUpperCase() === "AGENCY_APPROVED" &&
            inMonthRange(s.agency_reviewed_at || s.created_at, start, end)
        );
        total += approvedSubs.length;
        if (approvedSubs.length > 0) gotAny = true;
      } catch (e1) {
        errors.push(e1?.response?.data?.detail || e1?.message || "submissions failed");
      }

      // 2) E‑coupon sales this month via AuditTrail, filtered to current actor
      const myId = me?.id;
      if (myId && (role === "agency" || role === "employee")) {
        const fromISO = start.toISOString();
        const toISO = end.toISOString();
        const actionCount = role === "agency" ? "agency_assigned_consumer_by_count" : "employee_assigned_consumer_by_count";

        const reqs = [
          API.get("/coupons/audits/", {
            params: { action: actionCount, date_from: fromISO, date_to: toISO, page_size: 500 },
            retryAttempts: 1,
          }),
          API.get("/coupons/audits/", {
            params: { action: "assigned_to_consumer", date_from: fromISO, date_to: toISO, page_size: 500 },
            retryAttempts: 1,
          }),
        ];

        const settled = await Promise.allSettled(reqs);
        let localAdded = 0;
        settled.forEach((res, idx) => {
          if (res.status === "fulfilled") {
            const data = res.value?.data;
            const list = Array.isArray(data) ? data : (data?.results || []);
            const mine = (list || []).filter((r) => {
              const a = typeof r.actor === "object" ? (r.actor?.id ?? r.actor_id) : (r.actor ?? r.actor_id);
              return Number(a) === Number(myId);
            });
            if (idx === 0) {
              // grouped count
              localAdded += mine.reduce((acc, r) => acc + (Number(r?.metadata?.count) || 0), 0);
            } else {
              // single assignment entries
              localAdded += mine.length;
            }
          } else {
            const e2 = res.reason;
            errors.push(e2?.response?.data?.detail || e2?.message || "audits failed");
          }
        });
        total += localAdded;
        if (localAdded > 0) gotAny = true;
      }
    } catch (e) {
      errors.push(e?.response?.data?.detail || e?.message || "unknown error");
    }

    setCountApproved(total);
    if (!gotAny && errors.length) {
      //setErr("Failed to load monthly progress.");
    }
    setLoading(false);
  };

  useEffect(() => {
    // Wait for profile for accurate audit attribution; still load if not available
    load();
  }, [role, me?.id]);


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
