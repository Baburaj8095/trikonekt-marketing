import React, { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import API from "../api/api";
import PageRenderer from "../components/PageRenderer";

export default function CategoryPage() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [geo, setGeo] = useState({ lat: null, lng: null, pincode: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      setState({ loading: true, error: null, data: null });
      try {
        const res = await API.get("/ui/pages/category/", {
          params: { slug },
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
  }, [slug]);

  // Best-effort geo context
  useEffect(() => {
    try {
      const pin = localStorage.getItem("user_pincode") || "";
      if (pin) setGeo((g) => ({ ...g, pincode: pin }));
    } catch (_) {}
    if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeo({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            pincode: (localStorage.getItem("user_pincode") || ""),
          });
        },
        () => {
          // ignore
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 }
      );
    }
  }, []);

  const sections = useMemo(() => {
    const cfg = state.data || {};
    const arr = Array.isArray(cfg.sections) ? cfg.sections : [];
    return arr;
  }, [state.data]);

  if (state.loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Loadingâ€¦</Typography>
        <CircularProgress size={20} />
      </Box>
    );
  }
  if (state.error) {
    return (
      <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #e2e8f0" }}>
        <Typography variant="body2" color="text.secondary">Failed to load category config.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#f1f5f9", minHeight: "100vh" }}>
      <Box sx={{ p: 2 }}>
        <PageRenderer sections={sections} context={{ slug, ...geo }} />
      </Box>
    </Box>
  );
}

