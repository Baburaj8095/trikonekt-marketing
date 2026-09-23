import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, useMediaQuery } from "@mui/material";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import AppDrawer from "./AppDrawer";
import { C, R, S } from "../../theme/tokens";

export default function AppShell({
  title = "Trikonekt",
  children,
  user: propUser,
  onLogout: propLogout,
  isTeam = true,
  rootPaths = ["/user/team-dashboard", "/user/dashboard", "/v4/home"],
  onBackFallbackPath = "/user/team-dashboard",
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width:1024px)");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Read stored user from localStorage/sessionStorage
  const user = useMemo(() => {
    if (propUser && Object.keys(propUser).length > 0) return propUser;
    try {
      const raw = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [propUser]);

  const onLogout = () => {
    if (propLogout) {
      propLogout();
    } else {
      try {
        localStorage.removeItem("token_user");
        localStorage.removeItem("refresh_user");
        localStorage.removeItem("role_user");
        localStorage.removeItem("user_user");
        sessionStorage.removeItem("token_user");
        sessionStorage.removeItem("refresh_user");
        sessionStorage.removeItem("role_user");
        sessionStorage.removeItem("user_user");
      } catch (_) {}
      navigate("/", { replace: true });
    }
  };

  const isRootScreen = useMemo(() => {
    const p = location.pathname;
    return rootPaths.some((r) => r === p || p === `${r}/`);
  }, [location.pathname, rootPaths]);

  // Listen for custom event to trigger drawer
  useEffect(() => {
    const handleOpen = () => setDrawerOpen(true);
    window.addEventListener("trikonekt:open-consumer-sidebar", handleOpen);
    return () => window.removeEventListener("trikonekt:open-consumer-sidebar", handleOpen);
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: C.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Header */}
      <AppHeader
        title={title}
        user={user}
        isRootScreen={isRootScreen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate(onBackFallbackPath, { replace: true });
          }
        }}
      />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 1.5, sm: 2, md: 2.5 },
          pt: { xs: 1.5, sm: 2, md: 2.5 },
          pb: {
            xs: "calc(78px + env(safe-area-inset-bottom))",
            sm: "calc(82px + env(safe-area-inset-bottom))",
            md: 3,
          },
        }}
      >
        {children}
      </Box>

      {/* Bottom Navigation Dock (Mobile only) */}
      {isMobile && (
        <BottomNav
          onToggleDrawer={() => setDrawerOpen(true)}
          isTeam={isTeam}
        />
      )}

      {/* Slide-out Menu Drawer */}
      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        onLogout={onLogout}
        isTeam={isTeam}
      />
    </Box>
  );
}
