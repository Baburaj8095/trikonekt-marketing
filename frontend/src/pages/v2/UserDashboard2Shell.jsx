import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Button,
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";

import { listMyPromoPurchases } from "../../api/api";
import Dashboard2Home from "./Dashboard2Home";
import Dashboard2Wallet from "./Dashboard2Wallet";
import Dashboard2History from "./Dashboard2History";
import Dashboard2Profile from "./Dashboard2Profile";
import V2WrapperFactory from "./V2WrapperFactory";

export default function UserDashboard2Shell() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("home");
  const location = useLocation();
  const [screen, setScreen] = useState(null);

  // Sync tab and profile sub-screen from query params
  useEffect(() => {
    try {
      const qs = new URLSearchParams(location.search || "");
      const p = qs.get("tab");
      const s = qs.get("screen");
      if (["home", "wallet", "history", "profile"].includes(p)) {
        setTab(p);
      }
      setScreen(s || null);
    } catch (_) {}
  }, [location.search]);

  // Stored user (same pattern used elsewhere)
  const storedUser = useMemo(() => {
    try {
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const parsed = ls ? JSON.parse(ls) : {};
      return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object"
        ? parsed.user
        : parsed;
    } catch {
      return {};
    }
  }, []);

  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";
  const displayEmail = storedUser?.email || `${displayName}@example.com`;
  const displayId = storedUser?.user_id || storedUser?.id || "-";

  // Prime flags (reuse logic by calling the same API)
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
    } catch (_) {}
    navigate("/", { replace: true });
  };

  const renderContent = () => {
    if (tab === "wallet") return <Dashboard2Wallet />;
    if (tab === "history") return <Dashboard2History />;
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
    return <Dashboard2Home isPrime={isPrime} />;
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0d1117", color: "#e5e7eb", pb: 9, width: "100%", maxWidth: "100vw", overflowX: "hidden" }}>
      {/* Header (sticky) */}
      <Box
        sx={{
          px: 2,
          pt: 2,
          pb: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "#0d1117",
        }}
      >
        <Avatar sx={{ bgcolor: "#f59e0b", color: "#111827", width: 44, height: 44 }}>
          <PersonRoundedIcon />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
            {displayEmail}
          </Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>ID: {String(displayId)}</Typography>
        </Box>
        {tab === "profile" && Boolean(screen) ? (
          <Button
            size="small"
            onClick={() => { setScreen(null); navigate("/user/dashboard2?tab=profile", { replace: true }); }}
            sx={{ mr: 1, color: "#111827", bgcolor: "#e5e7eb", "&:hover": { bgcolor: "#d1d5db" }, textTransform: "none", fontWeight: 700 }}
          >
            Back
          </Button>
        ) : null}
        <Chip
          size="small"
          label={isPrime ? "Prime" : "Non‑Prime"}
          sx={{
            bgcolor: isPrime ? "#16a34a" : "rgba(255,255,255,0.12)",
            color: "#fff",
            fontWeight: 700,
          }}
        />
        <Button
          size="small"
          onClick={handleLogout}
          sx={{
            ml: 1,
            color: "#111827",
            bgcolor: "#facc15",
            "&:hover": { bgcolor: "#eab308" },
            textTransform: "none",
            fontWeight: 700,
          }}
          startIcon={<LogoutRoundedIcon />}
        >
          Sign Out
        </Button>
      </Box>

      {/* Content */}
      <Box sx={{ px: 2, py: 2 }}>{renderContent()}</Box>

      {/* Bottom tabs */}
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: "#111827",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          height: 64,
          zIndex: 20,
        }}
      >
        <TabItem
          icon={<HomeRoundedIcon />}
          label="Dashboard"
          active={tab === "home"}
          onClick={() => { setTab("home"); navigate("/user/dashboard2?tab=home", { replace: true }); }}
        />
        <TabItem
          icon={<AccountBalanceWalletRoundedIcon />}
          label="Wallet"
          active={tab === "wallet"}
          onClick={() => { setTab("wallet"); navigate("/user/dashboard2?tab=wallet", { replace: true }); }}
        />
        <TabItem
          icon={<HistoryRoundedIcon />}
          label="History"
          active={tab === "history"}
          onClick={() => { setTab("history"); navigate("/user/dashboard2?tab=history", { replace: true }); }}
        />
        <TabItem
          icon={<PersonRoundedIcon />}
          label="Profile"
          active={tab === "profile"}
          onClick={() => { setTab("profile"); navigate("/user/dashboard2?tab=profile", { replace: true }); }}
        />
      </Box>
    </Box>
  );
}

function TabItem({ icon, label, active, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        color: active ? "#facc15" : "#e5e7eb",
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        gap: 0.5,
        cursor: "pointer",
        "&:active": { transform: "scale(0.98)" },
      }}
    >
      <Box sx={{ fontSize: 0 }}>{icon}</Box>
      <Typography sx={{ fontSize: 12 }}>{label}</Typography>
    </Box>
  );
}
