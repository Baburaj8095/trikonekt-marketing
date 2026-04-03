import React from "react";
import RankTreeTab from "./RankTreeTab";

const C = {
  primary: "#4f46e5",
  primaryLight: "#ede9fe",
  surface: "#ffffff",
  text: "#111827",
  textSec: "#6b7280",
  border: "#e5e7eb",
  success: "#059669",
  successBg: "#ecfdf5",
  warning: "#d97706",
  warningBg: "#fffbeb",
  error: "#dc2626",
  errorBg: "#fef2f2",
};

/* ─── Small earnings breakdown card ─── */
function EarningsCard({ label, value, color, bg, note }) {
  return (
    <div
      style={{
        background: bg || C.surface,
        borderRadius: 20,
        padding: "16px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: color || C.textSec,
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: color || C.text,
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ₹
        {Number(value || 0).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
      {note ? (
        <div style={{ fontSize: 11, color: C.textSec, marginTop: 5 }}>{note}</div>
      ) : null}
    </div>
  );
}

/* ─── Single active member row ─── */
function MemberRow({ member, index }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: C.primaryLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 15,
          color: C.primary,
          flexShrink: 0,
          textTransform: "uppercase",
        }}
      >
        {(member?.full_name || member?.username || String(index + 1))[0]}
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
        <div style={{ fontSize: 12, color: C.textSec }}>ID: {member?.username || "—"}</div>
      </div>

      {/* Active badge */}
      <div
        style={{
          background: C.successBg,
          color: C.success,
          borderRadius: 99,
          padding: "3px 10px",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        Active
      </div>
    </div>
  );
}

/* ─── Main EarningsTab component ─── */
export default function EarningsTab({
  rankMx,
  rankMxLoading,
  rankMxErr,
  onRefresh,
  directList,
}) {
  const sponsorEarned = Number(rankMx?.totals?.sponsor_released || 0);
  const levelReleased = Number(rankMx?.totals?.level_released || 0);
  const levelHold = Number(rankMx?.totals?.level_hold || 0);
  const totalEarned = sponsorEarned + levelReleased + levelHold;

  const progressCount = Number(rankMx?.approved_count || 0);
  const progressTarget = Number(rankMx?.target || 5);
  const progressPct =
    progressTarget > 0 ? Math.min(100, (progressCount / progressTarget) * 100) : 0;
  const daysLeft = rankMx?.days_left;

  const activeMembers = (Array.isArray(directList) ? directList : [])
    .filter((m) => !!m?.account_active)
    .slice(0, 10);

  return (
    <div>
      {/* ── Hero gradient card ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          borderRadius: 24,
          padding: "24px 20px 22px",
          marginBottom: 12,
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative bubbles */}
        <div
          style={{
            position: "absolute",
            top: -24,
            right: -24,
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -28,
            right: 50,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            pointerEvents: "none",
          }}
        />

        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 2 }}>
          Total Income
        </div>
        <div
          style={{
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: "-1.5px",
            marginBottom: 14,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ₹
          {totalEarned.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>

        {/* Rank-1 progress */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
              fontSize: 12,
              opacity: 0.9,
            }}
          >
            <span>Rank‑1 Progress</span>
            <span style={{ fontWeight: 800 }}>
              {progressCount} / {progressTarget}
            </span>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.25)",
              borderRadius: 99,
              height: 7,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "#ffffff",
                borderRadius: 99,
                transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>
          {daysLeft != null && (
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
              {daysLeft} days remaining in window
            </div>
          )}
        </div>
      </div>

      {/* ── Breakdown: 2-column then 1 full-width ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <EarningsCard
          label="Sponsor Earned"
          value={sponsorEarned}
          color={C.success}
          bg={C.successBg}
        />
        <EarningsCard
          label="Level Released"
          value={levelReleased}
          color={C.primary}
          bg={C.primaryLight}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <EarningsCard
          label="On Hold"
          value={levelHold}
          color={C.warning}
          bg={C.warningBg}
          note="Pending release — evaluated on approval events"
        />
      </div>

      {/* ── Rank-1 Matrix Tree ── */}
      <div
        style={{
          background: C.surface,
          borderRadius: 20,
          padding: "16px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>
            Rank‑1 Matrix
          </div>
          <button
            onClick={onRefresh}
            disabled={rankMxLoading}
            style={{
              background: "transparent",
              border: `1.5px solid ${C.border}`,
              borderRadius: 10,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 700,
              color: C.primary,
              cursor: rankMxLoading ? "not-allowed" : "pointer",
              opacity: rankMxLoading ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {rankMxLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {rankMxErr ? (
          <div
            style={{
              fontSize: 13,
              color: C.error,
              background: C.errorBg,
              padding: "10px 14px",
              borderRadius: 12,
            }}
          >
            {rankMxErr}
          </div>
        ) : (
          <RankTreeTab rankRootUserId={rankMx?.root?.root_user_id || null} />
        )}
      </div>

      {/* ── Active direct members feed ── */}
      {activeMembers.length > 0 && (
        <div>
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
            Active Direct ({activeMembers.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeMembers.map((m, idx) => (
              <MemberRow key={m?.id || idx} member={m} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}