import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/CurrencyRupeeRounded";
import { green } from "@mui/material/colors";

export default function PromoPackageCard({ pkg, onPurchase, userMainWalletBalance = 0 }) {
  const canAfford = userMainWalletBalance >= pkg.price;

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 4,
        border: "1px solid #E2E8F0",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Chip
            label={pkg.package_type === "PRIME" ? "Prime" : pkg.package_type}
            size="small"
            sx={{
              bgcolor: "#0C2D48",
              color: "#fff",
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: 11,
              height: 20,
            }}
          />
          {pkg.is_subscription ? (
            <Chip
              label="Subscription"
              size="small"
              sx={{
                bgcolor: "#F0F8FF",
                color: "#145DA0",
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: 11,
                height: 20,
              }}
            />
          ) : null}
        </Stack>

        <Typography variant="h6" sx={{ fontWeight: 800, color: "#0C2D48", mb: 1 }}>
          {pkg.name}
        </Typography>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1.5 }}>
          <CurrencyRupeeRoundedIcon sx={{ fontSize: 20, color: "#145DA0" }} />
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#145DA0" }}>
            {pkg.price}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            INR
          </Typography>
        </Stack>

        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {pkg.description}
        </Typography>

        <Stack spacing={1} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, color: green[500] }} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Instant Activation
            </Typography>
          </Stack>
          {pkg.max_coupon_redemptions > 0 ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, color: green[500] }} />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {pkg.max_coupon_redemptions} Coupon Redemptions
              </Typography>
            </Stack>
          ) : null}
          {pkg.is_subscription && pkg.valid_for_months > 0 ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, color: green[500] }} />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Valid for {pkg.valid_for_months} Months
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>

      <Box sx={{ p: { xs: 2, sm: 3 }, pt: 0 }}>
        <Divider sx={{ mb: 2 }} />
        <Button
          variant="contained"
          fullWidth
          sx={{ textTransform: "none", borderRadius: 2, fontWeight: 700 }}
          onClick={() => onPurchase(pkg.id)}
          disabled={!canAfford}
        >
          {canAfford ? "Purchase Now" : `Insufficient Wallet Balance (Need ${pkg.price - userMainWalletBalance} more)`}
        </Button>
      </Box>
    </Card>
  );
}
