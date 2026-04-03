import React, { useState } from "react";
import InteractiveTree from "./InteractiveTree";

const C = {
  primary:  "#4f46e5",
  surface:  "#ffffff",
  text:     "#111827",
  textSec:  "#6b7280",
  border:   "#e5e7eb",
};

// ── Pill row for position selection ──────────────────────────────────────────
function PositionPills({ rootsList, selectedRoot, setSelectedRoot, label }) {
  const hasPools = Array.isArray(rootsList) && rootsList.length > 0;

  const pillLabels = React.useMemo(() => {
    if (!hasPools) return {};
    const labels = {};
    const base = (rootsList[0]?.username_key || "").replace(/-\d+$/, "");
    rootsList.forEach((r, i) => {
      const idx = r.user_entry_index || (i + 1);
      labels[r.id] = idx === 1 ? base : `${base}-${idx}`;
    });
    return labels;
  }, [rootsList, hasPools]);

  if (!hasPools) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 0" }}>
        {label}
      </p>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {rootsList.map((r) => {
          const isSel = selectedRoot === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRoot(r.id || null)}
              style={{
                flexShrink: 0,
                padding: "8px 16px",
                borderRadius: 99,
                border: isSel ? "none" : `1.5px solid ${C.border}`,
                background: isSel ? C.primary : C.surface,
                color: isSel ? "#ffffff" : "#374151",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.18s ease",
                boxShadow: isSel ? "0 4px 12px rgba(79,70,229,0.30)" : "none",
                WebkitTapHighlightColor: "transparent",
                outline: "none",
              }}
            >
              {pillLabels[r.id] || r.username_key || `Position #${r.id}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
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

// ── Main TreeTab ──────────────────────────────────────────────────────────────
export default function TreeTab({
  // 5-matrix
  selectedRoot,
  fiveRootsList,
  setSelectedRoot,
  // 3-matrix
  threeRootsList,
  selectedThreeRoot,
  setSelectedThreeRoot,
  // config
  levels,
}) {
  // "5" | "3"
  const [matrixType, setMatrixType] = useState("5");

  const is5 = matrixType === "5";
  const pool = is5 ? "FIVE_150" : "THREE_150";

  const currentRoot      = is5 ? selectedRoot      : selectedThreeRoot;
  const setCurrentRoot   = is5 ? setSelectedRoot    : setSelectedThreeRoot;
  const currentRootsList = is5 ? fiveRootsList      : threeRootsList;

  const hasPools = Array.isArray(currentRootsList) && currentRootsList.length > 0;

  return (
    <div>
      {/* ── Matrix type toggle ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
        {[
          { id: "5", label: "5 Matrix" },
          { id: "3", label: "3 Matrix" },
        ].map(({ id, label }) => {
          const active = matrixType === id;
          return (
            <button
              key={id}
              onClick={() => setMatrixType(id)}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 9,
                border: "none",
                background: active ? C.primary : "transparent",
                color: active ? "#fff" : C.textSec,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.18s ease",
                boxShadow: active ? "0 2px 8px rgba(79,70,229,0.28)" : "none",
                WebkitTapHighlightColor: "transparent",
                outline: "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Position pills ── */}
      <PositionPills
        rootsList={currentRootsList}
        selectedRoot={currentRoot}
        setSelectedRoot={setCurrentRoot}
        label={is5 ? "Your 5‑Matrix Positions" : "Your 3‑Matrix Positions"}
      />

      {/* ── Hint + Back button ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ background: "#ede9fe", color: C.primary, padding: "8px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
          💡 <strong>Tap</strong> a member to view their tree
        </div>
        {currentRoot && (
          <button
            onClick={() => setCurrentRoot(null)}
            style={{
              background: C.surface,
              color: C.primary,
              border: `1.5px solid ${C.border}`,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.target.style.background = C.primary; e.target.style.color = C.surface; }}
            onMouseLeave={(e) => { e.target.style.background = C.surface; e.target.style.color = C.primary; }}
          >
            ← Back to Your Root
          </button>
        )}
      </div>

      {/* ── Tree ── */}
      {hasPools ? (
        <InteractiveTree
          key={`${pool}-${String(currentRoot)}`}   /* remount when pool or root changes */
          entryRootId={currentRoot}
          useEntriesTree={!!currentRoot}
          pool={pool}
          maxDepth={Number(is5 ? (levels?.five ?? 10) : (levels?.three ?? 15))}
          onNodeSelect={(nodeId) => {
            setCurrentRoot(nodeId ? Number(nodeId) : null);
          }}
        />
      ) : (
        <p style={{ fontSize: 12, color: C.textSec, textAlign: "center", marginTop: 24 }}>
          No active {is5 ? "5" : "3"}-Matrix positions found.
        </p>
      )}

      <Legend />
    </div>
  );
}