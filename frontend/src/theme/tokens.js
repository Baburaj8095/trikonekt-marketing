// Trikonekt Modern UI/UX Design System Tokens (Fintech & Commerce Reference)
export const C = {
  // Brand & Core Colors
  primary: "#2563EB",         // Primary Modern Blue
  primaryDark: "#1D4ED8",     // Hover & Active Blue
  primaryLight: "#EFF6FF",    // Soft Blue Tint
  primaryBorder: "#BFDBFE",   // Light Blue Border
  secondary: "#7C3AED",       // Secondary Purple Accent
  secondaryLight: "#F5F3FF",  // Soft Purple Tint
  accent: "#06B6D4",          // Cyan Accent
  info: "#0EA5E9",            // Sky Blue Info
  infoLight: "#E0F2FE",       // Soft Sky Tint

  // Canvas & Surfaces
  bg: "#F8FAFC",              // Clean Light Blue-Gray App Background
  surface: "#FFFFFF",         // Pure White Elevated Cards & Dialogs
  surfaceSubtle: "#F1F5F9",   // Muted Input & Container Background
  border: "#E2E8F0",          // Standard 1px Border
  borderSubtle: "#F1F5F9",    // Secondary Subtle Divider

  // Typography Hierarchy
  text: "#0F172A",            // Primary Slate 900 High-Contrast Text
  textSec: "#64748B",         // Secondary Slate 600 Subtitle Text
  textMuted: "#94A3B8",       // Muted Slate 400 Placeholder/Hint Text
  textInverse: "#FFFFFF",     // White text on dark/colored surfaces

  // Quick Action & Feature Identity Colors
  addMoney: "#2563EB",        // Blue
  buyPackage: "#7C3AED",      // Purple
  withdraw: "#EA580C",        // Orange
  history: "#0D9488",         // Teal
  blocks: "#059669",          // Emerald Green
  menu: "#4F46E5",            // Indigo
  shop: "#0284C7",            // Cyan/Blue
  travel: "#0284C7",          // Sky/Travel

  // Semantic Status & Indicator Colors
  success: "#16A34A",         // Positive / Approved Green
  successBg: "#DCFCE7",       // Soft Green Badge Background
  warning: "#F59E0B",         // Pending / Alert Amber
  warningBg: "#FEF3C7",       // Soft Amber Badge Background
  danger: "#EF4444",          // Error / Rejected Red
  dangerBg: "#FEE2E2",        // Soft Red Badge Background
  error: "#EF4444",
  errorBg: "#FEE2E2",

  // Gradients (Used selectively for Hero cards only)
  heroGradient: "linear-gradient(135deg, #1E40AF 0%, #2563EB 60%, #3B82F6 100%)",
  mainWalletGradient: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
  promoGradient: "linear-gradient(135deg, #0284C7 0%, #2563EB 100%)",
  bottomNavBg: "rgba(255, 255, 255, 0.94)",
};

export const SP = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const R = {
  sm: 8,
  subCard: 12,
  button: 12,
  card: 16,
  modal: 20,
  pill: 999,
  bottomNav: 24,
};

export const S = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  cardShadow: "0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
  buttonShadow: "0 4px 12px rgba(37, 99, 235, 0.20)",
  floatingShadow: "0 12px 32px -4px rgba(15, 23, 42, 0.12)",
  bottomNavShadow: "0 -4px 20px 0 rgba(15, 23, 42, 0.08)",
};

export const T = {
  fontFamily: "'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  h1: { fontSize: "32px", fontWeight: 700, lineHeight: 1.2 },
  h2: { fontSize: "24px", fontWeight: 600, lineHeight: 1.25 },
  h3: { fontSize: "20px", fontWeight: 600, lineHeight: 1.3 },
  body: { fontSize: "16px", fontWeight: 400, lineHeight: 1.5 },
  bodyMedium: { fontSize: "16px", fontWeight: 500, lineHeight: 1.5 },
  caption: { fontSize: "14px", fontWeight: 400, lineHeight: 1.4 },
  small: { fontSize: "12px", fontWeight: 400, lineHeight: 1.3 },
};

export default { C, SP, R, S, T };
