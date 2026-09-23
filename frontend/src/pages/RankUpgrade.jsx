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

import {
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
  getAddMoneyPocketBalance,
  getPackagePurchaseCouponBalance,
  getSelfPackageWalletBalance,
} from "../utils/walletBalances";

function fmt(val) {
  const num = Number(val || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0";
}

const RANK_TIERS = [
  { level: 1, name: "Level 1", upgradeAmt: 250, limit: 1750, teamCount: 5 },
  { level: 2, name: "Level 2", upgradeAmt: 500, limit: 2000, teamCount: 25 },
  { level: 3, name: "Level 3", upgradeAmt: 1000, limit: 4000, teamCount: 50 },
  { level: 4, name: "Level 4", upgradeAmt: 1250, limit: 6000, teamCount: 100 },
  { level: 5, name: "Level 5", upgradeAmt: 1500, limit: 7500, teamCount: 150 },
  { level: 6, name: "Level 6", upgradeAmt: 1750, limit: 8750, teamCount: 175 },
  { level: 7, name: "Level 7", upgradeAmt: 2000, limit: 10000, teamCount: 200 },
  { level: 8, name: "Level 8", upgradeAmt: 5000, limit: 15000, teamCount: "-" },
  { level: 9, name: "Level 9", upgradeAmt: 10000, limit: 20000, teamCount: "-" },
  { level: 10, name: "Level 10", upgradeAmt: 25000, limit: 100000, teamCount: "-" },
];

function RankPaymentMethodDialog({ open, onClose, data, walletMe, walletHistory, busy, onPickManual, onPickWallet }) {
  if (!open || !data?.upgrade) return null;
  const amount = Number(data.upgrade.upgrade_amount || 0);
  const internalBal = getSelfPackageWalletBalance(walletMe);
  const packageCouponBal = getPackagePurchaseCouponBalance(walletMe);
  const addMoneyBal = getAddMoneyPocketBalance(walletMe, walletHistory);
  const canWallet = internalBal >= amount && amount > 0;
  const canPackageCoupon = packageCouponBal >= amount && amount > 0;
  const canAddMoney = addMoneyBal >= amount && amount > 0;
  const money = (value) => Number(value || 0).toFixed(2);
  const WalletButtonLabel = ({ title, balance }) => (
    <Stack component="span" spacing={0.25} alignItems="center" sx={{ lineHeight: 1.15 }}>
      <span>{title}</span>
      <Typography component="span" sx={{ fontSize: 11, fontWeight: 800, color: "inherit", opacity: 0.86 }}>
        Available Rs. {money(balance)}
      </Typography>
    </Stack>
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
      <DialogTitle sx={{ fontWeight: 900, color: "#0f172a", pb: 1 }}>Select Payment Method</DialogTitle>
      <DialogContent dividers sx={{ pt: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
          Amount: <b>₹{money(amount)}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.8 }}>
          Self Package Wallet Balance: <b>₹{money(internalBal)}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.8 }}>
          Package Purchase Coupon Received (Buy Package) Balance: <b>₹{money(packageCouponBal)}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.8 }}>
          Add Money Pocket Balance: <b>₹{money(addMoneyBal)}</b>
        </Typography>
        {!canWallet && !canPackageCoupon && !canAddMoney ? (
          <Alert severity="info" sx={{ mt: 1.5, borderRadius: 3 }}>
            Wallet payment is available only when one package wallet balance is enough.
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ p: 1.5, gap: 1, flexWrap: "wrap" }}>
        <Button onClick={onClose} disabled={busy} sx={{ borderRadius: 3 }}>Cancel</Button>
        <Button variant="outlined" onClick={onPickManual} disabled sx={{ borderRadius: 3, fontWeight: 900 }}>
          Manual Payment
        </Button>
        <Button variant="contained" disabled={!canWallet || busy} onClick={() => onPickWallet("internal")} sx={{ borderRadius: 3, fontWeight: 900, minHeight: 48 }}>
          <WalletButtonLabel title="Pay from Self Package" balance={internalBal} />
        </Button>
        <Button variant="contained" disabled={!canPackageCoupon || busy} onClick={() => onPickWallet("package_coupon")} sx={{ borderRadius: 3, fontWeight: 900, minHeight: 48 }}>
          <WalletButtonLabel title="Pay from Package Purchase Coupon Received" balance={packageCouponBal} />
        </Button>
        <Button variant="contained" disabled={!canAddMoney || busy} onClick={() => onPickWallet("package_upload")} sx={{ borderRadius: 3, fontWeight: 900, minHeight: 48 }}>
          <WalletButtonLabel title="Pay from Add Money Pocket" balance={addMoneyBal} />
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

export default function RankUpgrade({ defaultToRankId = null } = {}) {
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
    const fromApi = Number(
      walletHistory?.layer_matrix_earned ||
        walletHistory?.income?.matrixLevel ||
        walletHistory?.income?.matrixFive ||
        walletHistory?.top?.level_earnings_total ||
        0
    );
    if (fromApi > 0) return fromApi;

    // Fallback: scan walletHistory main_wallet and incoming for level and matrix bonuses
    const allTx = [
      ...(walletHistory?.main_wallet || []),
      ...(walletHistory?.incoming || []),
    ];
    let sum = 0;
    const seen = new Set();
    for (const t of allTx) {
      if (!t?.id || seen.has(t.id)) continue;
      seen.add(t.id);
      const isLevel =
        t.type === "LEVEL_BONUS" ||
        t.type === "AUTOPOOL_BONUS_FIVE" ||
        t.type === "AUTOPOOL_BONUS_THREE" ||
        t.meta?.orig_type === "AUTOPOOL_BONUS_FIVE" ||
        t.meta?.orig_type === "AUTOPOOL_BONUS_THREE" ||
        t.meta?.orig_type === "LEVEL_BONUS" ||
        (t.meta?.source && String(t.meta.source).toLowerCase().includes("matrix"));
      if (isLevel) {
        sum += Math.abs(Number(t.amount || 0));
      }
    }
    return sum;
  }, [walletHistory]);

  const totalEarnings = useMemo(() => {
    const val = Number(
      walletHistory?.top?.level_earnings_total ||
        walletHistory?.totals?.levelEarnings ||
        walletHistory?.totals?.level_earnings ||
        walletHistory?.level_earnings ||
        0
    );
    if (val > 0) return val;
    return layerMatrixEarned;
  }, [walletHistory, layerMatrixEarned]);

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

  const savedRoyaltyConfig = useMemo(() => {
    try {
      const raw = localStorage.getItem("tri_royalty_config");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

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
      levelRange: isL8Plus ? "L8 to L10" : "L1 to L7",
    };
  }, [currentLevel, elig, walletHistory, savedRankConfig, hasApprovedBase]);

  const handleUpgradeClick = (rankTarget) => {
    const targetId = rankTarget?.id || (ranks.find((r) => Number(r.level_number || 0) === nextLevel)?.id);
    const targetName = rankTarget?.rank_name || `Level ${nextLevel}`;
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
          Rank Upgrade
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
          My Wallet / Rank Upgrade
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
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Current Level</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b" }}>
                  Level {currentLevel} <Chip label="Eligible" size="small" color="primary" sx={{ height: 18, fontSize: 10, fontWeight: 800 }} />
                </Typography>
              </Box>
            </Stack>
          </Grid>

          <Grid item xs={4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "#fff7ed", color: "#d97706", display: "grid", placeItems: "center" }}>
                <AccessTimeRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Upgrade Window ({upgradeWindowInfo.levelRange})</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: upgradeWindowInfo.started ? "#d97706" : "#2563eb" }}>
                  {upgradeWindowInfo.started ? (
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
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Next Level</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#15803d" }}>
                  Level {nextLevel} <Typography component="span" sx={{ fontSize: 10, color: "#166534" }}>(Upgrade to Continue)</Typography>
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
                {isLimitReached ? `Earning Limit Reached for Level ${currentLevel} ⓘ` : `Earning Limit Progress (${percentUsed.toFixed(0)}%) ⓘ`}
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
                    ? `Limit reached for Level ${currentLevel}. Upgrade to next level to continue income.`
                    : `Level ${currentLevel} earning limit is ₹${fmt(currentLimit)}.`}
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  sx={{ bgcolor: "#ffffff", color: "#1e1b4b", fontWeight: 900, "&:hover": { bgcolor: "#f3f4f6" } }}
                  onClick={() => handleUpgradeClick()}
                >
                  Upgrade Now
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Earning Limit Level Cards ── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "#fff" }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>EARNING LIMIT (LEVEL {currentLevel})</Typography>
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
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>EARNING LIMIT (LEVEL 10)</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0f172a", my: 0.5 }}>₹1,50,000</Typography>
            {currentLevel >= 10 && isLimitReached ? (
              <Chip icon={<CheckCircleRoundedIcon />} label="Completed" color="success" size="small" sx={{ fontWeight: 800 }} />
            ) : (
              <Chip icon={<CancelRoundedIcon />} label="Not Completed" color="error" size="small" sx={{ fontWeight: 800 }} />
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

      {/* ── Royalty Income, Layer Matrix & Missing Income Grid ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, borderColor: "#bbf7d0", bgcolor: "#fff" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <ShoppingBagRoundedIcon color="success" sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 900, fontSize: 12, color: "#15803d" }}>ROYALTY INCOME (SHOPPING) ⓘ</Typography>
              </Stack>
              <Chip label={`₹${fmt(royaltyShopping)}`} color="success" size="small" sx={{ fontWeight: 900, fontSize: 11 }} />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography sx={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                    {savedRoyaltyConfig?.tier1_levels || "LEVEL 1 TO LEVEL 7"}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#15803d" }}>
                    {savedRoyaltyConfig?.tier1_percent ?? 3}% ₹{fmt(savedRoyaltyConfig?.tier1_cap ?? 10000)}
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
                    {savedRoyaltyConfig?.tier2_levels || "LEVEL 10 TO LEVEL 10"}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#15803d" }}>
                    {savedRoyaltyConfig?.tier2_percent ?? 7}% ₹{fmt(savedRoyaltyConfig?.tier2_cap ?? 40000)}
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
              TOTAL ELIGIBLE ROYALTY INCOME (SHOPPING) ₹{fmt(royaltyShopping)}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, borderColor: "#bfdbfe", bgcolor: "#fff" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <LayersRoundedIcon color="primary" sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 900, fontSize: 12, color: "#0369a1" }}>LAYER MATRIX EARNINGS ⓘ</Typography>
              </Stack>
              <Chip label={`Eligible ₹${fmt(layerMatrixEligible)}`} color="primary" size="small" sx={{ fontWeight: 900, fontSize: 11 }} />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Typography sx={{ fontSize: 10, color: "#64748b", fontWeight: 700, mb: 0.5 }}>FROM LAYER MATRIX (All Slabs)</Typography>
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
                <Typography sx={{ fontWeight: 900, fontSize: 12, color: "#c2410c" }}>MISSING INCOME ⓘ</Typography>
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

      {/* ── Rank Upgrade Level Table (Dark Blue Header) ── */}
      <Paper variant="outlined" sx={{ p: 0, mb: 2, borderRadius: 3, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1e1b4b" }}>
              <TableRow sx={{ bgcolor: "#1e1b4b" }}>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5 }}>Level</TableCell>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5 }}>Upgrade Amount (₹)</TableCell>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5 }}>Earning Limit (₹)</TableCell>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5 }}>Team Count ⓘ</TableCell>
                <TableCell sx={{ color: "#ffffff", bgcolor: "#1e1b4b", fontWeight: 800, py: 1.5, textAlign: "right" }}>Next Rank Upgrade</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const DEFAULT_LIMITS = [1750, 2000, 4000, 6000, 7500, 8750, 10000, 15000, 20000, 100000];
                const DEFAULT_TEAM_COUNTS = ["5", "25", "125", "625", "3125", "15625", "78125", "-", "-", "-"];
                return (ranks || []).map((r, idx) => {
                  const level = Number(r.level_number || idx + 1);
                  const achieved = effectiveAchievedLevel >= level;
                  const isCurrentActive = level === effectiveAchievedLevel;
                  const canBuy = level === effectiveAchievedLevel + 1;

                  const cfgLvl = savedRankConfig?.levels?.[idx];
                  const limitVal = cfgLvl?.earning_limit ? Number(cfgLvl.earning_limit) : (DEFAULT_LIMITS[idx] || (r.earning_limit ? Number(r.earning_limit) : 0));
                  const userTeamCount = Number(
                    r.current_team_count ??
                    r.team_size_achieved ??
                    r.current_team_size ??
                    elig?.level_team_counts?.[level] ??
                    elig?.team_counts_by_level?.[level] ??
                    elig?.team_by_level?.[level] ??
                    0
                  );

                  const teamVal = cfgLvl?.team_count != null ? String(cfgLvl.team_count) : (DEFAULT_TEAM_COUNTS[idx] || (r.team_size_required ? String(r.team_size_required) : "-"));
                  const amtVal = cfgLvl?.upgrade_amount ? Number(cfgLvl.upgrade_amount) : Number(r.upgrade_amount || 0);
                  const rankTitle = cfgLvl?.name || `Level ${level}`;

                  let teamDisplay = "-";
                  if (teamVal !== "-") {
                    teamDisplay = userTeamCount > 0 ? `👥 ${userTeamCount} / ${teamVal}` : `👥 ${teamVal}`;
                  } else {
                    teamDisplay = userTeamCount > 0 ? `👥 ${userTeamCount}` : "-";
                  }

                  return (
                    <TableRow
                      key={r.id || idx}
                      sx={{
                        bgcolor: isCurrentActive ? "#f3e8ff" : achieved ? "#f8fafc" : "inherit",
                        "&:hover": { bgcolor: "#f1f5f9" },
                      }}
                    >
                      <TableCell sx={{ fontWeight: isCurrentActive ? 900 : 700, color: isCurrentActive ? "#6b21a8" : "inherit" }}>
                        {rankTitle}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{amtVal.toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{limitVal.toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ color: teamDisplay !== "-" ? "#4c1d95" : "text.secondary", fontWeight: teamDisplay !== "-" ? 700 : 400 }}>
                        {teamDisplay}
                      </TableCell>
                      <TableCell align="right">
                        {isCurrentActive && isLimitReached ? (
                          <Typography sx={{ color: "#ef4444", fontWeight: 900, fontSize: 13 }}>Limit Reached</Typography>
                        ) : achieved ? (
                          <Chip size="small" label="Purchased" color="success" variant="outlined" sx={{ fontWeight: 700 }} />
                        ) : canBuy ? (
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            sx={{ fontWeight: 800, borderRadius: 1.5 }}
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
                            sx={{ fontWeight: 700, borderRadius: 1.5 }}
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
            ⓘ Total Cycle Limit: ₹1,50,000 for Level 10
          </Typography>
        </Box>
      </Paper>

      {/* ── HOW TEAM COUNT WORKS Banner ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: "#fff" }}>
        <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#4338ca", mb: 1.5, textAlign: "center", letterSpacing: 0.5 }}>
          HOW TEAM COUNT WORKS?
        </Typography>
        <Grid container spacing={2} alignItems="center" justifyContent="center">
          <Grid item xs={12} sm={5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "#e0e7ff", color: "#4338ca", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <GroupRoundedIcon />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Team Count</Typography>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Total direct members in your team at each level.</Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={1} sx={{ textAlign: "center", display: { xs: "none", sm: "block" } }}>
            <ArrowForwardRoundedIcon sx={{ color: "#94a3b8" }} />
          </Grid>
          <Grid item xs={12} sm={5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "#f3e8ff", color: "#7e22ce", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <TouchAppRoundedIcon />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Tap on Team Count</Typography>
                <Typography sx={{ fontSize: 11, color: "#64748b" }}>Tap on any team count number to view member list.</Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Bottom Call-to-Action Cards ── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "#16a34a", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <TrendingUpRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#166534", mb: 0.5 }}>NEXT RANK UPGRADE</Typography>
                <Typography sx={{ fontSize: 11, color: "#15803d", mb: 1 }}>
                  Upgrade to Level {nextLevel} to start new earning cycle and continue income. Re-Top Up or Upgrade to continue.
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 1.5 }}
                  onClick={() => handleUpgradeClick()}
                >
                  Upgrade Now
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: "#fff7ed", borderColor: "#fed7aa" }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "#ea580c", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <NotificationsActiveRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#c2410c", mb: 0.5 }}>NOTIFICATIONS</Typography>
                <Typography sx={{ fontSize: 11, color: "#ea580c", mb: 1 }}>
                  You will be notified for next rank upgrade and missing income.
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  sx={{ textTransform: "none", fontWeight: 800, borderRadius: 1.5, bgcolor: "#ea580c", "&:hover": { bgcolor: "#c2410c" } }}
                >
                  View Notifications
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Footer Hint ── */}
      <Box sx={{ textAlign: "center", py: 1, px: 2, bgcolor: "#f8fafc", borderRadius: 2, border: "1px dashed #cbd5e1", mb: 2 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
          ⓘ Upgrade within {upgradeWindowInfo.totalDays} days ({upgradeWindowInfo.levelRange}) to remain eligible for income.
        </Typography>
      </Box>

      {/* ── Level Bonus Progress (Collapsible/Detailed) ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 1 }}>
          Level Bonus Progress
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
            Level Bonus progress will appear here after you receive level commissions.
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
        onPickWallet={async (walletSource = "package_upload") => {
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
