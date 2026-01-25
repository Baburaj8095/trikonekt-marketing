import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Badge,
  Menu,
  MenuItem,
  Divider,
  Skeleton,
  Button,
} from "@mui/material";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import PageRenderer from "../components/PageRenderer";
import { useCartStore } from "../store/cartStore";

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const k of ["results", "data", "items", "rows"]) {
      const v = data[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

export default function EcommerceUser({ embedded = false }) {
  const navigate = useNavigate();
  const cartCount = useCartStore((s) => s.items.reduce((sum, it) => sum + (it.qty || 0), 0));

  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [geo, setGeo] = useState({ lat: null, lng: null, pincode: "" });

  const [pincodes, setPincodes] = useState(() => {
    try {
      const saved = localStorage.getItem("recent_pincodes");
      const arr = saved ? JSON.parse(saved) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState("");
  const [locAnchor, setLocAnchor] = useState(null);
  const locOpen = Boolean(locAnchor);
  const [pinInput, setPinInput] = useState("");

  // Fetch config-driven home page (STRICT: keep GET /api/ui/pages/ecommerce-home/)
  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ loading: true, error: null, data: null });
      try {
        const res = await API.get("/ui/pages/ecommerce-home/", {
          cacheTTL: 10_000,
          dedupe: "cancelPrevious",
        });
        if (!alive) return;
        setState({ loading: false, error: null, data: res?.data || {} });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, error: e, data: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Best-effort geo context (lat/lng/pincode)
  useEffect(() => {
    try {
      const pin = localStorage.getItem("user_pincode") || "";
      if (pin) {
        setGeo((g) => ({ ...g, pincode: pin }));
        setPinInput(pin);
      }
    } catch (_) {}

    if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo((g) => ({ ...g, lat: pos.coords.latitude, lng: pos.coords.longitude })),
        () => {},
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 }
      );
    }
  }, []);

  // Persist pincode change
  const setPincode = (pin) => {
    const clean = String(pin || "").trim();
    setGeo((g) => ({ ...g, pincode: clean }));
    setPinInput(clean);
    try {
      localStorage.setItem("user_pincode", clean);
      const next = [clean, ...toArray(pincodes).filter((p) => p && p !== clean)].slice(0, 5);
      setPincodes(next);
      localStorage.setItem("recent_pincodes", JSON.stringify(next));
    } catch (_) {}
  };

  const sections = useMemo(() => {
    const cfg = state.data || {};
    return Array.isArray(cfg.sections) ? cfg.sections : [];
  }, [state.data]);

  return (
    <Box sx={{ bgcolor: "#F6F7FB", minHeight: "100vh" }}>
      {/* BLINKIT STYLE HEADER */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          top: 0,
          bgcolor: "#ffffff",
          color: "#0f172a",
          borderBottom: "1px solid #e2e8f0",
          zIndex: (t) => t.zIndex.appBar + 10,
        }}
      >
        <Toolbar sx={{ px: 1.5, py: 1, minHeight: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Location row */}
            <Box
              onClick={(e) => setLocAnchor(e.currentTarget)}
              role="button"
              tabIndex={0}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                cursor: "pointer",
                userSelect: "none",
                mb: 0.75,
              }}
            >
              <PlaceOutlinedIcon sx={{ fontSize: 18 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 11, color: "#64748b", lineHeight: 1.1 }}>
                  Delivery in 10 mins
                </Typography>
                <Typography
                  sx={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "#0f172a",
                    lineHeight: 1.2,
                  }}
                  noWrap
                >
                  {geo.pincode ? `PIN ${geo.pincode}` : "Set delivery location"}
                </Typography>
              </Box>
              <KeyboardArrowDownRoundedIcon sx={{ color: "#64748b" }} />
            </Box>

            {/* Search bar */}
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for products, shopsâ€¦"
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  bgcolor: "#f1f5f9",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#e2e8f0",
                },
                "& .MuiOutlinedInput-input": {
                  py: 1,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlinedIcon sx={{ color: "#64748b" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Cart */}
          <IconButton
            onClick={() => navigate("/user/cart")}
            aria-label="Cart"
            sx={{
              ml: 1,
              bgcolor: "#0f172a",
              color: "#ffffff",
              "&:hover": { bgcolor: "#0f172a" },
              borderRadius: 2,
              width: 42,
              height: 42,
            }}
          >
            <Badge color="primary" badgeContent={cartCount || 0}>
              <ShoppingCartOutlinedIcon sx={{ color: "#ffffff" }} />
            </Badge>
          </IconButton>
        </Toolbar>

        {/* Location menu */}
        <Menu
          anchorEl={locAnchor}
          open={locOpen}
          onClose={() => setLocAnchor(null)}
          PaperProps={{ sx: { minWidth: 280, borderRadius: 2 } }}
        >
          <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Deliver to
            </Typography>

            <TextField
              size="small"
              label="Enter PIN code"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              fullWidth
            />

            <Button
              fullWidth
              variant="contained"
              sx={{ mt: 1.25, borderRadius: 2, textTransform: "none" }}
              onClick={() => {
                setPincode(pinInput);
                setLocAnchor(null);
              }}
            >
              Save
            </Button>
          </Box>

          {toArray(pincodes).length ? (
            <>
              <Divider sx={{ my: 1.25 }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, px: 1.5, display: "block" }}
              >
                Recent PIN codes
              </Typography>

              {toArray(pincodes).map((p) => (
                <MenuItem
                  key={p}
                  onClick={() => {
                    setPincode(p);
                    setLocAnchor(null);
                  }}
                  sx={{ borderRadius: 1 }}
                >
                  {p}
                </MenuItem>
              ))}
            </>
          ) : null}
        </Menu>
      </AppBar>

      {/* CONTENT (NO EXTRA TOP GAP) */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 2 }}>
        {state.loading ? (
          <Box>
            <Skeleton variant="rounded" height={140} sx={{ borderRadius: 2, mb: 1.5 }} />
            <Skeleton variant="text" width={140} sx={{ mb: 1 }} />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                mb: 2,
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Box key={i} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
                  <Skeleton variant="rounded" width={60} height={60} sx={{ borderRadius: 2 }} />
                  <Skeleton variant="text" width={60} />
                </Box>
              ))}
            </Box>

            <Skeleton variant="rounded" height={110} sx={{ borderRadius: 2 }} />
          </Box>
        ) : state.error ? (
          <Box sx={{ bgcolor: "#ffffff", borderRadius: 2, p: 2, boxShadow: 0 }}>
            <Typography variant="body2" color="text.secondary">
              Failed to load home config.
            </Typography>
          </Box>
        ) : (
          <PageRenderer sections={sections} context={{ ...geo }} />
        )}
      </Box>
    </Box>
  );
}

