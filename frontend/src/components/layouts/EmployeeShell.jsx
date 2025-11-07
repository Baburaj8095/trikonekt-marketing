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

export default function EmployeeShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Selected states (sync with EmployeeDashboard tabs via ?tab=)
  const tab = new URLSearchParams(location.search).get("tab") || "lucky";
  const isLucky = location.pathname === "/employee/dashboard" && tab === "lucky";
  const isECoupons = location.pathname === "/employee/dashboard" && tab === "ecoupons";
  const isWallet = location.pathname === "/employee/dashboard" && tab === "wallet";
  const isDailyReport = location.pathname === "/employee/daily-report";

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Employee";

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
          selected={isLucky}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/employee/dashboard?tab=lucky");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Lucky Draw Submission" />
        </ListItemButton>

        <ListItemButton
          selected={isECoupons}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/employee/dashboard?tab=ecoupons");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="My E‑Coupons" />
        </ListItemButton>

        <ListItemButton
          selected={isWallet}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/employee/dashboard?tab=wallet");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="My Wallet" />
        </ListItemButton>

        <ListItemButton
          selected={isDailyReport}
          sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
          onClick={() => {
            navigate("/employee/daily-report");
            setMobileOpen(false);
          }}
        >
          <ListItemText primary="Daily Report" />
        </ListItemButton>
      </List>
      <Divider />
      <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>
        Logged in as: {displayName}
      </Box>
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
