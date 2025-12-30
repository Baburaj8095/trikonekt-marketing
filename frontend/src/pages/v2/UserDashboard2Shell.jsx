import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Box } from "@mui/material";

import { listMyPromoPurchases } from "../../api/api";
import { Wallet2, History2 } from "./screens";
import Dashboard2Profile from "./Dashboard2Profile";
import V2WrapperFactory from "./V2WrapperFactory";
import V2Scaffold from "./components/V2Scaffold";
import Dashboard2 from "./screens/Dashboard2";

/**
 * UserDashboard2Shell
 * Standardized shell that routes between v2 tabs using ONE design system:
 * - Uses V2Scaffold for header, paddings and bottom nav on all non-Home tabs
 * - Home tab renders Dashboard2 directly (it already includes V2Scaffold)
 * - Tab is controlled via query param ?tab=home|wallet|history|profile
 */
export default function UserDashboard2Shell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState("home");
  const [screen, setScreen] = useState(null);

  // Sync tab and profile sub-screen from query params
  useEffect(() => {
    try {
      const qs = new URLSearchParams(location.search || "");
      const p = (qs.get("tab") || "home").toLowerCase();
      const s = qs.get("screen");
      if (["home", "wallet", "history", "profile"].includes(p)) {
        setTab(p);
      } else {
        setTab("home");
      }
      setScreen(s || null);
    } catch (_) {
      setTab("home");
      setScreen(null);
    }
  }, [location.search]);

  // Prime flag (for header chip)
  const [isPrime, setIsPrime] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await listMyPromoPurchases();
        const list = Array.isArray(res) ? res : res?.results || [];
        const valid = (list || []).filter((pp) => String(pp?.status || "").toUpperCase() === "APPROVED");
        let has150 = false, has750 = false, hasMonthly = false;
        for (const pp of valid) {
          const pkg = pp?.package || {};
          const type = String(pkg?.type || "");
          const name = String(pkg?.name || "").toLowerCase();
          const code = String(pkg?.code || "").toLowerCase();
          const price = Number(pkg?.price || 0);
          if (type === "MONTHLY") hasMonthly = true;
          else if (type === "PRIME") {
            if (Math.abs(price - 150) < 0.5 || name.includes("150") || code.includes("150")) has150 = true;
            if (Math.abs(price - 750) < 0.5 || name.includes("750") || code.includes("750")) has750 = true;
          }
        }
        if (mounted) setIsPrime(has150 || has750 || hasMonthly);
      } catch {
        if (mounted) setIsPrime(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Non-home tab body content (wrapped by V2Scaffold)
  const renderBody = () => {
    if (tab === "wallet") return <Wallet2 />;
    if (tab === "history") return <History2 />;
    if (tab === "profile") {
      if (screen) {
        return <V2WrapperFactory name={screen} />;
      }
      return (
        <Dashboard2Profile
          setTab={setTab}
          openScreen={(name) => {
            if (!name) return;
            setScreen(name);
            const url = `/user/dashboard2?tab=profile&screen=${encodeURIComponent(name)}`;
            navigate(url, { replace: true });
          }}
        />
      );
    }
    // Should never reach here for "home"
    return null;
  };

  // Home uses its own V2Scaffold internally; other tabs use the shared scaffold here
  if (tab === "home") {
    return <Dashboard2 />;
  }

  return (
    <V2Scaffold isPrime={isPrime} withBottomNav>
      <Box sx={{ pb: 2 }}>{renderBody()}</Box>
    </V2Scaffold>
  );
}
