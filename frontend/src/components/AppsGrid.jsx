import React, { useState } from "react";
import { Box, Paper, Typography, Snackbar, Alert } from "@mui/material";
import { alpha } from "@mui/material/styles";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import { useNavigate } from "react-router-dom";

/**
 * AppsGrid (image or icon style)
 *
 * Props:
 * - items: Array<{
 *     key: string;
 *     label: string;
 *     icon?: MUIIconComponent;
 *     route?: string;
 *     comingSoon?: boolean;
 *     image?: string; img?: string; // used in "image" style
 *     badgeText?: string; badgeBg?: string; badgeFg?: string; badgeColor?: string;
 *     subLabel?: string; description?: string; // used in "icon" style
 *     accent?: string; accentColor?: string;  // used in "icon" style (default #22c55e)
 *     ctaText?: string; ctaBg?: string; ctaFg?: string; // optional CTA pill (icon style)
 *   }>
 * - title?: string
 * - columns?: { xs?:number, sm?:number, md?:number, lg?:number }
 * - variant?: "auto" | "icon" | "image"
 *   - auto (default): use image card if an image exists; otherwise icon card
 *   - icon: force icon-first (dark, neon-accent) style like the reference mock
 *   - image: force image-first style
 */
export default function AppsGrid({
  items = [],
  title = null,
  columns = { xs: 2, sm: 3, md: 4, lg: 4 },
  variant = "auto",
}) {
  const navigate = useNavigate();
  const [snackOpen, setSnackOpen] = useState(false);

  const handleClick = (item) => {
    if (item && item.route && !item.comingSoon) {
      navigate(item.route);
      return;
    }
    setSnackOpen(true);
  };

  const gridCols = {
    xs: `repeat(${columns.xs || 2}, minmax(0, 1fr))`,
    sm: `repeat(${columns.sm || 3}, minmax(0, 1fr))`,
    md: `repeat(${columns.md || 4}, minmax(0, 1fr))`,
    lg: `repeat(${columns.lg || 4}, minmax(0, 1fr))`,
  };

  return (
    <Box>
      {title ? (
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}
        >
          {title}
        </Typography>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: gridCols,
          gap: { xs: 1.5, sm: 2 },
          width: "100%",
          alignItems: "stretch",
          justifyItems: "stretch",
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const imageSrc = item.image || item.img;
          const hasImage = Boolean(imageSrc);
          const isIconStyle =
            variant === "icon" || (variant === "auto" && !hasImage && !!Icon);
          const isImageStyle =
            variant === "image" || (variant === "auto" && hasImage);

          // Unified badge stack (top-right)
          const badges = [];
          if (item.badgeText) {
            badges.push({
              text: item.badgeText,
              bg: item.badgeBg || item.badgeColor || "#2563eb",
              fg: item.badgeFg || "#fff",
            });
          }
          if (item.comingSoon) {
            badges.push({ text: "Soon", bg: "rgba(15,23,42,0.85)", fg: "#fff" });
          }

          const accent = item.accent || item.accentColor || "#22c55e";

          // ICON STYLE CARD (dark, accented, icon-first)
          if (isIconStyle) {
            return (
              <Paper
                key={item.key}
                role="button"
                tabIndex={0}
                aria-label={item.label}
                onClick={() => handleClick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(item);
                  }
                }}
                sx={(theme) => ({
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 3,
                  aspectRatio: { xs: "4 / 3", sm: "16 / 9" },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  userSelect: "none",
                  p: 0,
                  background:
                    "linear-gradient(180deg, #121826 0%, #0B1220 100%)",
                  border: "1px solid",
                  borderColor: "rgba(255,255,255,0.06)",
                  boxShadow: "0 6px 20px rgba(2,6,23,0.35)",
                  transition:
                    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
                  "&:hover": {
                    transform: { sm: "translateY(-3px)" },
                    boxShadow: `0 14px 32px ${alpha(accent, 0.22)}`,
                    borderColor: alpha(accent, 0.45),
                  },
                  "&:focus-visible": {
                    outline: `3px solid ${alpha(accent, 0.45)}`,
                    outlineOffset: 2,
                  },
                })}
              >
                {/* Top-right badges */}
                {badges.length > 0 ? (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      zIndex: 3,
                      display: "flex",
                      gap: 0.75,
                    }}
                  >
                    {badges.map((b, i) => (
                      <Box
                        key={`${item.key}-badge-${i}`}
                        sx={{
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 800,
                          bgcolor: b.bg,
                          color: b.fg,
                          boxShadow: 1,
                        }}
                      >
                        {b.text}
                      </Box>
                    ))}
                  </Box>
                ) : null}

                {/* Accent vignette */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(120% 80% at 10% 10%, ${alpha(
                      accent,
                      0.18
                    )} 0%, transparent 55%)`,
                    pointerEvents: "none",
                  }}
                />

                {/* Icon container */}
                {Icon ? (
                  <Box
                    sx={(theme) => ({
                      position: "absolute",
                      top: 14,
                      left: 14,
                      width: 52,
                      height: 52,
                      borderRadius: 2.25,
                      display: "grid",
                      placeItems: "center",
                      background: `linear-gradient(135deg, ${alpha(
                        accent,
                        0.28
                      )} 0%, ${alpha(accent, 0.08)} 100%)`,
                      border: `1px solid ${alpha(accent, 0.45)}`,
                      boxShadow:
                        "inset 0 -8px 18px rgba(0,0,0,0.35), 0 8px 16px rgba(0,0,0,0.35)",
                    })}
                  >
                    <Icon sx={{ color: "#fff", fontSize: 28 }} />
                  </Box>
                ) : null}

                {/* Bottom-right arrow indicator */}
                <Box
                  sx={{
                    position: "absolute",
                    right: 12,
                    bottom: 10,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  <NorthEastIcon
                    sx={{ fontSize: 16, color: "rgba(255,255,255,0.85)" }}
                  />
                </Box>

                {/* Text */}
                <Box
                  sx={{
                    position: "absolute",
                    left: 14,
                    right: 48,
                    bottom: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.25,
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 800,
                      color: "#fff",
                      lineHeight: 1.2,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                      fontSize: { xs: 14, sm: 15 },
                    }}
                  >
                    {item.label}
                  </Typography>
                  {(item.subLabel || item.description) ? (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "rgba(255,255,255,0.78)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.subLabel || item.description}
                    </Typography>
                  ) : null}

                  {/* Optional CTA pill */}
                  {item.ctaText ? (
                    <Box
                      sx={{
                        mt: 0.5,
                        alignSelf: "flex-start",
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        bgcolor: item.ctaBg || alpha(accent, 0.28),
                        color: item.ctaFg || "#fff",
                        border: `1px solid ${alpha(accent, 0.55)}`,
                      }}
                    >
                      {item.ctaText}
                    </Box>
                  ) : null}
                </Box>
              </Paper>
            );
          }

          // IMAGE STYLE CARD (photo background + gradient + title)
          if (isImageStyle) {
            return (
              <Paper
                key={item.key}
                role="button"
                tabIndex={0}
                aria-label={item.label}
                onClick={() => handleClick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(item);
                  }
                }}
                sx={{
                  p: 0,
                  borderRadius: 3,
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  aspectRatio: { xs: "4 / 3", sm: "16 / 9" },
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  gap: 0,
                  cursor: "pointer",
                  userSelect: "none",
                  border: "1px solid",
                  borderColor: "divider",
                  background: "#000",
                  transition:
                    "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                  boxShadow: { xs: 1, sm: 2 },
                  "& .app-bg": { transition: "transform 320ms ease" },
                  "&:focus-visible": {
                    outline: "3px solid rgba(59,130,246,0.45)",
                    outlineOffset: 2,
                  },
                  "&:active": { transform: "scale(0.992)" },
                  "&:hover": {
                    transform: { sm: "translateY(-3px)" },
                    boxShadow: 6,
                    borderColor: "rgba(0,0,0,0.08)",
                  },
                  "&:hover .app-bg": { transform: "scale(1.06)" },
                }}
              >
                {/* Badges (top-right) */}
                {badges.length > 0 ? (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      zIndex: 3,
                      display: "flex",
                      gap: 0.75,
                    }}
                  >
                    {badges.map((b, i) => (
                      <Box
                        key={`${item.key}-badge-${i}`}
                        sx={{
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 10,
                          fontSize: 10,
                          fontWeight: 800,
                          bgcolor: b.bg,
                          color: b.fg,
                          boxShadow: 1,
                        }}
                      >
                        {b.text}
                      </Box>
                    ))}
                  </Box>
                ) : null}

                {/* Background image */}
                <Box
                  className="app-bg"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${imageSrc})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "saturate(1.04) contrast(1.03)",
                    borderRadius: "inherit",
                    zIndex: 0,
                    willChange: "transform",
                  }}
                />
                {/* Gradient overlay for text legibility */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.70) 12%, rgba(0,0,0,0.28) 52%, rgba(0,0,0,0.00) 100%)",
                    borderRadius: "inherit",
                    zIndex: 1,
                  }}
                />

                {/* Title (no background pill) */}
                <Box
                  sx={{
                    position: "absolute",
                    zIndex: 2,
                    left: 12,
                    right: 12,
                    bottom: 10,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                      color: "#fff",
                      textAlign: "left",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1.2,
                      fontSize: { xs: 13, sm: 14 },
                      textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              </Paper>
            );
          }

          // Fallback simple icon on light card (rare)
          const bg = item.color || "#f0f6ff";
          const fg = item.textColor || "#0f172a";
          return (
            <Paper
              key={item.key}
              role="button"
              tabIndex={0}
              aria-label={item.label}
              onClick={() => handleClick(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClick(item);
                }
              }}
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 3,
                position: "relative",
                overflow: "hidden",
                display: "flex",
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                aspectRatio: { xs: "4 / 3", sm: "16 / 9" },
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 1,
                cursor: "pointer",
                userSelect: "none",
                border: "1px solid",
                borderColor: "divider",
                background: "#ffffff",
                transition: "transform 160ms ease, box-shadow 160ms ease",
                boxShadow: { xs: 1, sm: 2 },
                "&:focus-visible": {
                  outline: "3px solid rgba(59,130,246,0.45)",
                  outlineOffset: 2,
                },
                "&:active": { transform: "scale(0.992)" },
                "&:hover": { transform: { sm: "translateY(-3px)" }, boxShadow: 6 },
              }}
            >
              {badges.length > 0 ? (
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 3,
                    display: "flex",
                    gap: 0.75,
                  }}
                >
                  {badges.map((b, i) => (
                    <Box
                      key={`${item.key}-badge-${i}`}
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 800,
                        bgcolor: b.bg,
                        color: b.fg,
                        boxShadow: 1,
                      }}
                    >
                      {b.text}
                    </Box>
                  ))}
                </Box>
              ) : null}
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  minWidth: 64,
                  borderRadius: 2,
                  background: bg,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                }}
              >
                {Icon ? <Icon sx={{ color: fg, fontSize: 28 }} /> : null}
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  color: "#0f172a",
                  textAlign: "center",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  wordBreak: "break-word",
                  hyphens: "auto",
                  lineHeight: 1.25,
                  mt: 0.75,
                  fontSize: { xs: 12, sm: 13 },
                  minHeight: { xs: 30, sm: 32 },
                }}
              >
                {item.label}
              </Typography>
            </Paper>
          );
        })}
      </Box>

      <Snackbar
        open={snackOpen}
        onClose={() => setSnackOpen(false)}
        autoHideDuration={1800}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackOpen(false)}
          severity="info"
          sx={{ width: "100%" }}
        >
          Coming soon
        </Alert>
      </Snackbar>
    </Box>
  );
}
