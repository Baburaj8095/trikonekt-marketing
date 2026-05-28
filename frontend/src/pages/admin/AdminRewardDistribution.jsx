import React from "react";
import { Link } from "react-router-dom";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";

function FlowCard({ title, body, to }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
      <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.75 }}>{body}</Typography>
      <Button component={Link} to={to} variant="outlined" size="small" sx={{ mt: 1, textTransform: "none", fontWeight: 800 }}>
        Open
      </Button>
    </Paper>
  );
}

export default function AdminRewardDistribution() {
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1280, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Reward Distribution</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Admin workflow hub for income, matrix earnings, sponsor income, reward points, rebirth, and commission settlement.
          </Typography>
        </Box>
        <Button component={Link} to="/admin/team-wallet-dashboard" variant="contained">Team Analytics</Button>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <FlowCard title="Commission Distribute" body="Run or review commission distribution workflows." to="/admin/commissions/distribute" />
        <FlowCard title="Commission History" body="Search earned, paid, and reversed commission records." to="/admin/commissions/history" />
        <FlowCard title="Matrix Income Monitoring" body="Monitor matrix earnings and transaction totals." to="/admin/matrix/five" />
        <FlowCard title="Auto Commission" body="Review auto pool related credits and wallet impact." to="/admin/autopool" />
        <FlowCard title="Reward Points" body="Configure and audit rewards points logic." to="/admin/rewards/points" />
        <FlowCard title="Rebirth Tracking" body="Track self rebirth and shopping reward exposure through Team Wallet analytics." to="/admin/team-wallet-dashboard" />
      </Box>
    </Box>
  );
}
