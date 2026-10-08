import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Alert,
  Divider,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Drawer,
  TextField,
  IconButton,
  InputAdornment,
  Snackbar,
  Card,
  CardContent,
} from "@mui/material";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import HourglassEmptyRoundedIcon from "@mui/icons-material/HourglassEmptyRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import API, {
  getRanks,
  getUpgradeEligibility,
  initiateUpgrade,
  createRankUpgradePayment,
  createRankUpgradeFromWallet,
  getEcouponStoreBootstrap,
  getWalletMe,
  getWalletMeFresh,
  getWalletMeHistory,
  getMyLevelBonusProgress,
  getMyRankCommissionHolds,
  listMyPromoPurchases,
} from "../api/api";
import normalizeMediaUrl from "../utils/media";
import {
  getMainWalletBalance,
  getAddMoneyPocketBalance,
  getPackagePurchaseCouponBalance,
  getSelfPackageWalletBalance,
} from "../utils/walletBalances";
import AccordionTree from "../components/genealogy/AccordionTree";

function fmt(val) {
  const num = Number(val || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0";
}

const RANK_TIERS = [
  { level: 1, name: "Layer 1", upgradeAmt: 250, limit: 1750, teamCount: 5 },
  { level: 2, name: "Layer 2", upgradeAmt: 500, limit: 2000, teamCount: 25 },
  { level: 3, name: "Layer 3", upgradeAmt: 1000, limit: 4000, teamCount: 50 },
  { level: 4, name: "Layer 4", upgradeAmt: 1250, limit: 6000, teamCount: 100 },
  { level: 5, name: "Layer 5", upgradeAmt: 1500, limit: 7500, teamCount: 150 },
  { level: 6, name: "Layer 6", upgradeAmt: 1750, limit: 8750, teamCount: 175 },
  { level: 7, name: "Layer 7", upgradeAmt: 2000, limit: 10000, teamCount: 200 },
  { level: 8, name: "Layer 8", upgradeAmt: 5000, limit: 15000, teamCount: "-" },
  { level: 9, name: "Layer 9", upgradeAmt: 10000, limit: 20000, teamCount: "-" },
  { level: 10, name: "Layer 10", upgradeAmt: 25000, limit: 100000, teamCount: "-" },
];

function RankPaymentMethodDialog({ open, onClose, data, walletMe, walletHistory, busy, onPickManual, onPickWallet }) {
  if (!open || !data?.upgrade) return null;
  const amount = Number(data.upgrade.upgrade_amount || 0);
  const mainBal = getMainWalletBalance(walletMe);
  const canMainWallet = mainBal >= amount && amount > 0;
  const money = (value) => Number(value || 0).toFixed(2);

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          boxShadow: "0 24px 80px rgba(15,23,42,0.24)",
          overflow: "hidden",
        },
      }}
      BackdropProps={{ sx: { backgroundColor: "rgba(15, 23, 42, 0.44)", backdropFilter: "blur(8px)" } }}
    >
      <DialogTitle sx={{ fontWeight: 900, color: "#0f172a", pb: 1 }}>Select Payment Method</DialogTitle>
      <DialogContent dividers sx={{ borderColor: "rgba(226,232,240,0.9)", pt: 2, pb: 2.5 }}>
        <Box sx={{ mb: 2, p: 2, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #e2e8f0" }}>
          <Typography variant="body2" color="text.secondary">Total Payable Amount</Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>₹{money(amount)}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <span>Main Wallet Balance:</span>
          <b style={{ color: canMainWallet ? "#16a34a" : "#dc2626" }}>₹{money(mainBal)}</b>
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
        <Button
          variant="contained"
          fullWidth
          disabled={!canMainWallet || busy}
          onClick={() => onPickWallet("main")}
          sx={{
            py: 1.25,
            borderRadius: 3,
            fontWeight: 800,
            bgcolor: "#0284c7",
            "&:hover": { bgcolor: "#0369a1" },
            textTransform: "none",
          }}
        >
          {canMainWallet ? `Pay from Main Wallet (₹${money(mainBal)})` : `Insufficient Main Wallet (Available: ₹${money(mainBal)})`}
        </Button>
        <Button
          variant="outlined"
          fullWidth
          disabled={busy}
          onClick={onPickManual}
          sx={{
            py: 1.25,
            borderRadius: 3,
            fontWeight: 800,
            borderColor: "#0f172a",
            color: "#0f172a",
            "&:hover": { bgcolor: "#f1f5f9", borderColor: "#0f172a" },
            textTransform: "none",
          }}
        >
          Pay via Payment Gateway / Online
        </Button>
        <Button
          onClick={onClose}
          disabled={busy}
          sx={{ mt: 0.5, borderRadius: 3, textTransform: "none", color: "#64748b" }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RankPaymentSheet({ open, onClose, data, onSuccess }) {
  const [txnId, setTxnId] = useState("");
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [payment, setPayment] = useState(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let alive = true;
    if (open) {
      (async () => {
        try {
          const boot = await getEcouponStoreBootstrap();
          if (alive) setPayment(boot?.payment_config || null);
        } catch {
          if (alive) setPayment(null);
        }
      })();
    }
    return () => {
      alive = false;
    };
  }, [open]);

  if (!data || !data.upgrade) return null;
  const amount = Number(data.upgrade.upgrade_amount || 0);

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            height: "88vh",
            p: 2,
          },
        }}
      >
        <Box sx={{ width: 40, height: 4, bgcolor: "divider", mx: "auto", mb: 1 }} />

        <Typography fontWeight={900} fontSize={18} textAlign="center">
          Complete Payment
        </Typography>

        <Box sx={{ p: 2, mt: 2, bgcolor: "grey.50", borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
          <Typography fontWeight={700}>
            Upgrade to {data?.upgrade?.to_rank_name || "Rank"}
          </Typography>
          <Stack direction="row" justifyContent="space-between" mt={1}>
            <Typography color="text.secondary">Total Amount</Typography>
            <Typography fontWeight={900} fontSize={20}>
              ₹{Number(amount || 0).toFixed(2)}
            </Typography>
          </Stack>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ p: 2, mt: 2 }}>
          <Typography fontWeight={700} mb={1}>
            UPI Payment
          </Typography>

          {payment?.upi_qr_image_url ? (
            <Box
              component="img"
              src={normalizeMediaUrl(payment.upi_qr_image_url)}
              alt="UPI QR"
              sx={{ width: 180, mx: "auto", display: "block", mb: 2, cursor: "pointer", borderRadius: 1 }}
              onClick={() => setZoomOpen(true)}
            />
          ) : null}

          <TextField
            label="UPI ID"
            value={payment?.upi_id || ""}
            fullWidth
            onClick={() => {
              const v = payment?.upi_id || "";
              if (v) navigator.clipboard.writeText(v);
              setCopied(true);
            }}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => {
                      const v = payment?.upi_id || "";
                      if (v) navigator.clipboard.writeText(v);
                      setCopied(true);
                    }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          Amount is auto‑calculated and locked. Pay the exact amount.
        </Alert>

        <TextField
          label="Transaction / UTR ID (Optional)"
          fullWidth
          sx={{ mt: 2 }}
          value={txnId}
          onChange={(e) => setTxnId(e.target.value)}
        />

        <Button component="label" sx={{ mt: 2 }}>
          Upload Payment Screenshot
          <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0])} />
        </Button>

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 3, height: 52 }}
          disabled={!file || submitting}
          onClick={async () => {
            setSubmitting(true);
            setErrorMsg("");
            try {
              await createRankUpgradePayment({
                upgrade_id: data.upgrade.id,
                utr: txnId,
                remarks: "",
                file,
              });
              onClose?.();
              onSuccess?.();
              setTxnId("");
              setFile(null);
            } catch (e) {
              const msg =
                e?.response?.data?.detail ||
                e?.message ||
                "Failed to submit payment. Please try again.";
              setErrorMsg(msg);
              setErrorOpen(true);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Submitting..." : "Submit Payment"}
        </Button>

        <Button fullWidth variant="text" sx={{ mt: 1 }} onClick={onClose}>
          Cancel
        </Button>
      </Drawer>

      <Dialog open={zoomOpen} onClose={() => setZoomOpen(false)}>
        <Box sx={{ p: 2 }}>
          {payment?.upi_qr_image_url ? (
            <Box
              component="img"
              src={normalizeMediaUrl(payment.upi_qr_image_url)}
              alt="UPI QR Large"
              sx={{ width: { xs: 300, sm: 400 }, height: "auto" }}
            />
          ) : null}
        </Box>
      </Dialog>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="UPI ID copied"
      />
      <Snackbar
        open={errorOpen}
        autoHideDuration={4000}
        onClose={() => setErrorOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setErrorOpen(false)} severity="error" sx={{ width: "100%" }}>
          {errorMsg || "Something went wrong. Please try again."}
        </Alert>
      </Snackbar>
    </>
  );
}

export default function RankUpgrade({ defaultToRankId = null, teamSummary: propTeamSummary = null } = {}) {
  const navigate = useNavigate();

  const [ranks, setRanks] = useState([]);
  const [elig, setElig] = useState(null);
  const [walletHistory, setWalletHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [initDialog, setInitDialog] = useState(false);
  const [createdUpgrade, setCreatedUpgrade] = useState(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [walletMe, setWalletMe] = useState(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletErr, setWalletErr] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [successTitle, setSuccessTitle] = useState("Payment Request Submitted");
  const [successMessage, setSuccessMessage] = useState("We will review it shortly.");
  const [error, setError] = useState("");
  const [selectedToRankId, setSelectedToRankId] = useState(null);
  const [selectedToRankName, setSelectedToRankName] = useState("");

  const [lbProgress, setLbProgress] = useState(null);
  const [lbHolds, setLbHolds] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [hasApprovedBase, setHasApprovedBase] = useState(false);
  const [teamSummary, setTeamSummary] = useState(propTeamSummary);
  const [fiveCounts, setFiveCounts] = useState(null);

  useEffect(() => {
    if (propTeamSummary) setTeamSummary(propTeamSummary);
  }, [propTeamSummary]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const results = await Promise.allSettled([
          getRanks(),
          getUpgradeEligibility(),
          getWalletMeHistory(),
          getMyLevelBonusProgress(),
          getMyRankCommissionHolds(),
          listMyPromoPurchases(),
          API.get("/accounts/team/summary/").then((r) => r?.data || null),
          API.get("/accounts/genealogy/5m/counts/?pool=FIVE_150&depth=10").then((r) => r?.data || null),
        ]);
        if (!alive) return;

        if (results[0].status === "fulfilled") setRanks(Array.isArray(results[0].value) ? results[0].value : []);
        if (results[1].status === "fulfilled") setElig(results[1].value || null);
        if (results[2].status === "fulfilled") setWalletHistory(results[2].value || null);
        if (results[3].status === "fulfilled") setLbProgress(results[3].value || null);
        if (results[4].status === "fulfilled") setLbHolds(Array.isArray(results[4].value) ? results[4].value : []);
        if (results[5].status === "fulfilled") {
          const hist = results[5].value;
          const ok = Array.isArray(hist) && hist.some((h) => {
            const status = String(h?.status || "").toUpperCase();
            const type = String(h?.package?.type || "").toUpperCase();
            return status === "APPROVED" && type !== "MONTHLY";
          });
          setHasApprovedBase(!!ok);
        }
        if (results[6].status === "fulfilled") setTeamSummary(results[6].value || null);
        if (results[7].status === "fulfilled") setFiveCounts(results[7].value || null);
      } catch (e) {
        if (!alive) return;
        setError(e?.response?.data?.detail || e?.message || "Failed to load rank data");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const achievedLevel = useMemo(() => {
    const apiLevel = Number(elig?.achieved_level || 0);
    if (!hasApprovedBase) return 0;
    return Math.max(0, apiLevel);
  }, [elig?.achieved_level, hasApprovedBase]);

  const effectiveAchievedLevel = achievedLevel;

  const currentLevel = Math.max(1, achievedLevel);
  const nextLevel = currentLevel < 10 ? currentLevel + 1 : 10;

  const currentLimit = useMemo(() => {
    const tier = RANK_TIERS.find((t) => t.level === currentLevel);
    return Number(walletHistory?.current_limit || tier?.limit || 1750);
  }, [currentLevel, walletHistory]);

  const layerMatrixEarned = useMemo(() => {
    return Number(
      walletHistory?.layer_matrix_earned ??
      walletHistory?.income?.matrixLevel ??
      0
    );
  }, [walletHistory]);

  const directEduEarned = useMemo(() => {
    return Number(walletHistory?.direct_edu_earned ?? 0);
  }, [walletHistory]);

  const eEduEarnings = useMemo(() => {
    const fromApi = Number(walletHistory?.e_edu_total_earned ?? 0);
    if (fromApi > 0) return fromApi;
    return layerMatrixEarned + directEduEarned;
  }, [walletHistory, layerMatrixEarned, directEduEarned]);

  const totalEarnings = useMemo(() => {
    return layerMatrixEarned;
  }, [layerMatrixEarned]);

  const isLimitReached =
    walletHistory?.is_limit_reached ?? (totalEarnings >= currentLimit);

  const percentUsed =
    currentLimit > 0
      ? Math.min(100, Math.max(0, (totalEarnings / currentLimit) * 100))
      : 0;

  const layerMatrixEligible = useMemo(() => {
    return Number(
      walletHistory?.layer_matrix_eligible || Math.max(100000, currentLevel * 10000)
    );
  }, [walletHistory, currentLevel]);

  const missingIncome = useMemo(() => {
    return Number(
      walletHistory?.missing_income ||
        (isLimitReached ? Math.max(0, totalEarnings - currentLimit) : 0)
    );
  }, [walletHistory, isLimitReached, totalEarnings, currentLimit]);

  const layerMatrixPercent = useMemo(() => {
    return layerMatrixEligible > 0
      ? Math.min(100, (layerMatrixEarned / layerMatrixEligible) * 100)
      : 0;
  }, [layerMatrixEarned, layerMatrixEligible]);

  const savedRankConfig = useMemo(() => {
    try {
      const raw = localStorage.getItem("tri_rank_upgrade_config");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.levels?.[2]?.team_count === "50") {
        parsed.levels[2].team_count = "125";
        parsed.levels[3].team_count = "625";
        parsed.levels[4].team_count = "3125";
        parsed.levels[5].team_count = "15625";
        parsed.levels[6].team_count = "78125";
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const [royaltyConfig, setRoyaltyConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_royalty_config");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      tier1_percent: 4,
      tier1_cap: 10000,
      tier1_days: 40,
      tier1_levels: "Layer 1 to Layer 7",
      tier2_percent: 6,
      tier2_cap: 40000,
      tier2_days: 7,
      tier2_levels: "Layer 8 to Layer 10",
    };
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/royalty-config.json");
        if (res.ok) {
          const cfg = await res.json();
          if (alive && cfg && typeof cfg === "object") {
            setRoyaltyConfig((prev) => ({ ...prev, ...cfg }));
          }
        }
      } catch (_) {}
    })();
    return () => { alive = false; };
  }, []);

  const savedRoyaltyConfig = royaltyConfig;

  const royaltyShopping = useMemo(() => {
    let total = 0;
    const tier1 = Number(royaltyConfig?.tier1_cap ?? 10000);
    const tier2 = Number(royaltyConfig?.tier2_cap ?? 40000);
    if (currentLevel >= 7) {
      total += tier1;
    }
    if (currentLevel >= 10) {
      total += tier2;
    }
    return total;
  }, [currentLevel, royaltyConfig]);

  // ── 5-Matrix Education Rank Tree Community Blocks Data ──
  const [communityExpanded, setCommunityExpanded] = useState(false);

  const eEduCommunityGrid = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const lvl = i + 1;
      const maxCap = Math.pow(5, lvl);
      const count = Number(
        elig?.level_team_counts?.[lvl] ??
        elig?.team_counts_by_level?.[lvl] ??
        0
      );
      return {
        level: lvl,
        count,
        max_count: maxCap,
        isFull: count >= maxCap && count > 0,
        hasMembers: count > 0,
      };
    });
  }, [elig]);

  const totalCommunityBlocks = useMemo(() => {
    return eEduCommunityGrid.reduce((sum, row) => sum + row.count, 0);
  }, [eEduCommunityGrid]);

  const activeCommunityLayers = useMemo(() => {
    return eEduCommunityGrid.filter((r) => r.count > 0).length;
  }, [eEduCommunityGrid]);

  const completedCommunityLayers = useMemo(() => {
    return eEduCommunityGrid.filter((r) => r.isFull).length;
  }, [eEduCommunityGrid]);

  const visibleCommunityRows = communityExpanded ? eEduCommunityGrid : eEduCommunityGrid.slice(0, 5);

  const upgradeWindowInfo = useMemo(() => {
    const isL8Plus = currentLevel >= 8;
    const adminConfiguredDays = isL8Plus
      ? Number(
          elig?.upgrade_window_l8_l10 ||
          elig?.upgrade_window_days_l8_l10 ||
          savedRankConfig?.upgrade_window_l8_l10 ||
          15
        )
      : Number(
          elig?.upgrade_window_l1_l7 ||
          elig?.upgrade_window_days_l1_l7 ||
          savedRankConfig?.upgrade_window_l1_l7 ||
          7
        );

    if (!hasApprovedBase) {
      return {
        started: false,
        daysLeft: adminConfiguredDays,
        totalDays: adminConfiguredDays,
        levelRange: isL8Plus ? "L8 to L10" : "L1 to L7",
      };
    }

    let daysRemaining = elig?.days_left ?? elig?.remaining_days ?? elig?.upgrade_days_left ?? walletHistory?.days_left;
    if (daysRemaining === undefined || daysRemaining === null) {
      if (elig?.first_upgrade_date || elig?.base_purchase_date) {
        const firstDate = new Date(elig.first_upgrade_date || elig.base_purchase_date);
        const diffMs = Date.now() - firstDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, adminConfiguredDays - diffDays);
      } else {
        daysRemaining = adminConfiguredDays;
      }
    }

    return {
      started: true,
      daysLeft: Number(daysRemaining),
      totalDays: adminConfiguredDays,
      levelRange: isL8Plus ? "Layer 8 to Layer 10" : "Layer 1 to Layer 7",
    };
  }, [currentLevel, elig, walletHistory, savedRankConfig, hasApprovedBase]);

  const handleUpgradeClick = (rankTarget) => {
    const targetId = rankTarget?.id || (ranks.find((r) => Number(r.level_number || 0) === nextLevel)?.id);
    const targetName = rankTarget?.rank_name ? rankTarget.rank_name.replace(/Level/gi, "Layer") : `Layer ${nextLevel}`;
    setSelectedToRankId(targetId);
    setSelectedToRankName(targetName);
    setInitDialog(true);
  };

  const selAmount = useMemo(() => {
    const selectedRank = (ranks || []).find((rr) => rr.id === selectedToRankId);
    const targetLevel = Number(selectedRank?.level_number || nextLevel);
    const curLevel = effectiveAchievedLevel;
    if (!targetLevel || targetLevel <= curLevel) return Number(savedRankConfig?.levels?.[0]?.upgrade_amount || elig?.upgrade_amount || 250);
    let total = 0;
    for (let l = curLevel + 1; l <= targetLevel; l++) {
      const cfgLvl = savedRankConfig?.levels?.[l - 1];
      const apiLvl = (ranks || []).find((rr) => Number(rr.level_number || 0) === l);
      total += Number(cfgLvl?.upgrade_amount != null ? cfgLvl.upgrade_amount : (apiLvl?.upgrade_amount || 250));
    }
    return total;
  }, [selectedToRankId, ranks, elig, effectiveAchievedLevel, nextLevel, savedRankConfig]);

  if (loading) {
    return (
      <Box sx={{ p: 2, maxWidth: 840, mx: "auto" }}>
        <Typography fontSize={18} fontWeight={900} sx={{ mb: 1 }}>
          Digital Education (e - Edu)
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 840, mx: "auto", px: { xs: 1, sm: 2 }, py: 2 }}>
      {/* ── Title ── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography fontSize={22} fontWeight={950} color="#0f172a">
          Digital Education (e - Edu)
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Top Bar Indicators ── */}
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, mb: 2, bgcolor: "#fafafa" }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center" }}>
                <ShieldRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Current Layer</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b" }}>
                  Layer {currentLevel} <Chip label={currentLevel >= 10 ? "Max Layer" : "Eligible"} size="small" color={currentLevel >= 10 ? "success" : "primary"} sx={{ height: 18, fontSize: 10, fontWeight: 800 }} />
                </Typography>
              </Box>
            </Stack>
          </Grid>

          <Grid item xs={4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: currentLevel >= 10 ? "#f0fdf4" : "#fff7ed", color: currentLevel >= 10 ? "#16a34a" : "#d97706", display: "grid", placeItems: "center" }}>
                <AccessTimeRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Upgrade Window ({upgradeWindowInfo.levelRange})</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: currentLevel >= 10 ? "#16a34a" : upgradeWindowInfo.started ? "#d97706" : "#2563eb" }}>
                  {currentLevel >= 10 ? (
                    "All Layers Completed"
                  ) : upgradeWindowInfo.started ? (
                    <>
                      {`${upgradeWindowInfo.daysLeft} Days Left `}
                      <Typography component="span" sx={{ fontSize: 10, color: "#92400e" }}>
                        {`(Within ${upgradeWindowInfo.totalDays} Days)`}
                      </Typography>
                    </>
                  ) : (
                    <>
                      {`Starts on First Upgrade `}
                      <Typography component="span" sx={{ fontSize: 10, color: "#1d4ed8" }}>
                        {`(${upgradeWindowInfo.totalDays} Days Window)`}
                      </Typography>
                    </>
                  )}
                </Typography>
              </Box>
            </Stack>
          </Grid>

          <Grid item xs={4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "#f0fdf4", color: "#16a34a", display: "grid", placeItems: "center" }}>
                <TrendingUpRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Next Layer</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#15803d" }}>
                  {currentLevel >= 10 ? (
                    <>
                      Max Layer <Chip label="Completed" size="small" color="success" sx={{ height: 18, fontSize: 10, fontWeight: 800, ml: 0.5 }} />
                    </>
                  ) : (
                    <>
                      Layer {nextLevel} <Typography component="span" sx={{ fontSize: 10, color: "#166534" }}>(Upgrade to Continue)</Typography>
                    </>
                  )}
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Total Earnings & Wallet Status (Dark Blue Banner) ── */}
      <Card sx={{ bgcolor: "#1e1b4b", color: "#fff", borderRadius: 3, mb: 2, boxShadow: "0 14px 28px rgba(30,27,75,0.25)" }}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={7}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, opacity: 0.8, mb: 0.5 }}>
                TOTAL EARNINGS ⓘ
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
                ₹{fmt(totalEarnings)} <Typography component="span" sx={{ fontSize: 16, opacity: 0.7 }}>/ ₹{fmt(currentLimit)}</Typography>
              </Typography>
              <LinearProgress
                variant="determinate"
                value={percentUsed}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: "rgba(255,255,255,0.2)",
                  "& .MuiLinearProgress-bar": { bgcolor: isLimitReached ? "#ef4444" : "#f59e0b" },
                }}
              />
              <Typography sx={{ fontSize: 12, mt: 0.8, opacity: 0.85 }}>
                {isLimitReached ? `Earning Limit Reached for Layer ${currentLevel} ⓘ` : `Earning Limit Progress (${percentUsed.toFixed(0)}%) ⓘ`}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={5}>
              <Paper sx={{ p: 1.8, bgcolor: "rgba(255,255,255,0.1)", backdropFilter: "blur(6px)", borderRadius: 2.5, color: "#fff" }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AccountBalanceWalletRoundedIcon sx={{ color: isLimitReached ? "#ef4444" : "#22c55e" }} />
                  <Box>
                    <Typography sx={{ fontSize: 10, opacity: 0.8, fontWeight: 700 }}>WALLET STATUS</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 900, color: isLimitReached ? "#ef4444" : "#22c55e" }}>
                      {isLimitReached ? "INCOME STOPPED" : "ACTIVE"}
                    </Typography>
                  </Box>
                </Stack>
                <Typography sx={{ fontSize: 11, opacity: 0.9, mb: 1.5 }}>
                  {isLimitReached
                    ? `Limit reached for Layer ${currentLevel}. Upgrade or re-top up to continue income.`
                    : currentLevel >= 10
                    ? `Layer 10 unlocked. Max earning limit is ₹${fmt(currentLimit)}.`
                    : `Layer ${currentLevel} earning limit is ₹${fmt(currentLimit)}.`}
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  disabled={currentLevel >= 10 && !isLimitReached}
                  sx={{
                    bgcolor: currentLevel >= 10 && !isLimitReached ? "#059669" : "#ffffff",
                    color: currentLevel >= 10 && !isLimitReached ? "#ffffff" : "#1e1b4b",
                    fontWeight: 900,
                    "&.Mui-disabled": { bgcolor: "#059669", color: "#ffffff", opacity: 0.95 },
                    "&:hover": { bgcolor: "#f3f4f6" },
                  }}
                  onClick={() => handleUpgradeClick()}
                >
                  {currentLevel >= 10 && !isLimitReached ? "✓ Fully Upgraded (Layer 10)" : "Upgrade Now"}
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Earning Limit Layer Cards ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#fff" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>EARNING LIMIT (LAYER {currentLevel})</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0f172a", my: 0.5 }}>₹{fmt(currentLimit)}</Typography>
            {isLimitReached ? (
              <Chip icon={<CheckCircleRoundedIcon />} label="Completed" color="success" size="small" sx={{ fontWeight: 800 }} />
            ) : (
              <Chip label="In Progress" color="info" size="small" sx={{ fontWeight: 800 }} />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#fff" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
              {currentLevel >= 10 ? "TOTAL LAYER CAPACITY" : `NEXT TARGET (LAYER ${nextLevel})`}
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0f172a", my: 0.5 }}>
              ₹{fmt(currentLevel >= 10 ? 100000 : (RANK_TIERS.find((t) => t.level === nextLevel)?.limit || 0))}
            </Typography>
            {currentLevel >= 10 ? (
              <Chip icon={<CheckCircleRoundedIcon />} label="All Layers Unlocked" color="success" size="small" sx={{ fontWeight: 800 }} />
            ) : (
              <Chip label="Upcoming" color="default" size="small" sx={{ fontWeight: 800 }} />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#fff" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>NEXT CYCLE</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 900, color: isLimitReached ? "#d97706" : "#15803d", my: 0.5 }}>
              {isLimitReached ? "Re-Top Up Required" : "Active"}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>(Same Benefits Continue)</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Royalty Income, Layer Blocks & Missing Income Grid ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, borderColor: "#bbf7d0", bgcolor: "#fff" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <ShoppingBagRoundedIcon color="success" sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 900, fontSize: 12, color: "#15803d" }}>ROYALTY INCOME (SHOPPING) ⓘ</Typography>
              </Stack>
              <Chip label={`₹${fmt((Number(royaltyConfig?.tier1_cap ?? 10000) + Number(royaltyConfig?.tier2_cap ?? 40000)))}`} color="success" size="small" sx={{ fontWeight: 900, fontSize: 11 }} />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                    {royaltyConfig?.tier1_levels ? String(royaltyConfig.tier1_levels).replace(/Level/gi, "LAYER") : "LAYER 1 TO LAYER 7"}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#15803d" }}>
                    {royaltyConfig?.tier1_percent ?? 4}% ₹{fmt(royaltyConfig?.tier1_cap ?? 10000)}
                  </Typography>
                </Box>
                {currentLevel >= 7 ? (
                  <Chip icon={<CheckCircleRoundedIcon />} label="Completed" color="success" variant="outlined" size="small" />
                ) : (
                  <Chip label="Pending" color="default" variant="outlined" size="small" />
                )}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                    {royaltyConfig?.tier2_levels ? String(royaltyConfig.tier2_levels).replace(/Level/gi, "LAYER") : "LAYER 8 TO LAYER 10"}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#15803d" }}>
                    {royaltyConfig?.tier2_percent ?? 6}% ₹{fmt(royaltyConfig?.tier2_cap ?? 40000)}
                  </Typography>
                </Box>
                {currentLevel >= 10 ? (
                  <Chip icon={<CheckCircleRoundedIcon />} label="Completed" color="success" variant="outlined" size="small" />
                ) : (
                  <Chip label="Pending" color="default" variant="outlined" size="small" />
                )}
              </Stack>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#15803d" }}>
              TOTAL ELIGIBLE ROYALTY INCOME (SHOPPING) ₹{fmt((Number(royaltyConfig?.tier1_cap ?? 10000) + Number(royaltyConfig?.tier2_cap ?? 40000)))}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, borderColor: "#bfdbfe", bgcolor: "#fff" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <LayersRoundedIcon color="primary" sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 900, fontSize: 12, color: "#0369a1" }}>LAYER BLOCKS EARNINGS ⓘ</Typography>
              </Stack>
              <Chip label={`Eligible ₹${fmt(layerMatrixEligible)}`} color="primary" size="small" sx={{ fontWeight: 900, fontSize: 11 }} />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Typography sx={{ fontSize: 10, color: "#64748b", fontWeight: 700, mb: 0.5 }}>FROM LAYER BLOCKS (All Slabs)</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#0f172a", mb: 0.5 }}>₹{fmt(layerMatrixEarned)}</Typography>
            <LinearProgress variant="determinate" value={layerMatrixPercent} sx={{ height: 6, borderRadius: 3, mb: 1 }} />
            <Divider sx={{ my: 1 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#0369a1" }}>
              TOTAL ELIGIBLE LAYER INCOME ₹{fmt(layerMatrixEligible)}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, borderColor: "#fdba74", bgcolor: "#fff" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <HourglassEmptyRoundedIcon color="warning" sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 900, fontSize: 12, color: "#c2410c" }}>MISSING BLOCKS INCOME ⓘ</Typography>
              </Stack>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#c2410c", my: 0.5 }}>₹{fmt(missingIncome)}</Typography>
            <Typography sx={{ fontSize: 11, color: "#9a3412", mb: 1.5 }}>
              Income generated after limit reached will be shown here.
            </Typography>
            <Button size="small" sx={{ textTransform: "none", color: "#c2410c", fontWeight: 800, p: 0 }}>
              View Missing Income &gt;
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* ── 5-Matrix Education Community Blocks KPI Grid ── */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Paper
          variant="outlined"
          sx={{
            flex: "1 1 0",
            minWidth: 100,
            p: 1.5,
            textAlign: "center",
            borderRadius: 2.5,
            borderColor: "#bbf7d0",
            bgcolor: "#fff",
          }}
        >
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, mb: 0.5, whiteSpace: "nowrap" }}>
            Active Layers
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#16a34a" }}>
            {activeCommunityLayers}
          </Typography>
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            flex: "1 1 0",
            minWidth: 100,
            p: 1.5,
            textAlign: "center",
            borderRadius: 2.5,
            borderColor: "#fed7aa",
            bgcolor: "#fff",
          }}
        >
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, mb: 0.5, whiteSpace: "nowrap" }}>
            Layers Completed
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#d97706" }}>
            {completedCommunityLayers > 0 ? `L${completedCommunityLayers}` : "–"}
          </Typography>
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            flex: "1 1 0",
            minWidth: 120,
            p: 1.5,
            textAlign: "center",
            borderRadius: 2.5,
            borderColor: "#ddd6fe",
            bgcolor: "#fff",
          }}
        >
          <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, mb: 0.5, whiteSpace: "nowrap" }}>
            e-Edu Total Earnings
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#7c3aed" }}>
            ₹{fmt(eEduEarnings)}
          </Typography>
        </Paper>
      </Box>

      {/* ── Unified E-Education Layer & Community Blocks Table ── */}
      <Paper variant="outlined" sx={{ p: 0, mb: 2.5, borderRadius: 3, overflow: "hidden", borderColor: "#e2e8f0" }}>
        <TableContainer sx={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1e1b4b" }}>
              <TableRow sx={{ bgcolor: "#1e1b4b" }}>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5, fontSize: 12 }}>Layer</TableCell>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5, fontSize: 12 }}>Upgrade (₹)</TableCell>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5, fontSize: 12 }}>Earning Limit (₹)</TableCell>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5, fontSize: 12, textAlign: "center" }}>Community Blocks</TableCell>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5, textAlign: "right", fontSize: 12 }}>Action / Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const DEFAULT_LIMITS = [1750, 2000, 4000, 6000, 7500, 8750, 10000, 15000, 20000, 100000];
                return (ranks || []).map((r, idx) => {
                  const level = Number(r.level_number || idx + 1);
                  const maxCap = Math.pow(5, level);
                  const achieved = effectiveAchievedLevel >= level;
                  const isCurrentActive = level === effectiveAchievedLevel;
                  const canBuy = level === effectiveAchievedLevel + 1;

                  const cfgLvl = savedRankConfig?.levels?.[idx];
                  const limitVal = cfgLvl?.earning_limit ? Number(cfgLvl.earning_limit) : (DEFAULT_LIMITS[idx] || (r.earning_limit ? Number(r.earning_limit) : 0));
                  
                  // Compute exact real-time active community count for this layer from e-Education downline
                  const userTeamCount = Number(
                    elig?.level_team_counts?.[level] ??
                    elig?.team_counts_by_level?.[level] ??
                    0
                  );

                  const amtVal = cfgLvl?.upgrade_amount ? Number(cfgLvl.upgrade_amount) : Number(r.upgrade_amount || 0);
                  const rankTitle = cfgLvl?.name ? String(cfgLvl.name).replace(/Level/gi, "Layer") : (r.rank_name ? String(r.rank_name).replace(/Level/gi, "Layer") : `Layer ${level}`);
                  const isFull = userTeamCount >= maxCap && userTeamCount > 0;

                  return (
                    <TableRow
                      key={r.id || idx}
                      sx={{
                        bgcolor: isCurrentActive ? "#f3e8ff" : isFull ? "#f0fdf4" : achieved ? "#f8fafc" : "inherit",
                        "&:hover": { bgcolor: "#f1f5f9" },
                      }}
                    >
                      <TableCell sx={{ fontWeight: isCurrentActive ? 900 : 700, color: isCurrentActive ? "#6b21a8" : "inherit", fontSize: 12.5 }}>
                        {rankTitle}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12.5 }}>{amtVal.toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12.5 }}>{limitVal.toLocaleString("en-IN")}</TableCell>
                      <TableCell align="center">
                        <span style={{ fontWeight: 800, color: userTeamCount > 0 ? "#4f46e5" : "#64748b", fontSize: 12 }}>
                          {userTeamCount}
                        </span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}> / {maxCap.toLocaleString("en-IN")}</span>
                        {isFull && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: "#16a34a" }}>● Full</span>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {isCurrentActive && isLimitReached ? (
                          <Typography sx={{ color: "#ef4444", fontWeight: 900, fontSize: 12 }}>Limit Reached</Typography>
                        ) : achieved ? (
                          <Chip size="small" label="Purchased" color="success" variant="outlined" sx={{ fontWeight: 800, fontSize: 11 }} />
                        ) : canBuy ? (
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            sx={{ fontWeight: 800, borderRadius: 1.5, fontSize: 11, textTransform: "none", py: 0.5 }}
                            onClick={() => {
                              setSelectedToRankId(r.id);
                              setSelectedToRankName(r.rank_name);
                              setInitDialog(true);
                            }}
                          >
                            Upgrade
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled
                            sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: 11, textTransform: "none", py: 0.5 }}
                          >
                            Upgrade
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ p: 1.25, bgcolor: "#f8fafc", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
            ⓘ Total Cycle Limit: ₹1,50,000 for Layer 10
          </Typography>
        </Box>
      </Paper>

      {/* ── 5-Matrix Education Rank Hierarchy Trail View ── */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#111827",
          letterSpacing: "-0.2px",
          marginBottom: 8,
        }}
      >
        5‑Matrix Education View
      </div>
      <div
        style={{
          background: "#ede9fe",
          color: "#4f46e5",
          padding: "8px 12px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 14,
        }}
      >
        💡 <strong>Tap</strong> a member to drill down into their layer downline · tap root in trail to reset
      </div>

      {effectiveAchievedLevel > 0 ? (
        <AccordionTree
          useRankMatrix={true}
          pool="FIVE_150"
          maxDepth={10}
          currentRankLevel={effectiveAchievedLevel}
        />
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: "20px",
            bgcolor: "#FFFFFF",
            border: "1.5px dashed #E2E8F0",
            textAlign: "center",
          }}
        >
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#64748B", mb: 0.5 }}>
            No active 5-Matrix Education positions found.
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#94A3B8" }}>
            Purchase the ₹2,000 Digital Education Package (₹750 Prime + ₹1,000 SPP + ₹250 Layer 1 Upgrade) on <strong style={{ color: "#4F46E5" }}>trieducation.in</strong> to activate your 5-Matrix position.
          </Typography>
        </Paper>
      )}

      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          marginTop: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Active", bg: "#dcfce7", color: "#16a34a" },
          { label: "Empty / Open", bg: "#f3f4f6", color: "#9ca3af" },
        ].map((it) => (
          <div
            key={it.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "#6b7280",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: it.bg,
                border: `1.5px solid ${it.color}`,
                display: "inline-block",
              }}
            />
            {it.label}
          </div>
        ))}
      </div>

      {/* ── Layer Bonus Progress (Collapsible/Detailed) ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 1 }}>
          Layer Bonus Progress
        </Typography>
        {lbLoading ? <LinearProgress sx={{ mb: 1 }} /> : null}
        {lbProgress ? (
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
              <Typography color="text.secondary">Rank-1 Directs Completed</Typography>
              <Typography fontWeight={700}>{`${Number(lbProgress?.completed_rank1_directs || 0)} / ${Number(lbProgress?.threshold || 5)}`}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
              <Typography color="text.secondary">Eligible Now</Typography>
              <Typography fontWeight={700}>{lbProgress?.eligible_now ? "Yes" : "No"}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
              <Typography color="text.secondary">Pending Holds Total</Typography>
              <Typography fontWeight={700}>{`₹${Number(lbProgress?.holds_summary?.pending_total_amount || 0).toFixed(2)}`}</Typography>
            </Stack>
          </Box>
        ) : (
          <Typography color="text.secondary">
            Layer Bonus progress will appear here after you receive layer commissions.
          </Typography>
        )}
      </Paper>

      {/* ── Dialogs & Modals ── */}
      <Dialog open={initDialog} onClose={() => !busy && setInitDialog(false)}>
        <DialogTitle>Confirm Upgrade</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            Proceed to initiate your upgrade to <b>{selectedToRankName || elig?.next_rank}</b>. The system will record your upgrade
            request and upon successful payment confirmation, your rank will be upgraded and commissions distributed.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            Payable now: <b>₹{Number(selAmount).toFixed(2)}</b> (includes 15% GST). Net amount is used to compute commissions.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInitDialog(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              setCreatedUpgrade(null);
              try {
                const resp = await initiateUpgrade({ to_rank_id: selectedToRankId || elig?.next_rank_id });
                setCreatedUpgrade(resp || null);
                setInitDialog(false);
                setPaymentData({ upgrade: resp || null });
                try {
                  const [wallet, history] = await Promise.all([
                    getWalletMe(),
                    getWalletMeHistory().catch(() => null),
                  ]);
                  setWalletMe(wallet || null);
                  setWalletHistory(history || null);
                } catch {
                  setWalletMe(null);
                  setWalletHistory(null);
                }
                setMethodOpen(true);
              } catch (e) {
                setError(e?.response?.data?.detail || e?.message || "Failed to initiate upgrade");
                setInitDialog(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Please wait..." : "Initiate"}
          </Button>
        </DialogActions>
      </Dialog>

      <RankPaymentMethodDialog
        open={methodOpen}
        onClose={() => !walletBusy && setMethodOpen(false)}
        data={paymentData || (createdUpgrade ? { upgrade: createdUpgrade } : null)}
        walletMe={walletMe}
        walletHistory={walletHistory}
        busy={walletBusy}
        onPickManual={() => {
          setMethodOpen(false);
          setPaymentOpen(true);
        }}
        onPickWallet={async (walletSource = "main") => {
          let upgrade = (paymentData || (createdUpgrade ? { upgrade: createdUpgrade } : null))?.upgrade;
          setWalletBusy(true);
          setWalletErr("");
          try {
            if (!upgrade?.id && selectedToRankId) {
              const resp = await initiateUpgrade({ to_rank_id: selectedToRankId });
              upgrade = resp;
              if (upgrade) setCreatedUpgrade(upgrade);
            }
            if (!upgrade?.id) {
              setWalletErr("Could not initialize rank upgrade. Please try again.");
              return;
            }
            await createRankUpgradeFromWallet({
              upgrade_id: upgrade.id,
              wallet_source: walletSource,
            });
            setMethodOpen(false);
            setSuccessTitle("Payment Successful");
            setSuccessMessage("Rank purchased successfully.");
            setSuccessOpen(true);
            const [eg, p, h, freshWallet, freshHistory] = await Promise.allSettled([
              getUpgradeEligibility(),
              getMyLevelBonusProgress(),
              getMyRankCommissionHolds(),
              getWalletMeFresh(),
              getWalletMeHistory().catch(() => null),
            ]);
            if (eg.status === "fulfilled") setElig(eg.value || null);
            if (p.status === "fulfilled") setLbProgress(p.value || null);
            if (h.status === "fulfilled") setLbHolds(Array.isArray(h.value) ? h.value : []);
            if (freshWallet.status === "fulfilled") setWalletMe(freshWallet.value || null);
            if (freshHistory.status === "fulfilled") setWalletHistory(freshHistory.value || null);
          } catch (e) {
            setWalletErr(e?.response?.data?.detail || e?.message || "Wallet payment failed");
          } finally {
            setWalletBusy(false);
          }
        }}
      />

      <RankPaymentSheet
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        data={paymentData || (createdUpgrade ? { upgrade: createdUpgrade } : null)}
        onSuccess={async () => {
          setPaymentOpen(false);
          setSuccessTitle("Payment Request Submitted");
          setSuccessMessage("We will review it shortly.");
          setSuccessOpen(true);
          try {
            const [eg, p, h] = await Promise.allSettled([
              getUpgradeEligibility(),
              getMyLevelBonusProgress(),
              getMyRankCommissionHolds(),
            ]);
            if (eg.status === "fulfilled") setElig(eg.value || null);
            if (p.status === "fulfilled") setLbProgress(p.value || null);
            if (h.status === "fulfilled") setLbHolds(Array.isArray(h.value) ? h.value : []);
          } catch {}
        }}
      />

      <Dialog open={successOpen} onClose={() => setSuccessOpen(false)}>
        <DialogTitle>{successTitle}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            {successMessage}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSuccessOpen(false)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {walletErr && (
        <Snackbar
          open={!!walletErr}
          autoHideDuration={4000}
          onClose={() => setWalletErr("")}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert onClose={() => setWalletErr("")} severity="error" sx={{ width: "100%" }}>
            {walletErr}
          </Alert>
        </Snackbar>
      )}
    </Box>
  );
}
