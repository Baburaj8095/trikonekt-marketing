import React from "react";
import V2PageContainer from "../V2PageContainer";
import TrikonektProducts from "../../TrikonektProducts";

/**
 * TrikonektProducts2 (v2 UX)
 * New file that renders the existing TrikonektProducts screen inside the v2 container.
 */
export default function TrikonektProducts2() {
  return (
    <V2PageContainer title="Trikonekt Products" flush>
      <TrikonektProducts />
    </V2PageContainer>
  );
}
