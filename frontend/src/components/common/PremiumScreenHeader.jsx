import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack, Typography, IconButton } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import himalayanTempleBg from "../../assets/himalayan_temple_bg.jpg";

export default function PremiumScreenHeader({
  title,
  user: propUser,
  onBack,
  onNotifications,
  onSecondary,
  notificationCount = 0,
  secondaryBadge = 0,
  secondaryIcon: SecondaryIcon = ShoppingBagOutlinedIcon,
  hasBackdrop = true,
  backdropHeight = { xs: 260, sm: 290 },
}) {
  const navigate = useNavigate();

  const user = React.useMemo(() => {
    if (propUser && Object.keys(propUser).length > 0) return propUser;
    try {
      const raw = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [propUser]);

  const userIdentifier = React.useMemo(() => {
    const username = String(user?.username || "").trim();
    const phone = String(user?.phone || user?.phone_number || user?.mobile || "").trim();
    if (username && phone && username !== phone) {
      return `${username} (${phone})`;
    }
    return username || phone || "";
  }, [user]);

  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleNotifications = () => {
    if (typeof onNotifications === "function") {
      onNotifications();
    } else {
      try {
        window.dispatchEvent(new CustomEvent("trikonekt:open-consumer-sidebar"));
      } catch (_) {}
    }
  };

  const handleSecondary = () => {
    if (typeof onSecondary === "function") {
      onSecondary();
    } else {
      navigate("/user/spp-gift-cards");
    }
  };

  return (
    <>
      {hasBackdrop && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: backdropHeight,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <Box
            component="img"
            src={himalayanTempleBg}
            alt="Scenic Mountain Atmospheric Backdrop"
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 18%",
              filter: "contrast(1.25) saturate(1.3) brightness(0.94)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0, 0, 0, 0.16) 0%, rgba(255, 255, 255, 0.05) 25%, rgba(244, 247, 252, 0.45) 60%, rgba(244, 247, 252, 0.96) 88%, #F4F7FC 100%)",
            }}
          />
        </Box>
      )}

      {/* Clean Glassmorphic Sticky Header Bar */}
      <Box
        component="header"
        sx={{
          position: "relative",
          zIndex: 10,
          pt: { xs: 1.25, sm: 1.5 },
          pb: 1,
          px: { xs: 0.5, sm: 1 },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
          {/* Left: Back Button + Title + User Identifier */}
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, overflow: "hidden" }}>
            <IconButton
              onClick={handleBack}
              size="small"
              aria-label="Back"
              sx={{
                width: 40,
                height: 40,
                bgcolor: "rgba(255, 255, 255, 0.92)",
                backdropFilter: "blur(14px)",
                color: "#0F172A",
                border: "1px solid rgba(226, 232, 240, 0.95)",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
                transition: "all 160ms ease",
                flexShrink: 0,
                "&:hover": { bgcolor: "#FFFFFF", borderColor: "#CBD5E1" },
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.85, minWidth: 0, overflow: "hidden", flexWrap: "wrap", rowGap: 0.25 }}>
              <Typography
                sx={{
                  fontSize: { xs: 17, sm: 20 },
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </Typography>
              {userIdentifier && (
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.4,
                    px: 0.85,
                    py: 0.2,
                    borderRadius: "8px",
                    bgcolor: "rgba(255, 255, 255, 0.92)",
                    backdropFilter: "blur(8px)",
                    color: "#0F172A",
                    border: "1px solid rgba(226, 232, 240, 0.95)",
                    fontSize: { xs: 10.5, sm: 11 },
                    fontWeight: 800,
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#10B981" }} />
                  {userIdentifier}
                </Box>
              )}
            </Box>
          </Stack>

          {/* Right: Notification Bell + Secondary Action Button */}
          <Stack direction="row" alignItems="center" spacing={1.2} sx={{ flexShrink: 0 }}>
            <IconButton
              onClick={handleNotifications}
              size="small"
              aria-label="Notifications"
              sx={{
                width: 40,
                height: 40,
                bgcolor: "rgba(255, 255, 255, 0.92)",
                backdropFilter: "blur(14px)",
                color: "#0F172A",
                border: "1px solid rgba(226, 232, 240, 0.95)",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
                position: "relative",
                transition: "all 160ms ease",
                "&:hover": { bgcolor: "#FFFFFF", borderColor: "#CBD5E1" },
              }}
            >
              <NotificationsNoneRoundedIcon sx={{ fontSize: 21 }} />
              {notificationCount > 0 && (
                <Box
                  sx={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 17,
                    height: 17,
                    borderRadius: "50%",
                    bgcolor: "#EF4444",
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #FFFFFF",
                    boxShadow: "0 2px 6px rgba(239, 68, 68, 0.45)",
                    px: 0.3,
                  }}
                >
                  {notificationCount}
                </Box>
              )}
            </IconButton>

            <IconButton
              onClick={handleSecondary}
              size="small"
              aria-label="Action"
              sx={{
                width: 40,
                height: 40,
                bgcolor: "rgba(255, 255, 255, 0.92)",
                backdropFilter: "blur(14px)",
                color: "#0F172A",
                border: "1px solid rgba(226, 232, 240, 0.95)",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
                position: "relative",
                transition: "all 160ms ease",
                "&:hover": { bgcolor: "#FFFFFF", borderColor: "#CBD5E1" },
              }}
            >
              <SecondaryIcon sx={{ fontSize: 20 }} />
              {Number(secondaryBadge) > 0 && (
                <Box
                  sx={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 17,
                    height: 17,
                    borderRadius: "50%",
                    bgcolor: "#F59E0B",
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #FFFFFF",
                    boxShadow: "0 2px 6px rgba(245, 158, 11, 0.45)",
                    px: 0.3,
                  }}
                >
                  {secondaryBadge}
                </Box>
              )}
            </IconButton>
          </Stack>
        </Stack>
      </Box>
    </>
  );
}
