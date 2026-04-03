/**
 * DirectSponsorTab.jsx
 * Shows the list of direct sponsor members for the logged-in user.
 * Active members have a "View" button that opens MemberDetailModal.
 */

import React, { useState } from "react";
import MemberDetailModal from "./MemberDetailModal";

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  surface: "#ffffff",
  primary: "#4f46e5",
  primaryL: "#ede9fe",
  green: "#16a34a",
  greenL: "#dcfce7",
  text: "#111827",
  textSec: "#6b7280",
  border: "#e5e7eb",
  bg: "#f0f4ff",
  shadow: "0 2px 12px rgba(79,70,229,0.08)",
};

function fmt(isoStr) {
  if (!isoStr) return "–";
  try {
    return new Date(isoStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

// ─── Person icon ────────────────────────────────────────────────────────────
function AvatarCircle({ name = "?", active }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: active ? C.primaryL : "#f1f5f9",
        color: active ? C.primary : C.textSec,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        fontWeight: 800,
        flexShrink: 0,
        border: `2px solid ${active ? C.primary : C.border}`,
      }}
    >
      {initials || "?"}
    </div>
  );
}

// ─── Individual member card ─────────────────────────────────────────────────
function MemberCard({ member, onView }) {
  const isActive = Boolean(member?.account_active);
  const displayName = member?.full_name || member?.username || "Unknown";
  const username = member?.username || "";
  const joinDate = fmt(member?.date_joined);

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: C.shadow,
        border: `1.5px solid ${isActive ? "#c7d2fe" : C.border}`,
      }}
    >
      <AvatarCircle name={displayName} active={isActive} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </div>
        <div style={{ fontSize: 12, color: C.textSec, marginTop: 1 }}>
          🪪 {username}
        </div>
        <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
          Joined {joinDate}
        </div>
      </div>

      {/* Right side: status + button */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
          flexShrink: 0,
        }}
      >
        {/* Status badge */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 9px",
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            background: isActive ? C.greenL : "#f1f5f9",
            color: isActive ? C.green : C.textSec,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isActive ? C.green : "#9ca3af",
              display: "inline-block",
            }}
          />
          {isActive ? "Active" : "Inactive"}
        </span>

        {/* View button – only for active accounts */}
        {isActive && (
          <button
            onClick={() => onView(member?.id)}
            style={{
              padding: "5px 14px",
              borderRadius: 99,
              border: `1.5px solid ${C.primary}`,
              background: C.primary,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              outline: "none",
              letterSpacing: "0.02em",
            }}
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Tab ───────────────────────────────────────────────────────────────
export default function DirectSponsorTab({
  directList = [],
  loading = false,
  onRefresh,
}) {
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState("all"); // 'all' | 'active' | 'inactive'
  const [viewingUserId, setViewingUserId] = useState(null);

  // Filtered list
  const filtered = directList.filter((m) => {
    const matchSearch =
      !search ||
      (m?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (m?.username || "").toLowerCase().includes(search.toLowerCase()) ||
      (m?.phone || "").includes(search);
    const matchFilter =
      filterActive === "all" ||
      (filterActive === "active" && Boolean(m?.account_active)) ||
      (filterActive === "inactive" && !Boolean(m?.account_active));
    return matchSearch && matchFilter;
  });

  const activeCount = directList.filter((m) => Boolean(m?.account_active)).length;
  const inactiveCount = directList.length - activeCount;

  return (
    <div>
      {/* ── Summary chips ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {[
          { key: "all", label: `All (${directList.length})` },
          { key: "active", label: `Active (${activeCount})` },
          { key: "inactive", label: `Inactive (${inactiveCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterActive(key)}
            style={{
              padding: "5px 14px",
              borderRadius: 99,
              border: `1.5px solid ${filterActive === key ? C.primary : C.border}`,
              background: filterActive === key ? C.primaryL : C.surface,
              color: filterActive === key ? C.primary : C.textSec,
              fontSize: 12,
              fontWeight: filterActive === key ? 700 : 500,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 15,
            pointerEvents: "none",
          }}
        >
          🔍
        </span>
        <input
          type="text"
          placeholder="Search by name, ID or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px 10px 36px",
            borderRadius: 10,
            border: `1.5px solid ${C.border}`,
            background: C.surface,
            fontSize: 13,
            color: C.text,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* ── List ── */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: C.textSec,
            fontSize: 14,
          }}
        >
          Loading members…
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: C.textSec,
            fontSize: 14,
          }}
        >
          {directList.length === 0
            ? "No direct members yet."
            : "No members match your search."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((member, i) => (
            <MemberCard
              key={member?.id || i}
              member={member}
              onView={(uid) => setViewingUserId(uid)}
            />
          ))}
        </div>
      )}

      {/* ── Detail Modal ── */}
      {viewingUserId !== null && (
        <MemberDetailModal
          userId={viewingUserId}
          onClose={() => setViewingUserId(null)}
        />
      )}
    </div>
  );
}
