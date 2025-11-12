import React from "react";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

/**
 * MUI ThemeProvider with strong style overrides to guarantee white surfaces
 * for DataGrid rows/cells and dialog form fields across the admin.
 */
const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f1f5f9",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": { colorScheme: "light" },
        body: { color: "#0f172a" },
      },
    },
    // Ensure Dialog paper (Create/Edit) is white
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#ffffff",
        },
      },
    },
    // Ensure text inputs render on white, including disabled/readonly
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          "&.Mui-disabled": {
            backgroundColor: "#ffffff",
            WebkitTextFillColor: "#0f172a",
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#e5e7eb",
          },
          "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
            borderColor: "#e5e7eb",
          },
        },
        input: {
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
    // Strong DataGrid-wide overrides (requires @mui/x-data-grid)
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
