import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";
import AppsRow from "../../components/AppsRow";
import BannerCarousel from "../../components/ui/BannerCarousel";

// MUI Icons for the Quick Action rail (rounded-square icons)
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import ConfirmationNumberRoundedIcon from "@mui/icons-material/ConfirmationNumberRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";

// Assets for TRI Products posters (reuse existing images)
import LOGO from "../../assets/TRIKONEKT.png";
import banner_wg from "../../assets/Wealth_Galaxy.jpg";
import imgGiftCards from "../../assets/gifts.jpg";
import imgEcommerce from "../../assets/asst_1.png";
import imgSpinWin from "../../assets/asst_2.png";
import imgHolidays from "../../assets/holidays.jpg";
import imgEV from "../../assets/ev-img.jpg";
import imgBillRecharge from "../../assets/google-play-store.png";
import imgPlaystoreScreen from "../../assets/play_store_screen.webp";
import imgFurniture from "../../assets/furniture.jpeg";
import imgProperties from "../../assets/propeties.jpg";

/**
 * Dashboard2Home
 * BookMyShow-style dark home:
 * - Top: Hero banner carousel
 * - Quick Actions: horizontal rail (Prime, History, Refer & Earn, Genealogy, Coupons, Merchant Store)
 * - TRI Products: poster-style vertical cards in a horizontal carousel (all products)
 * - Agency Products: horizontal card carousel (admin-configured cards)
 *
 * NOTE: Data sources and navigation handlers are preserved. Only layout/visuals are changed.
 */
export default function Dashboard2Home({ isPrime = false }) {
  const navigate = useNavigate();

  // Admin-managed cards (same data source as existing dashboard)
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);

  // TRI Products (use same /products endpoint as TrikonektProducts page)
  const [triProducts, setTriProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const storedRole = useMemo(
    () => localStorage.getItem("role_user") || sessionStorage.getItem("role_user") || "user",
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/uploads/cards/", { params: { role: storedRole || undefined } });
        if (!mounted) return;
        setCards(Array.isArray(res?.data) ? res.data : []);
      } catch {
        setCards([]);
      } finally {
        if (mounted) setLoadingCards(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [storedRole]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/products", { params: { _: Date.now() } });
        const arr = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
        if (!mounted) return;
        setTriProducts(arr);
      } catch {
        setTriProducts([]);
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const MEDIA_BASE = (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");

  // TRI Products content should be the TRI modules/apps (from first reference image)
  const triAppItems = useMemo(() => [
    { key: "genealogy", label: "Genealogy", route: "/user/my-team", image: LOGO },
    { key: "wealth-galaxy", label: "Wealth Galaxy", route: "/user/wealth-galaxy", image: banner_wg },
    { key: "prime", label: "Prime", route: "/user/promo-packages", image: LOGO, badge: "Prime" },
    { key: "gift-cards", label: "Gift Cards", route: "/user/e-coupon-store", image: imgGiftCards },
    { key: "bill-recharge", label: "Bill & Recharge", comingSoon: true, image: imgBillRecharge },
    { key: "ecommerce", label: "E‑commerce", route: "/trikonekt-products", image: imgEcommerce },
    { key: "tri-holidays", label: "TRI Holidays", route: "/user/tri/tri-holidays", image: imgHolidays },
    { key: "tri-furniture", label: "TRI Furniture", route: "/user/tri/tri-furniture", image: imgFurniture },
    { key: "tri-electronics", label: "TRI Electronics & Home Appliances", route: "/user/tri/tri-electronics", image: imgPlaystoreScreen },
    { key: "tri-properties", label: "TRI Properties", route: "/user/tri/tri-properties", image: imgProperties },
    { key: "tri-spinwin", label: "TRI Spin & Win", route: "/user/lucky-draw", image: imgSpinWin },
    { key: "tri-local-store", label: "Local Store", route: "/user/tri/tri-local-store", image: imgGiftCards },
    { key: "tri-ev", label: "TRI EV Vehicles", route: "/user/tri/tri-ev", image: imgEV },
  ], []);

  // Top horizontal action rail — exact order requested
  const topRailItems = useMemo(() => ([
    {
      key: "prime",
      label: "Prime",
      icon: WorkspacePremiumRoundedIcon,
      route: "/user/promo-packages",
      badgeText: isPrime ? "Prime" : "Non‑Prime",
      tone: "brand",
    },
    {
      key: "history",
      label: "History",
      icon: HistoryRoundedIcon,
      // keep navigation behavior the same (v2 tab)
      route: "/user/dashboard2?tab=history",
      tone: "brand",
    },
    {
      key: "refer",
      label: "Refer & Earn",
      icon: GroupAddRoundedIcon,
      route: "/user/refer-earn",
      tone: "brand",
    },
    {
      key: "genealogy",
      label: "Genealogy",
      icon: AccountTreeRoundedIcon,
      route: "/user/my-team",
      tone: "brand",
    },
    {
      key: "coupons",
      label: "Coupons",
      icon: ConfirmationNumberRoundedIcon,
      route: "/user/e-coupon-store",
      tone: "brand",
    },
    {
      key: "merchant_store",
      label: "Merchant Store",
      icon: StorefrontRoundedIcon,
      route: "/merchant-marketplace",
      tone: "brand",
    },
  ]), [isPrime]);

  // TRI Product card — square, premium, uncluttered
  const TriItemCard = ({ image, title, badge, onClick, disabled }) => (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",                 // perfect square
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        borderRadius: 1.25,                    // 10px
        overflow: "hidden",
        bgcolor: "#121214",                    // dark background
        border: "1px solid rgba(212,175,55,0.15)", // subtle golden accent
        boxShadow: "0 8px 20px rgba(0,0,0,0.28)",  // soft shadow
        display: "flex",
        flexDirection: "column",
        "&:active": { transform: "scale(0.98)" },
      }}
    >
      {/* Image fills the square */}
      <Box sx={{ position: "relative", flex: "1 1 auto", width: "100%" }}>
        <Box
          component="img"
          src={image}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",              // HD cover
            display: "block",
            borderRadius: 0,                 // no circular/oval clipping
          }}
        />
        {badge ? (
          <Box
            sx={{
              position: "absolute",
              top: 10,
              right: 10,
              bgcolor: "var(--bms-gold-2)",
              color: "#111",
              px: 1,
              py: 0.5,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid rgba(212,175,55,0.4)",
            }}
          >
            {badge}
          </Box>
        ) : null}
      </Box>

      {/* Title centered below the image */}
      <Box
        sx={{
          flex: "0 0 auto",
          textAlign: "center",
          py: 1,
          px: 1,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, rgba(255,215,0,0.05) 0%, rgba(255,215,0,0) 100%)",
        }}
      >
        <Typography
          sx={{
            color: "#EDEDED",
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={title}
        >
          {title}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box>

      {/* PRIMARY ICON STRIP (above banner, no title) */}
      <Box sx={{ pt: 1, px: 2 }}>
        <AppsRow items={topRailItems} size="sm" shape="icon" />
      </Box>

      {/* HERO BANNER (rectangular, autoplay, dots, side peek) */}
      <Box sx={{ pt: 1 }}>
        <BannerCarousel rounded={false} height={{ xs: 200, sm: 240, md: 300 }} autoPlayMs={4500} />
      </Box>

      {/* 3) TRI PRODUCTS — 2-column premium grid, no horizontal scroll */}
      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: "var(--bms-text-1)", mb: 1, px: 2 }}>
          TRI Products
        </Typography>

        <Box sx={{ px: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",     // 2-column layout
              gap: { xs: 2, sm: 2.5 },                   // 16–20px
              overflowX: "hidden",                        // ensure no horizontal scroll
            }}
          >
            {triAppItems.map((it) => (
              <TriItemCard
                key={it.key}
                image={it.image}
                title={it.label}
                badge={it.badge || (it.comingSoon ? "Soon" : undefined)}
                onClick={() => {
                  if (!it.comingSoon && it.route) navigate(it.route);
                }}
                disabled={Boolean(it.comingSoon)}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* 4) AGENCY PRODUCTS — horizontal carousel style retained */}
      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: "var(--bms-text-1)", mb: 1, px: 2 }}>
          Agency Products
        </Typography>

        {loadingCards ? (
          <Card
            elevation={0}
            sx={{
              mx: 2,
              p: 2,
              bgcolor: "#111827",
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Loading cards...
          </Card>
        ) : (
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              overflowX: "auto",
              pb: 1,
              px: 2,
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {(Array.isArray(cards) ? cards : [])
              .filter((c) => c.is_active !== false)
              .map((card) => (
                <Box
                  key={card.id || card.key}
                  sx={{
                    minWidth: 240,
                    maxWidth: 280,
                    flex: "0 0 auto",
                    scrollSnapAlign: "start",
                  }}
                >
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 2,
                      backgroundColor: "#111827",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#e5e7eb",
                      boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/trikonekt-products")}
                  >
                    {card.image ? (
                      <Box
                        component="img"
                        src={card.image?.startsWith("http") ? card.image : `${MEDIA_BASE}${card.image}`}
                        alt={card.title}
                        sx={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                      />
                    ) : null}
                    <CardContent sx={{ flexGrow: 1, p: 2 }}>
                      <Typography sx={{ fontWeight: 700, mb: 0.5, fontSize: 14, color: "#fff" }}>
                        {card.title}
                      </Typography>
                      <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                        {card.description || ""}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
