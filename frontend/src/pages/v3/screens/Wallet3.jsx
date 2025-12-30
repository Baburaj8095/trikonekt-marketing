import React from "react";
import Wallet from "../../Wallet";

/**
 * Wallet3
 * Mirrors v2 Dashboard2Wallet — reuse the same Wallet content,
 * only the surrounding UX comes from the v3 shell/theme.
 */
export default function Wallet3() {
  return (
    <div style={{ background: "transparent" }}>
      <Wallet />
    </div>
  );
}
