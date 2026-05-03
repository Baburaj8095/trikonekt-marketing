import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminPromoPurchases from "./AdminPromoPurchases";

/**
 * Thin route wrapper around AdminPromoPurchases.
 * We pass filters through querystring via the route.
 */
export default function AdminPackagePromoPurchases() {
  const loc = useLocation();
  const nav = useNavigate();

  // On mount, set query params based on the current admin package route.
  // This keeps a single reusable AdminPromoPurchases screen.
  React.useEffect(() => {
    try {
      const p = String(loc.pathname || "");
      const qs = new URLSearchParams(loc.search || "");

      // Always default to Pending for package screens (admin can change afterwards)
      if (!qs.get("status")) qs.set("status", "PENDING");

      if (p.endsWith("/join-subscription")) {
        qs.set("kind", "750");
        qs.delete("tri_app_slug");
      } else if (p.endsWith("/spp")) {
        // SPP is Monthly purchases
        qs.set("kind", "monthly");
        qs.delete("tri_app_slug");
      } else if (p.endsWith("/tri-tour")) {
        qs.delete("kind");
        qs.set("tri_app_slug", "tri-holidays");
      }

      const next = `${p}?${qs.toString()}`;
      const cur = `${p}${loc.search || ""}`;
      if (next !== cur) nav(next, { replace: true });
    } catch (_) {}
  }, [loc.pathname, loc.search, nav]);

  return <AdminPromoPurchases />;
}
