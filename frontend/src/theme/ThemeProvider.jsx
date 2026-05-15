import React from "react";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

/**
 * Global MUI theme
 * - Unifies font
 * - Professional, colorful primary buttons (gradient)
 * - Keeps admin grids/dialogs on clean white surfaces
 * - Light UI background consistent with admin shell
 */
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0ea5e9",       // Admin accent (sky blue)
      dark: "#0284c7",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#a855f7",       // Purple accent for variety
      contrastText: "#ffffff",
    },
    success: {
      main: "#22c55e",       // Green for gradient blend
    },
    background: {
      default: "#f6f8fb",    // Native-app light background
      paper: "#ffffff",      // Cards/dialogs on white
    },
    text: {
      primary: "#0f172a",
    },
    divider: "#e5e7eb",
  },
  typography: {
    // Professional, readable stack; use Montserrat globally
    fontFamily:
      'Montserrat, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Color Emoji", "Segoe UI Emoji"',
    fontSize: 14,
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 800 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
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
          color: "#0f172a",
          background:
            "radial-gradient(circle at 15% -10%, rgba(14,165,233,0.08), transparent 34%), radial-gradient(circle at 92% 0%, rgba(34,197,94,0.07), transparent 30%), #f6f8fb",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          overscrollBehaviorY: "none",
        },
        "*": {
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 transparent",
        },
        "*::-webkit-scrollbar": {
          width: 8,
          height: 8,
        },
        "*::-webkit-scrollbar-thumb": {
          background: "#cbd5e1",
          borderRadius: 999,
        },
      },
    },

    // Set fullWidth by default for inputs and form controls
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

    // Buttons: colorful & professional primary by default
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          fontWeight: 800,
          minHeight: 46,
          padding: "10px 16px",
          letterSpacing: 0,
          transition: "transform 140ms ease, box-shadow 180ms ease, background-color 180ms ease",
          "&:active": {
            transform: "scale(0.985)",
          },
        },
        containedPrimary: {
          // Subtle blue->green gradient for primary actions across the app
          backgroundImage: "linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)",
          color: "#ffffff",
          boxShadow: "0 12px 26px rgba(14,165,233,0.24)",
          "&:hover": {
            backgroundImage: "linear-gradient(135deg, #0284c7 0%, #16a34a 100%)",
            boxShadow: "0 16px 34px rgba(2,132,199,0.28)",
          },
          "&:active": {
            boxShadow: "0 6px 10px rgba(2,132,199,0.22)",
          },
          "&.Mui-disabled": {
            color: "rgba(255,255,255,0.7)",
          },
        },
        outlinedPrimary: {
          borderColor: "rgba(14,165,233,0.35)",
          color: "#0284c7",
          "&:hover": {
            borderColor: "rgba(14,165,233,0.6)",
            backgroundColor: "rgba(14,165,233,0.08)",
          },
        },
        textPrimary: {
          color: "#0284c7",
          "&:hover": {
            backgroundColor: "rgba(14,165,233,0.08)",
          },
        },
      },
    },

    // Ensure Dialog paper (Create/Edit) is white
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
          borderRadius: 22,
          boxShadow: "0 24px 80px rgba(15,23,42,0.22)",
        },
      },
    },

    // Ensure text inputs render on white, including disabled/readonly
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          borderRadius: 14,
          transition: "box-shadow 160ms ease, border-color 160ms ease",
          "&.Mui-disabled": {
            backgroundColor: "#ffffff",
            WebkitTextFillColor: "#0f172a",
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#e2e8f0",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#bfdbfe",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#2563eb",
            borderWidth: 1.5,
          },
          "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
            borderColor: "#e5e7eb",
          },
        },
        input: {
          padding: "12px 14px",
          "&.Mui-disabled": {
            WebkitTextFillColor: "#0f172a",
          },
        },
      },
    },

    // Ensure Select uses white input surface as well
    MuiSelect: {
      styleOverrides: {
        select: {
          backgroundColor: "#ffffff",
        },
        outlined: {
          backgroundColor: "#ffffff",
        },
      },
    },

    // Cards and surfaces: rounded + soft shadows for uniform ecommerce look
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          backgroundColor: "#ffffff",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          overflow: "hidden",
          transition: "box-shadow 200ms ease, transform 180ms ease, border-color 180ms ease",
          boxShadow: "0 14px 38px rgba(15,23,42,0.07), 0 1px 2px rgba(15,23,42,0.04)",
          border: "1px solid rgba(226,232,240,0.86)",
          "&:hover": {
            boxShadow: "0 18px 46px rgba(15,23,42,0.11), 0 3px 6px rgba(15,23,42,0.06)",
            transform: "translateY(-1px)",
          },
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          WebkitOverflowScrolling: "touch",
        },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 900,
          color: "#0f172a",
          lineHeight: 1.2,
        },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "12px 16px 16px",
          gap: 8,
          flexWrap: "wrap",
        },
      },
    },

    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(226,232,240,0.72)",
          "&::after": {
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.58), transparent)",
          },
        },
      },
    },

    // DataGrid: force clean white tables in admin
    // (requires @mui/x-data-grid)
    MuiDataGrid: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          // Force all internal layers to white
          "& .MuiDataGrid-main": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-columnHeaders": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScroller": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScrollerContent": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScrollerRenderZone": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-cell": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-footerContainer": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-overlay": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-filler": { backgroundColor: "#ffffff" },
          // Keep hover/selected rows untinted
          "& .MuiDataGrid-row:hover": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row.Mui-hover": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: "#ffffff" },
          // Remove any gradients that might tint layers
          "& *": { backgroundImage: "none" },
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
