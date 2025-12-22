import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Avatar,
  Divider,
} from "@mui/material";

// Reuse the same data sources and logic as UserDashboard.jsx
import API, { listMyPromoPurchases } from "../api/api";

// Assets and components reused from the current dashboard
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

import AppsGrid from "../components/AppsGrid";
import AppHub from "./AppHub";
import EBooks from "./EBooks";

// Icons for demo footer nav
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";

/**
 * UserDashboardV2
 * - Functionality parity with UserDashboard.jsx (same hooks, data loading, and app items)
 * - New dark, mobile-first UX layout as per the shared mock
 * - No changes to existing files; this is a brand-new page
 *
 * NOTE: Route snippet to register: 
 *   import UserDashboardV2 from "./pages/UserDashboardV2";
 *   <Route path="/user/dashboard2" element={
 *     <ProtectedRoute allowedRoles={["user"]}>
 *       <ConsumerShell>
 *         <UserDashboardV2 />
 *       </ConsumerShell>
 *     </ProtectedRoute>
 *   } />
 */
export default function UserDashboardV2() {
  const navigate = useNavigate();

  // =============== Stored user/role (same as in UserDashboard.jsx) ===============
  const storedUser = useMemo(() => {
    try {
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const parsed = ls ? JSON.parse(ls) : {};
      return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object"
        ? parsed.user
        : parsed;
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

  // =============== Admin-managed cards (same API call as in UserDashboard.jsx) ===============
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

  // =============== Promo purchase flags (same logic) ===============
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

  // =============== Apps (same list as in UserDashboard.jsx) ===============
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
              badgeBg: isPrime ? "#16a34a" : "#6b7280",
              badgeFg: "#fff",
            }
          : it
      ),
    [appItems, isPrime]
  );

  // =============== UI Helpers ===============
  const CardBox = ({ children, ...sx }) => (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "#1e232d",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        ...sx,
      }}
    >
      {children}
    </Box>
  );

  // A simple stat tile
  const StatTile = ({ title, value }) => (
    <Card
      elevation={0}
      sx={{
        bgcolor: "#1f2530",
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.06)",
        color: "#cbd5e1",
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Typography sx={{ fontSize: 12, opacity: 0.9 }}>{title}</Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#fff", mt: 0.5 }}>{value}</Typography>
      </CardContent>
    </Card>
  );

  // =============== Render ===============
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0d1117",
        color: "#e5e7eb",
        pb: 9, // space for bottom nav
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          pt: 2,
          pb: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "#0d1117",
        }}
      >
        <Avatar sx={{ bgcolor: "#f59e0b", color: "#111827", width: 44, height: 44 }}>
          <PersonRoundedIcon />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
            {displayEmail}
          </Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>ID: {String(displayId)}</Typography>
        </Box>
        <Chip
          size="small"
          label={isPrime ? "Prime" : "Non‑Prime"}
          sx={{
            bgcolor: isPrime ? "#16a34a" : "rgba(255,255,255,0.12)",
            color: "#fff",
            fontWeight: 700,
          }}
        />
        <Button
          size="small"
          onClick={handleLogout}
          sx={{
            ml: 1,
            color: "#111827",
            bgcolor: "#facc15",
            "&:hover": { bgcolor: "#eab308" },
            textTransform: "none",
            fontWeight: 700,
          }}
          startIcon={<LogoutRoundedIcon />}
        >
          Sign Out
        </Button>
      </Box>

      {/* Summary cards */}
      <Box sx={{ px: 2, pt: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <CardBox>
              <Typography sx={{ fontSize: 12, opacity: 0.8 }}>Main Wallet</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#fff", mt: 0.5 }}>ADA —</Typography>
            </CardBox>
          </Grid>
          <Grid item xs={12} sm={4}>
            <CardBox>
              <Typography sx={{ fontSize: 12, opacity: 0.8 }}>Status</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#fff", mt: 0.5 }}>
                {isPrime ? "Active" : "Not Active"}
              </Typography>
            </CardBox>
          </Grid>
          <Grid item xs={12} sm={4}>
            <CardBox>
              <Typography sx={{ fontSize: 12, opacity: 0.8 }}>Grade</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#fff", mt: 0.5 }}>0 — Stars</Typography>
            </CardBox>
          </Grid>
        </Grid>
      </Box>

      {/* Stats grid */}
      <Box sx={{ px: 2, pt: 2 }}>
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

      {/* Quick Apps (reuses the same functionality from UserDashboard.jsx) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#fff", mb: 1 }}>Quick Apps</Typography>
        <CardBox sx={{ p: 1 }}>
          <AppsGrid
            items={appItemsWithBadge}
            variant="image"
            columns={{ xs: 2, sm: 3, md: 4 }}
          />
        </CardBox>
      </Box>

      {/* Marketplace (Agency Products) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#fff", mb: 1 }}>Agency Products</Typography>
        <CardBox sx={{ p: 2 }}>
          {loadingCards ? (
            <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Loading cards...</Typography>
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
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                      )}
                      <CardContent sx={{ flexGrow: 1, p: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, fontSize: 14, color: "#fff" }}>
                          {card.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
                          {card.description || ""}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
            </Grid>
          )}
        </CardBox>
      </Box>

      {/* App Hub and E‑Books sections (embed to preserve original functionality access) */}
      <Box sx={{ px: 2, pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#fff", mb: 1 }}>App Hub</Typography>
        <CardBox>
          <AppHub />
        </CardBox>
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#fff", mb: 1 }}>E‑Books</Typography>
        <CardBox>
          <EBooks />
        </CardBox>
      </Box>

      {/* Profile Shortcuts */}
      <Box sx={{ px: 2, pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#fff", mb: 1 }}>Profile</Typography>
        <CardBox sx={{ p: 0 }}>
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
                "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <Typography sx={{ fontSize: 14, color: "#e5e7eb" }}>{item.label}</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.6 }}>›</Typography>
            </Box>
          ))}
        </CardBox>
      </Box>

      {/* Bottom Nav (fixed) */}
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: "#111827",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          height: 64,
          zIndex: 20,
        }}
      >
        <BottomItem icon={<HomeRoundedIcon />} label="Home" active onClick={() => navigate("/user/dashboard2")} />
        <BottomItem
          icon={<AccountBalanceWalletRoundedIcon />}
          label="Withdraw"
          onClick={() => navigate("/user/wallet")}
        />
        <BottomItem icon={<AppsRoundedIcon />} label="Package" onClick={() => navigate("/user/promo-packages")} />
        <BottomItem icon={<AddCircleOutlineRoundedIcon />} label="Deposit" onClick={() => navigate("/user/wallet")} />
        <BottomItem icon={<HistoryRoundedIcon />} label="History" onClick={() => navigate("/user/history")} />
      </Box>
    </Box>
  );
}

// Footer nav item
function BottomItem({ icon, label, active, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        color: active ? "#facc15" : "#e5e7eb",
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        gap: 0.5,
        cursor: "pointer",
        "&:active": { transform: "scale(0.98)" },
      }}
    >
      <Box sx={{ fontSize: 0 }}>{icon}</Box>
      <Typography sx={{ fontSize: 12 }}>{label}</Typography>
    </Box>
  );
}
