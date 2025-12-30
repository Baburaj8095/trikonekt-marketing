import React from "react";
import { Box, Typography } from "@mui/material";
import colors from "../theme/colors";
import { useLocation, useNavigate } from "react-router-dom";

import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";

/**
 * V2BottomNav
 * Fixed bottom navigation bar consistent with UserDashboardV2.
 * Defaults:
 * - Home -> /user/dashboard
 * - Withdraw -> /user/wallet
 * - Package -> /user/promo-packages
 * - Deposit -> /user/wallet (same as Withdraw for now)
 * - History -> /user/history
 *
 * Props:
 * - items?: override items [{ label, to, icon }]
 */
export default function V2BottomNav({ items }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const defaultItems = [
    { label: "Home", to: "/user/dashboard2?tab=home", icon: <HomeRoundedIcon /> },
    { label: "Wallet", to: "/user/dashboard2?tab=wallet", icon: <AccountBalanceWalletRoundedIcon /> },
    { label: "Package", to: "/user/promo-packages", icon: <AppsRoundedIcon /> },
    { label: "Deposit", to: "/user/dashboard2?tab=wallet", icon: <AddCircleOutlineRoundedIcon /> },
    { label: "History", to: "/user/dashboard2?tab=history", icon: <HistoryRoundedIcon /> },
  ];

  const navItems = Array.isArray(items) && items.length ? items : defaultItems;

  const isActive = (to) => {
    // Anchors (e.g., /v2/home#packages) -> active when base path matches
    if (to.includes("#")) {
      const base = to.split("#")[0];
      return pathname.startsWith(base);
    }
    // Handle /user/dashboard2?tab=...
    if (to.startsWith("/user/dashboard2")) {
      const url = new URL(to, window.location.origin);
      const targetTab = url.searchParams.get("tab") || "home";
      const current = new URL(window.location.href);
      const currentTab = current.searchParams.get("tab") || "home";
      return pathname.startsWith("/user/dashboard2") && targetTab === currentTab;
    }
    if (to === "/user/dashboard") return pathname === "/user/dashboard";
    return pathname.startsWith(to);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        boxShadow: "0 -6px 16px rgba(0,0,0,0.06)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: 64,
        zIndex: 20,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.to);
        return (
          <Box
            key={item.label}
            onClick={() => navigate(item.to)}
            sx={{
              color: active ? colors.primary : colors.textPrimary,
              display: "flex",
              alignItems: "center",
              flexDirection: "column",
              gap: 0.5,
              cursor: "pointer",
              position: "relative",
              py: 0.75,
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                height: 3,
                width: 24,
                borderRadius: 6,
                background: colors.primary,
                left: "50%",
                transform: "translateX(-50%)",
                display: active ? "block" : "none",
              },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            <Box sx={{ fontSize: 0 }}>{item.icon}</Box>
            <Typography sx={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{item.label}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}
