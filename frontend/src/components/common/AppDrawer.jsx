import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import AddCardOutlinedIcon from "@mui/icons-material/AddCardOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import FlightTakeoffOutlinedIcon from "@mui/icons-material/FlightTakeoffOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import OndemandVideoOutlinedIcon from "@mui/icons-material/OndemandVideoOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { C, R, S } from "../../theme/tokens";

export default function AppDrawer({
  open,
  onClose,
  user = {},
  onLogout,
  isTeam = true,
}) {
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;

  const fullName = user?.full_name || user?.name || user?.username || "Demo1";
  const userPhone = user?.phone || user?.username || "000000001";
  const status = user?.status || user?.role || "Agent";

  const initials = (() => {
    const parts = String(fullName).trim().split(" ").filter(Boolean);
    return `${parts[0]?.[0] || "D"}${parts.length > 1 ? parts[parts.length - 1]?.[0] : ""}`.toUpperCase();
  })();

  const menuSections = [
    {
      title: "CORE",
      items: [
        { label: "Dashboard", to: isTeam ? "/user/team-dashboard" : "/user/dashboard", icon: SpaceDashboardOutlinedIcon },
        { label: "Add Money", to: "/user/upload-wallet", icon: AddCardOutlinedIcon },
        { label: "Team Wallet", to: "/user/team-wallet", icon: AccountBalanceWalletOutlinedIcon },
      ],
    },
    {
      title: "AGENT SUBSCRIPTION",
      items: [
        { label: "Agent Joining Fee", to: "/user/packages/join-subscription", icon: StarOutlineRoundedIcon },
        { label: "Digital Education", to: "/user/packages/digital-education-prime", icon: SchoolOutlinedIcon },
        { label: "SPP", to: "/user/packages/spp", icon: Inventory2OutlinedIcon },
        { label: "Holidays", to: "/user/tri/tri-holidays", icon: FlightTakeoffOutlinedIcon },
      ],
    },
    {
      title: "COMMERCE & MEDIA",
      items: [
        { label: "Gift Card Summary", to: "/user/gift-card-summary", icon: CardGiftcardOutlinedIcon },
        { label: "Package Summary", to: "/user/promo-packages", icon: ReceiptLongOutlinedIcon },
        { label: "Educational Video Summary", to: "/user/educational-videos", icon: OndemandVideoOutlinedIcon },
      ],
    },
    {
      title: "ACCOUNT & SUPPORT",
      items: [
        { label: "Generate ID Card", to: "/user/team-dashboard?action=id-card", icon: BadgeOutlinedIcon },
        { label: "Profile", to: "/user/profile", icon: PersonOutlineRoundedIcon },
        { label: "KYC Verification", to: "/user/kyc", icon: ShieldOutlinedIcon },
        { label: "Help & Support", to: "/user/support", icon: HelpOutlineOutlinedIcon },
      ],
    },
  ];

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true,
        BackdropProps: {
          sx: {
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
          },
        },
      }}
      PaperProps={{
        sx: {
          width: { xs: 290, sm: 320 },
          bgcolor: C.surface,
          borderRight: `1px solid ${C.border}`,
          boxShadow: S.floatingShadow,
          display: "flex",
          flexDirection: "column",
          p: 0,
        },
      }}
    >
      {/* 1. Header with Avatar, User info, Status chip and Close button */}
      <Box
        sx={{
          p: 2,
          pb: 1.5,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close menu drawer"
            sx={{
              width: 32,
              height: 32,
              borderRadius: `${R.sm}px`,
              border: `1px solid ${C.border}`,
              color: C.textSec,
              "&:hover": { bgcolor: C.surfaceSubtle },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            src={user?.avatar_url || user?.avatar || undefined}
            sx={{
              width: 48,
              height: 48,
              bgcolor: C.primary,
              color: "#ffffff",
              fontSize: 18,
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: C.text }} noWrap>
              {fullName}
            </Typography>
            <Typography sx={{ fontSize: 12, color: C.textSec, fontWeight: 500 }} noWrap>
              ID: {userPhone}
            </Typography>
            <Chip
              size="small"
              label={`✓ ${status}`}
              sx={{
                mt: 0.5,
                height: 20,
                fontSize: 10.5,
                fontWeight: 600,
                bgcolor: C.successBg,
                color: C.success,
              }}
            />
          </Box>
        </Stack>
      </Box>

      {/* 2. Categorized Menu Items */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1, px: 1.25 }}>
        {menuSections.map((section, idx) => (
          <Box key={section.title} sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textMuted,
                letterSpacing: "0.06em",
                px: 1.5,
                py: 0.75,
                textTransform: "uppercase",
              }}
            >
              {section.title}
            </Typography>

            <Stack spacing={0.5}>
              {section.items.map((item) => {
                const IconComp = item.icon;
                const isActive = currentPath === item.to || location.pathname === item.to;

                return (
                  <Box
                    key={item.label}
                    component={Link}
                    to={item.to}
                    onClick={onClose}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 1.5,
                      py: 1,
                      borderRadius: `${R.sm}px`,
                      bgcolor: isActive ? C.primaryLight : "transparent",
                      color: isActive ? C.primary : C.text,
                      textDecoration: "none",
                      transition: "all 140ms ease",
                      "&:hover": {
                        bgcolor: isActive ? C.primaryLight : C.surfaceSubtle,
                      },
                      "&:active": {
                        transform: "scale(0.985)",
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: `${R.sm}px`,
                          bgcolor: isActive ? "#ffffff" : C.surfaceSubtle,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isActive ? C.primary : C.textSec,
                          boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                        }}
                      >
                        <IconComp sx={{ fontSize: 18 }} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 13.5,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? C.primary : C.text,
                        }}
                      >
                        {item.label}
                      </Typography>
                    </Stack>
                    <ChevronRightRoundedIcon sx={{ fontSize: 18, color: C.textMuted }} />
                  </Box>
                );
              })}
            </Stack>

            {idx < menuSections.length - 1 && <Divider sx={{ mt: 1.5, borderColor: C.borderSubtle }} />}
          </Box>
        ))}
      </Box>

      {/* 3. Footer Logout Button */}
      {onLogout && (
        <Box sx={{ p: 1.5, borderTop: `1px solid ${C.border}` }}>
          <Box
            component="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            sx={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              py: 1.25,
              borderRadius: `${R.button}px`,
              border: `1px solid ${C.dangerBg}`,
              bgcolor: C.dangerBg,
              color: C.danger,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              transition: "transform 140ms ease",
              "&:active": { transform: "scale(0.985)" },
            }}
          >
            <LogoutRoundedIcon sx={{ fontSize: 18 }} />
            Logout
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
