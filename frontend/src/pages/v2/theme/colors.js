/**
 * v2 Theme - Colors (Design System: Light, Gold-centric)
 * Single source of truth. No inline hex values in screens/components.
 *
 * Palette (STRICT):
 * - Primary Gold: #FF7B00
 * - Secondary Orange: #FF8D21
 * - Accent Light: #FFA652
 * - Background Cream: #FFCD90
 * - Pure White: #FFFFFF
 * - Text Primary: #1F2937
 * - Text Secondary: #6B7280
 * - Border Light: #E5E7EB
 */
const colors = {
  // Brand
  primary: "#FF7B00",
  primaryHover: "#FF8D21",
  secondary: "#FF8D21",
  accent: "#FFA652",

  // Surfaces
  background: "#FFCD90", // page background
  surface: "#FFFFFF", // containers / cards / header/footer surfaces
  card: "#FFFFFF",
  elevated: "#FFFFFF",
  white: "#FFFFFF",

  // Text
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#6B7280",
  textOnPrimary: "#FFFFFF",
  textOnDark: "#FFFFFF", // kept for backward compatibility

  // Borders
  borderLight: "#E5E7EB",
  border: "#E5E7EB",
  borderStrong: "#E5E7EB",

  // Muted backgrounds (for chips/secondary areas on light UI)
  mutedBg: "#FFFFFF",
  mutedBgHover: "#FFFFFF",

  // Gradients / overlays (subtle, low-contrast)
  overlayGradient:
    "linear-gradient(180deg, rgba(31,41,55,0.06) 0%, rgba(31,41,55,0.00) 100%)",

  // Semantic mapped to brand palette (STRICT: use brand hues only)
  successBright: "#FF7B00",
  error: "#FF8D21",
  successTintBg: "rgba(255,123,0,0.10)",
  successTintBorder: "rgba(255,123,0,0.35)",
  errorTintBg: "rgba(255,141,33,0.10)",
  errorTintBorder: "rgba(255,141,33,0.35)",
};

colors.success = colors.successBright;
colors.borderWeak = colors.borderLight;

export default colors;
