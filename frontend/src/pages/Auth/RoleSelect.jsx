import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import StoreIcon from "@mui/icons-material/Store";
import WorkIcon from "@mui/icons-material/Work";
import BusinessIcon from "@mui/icons-material/Business";
import LOGO from "../../assets/TRIKONEKT.png";

const RoleCard = ({ icon, title, desc, onLogin, onRegister, colors, loginDisabled = false }) => (
  <Card
    elevation={4}
    sx={{
      height: "100%",
      width: "100%",
      flex: 1,
      display: "flex",
      flexDirection: "column",
      borderRadius: 3,
      overflow: "hidden",
      background: `linear-gradient(135deg, ${colors.bg1} 0%, ${colors.bg2} 100%)`,
      color: colors.fg,
      boxShadow: `0 10px 24px ${colors.shadow}`,
      border: `1px solid ${colors.border}`,
    }}
  >
    <Box
      sx={{
        px: 2,
        py: 1.25,
        display: "flex",
        alignItems: "center",
        gap: 1,
        background: colors.header,
        color: colors.headerFg,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: "12px",
          background: colors.badgeBg,
          color: colors.badgeFg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 6px 14px ${colors.badgeShadow}`,
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
    </Box>

    <CardContent sx={{ flexGrow: 1, background: "rgba(255,255,255,0.08)" }}>
      <Typography variant="body2" sx={{ color: colors.bodyFg }}>
        {desc}
      </Typography>
    </CardContent>

    <CardActions sx={{ p: 2, pt: 0, gap: 1, background: "rgba(255,255,255,0.06)" }}>
      <Button
        onClick={onLogin}
        variant="outlined"
        disabled={loginDisabled || !onLogin}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          borderColor: colors.ctaBorder,
          color: colors.ctaBorder,
          "&:hover": { borderColor: colors.ctaBorder, background: "rgba(255,255,255,0.15)" },
        }}
      >
        Login
      </Button>
      <Button
        onClick={onRegister}
        variant="contained"
        sx={{
          textTransform: "none",
          fontWeight: 700,
          background: colors.ctaBg,
          color: colors.ctaFg,
          boxShadow: `0 8px 18px ${colors.ctaShadow}`,
          "&:hover": { background: colors.ctaBgHover, boxShadow: `0 10px 22px ${colors.ctaShadow}` },
        }}
      >
        Register
      </Button>
    </CardActions>
  </Card>
);

export default function RoleSelect() {
  const navigate = useNavigate();

  // Preserve sponsor param (if provided in the URL) when going to Register
  const sponsorQuery = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sponsor =
        params.get("sponsor") ||
        params.get("sponsor_id") ||
        params.get("agencyid") ||
        params.get("ref");
      return sponsor ? `&sponsor=${encodeURIComponent(sponsor)}` : "";
    } catch {
      return "";
    }
  }, []);

  const buildUrl = (role, mode) => `/login?mode=${mode}&role=${role}${mode === "register" ? sponsorQuery : ""}`;

  const palette = {
    consumer: {
      bg1: "#E3F2FD",
      bg2: "#F1F8FF",
      fg: "#0C2D48",
      shadow: "rgba(12,45,72,0.08)",
      border: "rgba(25,118,210,0.25)",
      header: "linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)",
      headerFg: "#fff",
      badgeBg: "#fff",
      badgeFg: "#1976d2",
      badgeShadow: "rgba(25,118,210,0.25)",
      bodyFg: "rgba(12,45,72,0.9)",
      ctaBorder: "#ffffff",
      ctaBg: "linear-gradient(90deg,#1976d2 0%,#42a5f5 100%)",
      ctaBgHover: "linear-gradient(90deg,#1565c0 0%,#1e88e5 100%)",
      ctaFg: "#fff",
      ctaShadow: "rgba(25,118,210,0.28)",
    },
    employee: {
      bg1: "#E8F5E9",
      bg2: "#F3FBF4",
      fg: "#0C2D48",
      shadow: "rgba(46,125,50,0.08)",
      border: "rgba(46,125,50,0.25)",
      header: "linear-gradient(90deg, #2e7d32 0%, #66bb6a 100%)",
      headerFg: "#fff",
      badgeBg: "#fff",
      badgeFg: "#2e7d32",
      badgeShadow: "rgba(46,125,50,0.25)",
      bodyFg: "rgba(12,45,72,0.9)",
      ctaBorder: "#ffffff",
      ctaBg: "linear-gradient(90deg,#2e7d32 0%,#66bb6a 100%)",
      ctaBgHover: "linear-gradient(90deg,#1b5e20 0%,#43a047 100%)",
      ctaFg: "#fff",
      ctaShadow: "rgba(46,125,50,0.28)",
    },
    agency: {
      bg1: "#FFF3E0",
      bg2: "#FFF8E7",
      fg: "#0C2D48",
      shadow: "rgba(255,111,0,0.12)",
      border: "rgba(255,111,0,0.25)",
      header: "linear-gradient(90deg, #fb8c00 0%, #ffb74d 100%)",
      headerFg: "#442B00",
      badgeBg: "#fff",
      badgeFg: "#e65100",
      badgeShadow: "rgba(255,152,0,0.3)",
      bodyFg: "rgba(12,45,72,0.9)",
      ctaBorder: "#442B00",
      ctaBg: "linear-gradient(90deg,#fb8c00 0%,#ffb74d 100%)",
      ctaBgHover: "linear-gradient(90deg,#f57c00 0%,#ffa726 100%)",
      ctaFg: "#442B00",
      ctaShadow: "rgba(255,152,0,0.28)",
    },
    business: {
      bg1: "#F3E5F5",
      bg2: "#F8EAF6",
      fg: "#2A1535",
      shadow: "rgba(156,39,176,0.12)",
      border: "rgba(156,39,176,0.25)",
      header: "linear-gradient(90deg, #8e24aa 0%, #ba68c8 100%)",
      headerFg: "#fff",
      badgeBg: "#fff",
      badgeFg: "#8e24aa",
      badgeShadow: "rgba(142,36,170,0.25)",
      bodyFg: "rgba(42,21,53,0.9)",
      ctaBorder: "#ffffff",
      ctaBg: "linear-gradient(90deg,#8e24aa 0%,#ba68c8 100%)",
      ctaBgHover: "linear-gradient(90deg,#7b1fa2 0%,#ab47bc 100%)",
      ctaFg: "#fff",
      ctaShadow: "rgba(142,36,170,0.28)",
    },
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 20% 10%, rgba(25,118,210,0.12), transparent 40%), radial-gradient(circle at 80% 20%, rgba(76,175,80,0.12), transparent 45%), radial-gradient(circle at 50% 90%, rgba(255,152,0,0.12), transparent 40%), linear-gradient(135deg,#f7fbff 0%,#ffffff 70%)",
      }}
    >
      <Box
        component="header"
        sx={{
          py: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <img src={LOGO} alt="Trikonekt" style={{ height: 44, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" }} />
      </Box>

      <Container maxWidth="lg" sx={{ pb: 6 }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: "#0C2D48", letterSpacing: 0.2 }}>
            Choose your account
          </Typography>
          <Typography variant="body1" sx={{ color: "rgba(12,45,72,0.75)", mt: 0.75 }}>
            Continue with Login or create a new account with Register
          </Typography>
        </Box>

        <Grid container spacing={2.5} alignItems="stretch">
          <Grid item xs={12} sm={6} md={3} sx={{ display: "flex", minWidth: 0, width: "100%" }}>
            <RoleCard
              icon={<PersonIcon />}
              title="Consumer"
              desc="Earn rewards and redeem e‑coupons."
              onLogin={() => navigate(buildUrl("user", "login"))}
              onRegister={() => navigate(buildUrl("user", "register"))}
              colors={palette.consumer}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3} sx={{ display: "flex", minWidth: 0, width: "100%" }}>
            <RoleCard
              icon={<WorkIcon />}
              title="Employee"
              desc="Review submissions and manage e‑coupons."
              onLogin={() => navigate(buildUrl("employee", "login"))}
              onRegister={() => navigate(buildUrl("employee", "register"))}
              colors={palette.employee}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3} sx={{ display: "flex", minWidth: 0, width: "100%" }}>
            <RoleCard
              icon={<StoreIcon />}
              title="Agency"
              desc="Manage quotas, team and approvals."
              onLogin={() => navigate(buildUrl("agency", "login"))}
              onRegister={() => navigate(buildUrl("agency", "register"))}
              colors={palette.agency}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3} sx={{ display: "flex", minWidth: 0, width: "100%" }}>
            <RoleCard
              icon={<BusinessIcon />}
              title="Business"
              desc="Register your business; login is disabled."
              onRegister={() => navigate(buildUrl("business", "register"))}
              colors={palette.business}
              loginDisabled={true}
            />
          </Grid>
        </Grid>

        <Box sx={{ textAlign: "center", mt: 4, color: "#475569" }}>
          <Typography variant="caption">
            Have a referral link? Open it directly to prefill sponsor during registration.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
