import React from "react";
import V2PageContainer from "../V2PageContainer";
import ConsumerKYC from "../../ConsumerKYC";

/**
 * KYC2 (v2 UX)
 * New file that renders the existing ConsumerKYC screen inside the v2 container.
 */
export default function KYC2() {
  return (
    <V2PageContainer title="KYC" flush>
      <ConsumerKYC />
    </V2PageContainer>
  );
}
