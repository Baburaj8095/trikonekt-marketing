import React from "react";
import V2PageContainer from "../V2PageContainer";
import Cart from "../../Cart";

/**
 * Cart2 (v2 UX)
 * New file that renders the existing Cart screen inside the v2 container.
 */
export default function Cart2() {
  return (
    <V2PageContainer title="Cart" flush>
      <Cart />
    </V2PageContainer>
  );
}
