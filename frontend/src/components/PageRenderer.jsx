import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography, Grid, Skeleton, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import SmartImage from "./SmartImage";
import SmartImage2 from "./SmartImage2";

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

function mergeParams(base = {}, extra = {}) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(extra || {})) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}

function useFetch(endpoint, params = {}, opts = {}) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const key = useMemo(() => {
    try {
      return `${endpoint}|${JSON.stringify(params || {})}`;
    } catch {
      return `${endpoint}|params`;
    }
  }, [endpoint, params]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ loading: true, error: null, data: null });
      try {
        const res = await API.get(endpoint, {
          params,
          cacheTTL: opts.cacheTTL ?? 10_000,
          dedupe: "cancelPrevious",
        });
        if (!alive) return;
        setState({ loading: false, error: null, data: res?.data });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, error: e, data: null });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line
  }, [key]);

  return state;
}

// Blinkit-ish tokens (dense + flat)
const DS = {
  pageBg: "#F6F7FB",
  bg: "#ffffff",
  text: "#0f172a",
  subtext: "#64748b",
  radius: 12,
  gap: 10,
};

const scrollXContainerSx = {
  display: "flex",
  gap: DS.gap,
  overflowX: "auto",
  py: 0.5,
  WebkitOverflowScrolling: "touch",
  scrollSnapType: "x mandatory",
  "&::-webkit-scrollbar": { display: "none" },
};

function SectionHeader({ title, action }) {
  if (!title && !action) return null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1, mb: 0.75 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 800, color: DS.text }}>
        {title}
      </Typography>
      {action ? <Box>{action}</Box> : null}
    </Box>
  );
}

/**
 * CATEGORY GRID (commerce-first)
 */
function CategoryGrid({ section }) {
  const navigate = useNavigate();
  const ds = section?.data_source || {};
  const { loading, error, data } = useFetch(ds.endpoint, ds.params, { cacheTTL: 10_000 });

  if (loading) {
    return (
      <Box>
        <SectionHeader title={section?.title || "Shop by Categories"} />
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            pb: 1,
            WebkitOverflowScrolling: "touch",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {Array.from({ length: 8 }).map((_, idx) => (
            <Box key={idx} sx={{ minWidth: 72, textAlign: "center" }}>
              <Skeleton variant="circular" width={56} height={56} sx={{ mx: "auto" }} />
              <Skeleton variant="text" width={64} sx={{ mx: "auto", mt: 0.5 }} />
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (error) return null;

  const items = toArray(data).filter((x) => x && (x.is_active !== false));
  if (!items.length) return null;

  return (
    <Box>
      <SectionHeader title={section?.title || "Shop by Categories"} />
      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 1,
          WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {items.map((it) => {
          const slug = it.slug || it.key;
          const label = it.name || it.label || slug || "Category";
          const img =
            (it.triapp && (it.triapp.icon_url || it.triapp.banner_image_url)) ||
            it.icon_url ||
            it.image_icon ||
            it.banner_image_url ||
            it.image_url ||
            it.image ||
            null;

          const route = it.route || it.href || "";
          const handleClick = () => {
            if (route && String(route).startsWith("/")) navigate(route);
            else if (slug) navigate(`/c/${encodeURIComponent(slug)}`);
          };

          return (
            <Box key={slug || label} onClick={handleClick} sx={{ minWidth: 72, textAlign: "center", cursor: "pointer" }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  mx: "auto",
                  borderRadius: "50%",
                  bgcolor: "#fff",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {img ? (
                  <SmartImage type="category" src={img} sx={{ width: 32, height: 32 }} />
                ) : (
                  <Typography sx={{ color: "#64748b", fontWeight: 800 }}>
                    {String(label).slice(0, 1).toUpperCase()}
                  </Typography>
                )}
              </Box>

              <Typography fontSize={12} fontWeight={600} mt={0.5}>
                {label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * HERO BANNER (smaller + flat)
 */
function BannerCarousel({ section }) {
  const ds = section?.data_source || {};
  const { loading, error, data } = useFetch(ds.endpoint, ds.params, { cacheTTL: 15_000 });

  const trackRef = useRef(null);

  if (loading) {
    return (
      <Box sx={{ ...scrollXContainerSx, pt: 0 }}>
        <Skeleton variant="rounded" height={180} sx={{ borderRadius: 2, flex: "0 0 100%" }} />
      </Box>
    );
  }

  if (error) return null;

  const banners = toArray(data)
    .filter(Boolean)
    .sort((a, b) => (a?.order || 0) - (b?.order || 0))
    .map((b) => ({
      image: b.image_url || b.image || b.banner_url,
      alt: b.alt || b.title || "banner",
    }))
    .filter((b) => b.image);

  if (!banners.length) return null;

  // Hero-like banner layout; horizontally scrollable if multiple.
  return (
    <Box sx={{ mt: 2 }}>
      <Box
        ref={trackRef}
        sx={{
          display: "flex",
          gap: 0,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {banners.map((b, idx) => (
          <Box key={`${b.image}-${idx}`} sx={{ flex: "0 0 100%", scrollSnapAlign: "start" }}>
            <SmartImage2 type="hero" src={b.image} sx={{ borderRadius: 2 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * PROMOTIONS (small tiles)
 */
function PromotionsStrip({ section }) {
  const navigate = useNavigate();
  const ds = section?.data_source || {};
  const { loading, error, data } = useFetch(ds.endpoint, ds.params, { cacheTTL: 15_000 });

  const actionBtn =
    section?.action?.href ? (
      <Button
        size="small"
        variant="text"
        onClick={() => navigate(section.action.href)}
        sx={{ textTransform: "none", fontWeight: 700, minWidth: 0, px: 0 }}
      >
        See all
      </Button>
    ) : null;

  if (loading) {
    return (
      <Box>
        <SectionHeader title={section?.title || "Offers & Promotions"} action={actionBtn} />
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            overflowX: "auto",
            pb: 1,
            WebkitOverflowScrolling: "touch",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <Box key={i} sx={{ minWidth: 280, p: 1 }}>
              <Skeleton variant="rounded" height={140} sx={{ borderRadius: 2 }} />
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (error) return null;

  const promos = toArray(data)
    .filter((p) => p && (p.is_active !== false))
    .sort((a, b) => (a?.order || 0) - (b?.order || 0))
    .map((p) => ({
      image: p.image_url || p.image || p.banner_url,
      title: p.title || p.name || "",
    }))
    .filter((p) => p.image);

  if (!promos.length) return null;

  return (
    <Box>
      <SectionHeader title={section?.title || "Offers & Promotions"} action={actionBtn} />
      <Box
  sx={{
    display: "flex",
    gap: 1.5,
    overflowX: "auto",
    pb: 1,
    scrollSnapType: "x mandatory",
    WebkitOverflowScrolling: "touch",
    "&::-webkit-scrollbar": { display: "none" },
  }}
>

        {promos.map((p, idx) => (
          <Box
  key={`${p.image}-${idx}`}
  sx={{
    minWidth: 300,
    height: 170,                 // ðŸ‘ˆ bigger height (important)
    borderRadius: 3,
    overflow: "hidden",
    position: "relative",
    border: "1px solid #e2e8f0",
    bgcolor: "#fff",
    scrollSnapAlign: "start",
  }}
>
  {/* Image */}
  <Box
    component="img"
    src={p.image}
    alt={p.title || "promo"}
    loading="lazy"
    style={{
      width: "100%",
      height: "100%",
      objectFit: "cover",        // ðŸ‘ˆ always cover like promo tiles
      display: "block",
    }}
  />

  {/* Soft overlay (makes it classy) */}
  <Box
    sx={{
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(180deg, rgba(15,23,42,0.00) 55%, rgba(15,23,42,0.18) 100%)",
      pointerEvents: "none",
    }}
  />

  {/* Optional bottom label */}
  {p.title ? (
    <Box sx={{ position: "absolute", left: 12, bottom: 10 }}>
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 800,
          color: "#fff",
          textShadow: "0 2px 10px rgba(0,0,0,0.35)",
        }}
      >
        {p.title}
      </Typography>
    </Box>
  ) : null}
</Box>

        ))}
      </Box>
    </Box>
  );
}

/**
 * PRODUCT GRID (compact)
 */
function ProductGrid({ section, context }) {
  const ds = section?.data_source || {};
  const injectParams = useMemo(() => {
    const isProducts = String(ds.endpoint || "").includes("/api/products");
    const base = ds.params || {};
    const extra = {};
    if (isProducts && context?.slug) extra.app = context.slug;
    return mergeParams(base, extra);
  }, [ds.endpoint, ds.params, context?.slug]);

  const { loading, error, data } = useFetch(ds.endpoint || "/api/products", injectParams, { cacheTTL: 5_000 });

  if (loading) {
    return (
      <Box>
        <SectionHeader title={section?.title || "Popular"} />
        <Grid container spacing={1.25}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Grid key={idx} item xs={6}>
              <Box sx={{ borderRadius: 2, overflow: "hidden", border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
                <Skeleton variant="rounded" height={120} sx={{ borderRadius: 0 }} />
                <Box sx={{ p: 1 }}>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="40%" />
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) return null;

  const items = toArray(data);
  if (!items.length) return null;

  return (
    <Box>
      <SectionHeader title={section?.title || "Popular"} />
      <Grid container spacing={1.25}>
        {items.map((p) => {
          const img = p.image_url || p.image || null;
          const price = p.price || p.mrp || null;
          const title = p.name || p.title || "Product";

          return (
            <Grid key={p.id || title} item xs={6}>
              <Box
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                  bgcolor: "#fff",
                }}
              >
                {img ? (
                  <Box
                    component="img"
                    src={img}
                    alt={title}
                    loading="lazy"
                    sx={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <Box sx={{ width: "100%", height: 120, bgcolor: "#f1f5f9" }} />
                )}

                <Box sx={{ p: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>
                    {title}
                  </Typography>
                  {price != null ? (
                    <Typography sx={{ fontSize: 12, color: DS.subtext }}>
                      ₹{price}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

export default function PageRenderer({ sections = [], context = {} }) {
  const ordered = useMemo(
    () => (Array.isArray(sections) ? sections.filter((s) => s && (s.enabled !== false)) : []),
    [sections]
  );

  // Blinkit-like ordering:
  // category first -> banner -> offers -> products
  const sorted = useMemo(() => {
    const weight = (t) => {
      const x = String(t || "").toLowerCase();
      if (x === "category_grid") return 1;
      if (x === "hero_banner") return 2;
      if (x === "promotion_strip") return 3;
      if (x === "product_grid") return 4;
      return 99;
    };
    return [...ordered].sort((a, b) => weight(a.type) - weight(b.type));
  }, [ordered]);

  return (
    <Box>
      {sorted.map((sec) => {
        const t = String(sec.type || "").toLowerCase();

        if (t === "category_grid") return <CategoryGrid key={sec.id || sec.type} section={sec} context={context} />;
        if (t === "hero_banner") return <BannerCarousel key={sec.id || sec.type} section={sec} context={context} />;
        if (t === "promotion_strip") return <PromotionsStrip key={sec.id || sec.type} section={sec} context={context} />;
        if (t === "product_grid") return <ProductGrid key={sec.id || sec.type} section={sec} context={context} />;

        return null;
      })}
    </Box>
  );
}

