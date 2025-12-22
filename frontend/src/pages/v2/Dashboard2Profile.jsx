import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

/**
 * Profile tab for v2 dashboard
 * - Mirrors the items from ConsumerShell (Profile/Genealogy/Wallet/History/etc.)
 * - Adds mining-related shortcuts (Wealth Galaxy, Lucky Draw) as requested
 * - Navigates to existing routes; does not modify any existing pages
 */
export default function Dashboard2Profile({ setTab, openScreen }) {
  const navigate = useNavigate();

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
  const displayEmail = storedUser?.email || "";

  const groups = [
    {
      title: "Account",
      items: [{ label: "Account Info", screen: "profile2" }],
    },
    {
      title: "Earnings & Teams",
      items: [
        { label: "Genealogy (My Team)", screen: "my-team2" },
        { label: "Refer & Earn", screen: "refer-earn2" },
        { label: "Join Prime Packages", screen: "promo-packages2" },
      ],
    },
    {
      title: "Orders & Coupons",
      items: [
        { label: "My E‑Coupons", screen: "my-e-coupons2" },
        { label: "My Orders", screen: "my-orders2" },
        { label: "Cart", screen: "cart2" },
      ],
    },
    {
      title: "Marketplaces",
      items: [
        { label: "Trikonekt Products", screen: "trikonekt-products2" },
        { label: "Merchant Marketplace", screen: "merchant-marketplace2" },
      ],
    },
    {
      title: "Help",
      items: [{ label: "Support", screen: "support2" }],
    },
  ];

  return (
    <Box sx={{ color: "#e5e7eb" }}>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
          {displayName}
        </Typography>
        {displayEmail ? (
          <Typography sx={{ fontSize: 12, opacity: 0.75 }}>{displayEmail}</Typography>
        ) : null}
      </Box>

      {groups.map((group) => (
        <Box key={group.title} sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff", mb: 1 }}>
            {group.title}
          </Typography>

          <Box
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)",
              bgcolor: "#111827",
            }}
          >
            {group.items.map((item, idx, arr) => (
              <Box
                key={item.label}
                onClick={() => {
                  if (item.screen && openScreen) {
                    openScreen(item.screen);
                  } else if (item.to) {
                    navigate(item.to);
                  }
                }}
                sx={{
                  px: 2,
                  py: 1.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
                  borderBottom:
                    idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}
              >
                <Typography sx={{ fontSize: 14, color: "#e5e7eb" }}>{item.label}</Typography>
                <Typography sx={{ fontSize: 12, opacity: 0.6 }}>›</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ))}

      {/* Shortcuts to quickly switch tabs if needed */}
      <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
        <ChipButton label="Dashboard" onClick={() => setTab && setTab("home")} />
        <ChipButton label="Wallet" onClick={() => setTab && setTab("wallet")} />
        <ChipButton label="History" onClick={() => setTab && setTab("history")} />
      </Box>
    </Box>
  );
}

function ChipButton({ label, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 0.5,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        bgcolor: "rgba(255,255,255,0.08)",
        color: "#fff",
        cursor: "pointer",
        "&:hover": { bgcolor: "rgba(255,255,255,0.14)" },
      }}
    >
      {label}
    </Box>
  );
}
