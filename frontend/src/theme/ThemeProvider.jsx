import React from "react";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { C, R, S, T } from "./tokens";

/**
 * Global MUI Theme
 * - Unified typography (Inter / Poppins)
 * - Fintech-grade mobile-first surfaces and controls
 * - Strict adherence to the Trikonekt Modern UI Design System
 */
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: C.primary,
      dark: C.primaryDark,
      light: C.primaryLight,
      contrastText: "#ffffff",
    },
    secondary: {
      main: C.secondary,
      contrastText: "#ffffff",
    },
    success: {
      main: C.success,
      light: C.successBg,
    },
    warning: {
      main: C.warning,
      light: C.warningBg,
    },
    error: {
      main: C.error,
      light: C.errorBg,
    },
    background: {
      default: C.bg,
      paper: C.surface,
    },
    text: {
      primary: C.text,
      secondary: C.textSec,
      disabled: C.textMuted,
    },
    divider: C.border,
  },
  shape: {
    borderRadius: R.md,
  },
  typography: {
    fontFamily: T.fontFamily,
    fontSize: 14,
    allVariants: {
      letterSpacing: 0,
    },
    h1: { fontSize: "32px", fontWeight: 700, color: C.text },
    h2: { fontSize: "24px", fontWeight: 600, color: C.text },
    h3: { fontSize: "20px", fontWeight: 600, color: C.text },
    h4: { fontSize: "18px", fontWeight: 600, color: C.text },
    h5: { fontSize: "16px", fontWeight: 600, color: C.text },
    h6: { fontSize: "15px", fontWeight: 600, color: C.text },
    body1: { fontSize: "15px", fontWeight: 400, color: C.text },
    body2: { fontSize: "13.5px", fontWeight: 400, color: C.textSec },
    button: {
      textTransform: "none",
      fontWeight: 600,
      fontSize: "14px",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": { colorScheme: "light" },
        html: {
          WebkitTapHighlightColor: "transparent",
          scrollBehavior: "smooth",
        },
        body: {
          color: C.text,
          background: C.bg,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          overscrollBehaviorY: "auto",
        },
        "*": {
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 transparent",
        },
        "*::-webkit-scrollbar": {
          width: 6,
          height: 6,
        },
        "*::-webkit-scrollbar-thumb": {
          background: "#cbd5e1",
          borderRadius: 999,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: C.surface,
        },
        rounded: {
          borderRadius: R.card,
        },
        elevation0: {
          boxShadow: "none",
        },
        elevation1: {
          boxShadow: S.cardShadow,
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: R.card,
          border: `1px solid ${C.border}`,
          boxShadow: S.cardShadow,
          backgroundColor: C.surface,
        },
      },
    },

    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: R.button,
          fontWeight: 600,
          minHeight: 44,
          padding: "8px 18px",
          letterSpacing: 0,
          transition: "transform 140ms ease, box-shadow 160ms ease, background-color 160ms ease",
          "&:active": {
            transform: "scale(0.985)",
          },
        },
        containedPrimary: {
          backgroundColor: C.primary,
          color: "#ffffff",
          "&:hover": {
            backgroundColor: C.primaryDark,
          },
          "&.Mui-disabled": {
            backgroundColor: "#E2E8F0",
            color: "#94A3B8",
          },
        },
        outlinedPrimary: {
          borderColor: C.border,
          color: C.primary,
          "&:hover": {
            borderColor: C.primaryBorder,
            backgroundColor: C.primaryLight,
          },
        },
        textPrimary: {
          color: C.primary,
          "&:hover": {
            backgroundColor: C.primaryLight,
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: C.surface,
          borderRadius: R.modal,
          boxShadow: S.floatingShadow,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        fullWidth: true,
      },
    },

    MuiFormControl: {
      defaultProps: {
        fullWidth: true,
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: C.surface,
          borderRadius: R.button,
          transition: "box-shadow 160ms ease, border-color 160ms ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: C.border,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: C.primaryBorder,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: C.primary,
            borderWidth: 1.5,
          },
          "&.Mui-disabled": {
            backgroundColor: C.surfaceSubtle,
          },
        },
        input: {
          padding: "11px 14px",
          fontSize: "14px",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: R.pill,
        },
        sizeSmall: {
          height: 24,
          fontSize: "11px",
        },
      },
    },
  },
});

export default function ThemeProvider({ children }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
export { theme };
