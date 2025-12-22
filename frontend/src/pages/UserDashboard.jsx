import React, { useEffect, useMemo, useState } from "react";
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
  Button,
  Collapse,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import API, { listMyPromoPurchases } from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";
import banner_wg from "../assets/Wealth_Galaxy.jpg";
import imgGiftCards from "../assets/gifts.jpg";
import imgEcommerce from "../assets/ecommerce.jpg";
import imgSpinWin from "../assets/lucky-draw-img.png";
import imgHolidays from "../assets/holidays.jpg";
import imgEV from "../assets/ev-img.jpg";
import imgBillRecharge from "../assets/google-play-store.png";
import imgPlaystoreScreen from "../assets/play_store_screen.webp";
import imgFurniture from "../assets/furniture.jpeg";
import imgProperties from "../assets/propeties.jpg";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

// App tiles icons
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import WeekendIcon from "@mui/icons-material/Weekend";
import DevicesOtherIcon from "@mui/icons-material/DevicesOther";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import CasinoIcon from "@mui/icons-material/Casino";
import SavingsIcon from "@mui/icons-material/Savings";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ElectricCarIcon from "@mui/icons-material/ElectricCar";
import StarIcon from "@mui/icons-material/Star";
import GroupsIcon from "@mui/icons-material/Groups";

import AppHub from "./AppHub";
import WealthGalaxy from "./WealthGalaxy";
import AppsGrid from "../components/AppsGrid";
import EBooks from "./EBooks";

const drawerWidth = 220;

export default function UserDashboard({ embedded = false }) {
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

  const [selectedMenu, setSelectedMenu] = useState("dashboard");

  useEffect(() => {
    if (isDashboard) setSelectedMenu("dashboard");
    else if (isLuckyDraw) setSelectedMenu("lucky-draw");
  }, [isDashboard, isLuckyDraw]);

  const storedUser = useMemo(() => {
    try {
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const parsed = ls ? JSON.parse(ls) : {};
      return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
    } catch {
      return {};
    }
  }, []);
  const storedRole = useMemo(
    () => localStorage.getItem("role_user") || sessionStorage.getItem("role_user") || storedUser?.role || "user",
    [storedUser]
  );
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";

  const handleLogout = () => {
    try {
      localStorage.removeItem("token_user");
      localStorage.removeItem("refresh_user");
      localStorage.removeItem("role_user");
      localStorage.removeItem("user_user");
      sessionStorage.removeItem("token_user");
      sessionStorage.removeItem("refresh_user");
      sessionStorage.removeItem("role_user");
      sessionStorage.removeItem("user_user");
    } catch (e) {}
    navigate("/", { replace: true });
  };

  // Load admin-managed cards (for marketplace section)
  useEffect(() => {
    let isMounted = true;
    async function fetchCards() {
      try {
        const res = await API.get("/uploads/cards/", { params: { role: storedRole || undefined } });
        if (!isMounted) return;
        const data = Array.isArray(res.data) ? res.data : [];
        setCards(data);
      } catch (e) {
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

  // Promo package purchase ticks (for header chip only)
  const [purchasedPrime150, setPurchasedPrime150] = useState(false);
  const [purchasedPrime750, setPurchasedPrime750] = useState(false);
  const [purchasedMonthly, setPurchasedMonthly] = useState(false);

  const loadPromoPurchases = async () => {
    try {
      const res = await listMyPromoPurchases();
      const list = Array.isArray(res) ? res : (res?.results || []);
      const valid = (list || []).filter((pp) => {
        const st = String(pp?.status || "").toUpperCase();
        return st === "APPROVED";
      });
      let has150 = false, has750 = false, hasMonthly = false;
      for (const pp of valid) {
        const pkg = pp?.package || {};
        const type = String(pkg?.type || "");
        const name = String(pkg?.name || "").toLowerCase();
        const code = String(pkg?.code || "").toLowerCase();
        const price = Number(pkg?.price || 0);
        if (type === "MONTHLY") {
          hasMonthly = true;
        } else if (type === "PRIME") {
          if (Math.abs(price - 150) < 0.5 || name.includes("150") || code.includes("150")) has150 = true;
          if (Math.abs(price - 750) < 0.5 || name.includes("750") || code.includes("750")) has750 = true;
        }
      }
      setPurchasedPrime150(has150);
      setPurchasedPrime750(has750);
      setPurchasedMonthly(hasMonthly);
    } catch (e) {
      setPurchasedPrime150(false);
      setPurchasedPrime750(false);
      setPurchasedMonthly(false);
    }
  };

  useEffect(() => {
    loadPromoPurchases();
  }, []);

  const MEDIA_BASE = (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");

  // Marketplace card wrapper (kept from previous design)
  function MarketplaceCard({ title, children, variant = "plain", defaultExpanded = true, onViewMarketplace }) {
    const [expanded, setExpanded] = useState(Boolean(defaultExpanded));
    const headerStyles =
      variant === "gradient"
        ? { background: "linear-gradient(135deg,#0C2D48 0%,#145DA0 100%)", color: "#fff" }
        : { backgroundColor: "#fff", color: "#0f172a" };

    return (
      <Box
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          boxShadow: 1,
          mb: 2,
          bgcolor: "#fff",
          marginTop: "10px",
        }}
      >
        <Box
          sx={{
            ...headerStyles,
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "12px" }}>
            {title}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              size="small"
              variant={variant === "gradient" ? "contained" : "outlined"}
              onClick={() => onViewMarketplace && onViewMarketplace()}
              sx={{ textTransform: "none" }}
            >
              Marketplace
            </Button>
            <IconButton
              size="small"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Collapse" : "Expand"}
              sx={{
                color: headerStyles.color || "#0f172a",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 150ms",
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>
        </Box>
        <Collapse in={expanded}>
          <Box sx={{ p: 2, backgroundColor: "#fff" }}>{children}</Box>
        </Collapse>
      </Box>
    );
  }

  // Admin-managed cards renderer (unchanged)
  const renderMarketplaceContent = () =>
    loading ? (
      <Typography variant="body1" sx={{ color: "text.secondary" }}>
        Loading cards...
      </Typography>
    ) : (
      <Grid container spacing={2}>
        {(Array.isArray(cards) ? cards : [])
          .filter((c) => c.is_active !== false)
          .map((card) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={card.id || card.key}
              sx={{
                "@media (max-width:600px)": {
                  minWidth: 0,
                  boxSizing: "border-box",
                  width: "100%",
                },
              }}
            >
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 2,
                  backgroundColor: "#ffffff",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: 1,
                  width: "100%",
                  transition: "box-shadow 120ms ease, transform 120ms ease",
                  overflow: "hidden",
                  color: "text.primary",
                  "&:hover": {
                    boxShadow: 4,
                    transform: { xs: "none", sm: "translateY(-2px)" },
                  },
                }}
              >
                {card.image && (
                  <Box
                    component="img"
                    src={card.image?.startsWith("http") ? card.image : `${MEDIA_BASE}${card.image}`}
                    alt={card.title}
                    sx={{
                      width: "100%",
                      height: 140,
                      objectFit: "cover",
                      display: "block",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                )}
                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {card.description || ""}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
      </Grid>
    );

  // Apps grid items (Coming soon except E‑commerce + Spin & Win; Prime routes to promo page)
  const appItems = useMemo(
    () => [
      { key: "genealogy", label: "Genealogy", icon: GroupsIcon, route: "/user/my-team", image: LOGO },
      { key: "wealth-galaxy", label: "Wealth Galaxy", icon: GroupsIcon, route: "/user/wealth-galaxy", image: banner_wg },
      { key: "prime", label: "Prime", icon: StarIcon, route: "/user/promo-packages", image: LOGO },
      { key: "gift-cards", label: "Gift Cards", icon: CardGiftcardIcon, comingSoon: true, image: imgGiftCards },
      { key: "bill-recharge", label: "Bill & Recharge", icon: ReceiptLongIcon, comingSoon: true, image: imgBillRecharge },
      { key: "ecommerce", label: "E‑commerce", icon: ShoppingCartIcon, route: "/trikonekt-products", image: imgEcommerce },
      { key: "tri-holidays", label: "TRI Holidays", icon: BeachAccessIcon, route: "/user/tri/tri-holidays", image: imgHolidays },
      { key: "tri-furniture", label: "TRI Furniture", icon: WeekendIcon, route: "/user/tri/tri-furniture", image: imgFurniture },
      { key: "tri-electronics", label: "TRI Electronics & Home Appliances", icon: DevicesOtherIcon, route: "/user/tri/tri-electronics", image: imgPlaystoreScreen },
      { key: "tri-properties", label: "TRI Properties", icon: HomeWorkIcon, route: "/user/tri/tri-properties", image: imgProperties },
      { key: "tri-spinwin", label: "TRI Spin & Win", icon: CasinoIcon, route: "/user/lucky-draw", image: imgSpinWin },
      { key: "tri-saving", label: "TRI Saving App", icon: SavingsIcon, route: "/user/tri/tri-saving", image: LOGO },
      { key: "tri-local-store", label: "Local Store", icon: StorefrontIcon, route: "/user/tri/tri-local-store", image: imgGiftCards },
      { key: "tri-ev", label: "TRI EV Vehicles", icon: ElectricCarIcon, route: "/user/tri/tri-ev", image: imgEV },
    ],
    []
  );

  const isPrime = purchasedPrime150 || purchasedPrime750 || purchasedMonthly;

  const appItemsWithBadge = useMemo(
    () =>
      appItems.map((it) =>
        it.key === "prime"
          ? {
              ...it,
              badgeText: isPrime ? "Prime" : "Non‑Prime",
              badgeBg: isPrime ? "#16a34a" : "#6b7280",
              badgeFg: "#fff",
            }
          : it
      ),
    [appItems, isPrime]
  );

  if (embedded) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {/* Banner */}
        <Box
          sx={{
            position: "relative",
            height: { xs: 220, sm: 220, md: 400 },
            borderRadius: 3,
            overflow: "hidden",
            mb: 2,
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            background: `linear-gradient(rgba(12,45,72,0.35), rgba(12,45,72,0.35)), url(${banner_wg}) center/cover no-repeat`,
          }}
        >
          <Box sx={{ position: "absolute", top: 12, right: 12 }}>
            <Chip
              size="small"
              color={isPrime ? "success" : "default"}
              label={isPrime ? "Prime Account" : "Non‑Prime"}
              sx={{
                fontWeight: 700,
                bgcolor: isPrime ? "success.main" : "rgba(255,255,255,0.15)",
                color: "#fff",
              }}
            />
          </Box>
          <Box sx={{ position: "absolute", bottom: 16, left: 16, color: "#fff" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Welcome, {displayName}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Explore offers, redeem coupons and more
            </Typography>
          </Box>
        </Box>

        {/* Top Navigation Tabs (embedded) */}
        <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", mb: 2, border: "1px solid #e2e8f0" }}>
          <Tabs
            value={selectedMenu}
            onChange={(e, val) => setSelectedMenu(val)}
            variant="scrollable"
            allowScrollButtonsMobile
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="Dashboard" value="dashboard" />
            {/* <Tab label="Wealth Galaxy" value="wealth-galaxy" /> */}
            {/* <Tab label="Agency MarketPlace" value="marketplace" /> */}
            <Tab label="App Hub" value="apphub" />
            <Tab label="E‑Book" value="ebooks" />
          </Tabs>
        </Box>

        {selectedMenu === "dashboard" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0", p: 2 }}>
            <AppsGrid
              items={appItemsWithBadge}
              variant={isSmUp ? "icon" : "image"}
              columns={isSmUp ? { xs: 2, sm: 3, md: 4, lg: 4 } : { xs: 1, sm: 2, md: 3, lg: 4 }}
            />
          </Box>
        ) : selectedMenu === "wealth-galaxy" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0", p: 2 }}>
            {/* Reuse AppHub or a dedicated component for Wealth Galaxy if available */}
            <WealthGalaxy />
          </Box>
        ) : selectedMenu === "marketplace" ? (
          <MarketplaceCard
            title="Agency Products"
            variant="plain"
            defaultExpanded
            onViewMarketplace={() => navigate("/trikonekt-products")}
          >
            {renderMarketplaceContent()}
          </MarketplaceCard>
        ) : selectedMenu === "apphub" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <AppHub />
          </Box>
        ) : selectedMenu === "ebooks" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <EBooks />
          </Box>
        ) : null}
      </Box>
    );
  }

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
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: "none" } }}>
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="img" src={LOGO} alt="Trikonekt" sx={{ height: 36 }} />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}></Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Chip
            size="small"
            color={isPrime ? "success" : "default"}
            label={isPrime ? "Prime Account" : "Non‑Prime"}
            sx={{ mr: 1, fontWeight: 700, bgcolor: isPrime ? undefined : "rgba(255,255,255,0.15)", color: isPrime ? undefined : "#fff" }}
          />

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
            backgroundColor: "#fff",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            <ListItemButton
              selected={selectedMenu === "dashboard"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                setSelectedMenu("dashboard");
                setMobileOpen(false);
                navigate("/user/dashboard");
              }}
            >
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "wealth-galaxy"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                setSelectedMenu("wealth-galaxy");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="Wealth Galaxy" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "lucky-draw"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                setSelectedMenu("lucky-draw");
                setMobileOpen(false);
                navigate("/user/lucky-draw");
              }}
            >
              <ListItemText primary="Manual Lucky Coupon" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "marketplace"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                setSelectedMenu("marketplace");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="Marketplace" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "apphub"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                setSelectedMenu("apphub");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="App Hub" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "ebooks"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                setSelectedMenu("ebooks");
                setMobileOpen(false);
              }}
            >
              <ListItemText primary="E‑Book" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}></Box>
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
            backgroundColor: "#fff",
          },
        }}
        open
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            <ListItemButton
              selected={selectedMenu === "dashboard"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                setSelectedMenu("dashboard");
                navigate("/user/dashboard");
              }}
            >
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "wealth-galaxy"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => setSelectedMenu("wealth-galaxy")}
            >
              <ListItemText primary="Wealth Galaxy" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "lucky-draw"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => {
                setSelectedMenu("lucky-draw");
                navigate("/user/lucky-draw");
              }}
            >
              <ListItemText primary="Manual Lucky Coupon" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "marketplace"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => setSelectedMenu("marketplace")}
            >
              <ListItemText primary="Marketplace" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "apphub"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => setSelectedMenu("apphub")}
            >
              <ListItemText primary="App Hub" />
            </ListItemButton>
            <ListItemButton
              selected={selectedMenu === "ebooks"}
              sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }}
              onClick={() => setSelectedMenu("ebooks")}
            >
              <ListItemText primary="E‑Book" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>{/* Footer note */}</Box>
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
        {/* Banner */}
        <Box
          sx={{
            position: "relative",
            width: { xs: "calc(100% + 32px)", md: "100%" },
            ml: { xs: -2, md: 0 },
            mr: { xs: -2, md: 0 },
            height: { xs: 140, sm: 180, md: 220 },
            borderRadius: 3,
            overflow: "hidden",
            mb: 2,
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            background: `linear-gradient(rgba(12,45,72,0.35), rgba(12,45,72,0.35)), url(${LOGO}) center/cover no-repeat`,
          }}
        >
          <Box sx={{ position: "absolute", bottom: 16, left: 16, color: "#fff" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Welcome, {displayName}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Explore offers, redeem coupons and more
            </Typography>
          </Box>
        </Box>

        {/* Top Navigation Tabs */}
        <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", mb: 2, border: "1px solid #e2e8f0" }}>
          <Tabs
            value={selectedMenu}
            onChange={(e, val) => setSelectedMenu(val)}
            variant="scrollable"
            allowScrollButtonsMobile
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="Dashboard" value="dashboard" />
            {/* <Tab label="Wealth Galaxy" value="wealth-galaxy" /> */}
            <Tab label="MarketPlace" value="marketplace" />
            <Tab label="App Hub" value="apphub" />
            <Tab label="E‑Book" value="ebooks" />
          </Tabs>
        </Box>

        {selectedMenu === "dashboard" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0", p: 2 }}>
            <AppsGrid
              items={appItemsWithBadge}
              variant={isSmUp ? "icon" : "image"}
              columns={isSmUp ? { xs: 2, sm: 3, md: 4, lg: 4 } : { xs: 1, sm: 2, md: 3, lg: 4 }}
            />
          </Box>
        ) : selectedMenu === "wealth-galaxy" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <AppHub />
          </Box>
        ) : selectedMenu === "marketplace" ? (
          <MarketplaceCard
            title="Explore Trikonekt Products"
            variant="plain"
            defaultExpanded
            onViewMarketplace={() => navigate("/trikonekt-products")}
          >
            {renderMarketplaceContent()}
          </MarketplaceCard>
        ) : selectedMenu === "apphub" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <AppHub />
          </Box>
        ) : selectedMenu === "ebooks" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <EBooks />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
