import React from "react";
import V2PageContainer from "../V2PageContainer";
import Wallet from "../../Wallet";

/**
 * Wallet2 (v2 UX)
 * Wraps the existing Wallet screen with the V2 container/theme.
 */
export default function Wallet2() {
  return (
    <V2PageContainer title="Wallet" flush>
      <Wallet />
    </V2PageContainer>
  );
}
