/**
 * InteractiveTree.jsx  –  5-Matrix (and 3-Matrix) genealogy SVG tree
 *
 * Rules:
 * ✓ Always shows MAX_SLOTS (5 for FIVE_150, 3 for THREE_150) child slots
 * ✓ Slots filled from API by matrix_position; unfilled = dashed "Empty" circle
 * ✓ Tap filled node → expand (lazy API fetch) or collapse
 * ✓ Level-1 children auto-loaded on mount
 * ✓ Drag to pan · pinch / ctrl+scroll to zoom
 * ✓ Mock fallback when API is unavailable
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
const TXT   = "#111827";
const SUB   = "#6b7280";
const BOR   = "#d1d5db";
const WHITE = "#ffffff";
const BG    = "#f0f4ff";
const EMPTY = "#f9fafb";

// ─── Geometry ─────────────────────────────────────────────────────────────────
const NR   = 28;          // node radius
const ND   = NR * 2;      // node diameter
const HGAP = 18;          // horizontal gap between siblings
const VGAP = 130;         // vertical gap between levels (extra for phone/count labels)
const LBH  = 26;          // label area height below circle (username)
const NODE_TOTAL_H = ND + LBH + 38; // circle + username + count + phone

// ─── CSS keyframes (injected once) ───────────────────────────────────────────
(function injectKF() {
  if (typeof document === "undefined") return;
  if (document.getElementById("__it_kf__")) return;
  const s = document.createElement("style");
  s.id = "__it_kf__";
  s.textContent =
    "@keyframes itSpin{to{transform:rotate(360deg)}}" +
    "@keyframes itPop{0%{opacity:0;transform:scale(.55)}100%{opacity:1;transform:scale(1)}}";
  document.head.appendChild(s);
})();

// ─── Slot count by pool ───────────────────────────────────────────────────────
function maxSlots(pool) {
  return String(pool).toUpperCase() === "THREE_150" ? 3 : 5;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
function normalizeEntry(n) {
  if (!n) return null;
  const kids = Array.isArray(n.children) ? n.children.map(normalizeEntry) : [];
  return {
    ...n,
    id:             n.account_id != null ? n.account_id : n.id,
    account_active: String(n.status || "").toUpperCase() === "ACTIVE",
    children:       kids,
  };
}

async function apiFetchRoot({ useEntries, entryRootId, pool }) {
  try {
    if (useEntries) {
      if (!entryRootId) return null;
      const res = await API.get("/accounts/my/matrix/tree5/entries/", {
        params: { start_entry_id: entryRootId, max_depth: 1, pool },
        cacheTTL: 0, dedupe: "cancelPrevious",
      });
      return normalizeEntry(res?.data || null);
    }
    const res = await getMyGenealogyTree5({ max_depth: 1, pool });
    return res || null;
  } catch { return null; }
}

async function apiFetchKids(nodeId, { useEntries, pool }) {
  try {
    if (useEntries) {
      const res = await API.get("/accounts/my/matrix/tree5/entries/", {
        params: { start_entry_id: nodeId, max_depth: 1, pool },
        cacheTTL: 0, dedupe: "cancelPrevious",
      });
      const data = normalizeEntry(res?.data || null);
      return Array.isArray(data?.children) ? data.children : null;
    }
    const res = await getMyGenealogyTree5({ root_user_id: nodeId, max_depth: 1, pool });
    return Array.isArray(res?.children) ? res.children : null;
  } catch { return null; }
}

// ─── Mock data ────────────────────────────────────────────────────────────────
let _mid = 8000;
function mockChild(pos) {
  const id = `m${++_mid}`;
  return {
    id, username: id, full_name: `User ${id}`,
    account_active: Math.random() > 0.3,
    team_count:     Math.floor(Math.random() * 6),
    has_children:   Math.random() > 0.45,
    matrix_position: pos,
    children: [],
  };
}
async function mockRoot(slots) {
  await new Promise(r => setTimeout(r, 280));
  const id = "mock-root";
  return {
    id, username: "You", full_name: "My Account",
    account_active: true, team_count: slots, has_children: true,
    children: Array.from({ length: slots }, (_, i) =>
      Math.random() > 0.25 ? mockChild(i + 1) : null
    ).filter(Boolean),
  };
}
async function mockKids(slots) {
  await new Promise(r => setTimeout(r, 320));
  return Array.from({ length: slots }, (_, i) =>
    Math.random() > 0.35 ? mockChild(i + 1) : null
  ).filter(Boolean);
}

// ─── Build fixed-slot child array (length = maxSlots) ─────────────────────────
/**
 * Place real children into their matrix_position slots (1-based).
 * Unoccupied slots = null.
 */
function toSlottedArray(kids, slots) {
  const arr = Array(slots).fill(null);
  (kids || []).forEach(k => {
    const pos = Number(k.matrix_position);
    const idx = Number.isFinite(pos) && pos >= 1 && pos <= slots
      ? pos - 1
      : arr.findIndex(x => x === null); // fallback: first empty slot
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
function flattenTree(node, pid, pCx, pCy, cx, cy, slots, out) {
  if (!node) return;
  const id = String(node.id);

  const hasKids =
    !!node.has_children ||
    Number(node.team_count) > 0 ||
    (Array.isArray(node._kids) && node._kids.some(Boolean));

  out.nodes.push({
    id, cx, cy,
    username:   node.username || id,
    fullName:   node.full_name || "",
    phone:      String(node.phone || node.mobile || node.phone_number || ""),
    isActive:   node.account_active !== false,
    isRoot:     pid === null,
    isExpanded: !!node._expanded,
    isLoading:  !!node._loading,
    hasKids,
    kidCount:   Number(node.team_count) || 0,
    isEmpty:    false,
  });

  if (pid !== null) {
    out.edges.push({ id: `e-${pid}-${id}`, x1: pCx, y1: pCy + NR, x2: cx, y2: cy - NR });
  }

  const slotted = node._loading
    ? Array(slots).fill(null)   // show slot structure while loading
    : (node._expanded && Array.isArray(node._kids))
    ? toSlottedArray(node._kids, slots)
    : null;

  if (!slotted) return; // collapsed — nothing below

  const xs = slotCentres(cx, slots);
  const ky = cy + ND + VGAP;

  slotted.forEach((kid, i) => {
    const kx = xs[i];
    if (!kid) {
      // Empty slot placeholder
      const eid = `__empty_${id}_${i}`;
      out.nodes.push({
        id: eid, cx: kx, cy: ky,
        username: "Empty", fullName: "",
        isActive: false, isRoot: false,
        isExpanded: false, isLoading: node._loading,
        hasKids: false, kidCount: 0, isEmpty: true,
      });
      out.edges.push({
        id: `ep-${id}-${i}`,
        x1: cx, y1: cy + NR,
        x2: kx, y2: ky - NR,
        dashed: true,
      });
    } else {
      flattenTree(kid, id, cx, cy, kx, ky, slots, out);
    }
  });
}

// ─── SVG: single node ─────────────────────────────────────────────────────────
const SvgNode = React.memo(function SvgNode({ n, onTap }) {
  if (n.isEmpty) {
    return (
      <g transform={`translate(${n.cx},${n.cy})`}>
        <circle r={NR} cx={0} cy={0}
          fill={EMPTY} stroke={BOR} strokeWidth={1.5}
          strokeDasharray="5 3" />
        {n.isLoading ? (
          <circle r={8} cx={0} cy={0} fill="none"
            stroke={GRAY} strokeWidth={2}
            strokeDasharray="14 8"
            style={{ transformOrigin: "0 0", animation: "itSpin .9s linear infinite" }} />
        ) : (
          <text x={0} y={1} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 9, fill: GRAY, fontWeight: 600, userSelect: "none" }}>
            Empty
          </text>
        )}
      </g>
    );
  }

  const stroke = n.isRoot || n.isExpanded ? PRI : BOR;
  const sw     = n.isRoot ? 3 : n.isExpanded ? 2.5 : 1.5;
  const fill   = n.isActive ? PRI_L : "#f3f4f6";
  const tc     = n.isActive ? PRI : GRAY;
  const letter = (n.fullName || n.username || "?")[0].toUpperCase();
  const filter = n.isRoot
    ? "drop-shadow(0 0 8px rgba(79,70,229,.4))"
    : n.isExpanded
    ? "drop-shadow(0 0 5px rgba(79,70,229,.22))"
    : "none";
  const hint = n.isLoading ? "" : n.isExpanded ? "▲" : n.hasKids ? "▼" : "";

  return (
    <g
      transform={`translate(${n.cx},${n.cy})`}
      style={{
        cursor: n.hasKids && !n.isLoading ? "pointer" : "default",
        animation: "itPop .22s ease",
      }}
      onClick={n.hasKids && !n.isLoading ? () => onTap(n.id) : undefined}
    >
      <circle r={NR} cx={0} cy={0}
        fill={fill} stroke={stroke} strokeWidth={sw}
        style={{ filter, transition: "filter .2s" }} />

      {n.isLoading ? (
        <circle r={9} cx={0} cy={0} fill="none"
          stroke={PRI} strokeWidth={2.5}
          strokeDasharray="16 8"
          style={{ transformOrigin: "0 0", animation: "itSpin .7s linear infinite" }} />
      ) : (
        <text x={0} y={1}
          textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 16, fontWeight: 900, fill: tc, userSelect: "none" }}>
          {letter}
        </text>
      )}

      {/* Status dot */}
      <circle r={5} cx={NR - 5} cy={NR - 5}
        fill={n.isActive ? OK : WARN}
        stroke={WHITE} strokeWidth={1.5} />

      {/* Count badge */}
      {n.hasKids && n.kidCount > 0 && !n.isExpanded && !n.isLoading && (
        <g transform={`translate(${NR - 2},${-(NR - 2)})`}>
          <circle r={8} fill={PRI} stroke={WHITE} strokeWidth={1.5} />
          <text x={0} y={0.5}
            textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 8, fontWeight: 800, fill: WHITE, userSelect: "none" }}>
            {n.kidCount > 99 ? "99+" : n.kidCount}
          </text>
        </g>
      )}

      {hint ? (
        <text x={0} y={NR + 12} textAnchor="middle"
          style={{ fontSize: 9, fill: n.isExpanded ? PRI : SUB, fontWeight: 700, userSelect: "none" }}>
          {hint}
        </text>
      ) : null}

      {/* Username label */}
      <text x={0} y={NR + LBH} textAnchor="middle"
        style={{ fontSize: 10, fontWeight: 800, fill: TXT, userSelect: "none" }}>
        {n.username.length > 9 ? n.username.slice(0, 8) + "…" : n.username}
      </text>

      {/* Team count */}
      <text x={0} y={NR + LBH + 13} textAnchor="middle"
        style={{ fontSize: 9, fontWeight: 700, fill: PRI, userSelect: "none" }}>
        {`C: ${n.kidCount}`}
      </text>

      {/* Phone number */}
      {n.phone ? (
        <text x={0} y={NR + LBH + 25} textAnchor="middle"
          style={{ fontSize: 8, fontWeight: 600, fill: SUB, userSelect: "none" }}>
          {n.phone.length > 10 ? n.phone.slice(-10) : n.phone}
        </text>
      ) : null}
    </g>
  );
});

// ─── SVG: edge ────────────────────────────────────────────────────────────────
function SvgEdge({ e }) {
  const my = (e.y1 + e.y2) / 2;
  const d  = `M ${e.x1} ${e.y1} C ${e.x1} ${my}, ${e.x2} ${my}, ${e.x2} ${e.y2}`;
  return (
    <path d={d} fill="none"
      stroke={e.dashed ? "#d1d5db" : BOR}
      strokeWidth={1.5}
      strokeDasharray={e.dashed ? "4 3" : undefined} />
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function InteractiveTree({
  entryRootId    = null,
  useEntriesTree = false,
  pool           = "FIVE_150",
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

  // ── Computed flat graph ──
  const { nodes, edges, viewBox } = useMemo(() => {
    if (!tree) return { nodes: [], edges: [], viewBox: "-180 -60 360 300" };
    const out = { nodes: [], edges: [] };
    flattenTree(tree, null, 0, 0, 0, NR + 12, slots, out);
    if (out.nodes.length === 0) return { nodes: [], edges: [], viewBox: "-180 -60 360 300" };
    const pad = 56;
    const xs  = out.nodes.map(n => n.cx);
    const ys  = out.nodes.map(n => n.cy);
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

  // ── Tap: expand / collapse ──
  const handleTap = useCallback((nodeId) => {
    setTree(prev => {
      if (!prev) return prev;

      function visit(nd) {
        if (!nd) return nd;
        if (String(nd.id) === nodeId) {
          if (nd._expanded) return { ...nd, _expanded: false }; // collapse
          if (nd._kids) return { ...nd, _expanded: true };      // expand cached

          // Launch fetch
          if (!inFlight.current.has(nodeId)) {
            inFlight.current.add(nodeId);
            const opts = { useEntries: useEntriesTree, pool };
            apiFetchKids(nodeId, opts).then(async apiKids => {
              const kids = (apiKids && apiKids.length > 0)
                ? apiKids
                : await mockKids(slots);
              inFlight.current.delete(nodeId);
              setTree(p2 => {
                if (!p2) return p2;
                function inject(n2) {
                  if (!n2) return n2;
                  if (String(n2.id) === nodeId) {
                    return { ...n2, _kids: kids, _loading: false, _expanded: true };
                  }
                  if (!n2._kids) return n2;
                  return { ...n2, _kids: n2._kids.map(inject) };
                }
                return inject(p2);
              });
            });
          }
          return { ...nd, _loading: true };
        }
        if (!nd._kids) return nd;
        return { ...nd, _kids: nd._kids.map(visit) };
      }
      return visit(prev);
    });
  }, [useEntriesTree, pool, slots]);

  // ── Initial load ──
  useEffect(() => {
    let alive = true;
    setInitLoad(true);
    setTree(null);
    inFlight.current.clear();

    (async () => {
      let raw = await apiFetchRoot({ useEntries: useEntriesTree, entryRootId, pool });
      if (!alive) return;
      if (!raw) raw = await mockRoot(slots);
      if (!alive) return;

      const inlineKids = Array.isArray(raw.children) && raw.children.length > 0
        ? raw.children : null;

      const rootNode = {
        ...raw,
        children:  undefined,
        _kids:     inlineKids || null,
        _expanded: !!inlineKids,
        _loading:  !inlineKids,
      };

      setTree(rootNode);
      setInitLoad(false);

      if (!inlineKids) {
        const rid = String(raw.id);
        inFlight.current.add(rid);
        let apiKids = await apiFetchKids(rid, { useEntries: useEntriesTree, pool });
        if (!alive) return;
        if (!apiKids || apiKids.length === 0) apiKids = await mockKids(slots);
        if (!alive) return;
        inFlight.current.delete(rid);
        setTree(prev => {
          if (!prev) return prev;
          return { ...prev, _kids: apiKids, _loading: false, _expanded: true };
        });
      }
    })();

    return () => { alive = false; };
  }, [entryRootId, useEntriesTree, pool, slots]); // eslint-disable-line

  // ── Pointer pan (mouse) ──
  const onPD = useCallback((e) => {
    if (e.pointerType === "touch") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, itx: tx, ity: ty };
  }, [tx, ty]);

  const onPM = useCallback((e) => {
    if (!drag.current || e.pointerType === "touch") return;
    setTx(drag.current.itx + e.clientX - drag.current.sx);
    setTy(drag.current.ity + e.clientY - drag.current.sy);
  }, []);

  const onPU = useCallback(() => { drag.current = null; }, []);

  // ── Touch pan + pinch ──
  const onTS = useCallback((e) => {
    if (e.touches.length === 1) {
      drag.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, itx: tx, ity: ty };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinch.current = { dist: Math.hypot(dx, dy), is: scale };
      drag.current = null;
    }
  }, [tx, ty, scale]);

  const onTM = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && drag.current) {
      setTx(drag.current.itx + e.touches[0].clientX - drag.current.sx);
      setTy(drag.current.ity + e.touches[0].clientY - drag.current.sy);
    } else if (e.touches.length === 2 && pinch.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d  = Math.hypot(dx, dy);
      setScale(s => Math.max(0.15, Math.min(3, pinch.current.is * d / pinch.current.dist)));
    }
  }, []);

  const onTE = useCallback(() => { drag.current = null; pinch.current = null; }, []);

  const onWheel = useCallback((e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setScale(s => Math.max(0.15, Math.min(3, s * (e.deltaY < 0 ? 1.12 : 0.9))));
  }, []);

  const reset = () => { setTx(0); setTy(0); setScale(1); };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100%", height: 520, background: BG,
        borderRadius: 20, overflow: "hidden", position: "relative",
        boxShadow: "0 2px 20px rgba(79,70,229,.12)",
        touchAction: "none",
      }}
      onPointerDown={onPD} onPointerMove={onPM}
      onPointerUp={onPU} onPointerLeave={onPU}
      onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      onWheel={onWheel}
    >
      {/* Loading overlay */}
      {initLoad && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 20,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: BG, gap: 12, pointerEvents: "none",
        }}>
          <span style={{
            display: "block", width: 36, height: 36, borderRadius: "50%",
            border: `4px solid ${PRI}`, borderTopColor: "transparent",
            animation: "itSpin .8s linear infinite",
          }} />
          <span style={{ fontSize: 13, color: SUB, fontWeight: 600 }}>
            Loading {slots}-Matrix…
          </span>
        </div>
      )}

      {/* SVG tree */}
      <svg
        viewBox={viewBox} width="100%" height="100%"
        style={{
          display: "block",
          transform: `translate(${tx}px,${ty}px) scale(${scale})`,
          transformOrigin: "50% 22%",
          transition: drag.current || pinch.current ? "none" : "transform .16s ease",
          userSelect: "none",
          cursor: drag.current ? "grabbing" : "grab",
        }}
      >
        <defs>
          <pattern id="igrid" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r=".8" fill={BOR} />
          </pattern>
        </defs>
        <rect x="-6000" y="-6000" width="12000" height="12000" fill="url(#igrid)" />
        {edges.map(e => <SvgEdge key={e.id} e={e} />)}
        {nodes.map(n => <SvgNode key={n.id} n={n} onTap={handleTap} />)}
      </svg>

      {/* Hint */}
      {!initLoad && nodes.length > 0 && (
        <div style={{
          position: "absolute", top: 10, left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,.88)",
          backdropFilter: "blur(8px)",
          borderRadius: 99, padding: "4px 14px",
          fontSize: 10, color: SUB, fontWeight: 600,
          whiteSpace: "nowrap", pointerEvents: "none",
          zIndex: 10, boxShadow: "0 1px 6px rgba(0,0,0,.09)",
        }}>
          ▼ tap to expand · drag to pan · pinch to zoom
        </div>
      )}

      {/* Zoom / reset buttons */}
      {!initLoad && (
        <div style={{
          position: "absolute", bottom: 14, right: 14,
          display: "flex", flexDirection: "column", gap: 6, zIndex: 10,
        }}>
          {[
            { lbl: "+",  fn: () => setScale(s => Math.min(3,    s * 1.25)) },
            { lbl: "−",  fn: () => setScale(s => Math.max(0.15, s * 0.8))  },
            { lbl: "⌂",  fn: reset },
          ].map(({ lbl, fn }) => (
            <button key={lbl}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); fn(); }}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: WHITE, border: `1.5px solid ${BOR}`,
                boxShadow: "0 2px 8px rgba(0,0,0,.10)",
                fontSize: 16, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
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