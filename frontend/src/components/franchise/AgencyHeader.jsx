import React from "react";
import { Box, Typography, Stack, IconButton, Badge, Avatar } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard Agency Header (Modernized to match Consumer Team Dashboard)
 * - Left: Avatar + Greeting ("Hello, Username 👋" + Role & PIN) on Home, or Square Rounded Back button on sub-screens.
 * - Right: Notifications with active badge & Cart actions.
 */
export default function AgencyHeader({
  title = "Trikonekt Agency",
  subtitle,
  isHome = false,
  onBack,
  notificationCount = 12,
  cartCount = 0,
  userInitials = "A",
  userName = "Franchise Partner",
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
        height: "60px",
        bgcolor: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: `1px solid ${AGENCY_TOKENS.colors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 1.8, sm: 2 },
        width: "100%",
        boxSizing: "border-box",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
      }}
    >
      {/* Left: Avatar + Greeting on Home, or Back Button on nested pages */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, flex: 1, overflow: "hidden" }}>
        {isHome ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, overflow: "hidden", minWidth: 0 }}>
            <IconButton
              aria-label="Open profile"
              onClick={onAvatarClick}
              sx={{
                p: 0.2,
                flexShrink: 0,
                "&:active": { transform: "scale(0.94)" },
                transition: "transform 140ms ease",
              }}
            >
              <Avatar
                sx={{
                  width: 38,
                  height: 38,
                  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                  color: "#FFFFFF",
                  fontWeight: 900,
                  fontSize: 14,
                  border: "2px solid #FFFFFF",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                }}
              >
                {userInitials}
              </Avatar>
            </IconButton>

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, overflow: "hidden" }}>
              <Typography
                noWrap
                sx={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#0F172A",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                }}
              >
                Hello, {userName} 👋
              </Typography>
              <Typography
                noWrap
                sx={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  lineHeight: 1.2,
                  mt: 0.2,
                }}
              >
                {subtitle || title}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, overflow: "hidden", width: "100%" }}>
            <IconButton
              size="small"
              onClick={onBack}
              aria-label="Back"
              sx={{
                width: 38,
                height: 38,
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                bgcolor: "#FFFFFF",
                color: "#0F172A",
                boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
                flexShrink: 0,
                "&:hover": { bgcolor: "#F8FAFC" },
                "&:active": { transform: "scale(0.94)" },
                transition: "transform 140ms ease",
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 0, overflow: "hidden", flexWrap: "wrap" }}>
              <Typography
                noWrap
                sx={{
                  fontWeight: 900,
                  fontSize: 15.5,
                  color: "#0F172A",
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography
                  noWrap
                  sx={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: "#1D4ED8",
                    bgcolor: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    borderRadius: "8px",
                    px: 0.8,
                    py: 0.2,
                  }}
                >
                  ● {subtitle}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Right: Notifications & Cart */}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, justifyContent: "flex-end" }}>
        <IconButton
          size="small"
          aria-label="Notifications"
          onClick={onNotificationClick}
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            color: "#64748B",
            bgcolor: "rgba(241,245,249,0.7)",
            border: "1px solid #E2E8F0",
            "&:hover": { color: "#2563EB", bgcolor: "#EFF6FF", borderColor: "#BFDBFE" },
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
                fontWeight: 800,
              },
            }}
          >
            <NotificationsNoneRoundedIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>

        <IconButton
          size="small"
          aria-label="Cart"
          onClick={onCartClick}
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            color: "#64748B",
            bgcolor: "rgba(241,245,249,0.7)",
            border: "1px solid #E2E8F0",
            "&:hover": { color: "#2563EB", bgcolor: "#EFF6FF", borderColor: "#BFDBFE" },
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
                fontWeight: 800,
              },
            }}
          >
            <ShoppingBagOutlinedIcon sx={{ fontSize: 19 }} />
          </Badge>
        </IconButton>
      </Stack>
    </Box>
  );
}
