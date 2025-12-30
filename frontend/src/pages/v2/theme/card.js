import colors from "./colors";
import radius from "./radius";
import spacing from "./spacing";
import shadows from "./shadows";

/**
 * v2 Theme - Card tokens
 */
const card = {
  radius: radius.card,
  padding: spacing.cardPadding,
  bg: colors.surface,
  border: `1px solid ${colors.border}`,
  shadow: shadows.card,
  hover: {
    bg: colors.mutedBgHover,
    border: `1px solid ${colors.borderStrong}`,
    shadow: shadows.card,
  },
  colors,
  spacing,
  shadows,
  radius,
};

export default card;
