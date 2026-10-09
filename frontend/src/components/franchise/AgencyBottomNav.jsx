import React from "react";
import { Box, Typography } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import { AGENCY_TOKENS } from "./AgencyTokens";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: HomeRoundedIcon },
  { key: "pincode", label: "Pincode", icon: LocationOnRoundedIcon },
  { key: "captains", label: "Captains", icon: ShieldRoundedIcon },
  { key: "merchants", label: "Merchants", icon: StoreRoundedIcon },
  { key: "command_center", label: "More", icon: MoreHorizRoundedIcon },
];

/**
 * Standard Agency Bottom Navigation (Phase 2B)
 * - Fixed 5 equal-width items: Home | Pincode | Captains | Merchants | More
 * - Proper Android safe-area padding
 * - Active indicator in Primary Blue (#2563EB)
 */
export default function AgencyBottomNav({ activeScreen, onSelectScreen }) {
  return (
    <Box
      component="nav"
      aria-label="Bottom Navigation"
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        bgcolor: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: `1px solid ${AGENCY_TOKENS.colors.border}`,
        boxShadow: "0 -2px 10px rgba(15, 23, 42, 0.04)",
        pt: 0.5,
        pb: "calc(env(safe-area-inset-bottom, 0px) + 6px)",
      }}
    >
      <Box
        sx={{
          maxWidth: 440,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          alignItems: "center",
          px: 0.5,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const IconComponent = item.icon;
          const isActive =
            activeScreen === item.key ||
            (item.key === "captains" && (activeScreen === "captain_detail" || activeScreen === "captain_map")) ||
            (item.key === "merchants" && activeScreen === "merchant_detail") ||
            (item.key === "command_center" &&
              (activeScreen === "command_center" ||
                activeScreen === "more" ||
                activeScreen === "earnings_wallet" ||
                activeScreen === "self_rebirth" ||
                activeScreen === "users" ||
                activeScreen === "support"));

          return (
            <Box
              key={item.key}
              component="button"
              type="button"
              onClick={() => onSelectScreen(item.key)}
              aria-selected={isActive}
              sx={{
                border: 0,
                bgcolor: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: 0.8,
                cursor: "pointer",
                color: isActive ? AGENCY_TOKENS.colors.primary : AGENCY_TOKENS.colors.secondaryText,
                transition: "all 0.15s ease",
                minHeight: 48,
                outline: "none",
                "&:active": { transform: "scale(0.92)" },
              }}
            >
              <IconComponent sx={{ fontSize: 22 }} />
              <Typography
                sx={{
                  fontSize: "10px",
                  fontWeight: isActive ? 700 : 500,
                  color: "inherit",
                  mt: 0.3,
                  lineHeight: 1,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
