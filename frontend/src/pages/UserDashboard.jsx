import React, { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Badge,
  Button,
  Grid,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { useNavigate } from "react-router-dom";

import PromoStrip from "../components/PromoStrip";
import CategoryStrip from "../components/CategoryStrip";
import ProductStrip from "../components/ProductStrip";
import BillsAndRecharge from "../components/BillsAndRecharge";
import SmartImage from "../components/SmartImage2";

import API, {
  listMyPromoPurchases,
  listHeroBanners,
  listPromotions,
  listCategoryBanners,
  getNearbyShops,
  getPublicShops,
} from "../api/api";

// IMAGE IMPORTS  fallbacks
import heroImg from "../assets/Wealth_Galaxy.jpg";
import promoImg1 from "../assets/spin1.png";
import promoImg2 from "../assets/asst_2.png";

import electronicsImg from "../assets/electronics-img.jpg";
import furnitureImg from "../assets/furniture.jpeg";
import evImg from "../assets/ev-img.jpg";
import holidaysImg from "../assets/thailand.jpg";

export default function UserDashboard({ embedded = false }) {
  const navigate = useNavigate();

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
          (pos) => load({ lat: pos.coords.latitude, lng: pos.coords.longitude, radius_km: 5 }),
          () => load(),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } else {
        load();
      }
    } catch (_) {
      load();
    }
    return () => {
      alive = false;
    };
  }, []);

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

  const heroSrc = heroBanners[0] || heroImg;

  const promos = useMemo(() => {
    const arr = [];
    if (promotionsAdmin["tri-spinwin"]) arr.push({ image: promotionsAdmin["tri-spinwin"] });
    if (promotionsAdmin["prime"]) arr.push({ image: promotionsAdmin["prime"] });
    if (arr.length) return arr;
    return [{ image: promoImg1 }, { image: promoImg2 }];
  }, [promotionsAdmin]);

  // Categories for CategoryStrip (routes preserved; onClick navigates to route)
  const categories = useMemo(() => {
    const keys = ["tri-electronics", "tri-furniture", "tri-ev", "tri-holidays"];
    return keys
      .map((k) => itemByKey[k])
      .filter(Boolean)
      .map((it) => ({
        label: it.label,
        image: it.image,
        route: it.route,
      }));
  }, [itemByKey]);

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
      // Fallback for other platforms (Windows/Linux/etc.): open Play Store web URL
      window.location.href =
        "https://play.google.com/store/apps/details?id=com.mywealth.galaxy";
    } catch (_) {
      // As a last resort, attempt Play Store web URL
      window.location.href =
        "https://play.google.com/store/apps/details?id=com.mywealth.galaxy";
    }
  };

  return (
    <Box sx={{ bgcolor: "#f1f5f9", minHeight: "100vh" }}>
      {/* HEADER */}
      {/* <AppBar position="sticky" elevation={1} sx={{ bgcolor: "#fff", color: "#000" }}>
        <Toolbar>
          <IconButton edge="start">
            <MenuIcon />
          </IconButton>

          <Box
            sx={{
              flex: 1,
              mx: 1,
              bgcolor: "#f1f5f9",
              borderRadius: 1,
              px: 1.5,
              py: 0.75,
              fontSize: 14,
              color: "#64748b",
            }}
          >
            Search products”¦
          </Box>

          <IconButton>
            <Badge badgeContent={0} color="error">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar> */}

      {/* CONTENT */}
      <Box px={2} pb={3}>
        {/* HERO */}
        <Box mt={2}>
          <SmartImage type="hero" src={heroSrc} />
        </Box>

        {/* PROMOTIONS */}
        <PromoStrip promos={promos} />

        {/* CATEGORIES */}
        <CategoryStrip categories={categories} onClick={(route) => navigate(route)} />

        {/* LOCAL SHOPS */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Local Shops
            </Typography>
            <Button size="small" onClick={() => navigate("/user/tri/tri-local-store")}>
              View all
            </Button>
          </Box>

          <Grid container spacing={1.25}>
            {(nearbyShops || []).slice(0, 5).map((s) => (
              <Grid key={s.id} item xs={6} sm={4} md={3}>
                <Box
                  onClick={() => navigate(`/merchant-marketplace/shops/${encodeURIComponent(s.id)}`)}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: "#fff",
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    "&:hover": { borderColor: "#cbd5e1", bgcolor: "#fafafa" },
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      bgcolor: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {s.logo ? (
                      <img
                        src={s.logo}
                        alt={s.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <StorefrontIcon fontSize="small" color="primary" />
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={s.name}>
                      {s.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      title={s.category_slug || ""}
                    >
                      {(s.category_slug || "local").replaceAll("-", " ")}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
            {(nearbyShops || []).length === 0 ? (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  No nearby shops found.
                </Typography>
              </Grid>
            ) : null}
          </Grid>
        </Box>

        {/* PRODUCTS */}
        <ProductStrip title="Electronics" products={electronicsProducts} />

        <ProductStrip title="Furniture" products={furnitureProducts} />

        <ProductStrip title="EV Vehicles" products={evProducts} />

        {/* BILLS */}
        <BillsAndRecharge onItemClick={handleOpenWealthGalaxy} />
      </Box>
    </Box>
  );
}
