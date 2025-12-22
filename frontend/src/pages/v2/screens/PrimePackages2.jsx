import React from "react";
import V2PageContainer from "../V2PageContainer";
import PromoPackages from "../../PromoPackages";

/**
 * PrimePackages2 (v2 UX)
 * New file that renders the existing PromoPackages screen inside the v2 container.
 */
export default function PrimePackages2() {
  return (
    <V2PageContainer title="Join Prime Packages" flush>
      <PromoPackages />
    </V2PageContainer>
  );
}
