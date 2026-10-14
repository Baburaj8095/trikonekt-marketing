import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  IconButton,
  Button,
  Avatar,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import API from "../../api/api";

export default function StateDistrictRollupCenter({ user, role }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedState, setSelectedState] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE_HEAD, INACTIVE_HEAD, VACANT_HEAD, ACTIVE_COORD, VACANT_COORD

  const fetchStateData = useCallback(async (stateName = "") => {
    setLoading(true);
    try {
      const q = stateName ? `?state=${encodeURIComponent(stateName)}` : "";
      const res = await API.get(`/agency/state-districts/${q}`);
      if (res?.data) {
        setData(res.data);
        if (!stateName && res.data.state) {
          setSelectedState(res.data.state);
        }
      }
    } catch (err) {
      console.error("Failed to load state districts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStateData(selectedState);
  }, [fetchStateData, selectedState]);

  const summary = data?.summary || {
    total_districts: 0,
    active_heads: 0,
    inactive_heads: 0,
    vacant_heads: 0,
    active_coordinators: 0,
    inactive_coordinators: 0,
    vacant_coordinators: 0,
    total_merchants: 0,
    total_captains: 0,
    total_users: 0,
  };

  const assignedStates = data?.assigned_states || [];

  // Filter districts by search and status
  const filteredDistricts = useMemo(() => {
    const list = data?.districts || [];
    return list.filter((d) => {
      // 1. Search term match
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const distMatch = d.district.toLowerCase().includes(q);
        const headMatch = (d.district_head?.name || "").toLowerCase().includes(q);
        const coordMatch = (d.district_coordinator?.name || "").toLowerCase().includes(q);
        if (!distMatch && !headMatch && !coordMatch) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter === "ACTIVE_HEAD") {
        return d.district_head?.status === "ACTIVE";
      }
      if (statusFilter === "INACTIVE_HEAD") {
        return d.district_head?.status === "INACTIVE";
      }
      if (statusFilter === "VACANT_HEAD") {
        return d.district_head?.status === "VACANT";
      }
      if (statusFilter === "ACTIVE_COORD") {
        return d.district_coordinator?.status === "ACTIVE";
      }
      if (statusFilter === "VACANT_COORD") {
        return d.district_coordinator?.status === "VACANT";
      }

      return true;
    });
  }, [data, searchTerm, statusFilter]);

  return (
    <Box sx={{ width: "100%", pb: 3 }}>
      {/* ── TOP HEADER / STATE SELECTOR ── */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: "18px",
          bgcolor: "#FFFFFF",
          border: "1px solid #EEF2F6",
          mb: 2,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Avatar sx={{ bgcolor: "#7C3AED", color: "#FFFFFF", width: 38, height: 38 }}>
              <PublicRoundedIcon sx={{ fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 950, color: "#0F172A" }}>
                {data?.state || "State"} Territory Command
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#64748B" }}>
                Total {summary.total_districts} Districts Rollup Overview
              </Typography>
            </Box>
          </Stack>
          <IconButton
            size="small"
            onClick={() => fetchStateData(selectedState)}
            sx={{ border: "1px solid #E2E8F0", borderRadius: "10px" }}
          >
            <RefreshRoundedIcon sx={{ fontSize: 18, color: "#64748B" }} />
          </IconButton>
        </Stack>

        {/* Assigned States Switcher (if assigned multiple states, e.g. Karnataka & Goa) */}
        {assignedStates.length > 1 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748B", mb: 0.8 }}>
              Assigned State Jurisdiction:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
              {assignedStates.map((st) => {
                const isSelected = (selectedState || data?.state) === st;
                return (
                  <Chip
                    key={st}
                    label={st}
                    clickable
                    onClick={() => setSelectedState(st)}
                    sx={{
                      fontWeight: 800,
                      fontSize: 11.5,
                      bgcolor: isSelected ? "#7C3AED" : "#F1F5F9",
                      color: isSelected ? "#FFFFFF" : "#475569",
                      borderRadius: "10px",
                    }}
                  />
                );
              })}
            </Stack>
          </Box>
        )}

        {/* ── KPI METRICS ROLLUP ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.2, pt: 0.5 }}>
          <Box sx={{ p: 1.2, bgcolor: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#64748B" }}>District Heads</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A", my: 0.2 }}>
              {summary.active_heads} Active
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#94A3B8" }}>
              {summary.inactive_heads} Inactive • {summary.vacant_heads} Vacant
            </Typography>
          </Box>

          <Box sx={{ p: 1.2, bgcolor: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#64748B" }}>District Coordinators</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A", my: 0.2 }}>
              {summary.active_coordinators} Active
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#94A3B8" }}>
              {summary.vacant_coordinators} Vacant Slots
            </Typography>
          </Box>

          <Box sx={{ p: 1.2, bgcolor: "#ECFDF5", borderRadius: "12px", border: "1px solid #A7F3D0" }}>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <StoreRoundedIcon sx={{ fontSize: 15, color: "#059669" }} />
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: "#065F46" }}>Total Merchants</Typography>
            </Stack>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#047857", mt: 0.2 }}>
              {summary.total_merchants} Shops
            </Typography>
          </Box>

          <Box sx={{ p: 1.2, bgcolor: "#FAF5FF", borderRadius: "12px", border: "1px solid #E9D5FF" }}>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <ShieldRoundedIcon sx={{ fontSize: 15, color: "#7C3AED" }} />
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: "#6B21A8" }}>Total Captains</Typography>
            </Stack>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#7C3AED", mt: 0.2 }}>
              {summary.total_captains} Field Captains
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: "16px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by district name or officer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm("")}>
                  <ClearRoundedIcon sx={{ fontSize: 18, color: "#94A3B8" }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "12px",
              bgcolor: "#F8FAFC",
              fontSize: 12.5,
            },
          }}
        />

        {/* Filter Pills */}
        <Stack direction="row" spacing={0.8} sx={{ overflowX: "auto", pt: 1.2, pb: 0.2 }}>
          {[
            { id: "ALL", label: `All (${summary.total_districts})` },
            { id: "ACTIVE_HEAD", label: `Active Heads (${summary.active_heads})`, color: "#059669" },
            { id: "INACTIVE_HEAD", label: `Inactive (${summary.inactive_heads})`, color: "#DC2626" },
            { id: "VACANT_HEAD", label: `Vacant Heads (${summary.vacant_heads})`, color: "#64748B" },
            { id: "ACTIVE_COORD", label: `Active Coord (${summary.active_coordinators})`, color: "#7C3AED" },
            { id: "VACANT_COORD", label: `Vacant Coord (${summary.vacant_coordinators})`, color: "#64748B" },
          ].map((f) => {
            const isSelected = statusFilter === f.id;
            return (
              <Chip
                key={f.id}
                size="small"
                label={f.label}
                clickable
                onClick={() => setStatusFilter(f.id)}
                sx={{
                  fontWeight: 800,
                  fontSize: 11,
                  bgcolor: isSelected ? (f.color || "#0F172A") : "#F1F5F9",
                  color: isSelected ? "#FFFFFF" : "#475569",
                  borderRadius: "8px",
                  height: 26,
                }}
              />
            );
          })}
        </Stack>
      </Paper>

      {/* ── DISTRICTS ROLLUP LIST ── */}
      {loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={30} />
        </Box>
      ) : filteredDistricts.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: "18px", textAlign: "center", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
          <PublicRoundedIcon sx={{ fontSize: 36, color: "#CBD5E1", mb: 1 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#64748B" }}>
            No districts found
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: "#94A3B8", mt: 0.3 }}>
            Try adjusting your search query or filter selection.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filteredDistricts.map((d) => {
            const headStatus = d.district_head?.status || "VACANT";
            const coordStatus = d.district_coordinator?.status || "VACANT";

            return (
              <Paper
                key={d.district}
                elevation={0}
                sx={{
                  p: 1.8,
                  borderRadius: "18px",
                  bgcolor: "#FFFFFF",
                  border: "1px solid #EEF2F6",
                  transition: "all 0.15s ease",
                  "&:hover": { borderColor: "#CBD5E1" },
                }}
              >
                {/* Header: District Name + Pincodes count */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 950, color: "#0F172A" }}>
                    {d.district}
                  </Typography>
                  <Chip
                    label={`${d.pincodes_count || 0} Pincodes`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: 11,
                      bgcolor: "#F1F5F9",
                      color: "#475569",
                      borderRadius: "8px",
                      height: 24,
                    }}
                  />
                </Stack>

                {/* Leadership Status Grid */}
                <Box
                  sx={{
                    bgcolor: "#F8FAFC",
                    borderRadius: "12px",
                    p: 1.2,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 1.2,
                    mb: 1.2,
                  }}
                >
                  {/* District Head */}
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      District Head
                    </Typography>
                    {headStatus === "ACTIVE" ? (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CheckCircleRoundedIcon sx={{ fontSize: 13, color: "#059669" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#059669" }}>
                            Active
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A", noWrap: true }}>
                          {d.district_head.name || "District Officer"}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "#64748B" }}>
                          {d.district_head.phone || d.district_head.code}
                        </Typography>
                      </Box>
                    ) : headStatus === "INACTIVE" ? (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CancelRoundedIcon sx={{ fontSize: 13, color: "#DC2626" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#DC2626" }}>
                            Inactive
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A", noWrap: true }}>
                          {d.district_head.name}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13, color: "#94A3B8" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#94A3B8" }}>
                            Vacant Slot
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 10.5, color: "#94A3B8", fontStyle: "italic", mt: 0.2 }}>
                          Ready for partner
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* District Coordinator */}
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Coordinator
                    </Typography>
                    {coordStatus === "ACTIVE" ? (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CheckCircleRoundedIcon sx={{ fontSize: 13, color: "#7C3AED" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#7C3AED" }}>
                            Active
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A", noWrap: true }}>
                          {d.district_coordinator.name || "Coordinator"}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "#64748B" }}>
                          {d.district_coordinator.phone || d.district_coordinator.code}
                        </Typography>
                      </Box>
                    ) : coordStatus === "INACTIVE" ? (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CancelRoundedIcon sx={{ fontSize: 13, color: "#DC2626" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#DC2626" }}>
                            Inactive
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A", noWrap: true }}>
                          {d.district_coordinator.name}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 13, color: "#94A3B8" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#94A3B8" }}>
                            Vacant Slot
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 10.5, color: "#94A3B8", fontStyle: "italic", mt: 0.2 }}>
                          No coordinator
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Headcounts Rollup Pill Bar: Merchants, Captains, Consumers */}
                <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
                  <Chip
                    icon={<StoreRoundedIcon sx={{ fontSize: "14px !important" }} />}
                    label={`${d.merchants_count || 0} Merchants`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: 10.5,
                      bgcolor: "#ECFDF5",
                      color: "#047857",
                      borderRadius: "8px",
                      height: 24,
                    }}
                  />
                  <Chip
                    icon={<ShieldRoundedIcon sx={{ fontSize: "14px !important" }} />}
                    label={`${d.captains_count || 0} Captains`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: 10.5,
                      bgcolor: "#FAF5FF",
                      color: "#7E22CE",
                      borderRadius: "8px",
                      height: 24,
                    }}
                  />
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
