import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminPromoPurchases from "./AdminPromoPurchases";

export default function AdminJoinPrimeLedger() {
  const loc = useLocation();
  const nav = useNavigate();

  React.useEffect(() => {
    try {
      const qs = new URLSearchParams(loc.search || "");
      if (!qs.get("status")) qs.set("status", "APPROVED");
      qs.set("kind", "750");
      qs.delete("tri_app_slug");
      const next = `${loc.pathname}?${qs.toString()}`;
      const cur = `${loc.pathname}${loc.search || ""}`;
      if (next !== cur) nav(next, { replace: true });
    } catch (_) {}
  }, [loc.pathname, loc.search, nav]);

  return (
    <AdminPromoPurchases
      title="Ledger: Join Prime"
      description="List of users who purchased Join Prime, with amount, payment proof, wallet source, sponsor, and approval status."
      defaultStatus="APPROVED"
      readOnly
    />
  );
}
