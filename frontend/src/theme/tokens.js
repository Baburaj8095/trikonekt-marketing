// Trikonekt Clean Consumer Product Design Tokens (Mobile-First Consumer Fintech & Commerce)
export const C = {
  // Brand & Core Colors
  primary: "#1E40AF",         // Deep Trustworthy Blue
  primaryDark: "#1E3A8A",     // Deep Blue Hover & Active
  primaryLight: "#EFF6FF",    // Soft Crisp Blue Surface
  primaryBorder: "#BFDBFE",   // Light Clean Border
  secondary: "#4338CA",       // Indigo Accent
  secondaryLight: "#EEF2FF",  // Soft Indigo Tint

  // Clean White / Slate Canvas Surfaces (White/Light for most content areas)
  bg: "#F8FAFC",              // Clean Slate 50 App Background
  surface: "#FFFFFF",         // Crisp White Card Surface
  surfaceSubtle: "#F1F5F9",   // Slate 100 Input & Secondary Background
  border: "#E2E8F0",          // Slate 200 Card & Divider Border
  borderSubtle: "#F1F5F9",    // Slate 100 Subtle Divider

  // High-Contrast Content Hierarchy Typography
  text: "#0F172A",            // Slate 900 High-Contrast Primary Text
  textSec: "#475569",         // Slate 600 Secondary Content Text
  textMuted: "#94A3B8",       // Slate 400 Hint & Timestamp Text
  textInverse: "#FFFFFF",     // White Text on Dark/Hero Surfaces

  // Selective Deep Navy Surfaces (Reserved for Hero & High-Value Cards only)
  heroNavy: "#0F172A",
  heroNavyCard: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
  financialHero: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)",

  // Strict Semantic Colors (Content > Function > Decoration)
  success: "#059669",         // Emerald Positive / Credit
  successBg: "#ECFDF5",       // Soft Green Badge
  successBorder: "#A7F3D0",
  danger: "#DC2626",          // Red Debit / Error / Destructive
  dangerBg: "#FEF2F2",        // Soft Red Badge
  dangerBorder: "#FECACA",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  warning: "#D97706",         // Amber Warning / Due
  warningBg: "#FFFBEB",       // Soft Amber Badge
  warningBorder: "#FDE68A",
  gold: "#B45309",            // Gold VIP / Achievement
  goldBg: "#FEF3C7",

  // Shell & Bottom Navigation
  headerBg: "rgba(255, 255, 255, 0.94)",
  bottomNavBg: "rgba(255, 255, 255, 0.96)",
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
  button: 10,
  subCard: 12,
  card: 16,
  hero: 20,
  pill: 999,
  bottomNav: 0,
};

export const S = {
  sm: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
  cardShadow: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
  cardHover: "0 6px 18px -4px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)",
  heroShadow: "0 12px 28px -6px rgba(15, 23, 42, 0.20)",
  floatingShadow: "0 12px 32px -4px rgba(15, 23, 42, 0.12)",
  bottomNavShadow: "0 -2px 16px 0 rgba(15, 23, 42, 0.06)",
};

// Single Primary Font Family: Inter
export const T = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: { fontSize: "24px", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.02em" },
  h1: { fontSize: "20px", fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.015em" },
  h2: { fontSize: "17px", fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.01em" },
  h3: { fontSize: "15px", fontWeight: 600, lineHeight: 1.4 },
  financial: { fontSize: "26px", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em" },
  body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.5 },
  bodyMedium: { fontSize: "14px", fontWeight: 500, lineHeight: 1.5 },
  caption: { fontSize: "12px", fontWeight: 500, lineHeight: 1.4 },
  pill: { fontSize: "11px", fontWeight: 600, lineHeight: 1 },
};

export default { C, SP, R, S, T };
