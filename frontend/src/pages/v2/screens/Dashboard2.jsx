import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Grid, Card, CardContent } from "@mui/material";
import V2Button from "../components/V2Button";
import colors from "../theme/colors";
import spacing from "../theme/spacing";
import shadows from "../theme/shadows";

import API, { listMyPromoPurchases } from "../../../api/api";

// Assets
import LOGO from "../../../assets/TRIKONEKT.png";
import banner_wg from "../../../assets/Wealth_Galaxy.jpg";
import imgGiftCards from "../../../assets/gifts.jpg";
import imgEcommerce from "../../../assets/ecommerce.jpg";
import imgSpinWin from "../../../assets/lucky-draw-img.png";
import imgHolidays from "../../../assets/holidays.jpg";
import imgEV from "../../../assets/ev-img.jpg";
import imgBillRecharge from "../../../assets/google-play-store.png";
import imgPlaystoreScreen from "../../../assets/play_store_screen.webp";
import imgFurniture from "../../../assets/furniture.jpeg";
import imgProperties from "../../../assets/propeties.jpg";

// Shared/components
import AppsGrid from "../../../components/AppsGrid";
import V2Scaffold from "../components/V2Scaffold";
import V2SectionCard from "../components/V2SectionCard";

// Sections reused from pages
import AppHub from "../../AppHub";
import EBooks from "../../EBooks";

/**
 * Dashboard2 (V2)
 * - Copies the logic from UserDashboardV2.jsx
 * - Uses shared V2Scaffold (header+bottom nav) and V2SectionCard
 */
export default function Dashboard2() {
  const navigate = useNavigate();

  // Stored user/role
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
  const displayEmail = storedUser?.email || `${displayName}@example.com`;
  const displayId = storedUser?.user_id || storedUser?.id || "-";

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
    } catch (_) {}
    navigate("/", { replace: true });
  };

  // Admin-managed cards
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  useEffect(() => {
    let isMounted = true;
    async function fetchCards() {
      try {
        const res = await API.get("/uploads/cards/", { params: { role: storedRole || undefined } });
        if (!isMounted) return;
        setCards(Array.isArray(res?.data) ? res.data : []);
      } catch {
        setCards([]);
      } finally {
        if (isMounted) setLoadingCards(false);
      }
    }
    fetchCards();
    return () => {
      isMounted = false;
    };
  }, [storedRole]);

  // Promo purchase flags
  const [purchasedPrime150, setPurchasedPrime150] = useState(false);
  const [purchasedPrime750, setPurchasedPrime750] = useState(false);
  const [purchasedMonthly, setPurchasedMonthly] = useState(false);

  const loadPromoPurchases = async () => {
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
      setPurchasedPrime150(has150);
      setPurchasedPrime750(has750);
      setPurchasedMonthly(hasMonthly);
    } catch {
      setPurchasedPrime150(false);
      setPurchasedPrime750(false);
      setPurchasedMonthly(false);
    }
  };
  useEffect(() => {
    loadPromoPurchases();
  }, []);
  const isPrime = purchasedPrime150 || purchasedPrime750 || purchasedMonthly;
  const MEDIA_BASE = (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");

  // Apps
  const appItems = React.useMemo(
    () => [
      { key: "genealogy", label: "Genealogy", route: "/user/my-team", image: LOGO },
      { key: "wealth-galaxy", label: "Wealth Galaxy", route: "/user/wealth-galaxy", image: banner_wg },
      { key: "prime", label: "Prime", route: "/user/promo-packages", image: LOGO },
      { key: "bill-recharge", label: "Bill & Recharge", comingSoon: true, image: imgBillRecharge },
      { key: "ecommerce", label: "E‑commerce", route: "/trikonekt-products", image: imgEcommerce },
      { key: "tri-holidays", label: "TRI Holidays", route: "/user/tri/tri-holidays", image: imgHolidays },
      { key: "tri-furniture", label: "TRI Furniture", route: "/user/tri/tri-furniture", image: imgFurniture },
      { key: "tri-electronics", label: "TRI Electronics", route: "/user/tri/tri-electronics", image: imgPlaystoreScreen },
      { key: "tri-properties", label: "TRI Properties", route: "/user/tri/tri-properties", image: imgProperties },
      { key: "tri-spinwin", label: "TRI Spin & Win", route: "/user/lucky-draw", image: imgSpinWin },
      { key: "tri-local-store", label: "Local Store", route: "/user/tri/tri-local-store", image: imgGiftCards },
      { key: "tri-ev", label: "TRI EV Vehicles", route: "/user/tri/tri-ev", image: imgEV },
    ],
    []
  );

  const appItemsWithBadge = React.useMemo(
    () =>
      appItems.map((it) =>
        it.key === "prime"
          ? {
              ...it,
              badgeText: isPrime ? "Prime" : "Non‑Prime",
              badgeBg: isPrime ? colors.success : colors.mutedBg,
              badgeFg: colors.textOnDark,
            }
          : it
      ),
    [appItems, isPrime]
  );

  // A simple stat tile
  const StatTile = ({ title, value }) => (
    <V2SectionCard>
      <Typography sx={{ fontSize: 12, color: colors.textMuted }}>{title}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: colors.textOnDark, mt: 0.5 }}>{value}</Typography>
    </V2SectionCard>
  );

  return (
    <V2Scaffold
      displayEmail={displayEmail}
      displayId={displayId}
      isPrime={isPrime}
      onLogout={handleLogout}
      withBottomNav
    >
      {/* Quick Actions */}
      <V2SectionCard sx={{ p: 1 }}>
        <Grid container spacing={1}>
          <Grid item xs={4}>
            <V2Button
              variant="secondary"
              onClick={() => navigate("/user/history")}
              fullWidth
            >
              Earnings
            </V2Button>
          </Grid>
          <Grid item xs={4}>
            <V2Button
              variant="secondary"
              onClick={() => navigate("/user/wallet")}
              fullWidth
            >
              Withdrawal
            </V2Button>
          </Grid>
          <Grid item xs={4}>
            <V2Button
              variant="secondary"
              onClick={() => navigate("/user/refer-earn")}
              fullWidth
            >
              Refer & Earn
            </V2Button>
          </Grid>
        </Grid>
      </V2SectionCard>

      {/* Promo Packages Banner */}
      <Box sx={{ pt: 2 }}>
        <Box
          sx={{
            position: "relative",
            borderRadius: 2,
            overflow: "hidden",
            border: `1px solid ${colors.border}`,
            boxShadow: shadows.card,
            cursor: "pointer",
            bgcolor: colors.surface,
          }}
          onClick={() => navigate("/user/promo-packages")}
        >
          <Box
            component="img"
            src={banner_wg}
            alt="Promotional Packages"
            sx={{
              width: "100%",
              display: "block",
              objectFit: "cover",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: colors.overlayGradient,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: "80%", sm: "60%" } }}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: colors.textOnDark, mb: 0.5 }}>
                Explore Prime Packages
              </Typography>
              <Typography sx={{ fontSize: 12, color: colors.textMuted, mb: 1.5 }}>
                Unlock exclusive benefits and start your growth journey today.
              </Typography>
              <V2Button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/user/promo-packages");
                }}
              >
                View Packages
              </V2Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Summary cards */}
      <Box sx={{ pt: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <V2SectionCard>
              <Typography sx={{ fontSize: 12, color: colors.textMuted }}>Main Wallet</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: colors.textOnDark, mt: 0.5 }}>ADA —</Typography>
            </V2SectionCard>
          </Grid>
          <Grid item xs={12} sm={4}>
            <V2SectionCard>
              <Typography sx={{ fontSize: 12, color: colors.textMuted }}>Status</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: colors.textOnDark, mt: 0.5 }}>
                {isPrime ? "Active" : "Not Active"}
              </Typography>
            </V2SectionCard>
          </Grid>
          <Grid item xs={12} sm={4}>
            <V2SectionCard>
              <Typography sx={{ fontSize: 12, color: colors.textMuted }}>Grade</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: colors.textOnDark, mt: 0.5 }}>0 — Stars</Typography>
            </V2SectionCard>
          </Grid>
        </Grid>
      </Box>

      {/* Stats grid */}
      <Box sx={{ pt: 2 }}>
        <Grid container spacing={1.2}>
          {[
            { title: "Today Profit", value: "ADA 0.0000" },
            { title: "Total Profit", value: "ADA 0.0000" },
            { title: "Direct Income", value: "ADA 0" },
            { title: "Level Income", value: "ADA 0" },
            { title: "Direct Withdrawal Income", value: "ADA 0" },
            { title: "Level Upgrade Bonus Income", value: "ADA 0" },
            { title: "Royalty Withdrawal Bonus", value: "ADA 0" },
            { title: "Autopool Beginner", value: "ADA 0" },
            { title: "Autopool Phase 1", value: "ADA 0" },
            { title: "Autopool Phase 2", value: "ADA 0" },
            { title: "Autopool Phase 3", value: "ADA 0" },
            { title: "Recurring 6 Income", value: "ADA 0" },
            { title: "Recurring 9 Income", value: "ADA 0" },
            { title: "Fasttrack Income", value: "ADA 0" },
            { title: "Fasttrack Upgrade Income", value: "ADA 0" },
            { title: "Fasttrack Direct Income", value: "ADA 0" },
          ].map((it, idx) => (
            <Grid key={idx} item xs={12} sm={6}>
              <StatTile title={it.title} value={it.value} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Quick Apps */}
      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: colors.textOnDark, mb: 1 }}>Quick Apps</Typography>
        <V2SectionCard sx={{ p: 1 }}>
          <AppsGrid items={appItemsWithBadge} variant="image" columns={{ xs: 2, sm: 3, md: 4 }} />
        </V2SectionCard>
      </Box>

      {/* Marketplace (Agency Products) */}
      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: colors.textOnDark, mb: 1 }}>Agency Products</Typography>
        <V2SectionCard sx={{ p: 2 }}>
          {loadingCards ? (
            <Typography sx={{ color: colors.textMuted }}>Loading cards...</Typography>
          ) : (
            <Grid container spacing={2}>
              {(Array.isArray(cards) ? cards : [])
                .filter((c) => c.is_active !== false)
                .map((card) => (
                  <Grid item xs={12} sm={6} md={4} key={card.id || card.key}>
                    <Card
                      sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 2,
                        backgroundColor: colors.surface,
                        border: `1px solid ${colors.border}`,
                        color: colors.textPrimary,
                        boxShadow: shadows.card,
                        overflow: "hidden",
                      }}
                      onClick={() => navigate("/trikonekt-products")}
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
                            borderBottom: `1px solid ${colors.border}`,
                          }}
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1, p: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: 14, color: colors.textOnDark }}>
                          {card.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: colors.textMuted }}>
                          {card.description || ""}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
            </Grid>
          )}
        </V2SectionCard>
      </Box>

      {/* App Hub and E‑Books */}
      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: colors.textOnDark, mb: 1 }}>App Hub</Typography>
        <V2SectionCard>
          <AppHub />
        </V2SectionCard>
      </Box>

      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: colors.textOnDark, mb: 1 }}>E‑Books</Typography>
        <V2SectionCard>
          <EBooks />
        </V2SectionCard>
      </Box>

      {/* Profile Shortcuts */}
      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: colors.textOnDark, mb: 1 }}>Profile</Typography>
        <V2SectionCard sx={{ p: 0 }}>
          {[
            { label: "Account Info", to: "/user/profile" },
            { label: "My Directs", to: "/user/my-team" },
            { label: "My Team", to: "/user/my-team" },
            { label: "My Team Count", to: "/user/my-team" },
            { label: "My Level", to: "/user/my-team" },
            { label: "My Packages", to: "/user/promo-packages" },
            { label: "App Download", to: "/user/app-hub" },
            { label: "About Us", to: "/user/support" },
            { label: "Help & Support", to: "/user/support" },
          ].map((item, idx, arr) => (
            <Box
              key={item.label}
              onClick={() => navigate(item.to)}
              sx={{
                px: 2,
                py: 1.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                "&:hover": { bgcolor: colors.mutedBg },
                borderBottom: idx < arr.length - 1 ? `1px solid ${colors.borderWeak}` : "none",
              }}
            >
              <Typography sx={{ fontSize: 14, color: colors.textPrimary }}>{item.label}</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.6 }}>›</Typography>
            </Box>
          ))}
        </V2SectionCard>
      </Box>
    </V2Scaffold>
  );
}
