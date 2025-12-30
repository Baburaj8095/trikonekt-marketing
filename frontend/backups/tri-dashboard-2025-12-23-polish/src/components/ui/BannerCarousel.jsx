import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import API from "../../api/api";
import normalizeMediaUrl from "../../utils/media";

/**
 * BannerCarousel — BookMyShow-like hero slider
 *
 * Visual-only changes. Data/API unchanged.
 * - Auto-scroll 4–5s
 * - Swipe gestures
 * - Pagination dots bottom-center
 * - Rounded slides (16–20dp)
 * - Side peek of next banner (10dp)
 * - Smooth easing animations
 */
export default function BannerCarousel({
  slides: slidesProp = null,
  apiPath = "/uploads/homecard/",
  height = { xs: 200, sm: 240, md: 300 },
  rounded = true,
  autoPlayMs = 4500,
  showTitle = true,
}) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(Boolean(!slidesProp));
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const containerRef = useRef(null);
  const touchStartX = useRef(null);
  const [viewport, setViewport] = useState(0); // px

  const fromApi = !Array.isArray(slidesProp);

  // Load slides (API or prop)
  useEffect(() => {
    let mounted = true;
    if (fromApi) {
      (async () => {
        try {
          const res = await API.get(apiPath);
          if (!mounted) return;
          const data = Array.isArray(res?.data) ? res.data : [];
          setSlides(data);
        } catch {
          setSlides([]);
        } finally {
          if (mounted) setLoading(false);
        }
      })();
    } else {
      setSlides(slidesProp || []);
      setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, [fromApi, slidesProp, apiPath]);

  // Measure viewport for precise slide width (for side peek)
  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      setViewport(el ? el.clientWidth : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Auto-advance
  useEffect(() => {
    if (!slides?.length || slides.length < 2) return;
    const id = setInterval(() => {
      if (!paused) {
        setIdx((i) => (i + 1) % slides.length);
      }
    }, autoPlayMs);
    return () => clearInterval(id);
  }, [slides, paused, autoPlayMs]);

  // Touch swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e) => {
    const startX = touchStartX.current;
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    if (startX != null && endX != null) {
      const dx = endX - startX;
      if (Math.abs(dx) > 30) {
        if (dx < 0) setIdx((i) => (i + 1) % slides.length);
        else setIdx((i) => (i - 1 + slides.length) % slides.length);
      }
    }
    touchStartX.current = null;
  };

  const slideGap = 20; // 10dp side peek on each side
  const slideWidth = Math.max(0, viewport - slideGap); // width per slide in px
  const offset = idx * (slideWidth + slideGap);

  return (
    <Box
      ref={containerRef}
      className="bms-hero-carousel"
      sx={{
        position: "relative",
        width: "100%",
        height: { xs: height.xs || 200, sm: height.sm || 240, md: height.md || 300 },
        overflow: "hidden",
        bgcolor: "var(--bms-bg)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Banner carousel"
      role="region"
    >
      {loading ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(15,17,21,0.35)",
          }}
        >
          <CircularProgress size={28} />
        </Box>
      ) : slides.length === 0 ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.6)",
            px: 2,
            textAlign: "center",
          }}
        >
          <Typography variant="h6">No banners available</Typography>
        </Box>
      ) : (
        <>
          {/* Track */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "stretch",
              willChange: "transform",
              transform: `translate3d(${-offset}px, 0, 0)`,
              transition: paused ? "none" : "transform 380ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
          >
            {slides.map((s, i) => {
              const src = normalizeMediaUrl(s?.image_url || s?.image);
              return (
                <Box
                  key={s?.id ?? i}
                  sx={{
                    flex: "0 0 auto",
                    width: slideWidth || "calc(100% - 20px)",
                    height: "100%",
                    mx: `${slideGap / 2}px`,
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                      borderRadius: rounded ? 10 : 0,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), inset 0 -12px 28px rgba(217,176,55,.15), 0 8px 24px rgba(0,0,0,0.35)",
                    }}
                  >
                    <Box
                      component="img"
                      src={src}
                      alt={s?.title || `Slide ${i + 1}`}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    {/* Premium golden gradient overlay for banner */}
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        background: "var(--bms-gold-grad)",
                        opacity: 0.16,
                        pointerEvents: "none",
                      }}
                    />
                    {/* Soft inner highlight */}
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,.04), inset 0 -10px 24px rgba(212,175,55,.12)",
                        pointerEvents: "none",
                      }}
                    />
                    {showTitle && (s?.title || "").trim() ? (
                      <Box
                        sx={{
                          position: "absolute",
                          left: { xs: 12, md: 16 },
                          bottom: { xs: 16, md: 18 },
                          bgcolor: "rgba(0,0,0,0.45)",
                          color: "#fff",
                          px: { xs: 1.25, md: 1.5 },
                          py: { xs: 0.5, md: 0.75 },
                          borderRadius: 1.25,
                          maxWidth: { xs: "80%", md: "70%" },
                        }}
                      >
                        <Typography
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.3,
                            fontSize: { xs: 16, sm: 18, md: 20 },
                          }}
                        >
                          {s.title}
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Dots */}
          {slides.length > 1 && (
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                bottom: 12,
                transform: "translateX(-50%)",
                display: "flex",
                gap: 8 / 8,
                alignItems: "center",
                zIndex: 2,
              }}
            >
              {slides.map((_, i) => (
                <Box
                  key={`dot-${i}`}
                  onClick={() => setIdx(i)}
                  sx={{
                    width: { xs: 8, md: 10 },
                    height: { xs: 8, md: 10 },
                    borderRadius: "50%",
                    bgcolor: i === idx ? "var(--bms-gold-2)" : "rgba(255,255,255,0.45)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    cursor: "pointer",
                  }}
                />
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
