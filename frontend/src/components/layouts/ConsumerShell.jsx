import React, { useMemo, useState, useEffect } from "react";
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
  const isWealthGalaxy = location.pathname === "/user/wealth-galaxy";
  const isAppHub = location.pathname === "/user/app-hub";
  const isProfile = location.pathname === "/user/profile";
  const isLuckyDraw = location.pathname === "/user/lucky-draw";
  const isMarketplace =
    location.pathname === "/marketplace" || location.pathname.startsWith("/marketplace/");
  const isMyOrders = location.pathname === "/marketplace/my-orders";
  const isECoupon = location.pathname === "/user/redeem-coupon";
  const isWallet = location.pathname === "/user/wallet";
  const isKYC = location.pathname === "/user/kyc";
  const isMyTeam = location.pathname === "/user/my-team";
  const isReferEarn = location.pathname === "/user/refer-earn";

  const [selectedMenu, setSelectedMenu] = useState('dashboard');

  useEffect(() => {
    if (isDashboard) setSelectedMenu('dashboard');
    else if (isWealthGalaxy) setSelectedMenu('wealth-galaxy');
    else if (isAppHub) setSelectedMenu('app-hub');
    else if (isProfile) setSelectedMenu('profile');
    else if (isLuckyDraw) setSelectedMenu('lucky-draw');
    else if (isMarketplace) setSelectedMenu('marketplace');
    else if (isECoupon) setSelectedMenu('e-coupon');
    else if (isWallet) setSelectedMenu('wallet');
    else if (isKYC) setSelectedMenu('kyc');
    else if (isMyTeam) setSelectedMenu('my-team');
    else if (isMyOrders) setSelectedMenu('my-orders');
    else if (isReferEarn) setSelectedMenu('refer-earn');
  }, [isDashboard, isWealthGalaxy, isAppHub, isProfile, isLuckyDraw, isMarketplace, isECoupon, isWallet, isKYC, isMyTeam, isMyOrders, isReferEarn]);

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
          selected={selectedMenu === 'dashboard'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/dashboard");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Dashboard" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'wealth-galaxy'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/wealth-galaxy");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Wealth Galaxy" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'app-hub'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/app-hub");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="App Hub" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'profile'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/profile");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Profile" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'lucky-draw'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/lucky-draw");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Participate Lucky Draw" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'marketplace'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/marketplace");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Marketplace" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'e-coupon'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/redeem-coupon");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="E-Coupon" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'wallet'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/wallet");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Wallet" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'kyc'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/kyc");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="KYC" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'my-team'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/my-team");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="My Team" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'my-orders'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/marketplace/my-orders");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="My Orders" />
        </ListItemButton>
        <ListItemButton
          selected={selectedMenu === 'refer-earn'}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/user/refer-earn");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Refer & Earn" />
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
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid #e5e7eb",
            // Add mobile-specific styling
            backgroundColor: "#ffffff",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          },
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, sm: 64 }, // Smaller toolbar on mobile
            px: 2,
          }}
        />
        {DrawerContent}
      </Drawer>

      {/* Sidebar - desktop */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
          },
        }}
        open
      >
        <Toolbar />
        {DrawerContent}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 }, // Better mobile padding
          minHeight: '100vh',
          backgroundColor: '#f7f9fb',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }} />
        <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
