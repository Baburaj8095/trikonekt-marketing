import React from "react";
import { Box, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import AppCard from "./ui/AppCard";

/**
 * AppsRow — single-row horizontal scroller for compact cards
 *
 * Props:
 * - items: Array<{
 *     key: string;
 *     label: string;
 *     subtitle?: string;
 *     icon?: React.ComponentType | React.ReactNode;
 *     route?: string;
 *     comingSoon?: boolean;
 *     badgeText?: string;
 *     tone?: 'neutral' | 'brand';
 *   }>
 * - title?: string
 * - size?: 'sm' | 'md'
 * - shape?: 'rect' | 'square'
 */
export default function AppsRow({ items = [], title = null, size = "sm", shape = "square" }) {
  return (
    <Box>
      {title ? (
        <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}>
          {title}
        </Typography>
      ) : null}

      <Box
        sx={{
          display: "flex",
          gap: 1.5, // 12px
          overflowX: "auto",
          pb: 1,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          mx: -1,
          px: 1,
        }}
      >
        {(items || []).map((item) => {
          const disabled = Boolean(item.comingSoon);
          const to = !disabled && item.route ? item.route : undefined;

          let iconEl = null;
          if (item.icon) {
            const IconComp = item.icon;
            iconEl = <IconComp fontSize="small" />;
          } else if (item.iconEl) {
            iconEl = item.iconEl;
          }

          const isBrand = item.tone === "brand";

          return (
            <Box
              key={item.key || item.label}
              sx={{
                minWidth: size === "sm" ? 112 : 160,
                flex: "0 0 auto",
                scrollSnapAlign: "start",
              }}
            >
              {shape === "icon" ? (
                <Box
                  component={to ? RouterLink : "div"}
                  to={to}
                  className="bms-icon-tile tapable"
                  sx={{
                    textDecoration: "none",
                    color: isBrand ? "var(--bms-gold-2)" : "var(--bms-text-1)",
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "column",
                    gap: 0.75,
                    width: 72,
                    px: 0.5,
                    py: 0.75,
                    opacity: disabled ? 0.5 : 1,
                    pointerEvents: disabled ? "none" : "auto",
                  }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 18,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: isBrand ? "rgba(212,175,55,0.10)" : "rgba(255,255,255,0.06)",
                      border: isBrand ? "1px solid rgba(212,175,55,0.35)" : "1px solid rgba(255,255,255,0.14)",
                      color: isBrand ? "var(--bms-gold-2)" : "var(--bms-text-1)",
                    }}
                  >
                    {iconEl}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      maxWidth: 72,
                      textAlign: "center",
                      fontWeight: 400,
                      color: isBrand ? "var(--bms-gold-2)" : "var(--bms-text-1)",
                      lineHeight: 1.15,
                      fontSize: 11,
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              ) : (
                <AppCard
                  title={item.label}
                  subtitle={item.subtitle}
                  icon={iconEl}
                  to={to}
                  disabled={disabled}
                  badge={disabled ? "Soon" : item.badgeText}
                  size={size}
                  shape={shape}
                  tone={item.tone || "neutral"}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
