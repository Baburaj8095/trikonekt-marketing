import React from "react";
import { Box, Paper, Typography, Button, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function CheckoutSuccess() {
  const navigate = useNavigate();

  const role = (() => {
    try {
      const p = window.location.pathname;
      if (p.startsWith("/agency")) return "agency";
      if (p.startsWith("/employee")) return "employee";
      return "user";
    } catch {
      return "user";
    }
  })();

  const goToOrders = () => {
    try {
      if (role === "agency") navigate("/agency/history", { replace: true });
      else if (role === "employee") navigate("/employee/history", { replace: true });
      else navigate("/user/my-orders", { replace: true });
    } catch {}
  };

  const goToStore = () => {
    try {
      if (role === "agency") navigate("/agency/e-coupon-store", { replace: true });
      else if (role === "employee") navigate("/employee/e-coupon-store", { replace: true });
      else navigate("/user/e-coupon-store", { replace: true });
    } catch {}
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 4 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
          maxWidth: 720,
          mx: "auto",
          textAlign: "center",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0C2D48", mb: 1 }}>
          Payment Submitted. Waiting for Admin Confirmation.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your order has been created with pending status. We will notify you once the admin has verified your payment.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="center">
          <Button variant="contained" onClick={goToOrders} sx={{ textTransform: "none", fontWeight: 800 }}>
            View My Orders
          </Button>
          <Button variant="outlined" onClick={goToStore} sx={{ textTransform: "none", fontWeight: 700 }}>
            Continue Shopping
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
