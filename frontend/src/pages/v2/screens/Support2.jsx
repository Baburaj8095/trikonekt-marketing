import React from "react";
import V2PageContainer from "../V2PageContainer";
import Support from "../../Support";

/**
 * Support2 (v2 UX)
 * New file that renders the existing Support page inside the v2 container.
 */
export default function Support2() {
  return (
    <V2PageContainer title="Support" flush>
      <Support />
    </V2PageContainer>
  );
}
