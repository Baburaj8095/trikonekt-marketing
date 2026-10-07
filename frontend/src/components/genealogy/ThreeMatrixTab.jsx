/**
 * ThreeMatrixTab.jsx
 * 3 Matrix Tree tab:
 *  • 3-category type selector (Join Prime / Smart SSP / Self Rebirth)
 *  • Account ID selector (filtered by chosen category)
 *  • KPI boxes: Total Team | Active Layers Open | Levels Completed | Total Earning
 *  • Interactive 3-matrix tree (NO level chart)
 */

import React from "react";
import AccordionTree from "./AccordionTree";

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

// ─── Account category definitions ──────────────────────────────────────────
function looksLikeSmartSspSourceId(sourceId) {
  try {
    const parts = String(sourceId || "").split(":");
    if (parts.length < 2) return false;
    const purchaseId = parseInt(parts[0], 10);
    const season = parseInt(parts[1], 10);
    const box = parts.length >= 3 ? parseInt(parts[2], 10) : null;

    if (Number.isNaN(season) || season <= 0) return false;
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
    label: "Join Prime",
    hint: "3-matrix accounts from Prime package",
    match: (src) => {
      const s = (src || "").toUpperCase();
      return (
        s.includes("PROMO_PURCHASE") ||
        s.includes("PROMO_PURCHASE_APPROVAL") ||
        s.includes("PRIME_750") ||
        s.includes("PRIME_1000") ||
        s.includes("PRIME1000") ||
        s.includes("PRIME750") ||
        s.includes("JOIN_SUBSCRIPTION") ||
        s.includes("SUBSCRIPTION_750") ||
        s.includes("SUBSCRIPTION_1000") ||
        s.includes("SENTINEL") ||
        s.includes("ROOT") ||
        s.includes("2K") ||
        s.includes("PACKAGE") ||
        s.includes("PROMO")
      );
    },
  },
  {
    id: "SMART_SSP",
    label: "Smart SSP",
    hint: "Monthly 1000 — opens matrix on 1st month of each season only",
    match: (src) => {
      const s = (src || "").toUpperCase();
      return (
        s.includes("MONTHLY") ||
        s.includes("SPP") ||
        s.includes("MONTHLY_759") ||
        s.includes("MONTHLY_1000") ||
        s.includes("MONTHLY_FIRST_SEASON") ||
        s.includes("SMART_SSP") ||
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
        s.includes("SELF_250_PACK") ||
        s.includes("SELF_ACCOUNT") ||
        s.includes("SELF_REBIRTH")
      );
    },
  },
];

/** Classify a source_type string into one of the 3 category IDs */
function classifySource(sourceType, sourceId) {
  for (const cat of ACCOUNT_CATEGORIES) {
    if (cat.match(sourceType)) return cat.id;
  }
  // If tag is missing/unknown, infer Smart SSP by its source_id format.
  if (looksLikeSmartSspSourceId(sourceId)) return "SMART_SSP";
  return "SUBSCRIPTION_750";
}

function categoryForRow(r) {
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
          fontWeight: 800,
          color: C.textSec,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 900,
          color: accent || C.text,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { label: "Active", bg: "#dcfce7", color: "#16a34a" },
    { label: "Empty / Open", bg: "#f3f4f6", color: "#9ca3af" },
  ];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
        fontSize: 11,
        color: C.textSec,
        flexWrap: "wrap",
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: it.bg,
              border: `1.5px solid ${it.color}`,
              display: "inline-block",
            }}
          />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function ThreeMatrixTab({
  threeRootsList = [],
  selectedThreeRoot = null,
  setSelectedThreeRoot = () => {},
  threeCounts = null,
  threeLevelGrid = [],
  totalThreeTeam = 0,
  activeLevelsReached = 0,
  totalThreeEarning = 0,
  levels = {},
  threeCategory = null,
  setThreeCategory = null,
}) {
  const hasPools = threeRootsList.length > 0;

  // ── Classify each position into a category (with Sentinel deduplication) ──
  const categorizedPools = React.useMemo(() => {
    const map = {};
    for (const cat of ACCOUNT_CATEGORIES) {
      let items = threeRootsList.filter((r) => categoryForRow(r) === cat.id);
      if (cat.id === "SUBSCRIPTION_750" && items.length > 1) {
        const hasRealPrime = items.some((r) =>
          String(r.source_type || "").toUpperCase().includes("PRIME_750") ||
          String(r.source_type || "").toUpperCase().includes("PROMO_PURCHASE")
        );
        if (hasRealPrime) {
          items = items.filter((r) => String(r.source_type || "").toUpperCase() !== "SENTINEL" || Number(r.entry_amount || 0) > 0);
        }
      }
      map[cat.id] = items;
    }
    return map;
  }, [threeRootsList]);

  // ── Determine active category (fall back to first non-empty one) ──
  const activeCategory = React.useMemo(() => {
    if (threeCategory && categorizedPools[threeCategory]?.length > 0) return threeCategory;
    for (const cat of ACCOUNT_CATEGORIES) {
      if (categorizedPools[cat.id]?.length > 0) return cat.id;
    }
    return ACCOUNT_CATEGORIES[0].id;
  }, [threeCategory, categorizedPools]);

  // ── Pools available for selected category ──
  const activePools = categorizedPools[activeCategory] || [];

  // ── Ensure selectedThreeRoot stays valid within active category ──
  React.useEffect(() => {
    if (activePools.length > 0) {
      const ids = activePools.map((r) => r.id);
      if (!ids.includes(selectedThreeRoot)) {
        setSelectedThreeRoot(activePools[0]?.id ?? null);
      }
    }
  }, [activeCategory, threeRootsList]);

  // Levels completed from API or compute locally
  const levelsCompleted = threeCounts?.levels_completed ??
    threeLevelGrid.filter((row) => {
      const count = Number(row.count || 0);
      const maxCount = Number(row.max_count || Math.pow(3, row.level));
      return count > 0 && count >= maxCount;
    }).length;

  // Earning: prefer the value from the counts API (refreshes per account selection)
  const earning = hasPools ? Number(threeCounts?.total_earned || totalThreeEarning || 0) : 0;

  // Build display name for each account position
  const getPositionLabel = (r, i) => {
    const key = String(r?.username_key || "").trim();
    const base = key.replace(/-\d+$/, "");
    const idx = r?.user_entry_index || (i + 1);
    const baseLabel = key || (idx === 1 ? base : `${base}-${idx}`) || `ID ${idx}`;
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
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ACCOUNT_CATEGORIES.map((cat) => {
              const count = (categorizedPools[cat.id] || []).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setThreeCategory && setThreeCategory(cat.id);
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
        <KpiCard label="Total Community" value={totalThreeTeam} accent={C.primary} />
        <KpiCard label="Active Layers Open" value={activeLevelsReached} accent={C.green} />
        <KpiCard label="Layers Completed" value={levelsCompleted > 0 ? `L${levelsCompleted}` : "–"} accent={C.amber} />
        <KpiCard label="3 Blocks Earning" value={`\u20b9${earning.toFixed(0)}`} accent="#7c3aed" />
      </div>

      {/* ── Tree section ── */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: C.text,
          letterSpacing: "-0.2px",
          marginBottom: 8,
        }}
      >
        3‑Blocks View
      </div>
      <div
        style={{
          background: C.primaryL,
          color: C.primary,
          padding: "8px 12px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 14,
        }}
      >
        💡 <strong>Tap</strong> a member to drill down into their layer downline · tap root in trail to reset
      </div>

      {hasPools ? (
        <AccordionTree
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
          No 3‑Blocks positions found.
        </div>
      )}

      <Legend />
    </div>
  );
}
