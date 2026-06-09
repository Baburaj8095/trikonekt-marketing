import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminPromoPurchases from "./AdminPromoPurchases";

export default function AdminTriTourLedger() {
  const loc = useLocation();
  const nav = useNavigate();

  React.useEffect(() => {
    try {
      const qs = new URLSearchParams(loc.search || "");
      if (!qs.get("status")) qs.set("status", "APPROVED");
      qs.set("tri_app_slug", "tri-holidays");
      qs.delete("kind");
      const next = `${loc.pathname}?${qs.toString()}`;
      const cur = `${loc.pathname}${loc.search || ""}`;
      if (next !== cur) nav(next, { replace: true });
    } catch (_) {}
  }, [loc.pathname, loc.search, nav]);

  return (
    <AdminPromoPurchases
      title="Ledger: Tri Tour"
      description="List of users who purchased Tri Tour trips, including selected trip, amount, payment proof, sponsor, and status."
      defaultStatus="APPROVED"
      readOnly
    />
  );
}
