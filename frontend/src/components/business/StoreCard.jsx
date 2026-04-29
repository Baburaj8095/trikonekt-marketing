import React from "react";
import { alpha } from "@mui/material/styles";
import { Box, ButtonBase, Chip, Stack, Typography } from "@mui/material";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import NearMeOutlinedIcon from "@mui/icons-material/NearMeOutlined";

const UI = {
  primary: "#0F52BA",
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#1f2937",
  textMuted: "#6b7280",
  success: "#16a34a",
};

export default function StoreCard({ store, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: "block",
        width: "100%",
        textAlign: "left",
        borderRadius: 2.5,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "104px minmax(0, 1fr)", sm: "132px minmax(0, 1fr)" },
          gap: 1.25,
          width: "100%",
          p: 1,
          borderRadius: 2.5,
          bgcolor: UI.surface,
          border: `1px solid ${UI.border}`,
          boxShadow: "0 8px 22px rgba(15,82,186,0.07)",
          overflow: "hidden",
        }}
      >
        <Box
          component="img"
          src={store.image}
          alt={store.name}
          sx={{
            width: "100%",
            aspectRatio: "1 / 1",
            height: "auto",
            objectFit: "cover",
            borderRadius: 2,
            bgcolor: alpha(UI.primary, 0.08),
          }}
        />
        <Stack spacing={0.75} sx={{ minWidth: 0, py: 0.2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: { xs: 14.5, sm: 16 },
                fontWeight: 900,
                color: UI.text,
                lineHeight: 1.22,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {store.name}
            </Typography>
            <Typography
              sx={{
                fontSize: 11.5,
                color: UI.textMuted,
                mt: 0.3,
                lineHeight: 1.35,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {store.description}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={0.25} alignItems="center">
              <StarRoundedIcon sx={{ fontSize: 16, color: UI.success }} />
              <Typography sx={{ fontSize: 12, fontWeight: 900, color: UI.text }}>
                {store.rating}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.25} alignItems="center">
              <AccessTimeRoundedIcon sx={{ fontSize: 15, color: UI.textMuted }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: UI.textMuted }}>
                {store.deliveryTime}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.25} alignItems="center">
              <NearMeOutlinedIcon sx={{ fontSize: 15, color: UI.textMuted }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: UI.textMuted }}>
                {store.distance}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
            {store.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                sx={{
                  height: 22,
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontWeight: 800,
                  bgcolor: alpha(UI.primary, 0.1),
                  color: UI.primary,
                }}
              />
            ))}
          </Stack>
        </Stack>
      </Box>
    </ButtonBase>
  );
}
