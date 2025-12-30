import React from "react";
import { Button as MUIButton } from "@mui/material";
import buttonTokens from "../theme/button";

/**
 * V2Button
 * Single source of truth for all buttons in v2.
 * - Fixed height 44px
 * - Radius 8px
 * - Padding 0 16px
 * - Font 14px / 600
 * Variants: primary, secondary, disabled handled by MUI disabled prop
 */
export default function V2Button({
  variant = "primary",
  fullWidth = false,
  sx = {},
  children,
  ...rest
}) {
  const v =
    variant === "secondary" ? buttonTokens.variants.secondary : buttonTokens.variants.primary;

  return (
    <MUIButton
      disableElevation
      fullWidth={fullWidth}
      sx={{
        height: `${buttonTokens.height}px`,
        minHeight: `${buttonTokens.height}px`,
        borderRadius: `${buttonTokens.radius}px`,
        px: `${buttonTokens.paddingX}px`,
        py: 0,
        fontSize: `${buttonTokens.fontSize}px`,
        fontWeight: buttonTokens.fontWeight,
        textTransform: "none",
        bgcolor: v.bg,
        color: v.color,
        border: v.border,
        "&:hover": { bgcolor: v.bgHover },
        "&.Mui-disabled": { opacity: buttonTokens.disabledOpacity, color: v.color },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </MUIButton>
  );
}
