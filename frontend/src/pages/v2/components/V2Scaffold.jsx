import React, { useMemo } from "react";
import { Box } from "@mui/material";
import V2Header from "./V2Header";
import V2BottomNav from "./V2BottomNav";
import colors from "../theme/colors";
import spacing from "../theme/spacing";
import typography from "../theme/typography";
import V2Footer from "./V2Footer";
import "../styles/v2-theme.css";

/**
 * V2Scaffold
 * Page scaffold that applies the DashboardV2 UX to any V2 screen:
 * - Full page dark background and text color
 * - Sticky V2Header at the top
 * - Content area with standard page paddings
 * - Fixed V2BottomNav with reserved bottom padding
 *
 * Props:
 * - children: page body
 * - displayEmail?: string
 * - displayId?: string | number
 * - isPrime?: boolean (defaults to false)
 * - onLogout?: () => void
 * - withBottomNav?: boolean (default true)
 * - contentSx?: MUI sx for inner content container
 */
export default function V2Scaffold({
  children,
  displayEmail,
  displayId,
  isPrime = false,
  onLogout = () => {},
  withBottomNav = true,
  contentSx = {},
}) {
  // If email/id not provided, read a minimal version from storage
  const fallback = useMemo(() => {
    try {
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const parsed = ls ? JSON.parse(ls) : {};
      const user = parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
      const name = user?.full_name || user?.username || "Consumer";
      return {
        email: user?.email || `${name}@example.com`,
        id: user?.user_id || user?.id || "-",
      };
    } catch {
      return { email: "Consumer", id: "-" };
    }
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: colors.background,
        color: colors.textPrimary,
        fontFamily: typography.fontFamily,
        pb: withBottomNav ? 9 : 0, // reserve space for bottom nav
      }}
    >
      <V2Header
        displayEmail={displayEmail || fallback.email}
        displayId={displayId || fallback.id}
        isPrime={isPrime}
        onLogout={onLogout}
      />

      <Box
        sx={{
          px: {
            xs: `${spacing.pagePadding.mobile}px`,
            sm: `${spacing.pagePadding.tablet}px`,
            md: `${spacing.pagePadding.desktop}px`,
          },
          pt: `${spacing.md}px`,
          maxWidth: 1200,
          mx: "auto",
          ...contentSx,
        }}
      >
        {children}
      </Box>

      <V2Footer />
      {withBottomNav ? <V2BottomNav /> : null}
    </Box>
  );
}
