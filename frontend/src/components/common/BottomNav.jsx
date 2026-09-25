import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
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
      key: "wallet",
      label: "Wallet",
      to: isTeam ? "/user/team-wallet" : "/user/wallet",
      icon: AccountBalanceWalletRoundedIcon,
      active: currentPath.includes("/wallet") || currentPath.includes("/withdrawal"),
    },
    {
      key: "packages",
      label: "Packages",
      to: "/user/packages/spp",
      icon: Inventory2RoundedIcon,
      active: currentPath.includes("/packages") || currentPath.includes("/spp"),
    },
    {
      key: "team",
      label: "Team",
      to: "/user/genealogy-5",
      icon: GroupsRoundedIcon,
      active: currentPath.includes("/genealogy") || currentPath.includes("/my-team"),
    },
  ];

  return (
    <Box
      component="nav"
      aria-label="Mobile Bottom Navigation"
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1060,
        bgcolor: C.bottomNavBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${C.border}`,
        boxShadow: S.bottomNavShadow,
        pt: 0.75,
        pb: "max(8px, env(safe-area-inset-bottom))",
        px: 1,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          alignItems: "center",
          maxWidth: 540,
          mx: "auto",
        }}
      >
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const active = item.active;
          const color = active ? C.primary : C.textSec;

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
                gap: 0.35,
                minHeight: 44,
                py: 0.5,
                color,
                textDecoration: "none",
                transition: "transform 140ms ease, color 140ms ease",
                "&:active": { transform: "scale(0.92)" },
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 26,
                  borderRadius: `${R.sm}px`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: active ? C.primaryLight : "transparent",
                  transition: "background-color 160ms ease",
                }}
              >
                <IconComponent sx={{ fontSize: 20, color }} />
              </Box>
              <Typography
                sx={{
                  fontSize: 10.5,
                  fontWeight: active ? 700 : 500,
                  color,
                  lineHeight: 1,
                }}
              >
                {item.label}
              </Typography>
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
            gap: 0.35,
            minHeight: 44,
            py: 0.5,
            bgcolor: "transparent",
            border: "none",
            color: C.textSec,
            cursor: "pointer",
            transition: "transform 140ms ease",
            "&:active": { transform: "scale(0.92)" },
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 26,
              borderRadius: `${R.sm}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MenuRoundedIcon sx={{ fontSize: 20, color: C.textSec }} />
          </Box>
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 500,
              color: C.textSec,
              lineHeight: 1,
            }}
          >
            Menu
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
