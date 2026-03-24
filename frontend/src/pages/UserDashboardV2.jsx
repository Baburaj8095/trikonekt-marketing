import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Badge,
  Grid,
  IconButton,
  InputBase,
  Paper,
  Rating,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import NotificationsBell from "../components/NotificationsBell";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import MicNoneOutlinedIcon from "@mui/icons-material/MicNoneOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import SearchIcon from "@mui/icons-material/Search";
import StorefrontIcon from "@mui/icons-material/Storefront";
import FavoriteOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import ShoppingBasketOutlinedIcon from "@mui/icons-material/ShoppingBasketOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ElectricBoltOutlinedIcon from "@mui/icons-material/ElectricBoltOutlined";
import WeekendOutlinedIcon from "@mui/icons-material/WeekendOutlined";
import TwoWheelerOutlinedIcon from "@mui/icons-material/TwoWheelerOutlined";
import BeachAccessOutlinedIcon from "@mui/icons-material/BeachAccessOutlined";
import MobileScreenShareOutlinedIcon from "@mui/icons-material/MobileScreenShareOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import LocalGasStationOutlinedIcon from "@mui/icons-material/LocalGasStationOutlined";
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined";
import LiveTvOutlinedIcon from "@mui/icons-material/LiveTvOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import StarIcon from "@mui/icons-material/Star";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { useNavigate } from "react-router-dom";

import ProductStrip from "../components/ProductStrip";
import BillsAndRecharge from "../components/BillsAndRecharge";
import SmartImage from "../components/SmartImage2";
import { getItems as getCartItems, subscribe as subscribeCart } from "../store/cart";

import API, {
  listMyPromoPurchases,
  listHeroBanners,
  listPromotions,
  listCategoryBanners,
  getNearbyShops,
  getPublicShops,
} from "../api/api";

import heroImg from "../assets/Wealth_Galaxy.jpg";
import promoImg1 from "../assets/spin1.png";
import electronicsImg from "../assets/electronics-img.jpg";
import furnitureImg from "../assets/furniture.jpeg";
import evImg from "../assets/ev-img.jpg";
import holidaysImg from "../assets/thailand.jpg";

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  bg: "#F5F6FA",
  white: "#FFFFFF",
  primary: "#FF6B35",       // warm orange – CTA
  primaryLight: "#FFF0EB",
  secondary: "#1A1D2E",     // near-black
  accent: "#6C47FF",        // purple for Prime/badges
  accentLight: "#F0ECFF",
  green: "#16A34A",
  greenLight: "#DCFCE7",
  textPrimary: "#1A1D2E",
  textSecondary: "#6B7280",
  border: "#EAECF0",
  shadow: "0 2px 12px rgba(0,0,0,0.07)",
  shadowMd: "0 4px 20px rgba(0,0,0,0.10)",
  radius: 14,
  radiusSm: 8,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, onViewAll }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 17, fontWeight: 800, color: T.textPrimary, letterSpacing: "-0.3px" }}>
        {title}
      </Typography>
      {onViewAll && (
        <Button
          endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
          onClick={onViewAll}
          size="small"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: 13,
            color: T.primary,
            px: 0.5,
            minWidth: 0,
            "&:hover": { background: "none" },
          }}
        >
          View all
        </Button>
      )}
    </Stack>
  );
}

function ServiceCard({ icon, label, color, bg, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
        cursor: "pointer",
        flex: 1,
        py: 1.5,
        px: 0.5,
        borderRadius: T.radius,
        "&:active": { transform: "scale(0.96)" },
        transition: "transform 0.12s",
      }}
    >
      <Box sx={{
        width: 56, height: 56, borderRadius: 14, bgcolor: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 4px 14px ${bg}`,
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 26, color } })}
      </Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Box>
  );
}

function CategoryCard({ icon, label, bg, color, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75,
        cursor: "pointer", p: 1,
        "&:active": { transform: "scale(0.94)" },
        transition: "transform 0.12s",
      }}
    >
      <Box sx={{
        width: 60, height: 60, borderRadius: 16, bgcolor: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 28, color } })}
      </Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, textAlign: "center" }}>
        {label}
      </Typography>
    </Box>
  );
}

function ProductCard({ product, onAddToCart }) {
  const [fav, setFav] = useState(false);
  return (
    <Box sx={{
      width: 160, flexShrink: 0,
      bgcolor: T.white, borderRadius: T.radius,
      border: `1px solid ${T.border}`,
      overflow: "hidden",
      boxShadow: T.shadow,
    }}>
      <Box sx={{ position: "relative" }}>
        <Box sx={{ height: 130, bgcolor: "#F8F9FB", overflow: "hidden" }}>
          <img
            src={product.image}
            alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>
        <IconButton
          size="small"
          onClick={() => setFav(!fav)}
          sx={{
            position: "absolute", top: 6, right: 6,
            bgcolor: T.white, boxShadow: T.shadow, p: 0.5,
            "&:hover": { bgcolor: T.white },
          }}
        >
          <FavoriteOutlinedIcon sx={{ fontSize: 16, color: fav ? "#EF4444" : T.textSecondary }} />
        </IconButton>
        {product.badge && (
          <Chip
            label={product.badge}
            size="small"
            sx={{
              position: "absolute", top: 6, left: 6,
              bgcolor: T.green, color: "#fff",
              fontWeight: 800, fontSize: 10, height: 20, px: 0.5,
            }}
          />
        )}
      </Box>
      <Box sx={{ p: 1.25 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, mb: 0.25 }} noWrap>
          {product.name}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75 }}>
          <LocalShippingOutlinedIcon sx={{ fontSize: 12, color: T.green }} />
          <Typography sx={{ fontSize: 11, color: T.green, fontWeight: 700 }}>Free delivery</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 900, color: T.textPrimary }}>
              ₹{product.price?.toLocaleString("en-IN")}
            </Typography>
            {product.originalPrice && (
              <Typography sx={{ fontSize: 11, color: T.textSecondary, textDecoration: "line-through" }}>
                ₹{product.originalPrice?.toLocaleString("en-IN")}
              </Typography>
            )}
          </Box>
        </Stack>
        <Typography sx={{ fontSize: 11, color: "#F59E0B", fontWeight: 700, mb: 1 }}>
          Only few left
        </Typography>
        <Button
          fullWidth
          variant="contained"
          onClick={onAddToCart}
          size="small"
          sx={{
            textTransform: "none",
            fontWeight: 800,
            fontSize: 12,
            borderRadius: T.radiusSm,
            bgcolor: T.primary,
            py: 0.75,
            boxShadow: "none",
            "&:hover": { bgcolor: "#e55a28", boxShadow: "none" },
          }}
        >
          Add to Cart
        </Button>
      </Box>
    </Box>
  );
}

function HeroBannerSlider({ images }) {
  const [active, setActive] = useState(0);
  const imgs = images?.length > 0 ? images : [heroImg];

  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % imgs.length), 3500);
    return () => clearInterval(t);
  }, [imgs.length]);

  return (
    <Box sx={{ borderRadius: T.radius, overflow: "hidden", position: "relative", boxShadow: T.shadowMd }}>
      <Box sx={{
        display: "flex",
        transform: `translateX(-${active * 100}%)`,
        transition: "transform 0.45s cubic-bezier(.4,0,.2,1)",
      }}>
        {imgs.map((src, i) => (
          <Box key={i} sx={{ minWidth: "100%", height: 170 }}>
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </Box>
        ))}
      </Box>
      {imgs.length > 1 && (
        <Stack direction="row" spacing={0.6} sx={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)" }}>
          {imgs.map((_, i) => (
            <Box
              key={i}
              onClick={() => setActive(i)}
              sx={{
                width: i === active ? 18 : 6, height: 6,
                borderRadius: 3,
                bgcolor: i === active ? T.white : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                transition: "all 0.25s",
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UserDashboard({ embedded = false }) {
  const navigate = useNavigate();

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return ls ? JSON.parse(ls) : {};
    } catch { return {}; }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";
  const initials = useMemo(() => {
    const n = String(displayName || "C").trim();
    const parts = n.split(" ").filter(Boolean);
    const a = parts[0]?.[0] || "C";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (a + b).toUpperCase();
  }, [displayName]);

  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const compute = () => {
      try {
        const items = getCartItems();
        const cnt = (items || []).reduce((sum, it) => sum + Math.max(0, Number(it.qty || 0)), 0);
        setCartCount(Number.isFinite(cnt) ? cnt : 0);
      } catch { setCartCount(0); }
    };
    const unsub = subscribeCart(() => compute());
    compute();
    return () => { try { unsub?.(); } catch {} };
  }, []);

  const MEDIA_BASE = useMemo(() => String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, ""), []);
  const resolveImage = useMemo(() => (url) => {
    if (!url) return url;
    const s = String(url);
    if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) return s;
    return `${MEDIA_BASE}${s}`;
  }, [MEDIA_BASE]);

  const [isPrime, setIsPrime] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [heroBannersAdmin, setHeroBannersAdmin] = useState([]);
  const [promotionsAdmin, setPromotionsAdmin] = useState({});
  const [categoryBannersAdmin, setCategoryBannersAdmin] = useState({});
  const [nearbyShops, setNearbyShops] = useState([]);

  const [electronicsProducts, setElectronicsProducts] = useState([
    { id: 1, name: "Smart 4K TV", price: 24999, originalPrice: 34999, image: electronicsImg, badge: "HOT" },
    { id: 2, name: "Bluetooth Speaker", price: 2999, originalPrice: 4999, image: electronicsImg },
  ]);
  const [furnitureProducts, setFurnitureProducts] = useState([
    { id: 3, name: "Modern Sofa", price: 35999, originalPrice: 49999, image: furnitureImg, badge: "NEW" },
    { id: 4, name: "Wooden Chair", price: 7999, originalPrice: 12000, image: furnitureImg },
  ]);
  const [evProducts, setEvProducts] = useState([
    { id: 5, name: "E-Bike", price: 89999, originalPrice: 110000, image: evImg, badge: "HOT" },
    { id: 6, name: "EV Scooter", price: 109999, originalPrice: 140000, image: evImg },
  ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listMyPromoPurchases();
        const list = Array.isArray(res) ? res : res?.results || [];
        const valid = list.filter((pp) => String(pp?.status || "").toUpperCase() === "APPROVED");
        let prime = false;
        for (const pp of valid) {
          const pkg = pp?.package || {};
          if (pkg?.type === "MONTHLY" || pkg?.type === "PRIME") prime = true;
        }
        if (alive) setIsPrime(prime);
      } catch { if (alive) setIsPrime(false); }

      try {
        const hb = await listHeroBanners();
        const arr = Array.isArray(hb) ? hb : hb?.results || [];
        const urls = arr
          .filter((x) => x?.is_active !== false)
          .sort((a, b) => (a?.order || 0) - (b?.order || 0))
          .map((x) => x?.image_url || x?.image).filter(Boolean).map(resolveImage);
        if (alive) setHeroBannersAdmin(urls);
      } catch { if (alive) setHeroBannersAdmin([]); }

      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation
            ? navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
            : rej(new Error("no geo"))
        );
        const shops = await getNearbyShops({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (alive) setNearbyShops(Array.isArray(shops) ? shops : shops?.results || []);
      } catch {
        try {
          const pub = await getPublicShops({ params: { is_active: true, page_size: 5 } });
          if (alive) setNearbyShops(Array.isArray(pub) ? pub.slice(0, 5) : (pub?.results || []).slice(0, 5));
        } catch { if (alive) setNearbyShops([]); }
      }
    })();
    return () => { alive = false; };
  }, [resolveImage]);

  const services = [
    { key: "eat", label: "Tri Eat", icon: <RestaurantOutlinedIcon />, color: "#FF6B35", bg: "#FFF0EB", route: "/user/tri/tri-eat" },
    { key: "basket", label: "Tri Basket", icon: <ShoppingBasketOutlinedIcon />, color: "#6C47FF", bg: "#F0ECFF", route: "/user/tri/tri-basket" },
    { key: "drop", label: "Pick & Drop", icon: <LocalShippingOutlinedIcon />, color: "#059669", bg: "#D1FAE5", route: "/user/tri/pick-drop" },
  ];

  const categories = [
    { key: "electronics", label: "Electronics", icon: <ElectricBoltOutlinedIcon />, color: "#2563EB", bg: "#EFF6FF", route: "/user/tri/tri-electronics" },
    { key: "furniture", label: "Furniture", icon: <WeekendOutlinedIcon />, color: "#D97706", bg: "#FFFBEB", route: "/user/tri/tri-furniture" },
    { key: "ev", label: "EV", icon: <TwoWheelerOutlinedIcon />, color: "#059669", bg: "#ECFDF5", route: "/user/tri/tri-ev" },
    { key: "holidays", label: "Holiday", icon: <BeachAccessOutlinedIcon />, color: "#7C3AED", bg: "#F5F3FF", route: "/user/tri/tri-holidays" },
  ];

  const billCategories = [
    { key: "mobile", label: "Mobile", icon: <MobileScreenShareOutlinedIcon />, color: "#2563EB", bg: "#EFF6FF" },
    { key: "dth", label: "DTH", icon: <LiveTvOutlinedIcon />, color: "#7C3AED", bg: "#F5F3FF" },
    { key: "electricity", label: "Electricity", icon: <LightbulbOutlinedIcon />, color: "#D97706", bg: "#FFFBEB" },
    { key: "gas", label: "Gas", icon: <LocalGasStationOutlinedIcon />, color: "#DC2626", bg: "#FEF2F2" },
    { key: "water", label: "Water", icon: <WaterDropOutlinedIcon />, color: "#0891B2", bg: "#ECFEFF" },
  ];

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: "100vh", maxWidth: 430, mx: "auto", pb: 10 }}>

      {/* ── HEADER ────────────────────────────────────────────────── */}
      <Box sx={{
        bgcolor: T.white,
        px: 2, pt: 2, pb: 1.5,
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 0 #EAECF0",
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Avatar sx={{
              width: 38, height: 38, bgcolor: T.primary,
              fontSize: 14, fontWeight: 900,
            }}>
              {initials}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 12, color: T.textSecondary, fontWeight: 600, lineHeight: 1 }}>
                Welcome back
              </Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, lineHeight: 1.3 }}>
                {displayName}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {isPrime && (
              <Chip
                icon={<WorkspacePremiumOutlinedIcon sx={{ fontSize: 14, color: "#fff !important" }} />}
                label="Prime"
                size="small"
                sx={{
                  bgcolor: T.accent, color: "#fff",
                  fontWeight: 800, fontSize: 11, height: 24,
                  "& .MuiChip-icon": { ml: "6px" },
                }}
              />
            )}
            <NotificationsBell />
            <IconButton
              size="small"
              onClick={() => navigate("/user/cart")}
              sx={{ position: "relative" }}
            >
              <Badge
                badgeContent={cartCount || 0}
                color="error"
                sx={{ "& .MuiBadge-badge": { fontSize: 10, fontWeight: 900, minWidth: 17, height: 17 } }}
              >
                <ShoppingCartOutlinedIcon sx={{ fontSize: 24, color: T.textPrimary }} />
              </Badge>
            </IconButton>
          </Stack>
        </Stack>

        {/* Search bar */}
        <Paper
          elevation={0}
          sx={{
            display: "flex", alignItems: "center",
            bgcolor: T.bg, borderRadius: 50,
            border: `1.5px solid ${T.border}`, px: 1.5, py: 0.75,
            gap: 1,
          }}
        >
          <SearchIcon sx={{ fontSize: 20, color: T.textSecondary }} />
          <InputBase
            placeholder="Search products, shops..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.textPrimary }}
          />
          {isPrime && (
            <Chip
              label="Prime"
              size="small"
              sx={{
                bgcolor: T.accent, color: "#fff",
                fontWeight: 800, fontSize: 10, height: 20,
              }}
            />
          )}
          <IconButton size="small" sx={{ p: 0.25 }}>
            <MicNoneOutlinedIcon sx={{ fontSize: 20, color: T.textSecondary }} />
          </IconButton>
          <IconButton size="small" sx={{ p: 0.25 }}>
            <CameraAltOutlinedIcon sx={{ fontSize: 20, color: T.textSecondary }} />
          </IconButton>
        </Paper>
      </Box>

      {/* ── CONTENT ───────────────────────────────────────────────── */}
      <Stack spacing={1.5} sx={{ px: 1.5, pt: 1.5 }}>

        {/* 1. SERVICES */}
        <Paper elevation={0} sx={{ bgcolor: T.white, borderRadius: T.radius, px: 1, py: 1, boxShadow: T.shadow }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, px: 1, mb: 0.5 }}>
            Services
          </Typography>
          <Stack direction="row" justifyContent="space-around">
            {services.map((s) => (
              <ServiceCard
                key={s.key}
                icon={s.icon}
                label={s.label}
                color={s.color}
                bg={s.bg}
                onClick={() => navigate(s.route)}
              />
            ))}
          </Stack>
        </Paper>

        {/* 2. HERO BANNER */}
        <HeroBannerSlider images={heroBannersAdmin} />

        {/* 3. PROMO STRIP */}
        <Paper
          elevation={0}
          onClick={() => navigate("/user/lucky-draw")}
          sx={{
            bgcolor: T.white,
            borderRadius: T.radius,
            overflow: "hidden",
            boxShadow: T.shadow,
            cursor: "pointer",
            border: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            px: 2, py: 1.5,
            gap: 2,
            background: "linear-gradient(135deg, #1A1D2E 60%, #2A2D4E)",
          }}
        >
          <Box sx={{
            width: 52, height: 52, borderRadius: 13,
            bgcolor: "rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <EmojiEventsOutlinedIcon sx={{ fontSize: 30, color: "#FFD700" }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>
              Spin &amp; Rewards
            </Typography>
            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
              Spin &amp; win exciting rewards
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            sx={{
              textTransform: "none",
              fontWeight: 900,
              fontSize: 13,
              borderRadius: 50,
              px: 2.5, py: 1,
              bgcolor: T.primary,
              boxShadow: `0 4px 14px rgba(255,107,53,0.45)`,
              whiteSpace: "nowrap",
              "&:hover": { bgcolor: "#e55a28" },
            }}
          >
            Spin Now
          </Button>
        </Paper>

        {/* 4. SHOP BY CATEGORIES */}
        <Paper elevation={0} sx={{ bgcolor: T.white, borderRadius: T.radius, p: 1.5, boxShadow: T.shadow }}>
          <SectionHeader title="Shop by Categories" />
          <Grid container columns={4} spacing={0}>
            {categories.map((c) => (
              <Grid key={c.key} item xs={1}>
                <CategoryCard
                  icon={c.icon}
                  label={c.label}
                  color={c.color}
                  bg={c.bg}
                  onClick={() => navigate(c.route)}
                />
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* 5. LOCAL SHOPS */}
        {nearbyShops.length > 0 && (
          <Paper elevation={0} sx={{ bgcolor: T.white, borderRadius: T.radius, p: 1.5, boxShadow: T.shadow }}>
            <SectionHeader title="Local Shops" onViewAll={() => navigate("/user/tri/tri-local-store")} />
            <Box sx={{ display: "flex", gap: 1.25, overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" } }}>
              {nearbyShops.slice(0, 5).map((s) => (
                <Paper
                  key={s.id}
                  elevation={0}
                  onClick={() => navigate(`/merchant-marketplace/shops/${encodeURIComponent(s.id)}`)}
                  sx={{
                    minWidth: 210, borderRadius: T.radius, p: 1.25,
                    border: `1px solid ${T.border}`, cursor: "pointer",
                    "&:active": { bgcolor: T.bg },
                    display: "flex", alignItems: "center", gap: 1.25,
                  }}
                >
                  <Box sx={{
                    width: 50, height: 50, borderRadius: 12,
                    bgcolor: T.bg, overflow: "hidden", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {s.logo
                      ? <img src={s.logo} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <StorefrontIcon sx={{ fontSize: 22, color: T.primary }} />
                    }
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 13, color: T.textPrimary }} noWrap>{s.name}</Typography>
                    <Stack direction="row" alignItems="center" spacing={0.4}>
                      <StarIcon sx={{ fontSize: 13, color: "#F59E0B" }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>4.5</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 11, color: T.textSecondary, fontWeight: 600 }} noWrap>
                      {s.distance_km ? `${Number(s.distance_km).toFixed(1)} km • ` : ""}{(s.address || "").trim() || "Near you"}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Paper>
        )}

        {/* 6. ELECTRONICS */}
        <Paper elevation={0} sx={{ bgcolor: T.white, borderRadius: T.radius, p: 1.5, boxShadow: T.shadow }}>
          <SectionHeader title="Electronics" onViewAll={() => navigate("/user/tri/tri-electronics")} />
          <Box sx={{ display: "flex", gap: 1.25, overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" } }}>
            {electronicsProducts.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={() => navigate("/user/tri/tri-electronics")} />
            ))}
          </Box>
        </Paper>

        {/* 7. FURNITURE */}
        <Paper elevation={0} sx={{ bgcolor: T.white, borderRadius: T.radius, p: 1.5, boxShadow: T.shadow }}>
          <SectionHeader title="Furniture" onViewAll={() => navigate("/user/tri/tri-furniture")} />
          <Box sx={{ display: "flex", gap: 1.25, overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" } }}>
            {furnitureProducts.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={() => navigate("/user/tri/tri-furniture")} />
            ))}
          </Box>
        </Paper>

        {/* 8. EV VEHICLES */}
        <Paper elevation={0} sx={{ bgcolor: T.white, borderRadius: T.radius, p: 1.5, boxShadow: T.shadow }}>
          <SectionHeader title="EV Vehicles" onViewAll={() => navigate("/user/tri/tri-ev")} />
          <Box sx={{ display: "flex", gap: 1.25, overflowX: "auto", pb: 0.5, "&::-webkit-scrollbar": { display: "none" } }}>
            {evProducts.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={() => navigate("/user/tri/tri-ev")} />
            ))}
          </Box>
        </Paper>

        {/* 9. BILLS & RECHARGE */}
        <Paper elevation={0} sx={{ bgcolor: T.white, borderRadius: T.radius, p: 1.5, boxShadow: T.shadow }}>
          <SectionHeader title="Bills &amp; Recharge" />
          <Grid container columns={5} spacing={0}>
            {billCategories.map((b) => (
              <Grid key={b.key} item xs={1}>
                <Box
                  sx={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 0.75, py: 1, cursor: "pointer",
                    "&:active": { transform: "scale(0.94)" },
                    transition: "transform 0.12s",
                  }}
                >
                  <Box sx={{
                    width: 50, height: 50, borderRadius: 13, bgcolor: b.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {React.cloneElement(b.icon, { sx: { fontSize: 24, color: b.color } })}
                  </Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: T.textPrimary, textAlign: "center" }}>
                    {b.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>

      </Stack>
    </Box>
  );
}
