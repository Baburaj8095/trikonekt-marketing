/**
 * Trikonekt Motion System
 * ======================
 * Design principles:
 * - Subtle (never flashy)
 * - Calm (investor-safe)
 * - Consistent (same feel across all pages)
 * - Mobile-first
 *
 * Use ONLY these animations.
 * Do NOT invent new ones unless absolutely required.
 */

/* ---------- BASIC FADE ---------- */
export const fade = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

/* ---------- FADE UP (MOST USED) ---------- */
export const fadeUp = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

/* ---------- FADE DOWN ---------- */
export const fadeDown = {
  hidden: {
    opacity: 0,
    y: -20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

/* ---------- SCALE IN ---------- */
export const scaleIn = {
  hidden: {
    opacity: 0,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: "easeOut",
    },
  },
};

/* ---------- SLIDE LEFT ---------- */
export const slideLeft = {
  hidden: {
    opacity: 0,
    x: 40,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.55,
      ease: "easeOut",
    },
  },
};

/* ---------- SLIDE RIGHT ---------- */
export const slideRight = {
  hidden: {
    opacity: 0,
    x: -40,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.55,
      ease: "easeOut",
    },
  },
};

/* ---------- STAGGER CONTAINER (LISTS / GRIDS) ---------- */
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

/* ---------- CARD HOVER (MICRO INTERACTION) ---------- */
export const hoverLift = {
  whileHover: {
    y: -6,
    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
    transition: {
      duration: 0.25,
      ease: "easeOut",
    },
  },
};

/* ---------- BUTTON TAP (MOBILE FEEL) ---------- */
export const tapScale = {
  whileTap: {
    scale: 0.96,
  },
};

/* ---------- VIEWPORT SETTINGS ---------- */
export const viewportOnce = {
  once: true,
  margin: "-80px",
};

/**
 * RULES (DO NOT IGNORE)
 * --------------------
 * ✔ Animate sections, cards, CTAs
 * ✖ Do NOT animate header, footer, background
 * ✖ Do NOT use bounce / spring
 * ✖ Do NOT animate everything
 *
 * This is a business platform, not a gaming app.
 */
