import React from "react";

/**
 * Golden icon set for TRI Products.
 * - Minimal, clean, premium
 * - currentColor used so parent can set color = var(--bms-gold-2)
 * - Default size 48 for good presence inside square cards
 */

const Svg = ({ children, size = 48, stroke = 1.6, viewBox = "0 0 24 24", ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    {children}
  </svg>
);

// E-commerce — laptop/cart
export const ECommerceIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8" />
    <path d="M6 16v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" />
    <path d="M9 8h8l-1 3H10L9 8Z" />
    <circle cx="11.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
  </Svg>
);

// Genealogy — hierarchy/tree
export const GenealogyIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="3" width="6" height="4" rx="1.2" />
    <rect x="15" y="3" width="6" height="4" rx="1.2" />
    <rect x="9" y="17" width="6" height="4" rx="1.2" />
    <path d="M6 7v4c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7" />
    <path d="M12 13v4" />
  </Svg>
);

// EV — electric vehicle
export const EVIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="10" width="18" height="7" rx="2" />
    <path d="M7 10V8a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2" />
    <circle cx="7.5" cy="17" r="1.5" />
    <circle cx="16.5" cy="17" r="1.5" />
    <path d="M18.5 6l2-3v4l2-3" />
  </Svg>
);

// Gift Card — card with bow
export const GiftCardIcon = (props) => (
  <Svg {...props}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 11h18" />
    <path d="M10 6c-1.5 0-3 1.2-3 2.8 0 1.2 1 1.7 2 1.2 1-.5 1-2 1-4Z" />
    <path d="M14 6c1.5 0 3 1.2 3 2.8 0 1.2-1 1.7-2 1.2-1-.5-1-2-1-4Z" />
  </Svg>
);

// Bill & Recharge — phone/payment
export const BillRechargeIcon = (props) => (
  <Svg {...props}>
    <rect x="7" y="2.5" width="10" height="19" rx="2" />
    <path d="M10 6h4" />
    <path d="M10 18h4" />
    <path d="M5 9h14" />
  </Svg>
);

// Wealth Galaxy — abstract orbit/galaxy
export const WealthGalaxyIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    <ellipse cx="12" cy="12" rx="8" ry="3.5" />
    <ellipse cx="12" cy="12" rx="3.5" ry="8" transform="rotate(45 12 12)" />
    <ellipse cx="12" cy="12" rx="3.5" ry="8" transform="rotate(-45 12 12)" />
  </Svg>
);

// Prime — crown
export const PrimeIcon = (props) => (
  <Svg {...props}>
    <path d="M4 16l2-7 4 4 4-4 2 7H4Z" />
    <path d="M4 16h16" />
  </Svg>
);

// Spin & Win — wheel
export const SpinWinIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v16M4 12h16M6.34 6.34l11.32 11.32M17.66 6.34L6.34 17.66" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

// Local Store — storefront
export const LocalStoreIcon = (props) => (
  <Svg {...props}>
    <path d="M4 9h16l-2-4H6l-2 4Z" />
    <rect x="4" y="9" width="16" height="10" rx="2" />
    <path d="M9 14h6v5" />
    <path d="M9 19v-5" />
  </Svg>
);

export default {
  ECommerceIcon,
  GenealogyIcon,
  EVIcon,
  GiftCardIcon,
  BillRechargeIcon,
  WealthGalaxyIcon,
  PrimeIcon,
  SpinWinIcon,
  LocalStoreIcon,
};
