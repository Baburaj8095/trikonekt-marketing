import React, { useEffect, useMemo, useState, useRef } from "react";
import { Box, Container, Typography, IconButton, CircularProgress, Link } from "@mui/material";
import PublicNavbar from "../components/PublicNavbar";
import GeoBanner from "../components/GeoBanner";
import API from "../api/api";
import SmartLocation from "../components/SmartLocation";

const HomeScreen = () => {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);
  const touchMoved = useRef(false);

  const origin = useMemo(() => {
    // API baseURL is like http://localhost:8000/api -> backend origin is http://localhost:8000
    try {
      return (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");
    } catch {
      return "";
    }
  }, []);

  const toImageUrl = (image) => {
    if (!image) return "";
    if (typeof image === "string" && image.startsWith("http")) return image;
    const path = typeof image === "string" ? image : String(image || "");
    const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
    return `${origin}${withLeadingSlash}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/uploads/homecard/");
        if (!mounted) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        setSlides(data);
      } catch (e) {
        console.error("Failed to load home cards", e);
        setSlides([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Autoplay
  useEffect(() => {
    if (!slides?.length || slides.length < 2) return;
    const id = setInterval(() => {
      if (!paused) {
        setIdx((i) => (i + 1) % slides.length);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [slides, paused]);

  const handlePrev = () => {
    if (!slides?.length) return;
    setIdx((i) => (i - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    if (!slides?.length) return;
    setIdx((i) => (i + 1) % slides.length);
  };

  const handleTouchStart = (e) => {
    touchMoved.current = false;
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  };

  const handleTouchMove = () => {
    touchMoved.current = true;
  };

  const handleTouchEnd = (e) => {
    const startX = touchStartX.current;
    const endX = e.changedTouches?.[0]?.clientX ?? null;
    if (startX != null && endX != null) {
      const dx = endX - startX;
      const threshold = 30;
      if (Math.abs(dx) > threshold) {
        if (dx < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
    touchStartX.current = null;
    touchMoved.current = false;
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "#fff" }}>
      <PublicNavbar />
      {/* <GeoBanner /> */}
      {/* <SmartLocation /> */}

      {/* Hero Carousel */}
      <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: { xs: 3, md: 5 }, px: { xs: 2, md: 0 } }}>
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: { xs: 220, sm: 320, md: 480 },
            overflow: "hidden",
            bgcolor: "#eef2f7",
            borderRadius: { xs: 2, md: 3 },
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-roledescription="carousel"
          aria-label="Home banners"
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
            }}
          >
            <CircularProgress />
          </Box>
        ) : slides.length === 0 ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
              px: 2,
              textAlign: "center",
            }}
          >
            <Typography variant="h6">No banners available</Typography>
          </Box>
        ) : (
          <>
            {slides.map((s, i) => {
              const visible = i === idx;
              const src = toImageUrl(s?.image);
              return (
                <Box
                  key={s?.id ?? i}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: visible ? 1 : 0,
                    transition: "opacity 600ms ease-in-out",
                  }}
                >
                  {/* Background image */}
                  <Box
                    component="img"
                    src={src}
                    alt={s?.title || `Slide ${i + 1}`}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={(e) => {
                      // Fallback background color on error
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  {/* Title overlay if provided */}
                  {(s?.title || "").trim() ? (
                    <Box
                      sx={{
                        position: "absolute",
                        left: { xs: 12, md: 24 },
                        bottom: { xs: 48, md: 56 },
                        bgcolor: "rgba(0,0,0,0.45)",
                        color: "#fff",
                        px: { xs: 1.5, md: 2 },
                        py: { xs: 0.75, md: 1 },
                        borderRadius: 1.5,
                        maxWidth: { xs: "80%", md: "60%" },
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          lineHeight: 1.3,
                          fontSize: { xs: 16, sm: 18, md: 22 },
                        }}
                      >
                        {s.title}
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              );
            })}

            {/* Prev/Next controls */}
            {slides.length > 1 && (
              <>
                <IconButton
                  aria-label="Previous"
                  onClick={handlePrev}
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: { xs: 6, md: 12 },
                    transform: "translateY(-50%)",
                    bgcolor: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    zIndex: 3,
                    width: { xs: 40, md: 52 },
                    height: { xs: 40, md: 52 },
                    border: "1px solid rgba(255,255,255,0.6)",
                    backdropFilter: "blur(2px)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                  }}
                >
                  <Box component="span" sx={{ display: "inline-flex" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path>
                    </svg>
                  </Box>
                </IconButton>
                <IconButton
                  aria-label="Next"
                  onClick={handleNext}
                  sx={{
                    position: "absolute",
                    top: "50%",
                    right: { xs: 6, md: 12 },
                    transform: "translateY(-50%)",
                    bgcolor: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    zIndex: 3,
                    width: { xs: 40, md: 52 },
                    height: { xs: 40, md: 52 },
                    border: "1px solid rgba(255,255,255,0.6)",
                    backdropFilter: "blur(2px)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                  }}
                >
                  <Box component="span" sx={{ display: "inline-flex" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"></path>
                    </svg>
                  </Box>
                </IconButton>

                {/* Dots */}
                <Box
                  sx={{
                    position: "absolute",
                    left: "50%",
                    bottom: 12,
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 1,
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
                        bgcolor: i === idx ? "#fff" : "rgba(255,255,255,0.6)",
                        border: "1px solid rgba(255,255,255,0.85)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </Box>
              </>
            )}
          </>
        )}
        </Box>
      </Container>

      {/* Optional content area under banner */}
      <Container sx={{ py: { xs: 3, md: 5 } }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: "#0C2D48",
            mb: 1,
            fontSize: { xs: 20, md: 24 },
          }}
        >
          Welcome to Trikonekt
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Discover opportunities and updates. Use the Login button in the header to sign in or create an account.
        </Typography>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          mt: "auto",
          py: 3,
          textAlign: "center",
          backgroundColor: "rgba(255,255,255,0.85) !important",
          color: "#000",
          boxShadow: "0 0px 15px rgba(0,0,0,0.08) !important",
        }}
      >
        <Typography variant="body2">
            © {new Date().getFullYear()} Trikonekt. All rights reserved.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Contact us:{" "}
            <Link
              href="mailto:contact@trikonekt.com"
              underline="hover"
              color="inherit"
              sx={{ fontWeight: 500 }}
            >
              contact@trikonekt.com
            </Link>
          </Typography>
      </Box>
    </Box>
  );
};

export default HomeScreen;
