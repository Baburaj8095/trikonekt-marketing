/**
 * InteractiveTree.jsx  –  5-Block and 3-Block Matrix Genealogy SVG Tree
 *
 * Features:
 * ✓ Multi-Layer visual tree with branch connections linking parent to children
 * ✓ Separated Direct Sponsor Headcount ("Who sponsored whom") vs. Layer Total Team Count
 * ✓ Layer terminology standard across all node titles, badges, and tooltips
 * ✓ Admin and Consumer mode support with dynamic search & BFS drilldown
 * ✓ Fixed slot structure (5 branches for 5-Block, 3 branches for 3-Block)
 * ✓ Lazy-load branch expansion on tap + pan/zoom/pinch controls
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import API from "../../api/api";
import { getMyGenealogyTree5 } from "../../api/genealogy";

// ─── Design tokens ────────────────────────────────────────────────────────────
const PRI   = "#4f46e5";
const PRI_L = "#ede9fe";
const OK    = "#059669";
const WARN  = "#dc2626";
const GRAY  = "#9ca3af";
const TXT   = "#0f172a";
const SUB   = "#64748b";
const BOR   = "#cbd5e1";
const WHITE = "#ffffff";
const BG    = "#f8fafc";
const EMPTY = "#f1f5f9";

// ─── Geometry ─────────────────────────────────────────────────────────────────
const NR   = 30;          // node circle radius
const ND   = NR * 2;      // node circle diameter
const HGAP = 24;          // horizontal gap between siblings
const VGAP = 135;         // vertical gap between layers
const LBH  = 26;          // label area offset below circle
const NODE_TOTAL_H = ND + 90; // total vertical bounding box per node

// ─── CSS keyframes (injected once) ───────────────────────────────────────────
(function injectKF() {
  if (typeof document === "undefined") return;
  if (document.getElementById("__it_kf__")) return;
  const s = document.createElement("style");
  s.id = "__it_kf__";
  s.textContent =
    "@keyframes itSpin{to{transform:rotate(360deg)}}" +
    "@keyframes itPop{0%{opacity:0;transform:scale(.65)}100%{opacity:1;transform:scale(1)}}";
  document.head.appendChild(s);
})();

// ─── Slot count by pool ───────────────────────────────────────────────────────
function maxSlots(pool) {
  const p = String(pool || "").toUpperCase();
  return p.includes("THREE") || p.includes("3") ? 3 : 5;
}

// ─── Direct Sponsor Count Cache & Preloader ────────────────────────────────────
const directCountCache = new Map();
let preloadedPromise = null;

async function preloadDirectCounts() {
  if (preloadedPromise) return preloadedPromise;
  preloadedPromise = (async () => {
    try {
      const res = await API.get("/admin/users/", {
        params: { page_size: 250 },
        cacheTTL: 30000,
      });
      const arr = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : [];

      // Frequency map of direct referrals
      const countMap = new Map();
      arr.forEach((u) => {
        if (u.username) countMap.set(String(u.username).trim().toLowerCase(), 0);
        if (u.id) countMap.set(String(u.id), 0);
        if (u.phone) countMap.set(String(u.phone).trim().toLowerCase(), 0);
        if (u.prefixed_id) countMap.set(String(u.prefixed_id).trim().toLowerCase(), 0);
      });

      arr.forEach((u) => {
        const sid = String(u.sponsor_id || "").trim().toLowerCase();
        const regUser = String(u.registered_by?.username || "").trim().toLowerCase();
        const regPhone = String(u.registered_by?.phone || "").trim().toLowerCase();
        const regPrefixed = String(u.registered_by?.prefixed_id || "").trim().toLowerCase();
        const regId = u.registered_by?.id ? String(u.registered_by.id) : null;

        const counted = new Set();
        [sid, regUser, regPhone, regPrefixed, regId].forEach((token) => {
          if (token && !counted.has(token)) {
            counted.add(token);
            countMap.set(token, (countMap.get(token) || 0) + 1);
          }
        });
      });

      countMap.forEach((cnt, key) => {
        directCountCache.set(key, cnt);
      });
    } catch (_) {}
  })();
  return preloadedPromise;
}

async function fetchDirectSponsorCount(username, ownerId) {
  if (!username && !ownerId) return 0;
  await preloadDirectCounts();

  const uKey = username ? String(username).trim().toLowerCase() : null;
  const oKey = ownerId ? String(ownerId) : null;

  if (uKey && directCountCache.has(uKey)) return directCountCache.get(uKey);
  if (oKey && directCountCache.has(oKey)) return directCountCache.get(oKey);

  return 0;
}

// Recursive descendant counter for layer team
function countDescendants(node) {
  if (!node) return 0;
  let c = 0;
  const kids = Array.isArray(node.children) ? node.children : (Array.isArray(node._kids) ? node._kids : []);
  for (const k of kids) {
    if (k) c += 1 + countDescendants(k);
  }
  return c;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
function normalizeEntry(n) {
  if (!n) return null;
  const kids = Array.isArray(n.children) ? n.children.map(normalizeEntry).filter(Boolean) : [];
  const entryId = Number.isFinite(n.account_id) ? n.account_id : (Number.isFinite(n.id) ? n.id : null);
  const ownerId = Number.isFinite(n.owner_id) ? n.owner_id : (Number.isFinite(n.user_id) ? n.user_id : n.id);
  const descCount = countDescendants({ children: kids });
  const layerTeam = Math.max(Number(n.team_count) || 0, descCount);

  return {
    ...n,
    id:              entryId || ownerId,
    account_id:      entryId,
    owner_id:        ownerId,
    username:        n.username || "",
    full_name:       n.full_name || "",
    account_active:  String(n.status || n.account_active || false).toUpperCase() === "ACTIVE",
    direct_count:    Number(n.direct_count ?? n.direct_sponsor_count) || 0,
    team_count:      layerTeam,
    matrix_position: Number(n.position || n.matrix_position) || 0,
    layer_level:     Number(n.level || n.layer_level) || 0,
    children:        kids,
  };
}

function normalizeRankNode(n) {
  if (!n) return null;
  const kids = Array.isArray(n.children) ? n.children.map(normalizeRankNode) : [];
  const descCount = countDescendants({ children: kids });
  const layerTeam = Math.max(Number(n.team_count) || 0, descCount);

  return {
    ...n,
    id:              n.user_id || n.id,
    account_active:  String(n.status || "ACTIVE").toUpperCase() === "ACTIVE",
    direct_count:    Number(n.direct_count) || 0,
    team_count:      layerTeam,
    matrix_position: Number(n.position || n.matrix_position) || 0,
    children:        kids,
  };
}

async function apiFetchRoot({
  isAdmin = false,
  adminIdentifier = "",
  adminRootUserId = null,
  useEntries = false,
  entryRootId = null,
  pool = "FIVE_750",
  useRankMatrix = false,
  rankStartUserId = null,
  rankRootUserId = null,
}) {
  try {
    if (isAdmin) {
      const params = { pool: pool || "FIVE_750", max_depth: 8, source: "auto" };
      if (entryRootId) params.start_entry_id = entryRootId;
      else if (adminRootUserId) params.root_user_id = adminRootUserId;
      else if (adminIdentifier) params.identifier = adminIdentifier;

      const res = await API.get("/admin/matrix/tree5/", {
        params,
        cacheTTL: 5000,
        retryAttempts: 2,
      });
      const rootData = res?.data;
      if (!rootData) return null;
      const norm = normalizeEntry(rootData);
      if (norm) {
        norm.direct_count = await fetchDirectSponsorCount(norm.username, norm.owner_id);
        if (Array.isArray(norm.children)) {
          await Promise.all(
            norm.children.map(async (k) => {
              if (k) k.direct_count = await fetchDirectSponsorCount(k.username, k.owner_id);
            })
          );
        }
      }
      return norm;
    }

    if (useRankMatrix) {
      const params = { max_depth: 2 };
      if (rankStartUserId) params.start_user_id = rankStartUserId;
      if (rankRootUserId)  params.root_user_id  = rankRootUserId;
      const res = await API.get("/rank-matrix/tree-bfs/", {
        params,
        cacheTTL: 0,
        dedupe: "cancelPrevious",
      });
      return normalizeRankNode(res?.data) || null;
    }

    if (useEntries) {
      if (!entryRootId) return null;
      const entryRes = await API.get("/accounts/my/matrix/tree5/entries/", {
        params: { start_entry_id: entryRootId, max_depth: 2, pool },
        cacheTTL: 0,
        dedupe: "cancelPrevious",
      });
      const entry = entryRes?.data;
      if (!entry) return null;
      const norm = normalizeEntry(entry);
      if (norm) {
        norm.direct_count = await fetchDirectSponsorCount(norm.username, norm.owner_id);
        if (Array.isArray(norm.children)) {
          await Promise.all(
            norm.children.map(async (k) => {
              if (k) k.direct_count = await fetchDirectSponsorCount(k.username, k.owner_id);
            })
          );
        }
      }
      return norm;
    }

    const res = await getMyGenealogyTree5({ max_depth: 2, pool });
    if (res) {
      const norm = normalizeEntry(res);
      if (norm) {
        norm.direct_count = await fetchDirectSponsorCount(norm.username, norm.owner_id);
        if (Array.isArray(norm.children)) {
          await Promise.all(
            norm.children.map(async (k) => {
              if (k) k.direct_count = await fetchDirectSponsorCount(k.username, k.owner_id);
            })
          );
        }
      }
      return norm;
    }
    return null;
  } catch (err) {
    console.error(`[apiFetchRoot] Error:`, err);
    return null;
  }
}

async function apiFetchKids(nodeId, nodeObj, { isAdmin = false, useEntries, pool, useRankMatrix, rankRootUserId }) {
  try {
    if (isAdmin) {
      const params = { pool: pool || "FIVE_150", max_depth: 1, source: "auto" };
      if (nodeObj?.account_id) params.start_entry_id = nodeObj.account_id;
      else if (nodeObj?.owner_id) params.root_user_id = nodeObj.owner_id;
      else params.start_entry_id = nodeId;

      const res = await API.get("/admin/matrix/tree5/", {
        params,
        cacheTTL: 5000,
        retryAttempts: 2,
      });
      const data = res?.data;
      const kids = Array.isArray(data?.children) ? data.children.map(normalizeEntry) : null;
      if (Array.isArray(kids)) {
        await Promise.all(
          kids.map(async (k) => {
            if (k) k.direct_count = await fetchDirectSponsorCount(k.username, k.owner_id);
          })
        );
      }
      return kids;
    }

    if (useRankMatrix) {
      const params = { start_user_id: nodeId, max_depth: 1 };
      if (rankRootUserId) params.root_user_id = rankRootUserId;
      const res = await API.get("/rank-matrix/tree-bfs/", {
        params,
        cacheTTL: 0,
        dedupe: "cancelPrevious",
      });
      const data = res?.data;
      return Array.isArray(data?.children) ? data.children.map(normalizeRankNode) : null;
    }

    if (useEntries) {
      const res = await API.get("/accounts/my/matrix/tree5/entries/", {
        params: { start_entry_id: nodeId, max_depth: 1, pool },
        cacheTTL: 0,
        dedupe: "cancelPrevious",
      });
      const data = res?.data;
      const children = Array.isArray(data?.children) ? data.children.map(normalizeEntry) : null;
      if (Array.isArray(children)) {
        await Promise.all(
          children.map(async (k) => {
            if (k) k.direct_count = await fetchDirectSponsorCount(k.username, k.owner_id);
          })
        );
      }
      return children;
    }

    const res = await getMyGenealogyTree5({ root_user_id: nodeId, max_depth: 1, pool });
    const children = Array.isArray(res?.children) ? res.children.map(normalizeEntry) : null;
    if (Array.isArray(children)) {
      await Promise.all(
        children.map(async (k) => {
          if (k) k.direct_count = await fetchDirectSponsorCount(k.username, k.owner_id);
        })
      );
    }
    return children;
  } catch (err) {
    console.error(`[apiFetchKids] Error for nodeId=${nodeId}:`, err);
    return null;
  }
}

// ─── Build fixed-slot child array (length = maxSlots) ─────────────────────────
function toSlottedArray(kids, slots) {
  const arr = Array(slots).fill(null);
  (kids || []).forEach((k) => {
    const pos = Number(k.matrix_position);
    const idx = Number.isFinite(pos) && pos >= 1 && pos <= slots
      ? pos - 1
      : arr.findIndex((x) => x === null);
    if (idx >= 0 && idx < slots) arr[idx] = k;
  });
  return arr;
}

// ─── Layout: x positions for n siblings centred on cx ─────────────────────────
function slotCentres(cx, n) {
  if (n === 0) return [];
  const total = n * ND + (n - 1) * HGAP;
  const start = cx - total / 2 + NR;
  return Array.from({ length: n }, (_, i) => start + i * (ND + HGAP));
}

// ─── Flatten tree → { nodes, edges } ─────────────────────────────────────────
function flattenTree(node, pid, pCx, pCy, cx, cy, slots, out, layerIndex = 0) {
  if (!node) return;
  const id = String(node.id);

  const hasKids =
    !!node.has_children ||
    Number(node.team_count) > 0 ||
    (Array.isArray(node._kids) && node._kids.some(Boolean));

  out.nodes.push({
    id,
    cx,
    cy,
    username:     node.username || id,
    fullName:     node.full_name || "",
    entryId:      node.account_id || null,
    userId:       String(node.owner_id || node.id) || "",
    isActive:     node.account_active !== false,
    isRoot:       pid === null,
    isExpanded:   !!node._expanded,
    isLoading:    !!node._loading,
    hasKids,
    kidCount:     Number(node.team_count) || 0,
    directCount:  Number(node.direct_count) || 0,
    matrixPos:    Number(node.matrix_position) || 0,
    layerIndex:   layerIndex,
    isEmpty:      false,
    rawNode:      node,
  });

  if (pid !== null) {
    out.edges.push({ id: `e-${pid}-${id}`, x1: pCx, y1: pCy + NR, x2: cx, y2: cy - NR });
  }

  const slotted = node._loading
    ? Array(slots).fill(null)
    : node._expanded && Array.isArray(node._kids)
    ? toSlottedArray(node._kids, slots)
    : null;

  if (!slotted) return;

  const xs = slotCentres(cx, slots);
  const ky = cy + ND + VGAP;

  slotted.forEach((kid, i) => {
    const kx = xs[i];
    if (!kid) {
      const eid = `__empty_${id}_${i}`;
      out.nodes.push({
        id: eid,
        cx: kx,
        cy: ky,
        username: "Empty Slot",
        fullName: "",
        isActive: false,
        isRoot: false,
        isExpanded: false,
        isLoading: node._loading,
        hasKids: false,
        kidCount: 0,
        directCount: 0,
        matrixPos: i + 1,
        layerIndex: layerIndex + 1,
        isEmpty: true,
      });
      out.edges.push({
        id: `ep-${id}-${i}`,
        x1: cx,
        y1: cy + NR,
        x2: kx,
        y2: ky - NR,
        dashed: true,
      });
    } else {
      flattenTree(kid, id, cx, cy, kx, ky, slots, out, layerIndex + 1);
    }
  });
}

// ─── SVG: Single Node ─────────────────────────────────────────────────────────
const SvgNode = React.memo(function SvgNode({ n, onTap, isRoot }) {
  if (n.isEmpty) {
    return (
      <g transform={`translate(${n.cx},${n.cy})`}>
        <circle
          r={NR}
          cx={0}
          cy={0}
          fill={EMPTY}
          stroke={BOR}
          strokeWidth={1.5}
          strokeDasharray="5 3"
        />
        {n.isLoading ? (
          <circle
            r={9}
            cx={0}
            cy={0}
            fill="none"
            stroke={GRAY}
            strokeWidth={2}
            strokeDasharray="14 8"
            style={{ transformOrigin: "0 0", animation: "itSpin .9s linear infinite" }}
          />
        ) : (
          <text
            x={0}
            y={1}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 9.5, fill: GRAY, fontWeight: 700, userSelect: "none" }}
          >
            Empty
          </text>
        )}
      </g>
    );
  }

  const stroke = n.isRoot || n.isExpanded ? PRI : BOR;
  const sw     = n.isRoot ? 3.5 : n.isExpanded ? 2.5 : 1.5;
  const fill   = n.isActive ? PRI_L : "#f3f4f6";
  const tc     = n.isActive ? PRI : GRAY;
  const letter = (n.fullName || n.username || "?")[0].toUpperCase();
  const filter = n.isRoot
    ? "drop-shadow(0 0 10px rgba(79,70,229,.4))"
    : n.isExpanded
    ? "drop-shadow(0 0 6px rgba(79,70,229,.22))"
    : "none";
  const hint = n.isLoading ? "" : n.isExpanded ? "▲" : n.hasKids ? "▼" : "";
  const canTap = (n.hasKids || !n.isRoot) && !n.isLoading;
  const posLabel = n.matrixPos > 0 ? `Layer Pos #${n.matrixPos}` : "Layer Root";

  return (
    <g
      data-node-id={n.id}
      transform={`translate(${n.cx},${n.cy})`}
      onClick={(e) => {
        e.stopPropagation();
        if (canTap && onTap) onTap(n.id);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      style={{
        cursor: canTap ? "pointer" : "default",
        animation: "itPop .22s ease",
      }}
      title={!n.isRoot ? "Tap to view this member's layer branches" : n.hasKids ? "Tap to expand/collapse" : ""}
    >
      {/* Node Circle */}
      <circle
        r={NR}
        cx={0}
        cy={0}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
        style={{ filter, transition: "filter .2s" }}
      />

      {n.isLoading ? (
        <circle
          r={10}
          cx={0}
          cy={0}
          fill="none"
          stroke={PRI}
          strokeWidth={2.5}
          strokeDasharray="16 8"
          style={{ transformOrigin: "0 0", animation: "itSpin .7s linear infinite" }}
        />
      ) : (
        <text
          x={0}
          y={1}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 17, fontWeight: 900, fill: tc, userSelect: "none" }}
        >
          {letter}
        </text>
      )}

      {/* Active / Inactive Status Dot */}
      <circle
        r={5.5}
        cx={NR - 5}
        cy={NR - 5}
        fill={n.isActive ? OK : WARN}
        stroke={WHITE}
        strokeWidth={1.5}
      />

      {/* Downline Count Badge */}
      {n.hasKids && n.kidCount > 0 && !n.isExpanded && !n.isLoading && (
        <g transform={`translate(${NR - 2},${-(NR - 2)})`}>
          <circle r={8.5} fill={PRI} stroke={WHITE} strokeWidth={1.5} />
          <text
            x={0}
            y={0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 8, fontWeight: 800, fill: WHITE, userSelect: "none" }}>
            {n.kidCount > 99 ? "99+" : n.kidCount}
          </text>
        </g>
      )}

      {hint ? (
        <text
          x={0}
          y={NR + 12}
          textAnchor="middle"
          style={{ fontSize: 9, fill: n.isExpanded ? PRI : SUB, fontWeight: 800, userSelect: "none" }}
        >
          {hint}
        </text>
      ) : null}

      {/* Node Card Details Area */}
      <g transform={`translate(0, ${NR + 14})`}>
        {/* Username / Entry */}
        <text
          x={0}
          y={0}
          textAnchor="middle"
          style={{ fontSize: 10, fontWeight: 850, fill: TXT, userSelect: "none" }}
        >
          {(n.username || n.id).length > 13 ? (n.username || n.id).slice(0, 12) + "…" : (n.username || n.id)}
        </text>

        {n.entryId ? (
          <text
            x={0}
            y={11}
            textAnchor="middle"
            style={{ fontSize: 8, fontWeight: 700, fill: SUB, userSelect: "none" }}
          >
            (Entry #{n.entryId})
          </text>
        ) : null}

        {/* 👤 Direct Sponsored Head Count */}
        <g transform={`translate(-48, ${n.entryId ? 18 : 12})`}>
          <rect width={96} height={18} rx={9} fill="#ecfdf5" stroke="#a7f3d0" strokeWidth={1} />
          <text
            x={48}
            y={12}
            textAnchor="middle"
            style={{ fontSize: 9, fontWeight: 850, fill: "#047857", userSelect: "none" }}
          >
            👤 Direct: {n.directCount}
          </text>
        </g>

        {/* Layer Position Label */}
        <text
          x={0}
          y={n.entryId ? 47 : 41}
          textAnchor="middle"
          style={{ fontSize: 8, fontWeight: 700, fill: GRAY, userSelect: "none" }}
        >
          {posLabel}
        </text>
      </g>
    </g>
  );
});

// ─── SVG: Connecting Branch Edge ──────────────────────────────────────────────
function SvgEdge({ e }) {
  const my = (e.y1 + e.y2) / 2;
  const d  = `M ${e.x1} ${e.y1} C ${e.x1} ${my}, ${e.x2} ${my}, ${e.x2} ${e.y2}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={e.dashed ? "#cbd5e1" : "#94a3b8"}
      strokeWidth={e.dashed ? 1.5 : 2}
      strokeDasharray={e.dashed ? "4 3" : undefined}
    />
  );
}

// ─── Main Export Component ───────────────────────────────────────────────────
export default function InteractiveTree({
  isAdmin        = false,
  adminIdentifier = "",
  adminRootUserId = null,
  entryRootId    = null,
  useEntriesTree = false,
  pool           = "FIVE_150",
  onNodeSelect   = null,
  useRankMatrix  = false,
  rankStartUserId = null,
  rankRootUserId  = null,
}) {
  const slots = maxSlots(pool);

  const [tree,     setTree]     = useState(null);
  const [initLoad, setInitLoad] = useState(true);
  const [tx,       setTx]       = useState(0);
  const [ty,       setTy]       = useState(0);
  const [scale,    setScale]    = useState(1);

  const drag     = useRef(null);
  const pinch    = useRef(null);
  const inFlight = useRef(new Set());
  const dragStart = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const containerRef = useRef(null);

  // ── Computed flat graph ──
  const { nodes, edges, viewBox } = useMemo(() => {
    if (!tree) return { nodes: [], edges: [], viewBox: "-220 -80 440 380" };
    const out = { nodes: [], edges: [] };
    flattenTree(tree, null, 0, 0, 0, NR + 14, slots, out, 0);
    if (out.nodes.length === 0) return { nodes: [], edges: [], viewBox: "-220 -80 440 380" };
    const pad = 64;
    const xs  = out.nodes.map((n) => n.cx);
    const ys  = out.nodes.map((n) => n.cy);
    const x0  = Math.min(...xs) - NR - pad;
    const x1  = Math.max(...xs) + NR + pad;
    const y0  = Math.min(...ys) - NR - pad;
    const y1  = Math.max(...ys) + NODE_TOTAL_H + pad;
    return {
      nodes: out.nodes,
      edges: out.edges,
      viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`,
    };
  }, [tree, slots]);

  // ── Tap: click child → drill down; click root → expand/collapse ──
  const handleTap = useCallback((nodeId) => {
    function findNodeById(nd, id) {
      if (!nd) return null;
      if (String(nd.id) === String(id)) return nd;
      const kids = Array.isArray(nd._kids) ? nd._kids : Array.isArray(nd.children) ? nd.children : [];
      for (const kid of kids) {
        if (!kid) continue;
        const found = findNodeById(kid, id);
        if (found) return found;
      }
      return null;
    }

    function updateNodeInTree(nd, targetId, updateFn) {
      if (!nd) return nd;
      if (String(nd.id) === String(targetId)) {
        return updateFn(nd);
      }
      if (Array.isArray(nd._kids)) {
        const newKids = nd._kids.map((k) => (k ? updateNodeInTree(k, targetId, updateFn) : null));
        return { ...nd, _kids: newKids };
      }
      if (Array.isArray(nd.children)) {
        const newKids = nd.children.map((k) => (k ? updateNodeInTree(k, targetId, updateFn) : null));
        return { ...nd, children: newKids };
      }
      return nd;
    }

    if (!tree) return;
    const node = findNodeById(tree, nodeId);
    if (!node) return;

    if (onNodeSelect) {
      onNodeSelect(String(nodeId), node);
    }

    setTree((prev) => {
      if (!prev) return prev;
      const target = findNodeById(prev, nodeId);
      if (!target) return prev;

      if (target._expanded) {
        return updateNodeInTree(prev, nodeId, (n) => ({ ...n, _expanded: false }));
      }

      if (Array.isArray(target._kids) && target._kids.length > 0) {
        return updateNodeInTree(prev, nodeId, (n) => ({ ...n, _expanded: true }));
      }

      if (!inFlight.current.has(nodeId)) {
        inFlight.current.add(nodeId);
        const opts = { isAdmin, useEntries: useEntriesTree, pool, useRankMatrix, rankRootUserId };
        apiFetchKids(nodeId, target, opts).then((apiKids) => {
          inFlight.current.delete(nodeId);
          const kids = apiKids || [];
          setTree((p2) => {
            if (!p2) return p2;
            return updateNodeInTree(p2, nodeId, (n) => ({
              ...n,
              _kids: kids,
              _loading: false,
              _expanded: true,
            }));
          });
        });
      }
      return updateNodeInTree(prev, nodeId, (n) => ({ ...n, _loading: true }));
    });
  }, [isAdmin, useEntriesTree, pool, tree, onNodeSelect, useRankMatrix, rankRootUserId]);

  // ── Initial load ──
  useEffect(() => {
    let alive = true;
    setInitLoad(true);
    setTree(null);
    inFlight.current.clear();

    (async () => {
      const raw = await apiFetchRoot({
        isAdmin,
        adminIdentifier,
        adminRootUserId,
        useEntries: useEntriesTree,
        entryRootId,
        pool,
        useRankMatrix,
        rankStartUserId,
        rankRootUserId,
      });
      if (!alive) return;
      if (!raw) {
        setInitLoad(false);
        return;
      }

      const inlineKids = Array.isArray(raw.children) ? raw.children : [];

      const rootNode = {
        ...raw,
        children:  undefined,
        _kids:     inlineKids,
        _expanded: true,
        _loading:  false,
      };

      setTree(rootNode);
      setInitLoad(false);
    })();

    return () => { alive = false; };
  }, [isAdmin, adminIdentifier, adminRootUserId, entryRootId, useEntriesTree, pool, slots, useRankMatrix, rankStartUserId, rankRootUserId]);

  const handleSvgClick = useCallback((e) => {
    const nodeEl = e.target.closest("[data-node-id]");
    if (nodeEl) {
      const nodeId = nodeEl.getAttribute("data-node-id");
      handleTap(nodeId);
    }
  }, [handleTap]);

  const onPD = useCallback((e) => {
    if (e.pointerType === "touch") return;
    drag.current = { sx: e.clientX, sy: e.clientY, itx: tx, ity: ty };
    dragStart.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
  }, [tx, ty]);

  const onPM = useCallback((e) => {
    if (!drag.current || e.pointerType === "touch") return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.hypot(dx, dy) > 8) {
      hasDragged.current = true;
    }
    setTx(drag.current.itx + e.clientX - drag.current.sx);
    setTy(drag.current.ity + e.clientY - drag.current.sy);
  }, []);

  const onPU = useCallback(() => { drag.current = null; }, []);

  const onWheel = useCallback((e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setScale((s) => Math.max(0.15, Math.min(3, s * (e.deltaY < 0 ? 1.12 : 0.9))));
  }, []);

  const reset = () => { setTx(0); setTy(0); setScale(1); };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 560,
        background: BG,
        borderRadius: 20,
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 4px 24px rgba(15,23,42,0.08)",
        border: `1.5px solid ${BOR}`,
        touchAction: "pan-y",
      }}
      onPointerDown={onPD}
      onPointerMove={onPM}
      onPointerUp={onPU}
      onPointerLeave={onPU}
      onWheel={onWheel}
    >
      {/* Loading overlay */}
      {initLoad && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: BG,
            gap: 12,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              display: "block",
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: `4px solid ${PRI}`,
              borderTopColor: "transparent",
              animation: "itSpin .8s linear infinite",
            }}
          />
          <span style={{ fontSize: 13, color: SUB, fontWeight: 700 }}>
            Loading {slots}-Block Layer Tree Branches…
          </span>
        </div>
      )}

      {/* SVG Tree with Branches */}
      <svg
        viewBox={viewBox}
        width="100%"
        height="100%"
        onClick={handleSvgClick}
        style={{
          display: "block",
          userSelect: "none",
          cursor: drag.current ? "grabbing" : "grab",
        }}
      >
        <defs>
          <pattern id="igrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="1" fill="#e2e8f0" />
          </pattern>
        </defs>
        <g
          style={{
            transform: `translate(${tx}px,${ty}px) scale(${scale})`,
            transformOrigin: "50% 20%",
            transition: drag.current || pinch.current ? "none" : "transform .16s ease",
          }}
        >
          <rect x="-8000" y="-8000" width="16000" height="16000" fill="url(#igrid)" />
          {edges.map((e) => (
            <SvgEdge key={e.id} e={e} />
          ))}
          {nodes.map((n) => (
            <SvgNode key={n.id} n={n} onTap={handleTap} isRoot={tree && String(tree.id) === n.id} />
          ))}
        </g>
      </svg>

      {/* Helper pill */}
      {!initLoad && nodes.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(8px)",
            borderRadius: 99,
            padding: "5px 16px",
            fontSize: 11,
            color: TXT,
            fontWeight: 750,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            border: `1px solid ${BOR}`,
          }}
        >
          ✨ Tap branch to expand / drill down · Drag to pan · Pinch / Ctrl+Scroll to zoom
        </div>
      )}

      {/* Zoom / Reset Controls */}
      {!initLoad && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            zIndex: 10,
          }}
        >
          {[
            { lbl: "+", fn: () => setScale((s) => Math.min(3, s * 1.25)), title: "Zoom in" },
            { lbl: "−", fn: () => setScale((s) => Math.max(0.15, s * 0.8)), title: "Zoom out" },
            { lbl: "⌂", fn: reset, title: "Reset view" },
          ].map(({ lbl, fn, title }) => (
            <button
              key={lbl}
              title={title}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                fn();
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: WHITE,
                border: `1.5px solid ${BOR}`,
                boxShadow: "0 2px 8px rgba(15,23,42,0.12)",
                fontSize: 17,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: TXT,
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}