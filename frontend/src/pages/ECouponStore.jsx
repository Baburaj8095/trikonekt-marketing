import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Grid,
  Box,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Badge,
  Chip,
  useMediaQuery,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import CloseIcon from "@mui/icons-material/Close";
import {
  getEcouponStoreBootstrap,
  getMyEcouponOrders,
  assignConsumerByCount,
  assignEmployeeByCount,
} from "../api/api";
import { addEcoupon } from "../store/cart";
import { subscribe as cartSubscribe } from "../store/cart";
import { useNavigate } from "react-router-dom";

// New reusable components (modern ecommerce UI)
import ECouponProductCard from "../components/ecoupon/ProductCard";
import CartDrawer from "../components/ecoupon/CartDrawer";
import FilterBar from "../components/ecoupon/FilterBar";
import AssignCouponsForm from "../components/ecoupon/AssignCouponsForm";
import OrdersList from "../components/ecoupon/OrdersList";

export default function ECouponStore() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersErr, setOrdersErr] = useState("");

  const [denomFilter, setDenomFilter] = useState("all");
  const [denomOptions, setDenomOptions] = useState([]);
  const [availByDenom, setAvailByDenom] = useState({});

  // Search + price filtering
  const [search, setSearch] = useState("");
  const [priceBounds, setPriceBounds] = useState([0, 0]); // [min, max]
  const [priceRange, setPriceRange] = useState([0, 0]);

  // Header cart badge + drawer
  const [cartCount, setCartCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filters collapsible on mobile
  const isMdUp = useMediaQuery("(min-width:900px)");
  const [showFilters, setShowFilters] = useState(true);

  // Role context
  const roleHint = useMemo(() => {
    try {
      const p = window.location.pathname;
      if (p.startsWith("/agency")) return "agency";
      if (p.startsWith("/employee")) return "employee";
      return "consumer";
    } catch {
      return "consumer";
    }
  }, []);
  const routerNavigate = useNavigate();

  // Subscribe to cart for badge
  useEffect(() => {
    const unsub = cartSubscribe((s) => {
      try {
        setCartCount(Number(s?.count || 0));
      } catch {
        setCartCount(0);
      }
    });
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, []);

  // Bootstrap: products, denominations, price bounds, availability
  const loadStoreBootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getEcouponStoreBootstrap();
      const prods = Array.isArray(data?.products) ? data.products : [];
      setProducts(prods);

      // Denomination options
      const denoms = Array.from(new Set((prods || []).map((p) => String(p.denomination)))).sort(
        (a, b) => Number(a) - Number(b)
      );
      setDenomOptions(["all", ...denoms]);

      // Price bounds
      const prices = (prods || []).map((p) => Number(p?.price_per_unit || 0)).filter((n) => Number.isFinite(n));
      const minP = prices.length ? Math.min(...prices) : 0;
      const maxP = prices.length ? Math.max(...prices) : 0;
      setPriceBounds([minP, maxP]);
      setPriceRange([minP, maxP]);

      // Availability summary per denomination (server count)
      await computeAvailabilities(denoms);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to load store.";
      setError(msg);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMyOrders = async () => {
    setOrdersLoading(true);
    setOrdersErr("");
    try {
      const res = await getMyEcouponOrders({ page_size: 50 });
      const arr = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setOrders(arr);
    } catch (e) {
      setOrders([]);
      setOrdersErr("Failed to load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  };

  async function fetchCount(params = {}) {
    try {
      const res = await (await import("../api/api")).default.get("/coupons/codes/", {
        params: { page_size: 1, ...params },
      });
      const data = res?.data;
      if (typeof data?.count === "number") return data.count;
      if (Array.isArray(data)) return data.length;
      return 0;
    } catch {
      return 0;
    }
  }

  async function computeAvailabilities(denoms = []) {
    try {
      const entries = await Promise.all(
        (denoms || []).map(async (d) => {
          const cnt = await fetchCount({ issued_channel: "e_coupon", status: "AVAILABLE", value: d });
          return [String(d), cnt];
        })
      );
      const map = {};
      for (const [k, v] of entries) map[k] = v;
      setAvailByDenom(map);
    } catch {}
  }

  useEffect(() => {
    setShowFilters(isMdUp); // auto-show on desktop, collapsible on mobile
  }, [isMdUp]);

  useEffect(() => {
    loadStoreBootstrap();
    loadMyOrders();
  }, []);

  // Cart helpers (centralized cart only)
  const addToCart = (pid, qty = 1) => {
    try {
      const product = (products || []).find((x) => String(x.id) === String(pid));
      const q = Math.max(1, parseInt(qty || "1", 10));
      addEcoupon({
        productId: pid,
        title: product?.display_title || "E‑Coupon",
        unitPrice: Number(product?.price_per_unit || 0),
        qty: q,
        denomination: product?.denomination ?? null,
      });
      try {
        alert("Added to cart.");
      } catch {}
      setDrawerOpen(true);
    } catch {}
  };

  // Filtered view of products
  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    const [minP, maxP] = priceRange;
    return (products || []).filter((p) => {
      if (denomFilter !== "all" && String(p.denomination) !== String(denomFilter)) return false;
      const price = Number(p?.price_per_unit || 0);
      if (Number.isFinite(minP) && price < minP) return false;
      if (Number.isFinite(maxP) && price > maxP) return false;
      if (q) {
        const hay = `${p?.display_title || ""} ${p?.display_desc || ""} ${p?.denomination || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, denomFilter, search, priceRange]);

  // Header: navigate to centralized checkout/cart routes from drawer
  const handleGoCheckout = () => {
    try {
      const p = window.location.pathname;
      if (p.startsWith("/agency")) routerNavigate("/agency/checkout");
      else if (p.startsWith("/employee")) routerNavigate("/employee/checkout");
      else routerNavigate("/user/checkout");
    } catch {}
  };

  // Accordion: Assign handlers wired to existing APIs
  const onAssignConsumer = async ({ username, count, notes }) => {
    const res = await assignConsumerByCount({
      consumer_username: username,
      count,
      notes: notes || "",
    });
    const assigned = Number(res?.assigned || 0);
    const after = Number(res?.available_after || 0);
    const samples = Array.isArray(res?.sample_codes) ? res.sample_codes : [];
    return { message: `Assigned ${assigned}. Remaining in your pool: ${after}. Samples: ${samples.join(", ")}` };
  };

  const onAssignEmployee = async ({ username, count, notes }) => {
    const res = await assignEmployeeByCount({
      employee_username: username,
      count,
      notes: notes || "",
    });
    const assigned = Number(res?.assigned || 0);
    const after = Number(res?.available_after || 0);
    const samples = Array.isArray(res?.sample_codes) ? res.sample_codes : [];
    return { message: `Assigned ${assigned} to ${username}. Remaining in agency pool: ${after}. Samples: ${samples.join(", ")}` };
  };

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 1, md: 2 }, py: { xs: 1, md: 2 } }}>
      {/* Header */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a" }}>
              E‑Coupon Store
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Role: {roleHint}. Add items to cart and checkout via UPI QR.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              onClick={() => setShowFilters((s) => !s)}
              sx={{ display: { xs: "inline-flex", md: "none" } }}
              title={showFilters ? "Hide filters" : "Show filters"}
            >
              {showFilters ? <CloseIcon /> : <FilterAltOutlinedIcon />}
            </IconButton>
            <IconButton size="small" onClick={() => setDrawerOpen(true)} title="Open cart">
              <Badge badgeContent={cartCount} color="primary">
                <ShoppingCartIcon />
              </Badge>
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {/* Filters */}
      <Box sx={{ display: { xs: showFilters ? "block" : "none", md: "block" }, mb: 1.5 }}>
        <FilterBar
          denomOptions={denomOptions}
          denomFilter={denomFilter}
          onDenomChange={setDenomFilter}
          search={search}
          onSearchChange={setSearch}
          priceRange={priceRange}
          priceBounds={priceBounds}
          onPriceChange={setPriceRange}
          onRefresh={loadStoreBootstrap}
          loading={loading}
        />
      </Box>

      {/* Product grid */}
      <Paper elevation={0} sx={{ p: { xs: 1, md: 2 }, borderRadius: 2, border: "1px solid", borderColor: "divider", mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
              Available Products
            </Typography>
            <Chip size="small" label={`${filtered.length} shown`} />
          </Stack>
          <Button onClick={loadStoreBootstrap} size="small" variant="outlined" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </Stack>

        {loading ? (
          <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} /> <Typography variant="body2">Loading...</Typography>
          </Box>
        ) : (filtered || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">No products match the filters.</Typography>
        ) : (
          <Grid container spacing={2}>
            {(filtered || []).map((p) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={p.id}>
                <ECouponProductCard
                  product={p}
                  available={availByDenom[String(p.denomination)]}
                  onAddToCart={(pid, qty) => addToCart(pid, qty)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Collapsible panels: Assign flows */}
      {(roleHint === "agency" || roleHint === "employee") ? (
        <Accordion defaultExpanded sx={{ mb: 1.5 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
              Send E‑Coupons to Consumer (by Count)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <AssignCouponsForm
              variant="consumer"
              onSubmit={onAssignConsumer}
            />
          </AccordionDetails>
        </Accordion>
      ) : null}

      {roleHint === "agency" ? (
        <Accordion sx={{ mb: 1.5 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0f172a" }}>
              Distribute to Employee (by Count)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <AssignCouponsForm
              variant="employee"
              onSubmit={onAssignEmployee}
            />
          </AccordionDetails>
        </Accordion>
      ) : null}

      {/* Orders list */}
      <Box sx={{ mt: 2 }}>
        {ordersLoading ? (
          <Box sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} /> <Typography variant="body2">Loading orders...</Typography>
          </Box>
        ) : (
          <OrdersList
            orders={orders}
            loading={ordersLoading}
            error={ordersErr}
            onRefresh={loadMyOrders}
          />
        )}
      </Box>

      {/* Cart Drawer */}
      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCheckout={handleGoCheckout}
      />

      {/* Floating cart button on mobile */}
      <Box
        sx={{
          position: "fixed",
          right: 16,
          bottom: 16,
          display: { xs: "block", md: "none" },
          zIndex: 1300,
        }}
      >
        <Button
          variant="contained"
          onClick={() => setDrawerOpen(true)}
          startIcon={
            <Badge badgeContent={cartCount} color="secondary">
              <ShoppingCartIcon />
            </Badge>
          }
          sx={{ borderRadius: 999, boxShadow: "0 10px 24px rgba(2,132,199,0.25)" }}
        >
          Cart
        </Button>
      </Box>
    </Container>
  );
}
