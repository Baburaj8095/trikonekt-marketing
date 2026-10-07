import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { C, R, S } from "../../theme/tokens";

export default function BottomNav({ onToggleDrawer, isTeam = true }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    {
      key: "home",
      label: "Home",
      to: isTeam ? "/user/team-dashboard" : "/user/dashboard",
      icon: HomeRoundedIcon,
      active: currentPath === "/user/team-dashboard" || currentPath === "/user/dashboard" || currentPath === "/v4/home",
    },
    {
      key: "team",
      label: "Community",
      to: "/user/genealogy-5",
      icon: GroupsRoundedIcon,
      active: currentPath.includes("/genealogy") || currentPath.includes("/my-team"),
    },
    {
      key: "packages",
      label: "Packages",
      to: "/user/packages/spp",
      icon: FlightTakeoffRoundedIcon,
      active: currentPath.includes("/packages") || currentPath.includes("/spp"),
    },
    {
      key: "wallet",
      label: "Wallet",
      to: "/user/history",
      icon: AccountBalanceWalletRoundedIcon,
      active: currentPath.includes("/history") || currentPath.includes("/wallet") || currentPath.includes("/coupon"),
    },
  ];

  return (
    <Box
      component="nav"
      aria-label="Mobile Bottom Navigation"
      sx={{
        position: "fixed",
        bottom: { xs: "calc(10px + env(safe-area-inset-bottom))", sm: 16 },
        left: { xs: 14, sm: 24 },
        right: { xs: 14, sm: 24 },
        maxWidth: 420,
        mx: "auto",
        zIndex: 1060,
        bgcolor: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "32px",
        border: "1px solid rgba(255, 255, 255, 0.8)",
        boxShadow: "0 12px 36px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.05)",
        py: 0.6,
        px: 1,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${navItems.length + 1}, 1fr)`,
          alignItems: "center",
          width: "100%",
        }}
      >
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const active = item.active;
          const activeColor = "#0256B4";
          const inactiveColor = "#64748B";

          return (
            <Box
              key={item.key}
              component={Link}
              to={item.to}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.25,
                minHeight: 46,
                py: 0.25,
                color: active ? activeColor : inactiveColor,
                textDecoration: "none",
                position: "relative",
                transition: "transform 140ms ease, color 140ms ease",
                "&:active": { transform: "scale(0.92)" },
              }}
            >
              <IconComponent sx={{ fontSize: 22, color: active ? activeColor : inactiveColor }} />
              <Typography
                sx={{
                  fontSize: 10.5,
                  fontWeight: active ? 800 : 600,
                  color: active ? activeColor : inactiveColor,
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.label}
              </Typography>
              {active && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    width: 16,
                    height: 2.5,
                    borderRadius: 2,
                    bgcolor: activeColor,
                  }}
                />
              )}
            </Box>
          );
        })}

        {/* 5. Menu Drawer Trigger */}
        <Box
          component="button"
          onClick={onToggleDrawer}
          aria-label="Toggle Full Menu"
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.25,
            minHeight: 46,
            py: 0.25,
            border: "none",
            bgcolor: "transparent",
            color: "#64748B",
            cursor: "pointer",
            transition: "transform 140ms ease",
            "&:active": { transform: "scale(0.92)" },
          }}
        >
          <MenuRoundedIcon sx={{ fontSize: 22, color: "#64748B" }} />
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "#64748B",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            Menu
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
