import React from "react";
import V2Card from "./V2Card";

/**
 * V2SectionCard
 * Backward-compatible alias to the standardized V2Card.
 * Ensures every card uses the single card system.
 */
export default function V2SectionCard({ children, sx = {}, hover = true, ...rest }) {
  return (
    <V2Card sx={sx} hover={hover} {...rest}>
      {children}
    </V2Card>
  );
}
