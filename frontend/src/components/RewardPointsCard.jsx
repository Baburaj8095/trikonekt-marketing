import React, { useEffect, useState } from "react";
import { Paper, Box, Stack, Typography, LinearProgress, Alert, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getRewardPointsSummary } from "../api/api";

export default function RewardPointsCard({ compact = false }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await getRewardPointsSummary();
      setData(res || null);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load reward points.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const points = Number((data?.available ?? data?.current_points) || 0);
  const count = Number(data?.activated_coupon_count || 0);
  const nextTarget = Number(data?.next_target_count || 0);
  const nextPoints = Number(data?.points_at_next_target || 0);
  const pct = Number(data?.progress_percentage || 0);

  if (compact) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
          boxShadow: 1,
        }}
      >
        {err ? (
          <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>
        ) : null}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Reward Points
          </Typography>
          <Button size="small" variant="outlined" onClick={() => navigate("/user/promo-packages")} sx={{ textTransform: "none" }}>
            Buy Coupons
          </Button>
        </Stack>
        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading...</Typography>
        ) : (
          <>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
              ₹{points.toLocaleString("en-IN")}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Activated coupons: {count}
            </Typography>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 6, mb: 0.75 }} />
            <Typography variant="caption" color="text.secondary">
              Next milestone: {nextTarget} coupons → ₹{nextPoints.toLocaleString("en-IN")}
            </Typography>
          </>
        )}
      </Box>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      {err ? (
        <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>
      ) : null}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
          Reward Points
        </Typography>
        <Button size="small" variant="outlined" onClick={() => navigate("/user/promo-packages")} sx={{ textTransform: "none" }}>
          Buy Coupons
        </Button>
      </Stack>
      {loading ? (
        <Typography variant="body2">Loading...</Typography>
      ) : (
        <Box>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Available (₹)
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              ₹{points.toLocaleString("en-IN")}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">Activated coupons</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{count}</Typography>
            </Box>
            <Box sx={{ flex: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Progress to next milestone: {nextTarget} coupons → ₹{nextPoints.toLocaleString("en-IN")}
              </Typography>
              <LinearProgress variant="determinate" value={pct} sx={{ height: 10, borderRadius: 6, mt: 0.5 }} />
            </Box>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
