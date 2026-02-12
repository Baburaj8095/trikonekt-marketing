import React, { useEffect, useMemo, useState } from "react";
import API from "../api/api";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
  Divider,
  Breadcrumbs,
  Link,
  Grid,
  Skeleton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

/**
 * RankMatrixExplorer
 * - Fetches /rank-matrix/tree to resolve root_user_id and summary
 * - Loads initial subtree = children under root (user_id = root_user_id)
 * - Clicking a child loads that child's subtree; maintains breadcrumb for navigation
 * - Shows for each child: username, placement_level, position, approved_at, bonus_released, bonus_hold, has_children
 */
export default function RankMatrixExplorer({ rootUserId: propRootUserId }) {
  const [root, setRoot] = useState(null); // { root_user_id, placements[], approved_count, totals, ... }
  const [rootUserId, setRootUserId] = useState(null);
  const [stack, setStack] = useState([]); // [{ user_id, username? }]
  const [subtree, setSubtree] = useState(null); // { children: [...] }
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Fetch root summary
  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      try {
        const q = propRootUserId ? `?root_user_id=${encodeURIComponent(String(propRootUserId))}` : "";
        const res = await API.get(`/rank-matrix/tree/${q}`);
        if (!alive) return;
        const data = res?.data || null;
        setRoot(data);
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
    return () => {
      alive = false;
    };
  }, [propRootUserId]);

  const currentParent = useMemo(() => {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }, [stack]);

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
          `/rank-matrix/subtree/?user_id=${encodeURIComponent(String(currentParent.user_id))}&root_user_id=${encodeURIComponent(
            String(rootUserId)
          )}`,
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
    return () => {
      alive = false;
    };
  }, [currentParent, rootUserId]);

  const canGoBack = stack.length > 1;

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

  return (
    <Card variant="outlined" sx={{ borderRadius: "14px" }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Rank‑1 Matrix Explorer
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={`Completed: ${Number(root?.approved_count || 0)}/${Number(root?.target || 5)}`}
              color={Number(root?.approved_count || 0) >= 5 ? "success" : "default"}
              variant="outlined"
            />
            {canGoBack ? (
              <Button size="small" startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ textTransform: "none", fontWeight: 700 }}>
                Back
              </Button>
            ) : null}
          </Stack>
        </Stack>

        {/* Breadcrumb */}
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

        <Divider sx={{ my: 1.25 }} />

        {/* Current Parent Meta */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 1 }}>
          <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "10px", p: 1, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Parent User
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.25, fontWeight: 800, fontFamily: "monospace" }}>
              {currentParent ? currentParent.username || `U${currentParent.user_id}` : "-"}
            </Typography>
          </Box>
          <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "10px", p: 1, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Root
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.25, fontWeight: 800, fontFamily: "monospace" }}>
              {rootUserId || "-"}
            </Typography>
          </Box>
          <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "10px", p: 1, textAlign: "center" }}>
            <Typography variant="caption" color="text.secondary">
              Children
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.25, fontWeight: 800 }}>
              {Array.isArray(subtree?.children) ? subtree.children.length : 0}
            </Typography>
          </Box>
        </Box>

        {/* Children list */}
        {loading ? (
          <Grid container spacing={1.25}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Grid item xs={12} key={i}>
                <Skeleton variant="rounded" height={72} />
              </Grid>
            ))}
          </Grid>
        ) : err ? (
          <Typography variant="body2" color="error">
            {err}
          </Typography>
        ) : (
          <Box>
            {Array.isArray(subtree?.children) && subtree.children.length > 0 ? (
              <Grid container spacing={1.25}>
                {subtree.children.map((ch, idx) => {
                  const hasKids = !!ch?.has_children;
                  const bonusRel = Number(ch?.bonus_released || 0);
                  const bonusHold = Number(ch?.bonus_hold || 0);
                  return (
                    <Grid item xs={12} key={ch?.user_id || idx}>
                      <Card variant="outlined" sx={{ borderRadius: "12px" }}>
                        <CardContent sx={{ p: 1.5 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2">
                                  User:{" "}
                                  <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 800 }}>
                                    {ch?.username || ch?.user_id || "-"}
                                  </Box>
                                </Typography>
                                <Chip
                                  size="small"
                                  label={`Pos ${Number(ch?.position || 0) || "-"}`}
                                  color="default"
                                  variant="outlined"
                                />
                                <Chip
                                  size="small"
                                  label={`L${Number(ch?.placement_level || 0) || "-"}`}
                                  color="primary"
                                  variant="outlined"
                                />
                                {hasKids ? (
                                  <Chip size="small" label="Has children" color="success" variant="outlined" />
                                ) : (
                                  <Chip size="small" label="Leaf" color="default" variant="outlined" />
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                Approved: {fmtDate(ch?.approved_at)}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box sx={{ textAlign: "right", mr: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Bonus
                                </Typography>
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  <Chip
                                    size="small"
                                    label={`Rel ₹${bonusRel.toFixed(2)}`}
                                    color="success"
                                    variant="outlined"
                                  />
                                  <Chip
                                    size="small"
                                    label={`Hold ₹${bonusHold.toFixed(2)}`}
                                    color="warning"
                                    variant="outlined"
                                  />
                                </Stack>
                              </Box>
                              <Button
                                size="small"
                                variant="contained"
                                endIcon={<ExpandMoreIcon />}
                                onClick={() => handleChildClick(ch)}
                                disabled={!hasKids}
                                sx={{ textTransform: "none", fontWeight: 700 }}
                              >
                                {hasKids ? "Expand" : "Expand"}
                              </Button>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No children under this parent yet.
              </Typography>
            )}
          </Box>
        )}

        {/* Footer note */}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Placement is BFS spillover after the first 5 directs. Level bonus routes to the placement parent; holds release
          on completing 5 directs within 7 days.
        </Typography>
      </CardContent>
    </Card>
  );
}
