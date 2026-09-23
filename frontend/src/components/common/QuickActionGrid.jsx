import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Paper, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import { C, R, S } from "../../theme/tokens";

export default function QuickActionGrid({ variant = "dashboard" }) {
  const navigate = useNavigate();

  const actions =
    variant === "wallet"
      ? [
          { label: "Add Money", icon: AddRoundedIcon, color: C.addMoney, bg: C.primaryLight, route: "/user/upload-wallet" },
          { label: "Withdraw", icon: ArrowUpwardRoundedIcon, color: C.withdraw, bg: "#FFF7ED", route: "/user/withdrawal" },
          { label: "Transfer", icon: SwapHorizRoundedIcon, color: C.blocks, bg: "#ECFDF5", route: "/user/team-wallet" },
          { label: "History", icon: HistoryRoundedIcon, color: C.history, bg: "#F0FDFA", route: "/user/history" },
        ]
      : [
          { label: "Add Money", icon: AddRoundedIcon, color: C.addMoney, bg: C.primaryLight, route: "/user/upload-wallet" },
          { label: "Packages", icon: ShoppingBagRoundedIcon, color: C.buyPackage, bg: "#F5F3FF", route: "/user/packages/join-subscription" },
          { label: "Withdraw", icon: ArrowUpwardRoundedIcon, color: C.withdraw, bg: "#FFF7ED", route: "/user/wallet" },
          { label: "History", icon: HistoryRoundedIcon, color: C.history, bg: "#F0FDFA", route: "/user/history" },
        ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.75, sm: 2 },
        borderRadius: `${R.card}px`,
        bgcolor: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow: S.cardShadow,
      }}
    >
      <Stack direction="row" justifyContent="space-around" alignItems="center">
        {actions.map((act) => {
          const IconComp = act.icon;
          return (
            <Box
              key={act.label}
              role="button"
              tabIndex={0}
              onClick={() => navigate(act.route)}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.75,
                cursor: "pointer",
                transition: "transform 140ms ease",
                "&:active": { transform: "scale(0.92)" },
              }}
            >
              <Box
                sx={{
                  width: { xs: 48, sm: 54 },
                  height: { xs: 48, sm: 54 },
                  borderRadius: "50%",
                  bgcolor: act.bg,
                  color: act.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${act.color}22`,
                  boxShadow: `0 4px 12px ${act.color}18`,
                  transition: "box-shadow 160ms ease",
                  "&:hover": {
                    boxShadow: `0 6px 16px ${act.color}28`,
                  },
                }}
              >
                <IconComp sx={{ fontSize: { xs: 22, sm: 26 } }} />
              </Box>
              <Typography
                sx={{
                  fontSize: { xs: 11.5, sm: 12.5 },
                  fontWeight: 600,
                  color: C.text,
                  textAlign: "center",
                }}
              >
                {act.label}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
