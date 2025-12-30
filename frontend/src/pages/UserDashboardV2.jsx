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
  Paper,
  InputBase,
  Avatar,
} from "@mui/material";
import API, { listMyPromoPurchases, listHeroBanners, listPromotions, listCategoryBanners } from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";
import banner_wg from "../assets/Wealth_Galaxy.jpg";
import imgGiftCards from "../assets/gifts.jpg";
import imgEcommerce from "../assets/ecommerce.jpg";
import imgSpinWin from "../assets/spin_deal.png";
import imgHolidays from "../assets/holidays.jpg";
import imgEV from "../assets/ev-img.jpg";
import imgBillRecharge from "../assets/google-play-store.png";
import imgPlaystoreScreen from "../assets/electronics-img.jpg";
import imgFurniture from "../assets/furniture.jpeg";
import imgProperties from "../assets/propeties.jpg";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
// App tiles icons (original set preserved)
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
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

import AppHub from "./AppHub";
import WealthGalaxy from "./WealthGalaxy";
import AppsGrid from "../components/AppsGrid";
import EBooks from "./EBooks";
import ElectronicsSection from "../components/ElectronicsSection";


// ================= GLOBAL IMAGE ENFORCER (ADDED) =================
/* ---------------- IMAGE ENFORCER ---------------- */
function SmartImage({ src, alt = "", variant = "product", type, sx, ...rest }) {
  // Support both `variant` and legacy `type` prop.
  const key = type || variant || "product";

  const MAP = {
    product: { ratio: "4 / 3", fit: "contain", bg: "#ffffff" },
    hero: { ratio: "16 / 9", fit: "cover", bg: "#f8fafc" },
    banner: { ratio: "3 / 1", fit: "cover", bg: "#f8fafc" },
    icon: { ratio: "1 / 1", fit: "contain", bg: "#ffffff" },
    // Extra keys used across dashboard
    electronics: { ratio: "4 / 3", fit: "contain", bg: "#ffffff" },
    furniture: { ratio: "4 / 3", fit: "contain", bg: "#ffffff" },
    ev: { ratio: "16 / 9", fit: "contain", bg: "#ffffff" }
  };

  const cfg = MAP[key] || MAP.product;

  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio: cfg?.ratio || "4 / 3",
        backgroundColor: cfg?.bg || "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: key === "icon" ? 2 : 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...sx
      }}
      {...rest}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: cfg?.fit || "contain"
          }}
        />
      ) : null}
    </Box>
  );
}





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
      let has150 = false,
        has750 = false,
        hasMonthly = false;
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

  // Admin-managed media state (hero carousel, promotions, category banners)
  const [heroBannersAdmin, setHeroBannersAdmin] = useState([]);
  const [promotionsAdmin, setPromotionsAdmin] = useState({});
  const [categoryBannersAdmin, setCategoryBannersAdmin] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      // Hero banners (max 3 on client; server returns all active ordered)
      try {
        const hb = await listHeroBanners();
        const arr = Array.isArray(hb) ? hb : (hb?.results || []);
        if (alive) {
          const urls = arr
            .filter((x) => x?.is_active !== false)
            .sort((a, b) => (a?.order || 0) - (b?.order || 0))
            .map((x) => x?.image_url || x?.image)
            .filter(Boolean);
          setHeroBannersAdmin(urls);
        }
      } catch (_) {}

      // Promotions: prime, tri-spinwin
      try {
        const res = await listPromotions({ params: { keys: "prime,tri-spinwin" } });
        const arr = Array.isArray(res) ? res : (res?.results || []);
        const map = {};
        arr.forEach((p) => {
          const key = String(p?.key || "").toLowerCase();
          if (key) map[key] = p?.image_url || p?.image;
        });
        if (alive) setPromotionsAdmin(map);
      } catch (_) {}

      // Category banners: tri-electronics, tri-furniture, tri-ev
      try {
        const res = await listCategoryBanners({ params: { keys: "tri-electronics,tri-furniture,tri-ev" } });
        const arr = Array.isArray(res) ? res : (res?.results || []);
        const map = {};
        arr.forEach((c) => {
          const key = String(c?.key || "");
          if (key) map[key] = c?.image_url || c?.image;
        });
        if (alive) setCategoryBannersAdmin(map);
      } catch (_) {}
    })();
    return () => { alive = false; };
  }, []);

  // Marketplace card wrapper (kept from original design; style-only tweaks)
  function MarketplaceCard({ title, children, variant = "plain", defaultExpanded = true, onViewMarketplace }) {
    const [expanded, setExpanded] = useState(Boolean(defaultExpanded));
    const headerStyles =
      variant === "gradient"
        ? { background: "linear-gradient(135deg,#0C2D48 0%,#145DA0 100%)", color: "#fff" }
        : { backgroundColor: "#fff", color: "#0f172a" };

    return (
      <Box
        sx={{
          borderRadius: "6px",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
          mb: 2,
          bgcolor: "#fff",
          mt: "10px",
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
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 14 }}>
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

  // Admin-managed cards renderer (content preserved; visual polish only)
  const renderMarketplaceContent = () =>
    loading ? (
      <Typography variant="body1" sx={{ color: "text.secondary" }}>
        Loading cards...
      </Typography>
    ) : (
      <Grid container spacing={1}>
        {(Array.isArray(cards) ? cards : [])
          .filter((c) => c.is_active !== false)
          .map((card) => (
            <Grid
              item
              xs={6}
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
                  borderRadius: "6px",
                  backgroundColor: "#ffffff",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
                  width: "100%",
                  transition: "box-shadow 120ms ease, transform 120ms ease",
                  overflow: "hidden",
                  color: "text.primary",
                  "&:hover": {
                    boxShadow: "0px 4px 12px rgba(15,23,42,0.10)",
                    transform: { xs: "none", sm: "translateY(-2px)" },
                  },
                }}
              >
                {card.image && (
                  <SmartImage
                    src={card.image?.startsWith("http") ? card.image : `${MEDIA_BASE}${card.image}`}
                    alt={card.title}
                    variant="banner"
                  />
                )}

                <CardContent sx={{ flexGrow: 1, p: 1.25 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, fontSize: 16 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.45 }}>
                    {card.description || ""}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
      </Grid>
    );

  // Apps grid items (original content preserved)
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

  // Override images with admin-managed ones when available (no layout change)
  const appItemsFinal = useMemo(
    () =>
      appItemsWithBadge.map((it) => {
        let image = it.image;
        const k = it.key;
        if (k === "prime" && promotionsAdmin["prime"]) image = promotionsAdmin["prime"];
        if (k === "tri-spinwin" && promotionsAdmin["tri-spinwin"]) image = promotionsAdmin["tri-spinwin"];
        if (categoryBannersAdmin[k]) image = categoryBannersAdmin[k];
        return { ...it, image };
      }),
    [appItemsWithBadge, promotionsAdmin, categoryBannersAdmin]
  );

  // HERO CAROUSEL (prefers admin banners; fallback to asset images)
  const heroBanners = useMemo(() => {
    const admin = (heroBannersAdmin || []).filter(Boolean);
    if (admin.length) return admin.slice(0, 3);
    return [banner_wg, imgEcommerce, imgHolidays].filter(Boolean).slice(0, 3);
  }, [heroBannersAdmin]);

  function HeroCarousel({ banners = [] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!banners.length) return;
    const id = setInterval(() => {
      setIdx((p) => (p + 1) % banners.length);
    }, 5000);
    return () => clearInterval(id);
  }, [banners.length]);

  if (!banners.length) return null;

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: { xs: 170, sm: 220 },
        borderRadius: "12px",
        overflow: "hidden",
        mb: 2,
        backgroundColor: "#eef2f7",
      }}
    >
      {banners.map((src, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            inset: 0,
            opacity: i === idx ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        >
          <img
            src={src}
            alt={`Banner ${i + 1}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </Box>
      ))}

      {/* DOTS */}
      <Box
        sx={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 1,
        }}
      >
        {banners.map((_, i) => (
          <Box
            key={i}
            onClick={() => setIdx(i)}
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              cursor: "pointer",
              bgcolor: i === idx ? "#1976d2" : "rgba(255,255,255,0.7)",
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

  // CATEGORY TILE (icon + label) — polished: equal size, unified icon style, consistent label alignment
  const CategoryTile = ({ item }) => (
    <Box
      onClick={() => item.route && navigate(item.route)}
      sx={{
        borderRadius: 2,
        p: 1,
        height: 110,
        bgcolor: "rgba(2,132,199,0.06)",
        border: "none",
        textAlign: "center",
        cursor: item.route ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      role="button"
      aria-label={item.label}
      title={item.label}
    >
      <Box
        sx={{
          flex: 1,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 1.5,
            bgcolor: "rgba(2,132,199,0.10)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.icon ? (
            <item.icon sx={{ fontSize: 34, color: "#0C2D48" }} />
          ) : (
            <Typography sx={{ fontWeight: 600, fontSize: 16, color: "#0C2D48", lineHeight: 1 }}>
              {(item.label || "")
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join("")}
            </Typography>
          )}
        </Box>
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.primary",
          lineHeight: 1.15,
          fontWeight: 600,
          fontSize: 12,
          mt: 1,
          px: 0.25,
          maxWidth: "100%",
        }}
        noWrap
      >
        {item.label}
      </Typography>
    </Box>
  );

  // PROMO CARD (horizontal + urgency)
 // PROMO CARD (FIXED – NO BACKGROUND IMAGES)
const PromoCard = ({ item, flag }) => (
  <Box
    sx={{
      position: "relative",
      width: "calc(50% - 8px)",
      minWidth: "calc(50% - 8px)",
      maxWidth: "calc(50% - 8px)",
      borderRadius: 2,
      overflow: "hidden",
      backgroundColor: "#fff",
      scrollSnapAlign: "start",
      boxShadow: "0 1px 4px rgba(15,23,42,0.08)"
    }}
  >
    <Box sx={{ height: 110, overflow: "hidden", backgroundColor: "#f5f7fa" }}>
      <Box
        component="img"
        src={item.image}
        alt={item.label}
        sx={{ width: "100%", height: "100%" }}
      />
    </Box>

    <Box sx={{ p: 1 }}>
      <Typography fontSize={13} fontWeight={700} noWrap>
        {item.label}
      </Typography>
    </Box>

    <Chip
      size="small"
      label={flag}
      color="error"
      sx={{ position: "absolute", top: 8, left: 8 }}
    />
  </Box>
);


  // PRIME (single summary/upgrade card)
  function PrimeSection() {
    return (
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: "#fff",
          border: "1px solid #e2e8f0",
          p: 1.25,
          boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
        }}
      >
        {isPrime ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip size="small" color="success" label="Prime Active" />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              You’re enjoying Prime benefits.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Upgrade to Prime
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Earn more rewards and offers
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              onClick={() => navigate("/user/promo-packages")}
              sx={{ textTransform: "none" }}
            >
              Upgrade
            </Button>
          </Box>
        )}
      </Box>
    );
  }


  // FEATURED LOGO (logo only)
  const FeaturedLogo = ({ data }) => (
    <Box
      onClick={data.onClick}
      sx={{
        minWidth: 110,
        borderRadius: 2,
        p: 1,
        scrollSnapAlign: "start",
        bgcolor: "#fff",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        cursor: "pointer",
      }}
      role="button"
      aria-label={data.label}
      title={data.label}
    >
      <Box
        sx={{
          height: 60,
          borderRadius: 1.5,
          background: data.image ? `url(${data.image}) center/contain no-repeat` : "#eef2f7",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      />
    </Box>
  );

  // PRODUCT ROW (horizontal product-like cards)
  function ProductRow({ title, item }) {
    if (!item) return null;

    const imageType =
      title === "Electronics" ? "electronics" :
      title === "EV Vehicles" ? "ev" :
      "furniture";

    const names =
      title === "Electronics"
        ? ["Smart TV 4K", "Bluetooth Speaker"]
        : title === "EV Vehicles"
        ? ["E‑Bike", "E‑Scooter"]
        : ["Modern Sofa", "Dining Set"];

    const reward =
      title === "Electronics" ? "5%" : title === "EV Vehicles" ? "10%" : "7%";

    return (
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
          p: 1.25,
          minWidth: "80%",
          flex: "0 0 auto",
          scrollSnapAlign: "start",
          maxWidth: 340,

        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography fontSize={18} fontWeight={700}>
            {title}
          </Typography>
          <Typography fontSize={13} color="primary" fontWeight={600}>
            View All
          </Typography>
        </Box>

        {title === "Electronics" ? (
          <Grid container spacing={1.25}>
            {[0].map((i) => (
              <Grid key={i} item xs={6}>
                <Card
                  onClick={() => item.route && navigate(item.route)}
                  sx={{
                    height: "100%",
                    cursor: item.route ? "pointer" : "default",
                    borderRadius: 2,
                    overflow: "hidden",
                    backgroundColor: "#ffffff",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
                    maxWidth: 340,
                  }}
                >
                  <SmartImage src={item.image} alt={item.label} type={imageType} />
                  <Box sx={{ p: 1 }}>
                    <Typography fontSize={13} fontWeight={700} noWrap>
                      {names[i]}
                    </Typography>
                    <Typography fontSize={12} color="text.secondary" noWrap>
                      Earn up to {reward} rewards
                    </Typography>
                    <Typography fontSize={12} color="primary" fontWeight={700} sx={{ mt: 0.25 }}>
                      View →
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box
            sx={{
              display: "flex",
              gap: 1.25,
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              scrollSnapType: "x mandatory",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {[0, 1].map((i) => (
              <Card
                key={i}
                onClick={() => item.route && navigate(item.route)}
                sx={{
                  height: "100%",
                  cursor: item.route ? "pointer" : "default",
                  borderRadius: 2,
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
                  flex: "0 0 auto",
                  minWidth: "80%",
                  scrollSnapAlign: "start",
                }}
              >
                <Box sx={{ width: "100%", height: imageType === "ev" ? "160px" : "180px", overflow: "hidden" }}>
                  <SmartImage src={item.image} alt={item.label} variant={imageType} fillHeight />
                </Box>
                <Box sx={{ p: 1 }}>
                  <Typography fontSize={13} fontWeight={700} noWrap>
                    {names[i]}
                  </Typography>
                  <Typography fontSize={12} color="text.secondary" noWrap>
                    Earn up to {reward} rewards
                  </Typography>
                  <Typography fontSize={12} color="primary" fontWeight={700} sx={{ mt: 0.25 }}>
                    View →
                  </Typography>
                </Box>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // SHOP PRODUCTS (merged Electronics, Furniture, EV into one)
  function ShopProductsSection() {
    const [active, setActive] = useState("electronics");

    const catDefs = [
      { key: "electronics", label: "Electronics", route: "/user/tri/tri-electronics" },
      { key: "furniture", label: "Furniture", route: "/user/tri/tri-furniture" },
      { key: "ev", label: "EV", route: "/user/tri/tri-ev" },
    ];

    const findImageByKey = (k) => {
      // appItemsFinal contains admin/banners overrides; keys are like 'tri-electronics'
      const it = (appItemsFinal || []).find((i) => i.key === `tri-${k}`);
      return it?.image;
    };

    const catImages = useMemo(
      () => ({
        electronics: categoryBannersAdmin["tri-electronics"] || findImageByKey("electronics") || imgPlaystoreScreen,
        furniture: categoryBannersAdmin["tri-furniture"] || findImageByKey("furniture") || imgFurniture,
        ev: categoryBannersAdmin["tri-ev"] || findImageByKey("ev") || imgEV,
      }),
      [categoryBannersAdmin, appItemsFinal]
    );

    const buildItems = useMemo(() => {
      const make = (key, route, names) =>
        names.slice(0, 6).map((title, idx) => ({
          id: `${key}-${idx}`,
          title,
          image: catImages[key],
          route,
        }));

      return {
        electronics: make("electronics", "/user/tri/tri-electronics", [
          "Smart TV 4K",
          "Bluetooth Speaker",
          "Air Conditioner",
          "Washing Machine",
          "Microwave Oven",
          "Refrigerator",
        ]),
        furniture: make("furniture", "/user/tri/tri-furniture", [
          "Modern Sofa",
          "Dining Set",
          "Wardrobe",
          "Office Chair",
          "Bookshelf",
          "Coffee Table",
        ]),
        ev: make("ev", "/user/tri/tri-ev", ["E‑Bike", "E‑Scooter", "EV Charger", "E‑Cycle", "Battery Pack", "Helmet"]),
      };
    }, [catImages]);

    const DashboardProductCard = ({ item, catKey }) => (
      <Card
        onClick={() => item.route && navigate(item.route)}
        sx={{
          height: "100%",
          cursor: "pointer",
          borderRadius: 2,
          overflow: "hidden",
          backgroundColor: "#ffffff",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
          transition: "transform 120ms ease, box-shadow 120ms ease",
          "&:hover": {
            boxShadow: { xs: "0px 1px 3px rgba(15,23,42,0.06)", sm: "0px 4px 12px rgba(15,23,42,0.10)" },
            transform: { xs: "none", sm: "translateY(-2px)" },
          },
        }}
      >
        <Box sx={{ position: "relative" }}>
          <SmartImage src={item.image} alt={item.title} type={catKey === "ev" ? "ev" : catKey} />
        </Box>
        <CardContent sx={{ p: 1 }}>
          <Typography fontSize={13} fontWeight={700} noWrap>
            {item.title}
          </Typography>
        </CardContent>
      </Card>
    );

    return (
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: "#fff",
          border: "1px solid #e2e8f0",
          p: 1.25,
          boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>
            Shop Products
          </Typography>
          <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
            View All
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            pb: 1,
            overflowX: "auto",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {catDefs.map((c) => (
            <Chip
              key={c.key}
              size="small"
              label={c.label}
              onClick={() => setActive(c.key)}
              variant={active === c.key ? "filled" : "outlined"}
              color={active === c.key ? "primary" : "default"}
              sx={{ textTransform: "none" }}
            />
          ))}
        </Box>

        <Grid container spacing={1.25}>
          {(buildItems[active] || []).slice(0, 6).map((it) => (
            <Grid key={it.id} item xs={6} sm={4} md={3}>
              <DashboardProductCard item={it} catKey={active} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // SERVICE ICON (icon-only)
  const ServiceIcon = ({ data }) => (
    <Box
      onClick={data.onClick}
      sx={{
        borderRadius: 2,
        p: 1,
        height: "100%",
        bgcolor: "#fff",
        border: "1px solid rgba(0,0,0,0.06)",
        textAlign: "center",
        cursor: "pointer",
      }}
      role="button"
      aria-label={data.label}
      title={data.label}
    >
      <Avatar
        src={data.image || undefined}
        variant="rounded"
        sx={{
          width: 36,
          height: 36,
          mx: "auto",
          fontWeight: 700,
          bgcolor: "rgba(2,132,199,0.08)",
          color: "#0C2D48",
          border: "1px solid rgba(0,0,0,0.06)",
          fontSize: 14,
        }}
      >
        {!data.image &&
          (data.label || "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join("")}
      </Avatar>
      {/* Intentionally no visible label for icon-only requirement */}
    </Box>
  );

  // DASHBOARD CONTENT (strict section order)
  function DashboardContent() {
    // Map items by key
    const itemByKey = Object.fromEntries((appItemsFinal || []).map((i) => [i.key, i]));
    const pick = (keys) => keys.map((k) => itemByKey[k]).filter(Boolean);

    // 1) HERO SECTION
    // 2) PRIMARY ACTION ICON GRID (4x2) exact categories
    const categoryKeys = [
      "tri-electronics",
      "tri-furniture",
      "tri-ev",
      "tri-local-store",
      "gift-cards",
      "bill-recharge",
      "tri-properties",
      "tri-holidays",
    ];
    const categories = pick(categoryKeys);

    // 3) DEALS & PROMOTIONS (horizontal)
    const promoKeys = ["tri-spinwin"];
    const promos = pick(promoKeys);

    // 4) FEATURED STORES (logos only)
    const featured = [
      { label: "TRIKONEKT", image: LOGO, onClick: () => navigate("/trikonekt-products") },
      itemByKey["wealth-galaxy"]
        ? {
            label: itemByKey["wealth-galaxy"].label,
            image: itemByKey["wealth-galaxy"].image,
            onClick: () => itemByKey["wealth-galaxy"].route && navigate(itemByKey["wealth-galaxy"].route),
          }
        : null,
      itemByKey["tri-holidays"]
        ? {
            label: itemByKey["tri-holidays"].label,
            image: itemByKey["tri-holidays"].image,
            onClick: () => itemByKey["tri-holidays"].route && navigate(itemByKey["tri-holidays"].route),
          }
        : null,
    ].filter(Boolean);

    // 5) PRODUCT SECTIONS (MAX 3): Electronics, Furniture, EV Vehicles
    const electronics = itemByKey["tri-electronics"];
    const furniture = itemByKey["tri-furniture"];
    const ev = itemByKey["tri-ev"];

    // 6) SERVICES (LAST): App Hub, E‑Book, Saving App, Genealogy (icon-only)
    const services = [
      { label: "App Hub", onClick: () => setSelectedMenu("apphub") },
      { label: "E‑Book", onClick: () => setSelectedMenu("ebooks") },
      itemByKey["tri-saving"]
        ? {
            label: itemByKey["tri-saving"].label,
            image: itemByKey["tri-saving"].image,
            onClick: () => itemByKey["tri-saving"].route && navigate(itemByKey["tri-saving"].route),
          }
        : null,
      itemByKey["genealogy"]
        ? {
            label: itemByKey["genealogy"].label,
            image: itemByKey["genealogy"].image,
            onClick: () => itemByKey["genealogy"].route && navigate(itemByKey["genealogy"].route),
          }
        : null,
    ].filter(Boolean);

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* 1. HERO */}
        <HeroCarousel banners={heroBanners} />

        {/* 2. PRIMARY ACTION ICON LIST (horizontal) */}
        {categories.length > 0 && (
          <Box
            sx={{
              borderRadius: 2,
              bgcolor: "#fff",
              border: "1px solid #e2e8f0",
              p: 1.25,
              boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
            }}
          >
            <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700, mb: 1 }}>
              Shop by Tri Categories
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                overflowX: "auto",
                pb: 0.5,
                scrollSnapType: "x mandatory",
                scrollBehavior: "smooth",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {categories
                .map((it) => {
                  const labelMap = {
                    "tri-electronics": "Electronics",
                    "tri-furniture": "Furniture",
                    "tri-ev": "EV",
                    "tri-local-store": "Local",
                    "gift-cards": "Gifts",
                    "bill-recharge": "Recharge",
                    "tri-properties": "Properties",
                    "tri-holidays": "Holidays",
                    prime: "Prime",
                  };
                  return { ...it, label: labelMap[it.key] || it.label };
                })
                .map((item) => (
                  <Box key={item.key} sx={{ width: 96, scrollSnapAlign: "start" }}>
                    <CategoryTile item={item} />
                  </Box>
                ))}
            </Box>
          </Box>
        )}

        {/* 3. DEALS & PROMOTIONS */}
        {promos.length > 0 && (
          <Box
            sx={{
              borderRadius: 2,
              bgcolor: "#fff",
              border: "1px solid #e2e8f0",
              p: 1.25,
              boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>
                Deals & Promotions
              </Typography>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                View All
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                gap: 1.25,
                overflowX: "auto",
                pb: 0.5,
                scrollSnapType: "x mandatory",
                "& > *": { scrollSnapAlign: "start" },
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >

              {promos.map((item) => (
                <PromoCard key={item.key} item={item} flag={item.key === "prime" ? "Ends soon" : "Limited time"} />
              ))}
            </Box>
          </Box>
        )}

        {/* PRIME */}
        <PrimeSection />

        {/* 4. FEATURED STORES (logos only) */}
        {featured.length > 0 && (
          <Box
            sx={{
              borderRadius: 2,
              bgcolor: "#fff",
              border: "1px solid #e2e8f0",
              p: 1.25,
              boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>
                Featured Stores
              </Typography>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                View All
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                gap: 1.25,
                overflowX: "auto",
                pb: 0.5,
                "&::-webkit-scrollbar": { display: "none" },
                scrollSnapType: "x mandatory",
              }}
            >
              {featured.map((f, idx) => (
                <FeaturedLogo key={`fs-${idx}`} data={f} />
              ))}
            </Box>
          </Box>
        )}

        {/* 5. PRODUCT SECTIONS */}
        <ElectronicsSection />
        <ProductRow title="Furniture" item={furniture} />
        <ProductRow title="EV Vehicles" item={ev} />

        {/* 6. SERVICES (icon-only) */}
        {services.length > 0 && (
          <Box
            sx={{
              borderRadius: 2,
              bgcolor: "#fff",
              border: "1px solid #e2e8f0",
              p: 1.25,
              boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
            }}
          >
            <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700, mb: 1 }}>
              Services
            </Typography>
            <Grid container spacing={1.25}>
              {services.map((s, i) => (
                <Grid item xs={3} sm={3} key={`srv-${i}`}>
                  <ServiceIcon data={s} />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>
    );
  }

  if (embedded) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {/* Top Navigation Tabs (embedded, unchanged) */}
        {/* <Box
          sx={{
            borderRadius: "6px",
            overflow: "hidden",
            bgcolor: "#fff",
            mb: 2,
            border: "1px solid #e2e8f0",
            boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
            px: 1,
            py: 0.5,
          }}
        >
          <Tabs
            value={selectedMenu}
            onChange={(e, val) => setSelectedMenu(val)}
            variant="scrollable"
            allowScrollButtonsMobile
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="Dashboard" value="dashboard" />
            <Tab label="App Hub" value="apphub" />
            <Tab label="E‑Book" value="ebooks" />
          </Tabs>
        </Box> */}

        {selectedMenu === "dashboard" ? (
          <DashboardContent />
        ) : selectedMenu === "wealth-galaxy" ? (
          <Box sx={{ borderRadius: "6px", overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0", p: 2 }}>
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
          <Box sx={{ borderRadius: "6px", overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <AppHub />
          </Box>
        ) : selectedMenu === "ebooks" ? (
          <Box sx={{ borderRadius: "6px", overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <EBooks />
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fb", overflowX: "hidden", maxWidth: "100%", "&, *": { boxSizing: "border-box" } }}>
      {/* App Top Bar (bug fix: remove undefined primary reference) */}
      <AppBar
        position="fixed"
        sx={{
          height: 56,
          background: "linear-gradient(180deg,#0C2D48 0%, #145DA0 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 1.5, display: { sm: "none" } }}>
            <MenuIcon />
          </IconButton>

          <Box sx={{ position: "absolute", left: 56, right: 56, display: "flex", justifyContent: "center" }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, color: "#fff" }}>
              <Box component="span" sx={{ fontWeight: 800 }}>Consumer</Box>
              <Box component="span" sx={{ opacity: 0.85, ml: 0.75, fontWeight: 600 }}>Dashboard</Box>
            </Typography>
          </Box>

          <Box sx={{ marginLeft: "auto" }}>
            <IconButton color="inherit" size="large" aria-label="Notifications">
              <NotificationsNoneIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar (mobile) */}
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
        <Toolbar sx={{ minHeight: 56 }} />
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
          <List>
            <ListItemButton onClick={handleLogout}>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </List>
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}></Box>
        </Box>
      </Drawer>

      {/* Sidebar (desktop) */}
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
        <Toolbar sx={{ minHeight: 56 }} />
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
          <List>
            <ListItemButton onClick={handleLogout}>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </List>
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>{/* Footer note */}</Box>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          overflowX: "hidden",
          maxWidth: "100%",
        }}
      >
        <Toolbar />

        {/* Top Navigation Tabs (unchanged) */}
        <Box
          sx={{
            borderRadius: "6px",
            overflow: "hidden",
            bgcolor: "#fff",
            mb: 2,
            border: "1px solid #e2e8f0",
            boxShadow: "0px 1px 3px rgba(15,23,42,0.06)",
            px: 1,
            py: 0.5,
          }}
        >
          <Tabs
            value={selectedMenu}
            onChange={(e, val) => setSelectedMenu(val)}
            variant="scrollable"
            allowScrollButtonsMobile
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="Dashboard" value="dashboard" />
            <Tab label="MarketPlace" value="marketplace" />
            <Tab label="App Hub" value="apphub" />
            <Tab label="E‑Book" value="ebooks" />
          </Tabs>
        </Box>

        {selectedMenu === "dashboard" ? (
          <DashboardContent />
        ) : selectedMenu === "wealth-galaxy" ? (
          <Box sx={{ borderRadius: "6px", overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
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
          <Box sx={{ borderRadius: "6px", overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <AppHub />
          </Box>
        ) : selectedMenu === "ebooks" ? (
          <Box sx={{ borderRadius: "6px", overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <EBooks />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
