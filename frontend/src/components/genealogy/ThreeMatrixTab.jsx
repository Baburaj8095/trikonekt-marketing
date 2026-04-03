/**
 * ThreeMatrixTab.jsx
 * 3 Matrix Tree tab:
 *  • Account ID selector (self 3-matrix positions)
 *  • KPI boxes: Total Team | Active Levels Open | Levels Completed | Total Earning
 *  • Interactive 3-matrix tree (NO level chart)
 */

import React from "react";
import InteractiveTree from "./InteractiveTree";

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  primary:   "#0891b2",   // teal for 3-matrix
  primaryL:  "#e0f2fe",
  surface:   "#ffffff",
  text:      "#111827",
  textSec:   "#6b7280",
  border:    "#e5e7eb",
  green:     "#16a34a",
  greenL:    "#dcfce7",
  amber:     "#d97706",
  amberL:    "#fef3c7",
  shadow:    "0 2px 12px rgba(8,145,178,0.08)",
};

// ─── KPI card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, accent }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 14,
        padding: "12px 10px",
        textAlign: "center",
        boxShadow: C.shadow,
        border: `1.5px solid ${accent || C.border}`,
        flex: "1 1 0",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: C.textSec,
          fontWeight: 600,
          letterSpacing: "0.03em",
          lineHeight: 1.3,
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: accent || C.primary,
          lineHeight: 1,
        }}
      >
        {value ?? "–"}
      </div>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
      {[
        { color: "#059669", label: "Active" },
        { color: "#9ca3af", label: "Inactive" },
        { color: C.primary, label: "Expanded" },
      ].map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textSec, fontWeight: 600 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function ThreeMatrixTab({
  threeRootsList      = [],
  selectedThreeRoot   = null,
  setSelectedThreeRoot,
  threeLevelGrid      = [],
  threeCounts         = null,
  totalThreeTeam      = 0,
  activeLevelsReached = 0,
  totalThreeEarning   = 0,
  levels              = { three: 15 },
}) {
  const hasPools = threeRootsList.length > 0;

  // Levels completed from API or compute locally
  const levelsCompleted = threeCounts?.levels_completed ??
    threeLevelGrid.filter((row) => {
      const count = Number(row.count || 0);
      const maxCount = Number(row.max_count || Math.pow(3, row.level));
      return count > 0 && count >= maxCount;
    }).length;

  // Earning: prefer the value from the counts API (refreshes per account selection)
  const earning = Number(threeCounts?.total_earned || totalThreeEarning || 0);

  // Build display name for each account position
  const getPositionLabel = (r, i) => {
    const base = (r.username_key || "").replace(/-\d+$/, "");
    const idx = r.user_entry_index || (i + 1);
    return idx === 1 ? base : `${base}-${idx}`;
  };

  return (
    <div>
      {/* ── Account selector ── */}
      {hasPools && (
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: C.textSec,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            Your 3‑Matrix Accounts
          </label>
          <select
            value={selectedThreeRoot ?? ""}
            onChange={(e) =>
              setSelectedThreeRoot(e.target.value ? Number(e.target.value) : null)
            }
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: `1.5px solid ${C.border}`,
              background: C.surface,
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              outline: "none",
              appearance: "none",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%230891b2' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 14px center",
              paddingRight: 36,
              cursor: "pointer",
            }}
          >
            {threeRootsList.map((r, i) => (
              <option key={r.id} value={r.id}>
                {getPositionLabel(r, i)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── KPI grid ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <KpiCard label="Total Team" value={totalThreeTeam} accent={C.primary} />
        <KpiCard label="Active Levels Open" value={activeLevelsReached} accent={C.green} />
        <KpiCard label="Levels Completed" value={levelsCompleted > 0 ? `L${levelsCompleted}` : "–"} accent={C.amber} />
        <KpiCard label="3 Matrix Earning" value={`\u20b9${earning.toFixed(0)}`} accent="#7c3aed" />
      </div>

      {/* ── Tree section ── */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.2px",
          marginBottom: 8,
        }}
      >
        3‑Matrix Tree
      </div>
      <div
        style={{
          background: C.primaryL,
          color: C.primary,
          padding: "8px 12px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        💡 <strong>Tap</strong> a member to view their subtree · tap root to expand/collapse
      </div>

      {hasPools ? (
        <InteractiveTree
          key={`THREE_150-${String(selectedThreeRoot)}`}
          entryRootId={selectedThreeRoot}
          useEntriesTree={!!selectedThreeRoot}
          pool="THREE_150"
          maxDepth={Number(levels?.three ?? 15)}
          onNodeSelect={(nodeId) =>
            setSelectedThreeRoot(nodeId ? Number(nodeId) : null)
          }
        />
      ) : (
        <div
          style={{
            padding: "24px 0",
            textAlign: "center",
            color: C.textSec,
            fontSize: 13,
          }}
        >
          No 3‑Matrix positions found.
        </div>
      )}

      <Legend />
    </div>
  );
}
