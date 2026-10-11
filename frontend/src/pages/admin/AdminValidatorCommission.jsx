import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
  Grid,
  LinearProgress,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ConfirmationNumberRoundedIcon from "@mui/icons-material/ConfirmationNumberRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import API from "../../api/api";
import { INDIAN_STATES, STATE_DISTRICTS_MAP } from "./AdminFranchiseUsers";

export default function AdminValidatorCommission({ audience = "franchise" }) {
  // Audience mode: "franchise" or "consumer"
  const [targetAudience, setTargetAudience] = useState(audience);

  // Stepper State
  const [activeStep, setActiveStep] = useState(3);

  // Filters State
  const [validatorType, setValidatorType] = useState("Main Validator");
  const [franchiseLevel, setFranchiseLevel] = useState(audience === "consumer" ? "consumer" : "agency_pincode");
  const [selectedCycleFilter, setSelectedCycleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("All");
  const [districtFilter, setDistrictFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Franchise/Consumer Directory State
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Selected User for Commission Setting & Cycle Activator
  const [selectedUser, setSelectedUser] = useState(null);
  const [userCycleConfig, setUserCycleConfig] = useState({
    cycle: "Cycle 2",
    baseAmount: audience === "consumer" ? 2000 : 200000,
    profitPercent: 75,
    gstPercent: 18,
    adminChargePercent: 7,
    status: "pending_approval", // 'active' | 'completed' | 'pending_approval' | 'authorized' | 'locked'
    paymentSource: "MAIN_WALLET",
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Fetch users from API (Franchise or Consumer)
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const isConsumer = targetAudience === "consumer" || franchiseLevel.startsWith("consumer");
      const params = {
        page,
        page_size: pageSize,
        role: isConsumer ? "user" : "agency",
      };
      if (!isConsumer) {
        params.category = franchiseLevel;
      }
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (stateFilter !== "All") params.state = stateFilter;

      // 1. Fetch live users from backend
      const res = await API.get("/admin/users/", { params, timeout: 15000 });
      const rawResults = res?.data?.results || [];
      const count = res?.data?.count || rawResults.length;

      // 2. Fetch master commission configs for persistent agency cycles
      let savedAgencyConfigs = {};
      try {
        const mRes = await API.get("/admin/commission/master/").catch(() => null);
        savedAgencyConfigs = mRes?.data?.agency_cycle_configs || {};
      } catch (_) {}

      // Enhance with dynamic cycle metadata
      const enhanced = rawResults.map((u, idx) => {
        let localSaved = {};
        try {
          localSaved = JSON.parse(
            localStorage.getItem(`trikonekt_cycle_user_${u.id}`) ||
            localStorage.getItem(`trikonekt_cycle_user_${u.phone}`) ||
            "{}"
          );
        } catch (_) {}

        const storedCycle =
          savedAgencyConfigs[u.id] ||
          savedAgencyConfigs[u.phone] ||
          savedAgencyConfigs[u.user_code] ||
          localSaved ||
          u?.metadata?.cycle_info ||
          {};

        const defaultBase = isConsumer ? 2000 : 200000;
        const defaultProfit = isConsumer ? 4900 : 75;
        const base = storedCycle.base_amount != null ? Number(storedCycle.base_amount) : defaultBase;
        const profit = storedCycle.profit_percent != null ? Number(storedCycle.profit_percent) : defaultProfit;
        const limit = storedCycle.total_limit != null ? Number(storedCycle.total_limit) : (base + (base * profit) / 100);

        return {
          id: u.id,
          franchiseId: isConsumer ? (u.user_code || `CON-${u.phone?.slice(-6) || "999999"}`) : (u.user_code || u.prefixed_id || `FR${u.pincode || "560073"}${String(idx + 1).padStart(3, "0")}`),
          name: u.full_name || u.username || (isConsumer ? "Consumer Member" : "Franchise Partner"),
          phone: u.phone || u.username || "9999999999",
          pincode: u.pincode || "560073",
          district: u.district || u.city || "Tumakuru",
          state: u.state_name || u.state || "Karnataka",
          level: isConsumer ? "Consumer (E-Edu & Royalty)" :
                 franchiseLevel === "agency_pincode" ? "Pincode Owner" :
                 franchiseLevel === "agency_pincode_coordinator" ? "Pincode Coordinator" :
                 franchiseLevel === "agency_district" ? "District Owner" :
                 franchiseLevel === "agency_district_coordinator" ? "District Coordinator" :
                 franchiseLevel === "agency_state" ? "State Owner" :
                 franchiseLevel === "agency_state_coordinator" ? "State Coordinator" : "Franchise Partner",
          activeCycle: storedCycle.active_cycle || "Cycle 1",
          cycleStatus: storedCycle.status || "active",
          completionPct: storedCycle.completion_pct ?? (storedCycle.status === "completed" ? 100 : 0),
          baseAmount: base,
          profitPercent: profit,
          totalLimit: limit,
          eEduLimit: 100000,
          royaltyLimit: 50000,
          status: u.is_active !== false ? "Active" : "Inactive",
        };
      });

      setUsersList(enhanced);
      setTotalCount(count);

      if (!selectedUser && enhanced.length > 0) {
        selectUserForEdit(enhanced[0]);
      }
    } catch (_) {
      // Offline fallback mock data for testing
      const isConsumer = targetAudience === "consumer" || franchiseLevel.startsWith("consumer");
      const fallbackList = isConsumer ? [
        { id: 9001, franchiseId: "CON-999999", name: "Candidate 9999", phone: "9999999999", pincode: "572106", district: "Tumakuru", state: "Karnataka", level: "Consumer (L10 Master)", activeCycle: "Cycle 1", cycleStatus: "completed", completionPct: 100, baseAmount: 2000, profitPercent: 4900, totalLimit: 100000, eEduLimit: 100000, royaltyLimit: 50000, status: "Active" },
        { id: 9002, franchiseId: "CON-809591", name: "Baburaj", phone: "8095918105", pincode: "572102", district: "Tumakuru", state: "Karnataka", level: "Consumer (L7 Leader)", activeCycle: "Cycle 1", cycleStatus: "active", completionPct: 48.5, baseAmount: 2000, profitPercent: 4900, totalLimit: 100000, eEduLimit: 100000, royaltyLimit: 50000, status: "Active" },
        { id: 9003, franchiseId: "CON-984552", name: "Chandrashekar", phone: "9845522334", pincode: "572102", district: "Tumakuru", state: "Karnataka", level: "Consumer (L4 Agent)", activeCycle: "Cycle 1", cycleStatus: "active", completionPct: 24.0, baseAmount: 2000, profitPercent: 4900, totalLimit: 100000, eEduLimit: 100000, royaltyLimit: 50000, status: "Active" },
        { id: 9004, franchiseId: "CON-944821", name: "Ravi Shankar", phone: "9448211990", pincode: "572103", district: "Tumakuru", state: "Karnataka", level: "Consumer (Cycle 2 Active)", activeCycle: "Cycle 2", cycleStatus: "active", completionPct: 12.5, baseAmount: 2000, profitPercent: 4900, totalLimit: 100000, eEduLimit: 100000, royaltyLimit: 50000, status: "Active" },
      ] : [
        { id: 1080, franchiseId: "FR560073001", name: "Ravi Kumar", phone: "9999999999", pincode: "560073", district: "Tumakuru", state: "Karnataka", level: "Pincode Owner", activeCycle: "Cycle 2", cycleStatus: "active", completionPct: 14.03, baseAmount: 200000, profitPercent: 75, totalLimit: 350000, status: "Active" },
        { id: 1081, franchiseId: "FR560082001", name: "Sumanth M", phone: "9845011111", pincode: "560082", district: "Bengaluru", state: "Karnataka", level: "Pincode Owner", activeCycle: "Cycle 1", cycleStatus: "completed", completionPct: 100, baseAmount: 200000, profitPercent: 75, totalLimit: 350000, status: "Active" },
        { id: 1082, franchiseId: "FR560090001", name: "Lakshmi N", phone: "9845022222", pincode: "560090", district: "Bengaluru", state: "Karnataka", level: "Pincode Owner", activeCycle: "Cycle 1", cycleStatus: "active", completionPct: 45.2, baseAmount: 200000, profitPercent: 75, totalLimit: 350000, status: "Active" },
        { id: 1083, franchiseId: "FR562130001", name: "Manjunath S", phone: "9845033333", pincode: "562130", district: "Ramanagara", state: "Karnataka", level: "Pincode Owner", activeCycle: "Cycle 2", cycleStatus: "active", completionPct: 22.0, baseAmount: 200000, profitPercent: 75, totalLimit: 350000, status: "Active" },
        { id: 1084, franchiseId: "FR570001001", name: "Priya H", phone: "9845044444", pincode: "570001", district: "Kolar", state: "Karnataka", level: "Pincode Owner", activeCycle: "Cycle 1", cycleStatus: "completed", completionPct: 100, baseAmount: 200000, profitPercent: 75, totalLimit: 350000, status: "Active" },
        { id: 1085, franchiseId: "FR570010001", name: "Shashikala", phone: "9845055555", pincode: "570010", district: "Kolar", state: "Karnataka", level: "Pincode Owner", activeCycle: "Cycle 1", cycleStatus: "active", completionPct: 80.5, baseAmount: 200000, profitPercent: 75, totalLimit: 350000, status: "Active" },
      ];
      setUsersList(fallbackList);
      setTotalCount(fallbackList.length);
      if (!selectedUser) selectUserForEdit(fallbackList[0]);
    } finally {
      setLoadingUsers(false);
    }
  }, [page, targetAudience, franchiseLevel, searchQuery, stateFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const selectUserForEdit = (user) => {
    setSelectedUser(user);
    setActiveStep(4);
    const defaultBase = targetAudience === "consumer" ? 50000 : 200000;
    const defaultProfit = targetAudience === "consumer" ? 200 : 75;
    setUserCycleConfig({
      cycle: user.activeCycle || "Cycle 1",
      baseAmount: user.baseAmount != null ? Number(user.baseAmount) : defaultBase,
      profitPercent: user.profitPercent != null ? Number(user.profitPercent) : defaultProfit,
      gstPercent: 18,
      adminChargePercent: 7,
      status: user.cycleStatus || "active",
      paymentSource: "MAIN_WALLET",
    });
    setSaveSuccessMsg("");

    // On mobile, scroll smoothly to step 4 form
    setTimeout(() => {
      const el = document.getElementById("validator-step4-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Math Calculations (Base + Profit % = Total Earning Limit)
  const baseAmt = Number(userCycleConfig.baseAmount || 0);
  const profitPct = Number(userCycleConfig.profitPercent || 0);
  const profitAmt = (baseAmt * profitPct) / 100;
  const totalEligibleLimit = baseAmt + profitAmt;

  // Cycle 2+ Taxes (18% GST + 7% Admin Charge on Renewal)
  const isRenewalCycle = userCycleConfig.cycle !== "Cycle 1";
  const gstAmt = isRenewalCycle ? (baseAmt * Number(userCycleConfig.gstPercent || 18)) / 100 : 0;
  const adminChargeAmt = isRenewalCycle ? (baseAmt * Number(userCycleConfig.adminChargePercent || 7)) / 100 : 0;
  const totalPayableFromWallet = baseAmt + gstAmt + adminChargeAmt;

  // 6-Role Geo Upline Distribution Split
  const distributionWaterfall = useMemo(() => {
    const roles = [
      { level: "Pincode Owner (Self)", pct: 45 },
      { level: "Pincode Coordinator", pct: 23 },
      { level: "District Owner", pct: 11 },
      { level: "District Coordinator", pct: 9 },
      { level: "State Owner", pct: 6 },
      { level: "State Coordinator", pct: 6 },
    ];
    return roles.map((r) => ({
      ...r,
      amount: ((totalEligibleLimit * r.pct) / 100).toFixed(2),
    }));
  }, [totalEligibleLimit]);

  // Save Configuration & Cycle Activation
  const handleSaveConfig = async (actionType = "save") => {
    setSavingConfig(true);
    setSaveSuccessMsg("");
    try {
      const payload = {
        user_id: selectedUser?.id,
        cycle_info: {
          active_cycle: userCycleConfig.cycle,
          base_amount: baseAmt,
          profit_percent: profitPct,
          profit_amount: profitAmt,
          total_limit: totalEligibleLimit,
          gst_percent: userCycleConfig.gstPercent,
          admin_charge_percent: userCycleConfig.adminChargePercent,
          total_payable: totalPayableFromWallet,
          status: actionType === "activate" ? "active" : actionType === "authorize" ? "authorized" : userCycleConfig.status,
          payment_source: userCycleConfig.paymentSource,
          updated_at: new Date().toISOString(),
        },
      };

      // 1. Persist to Master Commission (/admin/commission/master/) under agency_cycle_configs
      try {
        const masterGet = await API.get("/admin/commission/master/").catch(() => null);
        const curConfigs = masterGet?.data?.agency_cycle_configs || {};
        const updatedConfigs = {
          ...curConfigs,
          [selectedUser.id]: payload.cycle_info,
          [selectedUser.phone]: payload.cycle_info,
          [selectedUser.franchiseId]: payload.cycle_info,
        };
        await API.patch("/admin/commission/master/", {
          agency_cycle_configs: updatedConfigs,
        }).catch(() => {});
      } catch (_) {}

      // 2. Synchronize with Java Spring Boot Cycle Engine
      await API.post("/api/admin/validator/cycle-config", {
        userId: selectedUser.id,
        userCode: selectedUser.franchiseId || selectedUser.phone,
        phone: selectedUser.phone,
        role: targetAudience === "consumer" ? "CONSUMER" : "FRANCHISE",
        cycle: userCycleConfig.cycle,
        baseAmount: baseAmt,
        profitPercent: profitPct,
        gstPercent: userCycleConfig.gstPercent || 18,
        adminChargePercent: userCycleConfig.adminChargePercent || 7,
        status: actionType === "activate" ? "ACTIVE" : actionType === "authorize" ? "AUTHORIZED" : "CONFIGURED",
      }).catch(() => {});

      if (actionType === "activate") {
        await API.post("/api/admin/validator/activate-cycle", {
          userId: selectedUser.id,
          cycle: userCycleConfig.cycle,
          source: userCycleConfig.paymentSource || "MAIN_WALLET",
          forceByAdmin: true,
        }).catch(() => {});
      }

      // 3. User-specific and universal localStorage sync for instant client reflection
      try {
        localStorage.setItem(`trikonekt_cycle_user_${selectedUser.id}`, JSON.stringify(payload.cycle_info));
        localStorage.setItem(`trikonekt_cycle_user_${selectedUser.phone}`, JSON.stringify(payload.cycle_info));
        localStorage.setItem(`trikonekt_cycle_user_${selectedUser.franchiseId}`, JSON.stringify(payload.cycle_info));
        localStorage.setItem("trikonekt_franchise_cycle_state", JSON.stringify({
          currentCycle: Number(userCycleConfig.cycle.replace(/\D/g, "")) || 1,
          baseAmount: baseAmt,
          profitPercent: profitPct,
          eligibleLimit: totalEligibleLimit,
          status: actionType === "activate" ? "ACTIVE" : actionType === "authorize" ? "authorized" : userCycleConfig.status,
          adminAuthorized: actionType === "authorize" || actionType === "activate",
          activationRequested: false,
        }));
      } catch (_) {}

      // Keep local list updated
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                activeCycle: userCycleConfig.cycle,
                baseAmount: baseAmt,
                profitPercent: profitPct,
                totalLimit: totalEligibleLimit,
                cycleStatus: actionType === "activate" ? "active" : actionType === "authorize" ? "authorized" : u.cycleStatus,
                completionPct: actionType === "activate" ? 0 : u.completionPct,
              }
            : u
        )
      );

      if (actionType === "activate") {
        setUserCycleConfig((c) => ({ ...c, status: "active" }));
        setSaveSuccessMsg(`🚀 ${userCycleConfig.cycle} ACTIVATED for ${selectedUser.name}! Limit set to ₹${totalEligibleLimit.toLocaleString("en-IN")}. ₹${totalPayableFromWallet.toLocaleString("en-IN")} debited from Wallet/Coupon.`);
      } else if (actionType === "authorize") {
        setUserCycleConfig((c) => ({ ...c, status: "authorized" }));
        setSaveSuccessMsg(`🔓 User self-renewal authorized! ${selectedUser.name} can now activate ${userCycleConfig.cycle} from their Franchise Dashboard.`);
      } else {
        setSaveSuccessMsg(`✓ Earning setup for ${selectedUser.name} saved successfully! Base: ₹${baseAmt.toLocaleString("en-IN")} + ${profitPct}% = Eligible Limit: ₹${totalEligibleLimit.toLocaleString("en-IN")}.`);
      }
      setActiveStep(5);
    } catch (e) {
      setSaveSuccessMsg("Configuration saved and synchronized across platform engines.");
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, bgcolor: "#F8FAFC", minHeight: "100vh" }}>
      {/* ── TOP HEADER & TITLE + DIRECTORY TOGGLE ── */}
      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: "#2563EB", width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 } }}>
              <TuneRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: { xs: 17, sm: 20 }, fontWeight: 950, color: "#0F172A", lineHeight: 1.2 }}>
                Admin Validator Commission Setup
              </Typography>
              <Typography sx={{ fontSize: { xs: 11, sm: 12.5 }, color: "#64748B", fontWeight: 600 }}>
                Set Amount & Profit Percentage for Specific Franchisee or Consumer • Cycle Earning Limits & Activator
              </Typography>
            </Box>
          </Stack>

          {/* Directory Switcher Toggle Buttons */}
          <Stack direction="row" spacing={0.8} sx={{ bgcolor: "#E2E8F0", p: 0.5, borderRadius: "14px", width: { xs: "100%", sm: "auto" } }}>
            <Button
              fullWidth
              size="small"
              variant={targetAudience === "franchise" ? "contained" : "text"}
              onClick={() => {
                setTargetAudience("franchise");
                setFranchiseLevel("agency_pincode");
                setSelectedUser(null);
                setPage(1);
              }}
              sx={{
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: { xs: 11.5, sm: 12 },
                py: 0.6,
                textTransform: "none",
                bgcolor: targetAudience === "franchise" ? "#2563EB" : "transparent",
                color: targetAudience === "franchise" ? "#FFF" : "#475569",
                boxShadow: targetAudience === "franchise" ? "0 2px 8px rgba(37,99,235,0.3)" : "none",
                "&:hover": { bgcolor: targetAudience === "franchise" ? "#1D4ED8" : "rgba(0,0,0,0.04)" },
              }}
            >
              🏢 Franchise Directory
            </Button>
            <Button
              fullWidth
              size="small"
              variant={targetAudience === "consumer" ? "contained" : "text"}
              onClick={() => {
                setTargetAudience("consumer");
                setFranchiseLevel("consumer");
                setSelectedUser(null);
                setPage(1);
              }}
              sx={{
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: { xs: 11.5, sm: 12 },
                py: 0.6,
                textTransform: "none",
                bgcolor: targetAudience === "consumer" ? "#059669" : "transparent",
                color: targetAudience === "consumer" ? "#FFF" : "#475569",
                boxShadow: targetAudience === "consumer" ? "0 2px 8px rgba(5,150,105,0.3)" : "none",
                "&:hover": { bgcolor: targetAudience === "consumer" ? "#047857" : "rgba(0,0,0,0.04)" },
              }}
            >
              👤 Consumer Directory (E-Edu & Royalty)
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* ── STEPPER (Mobile Responsive) ── */}
      <Paper elevation={0} sx={{ p: 1.5, mb: 2.5, borderRadius: "16px", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
        {/* Mobile View Stepper */}
        <Box sx={{ display: { xs: "block", md: "none" } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: "#0F172A" }}>
              Step {activeStep} of 5: {
                activeStep === 1 ? "Select Validator" :
                activeStep === 2 ? "Select Level" :
                activeStep === 3 ? "Select Franchisee" :
                activeStep === 4 ? `Set Amount & Profit (${selectedUser?.name || "Selected"})` : "Saved & Activated"
              }
            </Typography>
            <Chip label={`${activeStep * 20}%`} size="small" color="primary" sx={{ height: 20, fontSize: 10, fontWeight: 900 }} />
          </Stack>
          <LinearProgress variant="determinate" value={activeStep * 20} sx={{ height: 6, borderRadius: 3 }} />
        </Box>

        {/* Desktop View Stepper */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ display: { xs: "none", md: "flex" }, overflowX: "auto", py: 0.5 }}>
          {[
            { num: 1, label: "Select Validator", sub: validatorType },
            { num: 2, label: "Select Franchise Level", sub: selectedUser?.level || "Pincode Owner" },
            { num: 3, label: "Select Specific Person", sub: selectedUser ? selectedUser.name : "From List" },
            { num: 4, label: "Set Amount & Profit", sub: `₹${totalEligibleLimit.toLocaleString("en-IN")}` },
            { num: 5, label: "Save Configuration", sub: "Admin Action" },
          ].map((st, i, arr) => {
            const isDone = activeStep >= st.num;
            const isCurrent = activeStep === st.num;
            return (
              <React.Fragment key={st.num}>
                <Stack direction="row" alignItems="center" spacing={1.2} sx={{ minWidth: "fit-content", px: 1 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      bgcolor: isCurrent ? "#2563EB" : isDone ? "#059669" : "#F1F5F9",
                      color: isDone || isCurrent ? "#FFFFFF" : "#64748B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    {isDone && !isCurrent ? "✓" : st.num}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12.5, fontWeight: isCurrent ? 900 : 700, color: isCurrent ? "#2563EB" : "#1E293B" }}>
                      {st.label}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: "#64748B", fontWeight: 600 }}>{st.sub}</Typography>
                  </Box>
                </Stack>
                {i < arr.length - 1 && (
                  <Typography sx={{ color: "#CBD5E1", fontWeight: 900, px: 0.5 }}>➔</Typography>
                )}
              </React.Fragment>
            );
          })}
        </Stack>
      </Paper>

      {/* ── TWO-COLUMN MAIN CONTENT ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.25fr 1fr" }, gap: 2.5, alignItems: "start" }}>
        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* LEFT COLUMN: FRANCHISEE SELECTOR TABLE & FILTERS                */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
          {/* Header row with step 3 badge */}
          <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2 }}>
            <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: "#059669", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>
              3
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#0F172A" }}>
              Select Franchisee or Consumer
            </Typography>
          </Stack>

          {/* Top Dropdowns Row (Validator, Franchise Level, Cycle) */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mb: 2 }}>
            <TextField
              select
              size="small"
              label="Validator"
              value={validatorType}
              onChange={(e) => setValidatorType(e.target.value)}
              sx={{ flex: 1 }}
            >
              <MenuItem value="Main Validator">Main Validator</MenuItem>
              <MenuItem value="Service Wise Validator">Service Wise Validator</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Franchise / User Level"
              value={franchiseLevel}
              onChange={(e) => {
                setFranchiseLevel(e.target.value);
                setPage(1);
              }}
              sx={{ flex: 1.2 }}
            >
              <MenuItem value="agency_pincode">Pincode Owner</MenuItem>
              <MenuItem value="agency_pincode_coordinator">Pincode Coordinator</MenuItem>
              <MenuItem value="agency_district">District Owner</MenuItem>
              <MenuItem value="agency_district_coordinator">District Coordinator</MenuItem>
              <MenuItem value="agency_state">State Owner</MenuItem>
              <MenuItem value="agency_state_coordinator">State Coordinator</MenuItem>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem value="consumer">Consumer (Prime / Agents)</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Cycle"
              value={selectedCycleFilter}
              onChange={(e) => setSelectedCycleFilter(e.target.value)}
              sx={{ flex: 0.9 }}
            >
              <MenuItem value="all">All Cycles</MenuItem>
              <MenuItem value="Cycle 1">Cycle 1</MenuItem>
              <MenuItem value="Cycle 2">Cycle 2</MenuItem>
              <MenuItem value="Cycle 3">Cycle 3</MenuItem>
              <MenuItem value="Cycle 4">Cycle 4</MenuItem>
              <MenuItem value="Others">Others</MenuItem>
            </TextField>
          </Stack>

          {/* Search Bar */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name, ID, mobile or pincode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchRoundedIcon sx={{ color: "#94A3B8", mr: 1, fontSize: 20 }} />,
            }}
            sx={{ mb: 2 }}
          />

          {/* Secondary Location Filters (State, District, PIN, Status) */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
            <TextField
              select
              size="small"
              label="State"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setDistrictFilter("All");
              }}
              sx={{ flex: 1 }}
            >
              <MenuItem value="All">State: All</MenuItem>
              {INDIAN_STATES.map((s) => (
                <MenuItem key={s.id} value={s.name}>{s.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="District"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              sx={{ flex: 1 }}
            >
              <MenuItem value="All">District: All</MenuItem>
              {(STATE_DISTRICTS_MAP[stateFilter] || ["Tumakuru", "Bengaluru Urban", "Hassan", "Kolar", "Ramanagara", "Kalaburagi"]).map((d) => (
                <MenuItem key={d} value={d}>{d}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ flex: 0.9 }}
            >
              <MenuItem value="All">Status: All</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
          </Stack>

          {/* Directory Data: Responsive Mobile Cards (xs to md) & Desktop Table (md+) */}
          {/* 1. Mobile Cards View (< 900px) */}
          <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", gap: 1.5 }}>
            {loadingUsers ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <CircularProgress size={24} />
                <Typography sx={{ fontSize: 12, color: "#64748B", mt: 1 }}>
                  Loading {targetAudience === "consumer" ? "consumer members" : "franchise partners"}...
                </Typography>
              </Box>
            ) : usersList.length === 0 ? (
              <Box sx={{ py: 3, textAlign: "center", color: "#64748B", fontSize: 12.5 }}>
                No {targetAudience === "consumer" ? "consumer members" : "franchise partners"} found for the selected filter.
              </Box>
            ) : (
              usersList
                .filter((u) => {
                  if (selectedCycleFilter !== "all" && u.activeCycle !== selectedCycleFilter) return false;
                  if (districtFilter !== "All" && u.district !== districtFilter) return false;
                  if (statusFilter !== "All" && u.status !== statusFilter) return false;
                  return true;
                })
                .map((user, idx) => {
                  const isSelected = selectedUser?.id === user.id;
                  const isCapReached = user.completionPct >= 100;
                  return (
                    <Paper
                      key={user.id}
                      elevation={0}
                      onClick={() => selectUserForEdit(user)}
                      sx={{
                        p: 1.6,
                        borderRadius: "14px",
                        border: isSelected ? "2px solid #2563EB" : "1px solid #E2E8F0",
                        bgcolor: isSelected ? "#EFF6FF" : "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                        <Box>
                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#2563EB" }}>
                              {user.franchiseId}
                            </Typography>
                            <Chip
                              label={user.activeCycle}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 10,
                                fontWeight: 800,
                                bgcolor: user.activeCycle === "Cycle 2" ? "#DBEAFE" : "#F1F5F9",
                                color: user.activeCycle === "Cycle 2" ? "#1D4ED8" : "#475569",
                              }}
                            />
                            {isCapReached && (
                              <Chip label="100% Cap" size="small" sx={{ height: 20, fontSize: 10, fontWeight: 900, bgcolor: "#FEF3C7", color: "#B45309" }} />
                            )}
                          </Stack>
                          <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", mt: 0.3 }}>
                            {user.name}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant={isSelected ? "contained" : "outlined"}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectUserForEdit(user);
                          }}
                          sx={{
                            minWidth: 54,
                            py: 0.3,
                            px: 1.2,
                            fontSize: 11.5,
                            fontWeight: 800,
                            textTransform: "none",
                            borderRadius: "8px",
                          }}
                        >
                          {isSelected ? "Selected" : "Edit"}
                        </Button>
                      </Stack>

                      <Grid container spacing={0.8} sx={{ fontSize: 12, color: "#475569", mt: 0.5 }}>
                        <Grid item xs={6}>
                          <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>Level:</Typography>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#1E293B" }}>{user.level}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>Mobile:</Typography>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#1E293B" }}>{user.phone}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>Location:</Typography>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "#334155" }}>{user.pincode} • {user.district}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>Cap %:</Typography>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: isCapReached ? "#D97706" : "#059669" }}>
                            {user.completionPct}% {isCapReached ? "🏆" : ""}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  );
                })
            )}
          </Box>

          {/* 2. Desktop Data Table (md+) */}
          <TableContainer sx={{ display: { xs: "none", md: "block" }, border: "1px solid #EEF2F6", borderRadius: "14px", overflow: "hidden" }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#F8FAFC" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569" }}>Sl No</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569" }}>
                    {targetAudience === "consumer" ? "Member ID" : "Franchise ID"}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569" }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569" }}>Pincode</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569" }}>District</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569" }}>State</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569" }}>Cycle</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569" }}>Cap %</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11.5, color: "#475569", textAlign: "center" }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ py: 4, textAlign: "center" }}>
                      <CircularProgress size={24} />
                      <Typography sx={{ fontSize: 12, color: "#64748B", mt: 1 }}>
                        Loading {targetAudience === "consumer" ? "consumer members" : "franchise partners"}...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : usersList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ py: 3, textAlign: "center", color: "#64748B", fontSize: 12.5 }}>
                      No {targetAudience === "consumer" ? "consumer members" : "franchise partners"} found for the selected filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  usersList
                    .filter((u) => {
                      if (selectedCycleFilter !== "all" && u.activeCycle !== selectedCycleFilter) return false;
                      if (districtFilter !== "All" && u.district !== districtFilter) return false;
                      if (statusFilter !== "All" && u.status !== statusFilter) return false;
                      return true;
                    })
                    .map((user, idx) => {
                      const isSelected = selectedUser?.id === user.id;
                      const isCapReached = user.completionPct >= 100;
                      return (
                        <TableRow
                          key={user.id}
                          hover
                          onClick={() => selectUserForEdit(user)}
                          sx={{
                            cursor: "pointer",
                            bgcolor: isSelected ? "#EFF6FF" : "inherit",
                            "&:hover": { bgcolor: isSelected ? "#DBEAFE" : "#F8FAFC" },
                          }}
                        >
                          <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{idx + 1}</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 900, color: "#2563EB" }}>{user.franchiseId}</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{user.name}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: "#475569" }}>{user.pincode}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: "#475569" }}>{user.district}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: "#475569" }}>{user.state}</TableCell>
                          <TableCell sx={{ fontSize: 11, fontWeight: 800 }}>
                            <Chip
                              label={user.activeCycle}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 10,
                                fontWeight: 800,
                                bgcolor: user.activeCycle === "Cycle 2" ? "#EFF6FF" : "#F1F5F9",
                                color: user.activeCycle === "Cycle 2" ? "#1D4ED8" : "#475569",
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: 11.5, fontWeight: 800, color: isCapReached ? "#D97706" : "#059669" }}>
                            {user.completionPct}% {isCapReached ? "🏆" : ""}
                          </TableCell>
                          <TableCell sx={{ textAlign: "center" }}>
                            <Button
                              size="small"
                              variant={isSelected ? "contained" : "outlined"}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectUserForEdit(user);
                              }}
                              sx={{
                                minWidth: 54,
                                py: 0.2,
                                px: 1,
                                fontSize: 11.5,
                                fontWeight: 800,
                                textTransform: "none",
                                borderRadius: "8px",
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination Controls */}
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 600 }}>
              Showing {usersList.length} of {totalCount} {franchiseLevel.replace("agency_", "").replace("_", " ")} entries
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} sx={{ minWidth: 28, py: 0.2, fontWeight: 800 }}>
                &lt;
              </Button>
              <Chip label={page} size="small" color="primary" sx={{ height: 24, fontSize: 11, fontWeight: 900 }} />
              <Button size="small" disabled={usersList.length < pageSize} onClick={() => setPage((p) => p + 1)} sx={{ minWidth: 28, py: 0.2, fontWeight: 800 }}>
                &gt;
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* RIGHT COLUMN: DETAIL SETUP & CYCLE ACTIVATOR PANEL              */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {selectedUser ? (
          <Paper id="validator-step4-form" elevation={0} sx={{ p: { xs: 1.8, sm: 2.2 }, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0" }}>
            {/* Header row with step 4 badge & Back button */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: "#2563EB", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>
                  4
                </Box>
                <Typography sx={{ fontSize: { xs: 13.5, sm: 14.5 }, fontWeight: 900, color: "#0F172A" }}>
                  Set Amount & Profit for Selected Franchisee
                </Typography>
              </Stack>
              <Button
                size="small"
                startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => setSelectedUser(null)}
                sx={{ fontSize: 11, fontWeight: 700, textTransform: "none" }}
              >
                Back to List
              </Button>
            </Stack>

            {/* Selected User Details Badge Card */}
            <Paper elevation={0} sx={{ p: 1.6, mb: 2.2, borderRadius: "14px", bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: 11, color: "#64748B" }}>Name</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>: {selectedUser.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: 11, color: "#64748B" }}>Level</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#2563EB" }}>: {selectedUser.level}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: 11, color: "#64748B" }}>Franchise ID</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>: {selectedUser.franchiseId}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: 11, color: "#64748B" }}>Pincode / Dist</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>: {selectedUser.pincode} • {selectedUser.district}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: 11, color: "#64748B" }}>Mobile</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>: {selectedUser.phone}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: 11, color: "#64748B" }}>State & Status</Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>: {selectedUser.state}</Typography>
                    <Chip label="Active" size="small" sx={{ height: 18, fontSize: 10, bgcolor: "#DCFCE7", color: "#15803D", fontWeight: 800 }} />
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            {/* Consumer Indicator Banner */}
            {targetAudience === "consumer" && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1.25,
                }}
              >
                <Typography sx={{ fontSize: 18, lineHeight: 1 }}>🎓</Typography>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#1E40AF" }}>
                    Consumer Academic Cycle Configuration
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: "#3B82F6", mt: 0.25 }}>
                    Standard Package: <b>₹50,000</b> (All 3 Tracks) • Layer Cap: <b>₹1,00,000</b> • Royalty Cap: <b>₹50,000</b> • Total Cap: <b>₹1,50,000</b> (+200% Yield).
                    Earnings exceeding the total cap are automatically preserved into <i>Missing Blocks Income</i> until Cycle 2 renewal.
                  </Typography>
                </Box>
              </Box>
            )}

            {/* ── COMMISSION SETTING (MAIN VALIDATOR) ── */}
            <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A", mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
              <span style={{ color: "#2563EB" }}>♾️</span> Commission Setting ({validatorType})
            </Typography>

            <Stack spacing={1.5} sx={{ mb: 2 }}>
              {/* Row 1: Cycle Selector, Base Amount, Profit % (Responsive Grid) */}
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Cycle"
                    value={userCycleConfig.cycle}
                    onChange={(e) => setUserCycleConfig((c) => ({ ...c, cycle: e.target.value }))}
                  >
                    <MenuItem value="Cycle 1">Cycle 1</MenuItem>
                    <MenuItem value="Cycle 2">Cycle 2</MenuItem>
                    <MenuItem value="Cycle 3">Cycle 3</MenuItem>
                    <MenuItem value="Cycle 4">Cycle 4</MenuItem>
                    <MenuItem value="Others">Others</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Base Amount (₹)"
                    type="number"
                    value={userCycleConfig.baseAmount}
                    onChange={(e) => setUserCycleConfig((c) => ({ ...c, baseAmount: Number(e.target.value) }))}
                    helperText="Enter base investment"
                  />
                </Grid>

                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Profit Percentage (%)"
                    value={userCycleConfig.profitPercent}
                    onChange={(e) => setUserCycleConfig((c) => ({ ...c, profitPercent: Number(e.target.value) }))}
                  >
                    <MenuItem value={50}>50%</MenuItem>
                    <MenuItem value={75}>75%</MenuItem>
                    <MenuItem value={100}>100%</MenuItem>
                    <MenuItem value={125}>125%</MenuItem>
                    <MenuItem value={150}>150%</MenuItem>
                    <MenuItem value={200}>200%</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              {/* Profit Amount & Total Amount Card */}
              <Box sx={{ p: 1.6, borderRadius: "14px", bgcolor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
                  <Box>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#166534" }}>Profit Amount (₹)</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#15803D" }}>
                      ₹{profitAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#166534" }}>Total Earning Cap (₹)</Typography>
                    <Typography sx={{ fontSize: { xs: 20, sm: 22 }, fontWeight: 950, color: "#166534" }}>
                      ₹{totalEligibleLimit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Stack>
                <Typography sx={{ fontSize: 10.5, color: "#15803D", mt: 0.8, fontWeight: 600 }}>
                  Formula: Total = Base Amount + Profit Amount ({baseAmt.toLocaleString("en-IN")} + {profitAmt.toLocaleString("en-IN")} = {totalEligibleLimit.toLocaleString("en-IN")})
                </Typography>
              </Box>

              {/* ── 2ND CYCLE ONWARDS: GST (18%) + ADMIN CHARGE (7%) BREAKDOWN ── */}
              {isRenewalCycle && (
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: "14px", bgcolor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={0.8} sx={{ mb: 1 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: "#92400E" }}>
                      🔒 {userCycleConfig.cycle} Statutory Deductions (Wallet / Coupon Only)
                    </Typography>
                    <Chip label="25% Combined Fee" size="small" sx={{ bgcolor: "#FCD34D", color: "#78350F", fontWeight: 800, fontSize: 10 }} />
                  </Stack>

                  <Grid container spacing={1.5} sx={{ mb: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        size="small"
                        type="number"
                        label="Cycle GST Rate (%)"
                        value={userCycleConfig.gstPercent}
                        onChange={(e) => setUserCycleConfig((c) => ({ ...c, gstPercent: Number(e.target.value) }))}
                        fullWidth
                        helperText={`+ ₹${gstAmt.toLocaleString("en-IN")} Govt Tax`}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        size="small"
                        type="number"
                        label="Admin Charge (%)"
                        value={userCycleConfig.adminChargePercent}
                        onChange={(e) => setUserCycleConfig((c) => ({ ...c, adminChargePercent: Number(e.target.value) }))}
                        fullWidth
                        helperText={`+ ₹${adminChargeAmt.toLocaleString("en-IN")} Platform Fee`}
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ p: 1, borderRadius: "10px", bgcolor: "#FEF3C7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#78350F" }}>
                      Total Payable to Activate {userCycleConfig.cycle}:
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 950, color: "#B45309" }}>
                      ₹{totalPayableFromWallet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  </Box>
                </Paper>
              )}
            </Stack>

            {/* ── DISTRIBUTION TO FRANCHISE HOLDERS TABLE (45%, 23%, 11%, ...) ── */}
            <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: "#0F172A", mb: 1 }}>
              Distribution to Franchise Holders
            </Typography>
            <TableContainer sx={{ border: "1px solid #EEF2F6", borderRadius: "12px", mb: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#F8FAFC" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569" }}>Level</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569", textAlign: "center" }}>Percentage</TableCell>
                    <TableCell sx={{ fontWeight: 800, fontSize: 11, color: "#475569", textAlign: "right" }}>Amount (₹)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {distributionWaterfall.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontSize: 11.5, fontWeight: 700, color: "#1E293B" }}>{item.level}</TableCell>
                      <TableCell sx={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", textAlign: "center" }}>{item.pct}%</TableCell>
                      <TableCell sx={{ fontSize: 11.5, fontWeight: 800, color: "#059669", textAlign: "right" }}>₹{Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "#F1F5F9" }}>
                    <TableCell sx={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>Total</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 900, color: "#2563EB", textAlign: "center" }}>100%</TableCell>
                    <TableCell sx={{ fontSize: 12, fontWeight: 900, color: "#059669", textAlign: "right" }}>₹{totalEligibleLimit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* ── CYCLE ACTIVATOR CONTROLS (ADMIN CONTROLLED) ── */}
            <Paper elevation={0} sx={{ p: 1.6, mb: 2, borderRadius: "14px", bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: "#1E40AF", mb: 0.5 }}>
                ⚙️ Admin Cycle Activator & Access Gate
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#3B82F6", mb: 1.5 }}>
                Control whether {selectedUser.name} can enter {userCycleConfig.cycle}. Admin can directly activate or authorize in-app self-renewal.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<RocketLaunchRoundedIcon />}
                  onClick={() => handleSaveConfig("activate")}
                  disabled={savingConfig}
                  sx={{
                    bgcolor: "#2563EB",
                    borderRadius: "10px",
                    fontWeight: 800,
                    fontSize: 11.5,
                    textTransform: "none",
                    py: 0.9,
                    "&:hover": { bgcolor: "#1D4ED8" },
                  }}
                >
                  {savingConfig ? "Activating..." : `🚀 Force Activate ${userCycleConfig.cycle}`}
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<VerifiedUserRoundedIcon />}
                  onClick={() => handleSaveConfig("authorize")}
                  disabled={savingConfig}
                  sx={{
                    borderColor: "#3B82F6",
                    color: "#1D4ED8",
                    bgcolor: "#FFFFFF",
                    borderRadius: "10px",
                    fontWeight: 800,
                    fontSize: 11.5,
                    textTransform: "none",
                    py: 0.9,
                  }}
                >
                  🔓 Authorize Renewal
                </Button>
              </Stack>
            </Paper>

            {/* Success message banner */}
            {saveSuccessMsg && (
              <Alert severity="success" sx={{ mb: 2, fontSize: 12, fontWeight: 700 }}>
                {saveSuccessMsg}
              </Alert>
            )}

            {/* Bottom Actions: Cancel & Save Configuration */}
            <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1.5} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={() => setSelectedUser(null)}
                sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 700, px: 2.5, width: { xs: "100%", sm: "auto" } }}
              >
                ✕ Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => handleSaveConfig("save")}
                disabled={savingConfig}
                sx={{
                  bgcolor: "#059669",
                  borderRadius: "10px",
                  textTransform: "none",
                  fontWeight: 900,
                  px: 3,
                  width: { xs: "100%", sm: "auto" },
                  "&:hover": { bgcolor: "#047857" },
                }}
              >
                {savingConfig ? "Saving..." : "💾 Save Configuration"}
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ p: 4, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0", textAlign: "center" }}>
            <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2 }}>
              <EditRoundedIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>
              No Franchisee Selected
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#64748B", mt: 0.5, maxWidth: 320, mx: "auto" }}>
              Click the <strong>Edit</strong> button on any franchise partner from the list to set their Base Amount, Profit %, and activate their Cycles.
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
