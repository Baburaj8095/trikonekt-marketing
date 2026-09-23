import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Alert,
  TextField,
  MenuItem,
  Drawer,
  IconButton,
  InputAdornment,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  Chip,
  Divider,
  Grid,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import dayjs from "dayjs";
import normalizeMediaUrl from "../utils/media";
import imgKerala from "../assets/kerala.jpg";
import imgThailand from "../assets/thailand.jpg";
import {
  getPromoPackages,
  listMyPromoPurchases,
  getTriApp,
  createPromoPurchase,
  listCouponSeasons,
  getEcouponStoreBootstrap,
  createPromoPurchaseFromWallet,
  getWalletMe,
  getWalletMeFresh,
  getWalletMeHistory,
  initiateUpgrade,
  createRankUpgradeFromWallet,
} from "../api/api";
import RankUpgrade from "./RankUpgrade";
import {
  getAddMoneyPocketBalance,
  getPackagePurchaseCouponBalance,
  getSelfPackageWalletBalance,
} from "../utils/walletBalances";

/**
 * UI REFACTOR ONLY
 * - Preserve all backend APIs and payloads
 * - Reorganize UI into four sections (Tabs): Prime | Promo | Season | Tour
 * - Single shared payment sheet
 */

/* ---------------- HELPERS ---------------- */
const approx = (a, b, eps = 0.75) => Math.abs(Number(a) - Number(b)) < eps;

const isTourPackage = (pkg) => {
  const code = String(pkg?.code || "").toLowerCase();
  const name = String(pkg?.name || "").toLowerCase();
  return code.includes("tour") || name.includes("tour") || name.includes("holiday");
};

const isPrime150Package = (pkg) => {
  const code = String(pkg?.code || "").toUpperCase();
  const name = String(pkg?.name || "").toUpperCase();
  const type = String(pkg?.type || "").toUpperCase();
  if (type === "MONTHLY" || isTourPackage(pkg)) return false;
  return code === "PRIME150" || code.includes("PRIME150") || name.includes("150") || approx(pkg?.price, 150);
};

const isJoinPrimePackage = (pkg) => {
  if (isPrime150Package(pkg)) return false;
  const code = String(pkg?.code || "").toUpperCase();
  const name = String(pkg?.name || "").toUpperCase();
  const type = String(pkg?.type || "").toUpperCase();
  if (type === "MONTHLY" || isTourPackage(pkg)) return false;
  return (
    code.includes("PRIME750") ||
    code.includes("PRIME1000") ||
    name.includes("PRIME") ||
    type === "PRIME" ||
    approx(pkg?.price, 750) ||
    approx(pkg?.price, 1000)
  );
};

const getPlanOptions = (price) => {
  // Prime 150: remove e‑book flow (UI hint only shows redeem points)
  if (approx(price, 150)) return ["Redeem points"];
  // Prime 750: only two options  Redeem or Product (no separate E‑Coupons option)
  if (approx(price, 750)) return ["Redeem", "Exclusive products"];
  if (approx(price, 1000))
    return ["Electronics", "Home Appliances", "Furniture", "Travel & Tourism"];
  return [];
};

const monthShort = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];

const nativeSheetPaperSx = {
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  height: "88vh",
  maxHeight: "calc(100dvh - 24px)",
  p: { xs: 2, sm: 2.5 },
  pb: { xs: 3, sm: 3.5 },
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 -22px 60px rgba(15, 23, 42, 0.22)",
  border: "1px solid rgba(226, 232, 240, 0.9)",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

const primaryPaymentButtonSx = {
  height: 52,
  borderRadius: "14px",
  fontWeight: 900,
  fontSize: 15,
  letterSpacing: 0,
  boxShadow: "0 10px 24px rgba(37, 99, 235, 0.28)",
  background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)",
  transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
  "&:hover": {
    boxShadow: "0 14px 30px rgba(37, 99, 235, 0.35)",
    filter: "brightness(1.04)",
  },
  "&:active": {
    transform: "scale(0.985)",
  },
  "&.Mui-disabled": {
    background: "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)",
    color: "rgba(255,255,255,0.78)",
    boxShadow: "none",
  },
};

const softFieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2.5,
    boxShadow: "0 1px 0 rgba(15, 23, 42, 0.03)",
    "& fieldset": { borderColor: "#e2e8f0" },
    "&:hover fieldset": { borderColor: "#bfdbfe" },
    "&.Mui-focused fieldset": { borderColor: "#2563eb", borderWidth: 1.5 },
  },
};

/* ======================================================================== */
/* Payment Sheet (shared)  unchanged logic; UI summary added */
/* ======================================================================== */
function PaymentSheet({ open, onClose, data, onSuccess }) {
  const [txnId, setTxnId] = useState("");
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [payment, setPayment] = useState(null); // admin seeded payment config
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

  if (!data) return null;

  const summaryLines = (() => {
    try {
      const ui = data.uiMeta || {};
      const lines = [];
      if (ui.bonus150) lines.push("+ Bonus Wallet ₹150");
      if (ui.primeChoice) lines.push(`Prime Choice: ${ui.primeChoice}`);
      if (ui.selectedProductName) lines.push(`Product: ${ui.selectedProductName}`);
      if (ui.plan) lines.push(`Plan: ${ui.plan}`);
      if (ui.selectedSeason != null) lines.push(`Season: ${ui.selectedSeason}`);
      if (Array.isArray(ui.selectedBoxes) && ui.selectedBoxes.length) {
        lines.push(`Months: ${ui.selectedBoxes.sort((a,b)=>a-b).join(", ")}`);
      }
      if (ui.destination) lines.push(`Destination: ${ui.destination}`);
      return lines;
    } catch {
      return [];
    }
  })();

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        ModalProps={{
          BackdropProps: {
            sx: { backgroundColor: "rgba(15, 23, 42, 0.48)", backdropFilter: "blur(10px)" },
          },
        }}
        PaperProps={{
          sx: nativeSheetPaperSx,
        }}
      >
        {/* Handle bar */}
        <Box sx={{ width: 44, height: 5, bgcolor: "#cbd5e1", mx: "auto", mb: 1.5, borderRadius: 99 }} />

        <Typography fontWeight={900} fontSize={19} lineHeight={1.2} textAlign="center" color="#0f172a">
          Complete Payment
        </Typography>

        {/* Summary */}
        <Box
          sx={{
            p: 2,
            mt: 2,
            bgcolor: "rgba(255,255,255,0.92)",
            borderRadius: 3,
            border: "1px solid rgba(226,232,240,0.92)",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.07)",
          }}
        >
          <Typography fontWeight={700}>{data.pkg?.name || "Package"}</Typography>
          {summaryLines.length > 0 ? (
            <Box sx={{ mt: 0.5 }}>
              {summaryLines.map((s, i) => (
                <Typography key={i} fontSize={12} color="text.secondary">
                  • {s}
                </Typography>
              ))}
            </Box>
          ) : null}
          <Stack direction="row" justifyContent="space-between" mt={1}>
            <Typography color="text.secondary">Total Amount</Typography>
            <Typography fontWeight={900} fontSize={22} color="#0f172a">
              ₹{Number(data.amount || 0)}
            </Typography>
          </Stack>
        </Box>
        <Divider sx={{ my: 1.5, borderColor: "rgba(226,232,240,0.9)" }} />

        {/* UPI Section */}
        <Box sx={{ p: 2, mt: 1.5, borderRadius: 3, bgcolor: "rgba(248,250,252,0.9)", border: "1px solid #e2e8f0" }}>
          <Typography fontWeight={700} mb={1}>
            UPI Payment
          </Typography>

          {payment?.upi_qr_image_url ? (
            <Box
              component="img"
              src={normalizeMediaUrl(payment.upi_qr_image_url)}
              alt="UPI QR"
              sx={{
                width: 180,
                mx: "auto",
                display: "block",
                mb: 2,
                cursor: "pointer",
                borderRadius: 3,
                p: 1,
                bgcolor: "#fff",
                boxShadow: "0 12px 26px rgba(15,23,42,0.10)",
              }}
              onClick={() => setZoomOpen(true)}
            />
          ) : null}

          <TextField
            label="UPI ID"
            value={payment?.upi_id || ""}
            fullWidth
            sx={softFieldSx}
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
          sx={{ mt: 2, ...softFieldSx }}
          value={txnId}
          onChange={(e) => setTxnId(e.target.value)}
        />

        <Button component="label" variant="outlined" sx={{ mt: 2, borderRadius: 3, minHeight: 48 }}>
          Upload Payment Screenshot
          <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0])} />
        </Button>

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 3, ...primaryPaymentButtonSx }}
          disabled={!file || submitting}
          onClick={async () => {
            setSubmitting(true);
            setErrorMsg("");
            try {
              await createPromoPurchase({
                package_id: data.pkg.id,
                remarks: txnId,
                file,
                ...(data.purchasePayload || {}),
              });
              onClose();
              onSuccess();
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

        <Button fullWidth variant="text" sx={{ mt: 1, borderRadius: 3 }} onClick={onClose}>
          Cancel
        </Button>
      </Drawer>

      <Dialog
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, boxShadow: "0 24px 80px rgba(15,23,42,0.24)" } }}
      >
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

/* ======================================================================== */
/* Payment Method Chooser (Wallet vs Manual) */
/* ======================================================================== */
function PaymentMethodDialog({ open, onClose, intent, walletMe, walletHistory, busy, onPickManual, onPickWallet }) {
  if (!open) return null;
  const amount = Number(intent?.amount || intent?.pkg?.price || 0);
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
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
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
      <DialogContent dividers sx={{ borderColor: "rgba(226,232,240,0.9)", pt: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          Amount: <b>₹{amount}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
          Self Package Wallet Balance: <b>₹{internalBal.toFixed(2)}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
          Package Purchase Coupon Received (Buy Package) Balance: <b>₹{packageCouponBal.toFixed(2)}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
          Add Money Pocket Balance: <b>₹{addMoneyBal.toFixed(2)}</b>
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

/* ======================================================================== */
/* Sections */
/* ======================================================================== */

/**
 * AgentSubscriptionSection  Professional 4-Card Package Layout
 * 1st & 2nd: Digital Education (Level 1 & Level 2)
 * 3rd: SPP (Smart Purchase Plan 1000)
 * 4th: Holidays (Holiday & Travel Voucher)
 */
function AgentSubscriptionSection({
  pkg,
  seasonPkg,
  tourPackages,
  triHolidays,
  prime150Active,
  prime750Active,
  seasonActive,
  achievedPrimeLevel = 0,
  onBuy,
  navigate,
}) {
  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Chip
          label="AGENT SUBSCRIPTION"
          size="small"
          sx={{
            fontWeight: 800,
            fontSize: 11,
            bgcolor: "#e0e7ff",
            color: "#3730a3",
            letterSpacing: 0.8,
            mb: 1,
          }}
        />
        <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a", mb: 0.5 }}>
          Agent Joining Fee
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mx: "auto" }}>
          Includes ₹750 Agent Subscription + ₹250 Level 1 Rank Upgrade fee. Unlocks Digital Education Masterclasses, 5-Block & 3-Block team activations, and team commissions.
        </Typography>
      </Box>

      <Grid container justifyContent="center">
        {/* AGENT PACKAGE: Agent Joining Fee (₹1,000) */}
        <Grid item xs={12} md={8} lg={6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: "20px",
              border: "1.5px solid #cbd5e1",
              bgcolor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: "0 16px 36px rgba(37,99,235,0.14)",
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: "linear-gradient(90deg, #1e1b4b 0%, #4338ca 100%)",
              }}
            />
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Chip
                  label="STARTER PACKAGE"
                  size="small"
                  sx={{ fontWeight: 800, fontSize: 10, bgcolor: "#e0e7ff", color: "#3730a3" }}
                />
                {prime750Active ? <Chip label="Active" size="small" color="success" sx={{ fontWeight: 800 }} /> : null}
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a", mb: 0.5 }}>
                Agent Joining Fee
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 32, fontWeight: 950, color: "#1e1b4b" }}>
                  ₹ 1,000
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  (₹750 Subscription + ₹250 Level 1 Rank Upgrade)
                </Typography>
              </Stack>

              <Stack spacing={1.5} sx={{ mb: 3 }}>
                {[
                  "Includes ₹750 Agent Subscription + ₹250 Level 1 Rank Upgrade",
                  "Full Access to Level 1 Digital Education Video Masterclasses",
                  "Activates 5-Block & 3-Block Team Account Positions",
                  "Unlocks Direct Referral & Team Commission Eligibility",
                  "Includes ₹150 Bonus Wallet Credit",
                ].map((item, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <CheckCircleRoundedIcon sx={{ fontSize: 18, color: "#4338ca" }} />
                    <Typography fontSize={13} color="#334155" fontWeight={600}>
                      {item}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Button
              fullWidth
              variant="contained"
              disabled={!!prime750Active}
              onClick={() => {
                onBuy({
                  pkg: pkg || { id: 2, code: "PRIME750", name: "Agent Joining Fee", price: 750 },
                  amount: 1000,
                  uiMeta: { bonus150: true, packageName: "Agent Joining Fee (Digital Education Level 1)" },
                  purchasePayload: { prime750_choice: "REDEEM" },
                });
              }}
              sx={{
                height: 48,
                borderRadius: "14px",
                fontWeight: 900,
                fontSize: 14,
                textTransform: "none",
                background: prime750Active
                  ? "#94a3b8 !important"
                  : "linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)",
                boxShadow: prime750Active ? "none" : "0 8px 20px rgba(67,56,202,0.3)",
              }}
            >
              {prime750Active ? "PACKAGE ACTIVE" : "SUBSCRIBE LEVEL 1 • ₹1,000"}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function Prime150Section({ reg150Pkg, prime150Active, onBuy }) {
  const packageAmount = Number(reg150Pkg?.price || 0);
  const packageName = reg150Pkg?.name || "Prime 150";
  if (!reg150Pkg) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">Prime 150 package not available.</Alert>
      </Box>
    );
  }
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        {packageName}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        {prime150Active ? <Chip size="small" color="success" label="Active" /> : null}
        <Typography variant="body2" color="text.secondary">
          {prime150Active ? "You have already activated Prime 150." : "Activate Prime 150 to unlock starter benefits."}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography>
          Price: <b>₹{packageAmount.toLocaleString("en-IN")}</b>
        </Typography>
        <Button
          variant="contained"
          disabled={!!prime150Active}
          onClick={() =>
            onBuy({
              pkg: reg150Pkg,
              amount: packageAmount,
              uiMeta: { plan: packageName },
              purchasePayload: {},
            })
          }
        >
          {prime150Active ? "Already Active" : "BUY NOW"}
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * SeasonSection  Season-first flow
 * - Season selector (Season 1 active; others locked unless admin exposes)
 * - Plan selector uses the admin-configured MONTHLY/SPP package price
 * - Month grid lets the user select payable monthly SPP slots
 */
function SeasonSection({ seasonPkg, reg150Pkg, prime150Active, history, onBuy, seasonsHints = [], seasonActive, rename = null }) {
  const meta = seasonPkg?.monthly_meta || {};
  const defaultSeason = Number(meta?.current_package_number || 1);
  const seasonDetails = useMemo(() => {
    try {
      const rows = Array.isArray(meta?.available_seasons) ? meta.available_seasons : [];
      const map = new Map();
      rows.forEach((row) => {
        const number = parseInt(row?.number, 10);
        if (number > 0) {
          map.set(number, {
            number,
            totalBoxes: Math.max(1, Number(row?.total_boxes || 12)),
            active: row?.is_active !== false,
          });
        }
      });
      return map;
    } catch {
      return new Map();
    }
  }, [meta?.available_seasons]);

  // Choose which seasons to show. Show 1..5 in UI, enable those listed by admin seeds if present; otherwise only 1.
  const hintNumbers = useMemo(() => {
    try {
      if (!Array.isArray(seasonsHints) || seasonsHints.length === 0) return [];
      const nums = new Set();
      seasonsHints.forEach((s) => {
        const fields = [s?.campaign, s?.title, s?.code];
        fields.forEach((f) => {
          const m = String(f || "").match(/(\d+)/);
          if (m && m[1]) {
            const v = parseInt(m[1], 10);
            if (v > 0) nums.add(v);
          }
        });
      });
      return Array.from(nums).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }, [seasonsHints]);

  const enabledNumbers = useMemo(() => {
    if (Array.isArray(meta?.available_numbers) && meta.available_numbers.length) {
      return meta.available_numbers.map((n) => parseInt(n, 10)).filter((n) => n > 0);
    }
    if (hintNumbers.length) return hintNumbers;
    return [1];
  }, [meta?.available_numbers, hintNumbers]);

  const seasonsToShow = enabledNumbers;
  const [selectedSeason, setSelectedSeason] = useState(defaultSeason);
  const totalBoxes = Math.max(
    1,
    Number(seasonDetails.get(Number(selectedSeason))?.totalBoxes || meta?.total_boxes || 12)
  );
  const unitPrice = Math.max(0, Number(seasonPkg?.price || 0));
  const unitPriceLabel = `Rs. ${unitPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  useEffect(() => {
    // Ensure selected season is in the list. Default to first enabled (fallback to 1) if disabled.
    if (!enabledNumbers.includes(selectedSeason)) {
      setSelectedSeason(enabledNumbers[0] || 1);
    }
  }, [enabledNumbers, selectedSeason]);

  const [plan, setPlan] = useState("MONTHLY_SPP");

  // Locked boxes from history for current season
  const purchasedBoxes = useMemo(() => {
    try {
      // Prefer backend-computed monthly_meta for the current package number
      const currentNum = Number(meta?.current_package_number || 0);
      if (
        Number(selectedSeason) === currentNum &&
        Array.isArray(meta?.purchased_boxes) &&
        meta.purchased_boxes.length > 0
      ) {
        const fromMeta = meta.purchased_boxes
          .map((b) => parseInt(b, 10))
          .filter((bn) => Number.isFinite(bn) && bn > 0);
        return Array.from(new Set(fromMeta)).sort((a, b) => a - b);
      }

      // Fallback to purchase history
      const boxes = [];
      (history || []).forEach((p) => {
        const pid = p?.package?.id || p?.package_id;
        const ptype = String(p?.package?.type || "").toUpperCase();
        const pkgMatch = (pid === seasonPkg?.id) || (ptype === "MONTHLY");
        const stat = String(p?.status || "").toUpperCase();
        if (pkgMatch && stat !== "REJECTED" && stat !== "CANCELLED") {
          const pn = Number(p?.package_number || 0);
          if (pn === Number(selectedSeason)) {
            const bxRaw = Array.isArray(p?.boxes_json)
              ? p.boxes_json
              : Array.isArray(p?.boxes)
              ? p.boxes
              : [];
            bxRaw.forEach((b) => {
              const bn = parseInt(b, 10);
              if (bn > 0) boxes.push(bn);
            });
          }
        }
      });
      return Array.from(new Set(boxes)).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }, [history, seasonPkg?.id, selectedSeason, meta?.purchased_boxes, meta?.current_package_number]);

  const [selectedBoxes, setSelectedBoxes] = useState([]);
  useEffect(() => {
    setSelectedBoxes([]);
  }, [selectedSeason, plan]);

  const toggleBox = (n) => {
    if (purchasedBoxes.includes(n)) return;
    setSelectedBoxes((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const canBuy = !!seasonPkg && selectedBoxes.length > 0;

  const amount = unitPrice * Math.max(0, selectedBoxes.length);

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
      {/* Sapphire Hero Banner */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          borderRadius: 4,
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #2563eb 100%)",
          color: "#ffffff",
          boxShadow: "0 10px 28px rgba(15, 23, 42, 0.18)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: "#ffffff", mb: 0.5, fontSize: { xs: 18, sm: 22 } }}>
              {(rename?.seasonLabel || "Smart Product Purchase (SPP)")}
              {seasonActive ? <Chip size="small" color="success" sx={{ ml: 1, fontWeight: 800 }} label="Active" /> : null}
            </Typography>
            <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
              Choose a season and plan to get started.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* ① Season selector */}
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: "text.primary", fontSize: 14 }}>
        Choose {(rename?.seasonLabel || "SPP Season")}
      </Typography>
      <Box sx={{ display: "grid", gap: 1.5, mb: 3 }}>
        {seasonsToShow.map((n) => {
          const enabled = enabledNumbers.includes(n);
          const active = n === defaultSeason;
          const isSelected = selectedSeason === n;
          const locked = !enabled;
          return (
            <Paper
              key={n}
              elevation={0}
              onClick={() => enabled && setSelectedSeason(n)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.75,
                borderRadius: 3,
                border: "1.5px solid",
                borderColor: isSelected ? "#2563eb" : "#e2e8f0",
                bgcolor: isSelected ? "#eff6ff" : "#ffffff",
                boxShadow: isSelected ? "0 6px 20px rgba(37,99,235,0.14)" : "0 2px 8px rgba(15,23,42,0.03)",
                cursor: enabled ? "pointer" : "not-allowed",
                opacity: enabled ? 1 : 0.6,
                transition: "all 160ms ease",
              }}
            >
              <Radio size="small" checked={isSelected} disabled={!enabled} sx={{ color: isSelected ? "#2563eb" : undefined }} />
              <Typography sx={{ flex: 1, fontWeight: isSelected ? 800 : 600, fontSize: 14 }}>
                {(rename?.seasonLabel || "SPP")} {n}
              </Typography>
              {active ? (
                <Chip size="small" label="Active Season" color="success" sx={{ fontWeight: 800, height: 24 }} />
              ) : locked ? (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <LockRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    locked
                  </Typography>
                </Stack>
              ) : null}
            </Paper>
          );
        })}
      </Box>

      {/* ② Plan selector */}
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: "text.primary", fontSize: 14 }}>
        Choose Plan
      </Typography>
      <Paper
        elevation={0}
        sx={{
          p: 1.75,
          mb: 3,
          borderRadius: 3,
          border: "1.5px solid #2563eb",
          bgcolor: "#eff6ff",
          boxShadow: "0 6px 20px rgba(37,99,235,0.12)",
        }}
      >
        <RadioGroup value={plan} onChange={(e) => setPlan(e.target.value)}>
          <FormControlLabel
            value="MONTHLY_SPP"
            control={<Radio size="small" sx={{ color: "#2563eb" }} />}
            label={
              <Box sx={{ ml: 0.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                  {(rename?.seasonPlanLabel || `SPP Prime ₹${unitPrice.toLocaleString("en-IN")}`)}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                  1 Box = 1 Monthly Product Coupon
                </Typography>
              </Box>
            }
          />
        </RadioGroup>
      </Paper>

      {/* ③ Month grid */}
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: "text.primary", fontSize: 14 }}>
        Select Months
      </Typography>
      {plan === "MONTHLY_SPP" ? (
        <>
          <Box
            sx={{
              mt: 1,
              display: "grid",
              gridTemplateColumns: { xs: "repeat(4, 1fr)", sm: "repeat(6, 1fr)" },
              gap: 1.5,
              mb: 2,
            }}
          >
            {Array.from({ length: totalBoxes }).map((_, i) => {
              const n = i + 1;
              const locked = purchasedBoxes.includes(n);
              const selected = selectedBoxes.includes(n);
              return (
                <Box
                  key={n}
                  onClick={() => !locked && toggleBox(n)}
                  sx={{
                    aspectRatio: "1 / 1",
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid",
                    borderColor: locked ? "#86efac" : selected ? "#2563eb" : "#e2e8f0",
                    background: locked
                      ? "#dcfce7"
                      : selected
                      ? "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)"
                      : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                    color: locked ? "#16a34a" : selected ? "#ffffff" : "#0f172a",
                    fontWeight: 900,
                    fontSize: 15,
                    boxShadow: selected ? "0 8px 20px rgba(37,99,235,0.3)" : "0 2px 6px rgba(15,23,42,0.03)",
                    cursor: locked ? "not-allowed" : "pointer",
                    userSelect: "none",
                    transition: "transform 140ms ease, box-shadow 140ms ease",
                    "&:active": { transform: "scale(0.96)" },
                  }}
                >
                  {locked ? (
                    <Typography fontSize={11} fontWeight={900} color="#16a34a">
                      ✓ PAID
                    </Typography>
                  ) : (monthShort[i] || n)}
                </Box>
              );
            })}
          </Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, px: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Selected Months: <b style={{ color: "#2563eb" }}>{selectedBoxes.length}</b> / {totalBoxes}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 900, color: "#0f172a", fontSize: 15 }}>
              Total: ₹{amount.toLocaleString("en-IN")}
            </Typography>
          </Stack>
        </>
      ) : null}

      <Button
        fullWidth
        variant="contained"
        disableElevation
        sx={primaryPaymentButtonSx}
        disabled={!canBuy}
        onClick={() => {
          onBuy({
            pkg: seasonPkg,
            amount,
            uiMeta: { plan: `Monthly SPP ${unitPriceLabel}`, selectedSeason, selectedBoxes },
            purchasePayload: { package_number: selectedSeason, boxes: selectedBoxes },
          });
        }}
      >
        BUY SPP NOW {amount > 0 ? `• ₹${amount.toLocaleString("en-IN")}` : ""}
      </Button>
    </Box>
  );
}

/**
 * PromoSection  Monthly promotions & offers (grid 3 x 4 on mobile)
 * - No season chooser, no membership info
 * - Uses current package_number from monthly_meta
 */
function PromoSection({ seasonPkg, history, onBuy, seasonActive }) {
  const meta = seasonPkg?.monthly_meta || {};
  const totalBoxes = Math.max(1, Number(meta?.total_boxes || 12));
  const packageNumber = Number(meta?.current_package_number || 1);
  const unitPrice = Math.max(0, Number(seasonPkg?.price || 0));

  const purchasedBoxes = useMemo(() => {
    try {
      // Prefer backend-computed monthly_meta for current package number
      if (
        Array.isArray(meta?.purchased_boxes) &&
        meta.purchased_boxes.length > 0
      ) {
        const fromMeta = meta.purchased_boxes
          .map((b) => parseInt(b, 10))
          .filter((bn) => Number.isFinite(bn) && bn > 0);
        return Array.from(new Set(fromMeta)).sort((a, b) => a - b);
      }

      // Fallback to purchase history
      const boxes = [];
      (history || []).forEach((p) => {
        const pid = p?.package?.id || p?.package_id;
        const ptype = String(p?.package?.type || "").toUpperCase();
        const pkgMatch = (pid === seasonPkg?.id) || (ptype === "MONTHLY");
        const stat = String(p?.status || "").toUpperCase();
        if (pkgMatch && stat !== "REJECTED" && stat !== "CANCELLED") {
          const pn = Number(p?.package_number || 0);
          if (pn === packageNumber) {
            const bxRaw = Array.isArray(p?.boxes_json)
              ? p.boxes_json
              : Array.isArray(p?.boxes)
              ? p.boxes
              : [];
            bxRaw.forEach((b) => {
              const bn = parseInt(b, 10);
              if (bn > 0) boxes.push(bn);
            });
          }
        }
      });
      return Array.from(new Set(boxes)).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }, [history, seasonPkg?.id, packageNumber, meta?.purchased_boxes]);

  const [selectedBoxes, setSelectedBoxes] = useState([]);
  const toggleBox = (n) => {
    if (purchasedBoxes.includes(n)) return;
    setSelectedBoxes((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const canBuy = !!seasonPkg && selectedBoxes.length > 0;
  const amount = unitPrice * Math.max(0, selectedBoxes.length);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Monthly SPP Rs. {unitPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })} {seasonActive ? <Chip size="small" color="success" sx={{ ml: 1 }} label="Active" /> : null}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Pick months to include in this promotion.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
        }}
      >
        {Array.from({ length: totalBoxes }).map((_, i) => {
          const n = i + 1;
          const locked = purchasedBoxes.includes(n);
          const selected = selectedBoxes.includes(n);
          return (
            <Box
              key={n}
              onClick={() => !locked && toggleBox(n)}
              sx={{
                aspectRatio: "1 / 1",
                borderRadius: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid",
                borderColor: selected ? "primary.main" : "divider",
                bgcolor: locked
                  ? "action.disabledBackground"
                  : selected
                  ? "primary.main"
                  : "background.paper",
                color: locked ? "text.disabled" : selected ? "#fff" : "text.primary",
                fontWeight: 700,
                fontSize: 14,
                cursor: locked ? "not-allowed" : "pointer",
                userSelect: "none",
              }}
            >
              {locked ? <LockRoundedIcon fontSize="small" /> : (monthShort[i] || n)}
            </Box>
          );
        })}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Selected: <b>{selectedBoxes.length}</b> / {totalBoxes}
      </Typography>

      <Button
        fullWidth
        variant="contained"
        sx={{ mt: 2, height: 48, textTransform: "none", fontWeight: 800 }}
        disabled={!canBuy}
        onClick={() =>
          onBuy({
            pkg: seasonPkg,
            amount,
            uiMeta: { selectedBoxes },
            purchasePayload: { package_number: packageNumber, boxes: selectedBoxes },
          })
        }
      >
        PROCEED TO PAY
      </Button>
    </Box>
  );
}

/**
 * TourSection  sketch-compliant
 * - Static destinations with placeholders
 * - EXPLORE & BOOK -> Tri module (no duplication of booking logic)
 */
function TourSection({ triHolidays, tourPackages = [], onBuy }) {
  const [dest, setDest] = useState("Goa");
  const tripProducts = Array.isArray(triHolidays?.products) ? triHolidays.products : [];

  const destinations = [
    { key: "Goa", img: "https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=800&auto=format&fit=crop" },
    { key: "Kerala", img: imgKerala },
    { key: "Thailand", img: imgThailand },
    { key: "Malaysia", img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=800&auto=format&fit=crop" },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Travel Experiences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Pick a destination and explore unforgettable holidays.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 1,
        }}
      >
        {destinations.map((d) => (
          <Box
            key={d.key}
            onClick={() => setDest(d.key)}
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "2px solid",
              borderColor: dest === d.key ? "primary.main" : "divider",
              cursor: "pointer",
            }}
          >
            <Box
              component="img"
              src={d.img}
              alt={d.key}
              sx={{ width: "100%", height: 100, objectFit: "cover" }}
            />
            <Box sx={{ p: 1 }}>
              <Typography fontSize={13} sx={{ textAlign: "center" }}>
                {d.key}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Select Tour Prime
      </Typography>
      {tripProducts.length ? (
        <Stack spacing={1}>
          {tripProducts.map((trip) => (
            <Paper key={trip.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                {trip.image_url ? (
                  <Box
                    component="img"
                    src={normalizeMediaUrl(trip.image_url)}
                    alt={trip.name}
                    sx={{ width: 84, height: 64, objectFit: "cover", borderRadius: 1.5, flexShrink: 0 }}
                  />
                ) : null}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 900, color: "#0f172a" }} noWrap>
                    {trip.name || "Tri Tour Prime"}
                  </Typography>
                  {trip.description ? (
                    <Typography sx={{ color: "#64748b", fontSize: 12 }} noWrap>
                      {trip.description}
                    </Typography>
                  ) : null}
                  <Typography sx={{ color: "#64748b", fontSize: 12 }}>
                    Destination: {dest}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography sx={{ fontWeight: 950, color: "#0f172a" }}>
                    ₹{Number(trip.price || 0).toLocaleString("en-IN")}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mt: 0.75, textTransform: "none", fontWeight: 850 }}
                    onClick={() =>
                      onBuy({
                        pkg: { id: null, name: trip.name || "Tri Tour Prime" },
                        amount: Number(trip.price || 0),
                        uiMeta: {
                          destination: dest,
                          triApp: "tri-holidays",
                          selectedProductName: trip.name || "Tri Tour Prime",
                        },
                        purchasePayload: {
                          tri: true,
                          tri_app_slug: "tri-holidays",
                          product_id: trip.id,
                          prime750_choice: "REDEEM",
                        },
                      })
                    }
                  >
                    Buy
                  </Button>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : tourPackages.length ? (
        <Stack spacing={1}>
          {tourPackages.map((pkg) => (
            <Paper key={pkg.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="center">
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900, color: "#0f172a" }} noWrap>
                    {pkg.name || pkg.code || "Tri Tour Prime"}
                  </Typography>
                  {pkg.description ? (
                    <Typography sx={{ color: "#64748b", fontSize: 12 }} noWrap>
                      {pkg.description}
                    </Typography>
                  ) : null}
                  <Typography sx={{ color: "#64748b", fontSize: 12 }}>
                    Destination: {dest}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography sx={{ fontWeight: 950, color: "#0f172a" }}>
                    ₹{Number(pkg.price || 0).toLocaleString("en-IN")}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mt: 0.75, textTransform: "none", fontWeight: 850 }}
                    onClick={() =>
                      onBuy({
                        pkg,
                        amount: Number(pkg.price || 0),
                        uiMeta: {
                          destination: dest,
                          triApp: "tri-holidays",
                          selectedProductName: pkg.name || "Tri Tour Prime",
                        },
                        purchasePayload: {
                          tri: true,
                          tri_app_slug: "tri-holidays",
                          prime750_choice: "REDEEM",
                        },
                      })
                    }
                  >
                    Buy
                  </Button>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Alert severity="info">
          No Tri Tour Prime package is active. Please contact admin.
        </Alert>
      )}
    </Box>
  );
}

/* ======================================================================== */
/* MAIN */
/* ======================================================================== */
export default function PromoPackages({
  title = "Agent Subscription",
  // New: allow route wrappers to render a single section
  // prime750 | season | rank | prime150 | tour
  initialTabKey = null,
  // New: allow wrappers to restrict purchase history list
  // all | prime750 | monthly | tour
  historyScope = "all",
  // Optional UI renames (used for SPP)
  rename = null,
  primeRedeemOnly = false,
} = {}) {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [triHolidays, setTriHolidays] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const [purchaseIntent, setPurchaseIntent] = useState(null);
  const [walletMe, setWalletMe] = useState(null);
  const [walletHistory, setWalletHistory] = useState(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletErr, setWalletErr] = useState("");
  const [seasonsHints, setSeasonsHints] = useState([]);
  const [achievedPrimeLevel, setAchievedPrimeLevel] = useState(0);
  const keyToTab = useMemo(() => {
    const m = { prime750: 0, season: 1, rank: 2, prime150: 3, tour: 4 };
    return m;
  }, []);

  const [tab, setTab] = useState(() => {
    try {
      const k = String(initialTabKey || "").trim().toLowerCase();
      if (k && keyToTab[k] != null) return keyToTab[k];
    } catch (_) {}
    return 0;
  });

  // If wrapper changes initialTabKey after mount, keep in sync (non-breaking)
  useEffect(() => {
    try {
      const k = String(initialTabKey || "").trim().toLowerCase();
      if (k && keyToTab[k] != null) setTab(keyToTab[k]);
    } catch (_) {}
  }, [initialTabKey, keyToTab]);

  const ren = useMemo(() => {
    const r = rename && typeof rename === "object" ? rename : {};
    return {
      seasonLabel: r.seasonLabel || "Season",
      seasonBuyCta: r.seasonBuyCta || "BUY SEASON",
      seasonPlanLabel: r.seasonPlanLabel || "",
    };
  }, [rename]);
  const [paymentSuccessOpen, setPaymentSuccessOpen] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState("We will review it shortly.");

  useEffect(() => {
    (async () => {
      setPackages(await getPromoPackages());
      setHistory(await listMyPromoPurchases());
      try {
        setTriHolidays(await getTriApp("tri-holidays"));
      } catch {}
      try {
        const s = await listCouponSeasons();
        setSeasonsHints(Array.isArray(s) ? s : []);
      } catch {}
      try {
        const eligRes = await API.get("/user/upgrade-eligibility/", { params: { summary: "achieved" }, cacheTTL: 2500, retryAttempts: 1 });
        setAchievedPrimeLevel(Number(eligRes?.data?.achieved_level || 0));
      } catch {}
    })();
  }, []);

  // Default Fallback Packages if API returns empty
  const DEFAULT_PRIME_PKG = useMemo(() => ({
    id: 5,
    code: "PRIME1000",
    name: "Agent Digital Prime Package (₹1,000)",
    description: "Agent Digital Education Prime Package",
    type: "PRIME",
    price: 1000,
    is_active: true,
    promo_products: [{ id: 1, name: "Exclusive Starter Product Pack" }]
  }), []);

  const DEFAULT_SEASON_PKG = useMemo(() => ({
    id: 7,
    code: "MONTHLY1000",
    name: "Smart Product Purchase (SPP)",
    description: "Smart Product Purchase (1 Box = 1 Individual Coupon)",
    type: "MONTHLY",
    price: 1000,
    is_active: true,
    promo_products: []
  }), []);

  // Identify packages with robust fallback
  const primePkg = useMemo(() => {
    const pkgs = Array.isArray(packages) ? packages : (packages?.data || packages?.results || []);
    return pkgs.find(isJoinPrimePackage) || DEFAULT_PRIME_PKG;
  }, [packages, DEFAULT_PRIME_PKG]);

  const seasonPkg = useMemo(() => {
    const pkgs = Array.isArray(packages) ? packages : (packages?.data || packages?.results || []);
    const monthlyCandidates = pkgs.filter(
      (p) => String(p?.type || "").toUpperCase() === "MONTHLY" || !!p?.monthly_meta || String(p?.code || "").toUpperCase().includes("MONTHLY")
    );
    if (monthlyCandidates.length > 0) {
      const withMeta = monthlyCandidates.find((p) => !!p?.monthly_meta);
      return withMeta || monthlyCandidates[0];
    }
    return pkgs.find((p) => approx(p?.price, 1000)) || DEFAULT_SEASON_PKG;
  }, [packages, DEFAULT_SEASON_PKG]);

  const reg150Pkg = useMemo(() => {
    return (packages || []).find(isPrime150Package);
  }, [packages]);

  const tourPackages = useMemo(() => {
    return (packages || []).filter(
      (p) => String(p?.type || "").toUpperCase() !== "MONTHLY" && isTourPackage(p)
    );
  }, [packages]);

  const prime150Active = useMemo(() => {
    try {
      const regId = reg150Pkg?.id;
      if (!regId) return false;
      return (history || []).some(
        (h) =>
          (h?.package?.id || h?.package_id) === regId &&
          String(h?.status || "").toUpperCase() === "APPROVED"
      );
    } catch {
      return false;
    }
  }, [history, reg150Pkg?.id]);

  const activePackageIds = useMemo(() => {
    try {
      const ids = new Set();
      (history || []).forEach((h) => {
        const status = String(h?.status || "").toUpperCase();
        if (status === "APPROVED") {
          const pid = h?.package?.id || h?.package_id;
          if (pid) ids.add(pid);
        }
      });
      return ids;
    } catch {
      return new Set();
    }
  }, [history]);

  const prime750Active = useMemo(() => {
    const id = primePkg?.id;
    return !!id && activePackageIds.has(id);
  }, [activePackageIds, primePkg?.id]);

  const seasonActive = useMemo(() => {
    const id = seasonPkg?.id;
    return !!id && activePackageIds.has(id);
  }, [activePackageIds, seasonPkg?.id]);

  const onBuy = async (data) => {
    // New flow: ask user to choose Wallet vs Manual.
    // Always use getWalletMeFresh() (no cache) so existing users who already
    // made a wallet purchase see their real current balance, not a cached one.
    setPurchaseIntent(data);
    setWalletErr("");
    try {
      const [w, h] = await Promise.all([
        getWalletMeFresh(),
        getWalletMeHistory().catch(() => null),
      ]);
      setWalletMe(w || null);
      setWalletHistory(h || null);
    } catch {
      setWalletMe(null);
      setWalletHistory(null);
    }
    setMethodOpen(true);
  };

  const scopedHistory = useMemo(() => {
    const scope = String(historyScope || "all").toLowerCase();
    const rows = Array.isArray(history) ? history : [];
    if (scope === "all") return rows;

    if (scope === "prime750") {
      const primeId = primePkg?.id;
      return rows.filter((h) => {
        const pid = h?.package?.id || h?.package_id;
        return primeId ? String(pid) === String(primeId) : approx(h?.package?.price, 750);
      });
    }

    if (scope === "monthly") {
      const seasonId = seasonPkg?.id;
      return rows.filter((h) => {
        const pid = h?.package?.id || h?.package_id;
        const ptype = String(h?.package?.type || "").toUpperCase();
        if (ptype === "MONTHLY") return true;
        return seasonId ? String(pid) === String(seasonId) : false;
      });
    }

    if (scope === "tour") {
      // Tri Tour is backed by the Tri app slug in purchase metadata
      return rows.filter((h) => String(h?.tri_app_slug || "").toLowerCase() === "tri-holidays");
    }

    return rows;
  }, [history, historyScope, primePkg?.id, seasonPkg?.id]);

  const PurchaseHistory = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Purchase History
      </Typography>
      {scopedHistory.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No purchases yet.
        </Typography>
      ) : (
        <Box>
          {scopedHistory.map((h) => {
            const status = String(h?.status || "").toUpperCase();
            const badgeColor =
              status === "APPROVED" ? "success.main" : status === "PENDING" ? "warning.main" : "text.secondary";
            const badgeBorder =
              status === "APPROVED" ? "success.main" : status === "PENDING" ? "warning.main" : "divider";
            const isJoinPrimeHist = isJoinPrimePackage(h?.package) || approx(h?.amount, 750) || approx(h?.package?.price, 750);
            const displayName = isJoinPrimeHist ? "Agent Digital Education Prime Package" : (h?.package?.name || "-");
            const displayAmount = isJoinPrimeHist ? 1000 : Number(h?.amount || h?.package?.price || 0);

            return (
              <Box
                key={h.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  alignItems: "center",
                  columnGap: 1.5,
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: "none" },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap title={displayName}>
                    {displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {h?.requested_at ? dayjs(h.requested_at).format("DD MMM YYYY") : ""}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, textAlign: "right", minWidth: 90 }}>
                  ₹{displayAmount.toLocaleString("en-IN")}
                </Typography>
                <Box sx={{ justifySelf: "end" }}>
                  <Box
                    sx={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      px: 1,
                      py: 0.25,
                      border: "1px solid",
                      borderRadius: 9999,
                      color: badgeColor,
                      borderColor: badgeBorder,
                      lineHeight: 1.6,
                    }}
                  >
                    {status}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );

  return (
    <Box p={2}>
      <Typography fontWeight={900} mb={1.5}>
        {title}
      </Typography>

      {initialTabKey ? null : (
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons={false}
            allowScrollButtonsMobile
            TabIndicatorProps={{
              sx: { height: 3, borderRadius: 3 },
            }}
            sx={{
              px: 1,

              "& .MuiTabs-flexContainer": {
                gap: 1,
              },

              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 700,
                fontSize: 14,
                minHeight: 48,
                px: 2.2,
                borderRadius: 2,
                color: "text.secondary",
              },

              "& .Mui-selected": {
                color: "primary.main",
                bgcolor: "primary.50",
              },
            }}
          >
            <Tab label="Agent Subscription" />
            <Tab label={ren.seasonLabel} />
            <Tab label="Rank Upgrade" />
            <Tab label="Prime 150" />
            <Tab label="Tour" />
          </Tabs>
        </Box>
      )}

      
      <Paper elevation={0} sx={{ borderRadius: 2 }}>
        <Box sx={{ p: 2 }}>
          {/* AGENT SUBSCRIPTION */}
          {tab === 0 ? (
            <AgentSubscriptionSection
              pkg={primePkg}
              seasonPkg={seasonPkg}
              tourPackages={tourPackages}
              triHolidays={triHolidays}
              prime150Active={prime150Active}
              prime750Active={prime750Active}
              seasonActive={seasonActive}
              achievedPrimeLevel={achievedPrimeLevel}
              onBuy={onBuy}
              navigate={navigate}
            />
          ) : null}

          {/* SEASON */}
          {tab === 1 ? (
            seasonPkg ? (
              <SeasonSection
                seasonPkg={seasonPkg}
                reg150Pkg={reg150Pkg}
                prime150Active={prime150Active}
                history={history}
                onBuy={onBuy}
                seasonsHints={seasonsHints}
                seasonActive={seasonActive}
                rename={ren}
              />
            ) : (
              <Alert severity="warning">Season package not available.</Alert>
            )
          ) : null}

          {/* RANK UPGRADE */}
          {tab === 2 ? <RankUpgrade /> : null}

          {/* PRIME 150 */}
          {tab === 3 ? (
            <Prime150Section reg150Pkg={reg150Pkg} prime150Active={prime150Active} onBuy={onBuy} />
          ) : null}

          {/* TOUR */}
          {tab === 4 ? <TourSection triHolidays={triHolidays} tourPackages={tourPackages} onBuy={onBuy} /> : null}
        </Box>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Compact history below sections */}
      <PurchaseHistory />

      {/* Shared Payment Sheet */}
      <PaymentSheet
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        data={paymentData}
        onSuccess={async () => {
          setHistory(await listMyPromoPurchases());
          setPaymentSuccessMessage("We will review it shortly.");
          setPaymentSuccessOpen(true);
        }}
      />

      {/* Payment method chooser */}
      <PaymentMethodDialog
        open={methodOpen}
        onClose={() => !walletBusy && setMethodOpen(false)}
        intent={purchaseIntent}
        walletMe={walletMe}
        walletHistory={walletHistory}
        busy={walletBusy}
        onPickManual={() => {
          setMethodOpen(false);
          setPaymentData(purchaseIntent);
          setPaymentOpen(true);
        }}
        onPickWallet={async (walletSource = "internal") => {
          setWalletBusy(true);
          setWalletErr("");
          try {
            const payload = {
              wallet_source: walletSource,
              ...(purchaseIntent.purchasePayload || {}),
            };
            if (purchaseIntent?.pkg?.id) payload.package_id = purchaseIntent.pkg.id;
            // Internally ensure REDEEM is set for Prime 750 / Agent 1K combo if not already set
            const isPrimeCombo =
              purchaseIntent?.pkg?.code === "PRIME750" ||
              purchaseIntent?.pkg?.code === "PRIME1000" ||
              purchaseIntent?.amount === 1000 ||
              purchaseIntent?.amount === 750 ||
              approx(purchaseIntent?.pkg?.price, 750) ||
              approx(purchaseIntent?.pkg?.price, 1000);
            if (isPrimeCombo && !payload.prime750_choice) {
              payload.prime750_choice = "REDEEM";
            }
            await createPromoPurchaseFromWallet(payload);

            // Execute rank 1 upgrade (Digital Education 1st level - ₹250) in background if buying Agent Digital Prime
            if (
              purchaseIntent?.pkg?.code === "PRIME750" ||
              purchaseIntent?.pkg?.code === "PRIME1000" ||
              purchaseIntent?.amount === 1000 ||
              purchaseIntent?.amount === 750
            ) {
              try {
                const upgResp = await initiateUpgrade({ to_rank_id: 1 });
                const upgId = upgResp?.id || upgResp?.upgrade?.id;
                if (upgId) {
                  await createRankUpgradeFromWallet({
                    upgrade_id: upgId,
                    wallet_source: walletSource,
                  });
                }
              } catch (upgErr) {
                console.warn("Background Rank 1 upgrade after Prime purchase:", upgErr);
              }
            }

            setMethodOpen(false);
            // Re-fetch history and wallet balance together.
            // Use getWalletMeFresh() (no cache) so the deducted balance is shown
            // immediately the next time the user opens the payment method dialog.
            const [updatedHistory, freshWallet, freshHistory] = await Promise.allSettled([
              listMyPromoPurchases(),
              getWalletMeFresh(),
              getWalletMeHistory().catch(() => null),
            ]);
            if (updatedHistory.status === "fulfilled") setHistory(updatedHistory.value);
            if (freshWallet.status === "fulfilled") setWalletMe(freshWallet.value || null);
            if (freshHistory.status === "fulfilled") setWalletHistory(freshHistory.value || null);
            setPaymentSuccessMessage("Agent Digital Prime Package purchased successfully.");
            setPaymentSuccessOpen(true);
          } catch (e) {
            let msg = e?.response?.data?.detail;
            if (!msg && e?.response?.data && typeof e.response.data === "object") {
              const firstKey = Object.keys(e.response.data)[0];
              const val = e.response.data[firstKey];
              msg = Array.isArray(val) ? val.join(" ") : String(val);
            }
            msg = msg || e?.message || "Wallet payment failed";
            setWalletErr(msg);
          } finally {
            setWalletBusy(false);
          }
        }}
      />

      {walletErr ? (
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
      ) : null}
      <Dialog open={paymentSuccessOpen} onClose={() => setPaymentSuccessOpen(false)}>
        <Box sx={{ p: 3, textAlign: "center", minWidth: 280 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Payment is successful
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {paymentSuccessMessage}
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => setPaymentSuccessOpen(false)}>
            OK
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
