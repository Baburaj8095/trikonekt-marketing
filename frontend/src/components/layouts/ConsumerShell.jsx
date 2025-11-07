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

export default function ConsumerShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Which items are selected
  const isDashboard = location.pathname === "/user/dashboard";
  const isLuckyDraw = location.pathname === "/user/lucky-draw";
  const isMarketplace =
    location.pathname === "/marketplace" || location.pathname.startsWith("/marketplace/");
  const isMyOrders = location.pathname === "/marketplace/my-orders";
  const isECoupon = location.pathname === "/user/redeem-coupon";
  const isWallet = location.pathname === "/user/wallet";
  const isKYC = location.pathname === "/user/kyc";
  const isMyTeam = location.pathname === "/user/my-team";

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";

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
          selected={isDashboard}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/dashboard");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Dashboard" />
        </ListItemButton>
        <ListItemButton
          selected={isLuckyDraw}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/lucky-draw");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Participate Lucky Draw" />
        </ListItemButton>
        <ListItemButton
          selected={isMarketplace}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/marketplace");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Marketplace" />
        </ListItemButton>
        <ListItemButton
          selected={isECoupon}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/redeem-coupon");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="E-Coupon" />
        </ListItemButton>
        <ListItemButton
          selected={isWallet}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/wallet");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Wallet" />
        </ListItemButton>
        <ListItemButton
          selected={isKYC}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/kyc");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="KYC" />
        </ListItemButton>
        <ListItemButton
          selected={isMyTeam}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/my-team");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="My Team" />
        </ListItemButton>
        <ListItemButton
          selected={isMyOrders}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/marketplace/my-orders");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="My Orders" />
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
