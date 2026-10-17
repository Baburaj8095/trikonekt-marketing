import React from "react";
import { Box, Button, Card, CardContent, Typography, Stack } from "@mui/material";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { TRIEDUCATION_REGISTER_URL } from "../../utils/growthProductionGuard";

export default function GrowthRegistrationDisabledNotice() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#0F172A",
        p: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 480,
          width: "100%",
          borderRadius: 4,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
          bgcolor: "#1E293B",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "#fff",
          textAlign: "center",
          p: { xs: 2, sm: 3 },
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              bgcolor: "rgba(59, 130, 246, 0.15)",
              color: "#60A5FA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <SchoolOutlinedIcon sx={{ fontSize: 36 }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1, letterSpacing: "-0.02em" }}>
            Trikonekt Academy Onboarding
          </Typography>

          <Typography sx={{ color: "#94A3B8", fontSize: 14, mb: 3, lineHeight: 1.6 }}>
            Direct member registrations on <strong>growth.vin</strong> are discontinued. All new student and agent memberships are registered and activated through <strong>trieducation.in</strong>.
          </Typography>

          <Stack spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              href={TRIEDUCATION_REGISTER_URL}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                bgcolor: "#2563EB",
                "&:hover": { bgcolor: "#1D4ED8" },
                fontWeight: 800,
                py: 1.5,
                borderRadius: 2.5,
                textTransform: "none",
                fontSize: 15,
              }}
            >
              Continue to trieducation.in
            </Button>

            <Button
              variant="outlined"
              size="large"
              href="/login"
              startIcon={<LockOutlinedIcon />}
              sx={{
                borderColor: "rgba(255, 255, 255, 0.2)",
                color: "#E2E8F0",
                "&:hover": { borderColor: "rgba(255, 255, 255, 0.4)", bgcolor: "rgba(255, 255, 255, 0.05)" },
                fontWeight: 700,
                py: 1.25,
                borderRadius: 2.5,
                textTransform: "none",
                fontSize: 14,
              }}
            >
              Existing Member? Log In
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
