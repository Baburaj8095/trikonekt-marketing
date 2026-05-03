import React from "react";
import PromoPackages from "../PromoPackages";

/**
 * SPP (Smart Product Purchase)
 * - Monthly/Season 1000 screen
 * - Reuses PromoPackages and forces the Season tab but renames UI labels Season -> SPP.
 */
export default function SPP() {
  return (
    <PromoPackages
      title="Smart Product Purchase (SPP)"
      initialTabKey="season"
      historyScope="monthly"
      rename={{ seasonLabel: "SPP", seasonBuyCta: "BUY SPP", seasonPlanLabel: "SPP Prime ₹1000" }}
    />
  );
}
