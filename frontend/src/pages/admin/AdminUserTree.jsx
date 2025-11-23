import React from "react";
import TreeReferralGalaxy from "../../components/TreeReferralGalaxy";

// Replace the old "User Tree" (registered_by chain) with the Referral/Matrix genealogy viewer.
export default function AdminUserTree() {
  return (
    <div>
      <TreeReferralGalaxy mode="admin" preferredSource="sponsor" />
    </div>
  );
}
