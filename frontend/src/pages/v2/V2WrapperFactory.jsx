import React from "react";
import { Box } from "@mui/material";
import colors from "./theme/colors";

import {
  Profile2,
  KYC2,
  MyTeam2,
  ReferEarn2,
  PrimePackages2,
  ECoupons2,
  MyOrders2,
  TrikonektProducts2,
  MerchantMarketplace2,
  Support2,
  Cart2,
  Wallet2,
  History2,
} from "./screens";

/**
 * V2WrapperFactory
 * Renders existing pages inside a minimal wrapper so the content
 * appears within the new v2 dark layout. We do not edit original pages.
 *
 * name (screen key) -> component mapping
 */
const registry = {
  profile2: Profile2,
  kyc2: KYC2,
  "my-team2": MyTeam2,
  "refer-earn2": ReferEarn2,
  "promo-packages2": PrimePackages2,
  "my-e-coupons2": ECoupons2,
  "my-orders2": MyOrders2,
  "trikonekt-products2": TrikonektProducts2,
  "merchant-marketplace2": MerchantMarketplace2,
  support2: Support2,
  cart2: Cart2,
  wallet2: Wallet2,
  history2: History2,
};

export default function V2WrapperFactory({ name }) {
  const Cmp = registry[name];
  if (!Cmp) {
    return (
      <Box sx={{ color: colors.textPrimary }}>
        Unknown screen: {String(name || "")}
      </Box>
    );
  }
  // Minimal wrapper to inherit the v2 background and spacing
  return (
    <Box sx={{ bgcolor: "transparent" }}>
      <Cmp />
    </Box>
  );
}
