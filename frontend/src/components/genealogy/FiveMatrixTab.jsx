/**
 * FiveMatrixTab.jsx
 * 5 Matrix & Chart tab:
 *  • KPI boxes: Total Team | Active Levels Open | Levels Completed | Total Earning
 *  • Account ID dropdown selector (self 5-matrix positions)
 *  • Level table: S.No | Level | Team Active Count | Status
 *  • Interactive 5-matrix tree below (keyed to selected account)
 */

import React from "react";
import InteractiveTree from "./InteractiveTree";

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  primary:   "#4f46e5",
  primaryL:  "#ede9fe",
  surface:   "#ffffff",
  text:      "#111827",
  textSec:   "#6b7280",
  border:    "#e5e7eb",
  green:     "#16a34a",
  greenL:    "#dcfce7",
  amber:     "#d97706",
  amberL:    "#fef3c7",
  red:       "#dc2626",
  redL:      "#fef2f2",
  shadow:    "0 2px 12px rgba(79,70,229,0.08)",
};

// ─── Account category definitions ──────────────────────────────────────────
function looksLikeSmartSspSourceId(sourceId) {
  // Smart SSP source_id usually: "{purchase_id}:{package_number}:{box_number}"
  // Some legacy rows may be missing a clean source_type; this heuristic keeps them visible.
  try {
    const parts = String(sourceId || "").split(":");
    if (parts.length < 2) return false;
    const purchaseId = parseInt(parts[0], 10);
    const season = parseInt(parts[1], 10);
    const box = parts.length >= 3 ? parseInt(parts[2], 10) : null;

    if (Number.isNaN(season) || season <= 0) return false;
    // purchaseId is typically numeric, but avoid being overly strict for safety.
    if (!Number.isNaN(purchaseId) && purchaseId <= 0) return false;
    if (box != null && (Number.isNaN(box) || box <= 0)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

const ACCOUNT_CATEGORIES = [
  {
    id: "SUBSCRIPTION_750",
    label: "Subscription Joining 750",
    hint: "5-matrix accounts from ₹750 promo package",
    match: (src) => {
      const s = (src || "").toUpperCase();
      return (
        s.includes("PROMO_PURCHASE") ||
        s.includes("PROMO_PURCHASE_APPROVAL") ||
        s.includes("PRIME_750") ||
        s.includes("SUBSCRIPTION_750")
      );
    },
  },
  {
    id: "SMART_SSP",
    label: "Smart SSP",
    hint: "Monthly 759/1000 — opens matrix on 1st month of each season only",
    match: (src) => {
      const s = (src || "").toUpperCase();
      return (
        s.includes("MONTHLY_759") ||
        s.includes("MONTHLY_1000") ||
        s.includes("MONTHLY_FIRST_SEASON") ||
        s.includes("SMART_SSP") ||
        // legacy tags seen in some historical rows
        s.includes("ECOUPON_759") ||
        s.includes("ECOUPON_1000")
      );
    },
  },
  {
    id: "SELF_REBIRTH",
    label: "Self Rebirth Account",
    hint: "E-coupon 150 activation or self-account allocation",
    match: (src) => {
      const s = (src || "").toUpperCase();
      return (
        s.includes("ECOUPON") ||
        s.includes("COUPON_150") ||
        s.includes("PRIME_150") ||
        s.includes("PRIME150") ||
        s.includes("SELF_250") ||
        s.includes("SELF_ACCOUNT") ||
        s.includes("SELF_REBIRTH")
      );
    },
  },
  {
    id: "OTHER",
    label: "Other / Legacy",
    hint: "Fallback bucket for unknown/legacy source tags (should be rare)",
    match: () => false,
  },
];

/** Classify a source_type string into one of the 3 category IDs (or "OTHER") */
function classifySource(sourceType, sourceId) {
  for (const cat of ACCOUNT_CATEGORIES) {
    if (cat.match(sourceType)) return cat.id;
  }
  // If tag is missing/unknown, infer Smart SSP by its source_id format.
  if (looksLikeSmartSspSourceId(sourceId)) return "SMART_SSP";
  // Unknown sources should not be counted under any purchase-driven category
  return "OTHER";
}

function categoryForRow(r) {
  // Only trust inferred_category if it's one of the known categories.
  // (Avoids future backend values causing the row to disappear from ALL UI filters.)
  const inferred = String(r?.inferred_category || "").trim().toUpperCase();
  if (inferred && ACCOUNT_CATEGORIES.some((c) => c.id === inferred)) return inferred;
  return classifySource(r?.source_type, r?.source_id);
}

/** Extract season number from Smart SSP source_id (format: "{purchase_id}:{pkg_no}:{box_no}") */
function extractSeasonNumber(sourceId) {
  try {
    const parts = String(sourceId || "").split(":");
    if (parts.length >= 2) {
      const n = parseInt(parts[1], 10);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch (_) {}
  return null;
}

function fmtMoney(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

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

// ─── Level table ───────────────────────────────────────────────────────────
function LevelTable({ levelGrid }) {
  if (!levelGrid || levelGrid.length === 0) return null;

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: C.shadow,
        marginBottom: 16,
      }}
    >
      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px 1fr 60px 60px 90px",
          background: C.primary,
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          padding: "10px 14px",
          gap: 4,
        }}
      >
        <div>S.No</div>
        <div>Level</div>
        <div style={{ textAlign: "center" }}>Total</div>
        <div style={{ textAlign: "center" }}>Active</div>
        <div style={{ textAlign: "right" }}>Status</div>
      </div>

      {levelGrid.map((row, i) => {
        const count = Number(row.count || 0);
        const maxCount = Number(row.max_count || Math.pow(5, row.level));
        const isCompleted = count > 0 && count >= maxCount;
        const hasMembers = count > 0;

        const statusLabel = !hasMembers ? "–" : isCompleted ? "Completed" : "Not Completed";
        const statusColor = !hasMembers ? C.textSec : isCompleted ? C.green : C.amber;
        const statusBg   = !hasMembers ? "transparent" : isCompleted ? C.greenL : C.amberL;

        return (
          <div
            key={row.level}
            style={{
              display: "grid",
              gridTemplateColumns: "36px 1fr 60px 60px 90px",
              padding: "10px 14px",
              borderBottom: i < levelGrid.length - 1 ? `1px solid ${C.border}` : "none",
              background: hasMembers ? (i % 2 === 0 ? "#fafbff" : C.surface) : C.surface,
              gap: 4,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{row.sn}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              Level – {row.level}
            </div>
            {/* Total Count (5^level) */}
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textSec, textAlign: "center" }}>
              {maxCount.toLocaleString()}
            </div>
            {/* Active Count */}
            <div style={{ fontSize: 13, fontWeight: 800, color: hasMembers ? C.primary : C.textSec, textAlign: "center" }}>
              {hasMembers ? count : "–"}
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 8px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  background: statusBg,
                  color: statusColor,
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        );
      })}
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
export default function FiveMatrixTab({
  fiveRootsList  = [],
  selectedRoot   = null,
  setSelectedRoot,
  fiveCategory   = null,
  setFiveCategory,
  fiveLevelGrid  = [],
  fiveCounts     = null,
  totalTeam      = 0,
  activeLevelsReached = 0,
  totalFiveEarning    = 0,
  levels         = { five: 10 },
}) {
  const hasPools = fiveRootsList.length > 0;

  // ── Classify each position into a category ──
  const categorizedPools = React.useMemo(() => {
    const map = {};
    for (const cat of ACCOUNT_CATEGORIES) {
      map[cat.id] = fiveRootsList.filter((r) => categoryForRow(r) === cat.id);
    }
    return map;
  }, [fiveRootsList]);

  // ── Determine active category (fall back to first non-empty one) ──
  const activeCategory = React.useMemo(() => {
    if (fiveCategory && categorizedPools[fiveCategory]?.length > 0) return fiveCategory;
    for (const cat of ACCOUNT_CATEGORIES) {
      if (categorizedPools[cat.id]?.length > 0) return cat.id;
    }
    return ACCOUNT_CATEGORIES[0].id;
  }, [fiveCategory, categorizedPools]);

  // ── Pools available for selected category ──
  const activePools = categorizedPools[activeCategory] || [];

  // ── Ensure selectedRoot stays valid within active category ──
  React.useEffect(() => {
    if (activePools.length > 0) {
      const ids = activePools.map((r) => r.id);
      if (!ids.includes(selectedRoot)) {
        setSelectedRoot(activePools[0]?.id ?? null);
      }
    }
  }, [activeCategory, fiveRootsList]);

  // Levels completed from API or compute locally
  const levelsCompleted = fiveCounts?.levels_completed ??
    fiveLevelGrid.filter((row) => {
      const count = Number(row.count || 0);
      const maxCount = Number(row.max_count || Math.pow(5, row.level));
      return count > 0 && count >= maxCount;
    }).length;

  // Earning: prefer the value from the counts API (refreshes per account selection)
  const earning = Number(fiveCounts?.total_earned || totalFiveEarning || 0);

  // Enrich levelGrid rows with max_count if missing
  const enrichedGrid = fiveLevelGrid.map((row) => ({
    ...row,
    max_count: row.max_count ?? Math.pow(5, row.level),
  }));

  // Build display name for each account position
  const getPositionLabel = (r, i) => {
    const key = String(r?.username_key || "").trim();
    const base = key.replace(/-\d+$/, "");
    const idx = r?.user_entry_index || (i + 1);
    const baseLabel = key || (idx === 1 ? base : `${base}-${idx}`) || `ID ${idx}`;
    // For Smart SSP: append season number
    const earned = r?.total_earned;
    const earnedLabel =
      earned != null && earned !== ""
        ? ` • Earned ₹${fmtMoney(earned)}`
        : "";

    if (categoryForRow(r) === "SMART_SSP") {
      const season = extractSeasonNumber(r.source_id);
      const core = season ? `${baseLabel} (Season ${season})` : baseLabel;
      return `${core}${earnedLabel}`;
    }
    return `${baseLabel}${earnedLabel}`;
  };

  return (
    <div>
      {/* ── Category type selector ── */}
      {hasPools && (
        <div style={{ marginBottom: 12 }}>
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
            Account Type
          </label>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {ACCOUNT_CATEGORIES.map((cat) => {
              const count = (categorizedPools[cat.id] || []).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setFiveCategory && setFiveCategory(cat.id);
                  }}
                  title={cat.hint}
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    padding: "8px 6px",
                    borderRadius: 10,
                    border: `1.5px solid ${isActive ? C.primary : C.border}`,
                    background: isActive ? C.primaryL : C.surface,
                    color: isActive ? C.primary : C.textSec,
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 500,
                    lineHeight: 1.3,
                    cursor: count > 0 ? "pointer" : "default",
                    opacity: count === 0 ? 0.45 : 1,
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ marginBottom: 2 }}>{cat.label}</div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: isActive ? C.primary : C.textSec,
                    }}
                  >
                    {count} {count === 1 ? "ID" : "IDs"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Account ID selector (filtered by category) ── */}
      {activePools.length > 0 && (
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
            {ACCOUNT_CATEGORIES.find((c) => c.id === activeCategory)?.label || "Account"} ID
          </label>
          <select
            value={selectedRoot ?? ""}
            onChange={(e) =>
              setSelectedRoot(e.target.value ? Number(e.target.value) : null)
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
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234f46e5' stroke-width='1.8' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 14px center",
              paddingRight: 36,
              cursor: "pointer",
            }}
          >
            {activePools.map((r, i) => (
              <option key={r.id} value={r.id}>
                {getPositionLabel(r, i)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── No IDs for selected category ── */}
      {hasPools && activePools.length === 0 && (
        <div
          style={{
            background: "#f9fafb",
            border: `1.5px dashed ${C.border}`,
            borderRadius: 12,
            padding: "14px 16px",
            textAlign: "center",
            color: C.textSec,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          No accounts in this category yet.
        </div>
      )}

      {/* ── KPI grid ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <KpiCard label="Total Team" value={totalTeam} accent={C.primary} />
        <KpiCard label="Active Levels Open" value={activeLevelsReached} accent={C.green} />
        <KpiCard label="Levels Completed" value={levelsCompleted > 0 ? `L${levelsCompleted}` : "–"} accent={C.amber} />
        <KpiCard label="5 Matrix Earning" value={`\u20b9${earning.toFixed(0)}`} accent="#7c3aed" />
      </div>

      {/* ── Level chart / table ── */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.2px",
          marginBottom: 10,
        }}
      >
        Level-wise Team Count
      </div>
      {hasPools ? (
        <LevelTable levelGrid={enrichedGrid} />
      ) : (
        <div
          style={{
            background: C.surface,
            borderRadius: 14,
            padding: "24px",
            textAlign: "center",
            color: C.textSec,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          No active 5‑Matrix positions found.
        </div>
      )}

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
        5‑Matrix Tree
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
          key={`FIVE_150-${String(selectedRoot)}`}
          entryRootId={selectedRoot}
          useEntriesTree={!!selectedRoot}
          pool="FIVE_150"
          maxDepth={Number(levels?.five ?? 10)}
          onNodeSelect={(nodeId) =>
            setSelectedRoot(nodeId ? Number(nodeId) : null)
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
          No positions to display.
        </div>
      )}

      <Legend />
    </div>
  );
}
