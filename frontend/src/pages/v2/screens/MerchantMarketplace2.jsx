import React from "react";
import V2PageContainer from "../V2PageContainer";
import Marketplace from "../../market/Marketplace";

/**
 * MerchantMarketplace2 (v2 UX)
 * New file that renders the existing Marketplace screen inside the v2 container.
 * This matches the Dashboard2 dark layout while keeping existing logic intact.
 */
export default function MerchantMarketplace2() {
  return (
    <V2PageContainer title="Merchant Marketplace" flush>
      <Marketplace />
    </V2PageContainer>
  );
}
