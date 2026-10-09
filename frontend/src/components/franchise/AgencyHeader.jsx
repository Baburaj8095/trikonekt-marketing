import React from "react";
import { Box, Typography, Stack, IconButton, Badge, Avatar } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard Agency Header (Phase 2A)
 * Exactly ONE consistent header across the entire agency application.
 * - Left: Profile avatar on Home, or Back button on nested screens.
 * - Center: Current page title.
 * - Right: Notification and cart actions, rendered once.
 */
export default function AgencyHeader({
  title = "Trikonekt Agency",
  subtitle,
  isHome = false,
  onBack,
  notificationCount = 12,
  cartCount = 0,
  userInitials = "S",
  onNotificationClick,
  onCartClick,
  onAvatarClick,
}) {
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1100,
        height: `${AGENCY_TOKENS.geometry.headerHeight}px`,
        bgcolor: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${AGENCY_TOKENS.colors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Left: Avatar on Home, Back Arrow on nested pages */}
      <Box sx={{ width: 40, display: "flex", alignItems: "center" }}>
        {isHome ? (
          <Avatar
            onClick={onAvatarClick}
            sx={{
              width: 34,
              height: 34,
              bgcolor: AGENCY_TOKENS.colors.primary,
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 13,
              boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
              cursor: onAvatarClick ? "pointer" : "default",
              transition: "transform 0.12s ease",
              "&:hover": onAvatarClick ? { transform: "scale(1.05)" } : {},
            }}
          >
            {userInitials}
          </Avatar>
        ) : (
          <IconButton
            size="small"
            onClick={onBack}
            aria-label="Back"
            sx={{
              width: 34,
              height: 34,
              bgcolor: AGENCY_TOKENS.colors.surfaceMuted,
              color: AGENCY_TOKENS.colors.mainText,
              borderRadius: "10px",
              "&:hover": { bgcolor: "#E2E8F0" },
            }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
      </Box>

      {/* Center: Title + Subtitle */}
      <Box sx={{ flex: 1, minWidth: 0, textAlign: "center", px: 1 }}>
        <Typography
          noWrap
          sx={{
            fontSize: isHome ? "15.5px" : "15px",
            fontWeight: 700,
            color: AGENCY_TOKENS.colors.mainText,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            noWrap
            sx={{
              fontSize: "11px",
              fontWeight: 500,
              color: AGENCY_TOKENS.colors.secondaryText,
              lineHeight: 1.2,
              mt: 0.2,
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* Right: Notifications & Cart */}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: 68, justifyContent: "flex-end" }}>
        <IconButton
          size="small"
          aria-label="Notifications"
          onClick={onNotificationClick}
          sx={{
            width: 32,
            height: 32,
            color: AGENCY_TOKENS.colors.secondaryText,
            "&:hover": { color: AGENCY_TOKENS.colors.primary },
          }}
        >
          <Badge
            badgeContent={notificationCount}
            color="error"
            max={99}
            sx={{
              "& .MuiBadge-badge": {
                fontSize: 9.5,
                height: 16,
                minWidth: 16,
                padding: "0 4px",
                fontWeight: 750,
              },
            }}
          >
            <NotificationsNoneRoundedIcon sx={{ fontSize: 21 }} />
          </Badge>
        </IconButton>

        <IconButton
          size="small"
          aria-label="Cart"
          onClick={onCartClick}
          sx={{
            width: 32,
            height: 32,
            color: AGENCY_TOKENS.colors.secondaryText,
            "&:hover": { color: AGENCY_TOKENS.colors.primary },
          }}
        >
          <Badge
            badgeContent={cartCount}
            color="primary"
            sx={{
              "& .MuiBadge-badge": {
                fontSize: 9.5,
                height: 16,
                minWidth: 16,
                padding: "0 4px",
                fontWeight: 750,
              },
            }}
          >
            <ShoppingBagOutlinedIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
      </Stack>
    </Box>
  );
}
