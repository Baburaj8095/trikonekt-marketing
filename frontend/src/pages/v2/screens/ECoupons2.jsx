import React from "react";
import V2PageContainer from "../V2PageContainer";
import ConsumerCoupon from "../../ConsumerCoupon";

/**
 * ECoupons2 (v2 UX)
 * New file that renders the existing ConsumerCoupon screen inside the v2 container.
 */
export default function ECoupons2() {
  return (
    <V2PageContainer title="My E‑Coupons" flush>
      <ConsumerCoupon />
    </V2PageContainer>
  );
}
