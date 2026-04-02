import React, { useState } from "react";

const C = {
  primary: "#4f46e5",
  primaryLight: "#ede9fe",
  surface: "#ffffff",
  text: "#111827",
  textSec: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e7eb",
  success: "#059669",
  successBg: "#ecfdf5",
  warning: "#d97706",
  warningBg: "#fffbeb",
  error: "#dc2626",
  errorBg: "#fef2f2",
};

/* ─── Helpers ─── */
function fmtDate(val) {
  try {
    if (!val) return "—";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return (
      String(d.getDate()).padStart(2, "0") +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      d.getFullYear()
    );
  } catch {
    return String(val || "—");
  }
}

/* ─── Stat tile ─── */
function StatTile({ label, value, color }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        padding: "14px 8px",
        textAlign: "center",
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.textSec,
          fontWeight: 600,
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || C.text }}>
        {value}
      </div>
    </div>
  );
}

/* ─── Thin animated progress bar ─── */
function Bar({ pct, color }) {
  return (
    <div
      style={{
        background: "#f1f5f9",
        borderRadius: 99,
        height: 7,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, Math.max(0, pct))}%`,
          background: color || C.primary,
          borderRadius: 99,
          transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}

/* ─── Level card ─── */
function LevelCard({ level, count, pct, isActive, isLocked }) {
  const statusLabel = isLocked ? "🔒" : isActive ? "Active" : count > 0 ? "Growing" : "Empty";
  const statusColor = isLocked
    ? C.textMuted
    : isActive
    ? C.success
    : count > 0
    ? C.warning
    : C.textMuted;
  const statusBg = isLocked
    ? "#f9fafb"
    : isActive
    ? C.successBg
    : count > 0
    ? C.warningBg
    : "#f9fafb";
  const barColor = isActive ? C.success : count > 0 ? C.warning : C.primary;

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        opacity: isLocked ? 0.5 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
          Level {level}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: C.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {count.toLocaleString("en-IN")}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: statusColor,
              background: statusBg,
              borderRadius: 99,
              padding: "3px 10px",
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <Bar pct={pct} color={barColor} />
    </div>
  );
}

/* ─── Direct member row ─── */
function DirectRow({ member, index }) {
  const isActive = !!member?.account_active;
  const phone = String(member?.phone || "").trim();
  const initial = (member?.full_name || member?.username || String(index + 1))[0];

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        padding: "14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: isActive ? C.successBg : "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 14,
          color: isActive ? C.success : C.textSec,
          flexShrink: 0,
          textTransform: "uppercase",
        }}
      >
        {initial}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {member?.full_name || member?.username || "—"}
        </div>
        <div style={{ fontSize: 12, color: C.textSec }}>
          {member?.username} · {fmtDate(member?.date_joined)}
        </div>
      </div>

      {/* Right side */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 5,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            background: isActive ? C.successBg : C.errorBg,
            color: isActive ? C.success : C.error,
            borderRadius: 99,
            padding: "2px 9px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
        {phone ? (
          <a
            href={`tel:${phone}`}
            style={{
              background: C.successBg,
              color: C.success,
              borderRadius: 8,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Call
          </a>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Position card ─── */
function PositionCard({ pos }) {
  const isActive =
    String(pos?.status || "").toUpperCase() === "ACTIVE";
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontWeight: 900,
            fontFamily: "monospace",
            fontSize: 14,
            color: C.text,
          }}
        >
          {pos?.username_key || "—"}
        </span>
        <span
          style={{
            background: isActive ? C.successBg : "#f3f4f6",
            color: isActive ? C.success : C.textSec,
            borderRadius: 99,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {pos?.status || "—"}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 13,
          marginBottom: 4,
        }}
      >
        <span style={{ color: C.textSec }}>
          Level{" "}
          <strong style={{ color: C.text }}>{pos?.level ?? "—"}</strong>
        </span>
        <span style={{ color: C.textSec }}>
          Idx{" "}
          <strong style={{ color: C.text }}>
            {pos?.user_entry_index ?? "—"}
          </strong>
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.textMuted }}>
        Opened: {fmtDate(pos?.created_at)}
      </div>
    </div>
  );
}

/* ─── Sub-section pill selector ─── */
function SubTabs({ options, value, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 2,
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        marginBottom: 16,
      }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 99,
              border: active ? "none" : `1.5px solid ${C.border}`,
              background: active ? C.primary : C.surface,
              color: active ? "#fff" : C.textSec,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: active ? "0 4px 12px rgba(79,70,229,0.25)" : "none",
              transition: "all 0.18s ease",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Main ProgressTab ─── */
export default function ProgressTab({
  fiveLevelGrid,
  activeLevelsReached,
  totalTeam,
  directCount,
  directCountsState,
  directList,
  myPositions,
  loadingDirects,
  onRefreshDirects,
}) {
  const [section, setSection] = useState("levels");

  const activeCount =
    typeof directCountsState?.active === "number" ? directCountsState.active : 0;
  const inactiveCount =
    typeof directCountsState?.inactive === "number" ? directCountsState.inactive : 0;

  const maxCount = Math.max(
    1,
    ...(fiveLevelGrid || []).map((r) => Number(r.count || 0))
  );

  const fivePos = (myPositions || []).filter(
    (p) => String(p?.pool_type) === "FIVE_150"
  );
  const threePos = (myPositions || []).filter(
    (p) => String(p?.pool_type) === "THREE_150"
  );
  const members = Array.isArray(directList) ? directList : [];

  const subTabs = [
    { key: "levels", label: "Levels" },
    { key: "direct", label: `Direct (${directCount})` },
    {
      key: "positions",
      label: `Positions (${(myPositions || []).length})`,
    },
  ];

  return (
    <div>
      {/* ── Top stats strip ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <StatTile
          label="Total Team"
          value={totalTeam.toLocaleString("en-IN")}
        />
        <StatTile label="Direct" value={String(directCount)} />
        <StatTile
          label="Active Levels"
          value={String(activeLevelsReached)}
          color={C.primary}
        />
      </div>

      {/* ── Active / Inactive direct tiles ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: C.successBg,
            borderRadius: 16,
            padding: "14px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.success,
              fontWeight: 700,
              marginBottom: 3,
            }}
          >
            Active Direct
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.success }}>
            {activeCount}
          </div>
        </div>
        <div
          style={{
            background: C.errorBg,
            borderRadius: 16,
            padding: "14px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.error,
              fontWeight: 700,
              marginBottom: 3,
            }}
          >
            Inactive
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.error }}>
            {inactiveCount}
          </div>
        </div>
      </div>

      {/* ── Sub-section tabs ── */}
      <SubTabs options={subTabs} value={section} onChange={setSection} />

      {/* ══════════ LEVELS ══════════ */}
      {section === "levels" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(fiveLevelGrid || []).length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: C.textSec,
                padding: "48px 0",
                fontSize: 14,
              }}
            >
              No level data yet.
            </div>
          ) : (
            (fiveLevelGrid || []).map((r) => {
              const lvl = Number(r.level);
              const count = Number(r.count || 0);
              const isActive = count > 0 && lvl <= activeLevelsReached;
              const isLocked =
                count === 0 && lvl > activeLevelsReached + 2;
              const pct = (count / maxCount) * 100;
              return (
                <LevelCard
                  key={lvl}
                  level={lvl}
                  count={count}
                  pct={pct}
                  isActive={isActive}
                  isLocked={isLocked}
                />
              );
            })
          )}
        </div>
      )}

      {/* ══════════ DIRECT ══════════ */}
      {section === "direct" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 12,
            }}
          >
            <button
              onClick={onRefreshDirects}
              disabled={loadingDirects}
              style={{
                background: "transparent",
                border: `1.5px solid ${C.border}`,
                borderRadius: 10,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: C.primary,
                cursor: loadingDirects ? "not-allowed" : "pointer",
                opacity: loadingDirects ? 0.6 : 1,
              }}
            >
              {loadingDirects ? "Loading…" : "Reload"}
            </button>
          </div>

          {members.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: C.textSec,
                padding: "48px 0",
                fontSize: 14,
              }}
            >
              {loadingDirects ? "Fetching members…" : "No direct sponsors found."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map((m, idx) => (
                <DirectRow key={m?.id || idx} member={m} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ POSITIONS ══════════ */}
      {section === "positions" && (
        <div>
          {/* 5-Matrix */}
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.textSec,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 10px 0",
            }}
          >
            5-Matrix ({fivePos.length})
          </p>
          {fivePos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: C.textSec,
                padding: "20px 0",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              No 5-Matrix positions.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 20,
              }}
            >
              {fivePos.map((p, i) => (
                <PositionCard key={p?.id || i} pos={p} />
              ))}
            </div>
          )}

          {/* 3-Matrix */}
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.textSec,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              margin: "0 0 10px 0",
            }}
          >
            3-Matrix ({threePos.length})
          </p>
          {threePos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: C.textSec,
                padding: "20px 0",
                fontSize: 13,
              }}
            >
              No 3-Matrix positions.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {threePos.map((p, i) => (
                <PositionCard key={p?.id || i} pos={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}