import React from "react";
import PromoPackages from "../PromoPackages";

/**
 * JoinSubscription
 * - Prime 750 only screen
 * - Reuses PromoPackages and forces the Prime tab.
 */
export default function JoinSubscription() {
  return <PromoPackages title="Join Subscription" initialTabKey="prime750" historyScope="prime750" />;
}
