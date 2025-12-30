import React, { useState } from "react";
import {
  Box,
  Avatar,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem
} from "@mui/material";
import V2Button from "./V2Button";
import colors from "../theme/colors";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";

/**
 * V2Header
 * Sticky header consistent with UserDashboardV2:
 * - Avatar + display email
 * - ID line
 * - Prime/Non-Prime chip
 * - Sign Out button (sm+) and overflow menu for xs
 *
 * Props:
 * - displayEmail: string
 * - displayId: string | number
 * - isPrime: boolean
 * - onLogout: function
 */
export default function V2Header({
  displayEmail = "Consumer",
  displayId = "-",
  isPrime = false,
  onLogout = () => {}
}) {
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const openMenu = Boolean(menuAnchorEl);
  const handleMenuOpen = (e) => setMenuAnchorEl(e.currentTarget);
  const handleMenuClose = () => setMenuAnchorEl(null);

  return (
    <Box
      sx={{
        px: 2,
        pt: 2,
        pb: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        flexWrap: "wrap",
        rowGap: 1,
        borderBottom: `1px solid ${colors.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
        bgcolor: colors.surface,
        color: colors.textPrimary,
      }}
    >
      <Avatar sx={{ bgcolor: colors.primary, color: colors.surface, width: 44, height: 44 }}>
        <PersonRoundedIcon />
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary, lineHeight: 1.2, wordBreak: "break-word" }}>
          {displayEmail}
        </Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.7, wordBreak: "break-word" }}>
          ID: {String(displayId)}
        </Typography>
      </Box>

      <Chip
        size="small"
        label={isPrime ? "Prime" : "Non‑Prime"}
        sx={{
          bgcolor: isPrime ? colors.success : colors.white,
          color: isPrime ? colors.textOnPrimary : colors.textPrimary,
          fontWeight: 700,
        }}
      />

      <V2Button
        onClick={onLogout}
        sx={{ ml: 1, display: { xs: "none", sm: "inline-flex" } }}
        startIcon={<LogoutRoundedIcon />}
      >
        Sign Out
      </V2Button>

      <IconButton
        aria-label="menu"
        onClick={handleMenuOpen}
        sx={{
          ml: "auto",
          display: { xs: "inline-flex", sm: "none" },
          color: colors.textPrimary,
        }}
      >
        <MoreVertRoundedIcon />
      </IconButton>
      <Menu
        anchorEl={menuAnchorEl}
        open={openMenu}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            bgcolor: colors.card,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onLogout();
          }}
          sx={{ gap: 1.5 }}
        >
          <LogoutRoundedIcon fontSize="small" />
          Sign Out
        </MenuItem>
      </Menu>
    </Box>
  );
}
