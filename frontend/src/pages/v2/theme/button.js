import colors from "./colors";
import radius from "./radius";
import spacing from "./spacing";
import typography from "./typography";

/**
 * v2 Theme - Button tokens
 */
const button = {
  height: 44,
  radius: radius.button,
  paddingX: 16,
  fontSize: typography.body.size,
  fontWeight: 600,
  disabledOpacity: 0.4,

  variants: {
    primary: {
      bg: colors.primary,
      bgHover: colors.primaryHover,
      color: colors.textOnDark,
      border: "none",
    },
    secondary: {
      bg: colors.white,
      bgHover: colors.white,
      color: colors.primary,
      border: `1px solid ${colors.primary}`,
    },
  },

  spacing,
  colors,
};

export default button;
