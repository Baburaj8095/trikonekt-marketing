import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";

const UI = {
  bg: "#dbe8fb",
  surface: "#ffffff",
  text: "#1f2937",
  muted: "#6b7280",
  primary: "#0F52BA",
  secondary: "#2f6fd0",
  onPrimary: "#ffffff",
  gradient: "linear-gradient(180deg, #0F52BA 0%, #2f6fd0 100%)",
};

const BENEFITS = [
  "Affiliate/earning model for promoting and selling products",
  "Product listing support with extra product-add charges",
  "Advertisement packages from 1 day to 90 days",
];

const REGISTRATION_OPTIONS = [
  {
    id: "paid",
    title: "Paid Registration",
    price: "Rs. 49",
    note: "Quick onboarding with direct registration access.",
    icon: PersonAddAlt1RoundedIcon,
  },
  {
    id: "free",
    title: "Free Registration",
    price: "Rs. 0",
    note: "Product needs to be added separately at extra cost.",
    icon: Inventory2OutlinedIcon,
  },
];

const PLATFORM_FEATURES = [
  {
    title: "Affiliate Earnings",
    copy: "Users can promote products, share offers, and earn through referrals or direct sales.",
    icon: AutoGraphRoundedIcon,
  },
  {
    title: "Product Add-ons",
    copy: "Vendors can add products into the platform with separate listing charges where applicable.",
    icon: StorefrontOutlinedIcon,
  },
  {
    title: "Ad Visibility",
    copy: "Run product or business promotions using flexible advertisement durations.",
    icon: CampaignOutlinedIcon,
  },
];

const AD_PACKAGES = [
  { title: "1 Day Plan", price: "Rs. 99", detail: "Fast visibility boost for daily campaigns." },
  { title: "7 Day Plan", price: "Rs. 499", detail: "Best for weekly launches and product pushes." },
  { title: "15 Day Plan", price: "Rs. 899", detail: "Sustained reach for medium campaign cycles." },
  { title: "30 Day Plan", price: "Rs. 1,499", detail: "Monthly placement for stable recurring visibility." },
  { title: "90 Day Plan", price: "Rs. 3,999", detail: "Long-term campaign package for scale and retention." },
];

function SectionCard({ title, subtitle, children, action }) {
  return (
    <Card sx={{ borderRadius: 3.5, boxShadow: "0 16px 36px rgba(15,82,186,0.10)" }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 900, color: UI.text }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography sx={{ fontSize: 11.5, color: UI.muted, mt: 0.45, lineHeight: 1.5 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {action || null}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function InfoPill({ label }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        height: 26,
        borderRadius: 999,
        bgcolor: alpha(UI.primary, 0.10),
        color: UI.primary,
        fontWeight: 800,
        fontSize: 10.5,
      }}
    />
  );
}

function JoinPrimePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedRegistration, setSelectedRegistration] = useState("paid");
  const backTarget = location.pathname.startsWith("/consumer-ecommerce")
    ? "/consumer-ecommerce"
    : "/demo/budiness-dashboard";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: UI.bg }}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: UI.gradient,
          color: UI.onPrimary,
          boxShadow: "0 10px 24px rgba(15,82,186,0.18)",
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <IconButton
              onClick={() => navigate(backTarget)}
              sx={{
                color: UI.onPrimary,
                bgcolor: alpha("#ffffff", 0.14),
                width: 38,
                height: 38,
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
              Join Prime
            </Typography>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ px: 1.75, py: 2, pb: 3, maxWidth: 640, mx: "auto" }}>
        <Stack spacing={1.75}>
          <Card sx={{ borderRadius: 4, overflow: "hidden", boxShadow: "0 18px 38px rgba(15,82,186,0.12)" }}>
            <Box sx={{ background: UI.gradient, color: UI.onPrimary, px: 2, py: 2.3 }}>
              <Stack spacing={1.1}>
                <InfoPill label="1-Year Subscription" />
                <Typography sx={{ fontSize: 24, fontWeight: 900, lineHeight: 1.15 }}>
                  Affiliate / Subscription Online Package
                </Typography>
                <Typography sx={{ fontSize: 12.5, opacity: 0.96, lineHeight: 1.55 }}>
                  Build a scalable platform where users can register, subscribe, add products, and run ads for different durations.
                </Typography>
              </Stack>
            </Box>
            <CardContent sx={{ p: 2 }}>
              <Stack spacing={1.35}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: UI.text }}>
                  Subscription Plan
                </Typography>
                <Stack direction="row" alignItems="flex-end" spacing={1}>
                  <Typography sx={{ fontSize: 28, fontWeight: 900, color: UI.primary, lineHeight: 1 }}>
                    Rs. 750
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: UI.muted, pb: 0.35 }}>
                    per year
                  </Typography>
                </Stack>
                {BENEFITS.map((benefit) => (
                  <Stack key={benefit} direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircleRoundedIcon sx={{ color: UI.primary, fontSize: 18, mt: 0.1 }} />
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: UI.text, lineHeight: 1.5 }}>
                      {benefit}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <SectionCard
            title="Registration Options"
            subtitle="Choose a registration path before activating the yearly package."
          >
            <Stack spacing={1.1}>
              {REGISTRATION_OPTIONS.map((item) => {
                const Icon = item.icon;
                const active = selectedRegistration === item.id;

                return (
                  <Button
                    key={item.id}
                    onClick={() => setSelectedRegistration(item.id)}
                    sx={{
                      justifyContent: "flex-start",
                      textTransform: "none",
                      borderRadius: 2.5,
                      p: 0,
                      border: `1px solid ${active ? alpha(UI.primary, 0.36) : "#e5e7eb"}`,
                      bgcolor: active ? alpha(UI.primary, 0.06) : UI.surface,
                    }}
                  >
                    <Box sx={{ width: "100%", px: 1.4, py: 1.3 }}>
                      <Stack direction="row" spacing={1.1} alignItems="flex-start">
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            bgcolor: alpha(UI.primary, 0.12),
                            color: UI.primary,
                          }}
                        >
                          <Icon sx={{ fontSize: 20 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: UI.text }}>
                              {item.title}
                            </Typography>
                            <Typography sx={{ fontSize: 13, fontWeight: 900, color: UI.primary }}>
                              {item.price}
                            </Typography>
                          </Stack>
                          <Typography sx={{ fontSize: 11, color: UI.muted, mt: 0.45, lineHeight: 1.45 }}>
                            {item.note}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Button>
                );
              })}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Platform Features"
            subtitle="Core modules needed for the online package."
          >
            <Stack spacing={1.1}>
              {PLATFORM_FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.title}
                    sx={{
                      borderRadius: 2.8,
                      border: `1px solid ${alpha(UI.primary, 0.10)}`,
                      bgcolor: alpha(UI.primary, 0.03),
                      boxShadow: "none",
                    }}
                  >
                    <CardContent sx={{ p: 1.35 }}>
                      <Stack direction="row" spacing={1.1} alignItems="flex-start">
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: alpha(UI.primary, 0.12),
                            color: UI.primary,
                          }}
                        >
                          <Icon sx={{ fontSize: 19 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: UI.text }}>
                            {feature.title}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: UI.muted, mt: 0.4, lineHeight: 1.5 }}>
                            {feature.copy}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Advertisement Packages"
            subtitle="Flexible ad durations for promoting businesses and products."
          >
            <Stack spacing={1}>
              {AD_PACKAGES.map((ad) => (
                <Card
                  key={ad.title}
                  sx={{
                    borderRadius: 2.6,
                    border: `1px solid ${alpha(UI.primary, 0.12)}`,
                    boxShadow: "none",
                  }}
                >
                  <CardContent sx={{ p: 1.3 }}>
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: UI.text }}>
                          {ad.title}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: UI.muted, mt: 0.35, lineHeight: 1.45 }}>
                          {ad.detail}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: UI.primary, whiteSpace: "nowrap" }}>
                        {ad.price}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </SectionCard>

          <SectionCard
            title="Scalable Platform Goal"
            subtitle="Designed for users to register, subscribe, add products, and run ads from one online system."
            action={<InfoPill label="Scalable Model" />}
          >
            <Typography sx={{ fontSize: 11.5, color: UI.muted, lineHeight: 1.6 }}>
              This package supports an online ecosystem where members join through paid or free registration, activate a yearly subscription, add products with separate charges, and purchase advertisement durations based on campaign goals.
            </Typography>
          </SectionCard>

          <Card sx={{ borderRadius: 3.5, boxShadow: "0 18px 38px rgba(17,24,39,0.08)" }}>
            <CardContent sx={{ p: 2 }}>
              <Stack spacing={1.15}>
                <Typography sx={{ fontSize: 14, fontWeight: 900, color: UI.text }}>
                  Subscription CTA
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: UI.muted, lineHeight: 1.55 }}>
                  Selected registration:{" "}
                  <Box component="span" sx={{ color: UI.primary, fontWeight: 800 }}>
                    {selectedRegistration === "paid" ? "Paid Registration (Rs. 49)" : "Free Registration"}
                  </Box>
                </Typography>
                <Button
                  variant="contained"
                  sx={{
                    mt: 0.5,
                    borderRadius: 2.5,
                    py: 1.25,
                    textTransform: "none",
                    fontWeight: 800,
                    fontSize: 13,
                    bgcolor: UI.primary,
                    color: UI.onPrimary,
                    boxShadow: "none",
                    "&:hover": { bgcolor: UI.secondary, boxShadow: "none" },
                  }}
                >
                  Join Now
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}

export default JoinPrimePage;
