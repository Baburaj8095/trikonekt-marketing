import React, { useCallback, useEffect, useMemo, useState } from "react";
import API from "../api/api";

/**
 * TreeReferralGalaxy
 *
 * A reusable 5×Matrix tree viewer with:
 * - Header "Geneology"
 * - Breadcrumbs MANJUNATH â†’ SHARANAPPA â†’ ...
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
  maxDepth = 10,
  maxChildren = 5,
  pool = "",
  showPlaceholders = false,
}) {
  const isAdmin = mode === "admin";

  const [root, setRoot] = useState(null);
  const [crumbs, setCrumbs] = useState([]); // Array of { id, username, full_name }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Extra details for self-mode genealogy: phone, pincode, status, role/category, and direct counts
  const [detailsMap, setDetailsMap] = useState(() => new Map());
  const [directMap, setDirectMap] = useState(() => new Map());

  const putDetails = useCallback((id, d) => {
    setDetailsMap((prev) => {
      const next = new Map(prev);
      next.set(id, d || {});
      return next;
    });
  }, []);

  const putDirect = useCallback((id, v) => {
    setDirectMap((prev) => {
      const next = new Map(prev);
      next.set(id, typeof v === "number" ? v : 0);
      return next;
    });
  }, []);

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

  // Normalize matrix-tree node shape to user-centric shape:
  // - id = owner_id (user id)
  // - matrix_account_id = account_id
  // - matrix_position = position
  const normalizeMatrixNode = useCallback(function map(node) {
    if (!node || typeof node !== "object") return node;
    const children = Array.isArray(node.children) ? node.children.map(map) : [];
    const ownerId = Number.isFinite(node.owner_id) ? node.owner_id : node.id;
    const out = {
      id: ownerId,
      username: node.username || "",
      full_name: node.full_name || "",
      matrix_account_id: Number.isFinite(node.account_id) ? node.account_id : (Number.isFinite(node.matrix_account_id) ? node.matrix_account_id : null),
      matrix_position: Number.isFinite(node.position) ? node.position : (Number.isFinite(node.matrix_position) ? node.matrix_position : undefined),
      status: node.status,
      team_count: (typeof node.team_count === "number" ? node.team_count : undefined),
      children,
    };
    return out;
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
            params: { root_user_id: userId, max_depth: maxDepth },
            cacheTTL: 5000,
            retryAttempts: 2,
          });
        } else {
          // Matrix-based (parent/children)
          const mxParams = { root_user_id: userId, max_depth: maxDepth, source: "matrix" };
          if (pool) mxParams.pool = pool;
          res = await API.get("/admin/matrix/tree5/", {
            params: mxParams,
            cacheTTL: 5000,
            retryAttempts: 2,
          });
        }
      } else {
        // Authenticated sponsor subtree; server validates root is within my sponsor downline (or self)
        res = await API.get("/accounts/sponsor/tree/", {
          params: { root_user_id: userId, max_depth: maxDepth },
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

  // Fetch details for current root and its first 5 children (self mode only)
  const loadSelfAndChildrenDetails = useCallback(async (node) => {
    if (!node || isAdmin) return;
    const rootId = node.id;
    try {
      // Root details from /accounts/me/
      try {
        const meRes = await API.get("/accounts/me/", { cacheTTL: 5000, retryAttempts: 2 });
        const me = meRes?.data || {};
        putDetails(rootId, {
          phone: me.phone,
          pincode: me.pincode,
          account_active: me.account_active,
          role: me.role,
          category: me.category,
        });
      } catch (e) {
        // ignore
      }

      // Direct children list by registered_by=rootId (public fields include phone/pincode/status)
      try {
        const listRes = await API.get("/accounts/users/", {
          params: { registered_by: rootId },
          cacheTTL: 5000,
          retryAttempts: 2,
        });
        const arr = Array.isArray(listRes?.data?.results)
          ? listRes.data.results
          : (Array.isArray(listRes?.data) ? listRes.data : []);
        if (Array.isArray(arr)) {
          putDirect(rootId, arr.length);
          for (const u of arr) {
            putDetails(u.id, {
              phone: u.phone,
              pincode: u.pincode,
              account_active: u.account_active,
              role: u.role,
              category: u.category,
            });
          }
        }

        // For visible children, fetch their direct counts (registered_by=child.id)
        const kids = Array.isArray(node.children) ? node.children.slice(0, maxChildren) : [];
        await Promise.all(
          kids.map(async (k) => {
            try {
              const lr = await API.get("/accounts/users/", {
                params: { registered_by: k.id },
                cacheTTL: 5000,
                retryAttempts: 2,
              });
              const a = Array.isArray(lr?.data?.results)
                ? lr.data.results
                : (Array.isArray(lr?.data) ? lr.data : []);
              putDirect(k.id, Array.isArray(a) ? a.length : 0);
            } catch {
              // ignore
            }
          })
        );
      } catch (e) {
        // ignore
      }
    } catch {
      // ignore
    }
  }, [isAdmin, putDetails, putDirect, maxChildren]);

  const fetchRoot = useCallback(async ({ identifier, userId, startEntryId, depth = 6 }) => {
    setLoading(true);
    setErr("");
    try {
      let resNode = null;
      let source = "matrix";

      if (isAdmin) {
        // Try matrix tree first
        const paramsMx = { max_depth: depth, source: preferredSource };
        if (pool) paramsMx.pool = pool;
        let usedId = userId;
        let ident = identifier;

        if (ident) ident = sanitizeIdentifier(ident);

        if (Number.isFinite(startEntryId) && startEntryId > 0) {
          paramsMx.start_entry_id = startEntryId;
        } else if (usedId) {
          paramsMx.root_user_id = usedId;
        } else if (ident) {
          paramsMx.identifier = ident;
        } else {
          throw new Error("identifier or userId or startEntryId required for admin mode");
        }

        const r1 = await API.get("/admin/matrix/tree5/", { params: paramsMx, cacheTTL: 5000, retryAttempts: 2 });
        let node1 = r1?.data || null;
        if (node1) {
          node1 = normalizeMatrixNode(node1);
        }

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
          const kids = Array.isArray(resNode.children) ? resNode.children.slice(0, maxChildren) : [];
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
      // Enrich with status/phone/pincode/direct counts in self-mode
      try { await loadSelfAndChildrenDetails(resNode); } catch {}
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load tree");
      setRoot(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, onUserChange, sanitizeIdentifier, preferredSource, pool, maxDepth, maxChildren, putCount, countNodes, loadSelfAndChildrenDetails]);

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      if (initialUserId || initialIdentifier) {
        fetchRoot({ userId: initialUserId, identifier: initialIdentifier, depth: maxDepth });
      } else {
        (async () => {
          try {
            const r = await API.get("/admin/users/tree/default-root/", { cacheTTL: 60000, retryAttempts: 2 });
            const rid = r?.data?.id;
            if (rid) {
              await fetchRoot({ userId: rid, depth: maxDepth });
            }
          } catch (e) {
            // best-effort: leave root null and show search bar
          }
        })();
      }
    } else {
      fetchRoot({ depth: maxDepth });
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
      setRoot((prev) => (prev ? { ...prev, children: [] } : prev));
      const clean = sanitizeIdentifier(raw);
      await fetchRoot({ identifier: clean, depth: maxDepth });
    } finally {
      setSearchBusy(false);
    }
  };

  const drillDown = async (child) => {
    if (!child) return;
    // reset current team/grid to avoid mixing nodes from previous view
    setRoot((prev) => (prev ? { ...prev, children: [] } : prev));
    if (root) {
      setCrumbs((prev) => [...prev, { id: root.id, username: root.username, full_name: root.full_name, matrix_account_id: root.matrix_account_id }]);
    }
    if (sourceType === "matrix" && Number.isFinite(child.matrix_account_id) && child.matrix_account_id > 0) {
      await fetchRoot({ startEntryId: child.matrix_account_id, depth: maxDepth });
    } else if (Number.isFinite(child.id)) {
      await fetchRoot({ userId: child.id, depth: maxDepth });
    }
  };

  const crumbClick = async (idx) => {
    // idx into crumbs array; clicking crumb i makes it the new root
    if (idx == null || idx < 0 || idx >= crumbs.length) return;
    const target = crumbs[idx];
    const newTrail = crumbs.slice(0, idx); // ancestors up to before the target
    setCrumbs(newTrail);
    setRoot((prev) => (prev ? { ...prev, children: [] } : prev));
    if (sourceType === "matrix" && Number.isFinite(target.matrix_account_id) && target.matrix_account_id > 0) {
      await fetchRoot({ startEntryId: target.matrix_account_id, depth: maxDepth });
    } else {
      await fetchRoot({ userId: target.id, depth: maxDepth });
    }
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
  const displayNameEntry = (u) => {
    const base = displayName(u) || "";
    if (sourceType === "matrix" && Number.isFinite(u?.matrix_account_id) && u.matrix_account_id > 0) {
      return `${base} (Entry #${u.matrix_account_id})`;
    }
    return base;
  };

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
    row: { display: "grid", gridTemplateColumns: `repeat(${maxChildren}, ${cardW}px)`, gap, width: "max-content" },
    childCard: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)", padding: isMobile ? 12 : 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", cursor: "pointer", width: cardW },
    placeholder: { background: "#fff", borderRadius: 16, padding: isMobile ? 12 : 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", border: "2px dashed #e2e8f0", color: "#94a3b8", width: cardW },
    subtle: { color: "#64748b", fontSize: 12 },
    search: { display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 8, flexWrap: "wrap" },
    input: { padding: "10px 12px", minWidth: isMobile ? 220 : 320, borderRadius: 8, border: "1px solid #e2e8f0", outline: "none", background: "#fff" },
    button: { padding: "10px 12px", background: "#0f172a", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer" },
    backBtn: { padding: "8px 10px", background: "#334155", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 12 },
    topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 },
  }), [isMobile, cardW, gap, maxChildren]);

  // Compute up to maxChildren children and placeholders (stable order by matrix_position, then id)
  const children = useMemo(() => {
    const arr = Array.isArray(root?.children) ? [...root.children] : [];
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

  // Control placeholders and filter out malformed children (prevents a blank card)
  const effectiveShowPlaceholders = useMemo(() => {
    if (showPlaceholders) return true;
    // Auto-enable placeholders for admin 5-matrix view to visualize empty slots at Level-1
    if (isAdmin && sourceType === "matrix" && (pool === "FIVE_150" || maxChildren === 5)) return true;
    return false;
  }, [showPlaceholders, isAdmin, sourceType, pool, maxChildren]);
  const placeholders = useMemo(() => (effectiveShowPlaceholders ? Math.max(0, maxChildren - children.length) : 0), [effectiveShowPlaceholders, maxChildren, children.length]);
  const renderedChildren = useMemo(
    () =>
      children.filter(
        (c) =>
          c &&
          (Number.isFinite(c.id) ||
            (typeof c.username === "string" && c.username.trim().length > 0) ||
            (typeof c.full_name === "string" && c.full_name.trim().length > 0))
      ),
    [children]
  );

  // Helpers to read details/direct counts
  const dFor = useCallback((id) => detailsMap.get(id) || {}, [detailsMap]);
  const directOf = useCallback((id) => directMap.get(id), [directMap]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>Genealogy</div>

      {/* Breadcrumbs and optional admin search bar */}
      <div style={styles.bar}>
        <div style={styles.breadcrumb}>
          {crumbs.map((c, idx) => (
            <React.Fragment key={(sourceType === "matrix" && Number.isFinite(c.matrix_account_id) && c.matrix_account_id > 0) ? `acc:${c.matrix_account_id}` : (Number.isFinite(c.id) ? `u:${c.id}` : c.id)}>
              <span style={styles.crumbLink} onClick={() => crumbClick(idx)}>
                {(displayNameEntry(c) || "").toUpperCase() || (displayTR(c) || "").toUpperCase()}
              </span>
              <span style={styles.crumbSep}>→</span>
            </React.Fragment>
          ))}
          {root ? (
            <span style={{ fontWeight: 800, color: "#0f172a", textTransform: "uppercase" }}>
              {(displayNameEntry(root) || "").toUpperCase() || (displayTR(root) || "").toUpperCase()}
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
              <div style={styles.cardName}>{displayNameEntry(root) || ""}</div>
              <div style={styles.cardTR}>TR Username: {displayTR(root) || ""}</div>
              {typeof dFor(root.id).account_active === "boolean" ? (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: dFor(root.id).account_active ? "#16a34a" : "#64748b" }}>
                    {dFor(root.id).account_active ? "Active" : "Inactive"}
                  </span>
                </div>
              ) : null}
              {dFor(root.id).phone ? (
                <div style={styles.cardTR}>Phone: {dFor(root.id).phone}</div>
              ) : null}
              {dFor(root.id).pincode ? (
                <div style={styles.cardTR}>Pincode: {dFor(root.id).pincode}</div>
              ) : null}
              <div style={styles.cardTeam}>Direct: {directOf(root.id) ?? ""}</div>
              <div style={styles.cardTeam}>Team: {sourceType === "matrix" && typeof root.team_count === "number" ? root.team_count : (getCountValue(root.id) ?? "")}</div>
            </div>
          </div>

          {/* Team row */}
          {(renderedChildren.length > 0 || effectiveShowPlaceholders) ? (
            <>
              <div style={styles.teamLabel}>Team</div>
              <div style={styles.scrollX}>
                <div style={{ ...styles.row, gridTemplateColumns: `repeat(${effectiveShowPlaceholders ? maxChildren : renderedChildren.length}, ${cardW}px)` }}>
                  {renderedChildren.map((c, idx) => (
                    <div key={(sourceType === "matrix" && Number.isFinite(c.matrix_account_id) && c.matrix_account_id > 0) ? `acc:${c.matrix_account_id}` : (Number.isFinite(c.id) ? `u:${c.id}` : `u-${idx}`)} style={styles.childCard} onClick={() => drillDown(c)}>
                      <AvatarIcon size={childAvatar} />
                      <div style={{ ...styles.cardName, fontSize: 14, marginTop: 6 }}>{displayNameEntry(c) || ""}</div>
                      <div style={{ ...styles.cardTR, fontSize: 12 }}>TR Username: {displayTR(c) || ""}</div>
                      {typeof dFor(c.id).account_active === "boolean" ? (
                        <div style={{ ...styles.subtle, marginTop: 4, color: dFor(c.id).account_active ? "#16a34a" : "#64748b", fontWeight: 700 }}>
                          {dFor(c.id).account_active ? "Active" : "Inactive"}
                        </div>
                      ) : null}
                      {dFor(c.id).phone ? (
                        <div style={{ ...styles.cardTR, fontSize: 12 }}>Phone: {dFor(c.id).phone}</div>
                      ) : null}
                      {dFor(c.id).pincode ? (
                        <div style={{ ...styles.cardTR, fontSize: 12 }}>Pincode: {dFor(c.id).pincode}</div>
                      ) : null}
                      <div style={{ ...styles.cardTeam, fontSize: 13 }}>Direct: {directOf(c.id) ?? ""}</div>
                      <div style={{ ...styles.cardTeam, fontSize: 13 }}>Team: {sourceType === "matrix" && typeof c.team_count === "number" ? c.team_count : (getCountValue(c.id) ?? "")}</div>
                    </div>
                  ))}
                  {effectiveShowPlaceholders
                    ? Array.from({ length: placeholders }).map((_, idx) => (
                        <div key={`ph-${idx}`} style={styles.placeholder}>
                          <AvatarIcon size={Math.max(32, childAvatar - 8)} />
                          <div style={{ marginTop: 6, fontWeight: 700 }}>Empty</div>
                          <div style={{ ...styles.subtle, marginTop: 2 }}>No member</div>
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
