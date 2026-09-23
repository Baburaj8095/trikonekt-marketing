import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AppShell from "../common/AppShell";

export default function ConsumerShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const loginContext = useMemo(() => {
    try {
      return String(localStorage.getItem("login_context_user") || sessionStorage.getItem("login_context_user") || "").toLowerCase();
    } catch {
      return "";
    }
  }, []);
  const isTeamLogin = loginContext === "team";

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_user") || sessionStorage.getItem("user_user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);

  const onLogout = () => {
    try {
      localStorage.removeItem("token_user");
      localStorage.removeItem("refresh_user");
      localStorage.removeItem("role_user");
      localStorage.removeItem("user_user");
      sessionStorage.removeItem("token_user");
      sessionStorage.removeItem("refresh_user");
      sessionStorage.removeItem("role_user");
      sessionStorage.removeItem("user_user");
    } catch (_) {}
    navigate("/", { replace: true });
  };

  const title = useMemo(() => {
    const path = location.pathname;
    if (path.includes("/team-dashboard") || path.includes("/user/dashboard")) return "Team Consumer";
    if (path.includes("/wallet") || path.includes("/withdrawal")) return "Wallet";
    if (path.includes("/spp")) return "Smart Product Purchase";
    if (path.includes("/coupon-pocket")) return "Coupon Pocket";
    if (path.includes("/upload-wallet")) return "Add Money";
    if (path.includes("/digital-education")) return "Digital Education";
    if (path.includes("/educational-videos")) return "Educational Videos";
    if (path.includes("/genealogy")) return "Layer Blocks Tree";
    if (path.includes("/profile")) return "Profile";
    if (path.includes("/kyc")) return "KYC Verification";
    if (path.includes("/history")) return "Transaction History";
    return isTeamLogin ? "Team Consumer" : "Consumer";
  }, [location.pathname, isTeamLogin]);

  return (
    <AppShell
      title={title}
      user={storedUser}
      onLogout={onLogout}
      isTeam={isTeamLogin}
      rootPaths={["/user/team-dashboard", "/user/dashboard", "/v4/home"]}
      onBackFallbackPath={isTeamLogin ? "/user/team-dashboard" : "/user/dashboard"}
    >
      {children}
    </AppShell>
  );
}
