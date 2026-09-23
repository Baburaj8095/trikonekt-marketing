import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Badge, Box, IconButton, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import NotificationsBell from "../NotificationsBell";
import { useCartStore } from "../../store/cartStore";
import { C, R, S } from "../../theme/tokens";

export default function AppHeader({
  title = "Trikonekt",
  user = {},
  isRootScreen = true,
  onToggleDrawer,
  onBack,
  cartPath = "/user/cart",
}) {
  const navigate = useNavigate();
  const cartCount = useCartStore((s) => s.items?.length || 0);

  const initials = (() => {
    const name = String(user?.full_name || user?.name || user?.username || "T").trim();
    const parts = name.split(" ").filter(Boolean);
    return `${parts[0]?.[0] || "T"}${parts.length > 1 ? parts[parts.length - 1]?.[0] : ""}`.toUpperCase();
  })();

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
        height: 54,
        px: { xs: 1.5, sm: 2.5 },
        pt: "env(safe-area-inset-top)",
        bgcolor: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
      }}
    >
      {/* Left: Avatar or Back Arrow */}
      <Box sx={{ display: "flex", alignItems: "center", minWidth: 44 }}>
        {isRootScreen ? (
          <IconButton
            aria-label="Open menu drawer"
            onClick={onToggleDrawer}
            sx={{
              p: 0.25,
              "&:active": { transform: "scale(0.92)" },
              transition: "transform 140ms ease",
            }}
          >
            <Avatar
              src={user?.avatar_url || user?.avatar || undefined}
              sx={{
                width: 36,
                height: 36,
                bgcolor: C.primary,
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
              }}
            >
              {initials}
            </Avatar>
          </IconButton>
        ) : (
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
            }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
      </Box>

      {/* Center: Title */}
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          fontSize: { xs: 15.5, sm: 16.5 },
          color: C.text,
          textAlign: "center",
          flex: 1,
          px: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </Typography>

      {/* Right: Notifications & Cart */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 44, justifyContent: "flex-end" }}>
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
              },
            }}
          >
            <ShoppingBagOutlinedIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
      </Box>
    </Box>
  );
}
