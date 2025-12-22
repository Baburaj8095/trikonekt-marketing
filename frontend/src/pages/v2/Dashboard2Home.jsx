import React, { useEffect, useMemo, useState } from "react";
import { Box, Typography, Grid, Card, CardContent } from "@mui/material";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";
import AppsGrid from "../../components/AppsGrid";

// Assets (same as existing dashboard)
import LOGO from "../../assets/TRIKONEKT.png";
import banner_wg from "../../assets/Wealth_Galaxy.jpg";
import imgGiftCards from "../../assets/gifts.jpg";
import imgEcommerce from "../../assets/ecommerce.jpg";
import imgSpinWin from "../../assets/lucky-draw-img.png";
import imgHolidays from "../../assets/holidays.jpg";
import imgEV from "../../assets/ev-img.jpg";
import imgBillRecharge from "../../assets/google-play-store.png";
import imgPlaystoreScreen from "../../assets/play_store_screen.webp";
import imgFurniture from "../../assets/furniture.jpeg";
import imgProperties from "../../assets/propeties.jpg";

export default function Dashboard2Home({ isPrime = false }) {
  const navigate = useNavigate();

  // Admin-managed cards (same data source as existing dashboard)
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);

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

  const MEDIA_BASE = (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");

  // App items (same list)
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

  return (
    <Box>


      {/* Quick Apps */}
      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#fff", mb: 1 }}>Quick Apps</Typography>
        <CardBox sx={{ p: 1 }}>
          <AppsGrid items={appItemsWithBadge} variant="image" columns={{ xs: 2, sm: 3, md: 4 }} />
        </CardBox>
      </Box>

      {/* Agency Products */}
      <Box sx={{ pt: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#fff", mb: 1 }}>Agency Products</Typography>
        <CardBox sx={{ p: 2 }}>
          {loadingCards ? (
            <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Loading cards...</Typography>
          ) : (
            <Grid container spacing={2}>
              {(Array.isArray(cards) ? cards : [])
                .filter((c) => c.is_active !== false)
                .map((card) => (
                  <Grid key={card.id || card.key} item xs={12} sm={6} md={4}>
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
                  </Grid>
                ))}
            </Grid>
          )}
        </CardBox>
      </Box>
    </Box>
  );
}
