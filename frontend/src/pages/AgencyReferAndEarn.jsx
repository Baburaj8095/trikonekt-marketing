import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import ReferAndEarn from "../components/ReferAndEarn";

export default function AgencyReferAndEarn() {
  // Prefer namespaced storage for agency
  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_agency") || sessionStorage.getItem("user_agency");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);

  const sponsorUsername =
    (storedUser && storedUser.username) ||
    (storedUser && storedUser.user && storedUser.user.username) ||
    "";

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <ReferAndEarn title="Refer & Earn" sponsorUsername={sponsorUsername} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Share your referral links to invite Consumers, Employees, or Sub‑Franchise agencies. Sponsor ID will be auto-filled.
      </Typography>
    </Box>
  );
}
