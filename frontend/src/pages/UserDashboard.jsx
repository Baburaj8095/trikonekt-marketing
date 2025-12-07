import React, { useEffect, useState, useMemo } from "react";
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
  Chip
} from "@mui/material";
import API, { listMyPromoPurchases, getMyEBooks } from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";
import banner_wg from "../assets/Wealth_Galaxy.jpg";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReferAndEarn from "../components/ReferAndEarn";
import AppHub from "./AppHub";
import RewardPointsCard from "../components/RewardPointsCard";
import APP_STORE from "../assets/app-store.png";
import GOOGLE_STORE from "../assets/google-play-store.png";
import PLAY_STORE_SCREEN from "../assets/play_store_screen.webp";

const drawerWidth = 220;

const gradients = [
  "linear-gradient(135deg, #01091bff 0%, #10b981 100%)",
  "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #059669 0%, #06b6d4 100%)",
  "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)"
];

/**
 * Colored KPI card palette (aligned to Admin dashboard cards)
 */
function paletteStyles(key) {
  switch (key) {
    case "indigo":
      return {
        bg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        border: "rgba(99,102,241,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(99,102,241,0.35)",
      };
    case "blue":
      return {
        bg: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)",
        border: "rgba(59,130,246,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(59,130,246,0.35)",
      };
    case "green":
      return {
        bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        border: "rgba(16,185,129,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(16,185,129,0.35)",
      };
    case "red":
      return {
        bg: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
        border: "rgba(244,63,94,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(244,63,94,0.35)",
      };
    case "purple":
      return {
        bg: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
        border: "rgba(124,58,237,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(124,58,237,0.35)",
      };
    case "cyan":
      return {
        bg: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)",
        border: "rgba(14,165,233,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.9)",
        shadow: "0 8px 18px rgba(14,165,233,0.35)",
      };
    case "amber":
      return {
        bg: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        border: "rgba(245,158,11,0.35)",
        text: "#0f172a",
        sub: "rgba(15,23,42,0.75)",
        shadow: "0 8px 18px rgba(245,158,11,0.35)",
      };
    case "teal":
      return {
        bg: "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)",
        border: "rgba(20,184,166,0.35)",
        text: "#0f172a",
        sub: "rgba(15,23,42,0.75)",
        shadow: "0 8px 18px rgba(20,184,166,0.35)",
      };
    default:
      return {
        bg: "#ffffff",
        border: "#e2e8f0",
        text: "#0f172a",
        sub: "#64748b",
        shadow: "0 1px 2px rgba(0,0,0,0.06)",
      };
  }
}

function KpiCard({ title, value, subtitle, onClick, palette = "blue" }) {
  const pal = paletteStyles(palette);
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        cursor: onClick ? "pointer" : "default",
        background: pal.bg,
        border: `1px solid ${pal.border}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: pal.shadow,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 8,
        color: pal.text,
        height: 144,
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 22px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = pal.shadow;
      }}
    >
      <div style={{ fontSize: "clamp(11px, 2.8vw, 12px)", fontWeight: 800, letterSpacing: 0.3, opacity: 0.95, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {title}
      </div>
      <div style={{ fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 900, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
      {subtitle ? (
        <div style={{ fontSize: "clamp(11px, 2.6vw, 12px)", color: pal.sub, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

// Modern pricing tier card for Promo Packages (Twitter/X-like styling)
function PricingTierCard({
  tierName,
  price,
  features = [],
  highlighted = false,
  owned = false,
  onClick,
}) {
  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          p: 0.75,
          borderRadius: 3,
          background: highlighted
            ? "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)"
            : "linear-gradient(135deg, #e2e8f0, #e2e8f0)",
          boxShadow: highlighted ? "0 10px 24px rgba(124,58,237,0.25)" : "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <Box
          sx={{
            borderRadius: 2,
            p: 2,
            bgcolor: "#0f172a",
            color: "#e5e7eb",
            border: "1px solid",
            borderColor: "rgba(255,255,255,0.08)",
            minHeight: 220,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <Typography variant="subtitle2" sx={{ letterSpacing: 0.3, fontWeight: 800, color: "#93c5fd" }}>
              {tierName}
            </Typography>
            {highlighted ? (
              <Box
                sx={{
                  fontSize: 11,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: "rgba(124,58,237,0.18)",
                  color: "#c4b5fd",
                  fontWeight: 700,
                }}
              >
                Popular
              </Box>
            ) : null}
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 900, color: "#ffffff", mb: 1 }}>
            {price}
          </Typography>

          <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, display: "grid", gap: 0.75 }}>
            {features.map((f, idx) => (
              <Box
                component="li"
                key={idx}
                sx={{ display: "flex", alignItems: "center", gap: 1, color: "#cbd5e1", fontSize: 13 }}
              >
                <CheckCircleIcon sx={{ fontSize: 16, color: "#22c55e" }} /> {f}
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: "auto", pt: 1 }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={onClick}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Buy Now
            </Button>
          </Box>

          {owned ? (
            <Box
              sx={{
                position: "absolute",
                top: 10,
                right: 10,
                fontSize: 11,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: "#dcfce7",
                color: "#166534",
                fontWeight: 700,
              }}
            >
              Owned
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

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
  const isMarketplace =
    location.pathname === "/marketplace" || location.pathname.startsWith("/marketplace/");
  const isMyOrders = location.pathname === "/user/my-orders" || location.pathname === "/marketplace/my-orders";
  const isECoupon = location.pathname === "/user/redeem-coupon";
  const isWallet = location.pathname === "/user/wallet";
  const isKYC = location.pathname === "/user/kyc";
  const isMyTeam = location.pathname === "/user/my-team";

  const [selectedMenu, setSelectedMenu] = useState("dashboard");

  useEffect(() => {
    if (isDashboard) setSelectedMenu("dashboard");
    else if (isLuckyDraw) setSelectedMenu("lucky-draw");
    else if (isMarketplace) setSelectedMenu("marketplace");
    else if (isMyOrders) setSelectedMenu("my-orders");
    else if (isECoupon) setSelectedMenu("e-coupon");
    else if (isWallet) setSelectedMenu("wallet");
    else if (isKYC) setSelectedMenu("kyc");
    else if (isMyTeam) setSelectedMenu("my-team");
  }, [isDashboard, isLuckyDraw, isMarketplace, isMyOrders, isECoupon, isWallet, isKYC, isMyTeam]);

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
  const myReferralId = useMemo(() => {
    try {
      // Show the consumer's own referral identifier (prefer prefixed_id, fallback to username)
      const own =
        storedUser?.prefixed_id ||
        storedUser?.username ||
        (storedUser && storedUser.user && (storedUser.user.prefixed_id || storedUser.user.username)) ||
        "";
      return String(own).trim();
    } catch {
      return "";
    }
  }, [storedUser]);

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

  // My Wallet and E‑Coupon codes for KPI cards
  const [wallet, setWallet] = useState({ balance: "0" });
  const [codes, setCodes] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [referralCommissionTotal, setReferralCommissionTotal] = useState(0);
  const [walletDirectReferralTotal, setWalletDirectReferralTotal] = useState(0);
  // E‑Coupon consumer summary for dashboard cards
  const [ecSummary, setEcSummary] = useState(null);
  const [ecSummaryLoading, setEcSummaryLoading] = useState(false);
  const [ecSummaryError, setEcSummaryError] = useState("");
  // My E‑Books
  const [ebooks, setEbooks] = useState([]);
  const [ebooksLoading, setEbooksLoading] = useState(false);
  const [ebooksError, setEbooksError] = useState("");

  // Promo package purchase ticks
  const [promoPurchases, setPromoPurchases] = useState([]);
  const [purchasedPrime150, setPurchasedPrime150] = useState(false);
  const [purchasedPrime750, setPurchasedPrime750] = useState(false);
  const [purchasedMonthly, setPurchasedMonthly] = useState(false);

  // Account activation status
  const [activation, setActivation] = useState(null);
  const [activationLoading, setActivationLoading] = useState(false);
  const [activating50, setActivating50] = useState(false);

  const loadWallet = async () => {
    try {
      const res = await API.get("/accounts/wallet/me/");
      setWallet({
        balance: res?.data?.balance ?? "0",
      });
    } catch (e) {
      setWallet({ balance: "0" });
    }
  };

  const loadCodes = async () => {
    try {
      setCodesLoading(true);
      const res = await API.get("/coupons/codes/mine/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setCodes(arr || []);
    } catch (e) {
      setCodes([]);
    } finally {
      setCodesLoading(false);
    }
  };

  const loadMyCommissions = async () => {
    try {
      const res = await API.get("/coupons/commissions/mine/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      const valid = (arr || []).filter((c) =>
        ["earned", "paid"].includes(String(c.status || "").toLowerCase())
      );
      const referral = valid.filter(
        (c) => !c.coupon_code || !String(c.coupon_code).trim()
      );
      const total = referral.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      setReferralCommissionTotal(total);
    } catch (e) {
      setReferralCommissionTotal(0);
    }
  };

  const loadWalletDirectCommission = async () => {
    try {
      const res = await API.get("/accounts/team/summary/");
      const valStr = res?.data?.totals?.direct_referral ?? "0";
      const total = Number(valStr) || 0;
      setWalletDirectReferralTotal(total);
    } catch (e) {
      setWalletDirectReferralTotal(0);
    }
  };

  const loadActivationStatus = async () => {
    try {
      setActivationLoading(true);
      const res = await API.get("/business/activation/status/");
      setActivation(res?.data || {});
    } catch (e) {
      setActivation(null);
    } finally {
      setActivationLoading(false);
    }
  };

  // Load E‑Coupon consumer summary for dashboard
  const loadEcSummary = async () => {
    try {
      setEcSummaryLoading(true);
      setEcSummaryError("");
      const res = await API.get("/coupons/codes/consumer-summary/");
      setEcSummary(res?.data || null);
    } catch (e) {
      setEcSummary(null);
      setEcSummaryError("Failed to load E‑Coupon summary.");
    } finally {
      setEcSummaryLoading(false);
    }
  };

  const loadMyEBooks = async () => {
    try {
      setEbooksLoading(true);
      setEbooksError("");
      const res = await getMyEBooks();
      const raw = Array.isArray(res) ? res : (res?.results || []);
      // Flatten API shape: EBookAccess -> { ebook: { id, title, cover_url, file_url } }
      const flat = (raw || []).map((it) => {
        const eb = (it && typeof it === "object" && (it.ebook || it)) || {};
        let cu = eb.cover_url || eb.coverUrl || null;
        let fu = eb.file_url || eb.fileUrl || null;
        // Normalize relative URLs -> absolute, using API base without /api
        if (cu && typeof cu === "string" && !/^https?:\/\//i.test(cu)) {
          cu = `${MEDIA_BASE}${cu}`;
        }
        if (fu && typeof fu === "string" && !/^https?:\/\//i.test(fu)) {
          fu = `${MEDIA_BASE}${fu}`;
        }
        return {
          id: eb.id ?? it?.id,
          title: eb.title || "E‑Book",
          cover_url: cu,
          file_url: fu,
        };
      });
      setEbooks(flat || []);
    } catch (e) {
      setEbooks([]);
      setEbooksError("Failed to load e‑books.");
    } finally {
      setEbooksLoading(false);
    }
  };

  const handleSelf50Activation = async () => {
    try {
      setActivating50(true);
      await API.post("/business/activations/self-50/", {});
      await Promise.all([loadWallet(), loadActivationStatus()]);
      try {
        window.alert("50 activation triggered successfully.");
      } catch (_e) {}
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to activate.";
      try {
        window.alert(String(msg));
      } catch (_e) {}
    } finally {
      setActivating50(false);
    }
  };

  const loadPromoPurchases = async () => {
    try {
      const res = await listMyPromoPurchases();
      const list = Array.isArray(res) ? res : (res?.results || []);
      setPromoPurchases(list || []);
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
      setPromoPurchases([]);
      setPurchasedPrime150(false);
      setPurchasedPrime750(false);
      setPurchasedMonthly(false);
    }
  };

  useEffect(() => {
    loadWallet();
    loadCodes();
    loadMyCommissions();
    loadWalletDirectCommission();
    loadActivationStatus();
    loadEcSummary();
    loadMyEBooks();
    loadPromoPurchases();
  }, []);

  const availableCodes = (codes || []).filter((c) => c.status === "AVAILABLE").length;
  const redeemedCodes = (codes || []).filter((c) => c.status === "REDEEMED").length;
  const assignedCodes = (codes || []).filter((c) => c.status === "ASSIGNED_CONSUMER").length;

  // Role-specific static cards with fallback
  const baseCards = Array.isArray(cards) ? cards : [];
  const computedCards = baseCards.filter(
    (c) => !c.role || !storedRole || String(c.role).toLowerCase() === String(storedRole).toLowerCase()
  );

  const MEDIA_BASE = (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");

  // Direct referral count (consumer)
  const [referralCount, setReferralCount] = useState(0);
  const [referralLoading, setReferralLoading] = useState(false);

  const accountActive = Boolean(activation?.active);
  const accountStatusStr = activationLoading ? "..." : accountActive ? "Active" : "Inactive";
  const accountPalette = accountActive ? "green" : "red";

  const loadReferralCount = async () => {
    try {
      setReferralLoading(true);
      const res = await API.get("/accounts/team/summary/");
      const direct = res?.data?.downline?.direct ?? 0;
      setReferralCount(Number(direct) || 0);
    } catch (e) {
      setReferralCount(0);
    } finally {
      setReferralLoading(false);
    }
  };

  useEffect(() => {
    loadReferralCount();
  }, []);

  // Reusable Marketplace wrapper card with two visual variants
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
          marginTop:"10px"
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
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize:"12px" }} >
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

  // Shared body for the marketplace cards list (admin-managed cards)
  const renderMarketplaceContent = () =>
    loading ? (
      <Typography variant="body1" sx={{ color: "text.secondary" }}>
        Loading cards...
      </Typography>
    ) : (
      <Grid container spacing={2}>
        {computedCards
          .filter((c) => c.is_active !== false)
          .map((card) => (
            <Grid item xs={12} sm={6} md={4} key={card.id || card.key}  sx={{

            '@media (max-width:600px)': {
              minWidth: 0,
              boxSizing: 'border-box',
              width: '100%',
            },
          }}>
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
                    src={
                      card.image?.startsWith("http")
                        ? card.image
                        : `${MEDIA_BASE}${card.image}`
                    }
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

  const PromoPricingCards = ({ onBuy150, onBuy750, onBuyMonthly, purchased150, purchased750, purchasedMonthly }) => {
    const Plan = ({ title, price, headerBg, features = [], onClick, purchased, cta }) => (
      <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 3, height: '100%', overflow: 'hidden', position: 'relative' }}>
        <Box sx={{ p: 2, background: headerBg, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
          <Typography variant="overline" sx={{ letterSpacing: 1, opacity: 0.95 }}>{title}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>{price}</Typography>
            {purchased ? <Chip label="Active" color="success" size="small" sx={{ fontWeight: 700 }} /> : null}
          </Box>
        </Box>
        <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {features.map((f, i) => (
              <li key={i} style={{ color: 'var(--mui-palette-text-secondary)' }}>{f}</li>
            ))}
          </Box>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={onClick}
            sx={{ mt: 'auto', textTransform: 'none', fontWeight: 700 }}
          >
            {cta || 'Buy Now'}
          </Button>
        </CardContent>
      </Card>
    );

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Plan
            title="Prime · Basic"
            price="₹150"
            headerBg="linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%)"
            features={['Prime access', 'Fast approval', 'Starter benefits']}
            onClick={onBuy150}
            purchased={purchased150}
            cta="Buy Prime 150"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Plan
            title="Prime · Premium"
            price="₹750"
            headerBg="linear-gradient(135deg,#10b981 0%,#059669 100%)"
            features={['Premium perks', 'Higher limits', 'Priority support']}
            onClick={onBuy750}
            purchased={purchased750}
            cta="Buy Prime 750"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Plan
            title="Monthly Promo"
            price="Current Month"
            headerBg="linear-gradient(135deg,#a855f7 0%,#7c3aed 100%)"
            features={['Valid for current month', 'Monthly rewards', 'Easy renewal']}
            onClick={onBuyMonthly}
            purchased={purchasedMonthly}
            cta="Buy Monthly"
          />
        </Grid>
      </Grid>
    );
  };

  const WealthGalaxy = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Download Our My Wealth Galaxy Customer App Now</Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>Download our app for the fastest, most convenient way to send Recharge.</Typography>
      <Typography variant="h6" sx={{ mb: 1 }}>Customer App Features:</Typography>
      <Box component="ul" sx={{ pl: 3, mb: 3 }}>
        <li>Recharges</li>
        <li>DTH Bills</li>
        <li>Utility Bills</li>
        <li>Nearest Merchants</li>
        <li>Make payment to the merchants</li>
        <li>Rewards</li>
        <li>Knowledge Galaxy</li>
        <li>Refer & Earn</li>
      </Box>
      <Grid container spacing={{ xs: 2, sm: 2 }} sx={{ mx: { xs: -2, sm: 0 } }}>
            <Grid item xs={12} sm={6}>
              <Box
                component="img"
                src={APP_STORE}
                alt="App Store"
                sx={{
                  width: '100%',
                  cursor: 'pointer',
                  borderRadius: 1,
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: { xs: 'none', sm: 'scale(1.05)' },
                  },
                  '&:active': {
                    transform: { xs: 'scale(0.98)', sm: 'scale(1.05)' },
                  },
                }}
                onClick={() => window.open('https://apps.apple.com/in/app/my-wealth-galaxy/id6473733826', '_blank')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box
                component="img"
                src={GOOGLE_STORE}
                alt="Google Play Store"
                sx={{
                  width: '100%',
                  cursor: 'pointer',
                  borderRadius: 1,
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: { xs: 'none', sm: 'scale(1.05)' },
                  },
                  '&:active': {
                    transform: { xs: 'scale(0.98)', sm: 'scale(1.05)' },
                  },
                }}
                onClick={() => window.open('https://play.google.com/store/apps/details?id=com.mywealth.galaxy', '_blank')}
              />
            </Grid>
          </Grid>
    </Box>
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
            <Tab label="Wealth Galaxy" value="wealth-galaxy" />
            <Tab label="Agency MarketPlace" value="marketplace" />
            <Tab label="App Hub" value="apphub" />
          </Tabs>
        </Box>

        {selectedMenu === "dashboard" ? (
          <>
            {/* KPI Cards (mobile-first: secondary to 2 columns) */}
            <Grid
              container
              wrap="wrap"
              className="kpi-grid"
              spacing={2}
              alignItems="stretch"
              sx={{
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                mb: 2,
                "& > .MuiGrid-item": { minWidth: 0 }
              }}
            >
              {/* Primary - full width */}
              <Grid item xs={12} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <KpiCard
                  title="Account Status"
                  value={activationLoading ? "..." : accountActive ? "Active" : "Inactive"}
                  subtitle={accountActive ? "Autopool enabled" : "Activate to unlock benefits"}
                  palette={accountActive ? "green" : "red"}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <KpiCard
                  title="Wallet Balance"
                  value={`₹${wallet.balance}`}
                  subtitle="Go to Wallet"
                  palette="cyan"
                  onClick={() => navigate("/user/wallet")}
                />
              </Grid>

              {/* Others - keep layout as-is (full width unless listed as secondary) */}
              <Grid item xs={12} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <KpiCard
                  title="Coupon Commission"
                  value={`₹${referralCommissionTotal.toFixed(2)}`}
                  subtitle="Coupon commissions"
                  palette="green"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <KpiCard
                  title="Direct Referral Commission"
                  value={`₹${walletDirectReferralTotal.toFixed(2)}`}
                  subtitle="Wallet earnings from direct referrals"
                  palette="green"
                />
              </Grid>

              {/* Secondary - 2 columns on mobile */}
              {/* <Grid item xs={12} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <PromoPricingCards
                  onBuy150={() => navigate("/user/promo-packages?pkg=prime150")}
                  onBuy750={() => navigate("/user/promo-packages?pkg=prime750")}
                  onBuyMonthly={() => navigate("/user/promo-packages?pkg=monthly")}
                  purchased150={purchasedPrime150}
                  purchased750={purchasedPrime750}
                  purchasedMonthly={purchasedMonthly}
                />
              </Grid> */}
              <Grid item xs={6} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <KpiCard
                  title="My Team"
                  value="Open"
                  subtitle="Grow your network"
                  palette="green"
                  onClick={() => navigate("/user/my-team")}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <PricingTierCard
                  tierName="Prime"
                  price="₹150"
                  features={[
                    "Prime perks enabled",
                    "Basic promo benefits",
                    "Account Activate"
                  ]}
                  highlighted={false}
                  owned={purchasedPrime150}
                  onClick={() => navigate("/user/promo-packages?pkg=prime150")}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <PricingTierCard
                  tierName="Prime"
                  price="₹750"
                  features={[
                    "Prime perks enabled",
                    "Extended promo benefits",
                    "Reward Points of 50k"
                  ]}
                  highlighted={true}
                  owned={purchasedPrime750}
                  onClick={() => navigate("/user/promo-packages?pkg=prime750")}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <PricingTierCard
                  tierName="Monthly Prime"
                  price="Monthly"
                  features={[
                    "Valid for current month",
                    "Monthly perks enabled",
                    "Limited-time benefits"
                  ]}
                  highlighted={false}
                  owned={purchasedMonthly}
                  onClick={() => navigate("/user/promo-packages?pkg=monthly")}
                />
              </Grid>

              {/* Other info - full width */}
              <Grid item xs={12} sm={6} md={4} sx={{
              '@media (max-width:600px)': {
                minWidth: 0,
                boxSizing: 'border-box',
                width: '100%',
              },
            }}>
                <KpiCard
                  title="My Direct Referrals"
                  value={referralLoading ? "..." : referralCount}
                  subtitle="Direct consumers sponsored"
                  palette="indigo"
                />
              </Grid>
            </Grid>

            <Box sx={{ mb: 2 }}>
              <RewardPointsCard />
            </Box>
            {/* My E‑Books */}
            {purchasedPrime150 && (
              <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", mb: 2, border: "1px solid #e2e8f0" }}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
                    My E‑Books
                  </Typography>
                {ebooksLoading ? (
                  <Typography variant="body2">Loading...</Typography>
                ) : ebooksError ? (
                  <Typography variant="body2" color="error">{ebooksError}</Typography>
                ) : (ebooks && ebooks.length > 0) ? (
                  <Grid container spacing={2}>
                    {ebooks.map((eb) => (
                      <Grid key={eb.id} item xs={12} sm={6} md={4}>
                        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 2, p: 1.5 }}>
                          {eb.cover_url ? (
                            <Box component="img" src={eb.cover_url} alt={eb.title || "E‑Book"} sx={{ width: 44, height: 60, objectFit: "cover", borderRadius: 1 }} />
                          ) : null}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, pr: 1 }}>
                              {eb.title || "E‑Book"}
                            </Typography>
                            {eb.file_url ? (
                              <Button
                                size="small"
                                component="a"
                                href={eb.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                variant="outlined"
                                sx={{ mt: 0.5, textTransform: "none" }}
                              >
                                Open
                              </Button>
                            ) : null}
                          </Box>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">No e‑books yet.</Typography>
                )}
              </Box>
            </Box>
            )}
            {/* My E‑Coupon Summary (cards) */}
            <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", mb: 2, border: "1px solid #e2e8f0" }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
                  My E‑Coupon Summary
                </Typography>
                {ecSummaryLoading ? (
                  <Typography variant="body2">Loading...</Typography>
                ) : ecSummaryError ? (
                  <Typography variant="body2" color="error">{ecSummaryError}</Typography>
                ) : ecSummary ? (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
                      <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)", color: "#fff", border: "1px solid rgba(124,58,237,0.35)", boxShadow: "0 8px 18px rgba(124,58,237,0.35)" }}>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>Available</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.available ?? 0}</Typography>
                      </Box>
                    
                    </Grid>


                   
                    <Grid item xs={12} md={6} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
                      <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)", color: "#fff", border: "1px solid rgba(244,63,94,0.35)", boxShadow: "0 8px 18px rgba(244,63,94,0.35)" }}>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>Redeemed</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.redeemed ?? 0}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
                      <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "1px solid rgba(16,185,129,0.35)", boxShadow: "0 8px 18px rgba(16,185,129,0.35)" }}>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>Activated</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.activated ?? 0}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6} sx={{
                      '@media (max-width:600px)': {
                        minWidth: 0,
                        boxSizing: 'border-box',
                        width: "45%",
                        margin: "auto",
                      },
                    }}>
                      <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(59,130,246,0.35)", boxShadow: "0 8px 18px rgba(59,130,246,0.35)" }}>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>Transferred</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.transferred ?? 0}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">No data.</Typography>
                )}
              </Box>
            </Box>
          </>
        ) : selectedMenu === "wealth-galaxy" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <WealthGalaxy />
          </Box>
        ) : selectedMenu === "marketplace" ? (
          <MarketplaceCard
            title="Agency Products"
            variant="plain"
            defaultExpanded
            onViewMarketplace={() => navigate("/marketplace")}
          >
            {renderMarketplaceContent()}
          </MarketplaceCard>
        ) : selectedMenu === "apphub" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <AppHub />
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
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="img" src={LOGO} alt="Trikonekt" sx={{ height: 36 }} />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
              
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

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
            <ListItemButton selected={selectedMenu === "dashboard"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/dashboard"); setMobileOpen(false); }}>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "wealth-galaxy"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { setSelectedMenu("wealth-galaxy"); setMobileOpen(false); }}>
              <ListItemText primary="Wealth Galaxy" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "lucky-draw"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/lucky-draw"); setMobileOpen(false); }}>
              <ListItemText primary="Manual Lucky Coupon" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "marketplace"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/marketplace"); setMobileOpen(false); }}>
              <ListItemText primary="Marketplace" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "e-coupon"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/redeem-coupon"); setMobileOpen(false); }}>
              <ListItemText primary="E-Coupon" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "wallet"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/wallet"); setMobileOpen(false); }}>
              <ListItemText primary="Wallet" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "kyc"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/kyc"); setMobileOpen(false); }}>
              <ListItemText primary="KYC" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "my-team"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/my-team"); setMobileOpen(false); }}>
              <ListItemText primary="My Team" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "my-orders"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => { navigate("/user/my-orders"); setMobileOpen(false); }}>
              <ListItemText primary="My Orders" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>
            
          </Box>
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
            <ListItemButton selected={selectedMenu === "dashboard"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/dashboard")}>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "wealth-galaxy"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => setSelectedMenu("wealth-galaxy")}>
              <ListItemText primary="Wealth Galaxy" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "lucky-draw"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/lucky-draw")}>
              <ListItemText primary="Manual Lucky Coupon" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "marketplace"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/marketplace")}>
              <ListItemText primary="Marketplace" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "e-coupon"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/redeem-coupon")}>
              <ListItemText primary="E-Coupon" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "wallet"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/wallet")}>
              <ListItemText primary="Wallet" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "kyc"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/kyc")}>
              <ListItemText primary="KYC" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "my-team"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/my-team")}>
              <ListItemText primary="My Team" />
            </ListItemButton>
            <ListItemButton selected={selectedMenu === "my-orders"} sx={{ "&.Mui-selected": { backgroundColor: "#E3F2FD", color: "#0C2D48" } }} onClick={() => navigate("/user/my-orders")}>
              <ListItemText primary="My Orders" />
            </ListItemButton>
          </List>
          <Divider />
          <Box sx={{ p: 2, color: "text.secondary", fontSize: 13 }}>
            {/* Cards are controlled in Admin (Uploads → DashboardCards). */}
          </Box>
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
            <Tab label="Wealth Galaxy" value="wealth-galaxy" />
            <Tab label="MarketPlace" value="marketplace" />
            <Tab label="App Hub" value="apphub" />
          </Tabs>
        </Box>

        {selectedMenu === "dashboard" ? (
          <>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}>
              Welcome
            </Typography>

            {/* KPI Cards - Dashboard type */}
            <Grid
              container
              wrap="wrap"
              className="kpi-grid"
              spacing={2}
              alignItems="stretch"
              sx={{
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                mb: 2,
                "& > .MuiGrid-item": { minWidth: 0 }
              }}
            >
              {/* Primary - full width */}
              <Grid item xs={12} sm={6} md={4}>
                <KpiCard
                  title="Account Status"
                  value={accountStatusStr}
                  subtitle={accountActive ? "Autopool enabled" : "Activate to unlock benefits"}
                  palette={accountPalette}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <KpiCard
                  title="Wallet Balance"
                  value={`₹${wallet.balance}`}
                  subtitle="Go to Wallet"
                  palette="cyan"
                  onClick={() => navigate("/user/wallet")}
                />
              </Grid>

              {/* Others - keep layout as-is (full width unless listed as secondary) */}
              <Grid item xs={12} sm={6} md={4}>
                <KpiCard
                  title="Coupon Commission"
                  value={`₹${referralCommissionTotal.toFixed(2)}`}
                  subtitle="Coupon commissions"
                  palette="green"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <KpiCard
                  title="Direct Referral Commission"
                  value={`₹${walletDirectReferralTotal.toFixed(2)}`}
                  subtitle="Wallet earnings from direct referrals"
                  palette="green"
                />
              </Grid>

              {/* Secondary - 2 columns on mobile */}
              <Grid item xs={6} sm={6} md={4}>
                <KpiCard
                  title="E‑Coupons Available"
                  value={availableCodes}
                  subtitle={`Assigned: ${assignedCodes} • Redeemed: ${redeemedCodes}`}
                  palette="purple"
                  onClick={() => navigate("/user/redeem-coupon")}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={4}>
                <KpiCard
                  title="Marketplace"
                  value="Open"
                  subtitle="Explore products"
                  palette="blue"
                  onClick={() => navigate("/marketplace")}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={4}>
                <KpiCard
                  title="My Orders"
                  value="View"
                  subtitle="Track your purchases"
                  palette="teal"
                  onClick={() => navigate("/user/my-orders")}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={4}>
                <KpiCard
                  title="KYC"
                  value="Start"
                  subtitle="Complete your KYC"
                  palette="amber"
                  onClick={() => navigate("/user/kyc")}
                />
              </Grid>
              <Grid item xs={6} sm={6} md={4}>
                <KpiCard
                  title="My Team"
                  value="Open"
                  subtitle="Grow your network"
                  palette="green"
                  onClick={() => navigate("/user/my-team")}
                />
              </Grid>
              <Grid item xs={12}>
                <PromoPricingCards
                  onBuy150={() => navigate("/user/promo-packages?pkg=prime150")}
                  onBuy750={() => navigate("/user/promo-packages?pkg=prime750")}
                  onBuyMonthly={() => navigate("/user/promo-packages?pkg=monthly")}
                  purchased150={purchasedPrime150}
                  purchased750={purchasedPrime750}
                  purchasedMonthly={purchasedMonthly}
                />
              </Grid>

              {/* Other info - full width */}
              <Grid item xs={12} sm={6} md={4}>
                <KpiCard
                  title="My Direct Referrals"
                  value={referralLoading ? "..." : referralCount}
                  subtitle="Direct consumers sponsored"
                  palette="indigo"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <KpiCard
                  title="My Referral ID"
                  value={myReferralId || "-"}
                  subtitle="Share this ID to refer"
                  palette="teal"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <KpiCard
                  title="Test: Self 50 Activation"
                  value={activating50 ? "..." : "Run"}
                  subtitle="Trigger 50 activation now"
                  palette="red"
                  onClick={handleSelf50Activation}
                />
              </Grid>
            </Grid>

            <Box sx={{ mb: 2 }}>
              <RewardPointsCard />
            </Box>
            {/* My E‑Books */}
            {purchasedPrime150 && (
              <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", mb: 2, border: "1px solid #e2e8f0" }}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
                    My E‑Books
                  </Typography>
                {ebooksLoading ? (
                  <Typography variant="body2">Loading...</Typography>
                ) : ebooksError ? (
                  <Typography variant="body2" color="error">{ebooksError}</Typography>
                ) : (ebooks && ebooks.length > 0) ? (
                  <Grid container spacing={2}>
                    {ebooks.map((eb) => (
                      <Grid key={eb.id} item xs={12} sm={6} md={4}>
                        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 2, p: 1.5 }}>
                          {eb.cover_url ? (
                            <Box component="img" src={eb.cover_url} alt={eb.title || "E‑Book"} sx={{ width: 44, height: 60, objectFit: "cover", borderRadius: 1 }} />
                          ) : null}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, pr: 1 }}>
                              {eb.title || "E‑Book"}
                            </Typography>
                            {eb.file_url ? (
                              <Button
                                size="small"
                                component="a"
                                href={eb.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                variant="outlined"
                                sx={{ mt: 0.5, textTransform: "none" }}
                              >
                                Open
                              </Button>
                            ) : null}
                          </Box>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">No e‑books yet.</Typography>
                )}
              </Box>
            </Box>
            )}
            {/* My E‑Coupon Summary (cards) */}
            <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", mb: 2, border: "1px solid #e2e8f0" }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
                  My E‑Coupon Summary
                </Typography>
                {ecSummaryLoading ? (
                  <Typography variant="body2">Loading...</Typography>
                ) : ecSummaryError ? (
                  <Typography variant="body2" color="error">{ecSummaryError}</Typography>
                ) : ecSummary ? (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)", color: "#fff", border: "1px solid rgba(124,58,237,0.35)", boxShadow: "0 8px 18px rgba(124,58,237,0.35)" }}>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>Available</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.available ?? 0}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)", color: "#fff", border: "1px solid rgba(244,63,94,0.35)", boxShadow: "0 8px 18px rgba(244,63,94,0.35)" }}>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>Redeemed</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.redeemed ?? 0}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "1px solid rgba(16,185,129,0.35)", boxShadow: "0 8px 18px rgba(16,185,129,0.35)" }}>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>Activated</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.activated ?? 0}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, borderRadius: 2, background: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)", color: "#fff", border: "1px solid rgba(59,130,246,0.35)", boxShadow: "0 8px 18px rgba(59,130,246,0.35)" }}>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>Transferred</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>{ecSummary.transferred ?? 0}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">No data.</Typography>
                )}
              </Box>
            </Box>
          </>
        ) : selectedMenu === "wealth-galaxy" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <WealthGalaxy />
          </Box>
        ) : selectedMenu === "marketplace" ? (
          <MarketplaceCard
            title="Explore Trikonekt Products"
            variant="plain"
            defaultExpanded
            onViewMarketplace={() => navigate("/marketplace")}
          >
            {renderMarketplaceContent()}
          </MarketplaceCard>
        ) : selectedMenu === "apphub" ? (
          <Box sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff", border: "1px solid #e2e8f0" }}>
            <AppHub />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
