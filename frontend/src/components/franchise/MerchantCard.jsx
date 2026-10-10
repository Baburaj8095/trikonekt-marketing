import React from "react";
import { Paper, Box, Typography, Chip, Avatar, IconButton } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import { AGENCY_TOKENS } from "./AgencyTokens";

/**
 * Standard MerchantCard (Phase 5)
 * Uniform layout structure with fixed thumbnail, flexible text column, and 1-tap Call button.
 */
export default function MerchantCard({
  merchant,
  onClick,
}) {
  const isActive = merchant.status === "Active";
  const phone = merchant.mobile || merchant.phone || "";
  const channel = merchant.channel || (merchant.activatedServices?.length > 1 ? "Online" : "Offline");

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 1.6,
        borderRadius: `${AGENCY_TOKENS.geometry.cardRadius}px`,
        bgcolor: AGENCY_TOKENS.colors.cardBg,
        border: `1px solid ${AGENCY_TOKENS.colors.border}`,
        boxShadow: AGENCY_TOKENS.shadows.card,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
        "&:active": { transform: "scale(0.985)" },
        "&:hover": { borderColor: AGENCY_TOKENS.colors.primaryBorder },
      }}
    >
      {/* Fixed-size thumbnail */}
      <Avatar
        src={merchant.image}
        variant="rounded"
        sx={{
          width: 50,
          height: 50,
          borderRadius: "12px",
          bgcolor: AGENCY_TOKENS.colors.surfaceMuted,
          flexShrink: 0,
        }}
      />

      {/* Flexible text column */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: Name + Badges */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap", mb: 0.3 }}>
          <Typography
            sx={{
              fontSize: "14px",
              fontWeight: 700,
              color: AGENCY_TOKENS.colors.mainText,
              lineHeight: 1.3,
            }}
          >
            {merchant.name}
          </Typography>
          <Chip
            label={merchant.type || "B2C"}
            size="small"
            sx={{
              height: 18,
              fontSize: "10px",
              fontWeight: 700,
              bgcolor: AGENCY_TOKENS.colors.primaryLight,
              color: AGENCY_TOKENS.colors.primary,
            }}
          />
          <Chip
            label={channel}
            size="small"
            sx={{
              height: 18,
              fontSize: "10px",
              fontWeight: 700,
              bgcolor: channel === "Online" ? "#EFF6FF" : "#F8FAFC",
              color: channel === "Online" ? "#2563EB" : "#64748B",
              border: "1px solid",
              borderColor: channel === "Online" ? "#BFDBFE" : "#E2E8F0",
            }}
          />
          <Chip
            label={merchant.status}
            size="small"
            sx={{
              height: 18,
              fontSize: "10px",
              fontWeight: 700,
              bgcolor: isActive ? AGENCY_TOKENS.colors.successBg : AGENCY_TOKENS.colors.surfaceMuted,
              color: isActive ? AGENCY_TOKENS.colors.success : AGENCY_TOKENS.colors.secondaryText,
            }}
          />
        </Box>

        {/* Row 2: Owner & Category */}
        <Typography
          noWrap
          sx={{
            fontSize: "11.5px",
            color: AGENCY_TOKENS.colors.secondaryText,
            fontWeight: 500,
            mb: 0.3,
          }}
        >
          {merchant.owner} • {merchant.category}
        </Typography>

        {/* Row 3: Volume & Orders */}
        <Typography
          noWrap
          sx={{
            fontSize: "11.5px",
            color: AGENCY_TOKENS.colors.success,
            fontWeight: 700,
          }}
        >
          Vol: {merchant.totalSpend || "₹0.00"} • Orders: {merchant.totalTransactions || 0}
        </Typography>
      </Box>

      {/* Quick 1-tap Call Action */}
      {phone && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `tel:${phone.replace(/\s+/g, "")}`;
          }}
          sx={{
            bgcolor: "#F0FDF4",
            color: "#059669",
            border: "1px solid #BBF7D0",
            p: 0.8,
            flexShrink: 0,
            "&:hover": { bgcolor: "#DCFCE7" },
          }}
          title={`Call ${merchant.name}`}
        >
          <CallRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      )}

      {/* Trailing chevron */}
      <ChevronRightRoundedIcon
        sx={{ color: "#CBD5E1", fontSize: 20, flexShrink: 0 }}
      />
    </Paper>
  );
}
