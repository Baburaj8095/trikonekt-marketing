import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  MenuItem,
  Grid,
} from "@mui/material";
import {
  AccountTreeRounded as LayersIcon,
  UpgradeRounded as RankUpIcon,
  SearchRounded as SearchIcon,
  RefreshRounded as RefreshIcon,
  CheckCircleRounded as ActiveIcon,
  PersonRounded as PersonIcon,
  TrendingUpRounded as GrowthIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";
import { C, R, S } from "../../theme/tokens";
import StatusBadge from "../../components/common/StatusBadge";

export default function LayersBlocks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({ total_team: 0, active_team: 0, direct_referrals: 0, max_layer: 5 });
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState("ALL");

  const fetchLayers = async () => {
    try {
      setLoading(true);
      const res = await API.get("/accounts/team/members/");
      const rawMembers = Array.isArray(res.data) ? res.data : res.data.results || [];
      
      const mapped = rawMembers.map((m, idx) => ({
        id: m.id || idx + 1,
        username: m.username || "-",
        full_name: m.full_name || m.name || m.username || "Team Member",
        phone: m.phone || m.mobile || "-",
        sponsor: m.sponsor_id || m.sponsor_phone || "Direct",
        layer: m.depth || m.level || ((idx % 5) + 1),
        package: m.package_name || (m.has_prime ? "E-edu Agent (₹2,000)" : "General User"),
        is_active: m.is_active !== false,
        joined_at: m.created_at || m.date_joined || "-",
      }));

      setMembers(mapped);
      setStats({
        total_team: mapped.length,
        active_team: mapped.filter((m) => m.is_active).length,
        direct_referrals: mapped.filter((m) => m.layer === 1).length,
        max_layer: Math.max(1, ...mapped.map((m) => Number(m.layer) || 1)),
      });
    } catch (err) {
      console.error("Failed to fetch layers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLayers();
  }, []);

  const filteredMembers = members.filter((m) => {
    const matchSearch =
      m.username.toLowerCase().includes(search.toLowerCase()) ||
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search);
    const matchLayer = layerFilter === "ALL" || String(m.layer) === String(layerFilter);
    return matchSearch && matchLayer;
  });

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 1.5, sm: 2.5, md: 3 } }}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3.5,
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          color: "#fff",
          mb: 3,
          boxShadow: S.card,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
              <LayersIcon sx={{ fontSize: 32, color: "#38BDF8" }} />
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>
                Layers Blocks (Genealogy List)
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "#94A3B8", fontWeight: 500, fontSize: "13.5px" }}>
              Streamlined tabular layer tracking across your direct sponsors, sub-accounts, and team nodes
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
            <IconButton
              onClick={fetchLayers}
              disabled={loading}
              sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.18)" } }}
            >
              <RefreshIcon sx={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </IconButton>

            <Button
              variant="contained"
              fullWidth
              startIcon={<RankUpIcon />}
              onClick={() => navigate("/user/rank-upgrade")}
              sx={{
                background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)",
                color: "#fff",
                fontWeight: 900,
                px: 3,
                py: 1,
                borderRadius: 2.5,
                textTransform: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(139,92,246,0.4)",
              }}
            >
              Rank UP (Digital Education)
            </Button>
          </Stack>
        </Stack>

        {/* Stats Grid */}
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Total Team</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#38BDF8" }}>{stats.total_team} Members</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Active E-Edu</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#4ADE80" }}>{stats.active_team} Active</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Direct Referrals</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#FBBF24" }}>{stats.direct_referrals} Direct</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>Layers Depth</Typography>
              <Typography sx={{ fontSize: "18px", fontWeight: 900, color: "#C084FC" }}>{stats.max_layer} Layers</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Filters Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          border: "1.5px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          boxShadow: S.card,
          mb: 2.5,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.5,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <TextField
          size="small"
          placeholder="Search by name, username or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: "100%", sm: 340 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" }, overflowX: "auto" }}>
          {["ALL", "1", "2", "3", "4", "5"].map((lvl) => (
            <Button
              key={lvl}
              size="small"
              onClick={() => setLayerFilter(lvl)}
              sx={{
                px: 2,
                py: 0.6,
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 800,
                textTransform: "none",
                whiteSpace: "nowrap",
                bgcolor: layerFilter === lvl ? "#0F172A" : "#F1F5F9",
                color: layerFilter === lvl ? "#FFFFFF" : "#475569",
                "&:hover": { bgcolor: layerFilter === lvl ? "#1E293B" : "#E2E8F0" },
              }}
            >
              {lvl === "ALL" ? "All Layers" : `Layer ${lvl}`}
            </Button>
          ))}
        </Stack>
      </Paper>

      {/* Layers Table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3.5,
          border: "1.5px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          boxShadow: S.card,
          overflow: "hidden",
        }}
      >
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>LAYER</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>MEMBER / USER</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>PHONE / ID</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>SPONSOR</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>ACTIVE PACKAGE</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "#475569", fontSize: "12px" }}>STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6 }}>
                    <CircularProgress size={32} sx={{ color: "#2563EB" }} />
                    <Typography sx={{ fontSize: "13px", color: "#64748B", mt: 1 }}>Loading layer blocks...</Typography>
                  </TableCell>
                </TableRow>
              ) : filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6 }}>
                    <PersonIcon sx={{ fontSize: 40, color: "#94A3B8", mb: 1 }} />
                    <Typography sx={{ fontWeight: 800, color: "#334155" }}>No members found in this layer</Typography>
                    <Typography sx={{ fontSize: "12.5px", color: "#64748B" }}>Share your referral link to build your layer tree.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((m) => (
                  <TableRow key={m.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell>
                      <Chip
                        size="small"
                        label={`Layer ${m.layer}`}
                        sx={{
                          fontWeight: 800,
                          fontSize: "11px",
                          bgcolor: m.layer === 1 ? "#DCFCE7" : m.layer === 2 ? "#EFF6FF" : "#F1F5F9",
                          color: m.layer === 1 ? "#16A34A" : m.layer === 2 ? "#2563EB" : "#475569",
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 800, fontSize: "13px", color: "#0F172A" }}>{m.full_name}</Typography>
                      <Typography sx={{ fontSize: "11px", color: "#64748B" }}>@{m.username}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: "12.5px", fontFamily: "monospace", fontWeight: 700, color: "#334155" }}>
                      {m.phone}
                    </TableCell>
                    <TableCell sx={{ fontSize: "12px", color: "#64748B" }}>{m.sponsor}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={m.package}
                        sx={{ fontWeight: 700, fontSize: "11px", bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={m.is_active ? "Active" : "Inactive"} color={m.is_active ? "success" : "default"} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
