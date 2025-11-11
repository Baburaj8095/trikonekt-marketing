import React from "react";
import { Box, Typography } from "@mui/material";
import ReferAndEarn from "../components/ReferAndEarn";

export default function ReferAndEarnPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <ReferAndEarn title="Refer & Earn" onlyConsumer />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Share your consumer referral link to invite others.
      </Typography>
    </Box>
  );
}
