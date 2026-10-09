import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ShellBase from "./ShellBase";

/**
 * AgencyShell
 * Updated to use the unified ShellBase layout (same template family as Admin/Consumer/Employee)
 * - Dark, professional sidebar
 * - Responsive mobile top bar and drawer
 * - Consistent header/sidebar styling across roles
 */
export default function AgencyShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user_agency") || sessionStorage.getItem("user_agency");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Agency";

  // Compute small badge text to show agency category on the top-right (beside notifications)
  const agencyCategory = storedUser?.category || "";
  const pincode = storedUser?.pincode || "";
  const categoryLabel = useMemo(() => {
    const map = {
      agency_sub_franchise: "Sub Franchise",
      agency_pincode: "Pincode",
      agency_pincode_coordinator: "Pincode Coordinator",
      agency_district: "District",
      agency_district_coordinator: "District Coordinator",
      agency_state: "State",
      agency_state_coordinator: "State Coordinator",
      company: "Company",
      business: "Business",
      employee: "Employee",
      consumer: "Consumer",
    };
    const raw = map[agencyCategory] || (agencyCategory ? agencyCategory.replaceAll("_", " ") : "Agency");
    // Title-case
    return raw.replace(/\b\w/g, (m) => m.toUpperCase());
  }, [agencyCategory]);
  const rightPill = useMemo(() => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        color: "#0f172a",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap"
      }}
      title={agencyCategory}
    >
      {categoryLabel}{pincode ? ` • ${pincode}` : ""}
    </span>
  ), [categoryLabel, pincode, agencyCategory]);

  const onLogout = () => {
    try {
      localStorage.removeItem("token_agency");
      localStorage.removeItem("refresh_agency");
      localStorage.removeItem("role_agency");
      localStorage.removeItem("user_agency");
      sessionStorage.removeItem("token_agency");
      sessionStorage.removeItem("refresh_agency");
      sessionStorage.removeItem("role_agency");
      sessionStorage.removeItem("user_agency");
    } catch (_) {}
    navigate("/", { replace: true });
  };

  // Streamlined modern Franchise Portal Menu
  const menu = [
    { to: "/agency/franchise-dashboard", label: "Franchise Dashboard", icon: "dashboard" },
    { to: "/agency/refer-earn", label: "Refer & Earn", icon: "users" },
    { to: "/agency/education-pdfs", label: "Educating PDF Asiyapp", icon: "file" },
    { to: "/agency/franchise-agreement", label: "Franchise Agreement Copy", icon: "file" },
    { to: "/agency/profile", label: "Franchise Profile", icon: "users" },
    { to: "/agency/support", label: "Support & Helpdesk", icon: "ticket" },
  ];

  // Active link matcher
  const isActive = (to, loc) => {
    const [toPath] = to.split("?");
    return loc.pathname === toPath || loc.pathname === to;
  };

  return (
    <ShellBase
      title={displayName}
      menu={menu}
      isActive={isActive}
      onLogout={onLogout}
      footerText={`Logged in as: ${displayName}`}
      rightHeaderContent={rightPill}
      rootPaths={["/agency/franchise-dashboard", "/agency/coupons"]}
      onBackFallbackPath="/agency/franchise-dashboard"
      showBottomNav={false}
      showMobileHeader={false}
    >
      {children}
    </ShellBase>
  );
}


