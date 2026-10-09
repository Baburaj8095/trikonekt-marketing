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
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
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
      title: "NAVIGATION",
      items: [
        { label: "Dashboard", to: isTeam ? "/user/team-dashboard" : "/user/dashboard", icon: SpaceDashboardOutlinedIcon },
      ],
    },
    {
      title: "PACKAGES",
      items: [
        { label: "E-edu Agent Academy", to: "/user/rank-upgrade", icon: SchoolOutlinedIcon },
        { label: "E-edu Purchase History", to: "/user/prime-invoices", icon: ReceiptLongOutlinedIcon },
        { label: "Smart Shopping Voucher", to: "/user/spp-gift-cards", icon: CardGiftcardOutlinedIcon },
        { label: "Tri Holiday Packages", to: "/user/tri/tri-holidays", icon: FlightTakeoffOutlinedIcon },
        { label: "P2P Coupon Pocket", to: "/user/coupon-pocket", icon: ConfirmationNumberOutlinedIcon },
      ],
    },
    {
      title: "NETWORK & FINANCE",
      items: [
        { label: "Layers Blocks", to: "/user/genealogy-5", icon: AccountTreeRoundedIcon },
        { label: "History & Wallet", to: "/user/history", icon: AccountBalanceWalletOutlinedIcon },
      ],
    },
    {
      title: "ACCOUNT & SUPPORT",
      items: [
        { label: "Asiyapp Documents & PDF", to: "/user/trikonekt-pdf", icon: ReceiptLongOutlinedIcon },
        { label: "Profile & KYC", to: "/user/profile", icon: PersonOutlineRoundedIcon },
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
          width: { xs: 295, sm: 320 },
          bgcolor: "#0B132B",
          color: "#ffffff",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          p: 0,
        },
      }}
    >
      {/* 1. Header with Avatar, User info, Status chip and Close button */}
      <Box
        sx={{
          p: 2.25,
          pb: 2,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          background: "linear-gradient(180deg, rgba(30,64,175,0.15) 0%, rgba(11,19,43,0) 100%)",
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
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#94a3b8",
              "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#ffffff" },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            src={user?.avatar_url || user?.avatar || undefined}
            sx={{
              width: 52,
              height: 52,
              bgcolor: "#1E40AF",
              color: "#ffffff",
              fontSize: 20,
              fontWeight: 800,
              border: "2px solid #38bdf8",
              boxShadow: "0 0 16px rgba(56, 189, 248, 0.35)",
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#ffffff" }} noWrap>
              {fullName}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }} noWrap>
              ID: {userPhone}
            </Typography>
            <Chip
              size="small"
              label={`✓ ${status}`}
              sx={{
                mt: 0.5,
                height: 20,
                fontSize: 10.5,
                fontWeight: 700,
                bgcolor: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                border: "1px solid rgba(52, 211, 153, 0.3)",
              }}
            />
          </Box>
        </Stack>
      </Box>

      {/* 2. Categorized Menu Items */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1.5, px: 1.5 }}>
        {menuSections.map((section, idx) => (
          <Box key={section.title} sx={{ mb: 2 }}>
            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: 800,
                color: "#64748b",
                letterSpacing: "0.08em",
                px: 1.5,
                py: 0.75,
                textTransform: "uppercase",
              }}
            >
              {section.title}
            </Typography>

            <Stack spacing={0.75}>
              {section.items.map((item) => {
                const IconComp = item.icon;
                const isActive = currentPath === item.to || location.pathname === item.to;
                const isExt = !!item.external;

                return (
                  <Box
                    key={item.label}
                    component={isExt ? "a" : Link}
                    href={isExt ? item.to : undefined}
                    target={isExt ? "_blank" : undefined}
                    rel={isExt ? "noopener noreferrer" : undefined}
                    to={isExt ? undefined : item.to}
                    onClick={onClose}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: 1.5,
                      py: 1.1,
                      borderRadius: "14px",
                      background: isActive
                        ? "linear-gradient(90deg, rgba(30,64,175,0.85) 0%, rgba(124,58,237,0.7) 100%)"
                        : "transparent",
                      color: isActive ? "#ffffff" : "#cbd5e1",
                      textDecoration: "none",
                      border: isActive ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
                      boxShadow: isActive ? "0 4px 14px rgba(30, 64, 175, 0.35)" : "none",
                      transition: "all 140ms ease",
                      "&:hover": {
                        bgcolor: isActive ? undefined : "rgba(255,255,255,0.06)",
                        color: "#ffffff",
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
                          borderRadius: "10px",
                          bgcolor: isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isActive ? "#ffffff" : "#94a3b8",
                        }}
                      >
                        <IconComp sx={{ fontSize: 18 }} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 13.5,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? "#ffffff" : "#e2e8f0",
                        }}
                      >
                        {item.label}
                      </Typography>
                    </Stack>
                    <ChevronRightRoundedIcon sx={{ fontSize: 18, color: isActive ? "#ffffff" : "#64748b" }} />
                  </Box>
                );
              })}
            </Stack>

            {idx < menuSections.length - 1 && <Divider sx={{ mt: 2, borderColor: "rgba(255,255,255,0.06)" }} />}
          </Box>
        ))}
      </Box>

      {/* 3. Footer Logout Button (Mockup Screen 4) */}
      {onLogout && (
        <Box sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
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
              borderRadius: "14px",
              border: "none",
              background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
              transition: "transform 140ms ease, box-shadow 140ms ease",
              "&:hover": {
                boxShadow: "0 6px 18px rgba(225, 29, 72, 0.45)",
                transform: "translateY(-1px)",
              },
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
