import React from "react";
import MyOrdersAll from "../../MyOrdersAll";

/**
 * MyOrders3
 * Mirrors v2 MyOrders2 (which renders MyOrdersAll). We reuse the same content,
 * only the surrounding UX comes from the v3 shell/theme.
 */
export default function MyOrders3() {
  return (
    <div style={{ background: "transparent" }}>
      <MyOrdersAll />
    </div>
  );
}
