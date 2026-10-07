import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Badge, Box, IconButton, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import NotificationsBell from "../NotificationsBell";
import { useCartStore } from "../../store/cartStore";
import { C, R, S } from "../../theme/tokens";

export default function AppHeader({
  title = "asiyapp",
  user: propUser = {},
  isRootScreen = true,
  onToggleDrawer,
  onBack,
  cartPath = "/user/cart",
}) {
  const navigate = useNavigate();
  const cartCount = useCartStore((s) => s.items?.length || 0);

  const user = React.useMemo(() => {
    if (propUser && Object.keys(propUser).length > 0) return propUser;
    try {
      const raw = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [propUser]);

  const initials = (() => {
    const name = String(user?.full_name || user?.name || user?.username || user?.phone || "T").trim();
    const parts = name.split(" ").filter(Boolean);
    return `${parts[0]?.[0] || "T"}${parts.length > 1 ? parts[parts.length - 1]?.[0] : ""}`.toUpperCase();
  })();

  const userIdentifier = React.useMemo(() => {
    const username = String(user?.username || "").trim();
    const phone = String(user?.phone || user?.phone_number || user?.mobile || "").trim();
    if (username && phone && username !== phone) {
      return `${username} (${phone})`;
    }
    return username || phone || "";
  }, [user]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      try {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate("/user/team-dashboard", { replace: true });
        }
      } catch {
        navigate("/user/team-dashboard", { replace: true });
      }
    }
  };

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1050,
        height: 56,
        px: { xs: 1.5, sm: 2.5 },
        pt: "env(safe-area-inset-top)",
        bgcolor: C.headerBg,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 2px 0 rgba(15, 23, 42, 0.03)",
      }}
    >
      {/* Left: Avatar + Greeting on root screen OR Back Arrow on sub-pages */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 44, flex: 1, overflow: "hidden" }}>
        {isRootScreen ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, overflow: "hidden" }}>
            <IconButton
              aria-label="Open menu drawer"
              onClick={onToggleDrawer}
              sx={{
                p: 0.25,
                "&:active": { transform: "scale(0.94)" },
                transition: "transform 140ms ease",
              }}
            >
              <Avatar
                src={user?.avatar_url || user?.avatar || undefined}
                sx={{
                  width: 38,
                  height: 38,
                  bgcolor: C.primary,
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 800,
                  border: "2px solid #ffffff",
                  boxShadow: "0 2px 8px rgba(30, 64, 175, 0.25)",
                }}
              >
                {initials}
              </Avatar>
            </IconButton>

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2, overflow: "hidden" }}>
              <Typography
                sx={{
                  fontSize: { xs: 14, sm: 15 },
                  fontWeight: 800,
                  color: C.text,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: "-0.01em",
                }}
              >
                Hello, {String(user?.full_name || user?.name || user?.username || user?.phone || "Community User").trim().split(" ")[0]} 👋
              </Typography>
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.textSec,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                Community Consumer
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, overflow: "hidden", width: "100%", minWidth: 0 }}>
            <IconButton
              aria-label="Go back"
              onClick={handleBack}
              sx={{
                width: 38,
                height: 38,
                borderRadius: `${R.sm}px`,
                border: `1px solid ${C.border}`,
                bgcolor: C.surface,
                color: C.text,
                "&:hover": { bgcolor: C.surfaceSubtle },
                "&:active": { transform: "scale(0.94)" },
                transition: "transform 140ms ease",
                flexShrink: 0,
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.85, minWidth: 0, overflow: "hidden", flexWrap: "wrap", rowGap: 0.25 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 15, sm: 16.5 },
                  color: C.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
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
                    bgcolor: "#EEF2FF",
                    color: "#4338CA",
                    border: "1px solid #C7D2FE",
                    fontSize: { xs: 10.5, sm: 11 },
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    boxShadow: "0 1px 3px rgba(99, 102, 241, 0.08)",
                  }}
                >
                  <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#10B981" }} />
                  {userIdentifier}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Right: Notifications & Cart */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 44, justifyContent: "flex-end" }}>
        <NotificationsBell />
        <IconButton
          component={Link}
          to={cartPath}
          aria-label="Shopping Cart"
          sx={{
            width: 38,
            height: 38,
            borderRadius: `${R.sm}px`,
            border: `1px solid ${C.border}`,
            bgcolor: C.surface,
            color: C.text,
            "&:hover": { bgcolor: C.surfaceSubtle },
            "&:active": { transform: "scale(0.94)" },
            transition: "transform 140ms ease",
          }}
        >
          <Badge
            badgeContent={cartCount}
            color="error"
            sx={{
              "& .MuiBadge-badge": {
                fontSize: 10,
                height: 16,
                minWidth: 16,
                fontWeight: 700,
                bgcolor: C.danger,
              },
            }}
          >
            <ShoppingBagOutlinedIcon sx={{ fontSize: 19 }} />
          </Badge>
        </IconButton>
      </Box>
    </Box>
  );
}
