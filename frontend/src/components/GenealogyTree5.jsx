import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getMyGenealogyTree5 } from "../api/genealogy";
import API from "../api/api";

/**
 * GenealogyTree5
 * - Self-only 5-matrix genealogy viewer (uses /accounts/my/genealogy/tree5/)
 * - Shows root (logged-in user or a subtree root within user's downline) and single row of up to 5 children
 * - Drill down by clicking a child; breadcrumbs allow navigating back up
 *
 * Props (all optional):
 * - initialPool: "FIVE_150" | "THREE_150" | "THREE_50" (default "FIVE_150")
 * - maxDepth: number (default 6)
 * - showPlaceholders: boolean (default false) – if true, renders empty slots to complete 5
 * - title: string (default "Genealogy")
 */
export default function GenealogyTree5({
  initialPool = "FIVE_150",
  maxDepth = 10,
  showPlaceholders = false,
  title = "Genealogy",
  useEntriesTree = false,
  entryRootId = null,
  pollIntervalMs = 0,
}) {
  const [pool, setPool] = useState(
    ["FIVE_150","THREE_150"].includes(String(initialPool).toUpperCase())
      ? String(initialPool).toUpperCase()
      : "FIVE_150"
  );
  const [root, setRoot] = useState(null); // { id, username, full_name, team_count, children: [...] }
  const [crumbs, setCrumbs] = useState([]); // Array of previous roots to allow back/up navigation
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const entriesMode = !!useEntriesTree || entryRootId != null;

  const isFive = pool === "FIVE_150";
  const maxChildren = isFive ? 5 : 3;

  const cardW = 160;
  const gap = 12;

  const styles = useMemo(() => ({
    container: { background: "transparent" },
    header: { textAlign: "center", fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 12 },
    topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 },
    breadcrumb: { display: "flex", gap: 6, alignItems: "center", color: "#64748b", fontSize: 12, flexWrap: "wrap" },
    crumbLink: { color: "#0f172a", cursor: "pointer", fontWeight: 700, textTransform: "uppercase" },
    crumbSep: { color: "#94a3b8", fontWeight: 700 },
    sel: { padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff" },
    backBtn: { padding: "8px 10px", background: "#334155", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 12 },
    card: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: cardW, width: cardW },
    cardName: { fontWeight: 800, color: "#0f172a", marginTop: 8, fontSize: 16 },
    cardTR: { color: "#334155", fontSize: 13, marginTop: 4 },
    cardTeam: { color: "#0f172a", fontWeight: 700, fontSize: 14, marginTop: 6 },
    teamLabel: { marginTop: 16, marginBottom: 8, color: "#334155", fontWeight: 700, textAlign: "left" },
    scrollX: { overflowX: "auto", WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", paddingBottom: 8 },
    row: { display: "grid", gridTemplateColumns: `repeat(${maxChildren}, ${cardW}px)`, gap, width: "max-content" },
    childCard: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", cursor: "pointer", width: cardW },
    placeholder: { background: "#fff", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", border: "2px dashed #e2e8f0", color: "#94a3b8", width: cardW },
  }), [maxChildren]);

  const AvatarIcon = ({ size = 56 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="32" fill="#E5E7EB"/>
      <circle cx="32" cy="24" r="10" fill="#9CA3AF"/>
      <path d="M16 50c3-8 10-12 16-12s13 4 16 12" fill="#9CA3AF"/>
    </svg>
  );

  const displayName = (u) => (u?.full_name || u?.username || "").toString();
  const displayTR = (u) => (u?.username || "").toString();

  const fetchRoot = useCallback(async ({ root_user_id = null, spill_from_owner_id = null, start_entry_id = null } = {}) => {
    setLoading(true);
    setErr("");
    try {
      if (entriesMode) {
        // Enforce start_entry_id to avoid accidental requests without it
        const effectiveId = (start_entry_id ?? entryRootId ?? null);
        if (!effectiveId) {
          setLoading(false);
          return;
        }
        const params = { max_depth: maxDepth, pool, start_entry_id: effectiveId };
        const res = await API.get("/accounts/my/matrix/tree5/entries/", { params, cacheTTL: 0, dedupe: "cancelPrevious" });
        const data = res?.data || res;

        const normalize = (n) => {
          if (!n) return null;
          const kids = Array.isArray(n.children) ? n.children.map(normalize) : [];
          return {
            ...n,
            id: n.account_id,
            account_active: String(n.status || "") === "ACTIVE",
            pincode: n.pincode || n.owner_pincode || null,
            children: kids,
          };
        };

        setRoot(normalize(data) || null);
      } else {
        const res = await getMyGenealogyTree5({ root_user_id, max_depth: maxDepth, pool, spill_from_owner_id });
        setRoot(res || null);
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load genealogy");
      setRoot(null);
    } finally {
      setLoading(false);
    }
  }, [entriesMode, maxDepth, pool]);

  useEffect(() => {
    // Initial load (only when we have a concrete entry root in entries mode)
    if (entriesMode) {
      const sid = entryRootId || null;
      if (sid) {
        fetchRoot({ start_entry_id: sid });
      }
    } else {
      fetchRoot({ root_user_id: null });
    }
  }, [entriesMode, entryRootId, fetchRoot]);

  // Re-fetch when pool changes (stay at current root if any)
  useEffect(() => {
    if (!root) return;
    // Re-fetch same root when pool changes
    if (entriesMode) {
      fetchRoot({ start_entry_id: root?.id || null });
    } else {
      fetchRoot({ root_user_id: root?.id || null, spill_from_owner_id: null });
    }
  }, [pool, entriesMode, fetchRoot]);

  // Optional polling when enabled via prop (disabled by default)
  useEffect(() => {
    if (!entriesMode) return;
    const sid = entryRootId || null;
    if (!sid) return;
    const interval = Number(pollIntervalMs || 0);
    if (!Number.isFinite(interval) || interval <= 0) return;
    const h = setInterval(() => {
      fetchRoot({ start_entry_id: sid });
    }, interval);
    return () => clearInterval(h);
  }, [entriesMode, entryRootId, pollIntervalMs, fetchRoot]);

  const children = useMemo(() => {
    const arr = Array.isArray(root?.children) ? [...root.children] : [];
    // Stable order: matrix_position, then id
    arr.sort((a, b) => {
      const pa = (a && typeof a.matrix_position === "number") ? a.matrix_position : 999999;
      const pb = (b && typeof b.matrix_position === "number") ? b.matrix_position : 999999;
      if (pa !== pb) return pa - pb;
      const ia = (a && typeof a.id === "number") ? a.id : 0;
      const ib = (b && typeof b.id === "number") ? b.id : 0;
      return ia - ib;
    });
    return arr.slice(0, maxChildren);
  }, [root, maxChildren]);

  const placeholders = useMemo(
    () => (showPlaceholders ? Math.max(0, maxChildren - children.length) : 0),
    [showPlaceholders, maxChildren, children.length]
  );

  const crumbClick = async (idx) => {
    if (idx == null || idx < 0 || idx >= crumbs.length) return;
    const target = crumbs[idx];
    const newTrail = crumbs.slice(0, idx);
    setCrumbs(newTrail);
    if (entriesMode) {
      await fetchRoot({ start_entry_id: target.id });
    } else {
      await fetchRoot({ root_user_id: target.id });
    }
  };

  const goBackOne = async () => {
    if (crumbs.length === 0) return;
    await crumbClick(crumbs.length - 1);
  };

  const drillDown = async (child) => {
    if (!child) return;
    if (root) {
      setCrumbs((prev) => [...prev, { id: root.id, username: root.username, full_name: root.full_name, username_key: root.username_key }]);
    }
    if (entriesMode) {
      await fetchRoot({ start_entry_id: child.id });
    } else {
      await fetchRoot({ root_user_id: child.id, spill_from_owner_id: root?.id || null });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>{title}</div>

      <div style={styles.topBar}>
        {/* Breadcrumbs */}
        <div style={styles.breadcrumb}>
          {crumbs.map((c, idx) => (
            <React.Fragment key={Number.isFinite(c.id) ? `u:${c.id}` : `${idx}`}>
              <span style={styles.crumbLink} onClick={() => crumbClick(idx)}>
                {(displayName(c) || displayTR(c) || "").toUpperCase()}
              </span>
              <span style={styles.crumbSep}>→</span>
            </React.Fragment>
          ))}
          {root ? (
            <span style={{ fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
              {(displayName(root) || displayTR(root) || "").toUpperCase()}
            </span>
          ) : null}
        </div>

        {/* Pool selector + Back */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {crumbs.length > 0 ? (
            <button onClick={goBackOne} style={styles.backBtn}>Back</button>
          ) : null}
          <select value={pool} onChange={(e) => setPool(e.target.value)} style={styles.sel}>
            <option value="FIVE_150">5-Matrix</option>
            <option value="THREE_150">3-Matrix</option>
          </select>
        </div>
      </div>

      {err ? <div style={{ color: "#dc2626", textAlign: "center", marginBottom: 8 }}>{err}</div> : null}
      {loading && !root ? <div style={{ color: "#64748b", textAlign: "center" }}>Loading...</div> : null}

      {!root ? (
        <div style={{ color: "#64748b", textAlign: "center" }}>No genealogy to display.</div>
      ) : (
        <div>
          {/* Root */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <div style={styles.card}>
              <AvatarIcon size={56} />
              <div style={styles.cardName}>{displayName(root) || ""}</div>
              <div style={styles.cardTR}>TR Username: {displayTR(root) || ""}</div>
              <div style={{ color: root?.account_active ? "#16a34a" : "#dc2626", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                {root?.account_active ? "Active" : "Inactive"}
              </div>
              <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>Pincode: {root?.pincode || "-"}</div>
              <div style={styles.cardTeam}>Team: {typeof root.team_count === "number" ? root.team_count : ""}</div>
            </div>
          </div>

          {/* Row of up to 5 children */}
          {(children.length > 0 || showPlaceholders) ? (
            <>
              <div style={styles.teamLabel}>Team</div>
              <div style={styles.scrollX}>
                <div style={{ ...styles.row, gridTemplateColumns: `repeat(${showPlaceholders ? maxChildren : children.length}, ${cardW}px)` }}>
                  {children.map((c, idx) => (
                    <div key={Number.isFinite(c.id) ? `u:${c.id}` : `u-${idx}`} style={styles.childCard} onClick={() => drillDown(c)}>
                      <AvatarIcon size={48} />
                      <div style={{ ...styles.cardName, fontSize: 14, marginTop: 6 }}>{displayName(c) || ""}</div>
                      <div style={{ ...styles.cardTR, fontSize: 12 }}>TR Username: {displayTR(c) || ""}</div>
                      <div style={{ ...styles.cardTR, fontSize: 12, color: c?.account_active ? "#16a34a" : "#dc2626", fontWeight: 700, marginTop: 2 }}>
                        {c?.account_active ? "Active" : "Inactive"}
                      </div>
                      <div style={{ ...styles.cardTR, fontSize: 12 }}>Pincode: {c?.pincode || "-"}</div>
                      <div style={{ ...styles.cardTeam, fontSize: 13 }}>
                        Team: {typeof c.team_count === "number" ? c.team_count : ""}
                      </div>
                    </div>
                  ))}
                  {showPlaceholders
                    ? Array.from({ length: placeholders }).map((_, idx) => (
                        <div key={`ph-${idx}`} style={styles.placeholder}>
                          <AvatarIcon size={40} />
                          <div style={{ marginTop: 6, fontWeight: 700 }}>Empty</div>
                          <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>No member</div>
                        </div>
                      ))
                    : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
