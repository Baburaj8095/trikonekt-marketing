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

/* Premium golden icons for TRI Products (unified, no photos/screenshots) */
import {
  ECommerceIcon,
  GenealogyIcon,
  EVIcon,
  GiftCardIcon,
  BillRechargeIcon,
  WealthGalaxyIcon,
  PrimeIcon,
  SpinWinIcon,
  LocalStoreIcon,
} from "../../components/ui/icons/TriIcons";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";

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
    { key: "genealogy", label: "Genealogy", route: "/user/my-team", icon: <GenealogyIcon /> },
    { key: "wealth-galaxy", label: "Wealth Galaxy", route: "/user/wealth-galaxy", icon: <WealthGalaxyIcon /> },
    { key: "prime", label: "Prime", route: "/user/promo-packages", icon: <PrimeIcon /> },
    { key: "gift-cards", label: "Gift Cards", route: "/user/e-coupon-store", icon: <GiftCardIcon /> },
    { key: "bill-recharge", label: "Bill & Recharge", icon: <BillRechargeIcon /> },
    { key: "ecommerce", label: "E‑commerce", route: "/trikonekt-products", icon: <ECommerceIcon /> },
    { key: "tri-holidays", label: "TRI Holidays", route: "/user/tri/tri-holidays", icon: <ECommerceIcon /> },
    { key: "tri-furniture", label: "TRI Furniture", route: "/user/tri/tri-furniture", icon: <LocalStoreIcon /> },
    { key: "tri-electronics", label: "TRI Electronics & Home Appliances", route: "/user/tri/tri-electronics", icon: <ECommerceIcon /> },
    { key: "tri-properties", label: "TRI Properties", route: "/user/tri/tri-properties", icon: <LocalStoreIcon /> },
    { key: "tri-spinwin", label: "TRI Spin & Win", route: "/user/lucky-draw", icon: <SpinWinIcon /> },
    { key: "tri-local-store", label: "Local Store", route: "/user/tri/tri-local-store", icon: <LocalStoreIcon /> },
    { key: "tri-ev", label: "TRI EV Vehicles", route: "/user/tri/tri-ev", icon: <EVIcon /> },
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

  // TRI Product card — square, premium, uncluttered (icon + label only)
  const TriItemCard = ({ icon, title, onClick, disabled }) => (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        borderRadius: "14px", // 14px
        overflow: "hidden",
        bgcolor: "var(--bms-bg-2)",
        border: "1px solid rgba(212,175,55,0.12)",
        boxShadow: "inset 0 0 26px rgba(212,175,55,0.06), 0 4px 16px rgba(0,0,0,0.32)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 1.5,
        "&:active": { transform: "scale(0.98)" },
      }}
    >
      {/* Centered golden icon */}
      <Box
        sx={{
          flex: "1 1 auto",
          display: "grid",
          placeItems: "center",
          width: "100%",
          color: "var(--bms-gold-2)",
          "& svg": { width: 62, height: 62 },
        }}
      >
        {icon}
      </Box>

      {/* Title below icon */}
      <Box sx={{ flex: "0 0 auto", width: "100%", textAlign: "center", py: 1 }}>
        <Typography
          sx={{
            color: "var(--bms-text-1)",
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
          }}
          title={title}
        >
          {title}
        </Typography>
      </Box>

      {/* Optional subtle arrow bottom-right */}
      <Box
        sx={{
          position: "absolute",
          right: 10,
          bottom: 10,
          width: 22,
          height: 22,
          display: "grid",
          placeItems: "center",
          color: "var(--bms-gold-2)",
          opacity: 0.7,
        }}
      >
        <ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />
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
      <Box sx={{ pt: 1, mb: 2 }}>
        <BannerCarousel rounded={false} height={{ xs: 200, sm: 240, md: 300 }} autoPlayMs={4500} showTitle={false} />
      </Box>

      {/* 3) TRI PRODUCTS — 2-column premium grid, no horizontal scroll */}
      <Box sx={{ pt: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: "var(--bms-text-1)", mb: 1, px: 2 }}>
          TRI Products
        </Typography>
        <Box sx={{ height: 1, backgroundColor: "var(--bms-accent)", opacity: 0.2, mx: 2, mb: 2.25 }} />

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
                icon={it.icon}
                title={it.label}
                onClick={() => {
                  if (it.route) navigate(it.route);
                }}
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
              bgcolor: "var(--bms-bg-2)",
                      borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--bms-text-2)",
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
                      borderRadius: "12px",
                      backgroundColor: "var(--bms-bg-2)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--bms-text-1)",
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
                      <Typography sx={{ fontWeight: 700, mb: 0.5, fontSize: 14, color: "var(--bms-text-1)" }}>
                        {card.title}
                      </Typography>
                      <Typography sx={{ color: "var(--bms-text-2)", fontSize: 13 }}>
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
