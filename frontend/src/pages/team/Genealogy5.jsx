import React, { useEffect, useMemo, useState } from "react";
import GenealogyTree5 from "../../components/GenealogyTree5";
import API from "../../api/api";
import { adminGetMatrixCommissionConfig } from "../../api/api";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tabs,
  Tab,
  Stack,
  Avatar,
  Button,
} from "@mui/material";

function StatCard({ title, value, subtitle }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

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

function DirectSponsorsList({ list }) {
  const arr = Array.isArray(list) ? list : [];
  if (arr.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        No direct sponsors found.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {arr.map((m, idx) => {
        const phone = String(m?.phone || "").trim();
        return (
          <Card
            key={m?.id || idx}
            variant="outlined"
            sx={{ p: 1.25, borderRadius: 1.5, backgroundColor: "#fff" }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                <Avatar
                  sx={{
                    bgcolor: "#E2E8F0",
                    color: "#0C2D48",
                    width: 28,
                    height: 28,
                    fontSize: 13,
                  }}
                >
                  {idx + 1}
                </Avatar>
                <Box sx={{ overflow: "hidden" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    User Id:{" "}
                    <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 800 }}>
                      {m?.username || "-"}
                    </Box>
                  </Typography>
                  <Typography variant="body2">Name: {m?.full_name || "-"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Joining Date: {fmtDate(m?.date_joined)}
                  </Typography>
                </Box>
              </Stack>
              {phone ? (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  href={`tel:${phone}`}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Call
                </Button>
              ) : null}
            </Stack>
          </Card>
        );
      })}
    </Box>
  );
}

function MyPositionsPanel({ positions }) {
  const arr = Array.isArray(positions) ? positions : [];
  const five = arr.filter((p) => String(p?.pool_type) === "FIVE_150");
  const three = arr.filter((p) => String(p?.pool_type) === "THREE_150");

  const renderTable = (rows, title) => (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          {title} Positions ({rows.length})
        </Typography>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No active positions.</Typography>
        ) : (
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell>Self ID</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Index</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Opened On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={r?.id || idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <Box sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                        {r?.username_key || "-"}
                      </Box>
                    </TableCell>
                    <TableCell>{`Level-${Number(r?.level || 0)}`}</TableCell>
                    <TableCell>{Number(r?.user_entry_index || 0)}</TableCell>
                    <TableCell>{String(r?.status || "")}</TableCell>
                    <TableCell>{fmtDate(r?.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {renderTable(five, "5 Matrix")}
      {renderTable(three, "3 Matrix")}
    </Box>
  );
}

export default function Genealogy5() {
  // Data and config from MyTeam (5‑Matrix-specific)
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [levels, setLevels] = useState({ five: 10, three: 15 });
  const [tab, setTab] = useState("tree");
  const [levelCounts, setLevelCounts] = useState(null);
 
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await adminGetMatrixCommissionConfig();
        if (!mounted) return;
        const five = Number(cfg?.five_matrix_levels) || 10;
        const three = Number(cfg?.three_matrix_levels) || 15;
        setLevels({ five, three });
      } catch (_) {
        // keep defaults or server-provided fallbacks
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const role = useMemo(() => {
    try {
      return (
        localStorage.getItem("role") ||
        sessionStorage.getItem("role") ||
        localStorage.getItem("role_user") ||
        sessionStorage.getItem("role_user") ||
        ""
      );
    } catch {
      return "";
    }
  }, []);
  const isUser = String(role).toLowerCase() === "user";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/accounts/team/summary/", {
          cacheTTL: 10000,
          retryAttempts: 2,
        });
        if (!mounted) return;
        setData(res?.data || {});
        setErr("");
      } catch (e) {
        if (!mounted) return;
        setErr("Failed to load team summary.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Extract 5‑matrix progress only
  const fiveProgress = useMemo(() => {
    const arr = Array.isArray(data?.matrix_progress) ? data.matrix_progress : [];
    return arr.find((p) => String(p?.pool_type).toUpperCase() === "FIVE_150") || null;
  }, [data]);

  const myPositions = useMemo(() => {
    try {
      const arr = Array.isArray(data?.my_positions) ? data.my_positions : [];
      return arr.map((p) => ({
        id: p?.id,
        username_key: p?.username_key,
        pool_type: p?.pool_type,
        status: p?.status,
        level: p?.level,
        user_entry_index: p?.user_entry_index,
        created_at: p?.created_at,
      }));
    } catch {
      return [];
    }
  }, [data]);

  // Prefer per_level_counts from summary; if absent, compute from my matrix tree
  useEffect(() => {
    const plc = fiveProgress?.per_level_counts || {};
    const has = plc && Object.keys(plc).length > 0;
    if (has) {
      setLevelCounts(plc);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const maxL = Math.max(1, Number(levels?.five ?? 10));
        const res = await API.get(
          `/accounts/my/matrix/tree/?max_depth=${encodeURIComponent(maxL)}`,
          { cacheTTL: 8000, retryAttempts: 1 }
        );
        if (cancelled) return;
        const tree = res?.data;
        if (!tree) return;
        const counts = {};
        for (let i = 1; i <= maxL; i += 1) counts[String(i)] = 0;
        const walk = (node) => {
          if (!node) return;
          const lvl = Number(node.level || 0);
          const idx = lvl - 1; // API: root=1 ⇒ matrix Level‑1 = 2
          if (idx >= 1 && idx <= maxL) {
            const k = String(idx);
            counts[k] = (counts[k] || 0) + 1;
          }
          const ch = Array.isArray(node.children) ? node.children : [];
          ch.forEach(walk);
        };
        walk(tree);
        setLevelCounts(counts);
      } catch (e) {
        // ignore; table will remain empty if unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fiveProgress, levels]);

  const fiveLevelGrid = useMemo(() => {
    const plc = (levelCounts || fiveProgress?.per_level_counts || {});
    const maxL = Math.max(1, Number(levels?.five ?? 10));
    const rows = [];
    for (let i = 1; i <= maxL; i += 1) {
      const raw = plc[String(i)];
      const count = Math.max(0, parseInt(raw ?? 0, 10) || 0);
      const maxUsers = Math.pow(5, i);
      rows.push({ sn: i, level: i, count, maxUsers });
    }
    return rows;
  }, [levelCounts, fiveProgress, levels]);

  const directCount = useMemo(() => {
    try {
      const down = data?.downline || {};
      const lvls = down?.levels || {};
      const l1 = typeof lvls?.l1 === "number" ? lvls.l1 : 0;
      const direct = typeof down?.direct === "number" ? down.direct : l1;
      return Math.max(0, direct || 0);
    } catch {
      return 0;
    }
  }, [data]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Genealogy (5‑Matrix)</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          View your 5‑Matrix team. Click a member to drill down; use the breadcrumb to navigate back.
        </div>
        {role ? <Chip size="small" label={`Role: ${role}`} sx={{ mt: 1 }} /> : null}
      </div>

      {err ? (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {err}
        </Typography>
      ) : null}

      {/* 5 Matrix Accounts Summary (merged from MyTeam.jsx) */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} sx={{ mb: 1 }}>
          <Grid item xs={12} md={4}>
            <StatCard
              title="Direct Referrals"
              value={String(directCount)}
              subtitle="Total direct team members"
            />
          </Grid>
          <Grid item xs={6} md={4}>
            <StatCard
              title="5 Matrix Level Reached"
              value={String(fiveProgress?.level_reached ?? 0)}
            />
          </Grid>
          {/* <Grid item xs={6} md={4}>
            <StatCard
              title="5 Matrix Total Earned"
              value={String(fiveProgress?.total_earned ?? "0")}
            />
          </Grid> */}
        </Grid>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              5 Matrix Level-wise Accounts
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {!fiveProgress ? (
              <Typography variant="body2" color="text.secondary">
                No 5 Matrix progress available yet.
              </Typography>
            ) : (
              <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>S.No</TableCell>
                      <TableCell>Level</TableCell>
                      <TableCell align="right">Number of users</TableCell>
                      <TableCell align="right">Max Users</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fiveLevelGrid.map((r) => (
                      <TableRow key={r.level}>
                        <TableCell>{r.sn}</TableCell>
                        <TableCell>{`Level-${r.level}`}</TableCell>
                        <TableCell align="right">{Number(r.count).toLocaleString("en-IN")}</TableCell>
                        <TableCell align="right">{Number(r.maxUsers).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          border: "1px solid #e2e8f0",
          borderRadius: 2,
          background: "#f8fafc",
          p: 1.5,
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Tree" value="tree" />
          <Tab label={`Direct Sponsors (${directCount})`} value="direct" />
          <Tab label={`My Positions (${myPositions.length})`} value="positions" />
        </Tabs>
        <Divider sx={{ mb: 1 }} />
        {tab === "tree" ? (
          <GenealogyTree5 initialPool="FIVE_150" maxDepth={10} showPlaceholders />
        ) : tab === "direct" ? (
          <DirectSponsorsList list={Array.isArray(data?.direct_team) ? data.direct_team : []} />
        ) : (
          <MyPositionsPanel positions={myPositions} />
        )}
      </Box>
    </div>
  );
}
