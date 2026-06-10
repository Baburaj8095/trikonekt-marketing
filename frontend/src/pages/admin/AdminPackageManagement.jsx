import React from "react";
import { Link } from "react-router-dom";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";

function PackageCard({ title, body, to }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Typography sx={{ fontWeight: 950 }}>{title}</Typography>
      <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.75, minHeight: 40 }}>{body}</Typography>
      <Button component={Link} to={to} variant="outlined" size="small" sx={{ mt: 1, textTransform: "none", fontWeight: 800 }}>
        Open Queue
      </Button>
    </Paper>
  );
}

export default function AdminPackageManagement() {
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1280, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Package Management</Typography>
      <Typography sx={{ color: "#64748b", fontSize: 13, mb: 2 }}>
        Unified admin entry for package purchase verification while keeping existing package-specific approval logic intact.
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 1.5 }}>
        <PackageCard title="Join Subscription Packages" body="Approve subscription package purchases and payment proof using the existing approval queue." to="/admin/packages/join-subscription" />
        <PackageCard title="Promo Package Setup" body="Create/edit Join Prime, SPP, Digital Education, and Tri Tour Prime promo packages with price and active status." to="/admin/dashboard/models/business/promopackage" />
        <PackageCard title="Smart Product Packages (SPP)" body="Approve SPP and monthly package activity with sponsor/package context." to="/admin/packages/spp" />
        <PackageCard title="SPP Seasons" body="Create SPP 1, SPP 2, Season 3, and control how many monthly boxes each season contains." to="/admin/packages/spp-seasons" />
        <PackageCard title="Prime Education Packages" body="Monitor Prime Education package approvals through the shared promo purchase workflow." to="/admin/promo-purchases?status=PENDING" />
        <PackageCard title="Tour Packages" body="Review Tri Tour package purchase verification and payment proof." to="/admin/packages/tri-tour" />
        <PackageCard title="Rank Upgrades" body="Track wallet-paid rank upgrades and commission holds." to="/admin/rank-upgrades" />
        <PackageCard title="Ledger: Join Prime" body="Approved Join Prime purchase list with user, sponsor, amount, and payment status." to="/admin/ledger/join-prime" />
        <PackageCard title="Ledger: SPP" body="Approved SPP purchase list with season/package number and selected boxes or months." to="/admin/ledger/spp" />
        <PackageCard title="Ledger: Digital Education" body="Successful Digital Education Prime and rank upgrade purchase list." to="/admin/ledger/digital-education" />
        <PackageCard title="Ledger: Tri Tour" body="Approved Tri Tour trip purchase list with selected trip metadata." to="/admin/ledger/tri-tour" />
        <PackageCard title="Wallet Upload Approvals" body="Credit Self Package Pocket after manual payment proof verification." to="/admin/wallet-upload-approvals" />
      </Box>
    </Box>
  );
}
