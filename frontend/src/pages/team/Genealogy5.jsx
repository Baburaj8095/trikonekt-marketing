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
  Tabs,
  Tab,
  Stack,
  Avatar,
  Button,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import GroupsIcon from "@mui/icons-material/Groups";
import PlaceIcon from "@mui/icons-material/Place";
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";


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
 * Direct sponsors list — improved mobile styling
 * - Increased padding
 * - Larger avatar (32px)
 * - Rounded corners (14–16px)
 * - Bold username
 * - Call button right aligned
 */
function DirectSponsorsList({ list, counts }) {
  const arr = Array.isArray(list) ? list : [];
  const activeCount =
    typeof counts?.active === "number"
      ? counts.active
      : arr.filter((m) => !!m?.account_active).length;
  const inactiveCount =
    typeof counts?.inactive === "number"
      ? counts.inactive
      : Math.max(0, arr.length - activeCount);
  if (arr.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        No direct sponsors found.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box sx={{ display: "flex", gap: 1, mb: 0.5 }}>
        <Chip size="small" label={`Active: ${activeCount}`} color="success" variant="outlined" />
        <Chip size="small" label={`Inactive: ${inactiveCount}`} color="error" variant="outlined" />
      </Box>
      {arr.map((m, idx) => {
        const phone = String(m?.phone || "").trim();
        return (
          <Card
            key={m?.id || idx}
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: "14px",
              backgroundColor: "#fff",
            }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ flex: 1, minWidth: 0 }}
              >
                <Avatar
                  sx={{
                    bgcolor: "#E2E8F0",
                    color: "#0C2D48",
                    width: 32,
                    height: 32,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {idx + 1}
                </Avatar>
                <Box sx={{ overflow: "hidden" }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      User Id:{" "}
                      <Box
                        component="span"
                        sx={{ fontFamily: "monospace", fontWeight: 800 }}
                      >
                        {m?.username || "-"}
                      </Box>
                    </Typography>
                    <Chip
                      size="small"
                      label={m?.account_active ? "Active" : "Inactive"}
                      color={m?.account_active ? "success" : "default"}
                      variant={m?.account_active ? "filled" : "outlined"}
                    />
                  </Stack>
                  <Typography variant="body2">
                    Name: {m?.full_name || "-"}
                  </Typography>
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

/**
 * My Positions — card list (no tables)
 * - Card grid (xs=12)
 * - Username key (bold)
 * - Level, Index
 * - Status chip
 * - Created date (caption)
 * - No horizontal scroll
 */
function MyPositionsPanel({ positions }) {
  const arr = Array.isArray(positions) ? positions : [];
  const five = arr.filter((p) => String(p?.pool_type) === "FIVE_150");
  const three = arr.filter((p) => String(p?.pool_type) === "THREE_150");

  const renderSection = (rows, title) => (
    <Card variant="outlined" sx={{ mb: 2, borderRadius: "14px" }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          {title} Positions ({rows.length})
        </Typography>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No active positions.
          </Typography>
        ) : (
          <Grid container spacing={1.25}>
            {rows.map((r, idx) => (
              <Grid item xs={12} key={r?.id || idx}>
                <Card
                  variant="outlined"
                  sx={{ borderRadius: "14px", p: 1.5, backgroundColor: "#fff" }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 800, fontFamily: "monospace" }}
                      >
                        {r?.username_key || "-"}
                      </Typography>
                      <Chip
                        size="small"
                        label={String(r?.status || "")}
                        color="default"
                        variant="outlined"
                      />
                    </Stack>
                    <Stack direction="row" spacing={2}>
                      <Typography variant="body2">
                        Level:{" "}
                        <Box component="span" sx={{ fontWeight: 700 }}>
                          {`Level-${Number(r?.level || 0)}`}
                        </Box>
                      </Typography>
                      <Typography variant="body2">
                        Index:{" "}
                        <Box component="span" sx={{ fontWeight: 700 }}>
                          {Number(r?.user_entry_index || 0)}
                        </Box>
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Opened On: {fmtDate(r?.created_at)}
                    </Typography>
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {renderSection(five, "5 Matrix")}
      {renderSection(three, "3 Matrix")}
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
  const [fiveCounts, setFiveCounts] = useState(null);
  const [selectedRoot, setSelectedRoot] = useState(null);

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
        if (isUser) return; // avoid admin config call for non-admins
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
  }, [isUser]);


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

  // Fetch 5‑Matrix placed ACTIVE counts (level-wise)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await API.get("/accounts/genealogy/5m/counts/?" + (selectedRoot ? "root_id=" + encodeURIComponent(String(selectedRoot)) + "&" : "") + "depth=10", {
          cacheTTL: 10000,
          retryAttempts: 2,
        });
        if (!alive) return;
        setFiveCounts(res?.data || null);
      } catch (_) {
        // best-effort
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedRoot]);

  // Extract 5‑matrix progress only
  const fiveProgress = useMemo(() => {
    const arr = Array.isArray(data?.matrix_progress) ? data.matrix_progress : [];
    return (
      arr.find((p) => String(p?.pool_type).toUpperCase() === "FIVE_150") || null
    );
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

  const fiveRootsList = useMemo(() => {
    try {
      const arr = Array.isArray(myPositions) ? myPositions : [];
      const rows = arr.filter(
        (p) =>
          String(p?.pool_type) === "FIVE_150" &&
          String(p?.status || "").toUpperCase() === "ACTIVE"
      );
      try {
        return rows.sort(
          (a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0)
        );
      } catch {
        return rows;
      }
    } catch {
      return [];
    }
  }, [myPositions]);

  useEffect(() => {
    if (!selectedRoot && Array.isArray(fiveRootsList) && fiveRootsList.length > 0) {
      setSelectedRoot(fiveRootsList[0]?.id || null);
    }
  }, [fiveRootsList, selectedRoot]);

  const fiveActiveRoots = useMemo(() => {
    const arr = Array.isArray(myPositions) ? myPositions : [];
    return arr.filter(
      (p) =>
        String(p?.pool_type) === "FIVE_150" &&
        String(p?.status || "").toUpperCase() === "ACTIVE"
    ).length;
  }, [myPositions]);

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
        // ignore; visualization will remain empty if unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fiveProgress, levels]);

  const fiveLevelGrid = useMemo(() => {
    if (fiveCounts?.levels && Array.isArray(fiveCounts.levels)) {
      return fiveCounts.levels.map((x) => ({
        sn: Number(x.level),
        level: Number(x.level),
        count: Number(x.team_count || 0),
      }));
    }
    const plc = levelCounts || fiveProgress?.per_level_counts || {};
    const maxL = Math.max(1, Number(levels?.five ?? 10));
    const rows = [];
    for (let i = 1; i <= maxL; i += 1) {
      const raw = plc[String(i)];
      const count = Math.max(0, parseInt(raw ?? 0, 10) || 0);
      rows.push({ sn: i, level: i, count });
    }
    return rows;
  }, [fiveCounts, levelCounts, fiveProgress, levels]);

  const totalTeam = useMemo(() => {
    try {
      return (fiveLevelGrid || []).reduce((acc, r) => acc + Number(r?.count || 0), 0);
    } catch {
      return 0;
    }
  }, [fiveLevelGrid]);

  const activeLevelsReached = useMemo(() => {
    try {
      let active = 0;
      const rows = Array.isArray(fiveLevelGrid) ? fiveLevelGrid : [];
      for (let i = 1; i <= rows.length; i += 1) {
        const row = rows.find((r) => Number(r.level) === i);
        if (row && Number(row.count || 0) > 0) active = i;
        else break;
      }
      return active;
    } catch {
      return 0;
    }
  }, [fiveLevelGrid]);

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
    <Box
      sx={{
        maxWidth: 480,
        mx: "auto",
        p: 2,
      }}
    >
      {/* Header / Identity */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}
        >
          Genealogy Team
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5 }}>
          View your team. Click a member to drill down; use the breadcrumb to
          navigate back.
        </Typography>
        {role ? <Chip size="small" label={`Role: ${role}`} sx={{ mt: 1 }} /> : null}
      </Box>

      {err ? (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {err}
        </Typography>
      ) : null}

      {/* KPI Stat Strip — 3 equal tiles, compact, centered */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1.25,
          mb: 2,
        }}
      >
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "12px",
            p: 1,
            textAlign: "center",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Direct Referrals
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 800 }}>
            {String(directCount)}
          </Typography>
        </Box>

        {/* <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "12px",
            p: 1,
            textAlign: "center",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            5 Matrix Level Reached
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 800 }}>
            {String(fiveProgress?.level_reached ?? 0)}
          </Typography>
        </Box> */}

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "12px",
            p: 1,
            textAlign: "center",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Self Account
          </Typography>
          <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 800 }}>
            {String(myPositions.length)}
          </Typography>
        </Box>
      </Box>

      {/* 5‑Matrix Progress Visualization — vertical progress bars */}
      <Card variant="outlined" sx={{ borderRadius: "14px", mb: 2 }}>
  <CardContent sx={{ p: 2 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
      5 Matrix Progress
    </Typography>
    {Array.isArray(fiveRootsList) && fiveRootsList.length > 1 ? (
      <Box sx={{ mb: 1 }}>
        <FormControl fullWidth size="small">
          <InputLabel id="five-root-label">Select 5-Matrix Root</InputLabel>
          <Select
            labelId="five-root-label"
            label="Select 5-Matrix Root"
            value={selectedRoot || ""}
            onChange={(e) => setSelectedRoot(e.target.value || null)}
          >
            {fiveRootsList.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.username_key || `#${r.id}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    ) : null}
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 1,
        mb: 1,
      }}
    >
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "10px",
          p: 1,
          textAlign: "center",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Total Team
        </Typography>
        <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 800 }}>
          {Number(totalTeam).toLocaleString("en-IN")}
        </Typography>
      </Box>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "10px",
          p: 1,
          textAlign: "center",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Active Levels Reached
        </Typography>
        <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 800 }}>
          {String(activeLevelsReached)}
        </Typography>
      </Box>
    </Box>

    <Divider sx={{ mb: 1.5 }} />

    {(fiveLevelGrid || []).length === 0 ? (
      <Typography variant="body2" color="text.secondary">
        No 5 Matrix progress available yet.
      </Typography>
    ) : (
      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <Table
          size="small"
          sx={{
            minWidth: 420,
            borderCollapse: "collapse",

            "& th": {
              fontWeight: 700,
              backgroundColor: "#f1f5f9",
              color: "#0f172a",
            },

            "& td, & th": {
              border: "1px solid #e5e7eb",
              textAlign: "center",
              fontSize: 13,
              py: 1,
            },

            "& tr:nth-of-type(even)": {
              backgroundColor: "#f8fafc",
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>S.No</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Team Count</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {fiveLevelGrid.map((r) => (
              <TableRow key={r.level}>
                <TableCell>{r.sn}</TableCell>

                <TableCell>
                  {`Level-${r.level}`}
                </TableCell>

                <TableCell>
                  {Number(r.count).toLocaleString("en-IN")}
                </TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    )}
  </CardContent>
</Card>


      {/* Tabs directly under progress; full-width content; section spacing */}
<Box
  sx={{
    mt: 2,
    px: 1,
    py: 1,
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  }}
>
  <Tabs
    value={tab}
    onChange={(_, v) => setTab(v)}
    variant="fullWidth"
    TabIndicatorProps={{
      style: {
        height: 3,
        borderRadius: 3,
      },
    }}
    sx={{
      "& .MuiTab-root": {
        textTransform: "none",
        fontWeight: 600,
        fontSize: 10,
        minHeight: 64,
        lineHeight: 1.2,
      },
      "& .MuiTab-iconWrapper": {
        marginBottom: 4,
      },
    }}
  >
    <Tab
      icon={<AccountTreeIcon />}
      iconPosition="top"
      label="Tree"
      value="tree"
    />

    <Tab
      icon={<GroupsIcon />}
      iconPosition="top"
      label={`Direct\n(${directCount})`}
      value="direct"
    />

    <Tab
      icon={<PlaceIcon />}
      iconPosition="top"
      label={`Self Account (${myPositions.length})`}
      value="positions"
    />
  </Tabs>
</Box>


      {tab === "tree" ? (
        <Box sx={{ mb: 2, mt: 2 }}>
          <GenealogyTree5 initialPool="FIVE_150" maxDepth={10} showPlaceholders useEntriesTree entryRootId={selectedRoot} />
        </Box>
      ) : tab === "direct" ? (
        <Box sx={{ mb: 2, mt : 2 }}>
          <DirectSponsorsList
            list={Array.isArray(data?.direct_team) ? data.direct_team : []}
            counts={data?.direct_team_counts}
          />
        </Box>
      ) : (
        <Box sx={{ mb: 2, mt : 2 }}>
          <MyPositionsPanel positions={myPositions} />
        </Box>
      )}
    </Box>
  );
}
