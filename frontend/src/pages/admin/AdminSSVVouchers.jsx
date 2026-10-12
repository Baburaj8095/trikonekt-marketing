import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Button,
  TextField,
  IconButton,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Alert,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SendIcon from "@mui/icons-material/Send";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import PersonIcon from "@mui/icons-material/Person";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import GroupIcon from "@mui/icons-material/Group";
import RedeemIcon from "@mui/icons-material/Redeem";
import API from "../../api/api";

export default function AdminSSVVouchers() {
  const navigate = useNavigate();

  // State selection
  const [statesList, setStatesList] = useState([]);
  const [selectedStateId, setSelectedStateId] = useState("");
  const [selectedCycleNum, setSelectedCycleNum] = useState(1);

  // Dashboard KPI & category data
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Active month tab
  const [activeTab, setActiveTab] = useState("1_MONTH");

  // Users table state
  const [usersList, setUsersList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState("ALL");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Right Side "Create Voucher" Panel
  const [createSearchId, setCreateSearchId] = useState("");
  const [createSelectedUser, setCreateSelectedUser] = useState(null);
  const [createAmount, setCreateAmount] = useState("");
  const [createRemarks, setCreateRemarks] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createFeedback, setCreateFeedback] = useState(null);

  // Dialogs
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [viewVoucherModal, setViewVoucherModal] = useState(null);
  const [redeemSubmitting, setRedeemSubmitting] = useState(false);
  const [activatingCycleId, setActivatingCycleId] = useState(null);

  // 1. Load States & Available Cycles
  const fetchStates = useCallback(async () => {
    try {
      const res = await API.get("/admin/ssv/states/");
      const states = res?.data?.states || [];
      setStatesList(states);
      if (states.length > 0 && !selectedStateId) {
        // Default to Karnataka if present
        const ktk = states.find((s) => s.name?.toLowerCase().includes("karnataka"));
        const chosen = ktk || states[0];
        setSelectedStateId(chosen.id);
        const activeC = chosen.cycles?.find((c) => c.is_active) || chosen.cycles?.[0];
        if (activeC) setSelectedCycleNum(activeC.cycle_number);
      }
    } catch (e) {
      console.error("Failed to load SSV states:", e);
    }
  }, [selectedStateId]);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  // Current selected state object
  const currentStateObj = useMemo(() => {
    return statesList.find((s) => String(s.id) === String(selectedStateId)) || statesList[0] || null;
  }, [statesList, selectedStateId]);

  // Available cycles for selected state
  const cyclesList = useMemo(() => {
    return (
      currentStateObj?.cycles || [
        { cycle_number: 1, label: "Cycle 1 (Active / Open)", duration: "Active / Open" },
        { cycle_number: 2, label: "Cycle 2", duration: "Active / Open" },
      ]
    );
  }, [currentStateObj]);

  const currentCycleObj = useMemo(() => {
    return cyclesList.find((c) => c.cycle_number === selectedCycleNum) || cyclesList[0];
  }, [cyclesList, selectedCycleNum]);

  // 2. Fetch Dashboard KPIs
  const fetchDashboard = useCallback(async () => {
    if (!selectedStateId) return;
    setLoadingDashboard(true);
    try {
      const res = await API.get("/admin/ssv/dashboard/", {
        params: { state_id: selectedStateId, cycle: selectedCycleNum },
      });
      setDashboardData(res.data);
    } catch (e) {
      console.error("Failed to load SSV dashboard data:", e);
    } finally {
      setLoadingDashboard(false);
    }
  }, [selectedStateId, selectedCycleNum]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // 3. Fetch Users List for Table
  const fetchUsers = useCallback(async () => {
    if (!selectedStateId) return;
    setLoadingUsers(true);
    try {
      const params = {
        state_id: selectedStateId,
        cycle: selectedCycleNum,
        period: activeTab,
        page,
        page_size: pageSize,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (voucherStatusFilter !== "ALL") params.voucher_status = voucherStatusFilter;

      const res = await API.get("/admin/ssv/users/", { params });
      setUsersList(res?.data?.results || []);
      setTotalCount(res?.data?.count || 0);

      // Auto pre-fill right side panel with first user if none chosen
      if (!createSelectedUser && res?.data?.results?.length > 0) {
        const u0 = res.data.results[0];
        setCreateSelectedUser(u0);
        setCreateSearchId(u0.user_id);
        setCreateAmount(String(u0.total_payment || 1000));
      }
    } catch (e) {
      console.error("Failed to load SSV users list:", e);
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedStateId, selectedCycleNum, activeTab, page, pageSize, searchQuery, statusFilter, voucherStatusFilter, createSelectedUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Search user in Create Voucher panel
  const handleSearchUserForVoucher = useCallback(() => {
    const term = createSearchId.trim().toLowerCase();
    if (!term) return;
    const found = usersList.find(
      (u) =>
        String(u.user_id).toLowerCase().includes(term) ||
        String(u.mobile).toLowerCase().includes(term) ||
        String(u.name).toLowerCase().includes(term)
    );
    if (found) {
      setCreateSelectedUser(found);
      setCreateAmount(String(found.total_payment || 1000));
      setCreateFeedback(null);
    } else {
      setCreateFeedback({ type: "error", message: `User '${createSearchId}' not found in current table selection.` });
    }
  }, [createSearchId, usersList]);

  // Create Voucher Action
  const handleCreateVoucher = async () => {
    if (!createSelectedUser) {
      alert("Please select or search a user first.");
      return;
    }
    const amt = Number(createAmount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid Voucher Amount.");
      return;
    }

    setCreateSubmitting(true);
    setCreateFeedback(null);
    try {
      const res = await API.post("/admin/ssv/create-voucher/", {
        user_id: createSelectedUser.user_id,
        state_id: selectedStateId,
        cycle: selectedCycleNum,
        period: activeTab,
        amount: amt,
        remarks: createRemarks,
      });

      setCreateFeedback({
        type: "success",
        message: res?.data?.message || `Voucher ${res?.data?.voucher?.voucher_code} created successfully!`,
      });
      fetchUsers();
      fetchDashboard();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to create voucher.";
      setCreateFeedback({ type: "error", message: msg });
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Redeem Voucher Action
  const handleRedeemVoucher = async (voucherCode) => {
    if (!voucherCode) return;
    const ok = window.confirm(`Confirm redemption of SSV voucher ${voucherCode}?`);
    if (!ok) return;

    setRedeemSubmitting(true);
    try {
      await API.post("/admin/ssv/redeem-voucher/", { voucher_code: voucherCode });
      alert(`Voucher ${voucherCode} marked as REDEEMED.`);
      setViewVoucherModal(null);
      fetchUsers();
      fetchDashboard();
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || "Failed to redeem voucher.");
    } finally {
      setRedeemSubmitting(false);
    }
  };

  // Activate cycle inside modal
  const handleActivateCycleInModal = async (cycleNum) => {
    setActivatingCycleId(cycleNum);
    try {
      await API.post("/admin/ssv/cycles/activate/", {
        state_id: selectedStateId,
        cycle_number: cycleNum,
      });
      setSelectedCycleNum(cycleNum);
      await fetchStates();
      await fetchDashboard();
      await fetchUsers();
      setCycleModalOpen(false);
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || "Failed to activate cycle.");
    } finally {
      setActivatingCycleId(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const url = `/api/admin/ssv/export-csv/?state_id=${selectedStateId}&cycle=${selectedCycleNum}&period=${activeTab}`;
    window.open(url, "_blank");
  };

  // KPI card helper values (Pure real data)
  const kpi = dashboardData?.kpi || {
    total_voucher_amount: 0,
    total_eligible_users: 0,
    vouchers_created: 0,
    vouchers_redeemed: 0,
    pending_vouchers: 0,
  };

  const categoryCards = dashboardData?.category_cards || [
    { key: "1_MONTH", title: "1 Month", user_count: 0, payment_display: "₹ 1,000 Or ₹ 2,000", theme: "blue" },
    { key: "3_MONTHS", title: "3 Months", user_count: 0, payment_display: "₹ 3,000", theme: "orange" },
    { key: "6_MONTHS", title: "6 Months", user_count: 0, payment_display: "₹ 6,000", theme: "purple" },
    { key: "12_MONTHS", title: "12 Months", user_count: 0, payment_display: "₹ 12,000", theme: "red" },
  ];

  const cycleSummary = dashboardData?.cycle_summary || [];

  const tabCounts = useMemo(() => {
    const map = { "1_MONTH": 0, "3_MONTHS": 0, "6_MONTHS": 0, "12_MONTHS": 0 };
    categoryCards.forEach((c) => {
      map[c.key] = c.user_count || 0;
    });
    return map;
  }, [categoryCards]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f8fafc", minHeight: "100vh" }}>
        {/* ========================================================= */}
        {/* TOP BAR: Title, State, Cycle, Cycle Duration, Details Btn */}
        {/* ========================================================= */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            mb: 3,
            bgcolor: "#fff",
            p: 2,
            borderRadius: 3,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Title */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: "#7c3aed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <ConfirmationNumberIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", lineHeight: 1.2 }}>
                SSV Vouchers
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b" }}>
                Coupons & Rewards (Admin Board Only)
              </Typography>
            </Box>
          </Box>

          {/* Selectors */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
            {/* Select State */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>Select State</Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={selectedStateId}
                  onChange={(e) => {
                    setSelectedStateId(e.target.value);
                    setPage(1);
                  }}
                  sx={{ fontWeight: 700, fontSize: 13, bgcolor: "#fff", borderRadius: 2 }}
                >
                  {statesList.map((s) => (
                    <MenuItem key={s.id} value={s.id} sx={{ fontWeight: 600 }}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Select Cycle */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>Select Cycle</Typography>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <Select
                  value={selectedCycleNum}
                  onChange={(e) => {
                    setSelectedCycleNum(Number(e.target.value));
                    setPage(1);
                  }}
                  sx={{ fontWeight: 700, fontSize: 13, bgcolor: "#fff", borderRadius: 2 }}
                >
                  {cyclesList.map((c) => (
                    <MenuItem key={c.cycle_number} value={c.cycle_number} sx={{ fontWeight: 600 }}>
                      {c.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Cycle Duration Pill */}
            <Box sx={{ display: "flex", flexDirection: "column", bgcolor: "#f1f5f9", px: 1.5, py: 0.5, borderRadius: 2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Cycle Duration</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                {currentCycleObj?.duration || "Active / Open"}
              </Typography>
            </Box>

            {/* View Cycle Details Button */}
            <Button
              variant="contained"
              startIcon={<CalendarMonthIcon />}
              onClick={() => setCycleModalOpen(true)}
              sx={{
                bgcolor: "#15803d",
                "&:hover": { bgcolor: "#166534" },
                textTransform: "none",
                fontWeight: 800,
                borderRadius: 2,
                px: 2,
              }}
            >
              View Cycle Details
            </Button>

            {/* Direct Link to Full Cycle Management Screen */}
            <Button
              variant="outlined"
              onClick={() => navigate(`/admin/cycle-management?state_id=${selectedStateId}`)}
              sx={{
                borderColor: "#16a34a",
                color: "#16a34a",
                "&:hover": { borderColor: "#15803d", bgcolor: "#f0fdf4" },
                textTransform: "none",
                fontWeight: 800,
                borderRadius: 2,
                px: 2,
              }}
            >
              Cycle Management
            </Button>
          </Box>
        </Box>

        {/* ========================================================= */}
        {/* TOP 5 SUMMARY KPI CARDS                                   */}
        {/* ========================================================= */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(5, 1fr)" },
            gap: 2,
            mb: 3,
          }}
        >
          {/* Card 1: Total Voucher Amount (Accumulated) */}
          <Card
            sx={{
              p: 2,
              borderRadius: 3,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
              <MonetizationOnIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                Total Voucher Amount (Accumulated)
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#15803d" }}>
                ₹ {Number(kpi.total_voucher_amount).toLocaleString("en-IN")}
              </Typography>
            </Box>
          </Card>

          {/* Card 2: Total Eligible Users */}
          <Card
            sx={{
              p: 2,
              borderRadius: 3,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
              <GroupIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                Total Eligible Users
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#1e40af" }}>
                {Number(kpi.total_eligible_users).toLocaleString("en-IN")}
              </Typography>
            </Box>
          </Card>

          {/* Card 3: Vouchers Created */}
          <Card
            sx={{
              p: 2,
              borderRadius: 3,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed" }}>
              <ConfirmationNumberIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                Vouchers Created
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#6b21a8" }}>
                {Number(kpi.vouchers_created).toLocaleString("en-IN")}
              </Typography>
            </Box>
          </Card>

          {/* Card 4: Vouchers Redeemed */}
          <Card
            sx={{
              p: 2,
              borderRadius: 3,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "#ccfbf1", display: "flex", alignItems: "center", justifyContent: "center", color: "#0d9488" }}>
              <RedeemIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                Vouchers Redeemed
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0f766e" }}>
                {Number(kpi.vouchers_redeemed).toLocaleString("en-IN")}
              </Typography>
            </Box>
          </Card>

          {/* Card 5: Pending Vouchers */}
          <Card
            sx={{
              p: 2,
              borderRadius: 3,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "#ffedd5", display: "flex", alignItems: "center", justifyContent: "center", color: "#ea580c" }}>
              <AccessTimeIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                Pending Vouchers
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#c2410c" }}>
                {Number(kpi.pending_vouchers).toLocaleString("en-IN")}
              </Typography>
            </Box>
          </Card>
        </Box>

        {/* ========================================================= */}
        {/* MIDDLE SECTION: 4 Category Cards (Left) & Cycle Summary (Right) */}
        {/* ========================================================= */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "7fr 5fr" },
            gap: 2,
            mb: 3,
          }}
        >
          {/* Left: 4 Period Cards */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
              gap: 1.5,
            }}
          >
            {categoryCards.map((cat) => {
              const isActive = activeTab === cat.key;
              const themeStyles = {
                blue: { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", subtext: "#2563eb", badge: "#3b82f6" },
                orange: { bg: "#fff7ed", border: "#fdba74", text: "#c2410c", subtext: "#ea580c", badge: "#f97316" },
                purple: { bg: "#faf5ff", border: "#d8b4fe", text: "#6b21a8", subtext: "#7c3aed", badge: "#9333ea" },
                red: { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", subtext: "#dc2626", badge: "#ef4444" },
              }[cat.theme || "blue"];

              return (
                <Card
                  key={cat.key}
                  onClick={() => {
                    setActiveTab(cat.key);
                    setPage(1);
                  }}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: themeStyles.bg,
                    border: "2px solid",
                    borderColor: isActive ? themeStyles.badge : themeStyles.border,
                    cursor: "pointer",
                    boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease-in-out",
                    "&:hover": { borderColor: themeStyles.badge },
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#fff", bgcolor: themeStyles.badge, px: 1, py: 0.2, borderRadius: 1.5 }}>
                      {cat.title}
                    </Typography>
                    <ChevronRightIcon sx={{ color: themeStyles.badge }} />
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                    <PersonIcon sx={{ fontSize: 16, color: themeStyles.subtext }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: themeStyles.subtext }}>
                      {Number(cat.user_count).toLocaleString("en-IN")} Users
                    </Typography>
                  </Box>

                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: themeStyles.text }}>
                    {cat.payment_display}
                  </Typography>
                </Card>
              );
            })}
          </Box>

          {/* Right: Cycle Wise Summary Table */}
          <Card
            sx={{
              p: 2,
              borderRadius: 3,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0f172a", mb: 1 }}>
              📊 Cycle Wise Summary - {currentStateObj?.name || "Karnataka"}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Cycle</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Period</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Eligible</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Created</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Redeemed</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Pending</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cycleSummary.map((cs, idx) => (
                    <TableRow key={idx} sx={{ "&:hover": { bgcolor: "#f8fafc" } }}>
                      <TableCell sx={{ fontWeight: 800, fontSize: 12, color: "#1e293b" }}>{cs.cycle}</TableCell>
                      <TableCell sx={{ fontSize: 11, color: "#64748b" }}>{cs.period}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}>{Number(cs.eligible).toLocaleString("en-IN")}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#7c3aed" }}>{Number(cs.created).toLocaleString("en-IN")}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#0d9488" }}>{Number(cs.redeemed).toLocaleString("en-IN")}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#ea580c" }}>{Number(cs.pending).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Box>

        {/* ========================================================= */}
        {/* LOWER SECTION: Two-Panel Layout (Table Left & Drawer Right)*/}
        {/* ========================================================= */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "7.5fr 4.5fr" },
            gap: 2,
          }}
        >
          {/* LEFT: User Details Section & Data Table */}
          <Card
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            {/* Title with refresh */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a", fontSize: 17 }}>
                  {currentStateObj?.name || "Karnataka"} - Users Details (Cycle {selectedCycleNum})
                </Typography>
                <IconButton size="small" onClick={() => fetchUsers()} title="Refresh list">
                  <RefreshIcon sx={{ color: "#16a34a" }} />
                </IconButton>
              </Box>
            </Box>

            {/* 4 Month Category Tabs */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {[
                { key: "1_MONTH", label: `1 Month Paid (${Number(tabCounts["1_MONTH"]).toLocaleString("en-IN")})` },
                { key: "3_MONTHS", label: `3 Months Paid (${Number(tabCounts["3_MONTHS"]).toLocaleString("en-IN")})` },
                { key: "6_MONTHS", label: `6 Months Paid (${Number(tabCounts["6_MONTHS"]).toLocaleString("en-IN")})` },
                { key: "12_MONTHS", label: `12 Months Paid (${Number(tabCounts["12_MONTHS"]).toLocaleString("en-IN")})` },
              ].map((t) => {
                const isSelected = activeTab === t.key;
                return (
                  <Button
                    key={t.key}
                    onClick={() => {
                      setActiveTab(t.key);
                      setPage(1);
                    }}
                    sx={{
                      bgcolor: isSelected ? "#15803d" : "#e2e8f0",
                      color: isSelected ? "#fff" : "#475569",
                      fontWeight: 800,
                      fontSize: 12,
                      textTransform: "none",
                      borderRadius: 2,
                      px: 2,
                      py: 0.8,
                      "&:hover": { bgcolor: isSelected ? "#166534" : "#cbd5e1" },
                    }}
                  >
                    {t.label}
                  </Button>
                );
              })}
            </Box>

            {/* Filter Bar */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 1.5,
                mb: 2,
                p: 1.5,
                bgcolor: "#f8fafc",
                borderRadius: 2,
              }}
            >
              {/* Search */}
              <Box sx={{ display: "flex", alignItems: "center", flex: "1 1 220px", bgcolor: "#fff", borderRadius: 2, border: "1px solid #cbd5e1", px: 1 }}>
                <TextField
                  variant="standard"
                  placeholder="Search by User ID, Name or Mobile Number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
                  fullWidth
                  InputProps={{ disableUnderline: true, style: { fontSize: 12, fontWeight: 600 } }}
                />
                <IconButton size="small" onClick={() => fetchUsers()} sx={{ bgcolor: "#15803d", color: "#fff", "&:hover": { bgcolor: "#166534" }, ml: 0.5 }}>
                  <SearchIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>

              {/* Status Filter */}
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>Status</Typography>
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ height: 32, fontSize: 12, fontWeight: 700, bgcolor: "#fff" }}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>

              {/* Voucher Status Filter */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>Voucher Status</Typography>
                <Select
                  value={voucherStatusFilter}
                  onChange={(e) => {
                    setVoucherStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ height: 32, fontSize: 12, fontWeight: 700, bgcolor: "#fff" }}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="NOT_CREATED">Not Created</MenuItem>
                  <MenuItem value="CREATED">Created</MenuItem>
                  <MenuItem value="REDEEMED">Redeemed</MenuItem>
                </Select>
              </FormControl>

              {/* Filter Apply Button */}
              <Button
                variant="outlined"
                startIcon={<FilterListIcon />}
                onClick={() => fetchUsers()}
                sx={{ height: 32, mt: "auto", textTransform: "none", fontWeight: 800, fontSize: 12, borderRadius: 2 }}
              >
                Filter
              </Button>

              {/* Export CSV Button */}
              <Button
                variant="contained"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportCSV}
                sx={{ height: 32, mt: "auto", bgcolor: "#15803d", "&:hover": { bgcolor: "#166534" }, textTransform: "none", fontWeight: 800, fontSize: 12, borderRadius: 2 }}
              >
                Export
              </Button>
            </Box>

            {/* User Details Table */}
            {loadingUsers ? (
              <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={36} color="success" />
              </Box>
            ) : (
              <TableContainer sx={{ minHeight: 380 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f1f5f9" }}>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>User ID</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Mobile</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Join Date</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Months Completed</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Total Payment (₹)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Voucher Status</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {usersList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4, color: "#64748b", fontWeight: 700 }}>
                          No consumers found matching current criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      usersList.map((row) => (
                        <TableRow
                          key={row.user_pk || row.row_number}
                          hover
                          onClick={() => {
                            setCreateSelectedUser(row);
                            setCreateSearchId(row.user_id);
                            setCreateAmount(String(row.total_payment || 1000));
                          }}
                          sx={{
                            cursor: "pointer",
                            bgcolor: createSelectedUser?.user_id === row.user_id ? "#f0fdf4" : "inherit",
                          }}
                        >
                          <TableCell sx={{ fontSize: 11, color: "#64748b" }}>{row.row_number}</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: 12, color: "#1e40af" }}>{row.user_id}</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{row.name}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: "#475569" }}>{row.mobile}</TableCell>
                          <TableCell sx={{ fontSize: 11, color: "#64748b" }}>{row.join_date}</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>{row.months_completed}</TableCell>
                          <TableCell sx={{ fontWeight: 800, fontSize: 12, color: "#15803d" }}>
                            ₹ {Number(row.total_payment).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell align="center">
                            {row.voucher_status === "NOT_CREATED" ? (
                              <Chip size="small" label="Not Created" sx={{ bgcolor: "#ffedd5", color: "#c2410c", fontWeight: 800, fontSize: 10 }} />
                            ) : row.voucher_status === "CREATED" ? (
                              <Chip size="small" label="Created" sx={{ bgcolor: "#dbeafe", color: "#1e40af", fontWeight: 800, fontSize: 10 }} />
                            ) : (
                              <Chip size="small" label="Redeemed" sx={{ bgcolor: "#ccfbf1", color: "#0f766e", fontWeight: 800, fontSize: 10 }} />
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {row.voucher_status === "NOT_CREATED" ? (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCreateSelectedUser(row);
                                  setCreateSearchId(row.user_id);
                                  setCreateAmount(String(row.total_payment || 1000));
                                }}
                                sx={{
                                  bgcolor: "#15803d",
                                  "&:hover": { bgcolor: "#166534" },
                                  textTransform: "none",
                                  fontWeight: 800,
                                  fontSize: 11,
                                  borderRadius: 1.5,
                                  px: 1.2,
                                  py: 0.2,
                                }}
                              >
                                Create Voucher
                              </Button>
                            ) : row.voucher_status === "CREATED" ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewVoucherModal(row);
                                }}
                                sx={{
                                  borderColor: "#3b82f6",
                                  color: "#2563eb",
                                  textTransform: "none",
                                  fontWeight: 800,
                                  fontSize: 11,
                                  borderRadius: 1.5,
                                  px: 1.2,
                                  py: 0.2,
                                }}
                              >
                                View Voucher
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewVoucherModal(row);
                                }}
                                sx={{
                                  borderColor: "#0d9488",
                                  color: "#0f766e",
                                  textTransform: "none",
                                  fontWeight: 800,
                                  fontSize: 11,
                                  borderRadius: 1.5,
                                  px: 1.2,
                                  py: 0.2,
                                }}
                              >
                                View Details
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Pagination */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2, pt: 1, borderTop: "1px solid #f1f5f9" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                Showing {usersList.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, totalCount)} of {Number(totalCount).toLocaleString("en-IN")} users
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} sx={{ minWidth: 28, fontSize: 12 }}>
                  &lt;
                </Button>
                {[...Array(Math.min(5, totalPages))].map((_, i) => (
                  <Button
                    key={i + 1}
                    size="small"
                    variant={page === i + 1 ? "contained" : "outlined"}
                    onClick={() => setPage(i + 1)}
                    sx={{
                      minWidth: 28,
                      height: 28,
                      p: 0,
                      fontSize: 11,
                      fontWeight: 800,
                      bgcolor: page === i + 1 ? "#15803d" : "inherit",
                      "&:hover": { bgcolor: page === i + 1 ? "#166534" : "inherit" },
                    }}
                  >
                    {i + 1}
                  </Button>
                ))}
                {totalPages > 5 && <Typography sx={{ px: 0.5, color: "#94a3b8" }}>...</Typography>}
                {totalPages > 5 && (
                  <Button size="small" variant={page === totalPages ? "contained" : "outlined"} onClick={() => setPage(totalPages)} sx={{ minWidth: 28, height: 28, p: 0, fontSize: 11, fontWeight: 800 }}>
                    {totalPages}
                  </Button>
                )}
                <Button size="small" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} sx={{ minWidth: 28, fontSize: 12 }}>
                  &gt;
                </Button>
              </Box>
            </Box>
          </Card>

          {/* RIGHT: "Create Voucher" Panel & Stepper */}
          <Card
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a", fontSize: 16, mb: 2 }}>
                🎟️ Create Voucher
              </Typography>

              {/* User ID Search */}
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#334155", mb: 0.5 }}>
                  User ID *
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Enter User ID (e.g. TK100001)"
                    value={createSearchId}
                    onChange={(e) => setCreateSearchId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchUserForVoucher()}
                    fullWidth
                    InputProps={{ style: { fontSize: 13, fontWeight: 700 } }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSearchUserForVoucher}
                    sx={{ bgcolor: "#15803d", "&:hover": { bgcolor: "#166534" }, fontWeight: 800, px: 2, textTransform: "none" }}
                  >
                    Search
                  </Button>
                </Box>
              </Box>

              {/* User Detail Snapshot Card */}
              {createSelectedUser ? (
                <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #e2e8f0", mb: 2 }}>
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Name:</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{createSelectedUser.name}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Mobile Number:</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{createSelectedUser.mobile}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Joined Date:</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{createSelectedUser.join_date}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Months Completed:</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>{createSelectedUser.months_completed}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Total Payment (₹):</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#15803d" }}>
                        ₹ {Number(createSelectedUser.total_payment).toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              ) : (
                <Alert severity="info" sx={{ mb: 2, fontSize: 12, fontWeight: 600 }}>
                  Select a candidate from the table or search by User ID to issue a voucher.
                </Alert>
              )}

              {/* Voucher Amount Input */}
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#334155", mb: 0.5 }}>
                  Voucher Amount *
                </Typography>
                <TextField
                  size="small"
                  type="number"
                  placeholder="₹ Enter Amount"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  fullWidth
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1, fontWeight: 800, color: "#64748b" }}>₹</Typography>,
                    style: { fontSize: 14, fontWeight: 800, color: "#0f172a" },
                  }}
                />
              </Box>

              {/* Remarks Input */}
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#334155", mb: 0.5 }}>
                  Remarks (Optional)
                </Typography>
                <TextField
                  size="small"
                  placeholder="Enter remarks"
                  value={createRemarks}
                  onChange={(e) => setCreateRemarks(e.target.value)}
                  fullWidth
                  InputProps={{ style: { fontSize: 12, fontWeight: 600 } }}
                />
              </Box>

              {createFeedback && (
                <Alert severity={createFeedback.type} sx={{ mb: 2, fontSize: 12, fontWeight: 700 }}>
                  {createFeedback.message}
                </Alert>
              )}

              {/* Create & Send Button */}
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                disabled={!createSelectedUser || createSubmitting}
                onClick={handleCreateVoucher}
                fullWidth
                sx={{
                  py: 1.2,
                  bgcolor: "#15803d",
                  "&:hover": { bgcolor: "#166534" },
                  fontWeight: 900,
                  fontSize: 14,
                  textTransform: "none",
                  borderRadius: 2,
                }}
              >
                {createSubmitting ? "Creating & Sending..." : "Create Voucher & Send to User"}
              </Button>
            </Box>

            {/* User Voucher Status Stepper */}
            <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #f1f5f9" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0f172a", mb: 1.5 }}>
                User Voucher Status
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {[
                  { step: 1, label: "Voucher Created", color: "#16a34a" },
                  { step: 2, label: "In User Account", color: "#2563eb" },
                  { step: 3, label: "User Redeems", color: "#7c3aed" },
                  { step: 4, label: "Completed", color: "#0d9488" },
                ].map((s, idx) => (
                  <React.Fragment key={s.step}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", flex: 1 }}>
                      <Box
                        sx={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          bgcolor: s.color,
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 900,
                          mb: 0.5,
                        }}
                      >
                        {s.step}
                      </Box>
                      <Typography sx={{ fontSize: 9, fontWeight: 800, color: "#475569", lineHeight: 1.1 }}>
                        {s.label}
                      </Typography>
                    </Box>
                    {idx < 3 && <Typography sx={{ color: "#cbd5e1", fontWeight: 900, fontSize: 14, mb: 1 }}>→</Typography>}
                  </React.Fragment>
                ))}
              </Box>
            </Box>
          </Card>
        </Box>

        {/* ========================================================= */}
        {/* MODAL: Cycle Details & Rapid Activation                   */}
        {/* ========================================================= */}
        <Dialog open={cycleModalOpen} onClose={() => setCycleModalOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 900, color: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📅 Cycle Details & Activation - {currentStateObj?.name || "Karnataka"}</span>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {cyclesList.map((c) => (
                <Box
                  key={c.cycle_number}
                  sx={{
                    p: 2,
                    bgcolor: c.is_active ? "#f0fdf4" : "#f8fafc",
                    borderRadius: 2,
                    border: c.is_active ? "1.5px solid #22c55e" : "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                        {c.label}
                      </Typography>
                      {c.is_active && (
                        <Chip label="ACTIVE" color="success" size="small" sx={{ fontWeight: 800, height: 20 }} />
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                      Duration: {c.duration}
                    </Typography>
                  </Box>

                  <Box>
                    {c.is_active ? (
                      <Chip label="Currently Active" size="small" color="success" variant="outlined" sx={{ fontWeight: 700 }} />
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        disabled={activatingCycleId === c.cycle_number}
                        onClick={() => handleActivateCycleInModal(c.cycle_number)}
                        sx={{
                          bgcolor: "#2563eb",
                          "&:hover": { bgcolor: "#1d4ed8" },
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 1.5,
                        }}
                      >
                        {activatingCycleId === c.cycle_number ? "Activating..." : "Activate Cycle"}
                      </Button>
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ justifyContent: "space-between", px: 2.5, py: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setCycleModalOpen(false);
                navigate(`/admin/cycle-management?state_id=${selectedStateId}`);
              }}
              sx={{ fontWeight: 700, textTransform: "none", borderColor: "#16a34a", color: "#16a34a" }}
            >
              Open Cycle Management Screen →
            </Button>
            <Button onClick={() => setCycleModalOpen(false)} sx={{ fontWeight: 800 }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* ========================================================= */}
        {/* MODAL: View Voucher & Details                             */}
        {/* ========================================================= */}
        <Dialog open={Boolean(viewVoucherModal)} onClose={() => setViewVoucherModal(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 900, color: "#0f172a" }}>
            🎟️ SSV Voucher Details
          </DialogTitle>
          <DialogContent dividers>
            {viewVoucherModal && (
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>User ID:</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800 }}>{viewVoucherModal.user_id}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Name:</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800 }}>{viewVoucherModal.name}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Mobile:</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{viewVoucherModal.mobile}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Voucher Code:</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#7c3aed" }}>{viewVoucherModal.voucher_code}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Amount:</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#15803d" }}>₹ {Number(viewVoucherModal.voucher_amount).toLocaleString("en-IN")}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Status:</Typography>
                  <Chip
                    size="small"
                    label={viewVoucherModal.voucher_status}
                    sx={{
                      fontWeight: 800,
                      bgcolor: viewVoucherModal.voucher_status === "REDEEMED" ? "#ccfbf1" : "#dbeafe",
                      color: viewVoucherModal.voucher_status === "REDEEMED" ? "#0f766e" : "#1e40af",
                    }}
                  />
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: "space-between", px: 2.5 }}>
            {viewVoucherModal?.voucher_status === "CREATED" && (
              <Button
                variant="contained"
                disabled={redeemSubmitting}
                onClick={() => handleRedeemVoucher(viewVoucherModal.voucher_code)}
                sx={{ bgcolor: "#0d9488", "&:hover": { bgcolor: "#0f766e" }, fontWeight: 800, textTransform: "none" }}
              >
                {redeemSubmitting ? "Redeeming..." : "Mark as Redeemed"}
              </Button>
            )}
            <Button onClick={() => setViewVoucherModal(null)} sx={{ fontWeight: 800, ml: "auto" }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
  );
}
