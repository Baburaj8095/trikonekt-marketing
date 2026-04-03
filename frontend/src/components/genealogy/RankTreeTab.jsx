/**
 * RankTreeTab.jsx
 * Rank-1 matrix tree using the same InteractiveTree SVG UI as the FIVE_150 tree.
 * - Uses /rank-matrix/tree-bfs/ via InteractiveTree's useRankMatrix mode
 * - Single-click a member to drill into their subtree
 * - "← Back to Root" to return
 */
import React, { useState } from "react";
import InteractiveTree from "./InteractiveTree";

const C = {
  primary: "#4f46e5",
  surface: "#ffffff",
  textSec: "#6b7280",
  border:  "#e5e7eb",
};

export default function RankTreeTab({ rankRootUserId = null }) {
  // selectedUserId: null = show root; string = drilled-in user_id
  const [selectedUserId, setSelectedUserId] = useState(null);

  const showBack = selectedUserId !== null;

  return (
    <div>
      {/* ── Hint + Back button ── */}
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
        {showBack && (
          <button
            onClick={() => setSelectedUserId(null)}
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

      {/* ── Interactive SVG tree ── */}
      <InteractiveTree
        key={selectedUserId || "__rank_root__"}   /* remount when node changes */
        useRankMatrix={true}
        rankRootUserId={rankRootUserId || undefined}
        rankStartUserId={selectedUserId || rankRootUserId || undefined}
        pool="FIVE_150"
        onNodeSelect={(nodeId) => {
          setSelectedUserId(nodeId || null);
        }}
      />

      {/* ── Legend ── */}
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
                flexShrink: 0,
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
