import React from "react";
import V2PageContainer from "../V2PageContainer";
import MyTeam from "../../team/MyTeam";

/**
 * MyTeam2 (v2 UX)
 * New file that renders the existing MyTeam screen inside the v2 container.
 * Keeps data/logic intact while adopting Dashboard2 styling.
 */
export default function MyTeam2() {
  return (
    <V2PageContainer title="Genealogy (My Team)" flush>
      <MyTeam />
    </V2PageContainer>
  );
}
