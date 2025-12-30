import React from "react";
import { Card, Box, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

/**
 * Unified AppCard — solid background, text on clean surface
 *
 * Props:
 * - title: string (required, 1 line)
 * - subtitle?: string (1 line)
 * - icon?: ReactNode (minimal illustration)
 * - to?: string (RouterLink target)
 * - onClick?: () => void
 * - disabled?: boolean
 * - size?: 'sm' | 'md' | 'lg' (default 'md')
 * - tone?: 'neutral' | 'brand' (default 'neutral')
 * - badge?: string (small pill, top-right)
 * - decorationImageUrl?: string (optional subtle background, never required)
 *
 * Rules enforced:
 * - Rounded rectangles only (radius 16)
 * - Looks good without images
 * - Text always on clean background
 * - Minimal hover/tap; disabled is clearly non-interactive
 */
export default function AppCard({
  title,
  subtitle,
  icon,
  to,
  onClick,
  disabled = false,
  size = "md",
  tone = "neutral",
  shape = "rect",
  badge,
  decorationImageUrl,
}) {
  const clickable = !disabled && (to || onClick);
  const Wrapper = clickable ? RouterLink : "div";

  const paddings = { sm: 1.25, md: 1.5, lg: 2 }; // multiples of 8px
  const heights = { sm: 72, md: 112, lg: 148 };

  return (
    <Card
      component={Wrapper}
      to={to}
      onClick={onClick}
      elevation={0}
      sx={(t) => ({
        position: "relative",
        borderRadius: shape === "square" ? "0 !important" : 10,
        overflow: "hidden",
        minHeight: shape === "square" ? undefined : (heights[size] || heights.md),
        aspectRatio: shape === "square" ? "1 / 1" : undefined,
        background:
          tone === "brand"
            ? "linear-gradient(135deg, rgba(201,162,77,0.18) 0%, rgba(230,199,106,0.10) 100%)"
            : "var(--bms-bg-2)",
        color: "var(--bms-text-1)",
        border: tone === "brand" ? "1px solid rgba(212,175,55,0.35)" : "1px solid rgba(255,255,255,0.08)",
        textDecoration: "none !important",
        display: "block",
        boxShadow:
          (t.custom && t.custom.elevation && t.custom.elevation.resting) ||
          "0 4px 16px rgba(2,6,12,0.08)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        cursor: clickable ? "pointer" : "default",
        ...(clickable && {
          "&:hover": {
            boxShadow:
              (t.custom && t.custom.elevation && t.custom.elevation.hover) ||
              "0 8px 24px rgba(2,6,12,0.12)",
            transform: "translateY(-2px)",
          },
          "&:active": { transform: "scale(0.98)" },
        }),
        ...(disabled && {
          opacity: 0.45,
          boxShadow: "none",
          pointerEvents: "none",
          cursor: "default",
        }),
      })}
    >
      {/* Optional subtle decoration (never required for readability) */}
      {decorationImageUrl ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${decorationImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(0.5) contrast(0.9) brightness(0.98)",
            opacity: 0.08,
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* Content */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          p: paddings[size] || paddings.md,
          height: "100%",
        }}
      >
        {/* Minimal icon/illustration */}
        {icon ? (
          <Box
            sx={{
              width: size === "lg" ? 40 : size === "sm" ? 28 : 32,
              height: size === "lg" ? 40 : size === "sm" ? 28 : 32,
              borderRadius: 0,
              display: "grid",
              placeItems: "center",
              backgroundColor:
                tone === "brand" ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.06)",
              color: "inherit",
              flex: "0 0 auto",
            }}
          >
            {icon}
          </Box>
        ) : null}

        {/* Text block */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "inherit",
              textDecoration: "none",
              fontSize: { xs: 16, sm: 16, md: size === "lg" ? 18 : 16 },
            }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography
              variant="body2"
              sx={{
                mt: 0.25,
                opacity: tone === "brand" ? 0.9 : 1,
                color: tone === "brand" ? "rgba(234,234,234,0.8)" : "var(--bms-text-2)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontWeight: 400,
              }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Box>

      {/* Badge (top-right) */}
      {badge ? (
        <Box
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            bgcolor: "var(--bms-gold-2)",
            border: "1px solid rgba(212,175,55,0.4)",
            color: "#111",
            borderRadius: 999,
            px: 1.25,
            py: 0.5,
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: 0.2,
          }}
        >
          {badge}
        </Box>
      ) : null}
    </Card>
  );
}
