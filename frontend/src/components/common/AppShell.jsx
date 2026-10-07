import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, useMediaQuery } from "@mui/material";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import AppDrawer from "./AppDrawer";
import { C, R, S } from "../../theme/tokens";

export default function AppShell({
  title = "asiyapp",
  children,
  user: propUser,
  onLogout: propLogout,
  isTeam = true,
  rootPaths = ["/user/team-dashboard", "/user/dashboard", "/v4/home"],
  onBackFallbackPath = "/user/team-dashboard",
  hideHeader: propHideHeader,
  edgeToEdge: propEdgeToEdge,
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

  const isHomeScreen = useMemo(() => {
    const p = location.pathname;
    return p === "/user/team-dashboard" || p === "/user/dashboard" || p === "/v4/home";
  }, [location.pathname]);

  const isIntegratedHeaderScreen = useMemo(() => {
    const p = location.pathname;
    return (
      isHomeScreen ||
      p === "/user/history" ||
      p.includes("/user/coupon-pocket") ||
      p.includes("/user/package-coupon-pocket") ||
      p.includes("/user/spp-gift-cards") ||
      p.includes("/user/packages/spp-gift-cards") ||
      p === "/user/spp"
    );
  }, [location.pathname, isHomeScreen]);

  const shouldHideHeader = Boolean(propHideHeader || isIntegratedHeaderScreen);
  const shouldBeEdgeToEdge = Boolean(propEdgeToEdge || isIntegratedHeaderScreen);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#F4F7FC",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Header - Rendered on standard sub-pages; on Integrated/Home screens header is handled seamlessly */}
      {!shouldHideHeader && (
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
      )}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1200,
          mx: "auto",
          px: shouldBeEdgeToEdge ? { xs: 0, sm: 2, md: 2.5 } : { xs: 1.5, sm: 2, md: 2.5 },
          pt: shouldBeEdgeToEdge ? 0 : { xs: 1.5, sm: 2, md: 2.5 },
          pb: {
            xs: "calc(90px + env(safe-area-inset-bottom))",
            sm: "calc(96px + env(safe-area-inset-bottom))",
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
