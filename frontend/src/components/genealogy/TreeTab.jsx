import React from "react";
import InteractiveTree from "./InteractiveTree";

const C = {
  primary:  "#4f46e5",
  surface:  "#ffffff",
  text:     "#111827",
  textSec:  "#6b7280",
  border:   "#e5e7eb",
};

export default function TreeTab({
  selectedRoot,
  fiveRootsList,
  setSelectedRoot,
  levels,
}) {
  const hasPools =
    Array.isArray(fiveRootsList) && fiveRootsList.length > 0;

  // Build unique display labels: use base username + entry index to avoid duplicates
  const pillLabels = React.useMemo(() => {
    if (!hasPools) return {};
    const labels = {};
    const base = (fiveRootsList[0]?.username_key || "").replace(/-\d+$/, "");
    fiveRootsList.forEach((r, i) => {
      const idx = r.user_entry_index || (i + 1);
      labels[r.id] = idx === 1 ? base : `${base}-${idx}`;
    });
    return labels;
  }, [fiveRootsList, hasPools]);

  return (
    <div>
      {/* ── Position selector pills ── */}
      {hasPools && (
        <div style={{ marginBottom: 14 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.textSec,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 8px 0",
            }}
          >
            Your 5‑Matrix Positions
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 4,
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {fiveRootsList.map((r) => {
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
                    boxShadow: isSel
                      ? "0 4px 12px rgba(79,70,229,0.30)"
                      : "none",
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
      )}

      {/* ── Interactive react-flow tree ── */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            background: "#ede9fe",
            color: C.primary,
            padding: "8px 12px",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          💡 <strong>Tap</strong> a member to view their tree
        </div>
        {selectedRoot && (
          <button
            onClick={() => setSelectedRoot(null)}
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
            onMouseEnter={(e) => {
              e.target.style.background = C.primary;
              e.target.style.color = C.surface;
            }}
            onMouseLeave={(e) => {
              e.target.style.background = C.surface;
              e.target.style.color = C.primary;
            }}
          >
            ← Back to Your Root
          </button>
        )}
      </div>

      <InteractiveTree
        key={String(selectedRoot)}          /* remount when root changes */
        entryRootId={selectedRoot}
        useEntriesTree={!!selectedRoot}
        pool="FIVE_150"
        maxDepth={Number(levels?.five ?? 10)}
        onNodeSelect={(nodeId) => {
          /* When user double-clicks a child node, switch to it as the new root */
          setSelectedRoot(nodeId ? Number(nodeId) : null);
        }}
      />

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        {[
          { color: "#059669", label: "Active" },
          { color: "#9ca3af", label: "Inactive" },
          { color: C.primary, label: "Expanded" },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: C.textSec,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {label}
          </div>
        ))}
      </div>

      {!hasPools && (
        <p
          style={{
            fontSize: 12,
            color: C.textSec,
            textAlign: "center",
            marginTop: 12,
          }}
        >
          No active 5-Matrix positions found.
        </p>
      )}
    </div>
  );
}