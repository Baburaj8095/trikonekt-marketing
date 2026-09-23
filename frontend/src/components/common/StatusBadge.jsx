import React from "react";
import { Chip } from "@mui/material";
import { C, R } from "../../theme/tokens";

export default function StatusBadge({ status = "ACTIVE", label, size = "small" }) {
  const norm = String(status || "").toUpperCase();

  let bg = C.surfaceSubtle;
  let color = C.textSec;

  if (norm === "ACTIVE" || norm === "APPROVED" || norm === "SUCCESS" || norm === "VERIFIED") {
    bg = C.successBg;
    color = C.success;
  } else if (norm === "PENDING" || norm === "HOLD" || norm === "IN_REVIEW") {
    bg = C.warningBg;
    color = C.warning;
  } else if (norm === "REJECTED" || norm === "FAILED" || norm === "BLOCKED" || norm === "INACTIVE") {
    bg = C.dangerBg;
    color = C.danger;
  }

  const text = label || norm.charAt(0) + norm.slice(1).toLowerCase();

  return (
    <Chip
      size={size}
      label={text}
      sx={{
        bgcolor: bg,
        color,
        fontWeight: 600,
        fontSize: size === "small" ? "11px" : "12.5px",
        height: size === "small" ? 22 : 28,
        borderRadius: `${R.pill}px`,
      }}
    />
  );
}
