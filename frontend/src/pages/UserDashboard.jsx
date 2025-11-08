import React, { useEffect, useState, useMemo } from "react";
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
  Grid,
  Card,
  CardContent,
  IconButton,
  Button
} from "@mui/material";
import API from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import ReferAndEarn from "../components/ReferAndEarn";

const drawerWidth = 220;

export default function UserDashboard() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);


  const theme = useTheme();
  const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);

  const location = useLocation();
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
  const storedRole = useMemo(
    () => localStorage.getItem("role") || sessionStorage.getItem("role") || storedUser?.role || "",
    [storedUser]
  );
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      localStorage.removeItem("refresh");
      sessionStorage.removeItem("refresh");
      localStorage.removeItem("role");
      sessionStorage.removeItem("role");
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
    } catch (e) {}
    navigate("/", { replace: true });
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchCards() {
      try {
        const res = await API.get("/uploads/cards/", { params: { role: storedRole || undefined } });
        if (!isMounted) return;
        const data = Array.isArray(res.data) ? res.data : [];
        setCards(data);
      } catch (e) {
        // In dev, if no cards yet, keep empty and show fallback card
        setCards([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchCards();
    return () => {
      isMounted = false;
    };
  }, [storedRole]);



  // Role-specific static cards with fallback
  const baseCards = Array.isArray(cards) ? cards : [];
  const computedCards = baseCards.filter(
    (c) => !c.role || !storedRole || String(c.role).toLowerCase() === String(storedRole).toLowerCase()
  );

  const MEDIA_BASE = (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");


  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fb" }}>
      {/* App Top Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "#0C2D48",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="img" src={LOGO} alt="Trikonekt" sx={{ height: 36 }} />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
              
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" sx={{ mr: 2 }}>
            {displayName}
          </Typography>
          <Button color="inherit" size="small" sx={{ fontWeight: 500, textTransform: "none" }} onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid #e5e7eb",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            <ListItemButton selected={isDashboard} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/dashboard"); setMobileOpen(false); }}>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton selected={isLuckyDraw} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/lucky-draw"); setMobileOpen(false); }}>
              <ListItemText primary="Participate Lucky Draw" />
            </ListItemButton>
            <ListItemButton selected={isMarketplace} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/marketplace"); setMobileOpen(false); }}>
              <ListItemText primary="Marketplace" />
            </ListItemButton>
            <ListItemButton selected={isECoupon} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/redeem-coupon"); setMobileOpen(false); }}>
              <ListItemText primary="E-Coupon" />
            </ListItemButton>
            <ListItemButton selected={isWallet} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/wallet"); setMobileOpen(false); }}>
              <ListItemText primary="Wallet" />
            </ListItemButton>
            <ListItemButton selected={isKYC} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/kyc"); setMobileOpen(false); }}>
              <ListItemText primary="KYC" />
            </ListItemButton>
            <ListItemButton selected={isMyTeam} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/my-team"); setMobileOpen(false); }}>
              <ListItemText primary="My Team" />
            </ListItemButton>
            <ListItemButton selected={isMyOrders} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/marketplace/my-orders"); setMobileOpen(false); }}>
              <ListItemText primary="My Orders" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>
            
          </Box>
        </Box>
      </Drawer>
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
          },
        }}
        open
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            <ListItemButton selected={isDashboard} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/dashboard")}>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton selected={isLuckyDraw} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/lucky-draw")}>
              <ListItemText primary="Participate Lucky Draw" />
            </ListItemButton>
            <ListItemButton selected={isMarketplace} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/marketplace")}>
              <ListItemText primary="Marketplace" />
            </ListItemButton>
            <ListItemButton selected={isECoupon} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/redeem-coupon")}>
              <ListItemText primary="E-Coupon" />
            </ListItemButton>
            <ListItemButton selected={isWallet} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/wallet")}>
              <ListItemText primary="Wallet" />
            </ListItemButton>
            <ListItemButton selected={isKYC} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/kyc")}>
              <ListItemText primary="KYC" />
            </ListItemButton>
            <ListItemButton selected={isMyTeam} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/my-team")}>
              <ListItemText primary="My Team" />
            </ListItemButton>
            <ListItemButton selected={isMyOrders} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/marketplace/my-orders")}>
              <ListItemText primary="My Orders" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>
            {/* Cards are controlled in Admin (Uploads → DashboardCards). */}
          </Box>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          
        }}
      >
        <Toolbar />
        <ReferAndEarn title="Refer & Earn" />
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}>
          Welcome
        </Typography>


        {loading ? (
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Loading cards...
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {computedCards
              .filter((c) => c.is_active !== false) // show if true or missing
              .map((card) => (
                <Grid item xs={12} sm={6} md={4} key={card.id || card.key}>
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 2,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    }}
                  >
                    {card.image && (
                      <Box
                        component="img"
                        src={
                          card.image?.startsWith("http")
                            ? card.image
                            : `${MEDIA_BASE}${card.image}`
                        }
                        alt={card.title}
                        sx={{ width: "100%", height: 140, objectFit: "cover" }}
                      />
                    )}
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        {card.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {card.description || ""}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
