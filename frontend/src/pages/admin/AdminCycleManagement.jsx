import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import EditIcon from "@mui/icons-material/Edit";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import API from "../../api/api";

export default function AdminCycleManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // State selection
  const [statesList, setStatesList] = useState([]);
  const [selectedStateId, setSelectedStateId] = useState("");

  // Cycles data
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Activate action loading
  const [activatingCycleId, setActivatingCycleId] = useState(null);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("CREATE"); // "CREATE" | "EDIT"
  const [editingCycle, setEditingCycle] = useState(null);
  const [formCycleNum, setFormCycleNum] = useState("");
  const [formCycleLabel, setFormCycleLabel] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formSetActive, setFormSetActive] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // 1. Fetch States list
  const fetchStates = useCallback(async () => {
    try {
      const res = await API.get("/admin/ssv/states/");
      const states = res?.data?.states || [];
      setStatesList(states);

      const urlStateId = searchParams.get("state_id");
      if (urlStateId && states.some((s) => String(s.id) === String(urlStateId))) {
        setSelectedStateId(Number(urlStateId));
      } else if (states.length > 0) {
        const ktk = states.find((s) => s.name?.toLowerCase().includes("karnataka"));
        setSelectedStateId(ktk ? ktk.id : states[0].id);
      }
    } catch (e) {
      setFeedback({ type: "error", message: "Failed to load states: " + (e.response?.data?.detail || e.message) });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  // 2. Fetch Cycles for selected state
  const fetchCycles = useCallback(async () => {
    if (!selectedStateId) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await API.get(`/admin/ssv/cycles/?state_id=${selectedStateId}`);
      setCycles(res?.data?.cycles || []);
    } catch (e) {
      setFeedback({ type: "error", message: "Failed to load cycles: " + (e.response?.data?.detail || e.message) });
    } finally {
      setLoading(false);
    }
  }, [selectedStateId]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  // Handle Cycle Activation
  const handleActivateCycle = async (cycle) => {
    if (!cycle) return;
    setActivatingCycleId(cycle.id);
    setFeedback(null);
    try {
      const res = await API.post("/admin/ssv/cycles/activate/", {
        state_id: selectedStateId,
        cycle_id: cycle.id,
        cycle_number: cycle.cycle_number,
      });
      setFeedback({
        type: "success",
        message: res.data?.message || `${cycle.cycle_label} is now active. All user eligibility and vouchers are now scoped to this cycle!`,
      });
      await fetchCycles();
    } catch (e) {
      setFeedback({ type: "error", message: e.response?.data?.detail || "Failed to activate cycle." });
    } finally {
      setActivatingCycleId(null);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const nextNum = (cycles.length > 0 ? Math.max(...cycles.map((c) => c.cycle_number)) : 0) + 1;
    setModalMode("CREATE");
    setEditingCycle(null);
    setFormCycleNum(String(nextNum));
    setFormCycleLabel(`Cycle ${nextNum}`);
    setFormStartDate("");
    setFormEndDate("");
    setFormSetActive(cycles.length === 0);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cycle) => {
    setModalMode("EDIT");
    setEditingCycle(cycle);
    setFormCycleNum(String(cycle.cycle_number));
    setFormCycleLabel(cycle.cycle_label || `Cycle ${cycle.cycle_number}`);
    setFormStartDate(cycle.start_date || "");
    setFormEndDate(cycle.end_date || "");
    setFormSetActive(cycle.is_active);
    setModalOpen(true);
  };

  // Submit Save Cycle
  const handleSaveCycle = async () => {
    if (!formCycleNum) {
      setFeedback({ type: "error", message: "Cycle Number is required." });
      return;
    }
    setModalSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        id: editingCycle ? editingCycle.id : undefined,
        state_id: selectedStateId,
        cycle_number: Number(formCycleNum),
        cycle_label: formCycleLabel || `Cycle ${formCycleNum}`,
        start_date: formStartDate || undefined,
        end_date: formEndDate || undefined,
        is_active: formSetActive,
      };
      const res = await API.post("/admin/ssv/cycles/save/", payload);
      setFeedback({ type: "success", message: res.data?.message || "Cycle saved successfully." });
      setModalOpen(false);
      await fetchCycles();
    } catch (e) {
      setFeedback({ type: "error", message: e.response?.data?.detail || "Failed to save cycle." });
    } finally {
      setModalSubmitting(false);
    }
  };

  const activeCycle = cycles.find((c) => c.is_active);
  const selectedStateObj = statesList.find((s) => String(s.id) === String(selectedStateId));

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f8fafc", minHeight: "100vh" }}>
      {/* Top Header */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
          p: 2.5,
          bgcolor: "#ffffff",
          borderRadius: 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={() => navigate("/admin/ssv-vouchers")} sx={{ bgcolor: "#f1f5f9" }}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#1e293b" }}>
              Cycle Management
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b" }}>
              Configure, schedule, and activate state-wise SSV cycles. Only ONE cycle can be active per state at a time.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          {/* State Selector */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#475569" }}>
              State:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                sx={{ bgcolor: "#ffffff", fontWeight: 600, borderRadius: 1.5 }}
              >
                {statesList.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Button
            variant="contained"
            color="success"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleOpenCreateModal}
            sx={{
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
              px: 2.5,
              bgcolor: "#16a34a",
              "&:hover": { bgcolor: "#15803d" },
            }}
          >
            Add New Cycle
          </Button>

          <Button
            variant="outlined"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate(`/admin/ssv-vouchers?state_id=${selectedStateId}&cycle=${activeCycle?.cycle_number || 1}`)}
            sx={{ fontWeight: 600, textTransform: "none", borderRadius: 2 }}
          >
            Go to SSV Vouchers Board
          </Button>
        </Box>
      </Box>

      {feedback && (
        <Alert
          severity={feedback.type}
          onClose={() => setFeedback(null)}
          sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}
        >
          {feedback.message}
        </Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Total Cycles Configured
                </Typography>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "#eff6ff", color: "#2563eb" }}>
                  <EventAvailableIcon fontSize="small" />
                </Box>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: "#1e293b" }}>
                {cycles.length}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b" }}>
                In {selectedStateObj?.name || "Selected State"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              borderRadius: 2,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              height: "100%",
              border: "1.5px solid #22c55e",
              bgcolor: "#f0fdf4",
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#15803d", textTransform: "uppercase" }}>
                  Currently Active Cycle
                </Typography>
                <Chip label="LIVE" color="success" size="small" sx={{ fontWeight: 800, height: 22 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#14532d" }}>
                {activeCycle ? activeCycle.cycle_label : "No Active Cycle"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#15803d", fontWeight: 600 }}>
                {activeCycle ? activeCycle.duration : "Please activate a cycle"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Active Cycle Eligible Users
                </Typography>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "#f3e8ff", color: "#9333ea" }}>
                  <PeopleAltIcon fontSize="small" />
                </Box>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: "#1e293b" }}>
                {activeCycle?.eligible_users || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b" }}>
                Based on paid boxes in this cycle window
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Vouchers Issued (Active Cycle)
                </Typography>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "#ecfdf5", color: "#059669" }}>
                  <ConfirmationNumberIcon fontSize="small" />
                </Box>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: "#1e293b" }}>
                {activeCycle?.vouchers_created || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b" }}>
                Redeemed: {activeCycle?.vouchers_redeemed || 0} | Pending: {activeCycle?.pending_vouchers || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Cycles Table Card */}
      <Card sx={{ borderRadius: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <Box
          sx={{
            p: 2.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b" }}>
              All Cycles for {selectedStateObj?.name || "State"}
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              Activating a cycle immediately shifts all voucher issuance, KPI reports, and eligibility queries to that cycle.
            </Typography>
          </Box>
          <Tooltip title="Refresh Cycles">
            <IconButton onClick={fetchCycles} disabled={loading} sx={{ bgcolor: "#f1f5f9" }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <TableContainer component={Paper} elevation={0}>
          <Table>
            <TableHead sx={{ bgcolor: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Cycle Label</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Duration Window</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }} align="center">
                  Eligible Users
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }} align="center">
                  Created Vouchers
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }} align="center">
                  Redeemed
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }} align="center">
                  Pending
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }} align="center">
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }} align="right">
                  Actions & Controls
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" sx={{ mt: 1, color: "#64748b" }}>
                      Loading cycles...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : cycles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Typography variant="body1" sx={{ color: "#64748b" }}>
                      No cycles configured for this state yet.
                    </Typography>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<AddCircleOutlineIcon />}
                      onClick={handleOpenCreateModal}
                      sx={{ mt: 2, textTransform: "none", borderRadius: 2 }}
                    >
                      Create First Cycle
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                cycles.map((c) => (
                  <TableRow
                    key={c.id}
                    sx={{
                      bgcolor: c.is_active ? "#f0fdf4" : "inherit",
                      "&:hover": { bgcolor: c.is_active ? "#dcfce7" : "#f8fafc" },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700, color: "#1e293b" }}>{c.cycle_number}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#0f172a" }}>{c.cycle_label}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "#334155" }}>
                          {c.duration}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={c.eligible_users}
                        size="small"
                        sx={{ fontWeight: 700, bgcolor: "#eff6ff", color: "#1d4ed8" }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#475569" }}>
                        {c.vouchers_created}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#16a34a" }}>
                        {c.vouchers_redeemed}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#d97706" }}>
                        {c.pending_vouchers}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {c.is_active ? (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: "16px !important", color: "#15803d !important" }} />}
                          label="ACTIVE"
                          size="small"
                          sx={{
                            fontWeight: 800,
                            bgcolor: "#dcfce7",
                            color: "#15803d",
                            border: "1px solid #86efac",
                          }}
                        />
                      ) : (
                        <Chip
                          icon={<RadioButtonUncheckedIcon sx={{ fontSize: "16px !important", color: "#64748b !important" }} />}
                          label="INACTIVE"
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor: "#f1f5f9",
                            color: "#64748b",
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                        {c.is_active ? (
                          <Chip
                            label="Currently Active"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ fontWeight: 700 }}
                          />
                        ) : (
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            disabled={activatingCycleId === c.id}
                            onClick={() => handleActivateCycle(c)}
                            sx={{
                              fontWeight: 700,
                              textTransform: "none",
                              borderRadius: 1.5,
                              bgcolor: "#2563eb",
                              "&:hover": { bgcolor: "#1d4ed8" },
                            }}
                          >
                            {activatingCycleId === c.id ? (
                              <CircularProgress size={16} sx={{ color: "#ffffff" }} />
                            ) : (
                              "Activate Cycle"
                            )}
                          </Button>
                        )}

                        <Tooltip title="Edit Cycle Window">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEditModal(c)}
                            sx={{ bgcolor: "#f1f5f9" }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add / Edit Cycle Dialog */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: "#1e293b", borderBottom: "1px solid #e2e8f0" }}>
          {modalMode === "CREATE" ? "Add New Cycle" : `Edit ${editingCycle?.cycle_label || "Cycle"}`}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
            <TextField
              label="State"
              value={selectedStateObj?.name || ""}
              disabled
              fullWidth
              size="small"
            />
            <TextField
              label="Cycle Number"
              type="number"
              value={formCycleNum}
              onChange={(e) => setFormCycleNum(e.target.value)}
              fullWidth
              size="small"
              required
              helperText="E.g., 1 for Cycle 1, 2 for Cycle 2"
            />
            <TextField
              label="Cycle Label"
              value={formCycleLabel}
              onChange={(e) => setFormCycleLabel(e.target.value)}
              fullWidth
              size="small"
              placeholder="E.g. Cycle 1"
            />
            <TextField
              label="Start Date (Optional)"
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              helperText="Optional cycle launch date"
            />
            <TextField
              label="End Date (Optional / Open)"
              type="date"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              helperText="Cycles do not have end dates. Leave empty for continuous open cycle."
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formSetActive}
                  onChange={(e) => setFormSetActive(e.target.checked)}
                  color="success"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Make this the ACTIVE cycle immediately
                </Typography>
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #e2e8f0" }}>
          <Button onClick={() => setModalOpen(false)} disabled={modalSubmitting} sx={{ fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSaveCycle}
            disabled={modalSubmitting}
            sx={{ fontWeight: 700, borderRadius: 1.5, px: 3, bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d" } }}
          >
            {modalSubmitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Save Cycle"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
