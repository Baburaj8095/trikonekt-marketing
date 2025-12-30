import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import colors from "./theme/colors";
import V2SectionCard from "./components/V2SectionCard";
import V2Button from "./components/V2Button";

/**
 * Dashboard2Profile (v2)
 * Standardized to v2 design-system:
 * - Uses colors tokens (no inline hex)
 * - Uses V2SectionCard for all grouped lists
 * - Uses V2Button for all actions (fixed height, radius, font)
 * - Consistent spacing and typography scale
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
    <Box sx={{ color: colors.textPrimary }}>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.2 }}>
          {displayName}
        </Typography>
        {displayEmail ? (
          <Typography sx={{ fontSize: 12, color: colors.textSecondary }}>{displayEmail}</Typography>
        ) : null}
      </Box>

      {groups.map((group) => (
        <Box key={group.title} sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary, mb: 1 }}>
            {group.title}
          </Typography>

          <V2SectionCard sx={{ p: 0 }}>
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
                  "&:hover": { bgcolor: colors.mutedBg },
                  borderBottom: idx < arr.length - 1 ? `1px solid ${colors.borderWeak}` : "none",
                }}
              >
                <Typography sx={{ fontSize: 14, color: colors.textPrimary }}>{item.label}</Typography>
                <Typography sx={{ fontSize: 12, color: colors.textSecondary }}>›</Typography>
              </Box>
            ))}
          </V2SectionCard>
        </Box>
      ))}

      {/* Shortcuts (use standardized buttons) */}
      <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
        <V2Button variant="secondary" onClick={() => setTab && setTab("home")}>Dashboard</V2Button>
        <V2Button variant="secondary" onClick={() => setTab && setTab("wallet")}>Wallet</V2Button>
        <V2Button variant="secondary" onClick={() => setTab && setTab("history")}>History</V2Button>
      </Box>
    </Box>
  );
}
