import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  InputBase,
  Paper,
  Rating,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsBell from "../components/NotificationsBell";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import MicNoneOutlinedIcon from "@mui/icons-material/MicNoneOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import NearMeOutlinedIcon from "@mui/icons-material/NearMeOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import StarOutlineOutlinedIcon from "@mui/icons-material/StarOutlineOutlined";
import SearchIcon from "@mui/icons-material/Search";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import ShoppingBasketOutlinedIcon from "@mui/icons-material/ShoppingBasketOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import FlightTakeoffOutlinedIcon from "@mui/icons-material/FlightTakeoffOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useNavigate } from "react-router-dom";

import ProductStrip from "../components/ProductStrip";
import BillsAndRecharge from "../components/BillsAndRecharge";
import SmartImage from "../components/SmartImage2";
import PrimeStrip from "../components/PrimeBadge";
import { getItems as getCartItems, subscribe as subscribeCart } from "../store/cart";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";

import { BottomNavigation, BottomNavigationAction } from "@mui/material";
import { useLocation } from "react-router-dom";


import API, {
  listMyPromoPurchases,
  listHeroBanners,
  listPromotions,
  listCategoryBanners,
  getNearbyShops,
  getPublicShops,
} from "../api/api";

// IMAGE IMPORTS  fallbacks
import heroImg from "../assets/homepage_banner.png";
import promoImg1 from "../assets/spin1.png";
import promoImg2 from "../assets/asst_2.png";

import electronicsImg from "../assets/electronics-img.jpg";
import furnitureImg from "../assets/furniture.jpeg";
import evImg from "../assets/ev-img.jpg";
import holidaysImg from "../assets/thailand.jpg";

// ─── Design tokens (layout/visual only) ─────────────────────────────────────
const T = {
  bg: "#F5F6FA",
  white: "#FFFFFF",
  primary: "#FF6B35",
  textPrimary: "#1A1D2E",
  textSecondary: "#6B7280",
  border: "#EAECF0",
  shadow: "0 2px 12px rgba(0,0,0,0.07)",
  radius: 2,
};

// ─── Reusable section header ─────────────────────────────────────────────────
function SectionHeader({ title, onViewAll }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 800, color: T.textPrimary, letterSpacing: "-0.2px" }}>
        {title}
      </Typography>
      {onViewAll && (
        <Button
          endIcon={<ChevronRightIcon sx={{ fontSize: 15 }} />}
          onClick={onViewAll}
          size="small"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: 13,
            color: T.primary,
            px: 0,
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

export default function UserDashboard({ embedded = false }) {
  const navigate = useNavigate();


  const location = useLocation();

  const getTabFromPath = (path) => {
    if (path.includes("/explore")) return 1;
    if (path.includes("/cart")) return 2;
    if (path.includes("/orders")) return 3;
    if (path.includes("/profile")) return 4;
    return 0;
  };

  const [tab, setTab] = useState(getTabFromPath(location.pathname));

  useEffect(() => {
    setTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  // ── All business logic below is UNCHANGED ────────────────────────────────

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";
  const initials = useMemo(() => {
    const n = String(displayName || "C").trim();
    const parts = n.split(" ").filter(Boolean);
    const a = parts[0]?.[0] || "C";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (a + b).toUpperCase();
  }, [displayName]);

  // Cart count from centralized cart store (same as /user/cart page)
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const compute = () => {
      try {
        const items = getCartItems();
        const cnt = (items || []).reduce(
          (sum, it) => sum + Math.max(0, Number(it.qty || 0)),
          0
        );
        setCartCount(Number.isFinite(cnt) ? cnt : 0);
      } catch {
        setCartCount(0);
      }
    };
    const unsub = subscribeCart(() => compute());
    compute();
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, []);

  // MEDIA BASE to resolve relative URLs from API to absolute URLs
  const MEDIA_BASE = useMemo(
    () => String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, ""),
    []
  );
  const resolveImage = useMemo(
    () => (url) => {
      if (!url) return url;
      const s = String(url);
      if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) return s;
      return `${MEDIA_BASE}${s}`;
    },
    [MEDIA_BASE]
  );

  // Prime purchase state (business logic only; UI unchanged)
  const [purchasedPrime150, setPurchasedPrime150] = useState(false);
  const [purchasedPrime750, setPurchasedPrime750] = useState(false);
  const [purchasedMonthly, setPurchasedMonthly] = useState(false);
  const isPrime = purchasedPrime150 || purchasedPrime750 || purchasedMonthly;

  // Search (UI-only)
  const [searchText, setSearchText] = useState("");

  // Location bar (UI-only label; coordinates are already used for Nearby Shops)
  const [locLabel, setLocLabel] = useState("Detecting location...");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listMyPromoPurchases();
        const list = Array.isArray(res) ? res : res?.results || [];
        const valid = (list || []).filter((pp) => String(pp?.status || "").toUpperCase() === "APPROVED");
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
        if (!alive) return;
        setPurchasedPrime150(has150);
        setPurchasedPrime750(has750);
        setPurchasedMonthly(hasMonthly);
      } catch (_) {
        if (!alive) return;
        setPurchasedPrime150(false);
        setPurchasedPrime750(false);
        setPurchasedMonthly(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Admin-configured media and banners
  const [heroBannersAdmin, setHeroBannersAdmin] = useState([]);
  const [promotionsAdmin, setPromotionsAdmin] = useState({});
  const [categoryBannersAdmin, setCategoryBannersAdmin] = useState({});
  // Nearby consumer-visible shops (ACTIVE)
  const [nearbyShops, setNearbyShops] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Hero banners
      try {
        const hb = await listHeroBanners();
        const arr = Array.isArray(hb) ? hb : hb?.results || [];
        const urls = arr
          .filter((x) => x?.is_active !== false)
          .sort((a, b) => (a?.order || 0) - (b?.order || 0))
          .map((x) => x?.image_url || x?.image)
          .filter(Boolean)
          .map(resolveImage);
        if (alive) setHeroBannersAdmin(urls);
      } catch (_) {
        if (alive) setHeroBannersAdmin([]);
      }

      // Promotions
      try {
        const res = await listPromotions({ params: { keys: "prime,tri-spinwin" } });
        const arr = Array.isArray(res) ? res : res?.results || [];
        const map = {};
        arr.forEach((p) => {
          const key = String(p?.key || "").toLowerCase();
          const img = p?.image_url || p?.image;
          if (key && img) map[key] = resolveImage(img);
        });
        if (alive) setPromotionsAdmin(map);
      } catch (_) {
        if (alive) setPromotionsAdmin({});
      }

      // Category banners
      try {
        const res = await listCategoryBanners({
          params: { keys: "tri-electronics,tri-furniture,tri-ev,tri-holidays" },
        });
        const arr = Array.isArray(res) ? res : res?.results || [];
        const map = {};
        arr.forEach((c) => {
          const key = String(c?.key || "");
          const img = c?.image_url || c?.image;
          if (key && img) map[key] = resolveImage(img);
        });
        if (alive) setCategoryBannersAdmin(map);
      } catch (_) {
        if (alive) setCategoryBannersAdmin({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [resolveImage]);

  // Load 5 nearby shops (best-effort geolocation; fallback to recent shops)
  useEffect(() => {
    let alive = true;
    async function load(params = {}) {
      try {
        // Attempt nearby within given radius (default 5km)
        const res = await getNearbyShops({ limit: 5, ...params });
        let arr = Array.isArray(res) ? res : res?.results || [];

        // If empty and we had coordinates, widen radius to 50km
        if ((!arr || arr.length === 0) && params.lat != null && params.lng != null) {
          try {
            const resWide = await getNearbyShops({
              limit: 5,
              lat: params.lat,
              lng: params.lng,
              radius_km: 50,
            });
            arr = Array.isArray(resWide) ? resWide : resWide?.results || [];
          } catch (_) {}
        }

        // Final fallback: show latest ACTIVE shops from public list
        if (!arr || arr.length === 0) {
          try {
            const res2 = await getPublicShops({ page: 1 });
            const raw = Array.isArray(res2) ? res2 : res2?.results || [];
            arr = (raw || []).slice(0, 5).map((s) => ({
              id: s.id,
              name: s.shop_name,
              logo: s.image_url || null,
              category_slug: null,
              distance_km: null,
              address: s.address || "",
            }));
          } catch (_) {}
        }

        if (alive) setNearbyShops(arr || []);
      } catch (_) {
        if (alive) setNearbyShops([]);
      }
    }
    try {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            try {
              setLocLabel("Using current location");
            } catch {}
            load({ lat: pos.coords.latitude, lng: pos.coords.longitude, radius_km: 5 });
          },
          () => {
            try {
              setLocLabel("Set delivery location");
            } catch {}
            load();
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } else {
        try {
          setLocLabel("Set delivery location");
        } catch {}
        load();
      }
    } catch (_) {
      try {
        setLocLabel("Set delivery location");
      } catch {}
      load();
    }
    return () => {
      alive = false;
    };
  }, []);

  const handleNearMe = () => {
    try {
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      setLocLabel("Detecting location...");
      navigator.geolocation.getCurrentPosition(
        () => {
          window.location.reload();
        },
        () => setLocLabel("Set delivery location"),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } catch (_) {}
  };

  // Base app items (only categories and holidays needed here)
  const appItems = useMemo(
    () => [
      { key: "tri-electronics", label: "Electronics", route: "/user/tri/tri-electronics", image: electronicsImg },
      { key: "tri-furniture", label: "Furniture", route: "/user/tri/tri-furniture", image: furnitureImg },
      { key: "tri-ev", label: "EV", route: "/user/tri/tri-ev", image: evImg },
      { key: "tri-holidays", label: "Holidays", route: "/user/tri/tri-holidays", image: holidaysImg },
    ],
    []
  );

  // Apply admin overrides for category images
  const appItemsFinal = useMemo(
    () =>
      appItems.map((it) => {
        let image = it.image;
        if (categoryBannersAdmin[it.key]) image = categoryBannersAdmin[it.key];
        return { ...it, image };
      }),
    [appItems, categoryBannersAdmin]
  );

  const itemByKey = useMemo(
    () => Object.fromEntries((appItemsFinal || []).map((i) => [i.key, i])),
    [appItemsFinal]
  );

  // Derived data for UI components (UI stays identical; only sources become dynamic)
  const heroBanners = useMemo(() => {
    const admin = (heroBannersAdmin || []).filter(Boolean);
    if (admin.length) return admin;
    return [heroImg];
  }, [heroBannersAdmin]);

  const categoryCards = useMemo(
    () => [
      {
        key: "tri-electronics",
        label: "Electronics",
        route: "/user/tri/tri-electronics",
        image: itemByKey["tri-electronics"]?.image || electronicsImg,
      },
      {
        key: "tri-furniture",
        label: "Furniture",
        route: "/user/tri/tri-furniture",
        image: itemByKey["tri-furniture"]?.image || furnitureImg,
      },
      {
        key: "tri-ev",
        label: "EV",
        route: "/user/tri/tri-ev",
        image: itemByKey["tri-ev"]?.image || evImg,
      },
      {
        key: "tri-holidays",
        label: "Holiday",
        route: "/user/tri/tri-holidays",
        image: itemByKey["tri-holidays"]?.image || holidaysImg,
      },
    ],
    [itemByKey]
  );

  // Product strips reuse dynamic category images; keep titles/prices to maintain UI/UX
  const electronicsProducts = useMemo(() => {
    const el = itemByKey["tri-electronics"];
    const img = el?.image || electronicsImg;
    return [
      { id: 1, title: "Smart 4K TV", price: 24999, mrp: 29999, image: img },
      { id: 2, title: "Bluetooth Speaker", price: 2999, mrp: 3999, image: img },
    ];
  }, [itemByKey]);

  const furnitureProducts = useMemo(() => {
    const it = itemByKey["tri-furniture"];
    const img = it?.image || furnitureImg;
    return [
      { id: 3, title: "Modern Sofa", price: 35999, mrp: 45999, image: img },
      { id: 4, title: "Wooden Chair", price: 7999, mrp: 9999, image: img },
    ];
  }, [itemByKey]);

  const evProducts = useMemo(() => {
    const it = itemByKey["tri-ev"];
    const img = it?.image || evImg;
    return [
      { id: 5, title: "E-Bike", price: 89999, mrp: 99999, image: img },
      { id: 6, title: "EV Scooter", price: 109999, mrp: 124999, image: img },
    ];
  }, [itemByKey]);

  const productSectionRoute = useMemo(() => {
    return {
      electronics: "/user/tri/tri-electronics",
      furniture: "/user/tri/tri-furniture",
      ev: "/user/tri/tri-ev",
    };
  }, []);

  // Promotional carousel state (UI-only)
  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    if (!heroBanners.length) return;
    const id = setInterval(() => {
      setHeroIdx((p) => (p + 1) % heroBanners.length);
    }, 4500);
    return () => clearInterval(id);
  }, [heroBanners.length]);

  // UI (unchanged)
  const handleOpenWealthGalaxy = () => {
    try {
      const ua =
        (typeof navigator !== "undefined" && (navigator.userAgent || navigator.vendor)) ||
        "";
      const isAndroid = /Android/i.test(ua);
      const isIOS =
        /iPad|iPhone|iPod/i.test(ua) ||
        (typeof navigator !== "undefined" &&
          navigator.platform === "MacIntel" &&
          navigator.maxTouchPoints > 1);
      const isMac = /Macintosh|Mac OS X/i.test(ua);

      if (isAndroid) {
        window.location.href =
          "https://play.google.com/store/apps/details?id=com.mywealth.galaxy";
        return;
      }
      if (isIOS || isMac) {
        window.location.href =
          "https://apps.apple.com/in/app/my-wealth-galaxy/id6473733826";
        return;
      }
      window.location.href =
        "https://play.google.com/store/apps/details?id=com.mywealth.galaxy";
    } catch (_) {
      window.location.href =
        "https://play.google.com/store/apps/details?id=com.mywealth.galaxy";
    }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────

  return (
    <Box sx={{ bgcolor: T.bg, minHeight: "100vh", maxWidth: 430, mx: "auto" }}>

      {/* ── STICKY HEADER ─────────────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: T.white,
          px: 2,
          pt: 1.75,
          pb: 1.25,
          position: "static",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 0 #EAECF0",
        }}
      >
        {/* Top row: avatar + name + action icons */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                bgcolor: T.primary,
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              {initials}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 11, color: T.textSecondary, fontWeight: 600, lineHeight: 1 }}>
                Welcome back
              </Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, lineHeight: 1.35 }}>
                {displayName}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        {/* Search bar */}
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            alignItems: "center",
            bgcolor: T.bg,
            borderRadius: 50,
            border: `1.5px solid ${T.border}`,
            px: 1.5,
            py: 0.6,
            gap: 0.75,
          }}
        >
          <SearchIcon sx={{ fontSize: 20, color: T.textSecondary, flexShrink: 0 }} />
          <InputBase
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search products"
            sx={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.textPrimary }}
          />
          {isPrime ? (
            <Box
              sx={{
                bgcolor: "#dcfce7",
                color: "#166534",
                px: 1,
                py: 0.25,
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              ✓ Prime
            </Box>
          ) : (
            <Button
              size="small"
              variant="contained"
              onClick={() => navigate("/user/promo-packages")}
              sx={{
                textTransform: "none",
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 11,
                px: 1.25,
                py: 0.5,
                minWidth: "auto",
                whiteSpace: "nowrap",
                flexShrink: 0,
                background: "linear-gradient(90deg,#f59e0b,#ef4444)",
                boxShadow: "0 8px 18px rgba(239,68,68,0.20)",
                "&:hover": { background: "linear-gradient(90deg,#d97706,#dc2626)" },
              }}
            >
              Join Prime
            </Button>
          )}
          <IconButton size="small" sx={{ p: 0.5 }}>
            <MicNoneOutlinedIcon sx={{ fontSize: 20, color: T.textSecondary }} />
          </IconButton>
          <IconButton size="small" sx={{ p: 0.5 }}>
            <CameraAltOutlinedIcon sx={{ fontSize: 20, color: T.textSecondary }} />
          </IconButton>
        </Paper>
      </Box>

      {/* ── PAGE SECTIONS ─────────────────────────────────────────────── */}
      <Stack spacing={1.5} sx={{ px: 0.1, pt: 1, pb: 10 }}>

        {/* 3) LOCATION BAR — commented out as in original */}
        {/* <Paper ... /> */}

        {/* 4) PRIME MEMBERSHIP — commented out as in original */}
        {/* <PrimeStrip isPrime={isPrime} onJoinClick={() => navigate("/user/promo-packages")} /> */}

        {/* 5) SERVICES */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: T.radius,
            bgcolor: T.white,
            boxShadow: T.shadow,
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: T.textPrimary, mb: 1.25 }}>
            Services
          </Typography>

          <Box
            sx={{
              display: "flex",
              gap: 1.25,
              overflowX: "auto",
              pb: 0.5,
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {[
              { label: "Tri Eat", icon: <RestaurantOutlinedIcon />, route: "/user/tri/tri-eat", color: "#FF6B35", bg: "#FFF0EB" },
              { label: "Tri Basket", icon: <ShoppingBasketOutlinedIcon />, route: "/user/tri/tri-basket", color: "#6C47FF", bg: "#F0ECFF" },
              { label: "Pick & Drop", icon: <LocalShippingOutlinedIcon />, route: "/user/tri/pick-drop", color: "#059669", bg: "#D1FAE5" },
              { label: "Tri Mechanic", icon: <HandymanOutlinedIcon />, route: "/user/tri/tri-mechanic", color: "#D97706", bg: "#FFFBEB" },
              { label: "Tri Broker", icon: <HomeWorkOutlinedIcon />, route: "/user/tri/tri-broker", color: "#0891B2", bg: "#ECFEFF" },
              { label: "Job Quicker", icon: <WorkOutlineOutlinedIcon />, route: "/user/tri/job-quicker", color: "#7C3AED", bg: "#F5F3FF" },
              { label: "Travel & Stay", icon: <FlightTakeoffOutlinedIcon />, route: "/user/tri/tri-holidays", color: "#2563EB", bg: "#EFF6FF" },
              { label: "Recharge & Bills", icon: <ReceiptLongOutlinedIcon />, route: null, color: "#DC2626", bg: "#FEF2F2" },
            ].map((s) => (
              <Box
                key={s.label}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (s.route) navigate(s.route);
                  else {
                    const el = document.getElementById("bills-and-recharge");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                sx={{
                  minWidth: 72,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.75,
                  cursor: "pointer",
                  py: 0.75,
                  "&:active": { transform: "scale(0.94)" },
                  transition: "transform 0.12s",
                }}
              >
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 13,
                    bgcolor: s.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {React.cloneElement(s.icon, { sx: { fontSize: 24, color: s.color } })}
                </Box>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "center",
                    lineHeight: 1.2,
                    color: T.textPrimary,
                  }}
                >
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        {/* 6) HERO BANNER */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: T.radius,
            bgcolor: T.white,
            overflow: "hidden",
            boxShadow: T.shadow,
          }}
        >
          <Box sx={{ position: "relative" }}>
            <SmartImage type="hero" src={heroBanners[heroIdx] || heroImg} />
            <Box
              sx={{
                position: "absolute",
                left: 12,
                bottom: 12,
                bgcolor: "rgba(15,23,42,0.55)",
                color: "#fff",
                px: 1,
                py: 0.5,
                borderRadius: 2,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              Explore • Shop • Save
            </Box>
          </Box>
          {heroBanners.length > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 0.6, py: 1 }}>
              {heroBanners.slice(0, 6).map((_, i) => (
                <Box
                  key={`dot-${i}`}
                  onClick={() => setHeroIdx(i)}
                  sx={{
                    width: i === heroIdx ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    cursor: "pointer",
                    bgcolor: i === heroIdx ? T.primary : "#CBD5E1",
                    transition: "all 0.25s",
                  }}
                />
              ))}
            </Box>
          )}
        </Paper>

        {/* 7) SPIN & REWARDS */}

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

        {/* 8) SHOP BY CATEGORIES */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: T.radius,
            bgcolor: T.white,
            boxShadow: T.shadow,
          }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: T.textPrimary, mb: 1.25 }}>
            Shop by Categories
          </Typography>

          <Grid container spacing={1}>
            {categoryCards.map((c) => (
              <Grid key={c.key} item xs={3}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(c.route)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(c.route);
                    }
                  }}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.75,
                    p: 0.75,
                    borderRadius: 3,
                    cursor: "pointer",
                    textAlign: "center",
                    "&:active": { transform: "scale(0.94)" },
                    transition: "transform 0.12s",
                  }}
                >
                  <Box
                    sx={{
                      width: 58,
                      height: 58,
                      mx: "auto",
                      borderRadius: 14,
                      overflow: "hidden",
                      bgcolor: "#F1F5F9",
                      border: `1px solid ${T.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={c.image}
                      alt={c.label}
                      style={{ width: 36, height: 36, objectFit: "contain", display: "block" }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2 }} noWrap>
                    {c.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* 9) LOCAL SHOPS */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: T.radius,
            bgcolor: T.white,
            boxShadow: T.shadow,
          }}
        >
          <SectionHeader
            title="Local Shops"
            onViewAll={() => navigate("/user/tri/tri-local-store")}
          />

          <Box
            sx={{
              display: "flex",
              gap: 1.25,
              overflowX: "auto",
              pb: 0.5,
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {(nearbyShops || []).slice(0, 5).map((s) => {
              const dist = s?.distance_km != null ? `${Number(s.distance_km).toFixed(1)} km` : null;
              return (
                <Paper
                  key={s.id}
                  elevation={0}
                  onClick={() => navigate(`/merchant-marketplace/shops/${encodeURIComponent(s.id)}`)}
                  sx={{
                    minWidth: 210,
                    maxWidth: 210,
                    p: 1.25,
                    borderRadius: T.radius,
                    border: `1px solid ${T.border}`,
                    cursor: "pointer",
                    flexShrink: 0,
                    "&:active": { bgcolor: T.bg },
                    transition: "background 0.12s",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: 12,
                        bgcolor: T.bg,
                        overflow: "hidden",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {s.logo ? (
                        <img src={s.logo} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <StorefrontIcon sx={{ fontSize: 22, color: T.primary }} />
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 13, color: T.textPrimary }} noWrap title={s.name}>
                        {s.name}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                        <Rating value={4.5} precision={0.5} readOnly size="small" />
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>
                          4.5
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontSize: 11, color: T.textSecondary, fontWeight: 600 }} noWrap>
                        {dist ? `${dist} • ` : ""}{(s.address || "").trim() || "Near you"}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
            {(nearbyShops || []).length === 0 ? (
              <Box sx={{ p: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  No nearby shops found.
                </Typography>
              </Box>
            ) : null}
          </Box>
        </Paper>

        {/* 10) PRODUCT SECTIONS */}
        <ProductStrip
          title="Electronics"
          products={electronicsProducts}
          onViewAll={() => navigate(productSectionRoute.electronics)}
          onAddToCart={() => navigate(productSectionRoute.electronics)}
          showAddToCart
        />

        <ProductStrip
          title="Furniture"
          products={furnitureProducts}
          onViewAll={() => navigate(productSectionRoute.furniture)}
          onAddToCart={() => navigate(productSectionRoute.furniture)}
          showAddToCart
        />

        <ProductStrip
          title="EV Vehicles"
          products={evProducts}
          onViewAll={() => navigate(productSectionRoute.ev)}
          onAddToCart={() => navigate(productSectionRoute.ev)}
          showAddToCart
        />

        {/* 11) UTILITIES */}
        <Box id="bills-and-recharge">
          <BillsAndRecharge onItemClick={handleOpenWealthGalaxy} />
        </Box>

      </Stack>

      <Paper
  elevation={8}
  sx={{
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 430,
    borderTop: "1px solid #EAECF0",
    zIndex: 1000,
  }}
>
  <BottomNavigation
    value={tab}
    onChange={(e, newValue) => {
      setTab(newValue);

      if (newValue === 0) navigate("/user/home");
      if (newValue === 1) navigate("/user/promo-packages");
      if (newValue === 2) navigate("/user/cart");
      if (newValue === 3) navigate("/user/history");
      if (newValue === 4) navigate("/user/profile");
    }}
    showLabels
    sx={{
      height: 64,
    }}
  >
    <BottomNavigationAction label="Home" icon={<HomeOutlinedIcon />} />
    <BottomNavigationAction label="Prime" icon={<TravelExploreOutlinedIcon />} />
    <BottomNavigationAction
      label="Cart"
      icon={
        <Badge badgeContent={cartCount} color="error">
          <ShoppingCartOutlinedIcon />
        </Badge>
      }
    />
    <BottomNavigationAction label="History" icon={<ReceiptLongOutlinedIcon />} />
    <BottomNavigationAction label="Profile" icon={<PersonOutlineOutlinedIcon />} />
  </BottomNavigation>
</Paper>

    </Box>
  );
}
