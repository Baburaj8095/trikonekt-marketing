import React, { useEffect, useState, useRef } from "react";
import { CircularProgress, Box, Typography } from "@mui/material";

/**
 * AppLifecycleSync:
 * 1. Enables smooth Pull-to-Refresh gesture on mobile.
 * 2. Auto-syncs and refreshes data on resume after inactivity / tab backgrounding.
 * 3. Prevents browser stale offline 'Preview' state by keeping session and state fresh.
 */
export default function AppLifecycleSync() {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);
  const lastActiveRef = useRef(Date.now());

  // 1. Resume from background / inactivity auto-sync
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const elapsed = now - lastActiveRef.current;
        lastActiveRef.current = now;

        // If inactive/in background for more than 45 seconds, trigger refresh event
        if (elapsed > 45000) {
          window.dispatchEvent(new CustomEvent("app:refresh-data", { detail: { reason: "resume" } }));
        }
      }
    };

    const handleUserActivity = () => {
      lastActiveRef.current = Date.now();
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("online", handleVisibilityOrFocus);
    window.addEventListener("touchstart", handleUserActivity, { passive: true });
    window.addEventListener("click", handleUserActivity, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("online", handleVisibilityOrFocus);
      window.removeEventListener("touchstart", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
    };
  }, []);

  // 2. Touch gesture pull-to-refresh
  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY <= 5 && e.touches.length === 1) {
        touchStartY.current = e.touches[0].clientY;
        isDragging.current = true;
      } else {
        isDragging.current = false;
      }
    };

    const onTouchMove = (e) => {
      if (!isDragging.current || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;
      if (diff > 0 && window.scrollY <= 5) {
        const dampened = Math.min(diff * 0.45, 80);
        setPullDistance(dampened);
      } else {
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (pullDistance > 55 && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(60);
        window.dispatchEvent(new CustomEvent("app:refresh-data", { detail: { reason: "pull" } }));
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 800);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  if (pullDistance <= 0 && !isRefreshing) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: Math.max(12, pullDistance - 25),
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.15)",
        border: "1px solid rgba(226, 232, 240, 0.8)",
        borderRadius: "999px",
        px: 2,
        py: 0.8,
        transition: isDragging.current ? "none" : "all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      <CircularProgress
        size={18}
        thickness={5}
        variant={isRefreshing ? "indeterminate" : "determinate"}
        value={isRefreshing ? undefined : Math.min((pullDistance / 55) * 100, 100)}
        sx={{ color: "#2563EB" }}
      />
      <Typography sx={{ fontSize: "12.5px", fontWeight: 700, color: "#1E293B" }}>
        {isRefreshing ? "Refreshing..." : pullDistance > 55 ? "Release to refresh" : "Pull down"}
      </Typography>
    </Box>
  );
}
