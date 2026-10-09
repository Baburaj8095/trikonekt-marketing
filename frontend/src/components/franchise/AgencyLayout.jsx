import React from "react";
import { Box } from "@mui/material";
import AgencyHeader from "./AgencyHeader";
import AgencyBottomNav from "./AgencyBottomNav";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard AgencyLayout (Phase 2 & 6)
 * Single master layout shell for all Agency/Franchise screens:
 * - Exactly one sticky header at top
 * - Exactly one fixed bottom nav at bottom
 * - Centered 440px content column with consistent padding and safe areas
 */
export default function AgencyLayout({
  title,
  subtitle,
  isHome = false,
  onBack,
  activeScreen,
  onSelectScreen,
  notificationCount = 12,
  cartCount = 0,
  userInitials = "S",
  onNotificationClick,
  onCartClick,
  onAvatarClick,
  children,
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: AGENCY_TOKENS.colors.background,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 440,
          minHeight: "100vh",
          bgcolor: AGENCY_TOKENS.colors.background,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          boxShadow: { md: "0 0 30px rgba(15,23,42,0.08)" },
        }}
      >
        {/* Exactly ONE persistent application header */}
        <AgencyHeader
          title={title}
          subtitle={subtitle}
          isHome={isHome}
          onBack={onBack}
          notificationCount={notificationCount}
          cartCount={cartCount}
          userInitials={userInitials}
          onNotificationClick={onNotificationClick}
          onCartClick={onCartClick}
          onAvatarClick={onAvatarClick}
        />

        {/* Scrollable Content Area */}
        <Box
          component="main"
          sx={{
            flex: 1,
            width: "100%",
            boxSizing: "border-box",
            px: 2,
            pt: 2,
            pb: "calc(84px + env(safe-area-inset-bottom, 0px))", // Prevents content from ever being obscured by bottom nav
          }}
        >
          {children}
        </Box>

        {/* Exactly ONE fixed bottom navigation */}
        <AgencyBottomNav
          activeScreen={activeScreen}
          onSelectScreen={onSelectScreen}
        />
      </Box>
    </Box>
  );
}
