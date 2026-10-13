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
  Divider,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import API from "../../api/api";

export default function DistrictPincodeCoverageCenter({ user, role }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE_AGENCY, INACTIVE_AGENCY, VACANT_AGENCY, ACTIVE_COORD, VACANT_COORD

  const fetchDistrictData = useCallback(async (distName = "") => {
    setLoading(true);
    try {
      const q = distName ? `?district=${encodeURIComponent(distName)}` : "";
      const res = await API.get(`/agency/district-pincodes/${q}`);
      if (res?.data) {
        setData(res.data);
        if (!distName && res.data.district) {
          setSelectedDistrict(res.data.district);
        }
      }
    } catch (err) {
      console.error("Failed to load district pincodes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDistrictData(selectedDistrict);
  }, [fetchDistrictData, selectedDistrict]);

  const summary = data?.summary || {
    total_pincodes: 0,
    active_agencies: 0,
    inactive_agencies: 0,
    vacant_agencies: 0,
    active_coordinators: 0,
    inactive_coordinators: 0,
    vacant_coordinators: 0,
    total_users: 0,
    total_merchants: 0,
    total_captains: 0,
  };

  const assignedDistricts = data?.assigned_districts || [];

  // Filter pincodes by search and status
  const filteredPincodes = useMemo(() => {
    const list = data?.pincodes || [];
    return list.filter((p) => {
      // 1. Search term match
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const pinMatch = p.pincode.includes(q);
        const agencyNameMatch = (p.agency?.name || "").toLowerCase().includes(q);
        const agencyCodeMatch = (p.agency?.code || "").toLowerCase().includes(q);
        const agencyPhoneMatch = (p.agency?.phone || "").includes(q);
        const coordNameMatch = (p.coordinator?.name || "").toLowerCase().includes(q);
        const coordCodeMatch = (p.coordinator?.code || "").toLowerCase().includes(q);
        const coordPhoneMatch = (p.coordinator?.phone || "").includes(q);
        if (!pinMatch && !agencyNameMatch && !agencyCodeMatch && !agencyPhoneMatch && !coordNameMatch && !coordCodeMatch && !coordPhoneMatch) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter === "ACTIVE_AGENCY") {
        return p.agency?.status === "ACTIVE";
      }
      if (statusFilter === "INACTIVE_AGENCY") {
        return p.agency?.status === "INACTIVE";
      }
      if (statusFilter === "VACANT_AGENCY") {
        return p.agency?.status === "VACANT";
      }
      if (statusFilter === "ACTIVE_COORD") {
        return p.coordinator?.status === "ACTIVE";
      }
      if (statusFilter === "VACANT_COORD") {
        return p.coordinator?.status === "VACANT";
      }

      return true;
    });
  }, [data, searchTerm, statusFilter]);

  return (
    <Box sx={{ width: "100%", pb: 3 }}>
      {/* ── TOP HEADER / DISTRICT SELECTOR ── */}
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
            <Avatar sx={{ bgcolor: "#2563EB", color: "#FFFFFF", width: 38, height: 38 }}>
              <LocationOnRoundedIcon sx={{ fontSize: 22 }} />
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 950, color: "#0F172A" }}>
                {data?.district || "District"} Territory Command
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#64748B" }}>
                State: {data?.state || "Karnataka"} • Total {summary.total_pincodes} Pincodes
              </Typography>
            </Box>
          </Stack>
          <IconButton
            size="small"
            onClick={() => fetchDistrictData(selectedDistrict)}
            sx={{ border: "1px solid #E2E8F0", borderRadius: "10px" }}
          >
            <RefreshRoundedIcon sx={{ fontSize: 18, color: "#64748B" }} />
          </IconButton>
        </Stack>

        {/* Assigned District Switcher (if user has multiple districts) */}
        {assignedDistricts.length > 1 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748B", mb: 0.8 }}>
              Assigned Districts Jurisdiction:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
              {assignedDistricts.map((d) => {
                const isSelected = (selectedDistrict || data?.district) === d;
                return (
                  <Chip
                    key={d}
                    label={d}
                    clickable
                    onClick={() => setSelectedDistrict(d)}
                    sx={{
                      fontWeight: 800,
                      fontSize: 11.5,
                      bgcolor: isSelected ? "#2563EB" : "#F1F5F9",
                      color: isSelected ? "#FFFFFF" : "#475569",
                      borderRadius: "10px",
                    }}
                  />
                );
              })}
            </Stack>
          </Box>
        )}

        {/* ── KPI METRICS CARDS ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.2, pt: 0.5 }}>
          <Box sx={{ p: 1.2, bgcolor: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#64748B" }}>Pincode Agencies</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A", my: 0.2 }}>
              {summary.active_agencies} Active
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#94A3B8" }}>
              {summary.inactive_agencies} Inactive • {summary.vacant_agencies} Vacant
            </Typography>
          </Box>

          <Box sx={{ p: 1.2, bgcolor: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#64748B" }}>Pincode Coordinators</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A", my: 0.2 }}>
              {summary.active_coordinators} Active
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#94A3B8" }}>
              {summary.vacant_coordinators} Vacant Slots
            </Typography>
          </Box>

          <Box sx={{ p: 1.2, bgcolor: "#EFF6FF", borderRadius: "12px", border: "1px solid #BFDBFE" }}>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <GroupsOutlinedIcon sx={{ fontSize: 15, color: "#2563EB" }} />
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: "#1E40AF" }}>Consumer Agents</Typography>
            </Stack>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#1D4ED8", mt: 0.2 }}>
              {summary.total_users.toLocaleString("en-IN")}
            </Typography>
          </Box>

          <Box sx={{ p: 1.2, bgcolor: "#ECFDF5", borderRadius: "12px", border: "1px solid #A7F3D0" }}>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <StoreRoundedIcon sx={{ fontSize: 15, color: "#059669" }} />
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: "#065F46" }}>Merchants / Captains</Typography>
            </Stack>
            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#047857", mt: 0.2 }}>
              {summary.total_merchants} / {summary.total_captains}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: "16px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by 6-digit PIN, officer or coordinator name..."
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
            { id: "ALL", label: `All (${summary.total_pincodes})` },
            { id: "ACTIVE_AGENCY", label: `Active Agency (${summary.active_agencies})`, color: "#059669" },
            { id: "INACTIVE_AGENCY", label: `Inactive (${summary.inactive_agencies})`, color: "#DC2626" },
            { id: "VACANT_AGENCY", label: `Vacant Agency (${summary.vacant_agencies})`, color: "#64748B" },
            { id: "ACTIVE_COORD", label: `Active Coord (${summary.active_coordinators})`, color: "#2563EB" },
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

      {/* ── PINCODES LIST ── */}
      {loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={30} />
        </Box>
      ) : filteredPincodes.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: "18px", textAlign: "center", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
          <LocationOnRoundedIcon sx={{ fontSize: 36, color: "#CBD5E1", mb: 1 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#64748B" }}>
            No pincodes found
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: "#94A3B8", mt: 0.3 }}>
            Try adjusting your search query or filter selection.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filteredPincodes.map((p) => {
            const agencyStatus = p.agency?.status || "VACANT";
            const coordStatus = p.coordinator?.status || "VACANT";

            return (
              <Paper
                key={p.pincode}
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
                {/* Header: PIN + Location + User Headcount */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={`PIN ${p.pincode}`}
                      size="small"
                      sx={{
                        fontWeight: 950,
                        fontSize: 12,
                        bgcolor: "#0F172A",
                        color: "#FFFFFF",
                        borderRadius: "8px",
                        height: 24,
                      }}
                    />
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
                      {p.district}
                    </Typography>
                  </Stack>

                  {/* Clean User Headcount Pill */}
                  <Chip
                    icon={<GroupsOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                    label={`${p.user_count} Users`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: 11,
                      bgcolor: p.user_count > 0 ? "#EFF6FF" : "#F8FAFC",
                      color: p.user_count > 0 ? "#1D4ED8" : "#94A3B8",
                      borderRadius: "8px",
                      height: 24,
                    }}
                  />
                </Stack>

                {/* Agency & Coordinator Rows */}
                <Box
                  sx={{
                    bgcolor: "#F8FAFC",
                    borderRadius: "12px",
                    p: 1.2,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 1.2,
                  }}
                >
                  {/* Agency Officer */}
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Pincode Agency
                    </Typography>
                    {agencyStatus === "ACTIVE" ? (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CheckCircleRoundedIcon sx={{ fontSize: 13, color: "#059669" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#059669" }}>
                            Active
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A", noWrap: true }}>
                          {p.agency.name || "Agency Head"}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "#64748B" }}>
                          {p.agency.phone || p.agency.code}
                        </Typography>
                      </Box>
                    ) : agencyStatus === "INACTIVE" ? (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CancelRoundedIcon sx={{ fontSize: 13, color: "#DC2626" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#DC2626" }}>
                            Inactive
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A", noWrap: true }}>
                          {p.agency.name}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "#64748B" }}>
                          {p.agency.phone}
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

                  {/* Pincode Coordinator */}
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Coordinator
                    </Typography>
                    {coordStatus === "ACTIVE" ? (
                      <Box sx={{ mt: 0.4 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CheckCircleRoundedIcon sx={{ fontSize: 13, color: "#2563EB" }} />
                          <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#2563EB" }}>
                            Active
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A", noWrap: true }}>
                          {p.coordinator.name || "Coordinator"}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "#64748B" }}>
                          {p.coordinator.phone || p.coordinator.code}
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
                          {p.coordinator.name}
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

                {/* Auxiliary metrics: Merchants & Captains */}
                {(p.merchant_count > 0 || p.captain_count > 0) && (
                  <Stack direction="row" spacing={1.5} sx={{ mt: 1, px: 0.5 }}>
                    <Typography sx={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>
                      🏪 {p.merchant_count} Merchants
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "#7C3AED", fontWeight: 700 }}>
                      🛡️ {p.captain_count} Captains
                    </Typography>
                  </Stack>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
