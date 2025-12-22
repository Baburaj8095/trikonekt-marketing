import React from "react";
import V2PageContainer from "../V2PageContainer";
import ReferAndEarn from "../../ReferAndEarn";

/**
 * ReferEarn2 (v2 UX)
 * New file that renders the existing ReferAndEarn screen inside the v2 container.
 */
export default function ReferEarn2() {
  return (
    <V2PageContainer title="Refer & Earn" flush>
      <ReferAndEarn />
    </V2PageContainer>
  );
}
