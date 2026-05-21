import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminPromoPurchases from "./AdminPromoPurchases";

/**
 * Dedicated Admin screen: Tri Tour (TRI Holidays)
 */
export default function AdminTriTourPurchases() {
  const loc = useLocation();
  const nav = useNavigate();

  React.useEffect(() => {
    try {
      const qs = new URLSearchParams(loc.search || "");
      if (!qs.get("status")) qs.set("status", "PENDING");
      qs.set("tri_app_slug", "tri-holidays");
      qs.delete("kind");
      const next = `${loc.pathname}?${qs.toString()}`;
      const cur = `${loc.pathname}${loc.search || ""}`;
      if (next !== cur) nav(next, { replace: true });
    } catch (_) {}
  }, [loc.pathname, loc.search, nav]);

  return (
    <div>
      <div style={{ marginBottom: 10, fontWeight: 900, color: "#0f172a" }}>
        Approvals: Tri Tour (TRI Holidays)
      </div>
      <AdminPromoPurchases />
    </div>
  );
}
