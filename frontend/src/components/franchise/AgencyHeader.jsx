import React, { useMemo } from "react";
import { Box, Typography, Stack, IconButton, Avatar } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";

/**
 * PhonePe-Style Top Header for Franchise
 */
export default function AgencyHeader({
  title = "Trikonekt Agency",
  subtitle,
  isHome = false,
  onBack,
  notificationCount = 0,
  cartCount = 0,
  userInitials = "A",
  userName = "Franchise Partner",
  onNotificationClick,
  onCartClick,
  onAvatarClick,
}) {
  const displayName = useMemo(() => {
    const str = String(userName || "").trim();
    if (/^\d+$/.test(str)) {
      return str.length >= 10 ? str.slice(-10) : str;
    }
    if (str.toLowerCase().includes("pincode")) {
      const pin = str.match(/\d{6}/)?.[0];
      return pin ? `PIN ${pin}` : "Partner";
    }
    if (str.toLowerCase().startsWith("agency_")) {
      const parts = str.split("_");
      return parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "Partner";
    }
    const first = str.split(/\s+/)[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Partner";
  }, [userName]);

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1100,
        minHeight: "64px",
        background: "linear-gradient(180deg, #5F259F 0%, #4E1B85 100%)",
        color: "#FFFFFF",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 2, sm: 2.5 },
        py: 1,
        width: "100%",
        boxSizing: "border-box",
        boxShadow: "0 4px 20px rgba(95, 37, 159, 0.25)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Left: PhonePe Avatar with Gold Squircle & Overlaid QR Badge on Home, or Back Button on sub-pages */}
      <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1, overflow: "hidden" }}>
        {isHome ? (
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, overflow: "hidden" }}>
            {/* PhonePe Gold Squircle Avatar with QR Badge */}
            <Box sx={{ position: "relative", flexShrink: 0 }}>
              <Avatar
                onClick={onAvatarClick}
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)",
                  color: "#1E1B4B",
                  fontWeight: 900,
                  fontSize: 19,
                  border: "2px solid rgba(255, 255, 255, 0.95)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
                  cursor: "pointer",
                  transition: "transform 140ms ease",
                  "&:active": { transform: "scale(0.94)" },
                }}
              >
                {userInitials}
              </Avatar>

              {/* Overlaid QR Icon Badge */}
              <Box
                sx={{
                  position: "absolute",
                  bottom: -3,
                  right: -3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  bgcolor: "#FFFFFF",
                  color: "#5F259F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)",
                  border: "1.5px solid #5F259F",
                  pointerEvents: "none",
                }}
              >
                <QrCode2RoundedIcon sx={{ fontSize: 12 }} />
              </Box>
            </Box>

            <Box sx={{ minWidth: 0, overflow: "hidden" }}>
              <Typography
                noWrap
                sx={{
                  fontSize: { xs: 15.5, sm: 16.5 },
                  fontWeight: 800,
                  color: "#FFFFFF",
                  lineHeight: 1.25,
                  letterSpacing: "-0.02em",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Hello, {displayName} 👋
              </Typography>
              <Typography
                noWrap
                sx={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "rgba(255, 255, 255, 0.85)",
                  letterSpacing: "0.2px",
                  lineHeight: 1.2,
                  mt: 0.2,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {subtitle || "Franchise Partner"}
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, overflow: "hidden", width: "100%" }}>
            <IconButton
              size="small"
              onClick={onBack}
              aria-label="Back"
              sx={{
                width: 40,
                height: 40,
                borderRadius: "14px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                bgcolor: "rgba(255, 255, 255, 0.12)",
                color: "#FFFFFF",
                backdropFilter: "blur(8px)",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
                flexShrink: 0,
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
                "&:active": { transform: "scale(0.94)" },
                transition: "transform 140ms ease",
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>

            <Box sx={{ minWidth: 0, overflow: "hidden" }}>
              <Typography
                noWrap
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 16, sm: 17 },
                  color: "#FFFFFF",
                  letterSpacing: "-0.015em",
                }}
              >
                {title}
              </Typography>
              {subtitle && (
                <Typography
                  noWrap
                  sx={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "rgba(255, 255, 255, 0.8)",
                    mt: 0.2,
                  }}
                >
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
        )}
      </Box>

      {/* Right: PhonePe Action Buttons (Help/Support on sub-pages, Notifications, Cart) */}
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ flexShrink: 0, ml: 1 }}>
        {!isHome && (
          <IconButton
            onClick={onNotificationClick}
            size="small"
            aria-label="Help & Support"
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(8px)",
              color: "#FFFFFF",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              position: "relative",
              transition: "all 160ms ease",
              "&:hover": { bgcolor: "rgba(255, 255, 255, 0.22)" },
              "&:active": { transform: "scale(0.94)" },
            }}
          >
            <HelpOutlineRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}

        <IconButton
          onClick={onNotificationClick}
          size="small"
          aria-label="Notifications"
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            bgcolor: "rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(8px)",
            color: "#FFFFFF",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            position: "relative",
            transition: "all 160ms ease",
            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.22)" },
            "&:active": { transform: "scale(0.94)" },
          }}
        >
          <NotificationsNoneRoundedIcon sx={{ fontSize: 20 }} />
          {(notificationCount > 0 || notificationCount === 12) && (
            <Box
              sx={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 16,
                height: 16,
                borderRadius: "50%",
                bgcolor: "#EF4444",
                color: "#FFFFFF",
                fontSize: 9.5,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #5F259F",
                boxShadow: "0 2px 6px rgba(239, 68, 68, 0.5)",
                px: 0.3,
              }}
            >
              {notificationCount || 12}
            </Box>
          )}
        </IconButton>

        <IconButton
          onClick={onCartClick}
          size="small"
          aria-label="Cart"
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            bgcolor: "rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(8px)",
            color: "#FFFFFF",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            position: "relative",
            transition: "all 160ms ease",
            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.22)" },
            "&:active": { transform: "scale(0.94)" },
          }}
        >
          <ShoppingBagOutlinedIcon sx={{ fontSize: 19 }} />
          {cartCount > 0 && (
            <Box
              sx={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 16,
                height: 16,
                borderRadius: "50%",
                bgcolor: "#F59E0B",
                color: "#FFFFFF",
                fontSize: 9.5,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #5F259F",
                boxShadow: "0 2px 6px rgba(245, 158, 11, 0.5)",
                px: 0.3,
              }}
            >
              {cartCount}
            </Box>
          )}
        </IconButton>
      </Stack>
    </Box>
  );
}
