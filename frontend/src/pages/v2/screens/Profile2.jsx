import React from "react";
import V2PageContainer from "../V2PageContainer";
import Profile from "../../Profile";

/**
 * Profile2 (v2 UX)
 * New file that renders the existing Profile page inside the v2 container so it
 * visually matches Dashboard2. No changes to the original Profile.jsx.
 */
export default function Profile2() {
  return (
    <V2PageContainer title="Account Info" flush>
      <Profile />
    </V2PageContainer>
  );
}
