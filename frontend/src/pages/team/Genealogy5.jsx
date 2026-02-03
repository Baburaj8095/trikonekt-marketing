import React from "react";
import GenealogyTree5 from "../../components/GenealogyTree5";

export default function Genealogy5() {
  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Genealogy (5‑Matrix)</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          View your 5‑Matrix team. Click a member to drill down; use the breadcrumb to navigate back.
        </div>
      </div>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          background: "#f8fafc",
          padding: 12,
        }}
      >
        <GenealogyTree5 initialPool="FIVE_150" maxDepth={6} showPlaceholders />
      </div>
    </div>
  );
}
