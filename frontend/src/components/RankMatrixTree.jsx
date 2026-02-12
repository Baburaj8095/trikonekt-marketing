import React, { useEffect, useMemo, useState } from "react";
import API from "../api/api";
import {
  Box,
  Typography,
  Chip,
  Stack,
  Button,
  Divider,
  Grid,
  Skeleton,
  Breadcrumbs,
  Link,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

function fmtDate(val) {
  try {
    if (!val) return "-";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return String(val || "-");
  }
}

const cardW = 160;
const styles = {
  headerBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 },
  breadcrumb: { display: "flex", gap: 6, alignItems: "center", color: "#64748b", fontSize: 12, flexWrap: "wrap" },
  crumbLink: { color: "#0f172a", cursor: "pointer", fontWeight: 700, textTransform: "uppercase" },
  crumbSep: { color: "#94a3b8", fontWeight: 700 },
  backBtn: { padding: "6px 10px", background: "#334155", color: "#fff", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 },
  card: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)", padding: 16, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", minWidth: cardW, width: cardW },
  cardName: { fontWeight: 800, color: "#0f172a", marginTop: 8, fontSize: 16 },
  cardTR: { color: "#334155", fontSize: 13, marginTop: 4 },
  cardTeam: { color: "#0f172a", fontWeight: 700, fontSize: 14, marginTop: 6 },
  teamLabel: { marginTop: 12, marginBottom: 8, color: "#334155", fontWeight: 700, textAlign: "left" },
  scrollX: { overflowX: "auto", WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", paddingBottom: 8 },
  row: { display: "grid", gridTemplateColumns: `repeat(5, ${cardW}px)`, gap: 12, width: "max-content" },
  childCard: { background: "#fff", borderRadius: 16, boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)", padding: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", cursor: "pointer", width: cardW },
  placeholder: { background: "#fff", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", border: "2px dashed #e2e8f0", color: "#94a3b8", width: cardW },
};

const AvatarIcon = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="32" fill="#E5E7EB"/>
    <circle cx="32" cy="24" r="10" fill="#9CA3AF"/>
    <path d="M16 50c3-8 10-12 16-12s13 4 16 12" fill="#9CA3AF"/>
  </svg>
);

/**
 * RankMatrixTree
 * MLM-style tree UI for Rank‑1 matrix placements.
 * - Uses /rank-matrix/tree to resolve the root_user_id context
 * - Uses /rank-matrix/subtree to load immediate children (up to 5) for any parent inside this root
 * - Breadcrumb navigation and Back similar to GenealogyTree5
 */
export default function RankMatrixTree({ rootUserId: propRootUserId = null }) {
  const [rootSummary, setRootSummary] = useState(null); // /rank-matrix/tree payload
  const [rootUserId, setRootUserId] = useState(null);
  const [stack, setStack] = useState([]); // [{ user_id, username? }]
  const [subtree, setSubtree] = useState(null); // { children: [...] }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Resolve root context
  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      try {
        const q = propRootUserId ? `?root_user_id=${encodeURIComponent(String(propRootUserId))}` : "";
        const res = await API.get(`/rank-matrix/tree/${q}`);
        if (!alive) return;
        const data = res?.data || null;
        setRootSummary(data);
        const rid = Number(data?.root?.root_user_id || 0) || null;
        setRootUserId(rid);
        if (rid) {
          setStack([{ user_id: rid, username: "ROOT" }]);
        }
      } catch (e) {
        if (!alive) return;
        setErr("Unable to load Rank-1 matrix root.");
      }
    })();
    return () => { alive = false; };
  }, [propRootUserId]);

  const currentParent = useMemo(() => (stack.length > 0 ? stack[stack.length - 1] : null), [stack]);
  const canGoBack = stack.length > 1;

  // Load subtree for current parent
  useEffect(() => {
    if (!currentParent || !rootUserId) {
      setSubtree(null);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await API.get(
          `/rank-matrix/subtree/?user_id=${encodeURIComponent(String(currentParent.user_id))}&root_user_id=${encodeURIComponent(String(rootUserId))}`,
          { cacheTTL: 3000, retryAttempts: 1 }
        );
        if (!alive) return;
        setSubtree(res?.data || { children: [] });
      } catch (e) {
        if (!alive) return;
        setErr("Unable to load subtree.");
        setSubtree({ children: [] });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currentParent, rootUserId]);

  const handleChildClick = (child) => {
    const uid = Number(child?.user_id || 0);
    const uname = child?.username || `U${uid}`;
    if (!uid) return;
    setStack((s) => [...s, { user_id: uid, username: uname }]);
  };

  const handleBack = () => {
    if (!canGoBack) return;
    setStack((s) => s.slice(0, s.length - 1));
  };

  const handleCrumbClick = (idx) => {
    if (idx < 0 || idx >= stack.length) return;
    setStack((s) => s.slice(0, idx + 1));
  };

  // Normalize children; ensure max 5 with placeholders
  const children = useMemo(() => {
    const arr = Array.isArray(subtree?.children) ? [...subtree.children] : [];
    // stable order by position then user_id
    arr.sort((a, b) => {
      const pa = Number(a?.position || 0);
      const pb = Number(b?.position || 0);
      if (pa !== pb) return pa - pb;
      const ia = Number(a?.user_id || 0);
      const ib = Number(b?.user_id || 0);
      return ia - ib;
    });
    return arr.slice(0, 5);
  }, [subtree]);

  const placeholders = useMemo(() => Math.max(0, 5 - (children?.length || 0)), [children]);

  return (
    <Box>
      {/* Breadcrumb + Back (same layout spirit as GenealogyTree5) */}
      <Box sx={styles.headerBar}>
        <Breadcrumbs
          aria-label="breadcrumb"
          sx={{
            fontSize: 12,
            "& a": { fontWeight: 600 },
          }}
        >
          {(stack || []).map((n, idx) => {
            const active = idx === stack.length - 1;
            const label = idx === 0 ? `ROOT (${n.user_id})` : n.username || `U${n.user_id}`;
            return active ? (
              <Typography key={`${n.user_id}_${idx}`} color="text.primary" sx={{ fontWeight: 800, fontFamily: "monospace" }}>
                {label}
              </Typography>
            ) : (
              <Link
                key={`${n.user_id}_${idx}`}
                underline="hover"
                color="inherit"
                onClick={() => handleCrumbClick(idx)}
                sx={{ cursor: "pointer" }}
              >
                {label}
              </Link>
            );
          })}
        </Breadcrumbs>

        {canGoBack ? (
          <button onClick={handleBack} style={styles.backBtn}>
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Back
          </button>
        ) : null}
      </Box>

      {err ? <Typography variant="body2" color="error" sx={{ mb: 1 }}>{err}</Typography> : null}

      {/* Root card (visual parity with GenealogyTree5) */}
      <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
        <Box sx={styles.card}>
          <AvatarIcon size={56} />
          <div style={styles.cardName}>{stack[0]?.username || `ROOT`}</div>
          <div style={styles.cardTR}>User Id: {rootUserId || "-"}</div>
          <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
            First Upgrade: {rootSummary?.root?.first_upgrade_at ? fmtDate(rootSummary.root.first_upgrade_at) : "-"}
          </div>
          <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
            Expires: {rootSummary?.root?.expiry_at ? fmtDate(rootSummary.root.expiry_at) : "-"}
          </div>
        </Box>
      </Box>

      {/* Children row (up to 5) + placeholders; click to drill down */}
      {loading && !subtree ? (
        <Grid container spacing={1.25}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Grid item xs={12} key={i}>
              <Skeleton variant="rounded" height={72} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <>
          <div style={styles.teamLabel}>Team</div>
          <div style={styles.scrollX}>
            <div style={styles.row}>
              {(children || []).map((c, idx) => (
                <div key={Number.isFinite(c.user_id) ? `u:${c.user_id}` : `u-${idx}`} style={styles.childCard} onClick={() => handleChildClick(c)}>
                  <AvatarIcon size={48} />
                  <div style={{ ...styles.cardName, fontSize: 14, marginTop: 6 }}>{c?.username || c?.user_id || "-"}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                    <Chip size="small" label={`Pos ${Number(c?.position || 0) || "-"}`} color="default" variant="outlined" />
                    <Chip size="small" label={`L${Number(c?.placement_level || 0) || "-"}`} color="primary" variant="outlined" />
                  </div>
                  <div style={{ ...styles.cardTR, fontSize: 12, marginTop: 2 }}>
                    Approved: {fmtDate(c?.approved_at)}
                  </div>
                  <div style={{ ...styles.cardTR, fontSize: 12, marginTop: 2 }}>
                    Bonus: <b>Rel ₹{Number(c?.bonus_released || 0).toFixed(2)}</b> • <span style={{ color: "#CA8A04" }}>Hold ₹{Number(c?.bonus_hold || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ ...styles.cardTR, fontSize: 12, marginTop: 2 }}>
                    {c?.has_children ? "Has children" : "Leaf"}
                  </div>
                </div>
              ))}
              {Array.from({ length: placeholders }).map((_, idx) => (
                <div key={`ph-${idx}`} style={styles.placeholder}>
                  <AvatarIcon size={40} />
                  <div style={{ marginTop: 6, fontWeight: 700 }}>Empty</div>
                  <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 12 }}>No member</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Divider sx={{ mt: 1.25, mb: 0.75 }} />

      {/* Footer note */}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        Placement is BFS spillover after the first 5 directs. Level bonus routes to the placement parent; holds release on completing 5 directs within 7 days.
      </Typography>
    </Box>
  );
}
