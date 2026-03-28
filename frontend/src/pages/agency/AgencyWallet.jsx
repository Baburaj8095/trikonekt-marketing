import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  Stack,
  LinearProgress,
} from "@mui/material";
import { TextField, Button, Alert } from "@mui/material";
import API, {
  listMyPromoPurchases,
  getRewardPointsSummary,
  getMyECouponSummary,
} from "../../api/api";

/**
 * AgencyWallet
 * Agency-only wallet screen that follows the provided sketch (two-column stat cards),
 * without impacting the existing consumer wallet (frontend/src/pages/Wallet.jsx).
 * All wallet logic and functionality (balances, window rules, withdrawals) are preserved.
 */

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function computeWindowLocal(cfg) {
  // cfg: { enabled, weekday(0=Mon..6=Sun), start_time:'HH:MM', end_time:'HH:MM' }
  // Uses the browser's local timezone; backend enforcement is done in IST.
  const now = new Date();
  const enabled = Boolean(cfg?.enabled ?? true);
  // JS weekday: 0=Sun..6=Sat. Python weekday: 0=Mon..6=Sun.
  const pyWeekday = Number(cfg?.weekday ?? 2);
  const jsTargetDay = (pyWeekday + 1) % 7;

  const parseHHMM = (s, fallback) => {
    try {
      const [hh, mm] = String(s || "").split(":").map((x) => Number(x));
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return fallback;
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;
      return { hh, mm };
    } catch {
      return fallback;
    }
  };

  const st = parseHHMM(cfg?.start_time, { hh: 0, mm: 0 });
  const et = parseHHMM(cfg?.end_time, { hh: 23, mm: 59 });

  // Find the date for this week's target weekday
  const day = now.getDay();
  const daysSinceTarget = ((day - jsTargetDay) + 7) % 7;
  const baseDate = new Date(now);
  baseDate.setHours(0, 0, 0, 0);
  baseDate.setDate(baseDate.getDate() - daysSinceTarget);

  const currentStart = new Date(baseDate);
  currentStart.setHours(st.hh, st.mm, 0, 0);
  const currentEnd = new Date(baseDate);
  currentEnd.setHours(et.hh, et.mm, 59, 999);

  // If end is <= start, treat as crossing midnight to next day
  if (currentEnd <= currentStart) {
    currentEnd.setDate(currentEnd.getDate() + 1);
  }

  const isOpen = enabled && now >= currentStart && now <= currentEnd;

  // Compute next window start
  let nextStart = new Date(currentStart);
  if (now > currentEnd) nextStart.setDate(nextStart.getDate() + 7);
  if (now < currentStart) nextStart = currentStart;
  return { isOpen, enabled, nextWindowAt: nextStart, currentStart, currentEnd };
}

function weekdayLabel(pyWeekday) {
  const w = Number(pyWeekday ?? 2);
  const map = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return map[w] || "Wednesday";
}

function hhmm(s, fallback) {
  try {
    const v = String(s || "").slice(0, 5);
    return /^\d{2}:\d{2}$/.test(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export default function AgencyWallet() {
  // Core balances
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState("0.00"); // legacy
  const [mainBalance, setMainBalance] = useState("0.00"); // gross earnings
  const [withdrawableBalance, setWithdrawableBalance] = useState("0.00"); // net available
  const [taxPercent, setTaxPercent] = useState("0");
  const [updatedAt, setUpdatedAt] = useState(null);

  // Wallet meta
  const [err, setErr] = useState("");
  const [autoBlock, setAutoBlock] = useState(null);
  const [breakdown, setBreakdown] = useState({
    coupon_cost: "150.00",
    tds: "50.00",
    direct_ref_bonus: "50.00",
  });
  const [redeemPoints, setRedeemPoints] = useState({ self: 0, refer: 0 });
  const [nextBlock, setNextBlock] = useState({
    completed_in_current_block: "0.00",
    remaining_to_next_block: "1000.00",
    progress_percent: 0,
  });
  const [kyc, setKyc] = useState({ verified: false });
  const [withdrawalsWindowCfg, setWithdrawalsWindowCfg] = useState({ enabled: true, weekday: 2, start_time: "00:00", end_time: "23:59" });
  const [windowInfo, setWindowInfo] = useState(computeWindowLocal(withdrawalsWindowCfg));
  const [primeInfo, setPrimeInfo] = useState({
    has150: false,
    has750: false,
    hasMonthly: false,
    primeDate: null,
    monthlyDate: null,
  });
  const [rewards, setRewards] = useState({ total: 0, redeemed: 0 });
  const [todayEarning, setTodayEarning] = useState(0);

  // Incomes
  const [directRefIncome, setDirectRefIncome] = useState("0.00");
  const [matrixIncome, setMatrixIncome] = useState("0.00"); // Agency level income
  const [globalTriIncome, setGlobalTriIncome] = useState("0.00");
  const [globalTurnoverIncome, setGlobalTurnoverIncome] = useState("0.00");
  const [withdrawalBenefit, setWithdrawalBenefit] = useState("0.00");
  const [directRefWithdrawCommission, setDirectRefWithdrawCommission] = useState("0.00");

  // Additional incomes shown in the sketch (fallback to 0 if not provided by backend)
  const [directRefCouponCommission, setDirectRefCouponCommission] = useState("0.00");
  const [productSellIncome, setProductSellIncome] = useState("0.00");
  const [shopTieupIncome, setShopTieupIncome] = useState("0.00");
  const [appDownloadIncome, setAppDownloadIncome] = useState("0.00");
  const [employeeSponsorBenefit, setEmployeeSponsorBenefit] = useState("0.00");

  // Gross "all earnings" (without TDS) - for reward redeem calc
  const [allEarningsGross, setAllEarningsGross] = useState("0.00");

  // Coupon activations summary (used as "benefits" cards)
  const [couponSummary, setCouponSummary] = useState({
    selfActivated: 0,
    monthlyActivated: 0,
  });

  // Derived computations
  const computedNetPreview = useMemo(() => {
    const gross = Number(mainBalance || 0);
    const tdsPct = 10;
    const net = gross - (gross * tdsPct) / 100;
    return net < 0 ? 0 : net;
  }, [mainBalance]);

  const computedRewardsRedeemed = useMemo(() => {
    const total = Number(rewards.total || 0);
    const gross = Number(allEarningsGross || mainBalance || 0);
    const val = total - gross;
    return val > 0 ? val : 0;
  }, [rewards.total, allEarningsGross, mainBalance]);

  const blockMath = useMemo(() => {
    const blockSize = Number(autoBlock?.block_size ?? 1000);
    const coupon = Number(breakdown?.coupon_cost ?? 150);
    const tds = Number(breakdown?.tds ?? 50);
    const drb = Number(breakdown?.direct_ref_bonus ?? 50);
    const totalDeduction = coupon + tds + drb;
    const netPerBlock = Math.max(0, blockSize - totalDeduction);
    const appliedBlocks = Number(autoBlock?.applied_blocks ?? 0);
    const pendingBlocks = Number(autoBlock?.pending_blocks ?? 0);
    const creditedAmount = appliedBlocks * netPerBlock;
    const pendingCredit = pendingBlocks * netPerBlock;
    return {
      blockSize,
      coupon,
      tds,
      drb,
      totalDeduction,
      netPerBlock,
      appliedBlocks,
      pendingBlocks,
      creditedAmount,
      pendingCredit,
    };
  }, [autoBlock, breakdown]);

  // Display value for "Withdrawal Wallet" card
  // Clamp to not exceed Income Wallet to avoid confusion in UI
  const displayWithdrawWallet = useMemo(() => {
    const wd = Number(withdrawableBalance || 0);
    const main = Number(mainBalance || 0);
    return wd > main ? main : wd;
  }, [withdrawableBalance, mainBalance]);

  // Withdrawals
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [wdrErr, setWdrErr] = useState("");
  const [wdrSubmitting, setWdrSubmitting] = useState(false);
  const [wdrForm, setWdrForm] = useState({
    amount: "",
    method: "bank",
  });
  const onWdrChange = (e) =>
    setWdrForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const inWindowCooldown = useMemo(() => {
    const wi = windowInfo;
    if (!wi || !wi.currentStart || !wi.currentEnd) return false;
    try {
      return (myWithdrawals || []).some((w) => {
        const status = String(w.status || "").toLowerCase();
        if (status === "rejected") return false;
        const dt = w.requested_at ? new Date(w.requested_at) : null;
        return dt && dt >= wi.currentStart && dt < wi.currentEnd;
      });
    } catch {
      return false;
    }
  }, [myWithdrawals, windowInfo]);

  const disableReason = useMemo(() => {
    if (!kyc?.verified) return "KYC verification required";
    if (Number(displayWithdrawWallet) < 500)
      return "Minimum withdrawable balance ₹500 required";
    if (!windowInfo?.enabled) return "Withdrawals are currently disabled.";
    if (!windowInfo?.isOpen) {
      const day = weekdayLabel(withdrawalsWindowCfg?.weekday);
      const st = hhmm(withdrawalsWindowCfg?.start_time, "00:00");
      const et = hhmm(withdrawalsWindowCfg?.end_time, "23:59");
      return `Withdrawals are allowed only on ${day} between ${st} and ${et} (IST).`;
    }
    return "";
  }, [kyc, displayWithdrawWallet, windowInfo, withdrawalsWindowCfg]);

  useEffect(() => {
    const id = setInterval(() => setWindowInfo(computeWindowLocal(withdrawalsWindowCfg)), 30000);
    return () => clearInterval(id);
  }, [withdrawalsWindowCfg]);

  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        setLoading(true);
        setErr("");
        const [w, mw, kycRes] = await Promise.all([
          API.get("/accounts/wallet/me/"),
          API.get("/accounts/withdrawals/me/"),
          API.get("/accounts/kyc/me/"),
        ]);
        if (!mounted) return;

        const bal = String(w?.data?.balance ?? "0.00");
        const mainBal = String(w?.data?.main_balance ?? "0.00");
        const wdBal = String(w?.data?.withdrawable_balance ?? "0.00");
        const tax = String(w?.data?.tax_percent ?? "0");
        const upd = w?.data?.updated_at || null;
        setBalance(bal);
        setMainBalance(mainBal);
        setWithdrawableBalance(wdBal);
        setTaxPercent(tax);
        setUpdatedAt(upd);
        setAutoBlock(w?.data?.auto_block || null);
        setBreakdown(
          w?.data?.breakdown_per_block || {
            coupon_cost: "150.00",
            tds: "50.00",
            direct_ref_bonus: "50.00",
          }
        );
        setRedeemPoints(w?.data?.redeem_points || { self: 0, refer: 0 });
        setNextBlock(
          w?.data?.next_block || {
            completed_in_current_block: "0.00",
            remaining_to_next_block: "1000.00",
            progress_percent: 0,
          }
        );
        setTodayEarning(
          Number(w?.data?.today?.earning ?? w?.data?.today_earning ?? 0)
        );

        const inc = w?.data?.income || {};
        setDirectRefIncome(
          String(
            inc?.directReferral ??
              w?.data?.direct_ref_income_total ??
              "0.00"
          )
        );
        setMatrixIncome(
          String(inc?.matrixFive ?? w?.data?.matrix_income_total ?? "0.00")
        );
        setGlobalTriIncome(
          String(
            inc?.matrixThree ??
              w?.data?.global_tri_income_total ??
              w?.data?.global_tri_income ??
              "0.00"
          )
        );
        setGlobalTurnoverIncome(
          String(
            inc?.globalTurnover ??
              w?.data?.global_turnover_income_total ??
              w?.data?.global_turnover_income ??
              "0.00"
          )
        );
        setWithdrawalBenefit(String(inc?.withdrawalBenefit ?? "0.00"));
        setDirectRefWithdrawCommission(
          String(inc?.directRefWithdrawCommission ?? "0.00")
        );

        // Additional incomes
        setDirectRefCouponCommission(
          String(
            inc?.directRefCouponCommission ??
              inc?.directReferralCouponCommission ??
              "0.00"
          )
        );
        setProductSellIncome(
          String(inc?.productSell ?? inc?.product_sell ?? "0.00")
        );
        setShopTieupIncome(String(inc?.shopTieup ?? "0.00"));
        setAppDownloadIncome(
          String(inc?.appDownloadIncome ?? inc?.app_download ?? "0.00")
        );
        setEmployeeSponsorBenefit(
          String(inc?.employeeSponsorBenefit ?? "0.00")
        );

        // "All earnings" gross without TDS if provided
        setAllEarningsGross(
          String(w?.data?.totals?.allEarnings ?? mainBal ?? "0.00")
        );

        // Coupon summary from wallet response if present
        const cpn = w?.data?.coupons || null;
        if (cpn) {
          setCouponSummary({
            selfActivated: Number(cpn?.selfActivated ?? 0),
            monthlyActivated: Number(
              cpn?.monthlyActivated ?? cpn?.monthlySelfBenefitActivated ?? 0
            ),
          });
        }

        const wlist = Array.isArray(mw?.data)
          ? mw.data
          : mw?.data?.results || [];
        setMyWithdrawals(wlist || []);
        setKyc(kycRes?.data || { verified: false });

        // Load withdrawals window from admin master config
        try {
          const cfgRes = await API.get("/admin/commission/master/", { cacheTTL: 10_000, dedupe: "cancelPrevious" });
          const wwin = cfgRes?.data?.withdrawals_window;
          if (wwin) {
            const cfg = {
              enabled: Boolean(wwin?.enabled ?? true),
              weekday: Number(wwin?.weekday ?? 2),
              start_time: String(wwin?.start_time ?? "00:00").slice(0, 5),
              end_time: String(wwin?.end_time ?? "23:59").slice(0, 5),
            };
            setWithdrawalsWindowCfg(cfg);
            setWindowInfo(computeWindowLocal(cfg));
          } else {
            setWindowInfo(computeWindowLocal(withdrawalsWindowCfg));
          }
        } catch (_) {
          setWindowInfo(computeWindowLocal(withdrawalsWindowCfg));
        }
      } catch (e) {
        if (!mounted) return;
        setErr("Failed to load wallet. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      mounted = false;
    };
  }, []);

  // Load purchases to compute Prime/Monthly status and activation dates
  useEffect(() => {
    (async () => {
      try {
        const res = await listMyPromoPurchases();
        const list = Array.isArray(res) ? res : res?.results || [];
        const approved = (list || []).filter(
          (pp) => String(pp?.status || "").toUpperCase() === "APPROVED"
        );
        let has150 = false,
          has750 = false,
          hasMonthly = false;
        let primeDate = null,
          monthlyDate = null;
        for (const pp of approved) {
          const pkg = pp?.package || {};
          const type = String(pkg?.type || "");
          const name = String(pkg?.name || "").toLowerCase();
          const code = String(pkg?.code || "").toLowerCase();
          const price = Number(pkg?.price || 0);
          const dt =
            pp?.approved_at || pp?.created_at || pp?.updated_at || null;
          if (type === "MONTHLY") {
            hasMonthly = true;
            if (!monthlyDate) monthlyDate = dt;
          } else if (type === "PRIME") {
            if (
              Math.abs(price - 150) < 0.5 ||
              name.includes("150") ||
              code.includes("150")
            )
              has150 = true;
            if (
              Math.abs(price - 750) < 0.5 ||
              name.includes("750") ||
              code.includes("750")
            )
              has750 = true;
            if (!primeDate) primeDate = dt;
          }
        }
        setPrimeInfo({ has150, has750, hasMonthly, primeDate, monthlyDate });
      } catch (_) {}
    })();
  }, []);

  // Load reward points summary (safe mapping)
  useEffect(() => {
    (async () => {
      try {
        const rs = await getRewardPointsSummary();
        const total = Number(
          rs?.current_points ??
            rs?.total ??
            rs?.total_points ??
            rs?.points_total ??
            rs?.summary?.total ??
            0
        );
        setRewards((prev) => ({ total, redeemed: prev?.redeemed ?? 0 }));
      } catch (_) {
        setRewards({ total: 0, redeemed: 0 });
      }
    })();
  }, []);

  // Load coupon summary (self vs monthly activated counts)
  useEffect(() => {
    (async () => {
      try {
        const s = await getMyECouponSummary();
        const selfActivated = Number(
          s?.self_activated ?? s?.self ?? s?.activated_self ?? 0
        );
        const monthlyActivated = Number(
          s?.monthly_activated ?? s?.monthly ?? s?.activated_monthly ?? 0
        );
        setCouponSummary({ selfActivated, monthlyActivated });
      } catch (_) {
        setCouponSummary({ selfActivated: 0, monthlyActivated: 0 });
      }
    })();
  }, []);

  async function submitWithdrawal(e) {
    e.preventDefault();
    setWdrErr("");
    if (disableReason) {
      setWdrErr(disableReason);
      return;
    }
    const amtNum = Number(wdrForm.amount);
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      setWdrErr("Enter a valid amount.");
      return;
    }
    // No fixed per-request cap. Allow withdrawing up to available withdrawable wallet balance.
    const availableToWithdraw = Number(displayWithdrawWallet || 0);
    if (amtNum > availableToWithdraw) {
      setWdrErr(
        `Amount cannot exceed your available balance (₹${fmtAmount(
          availableToWithdraw
        )}).`
      );
      return;
    }
    const payload = {
      amount: amtNum,
      method: "bank",
    };
    try {
      setWdrSubmitting(true);
      await API.post("/accounts/withdrawals/", payload);
      // Refresh
      const [w, mw] = await Promise.all([
        API.get("/accounts/wallet/me/"),
        API.get("/accounts/withdrawals/me/"),
      ]);
      const bal = String(w?.data?.balance ?? "0.00");
      const mainBal = String(w?.data?.main_balance ?? "0.00");
      const wdBal = String(w?.data?.withdrawable_balance ?? "0.00");
      const tax = String(w?.data?.tax_percent ?? "0");
      const upd = w?.data?.updated_at || null;
      const wlist = Array.isArray(mw?.data)
        ? mw.data
        : mw?.data?.results || [];
      setBalance(bal);
      setMainBalance(mainBal);
      setWithdrawableBalance(wdBal);
      setTaxPercent(tax);
      setUpdatedAt(upd);
      setMyWithdrawals(wlist || []);
      setAutoBlock(w?.data?.auto_block || null);
      setBreakdown(
        w?.data?.breakdown_per_block || {
          coupon_cost: "150.00",
          tds: "50.00",
          direct_ref_bonus: "50.00",
        }
      );
      setRedeemPoints(w?.data?.redeem_points || { self: 0, refer: 0 });
      setNextBlock(
        w?.data?.next_block || {
          completed_in_current_block: "0.00",
          remaining_to_next_block: "1000.00",
          progress_percent: 0,
        }
      );
      setWdrForm({
        amount: "",
        method: wdrForm.method,
      });
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (e?.response?.data
          ? JSON.stringify(e.response.data)
          : "Failed to submit withdrawal.");
      setWdrErr(String(msg));
    } finally {
      setWdrSubmitting(false);
    }
  }

  const StatCard = ({ title, value, hint }) => (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        minHeight: 110,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {title}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {hint}
        </Typography>
      ) : null}
    </Paper>
  );

  const primeDateStr = primeInfo.primeDate
    ? new Date(primeInfo.primeDate).toLocaleDateString()
    : "-";
  const monthlyDateStr = primeInfo.monthlyDate
    ? new Date(primeInfo.monthlyDate).toLocaleDateString()
    : "-";

  return (
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 3 },
      }}
    >
      <Typography
        variant="h5"
        sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}
      >
        Earning Wallet (Agency)
      </Typography>

      {/* Two-column stat cards as per sketch (pairs row-wise) */}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          mb: 2,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(2, minmax(0, 1fr))",
          },
          alignItems: "stretch",
        }}
      >
        {/* Row 1 */}
        <StatCard
          title="Agency Package Active"
          value={primeInfo.has150 || primeInfo.has750 ? "Active" : "Inactive"}
          hint={`Date: ${primeDateStr}`}
        />
        <StatCard
          title="Reward Redeem Point"
          value={`${Number(computedRewardsRedeemed || 0).toLocaleString()}`}
        />

        {/* Row 2 */}
        <StatCard
          title="Total Reward Point"
          value={`${Number(rewards.total || 0).toLocaleString()}`}
        />
        <StatCard
          title="Direct Referral Withdrawal Commission"
          value={`₹ ${fmtAmount(directRefWithdrawCommission)}`}
        />

        {/* Row 3 */}
        <StatCard title="Today Earning" value={`₹ ${fmtAmount(todayEarning)}`} />
        <StatCard
          title="Direct Agency Referral Commission"
          value={`₹ ${fmtAmount(directRefIncome)}`}
        />

        {/* Row 4 */}
        <StatCard
          title="Agency Level Income"
          value={`₹ ${fmtAmount(matrixIncome)}`}
        />
        <StatCard
          title="Direct Referral Consumer Coupon Commission"
          value={`₹ ${fmtAmount(directRefCouponCommission)}`}
        />

        {/* Row 5 */}
        <StatCard
          title="Agency Package Reward Benefit"
          value={`${Number(couponSummary.selfActivated || 0)}`}
        />
        <StatCard
          title="Consumer Monthly Prime Benefit"
          value={`${Number(couponSummary.monthlyActivated || 0)}`}
          hint={`Monthly Active: ${primeInfo.hasMonthly ? "Yes" : "No"} (${monthlyDateStr})`}
        />

        {/* Row 6 */}
        <StatCard
          title="Global Turnover Income"
          value={`₹ ${fmtAmount(globalTurnoverIncome)}`}
        />
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 2,
            minHeight: 110,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Withdrawal Limit
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <Box
              sx={{
                flex: 1,
                p: 1,
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Earn
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
                ₹ {fmtAmount(nextBlock?.completed_in_current_block || "0")}
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                p: 1,
                border: "1px dashed",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Limit
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
                ₹ 1000
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Row 7 */}
        <StatCard
          title="Withdrawal Wallet"
          value={`₹ ${fmtAmount(displayWithdrawWallet)}`}
          hint="Net available to withdraw now"
        />
        <StatCard
          title="Income Wallet"
          value={`₹ ${fmtAmount(mainBalance)}`}
          hint={`Completed ₹ ${fmtAmount(nextBlock?.completed_in_current_block || "0")} • Remaining ₹ ${fmtAmount(nextBlock?.remaining_to_next_block || "1000")}`}
        />

        {/* Row 8 */}
        <StatCard
          title="Product Sell Income"
          value={`₹ ${fmtAmount(productSellIncome)}`}
        />
        <StatCard
          title="App Download"
          value={`₹ ${fmtAmount(appDownloadIncome)}`}
        />

        {/* Row 9 */}
        <StatCard
          title="Shop Tieup"
          value={`₹ ${fmtAmount(shopTieupIncome)}`}
        />
        <StatCard
          title="Employee Sponsor Benefit"
          value={`₹ ${fmtAmount(employeeSponsorBenefit)}`}
        />
      </Box>

      {/* Withdrawal form */}
      <Grid container spacing={{ xs: 2, sm: 2 }}>
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2, minHeight: 120 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: "text.secondary", mb: 1 }}
            >
              Request Withdrawal
            </Typography>
            {wdrErr ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                {wdrErr}
              </Alert>
            ) : null}
            {!kyc?.verified ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                KYC verification required to request withdrawal. Please
                complete KYC in the KYC section.
              </Alert>
            ) : null}
            {Number(displayWithdrawWallet) < 500 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Minimum withdrawable balance ₹500 required to enable
                withdrawals. Short by ₹
                {Math.max(0, 500 - Number(displayWithdrawWallet)).toFixed(2)}
              </Alert>
            ) : null}
            {!windowInfo?.enabled ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Withdrawals are currently disabled.
              </Alert>
            ) : null}
            {windowInfo?.enabled && !windowInfo?.isOpen ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                {disableReason} Next window:{" "}
                {windowInfo?.nextWindowAt ? windowInfo.nextWindowAt.toLocaleString() : "-"}
              </Alert>
            ) : null}
            <Box component="form" onSubmit={submitWithdrawal} sx={{ mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Amount (₹)"
                  name="amount"
                  value={wdrForm.amount}
                  onChange={onWdrChange}
                  type="number"
                  inputProps={{
                    inputMode: "decimal",
                    max: Number(displayWithdrawWallet || 0),
                    step: "0.01",
                  }}
                  helperText={`Available to withdraw: ₹ ${fmtAmount(
                    Number(displayWithdrawWallet || 0)
                  )}`}
                  required
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Method"
                  name="method"
                  value="bank"
                  disabled
                />
              </Stack>
              <Alert severity="info" sx={{ mt: 1 }}>
                Withdrawals are debited only from your Withdrawable Wallet
                (Net). Bank details are captured in the KYC screen.
              </Alert>
              <Button
                type="submit"
                variant="contained"
                disabled={Boolean(disableReason) || wdrSubmitting}
                sx={{ mt: 1 }}
              >
                {wdrSubmitting ? "Requesting..." : "Request Withdrawal"}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
