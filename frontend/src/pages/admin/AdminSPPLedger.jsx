import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminPromoPurchases from "./AdminPromoPurchases";

export default function AdminSPPLedger() {
  const loc = useLocation();
  const nav = useNavigate();

  React.useEffect(() => {
    try {
      const qs = new URLSearchParams(loc.search || "");
      if (!qs.get("status")) qs.set("status", "APPROVED");
      qs.set("kind", "monthly");
      qs.delete("tri_app_slug");
      const next = `${loc.pathname}?${qs.toString()}`;
      const cur = `${loc.pathname}${loc.search || ""}`;
      if (next !== cur) nav(next, { replace: true });
    } catch (_) {}
  }, [loc.pathname, loc.search, nav]);

  return (
    <AdminPromoPurchases
      title="Ledger: Smart Product Purchase (SPP)"
      description="List of users who purchased SPP seasons/monthly boxes, including SPP number, selected boxes/months, amount, and status."
      defaultStatus="APPROVED"
      readOnly
    />
  );
}
