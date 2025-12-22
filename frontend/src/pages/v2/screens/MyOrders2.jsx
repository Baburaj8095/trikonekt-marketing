import React from "react";
import V2PageContainer from "../V2PageContainer";
import MyOrdersAll from "../../MyOrdersAll";

/**
 * MyOrders2 (v2 UX)
 * New file that renders the existing MyOrdersAll screen inside the v2 container.
 */
export default function MyOrders2() {
  return (
    <V2PageContainer title="My Orders" flush>
      <MyOrdersAll />
    </V2PageContainer>
  );
}
