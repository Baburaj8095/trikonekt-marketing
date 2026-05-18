import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";

const TITLES = {
  "/admin/franchise/monthly-entry-report": "Monthly Entry Report",
  "/admin/franchise/scanner-forms": "Customer Shopping Scanner Forms",
  "/admin/franchise/profile": "Franchise Profile",
  "/admin/franchise/register": "Franchise Register Form",
  "/admin/franchise/agreement": "Generate Agreement",
  "/admin/franchise/id-card": "Generate ID Card",
  "/admin/franchise/banners": "Franchise Banners",
  "/admin/franchise/pdfs": "Trikonekt PDF",
  "/admin/franchise/customer-care": "Customer Care Chat",
};

export default function AdminFranchisePlaceholder() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "Franchise Module";

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 980, mx: "auto" }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
        <Stack spacing={1.5}>
          <Chip label="Franchise workspace" sx={{ alignSelf: "flex-start" }} />
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>{title}</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 14 }}>
            This route is reserved inside the new Franchise Admin shell. It keeps the dashboard navigation stable while the module-specific form, report, upload, or chat workflow is connected.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button component={Link} to="/admin/franchise/dashboard" variant="contained">Dashboard</Button>
            <Button component={Link} to="/admin/franchise/users" variant="outlined">Franchise Users</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
