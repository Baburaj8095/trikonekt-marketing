import React from "react";
import { Box, Grid, Paper, Typography } from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import HourglassEmptyRoundedIcon from "@mui/icons-material/HourglassEmptyRounded";
import { C, R, S } from "../../theme/tokens";

export default function MonthMatrixSelector({
  totalBoxes = 12,
  purchasedBoxes = [],
  pendingBoxes = [],
  selectedBoxes = [],
  onToggleBox,
  disabled = false,
}) {
  const boxes = Array.from({ length: totalBoxes }, (_, i) => i + 1);

  return (
    <Box sx={{ width: "100%" }}>
      <Grid container spacing={1.25}>
        {boxes.map((num) => {
          const isPurchased = purchasedBoxes.includes(num);
          const isPending = pendingBoxes.includes(num);
          const isSelected = selectedBoxes.includes(num);

          let bg = C.surface;
          let color = C.text;
          let border = `1.5px solid ${C.border}`;
          let cursor = "pointer";

          if (isPurchased) {
            bg = C.successBg;
            color = C.success;
            border = `1.5px solid ${C.success}`;
            cursor = "default";
          } else if (isPending) {
            bg = C.warningBg;
            color = C.warning;
            border = `1.5px solid ${C.warning}`;
            cursor = "default";
          } else if (isSelected) {
            bg = C.primary;
            color = "#ffffff";
            border = `1.5px solid ${C.primaryDark}`;
          }

          return (
            <Grid item xs={3} key={num}>
              <Paper
                elevation={0}
                role="button"
                tabIndex={isPurchased || isPending || disabled ? -1 : 0}
                onClick={() => {
                  if (!isPurchased && !isPending && !disabled && onToggleBox) {
                    onToggleBox(num);
                  }
                }}
                sx={{
                  height: 52,
                  borderRadius: `${R.md}px`,
                  bgcolor: bg,
                  color,
                  border,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isPurchased || isPending || disabled ? "default" : cursor,
                  boxShadow: isSelected ? "0 4px 12px rgba(37, 99, 235, 0.3)" : S.sm,
                  transition: "all 140ms ease",
                  "&:active": !isPurchased && !isPending && !disabled ? { transform: "scale(0.94)" } : undefined,
                }}
              >
                <Typography sx={{ fontSize: 16, fontWeight: isSelected || isPurchased ? 700 : 600 }}>
                  {num}
                </Typography>
                {isPurchased ? (
                  <CheckRoundedIcon sx={{ fontSize: 14, color: C.success }} />
                ) : isPending ? (
                  <HourglassEmptyRoundedIcon sx={{ fontSize: 13, color: C.warning }} />
                ) : null}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
