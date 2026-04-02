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
                  {r.username_key || `Position #${r.id}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Interactive react-flow tree ── */}
      <InteractiveTree
        key={String(selectedRoot)}          /* remount when root changes */
        entryRootId={selectedRoot}
        useEntriesTree={!!selectedRoot}
        pool="FIVE_150"
        maxDepth={Number(levels?.five ?? 10)}
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