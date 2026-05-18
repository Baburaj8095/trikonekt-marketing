import React from "react";
import { useLocation } from "react-router-dom";
import AdminTeamConsumerDocuments from "./AdminTeamConsumerDocuments";

export default function AdminTeamConsumerPdfUploads() {
  const location = useLocation();
  const params = new URLSearchParams(location.search || "");
  const view = String(params.get("view") || "").toLowerCase();
  const kind = view === "business" ? "BUSINESS_PDF" : "PDF";
  return <AdminTeamConsumerDocuments kind={kind} />;
}
