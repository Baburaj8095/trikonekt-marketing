import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminPromoPurchases from "./AdminPromoPurchases";

/**
 * Dedicated Admin screen: SPP (Monthly boxes)
 */
export default function AdminSPPPurchases() {
  const loc = useLocation();
  const nav = useNavigate();

  React.useEffect(() => {
    try {
      const qs = new URLSearchParams(loc.search || "");
      if (!qs.get("status")) qs.set("status", "PENDING");
      qs.set("kind", "monthly");
      qs.delete("tri_app_slug");
      const next = `${loc.pathname}?${qs.toString()}`;
      const cur = `${loc.pathname}${loc.search || ""}`;
      if (next !== cur) nav(next, { replace: true });
    } catch (_) {}
  }, [loc.pathname, loc.search, nav]);

  return (
    <div>
      <div style={{ marginBottom: 10, fontWeight: 900, color: "#0f172a" }}>
        Approvals: Smart Product Purchase (Monthly 1000/750)
      </div>
      <AdminPromoPurchases />
    </div>
  );
}
