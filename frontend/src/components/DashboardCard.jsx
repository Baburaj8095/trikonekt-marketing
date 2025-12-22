import React from "react";
import { Card, CardActionArea, Box, Typography } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

/**
 * DashboardCard
 * - Mobile-first, responsive promotional/action card with background image, gradient overlay, title/subtitle, and optional badge.
 * - Interaction: CardActionArea with smooth hover transitions (scale/translate on desktop) and subtle shadow changes.
 *
 * Props:
 * - title: string (required)
 * - subtitle?: string
 * - image: string (required) - url or imported asset
 * - to?: string (react-router-dom link target)
 * - onClick?: () => void
 * - badgeText?: string
 * - badgeVariant?: 'prime' | 'soon' | 'rewards' | 'default'
 * - badgeSx?: sx overrides for the badge container
 * - sx?: sx overrides for outer Card
 * - actionAreaProps?: extra props forwarded to CardActionArea
 */
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  overflow: "hidden",
  backgroundColor: "transparent",
  boxShadow: "none",
  border: "1px solid",
  borderColor: alpha(theme.palette.common.black, 0.08),
  transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
  willChange: "transform",
  [theme.breakpoints.up("md")]: {
    "&:hover": {
      transform: "translateY(-3px)",
    },
  },
  "&:hover": {
    boxShadow: "0 8px 20px rgba(2,6,23,0.10)",
    borderColor: alpha(theme.palette.common.black, 0.12),
  },
}));

const Action = styled(CardActionArea)(({ theme }) => ({
  position: "relative",
  display: "block",
  // Ensure the interactive area controls the scale effect on desktop
  transition: "transform 200ms ease, box-shadow 200ms ease",
  "&:hover .dc-bg": {
    transform: "scale(1.05)",
  },
}));

const Media = styled("div")(({ theme }) => ({
  position: "relative",
  width: "100%",
  // Mobile-first 16:9 aspect ratio
  aspectRatio: "16 / 9",
  // On larger screens, allow flexible height without breaking layout
  [theme.breakpoints.up("md")]: {
    aspectRatio: "auto",
    minHeight: 180,
  },
}));

const Background = styled("div")({
  position: "absolute",
  inset: 0,
  backgroundSize: "cover",
  backgroundPosition: "center",
  transform: "translateZ(0)",
  transition: "transform 400ms ease",
  willChange: "transform",
});

const Overlay = styled("div")(({ theme }) => ({
  position: "absolute",
  inset: 0,
  // Gradient tuned for readability on varied images (WCAG-friendly)
  background:
    "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.28) 40%, rgba(0,0,0,0.62) 100%)",
}));

const Content = styled(Box)(({ theme }) => ({
  position: "absolute",
  left: theme.spacing(1.25),
  right: theme.spacing(1.25),
  bottom: theme.spacing(1.25),
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "#fff",
  pointerEvents: "none",
}));

const Badge = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(1),
  right: theme.spacing(1),
  zIndex: 2,
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: 0.2,
  boxShadow: "none",
}));

function getBadgeStyles(variant, theme) {
  switch (variant) {
    case "prime":
      return {
        bgcolor: theme.palette.success.main,
        color: theme.palette.success.contrastText,
      };
    case "soon":
      return {
        bgcolor: theme.palette.grey[900],
        color: "#fff",
      };
    case "rewards":
      return {
        bgcolor: theme.palette.secondary.main,
        color: theme.palette.secondary.contrastText,
      };
    default:
      return {
        bgcolor: alpha("#000", 0.64),
        color: "#fff",
      };
  }
}

export default function DashboardCard({
  title,
  subtitle,
  image,
  to,
  onClick,
  badgeText,
  badgeVariant = "default",
  badgeSx,
  sx,
  actionAreaProps,
}) {
  const actionProps = { ...actionAreaProps };

  if (to) {
    actionProps.component = RouterLink;
    actionProps.to = to;
  } else if (onClick) {
    actionProps.onClick = onClick;
  }

  return (
    <StyledCard elevation={0} sx={sx}>
      <Action focusRipple aria-label={title} {...actionProps}>
        {badgeText ? (
          <Badge
            role="status"
            aria-live="polite"
            sx={(theme) => ({
              ...getBadgeStyles(badgeVariant, theme),
              ...badgeSx,
            })}
          >
            {badgeText}
          </Badge>
        ) : null}

        <Media>
          <Background
            className="dc-bg"
            style={{ backgroundImage: `url(${image})` }}
          />
          <Overlay />

          <Content>
            {title ? (
              <Typography
                variant="subtitle1"
                sx={{
                  fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
                  fontWeight: 800,
                  lineHeight: 1.15,
                  color: "#fff",
                  textShadow: "0 1px 2px rgba(0,0,0,0.35)",
                  // 2–3 words should fit comfortably on two lines
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {title}
              </Typography>
            ) : null}

            {subtitle ? (
              <Typography
                variant="caption"
                sx={{
                  fontFamily: "Poppins, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
                  fontWeight: 500,
                  color: alpha("#FFFFFF", 0.92),
                  textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                  mt: 0.25,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {subtitle}
              </Typography>
            ) : null}
          </Content>
        </Media>
      </Action>
    </StyledCard>
  );
}
