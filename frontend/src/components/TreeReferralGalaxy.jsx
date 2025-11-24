import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../api/api";

/**
 * TreeReferralGalaxy
 *
 * A reusable 5×Matrix tree viewer with:
 * - Header "Geneology"
 * - Breadcrumbs MANJUNATH → SHARANAPPA → ...
 * - Parent card (top)
 * - "Team" label
 * - Single row of up to 5 child cards
 * - Click a child to drill down (loads subtree)
 *
 * Props:
 * - mode: "admin" | "self"
 * - initialIdentifier?: string (admin only)
 * - initialUserId?: number (admin only)
 * - onUserChange?: (userNode) => void
 * - fetchTeamCount?: (userId) => Promise<number> (optional; if omitted, client fetches depth=6 and counts)
 *
 * Data shape expected from server for root with max_depth=2:
 * { id, username, full_name, children: Array<node> }
 */
export default function TreeReferralGalaxy({
  mode = "self",
  initialIdentifier = "",
  initialUserId = null,
  onUserChange,
  fetchTeamCount,
  preferredSource = "auto",
}) {
  const isAdmin = mode === "admin";

  const [root, setRoot] = useState(null);
  const [crumbs, setCrumbs] = useState([]); // Array of { id, username, full_name }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Admin search
  const [searchIdent, setSearchIdent] = useState(initialIdentifier || "");
  const [searchBusy, setSearchBusy] = useState(false);

  // "matrix" or "sponsor" (for admin fallback)
  const [sourceType, setSourceType] = useState("matrix");

  // Cached team counts to avoid refetch (keyed by source+userId)
  const [countsMap, setCountsMap] = useState(() => new Map());

  const keyFor = useCallback((src, id) => `${src}:${id}`, []);
  const getCountValue = useCallback(
    (userId) => countsMap.get(keyFor(sourceType, userId)),
    [countsMap, keyFor, sourceType]
  );

  const titleName = useMemo(() => {
    const n = root?.full_name || "";
    return n ? n.toUpperCase() : (root?.username || "");
  }, [root]);

  const sanitizeIdentifier = useCallback((s) => {
    let x = (s || "").trim();
    // remove bracketed annotations like " [sub franchise]"
    x = x.replace(/\[[^\]]*\]/g, "").trim();
    // if spaces remain, take first token (e.g., "9585102000 extra" -> "9585102000")
    if (x.includes(" ")) x = x.split(/\s+/)[0];
    return x;
  }, []);

  const countNodes = useCallback((node) => {
    if (!node) return 0;
    let c = 1;
    const kids = Array.isArray(node.children) ? node.children : [];
    for (const k of kids) c += countNodes(k);
    return c;
  }, []);

  const putCount = useCallback((src, id, value) => {
    setCountsMap((prev) => {
      const next = new Map(prev);
      next.set(keyFor(src, id), value);
      return next;
    });
  }, [keyFor]);

  const getTeamCount = useCallback(async (userId, src = "matrix") => {
    if (!userId) return 0;

    // custom override
    if (typeof fetchTeamCount === "function") {
      try {
        const v = await fetchTeamCount(userId);
        putCount(src, userId, v);
        return v;
      } catch {
        // ignore and continue to default
      }
    }

    const cached = countsMap.get(keyFor(src, userId));
    if (typeof cached === "number") return cached;

    try {
      let res;
      if (isAdmin) {
        if (src === "sponsor") {
          // Sponsor-based registered_by tree for admin
          res = await API.get("/admin/matrix/tree/", {
            params: { root_user_id: userId, max_depth: 6 },
            cacheTTL: 5000,
            retryAttempts: 2,
          });
        } else {
          // Matrix-based (parent/children)
          res = await API.get("/admin/matrix/tree5/", {
            params: { root_user_id: userId, max_depth: 6 },
            cacheTTL: 5000,
            retryAttempts: 2,
          });
        }
      } else {
        // Authenticated sponsor subtree; server validates root is within my sponsor downline (or self)
        res = await API.get("/accounts/sponsor/tree/", {
          params: { root_user_id: userId, max_depth: 6 },
          cacheTTL: 5000,
          retryAttempts: 2,
        });
      }
      const total = countNodes(res?.data || null);
      const team = Math.max(0, (total || 0) - 1);
      putCount(src, userId, team);
      return team;
    } catch {
      // Non-fatal; keep undefined to allow retry on next render
      return 0;
    }
  }, [countsMap, countNodes, fetchTeamCount, isAdmin, keyFor, putCount]);

  const fetchRoot = useCallback(async ({ identifier, userId, depth = 6 }) => {
    setLoading(true);
    setErr("");
    try {
      let resNode = null;
      let source = "matrix";

      if (isAdmin) {
        // Try matrix tree first
        const paramsMx = { max_depth: depth, source: preferredSource };
        let usedId = userId;
        let ident = identifier;

        if (ident) ident = sanitizeIdentifier(ident);

        if (usedId) {
          paramsMx.root_user_id = usedId;
        } else if (ident) {
          paramsMx.identifier = ident;
        } else {
          throw new Error("identifier or userId required for admin mode");
        }

        const r1 = await API.get("/admin/matrix/tree5/", { params: paramsMx, cacheTTL: 5000, retryAttempts: 2 });
        const node1 = r1?.data || null;

        // Respect preferredSource: if 'matrix', do not fallback to sponsor even if empty
        const requestedSrc = (preferredSource || "auto").toLowerCase();
        if (requestedSrc === "matrix") {
          resNode = node1;
          source = "matrix";
        } else if (node1 && Array.isArray(node1.children) && node1.children.length > 0) {
          // node1 came from /admin/matrix/tree5 with source=requestedSrc
          resNode = node1;
          source = requestedSrc === "sponsor" ? "sponsor" : "matrix";
        } else {
          // Fallback to sponsor-based tree: requires root id
          let rid = usedId;
          if (!rid) {
            rid = node1?.id || null;
            // If even that failed (e.g., identifier not resolved), try resolving via admin root
            if (!rid && ident) {
              try {
                const rr = await API.get("/admin/users/tree/root/", { params: { identifier: ident }, cacheTTL: 10000, retryAttempts: 2 });
                rid = rr?.data?.id || null;
              } catch {
                // ignore
              }
            }
          }
          if (rid) {
            try {
              const r2 = await API.get("/admin/matrix/tree/", { params: { root_user_id: rid, max_depth: depth }, cacheTTL: 5000, retryAttempts: 2 });
              const node2 = r2?.data || null;
              if (node2 && Array.isArray(node2.children) && node2.children.length >= 0) {
                resNode = node2;
                source = "sponsor";
              } else {
                // fallback failed, keep matrix node if exists
                resNode = node1;
                source = "matrix";
              }
            } catch {
              // keep matrix node if any
              resNode = node1;
              source = "matrix";
            }
          } else {
            // No id resolved, stick with matrix result (possibly null)
            resNode = node1;
            source = "matrix";
          }
        }
      } else {
        // Self mode (sponsor-based)
        if (userId) {
          const r = await API.get("/accounts/sponsor/tree/", {
            params: { root_user_id: userId, max_depth: depth },
            cacheTTL: 5000,
            retryAttempts: 2,
          });
          resNode = r?.data || null;
          source = "sponsor";
        } else {
          const r = await API.get("/accounts/my/sponsor/tree/", { params: { max_depth: depth }, cacheTTL: 5000, retryAttempts: 2 });
          resNode = r?.data || null;
          source = "sponsor";
        }
      }

      // Precompute team counts locally from fetched tree (root + first 5 children)
      try {
        if (resNode && resNode.id) {
          const kids = Array.isArray(resNode.children) ? resNode.children.slice(0, 5) : [];
          putCount(source, resNode.id, Math.max(0, countNodes(resNode) - 1));
          for (const k of kids) {
            putCount(source, k.id, Math.max(0, countNodes(k) - 1));
          }
        }
      } catch (_) {}

      setRoot(resNode);
      setSourceType(source);
      if (typeof onUserChange === "function") {
        try { onUserChange(resNode); } catch {}
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load tree");
      setRoot(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, onUserChange, sanitizeIdentifier]);

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      if (initialUserId || initialIdentifier) {
        fetchRoot({ userId: initialUserId, identifier: initialIdentifier, depth: 6 });
      } else {
        (async () => {
          try {
            const r = await API.get("/admin/users/tree/default-root/", { cacheTTL: 60000, retryAttempts: 2 });
            const rid = r?.data?.id;
            if (rid) {
              await fetchRoot({ userId: rid, depth: 6 });
            }
          } catch (e) {
            // best-effort: leave root null and show search bar
          }
        })();
      }
    } else {
      fetchRoot({ depth: 6 });
    }
    // eslint-disable-next-line
  }, []);


  const onSearch = async () => {
    if (!isAdmin) return;
    const raw = (searchIdent || "").trim();
    if (!raw) {
      setErr("Enter sponsor_id / username / phone / email / unique_id / id");
      return;
    }
    try {
      setSearchBusy(true);
      setCrumbs([]);
      const clean = sanitizeIdentifier(raw);
      await fetchRoot({ identifier: clean, depth: 6 });
    } finally {
      setSearchBusy(false);
    }
  };

  const drillDown = async (child) => {
    if (!child || !child.id) return;
    if (root) {
      setCrumbs((prev) => [...prev, { id: root.id, username: root.username, full_name: root.full_name }]);
    }
    await fetchRoot({ userId: child.id, depth: 6 });
  };

  const crumbClick = async (idx) => {
    // idx into crumbs array; clicking crumb i makes it the new root
    if (idx == null || idx < 0 || idx >= crumbs.length) return;
    const target = crumbs[idx];
    const newTrail = crumbs.slice(0, idx); // ancestors up to before the target
    setCrumbs(newTrail);
    await fetchRoot({ userId: target.id, depth: 6 });
  };

  const goBackOne = async () => {
    if (crumbs.length === 0) return;
    await crumbClick(crumbs.length - 1);
  };

  // UI helpers
  const maskTRUsername = (username) => {
    if (typeof username !== "string") return username;
    const match = username.match(/^(TR)(\d+)(.*)$/i);
    if (!match) return username;
    const prefix = match[1];
    const digits = match[2];
    const suffix = match[3] || "";
    const firstMask = Math.min(2, digits.length);
    const lastMask = Math.min(2, Math.max(0, digits.length - firstMask));
    const middle = digits.slice(firstMask, digits.length - lastMask);
    return `${prefix}${"X".repeat(firstMask)}${middle}${"x".repeat(lastMask)}${suffix}`;
  };
  const displayName = (u) => (u?.full_name || u?.username || "").toString();
  const displayTR = (u) => maskTRUsername((u?.username || "").toString());

  const AvatarIcon = ({ size = 56 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="32" fill="#E5E7EB"/>
      <circle cx="32" cy="24" r="10" fill="#9CA3AF"/>
      <path d="M16 50c3-8 10-12 16-12s13 4 16 12" fill="#9CA3AF"/>
    </svg>
  );

  // Responsive styles (inline to keep component self-contained)
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const isMobile = vw <= 600;
  const cardW = isMobile ? 140 : 160;
  const gap = isMobile ? 8 : 12;
  const rootAvatar = isMobile ? 48 : 56;
  const childAvatar = isMobile ? 40 : 48;

  const styles = useMemo(() => ({
    container: { background: "transparent" },
    header: { textAlign: "center", fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#0f172a", marginBottom: 12 },
    bar: { display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 10, flexWrap: "wrap" },
    breadcrumb: { display: "flex", gap: 6, alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: isMobile ? 11 : 12, flexWrap: "wrap" },
    crumbLink: { color: "#0f172a", cursor: "pointer", fontWeight: 700, textTransform: "uppercase" },
    crumbSep: { color: "#94a3b8", fontWeight: 700 },
    card: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: cardW, width: cardW },
    cardName: { fontWeight: 800, color: "#0f172a", marginTop: 8, fontSize: isMobile ? 14 : 16 },
    cardTR: { color: "#334155", fontSize: isMobile ? 12 : 13, marginTop: 4 },
    cardTeam: { color: "#0f172a", fontWeight: 700, fontSize: isMobile ? 13 : 14, marginTop: 6 },
    teamLabel: { marginTop: 16, marginBottom: 8, color: "#334155", fontWeight: 700, textAlign: "left" },
    scrollX: { overflowX: "auto", WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", paddingBottom: 8 },
    row5: { display: "grid", gridTemplateColumns: `repeat(5, ${cardW}px)`, gap, width: "max-content" },
    childCard: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)", padding: isMobile ? 12 : 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", cursor: "pointer", width: cardW },
    placeholder: { background: "#fff", borderRadius: 16, padding: isMobile ? 12 : 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", border: "2px dashed #e2e8f0", color: "#94a3b8", width: cardW },
    subtle: { color: "#64748b", fontSize: 12 },
    search: { display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 8, flexWrap: "wrap" },
    input: { padding: "10px 12px", minWidth: isMobile ? 220 : 320, borderRadius: 8, border: "1px solid #e2e8f0", outline: "none", background: "#fff" },
    button: { padding: "10px 12px", background: "#0f172a", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer" },
    backBtn: { padding: "8px 10px", background: "#334155", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 12 },
    topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 },
  }), [isMobile, cardW, gap]);

  // Compute up to 5 children and placeholders
  const children = useMemo(() => Array.isArray(root?.children) ? root.children.slice(0, 5) : [], [root]);
  const placeholders = Math.max(0, 5 - children.length);

  return (
    <div style={styles.container}>
      <div style={styles.header}>Genealogy</div>

      {/* Breadcrumbs and optional admin search bar */}
      <div style={styles.bar}>
        <div style={styles.breadcrumb}>
          {crumbs.map((c, idx) => (
            <React.Fragment key={c.id}>
              <span style={styles.crumbLink} onClick={() => crumbClick(idx)}>
                {(displayName(c) || "").toUpperCase() || (displayTR(c) || "").toUpperCase()}
              </span>
              <span style={styles.crumbSep}>→</span>
            </React.Fragment>
          ))}
          {root ? (
            <span style={{ fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
              {(displayName(root) || "").toUpperCase() || (displayTR(root) || "").toUpperCase()}
            </span>
          ) : null}
        </div>

        {isAdmin ? (
          <div style={styles.search}>
            <input
              value={searchIdent}
              onChange={(e) => setSearchIdent(e.target.value)}
              placeholder="Enter user id / username / sponsor_id / phone / email / unique_id"
              style={styles.input}
            />
            <button onClick={onSearch} disabled={searchBusy} style={styles.button}>
              {searchBusy ? "Loading..." : "Load"}
            </button>
            {crumbs.length > 0 ? (
              <button onClick={goBackOne} style={styles.backBtn}>Back</button>
            ) : null}
          </div>
        ) : (
          <div>
            {crumbs.length > 0 ? (
              <button onClick={goBackOne} style={styles.backBtn}>Back</button>
            ) : null}
          </div>
        )}
      </div>

      {err ? <div style={{ color: "#dc2626", textAlign: "center", marginBottom: 8 }}>{err}</div> : null}
      {loading && !root ? (
        <div style={{ color: "#64748b", textAlign: "center" }}>Loading...</div>
      ) : null}

      {!root ? (
        <div style={{ color: "#64748b", textAlign: "center" }}>
          {isAdmin ? "Search to load a user hierarchy." : "No hierarchy to display."}
        </div>
      ) : (
        <div>
          {/* Parent card */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
            <div style={styles.card}>
              <AvatarIcon size={rootAvatar} />
              <div style={styles.cardName}>{displayName(root) || "—"}</div>
              <div style={styles.cardTR}>TR Username: {displayTR(root) || "—"}</div>
              <div style={styles.cardTeam}>Team: {getCountValue(root.id) ?? "—"}</div>
            </div>
          </div>

          {/* Team row */}
          <div style={styles.teamLabel}>Team</div>
          <div style={styles.scrollX}>
            <div style={styles.row5}>
            {children.map((c) => (
              <div key={c.id} style={styles.childCard} onClick={() => drillDown(c)}>
                <AvatarIcon size={childAvatar} />
                <div style={{ ...styles.cardName, fontSize: 14, marginTop: 6 }}>{displayName(c) || "—"}</div>
                <div style={{ ...styles.cardTR, fontSize: 12 }}>TR Username: {displayTR(c) || "—"}</div>
                <div style={{ ...styles.cardTeam, fontSize: 13 }}>Team: {getCountValue(c.id) ?? "—"}</div>
              </div>
            ))}
            {Array.from({ length: placeholders }).map((_, idx) => (
              <div key={`ph-${idx}`} style={styles.placeholder}>
                <AvatarIcon size={Math.max(32, childAvatar - 8)} />
                <div style={{ marginTop: 6, fontWeight: 700 }}>Empty</div>
                <div style={{ ...styles.subtle, marginTop: 2 }}>No member</div>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
