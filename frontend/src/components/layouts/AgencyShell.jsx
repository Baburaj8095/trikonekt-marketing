import React, { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  IconButton,
  Button,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LOGO from "../../assets/TRIKONEKT.png";

const drawerWidth = 220;

export default function AgencyShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Selected states
  const isAgencyDashboard = location.pathname === "/agency/dashboard";
  const isLuckyCoupons = location.pathname === "/agency/lucky-coupons";
  const isProductsUpload = location.pathname === "/agency/products/upload";
  const isProductsList = location.pathname === "/agency/products";
  const isBanners = location.pathname === "/agency/banners";
  const isPurchaseRequests = location.pathname === "/agency/purchase-requests";
  const isMyTeam = location.pathname === "/agency/my-team";
  const isDailyReport = location.pathname === "/agency/daily-report";
  const isProfile = location.pathname === "/agency/profile";
  const isMarketplace = location.pathname.startsWith("/agency/marketplace");
  const inProductsContext =
    location.pathname.startsWith("/agency/products") ||
    location.pathname === "/agency/purchase-requests";

  // Lucky sub-tabs by query param for highlight
  const luckyTab = new URLSearchParams(location.search).get("tab") || "";
  const isLuckyPending = isLuckyCoupons && (!luckyTab || luckyTab === "pending");
  const isLuckyAssign = isLuckyCoupons && luckyTab === "assign";
  const isLuckyCommission = isLuckyCoupons && luckyTab === "commission";

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Agency";

  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen((v) => !v);

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("refresh");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("refresh");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("user");
    } catch (_) {}
    navigate("/", { replace: true });
  };

  const DrawerContent = (
    <Box sx={{ overflow: "auto" }}>
      <List>
        <ListItemButton
          selected={isAgencyDashboard}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/dashboard");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Dashboard" />
        </ListItemButton>
        <ListItemButton
          selected={isProfile}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/profile");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Profile" />
        </ListItemButton>
       
        <ListItemButton
          selected={isLuckyPending}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/lucky-coupons?tab=pending");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Lucky Draw Submissions" />
        </ListItemButton>
        <ListItemButton
          selected={isLuckyAssign}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/lucky-coupons?tab=assign");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="E Coupon" />
        </ListItemButton>
        <ListItemButton
          selected={isLuckyCommission}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/lucky-coupons?tab=commission");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Commission Summary" />
        </ListItemButton>

        <ListItemButton
          selected={isMyTeam}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/my-team");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="My Team" />
        </ListItemButton>

        <ListItemButton
          selected={isDailyReport}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/daily-report");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Daily Report" />
        </ListItemButton>

        <ListItemButton
          selected={isMarketplace}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/marketplace");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Marketplace" />
        </ListItemButton>

        <ListItemButton
          selected={isBanners}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/banners");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Banners" />
        </ListItemButton>
        <ListItemButton
          selected={isPurchaseRequests}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/agency/purchase-requests");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Purchase Requests" />
        </ListItemButton>
      </List>
      <Divider />
      <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }} />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fb" }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, backgroundColor: "#0C2D48" }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: "none" } }}>
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="img" src={LOGO} alt="Trikonekt" sx={{ height: 36 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }} />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" sx={{ mr: 2 }}>{displayName}</Typography>
          <Button color="inherit" size="small" sx={{ fontWeight: 500, textTransform: "none" }} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Sidebar - mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box", borderRight: "1px solid #e5e7eb" },
        }}
      >
        <Toolbar />
        {DrawerContent}
      </Drawer>

      {/* Sidebar - desktop */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box", borderRight: "1px solid #e5e7eb" },
        }}
        open
      >
        <Toolbar />
        {DrawerContent}
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
