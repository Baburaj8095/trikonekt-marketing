import React, { useEffect, useState, useMemo } from "react";
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
import API, { listMyPromoPurchases, getRewardPointsSummary, getMyECouponSummary } from "../api/api";
import { alpha } from "@mui/material/styles";

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function computeWeeklyWindowLocal() {
  // Compute current week's Sunday 6:00 PM to 11:59 PM window using local time
  const now = new Date();

  // JS weekday: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const day = now.getDay();

  // Days since this week's Sunday
  const daysSinceSun = ((day - 0) + 7) % 7;

  // Get this week's Sunday date
  const currentSun = new Date(now);
  currentSun.setHours(0, 0, 0, 0);
  currentSun.setDate(currentSun.getDate() - daysSinceSun);

  // Window start/end (local time)
  const currentStart = new Date(currentSun);
  currentStart.setHours(18, 0, 0, 0); // 6:00 PM
  const currentEnd = new Date(currentSun);
  currentEnd.setHours(23, 59, 59, 999); // 11:59 PM

  // Open state
  const isOpen = now >= currentStart && now < currentEnd;

  // Next window start
  let nextStart = new Date(currentStart);
  if (now >= currentEnd) {
    // next week's Sunday
    nextStart = new Date(currentStart);
    nextStart.setDate(nextStart.getDate() + 7);
  } else if (now < currentStart) {
    nextStart = new Date(currentStart);
  }

  return { isOpen, nextWindowAt: nextStart, currentStart, currentEnd };
}

export default function Wallet() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState("0.00"); // legacy total (for backward compatibility)
  const [mainBalance, setMainBalance] = useState("0.00"); // gross earnings
  const [withdrawableBalance, setWithdrawableBalance] = useState("0.00"); // net (can withdraw)
  const [taxPercent, setTaxPercent] = useState("0");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [err, setErr] = useState("");
  const [autoBlock, setAutoBlock] = useState(null);
  const [breakdown, setBreakdown] = useState({ coupon_cost: "150.00", tds: "50.00", direct_ref_bonus: "50.00" });
  const [redeemPoints, setRedeemPoints] = useState({ self: 0, refer: 0 });
  const [nextBlock, setNextBlock] = useState({ completed_in_current_block: "0.00", remaining_to_next_block: "1000.00", progress_percent: 0 });
  const [kyc, setKyc] = useState({ verified: false });
  const [windowInfo, setWindowInfo] = useState(computeWeeklyWindowLocal());
  const [primeInfo, setPrimeInfo] = useState({ has150: false, has750: false, hasMonthly: false, primeDate: null, monthlyDate: null });
  const [rewards, setRewards] = useState({ total: 0, redeemed: 0 });
  const [todayEarning, setTodayEarning] = useState(0);
  const [directRefIncome, setDirectRefIncome] = useState("0.00");
  const [matrixIncome, setMatrixIncome] = useState("0.00");
  const [globalTriIncome, setGlobalTriIncome] = useState("0.00");
  const [globalTurnoverIncome, setGlobalTurnoverIncome] = useState("0.00");
  const [withdrawalBenefit, setWithdrawalBenefit] = useState("0.00");
  const [directRefWithdrawCommission, setDirectRefWithdrawCommission] = useState("0.00");
  // Gross "all earnings" (without TDS) from backend totals; fallback to mainBalance if absent
  const [allEarningsGross, setAllEarningsGross] = useState("0.00");
  const [couponSummary, setCouponSummary] = useState({ selfActivated: 0, monthlyActivated: 0 });

  // Show Withdraw Wallet as Income minus 10% TDS (preview for UI display)
  const computedNetPreview = useMemo(() => {
    const gross = Number(mainBalance || 0);
    const tdsPct = 10; // fixed 10% TDS as per requirement
    const net = gross - (gross * tdsPct / 100);
    return net < 0 ? 0 : net;
  }, [mainBalance]);

  const computedRewardsRedeemed = useMemo(() => {
    // Spec clarified: Redeemed = Total Reward − All Earnings (without TDS)
    // Prefer backend-provided totals.allEarnings; fallback to gross mainBalance
    const total = Number(rewards.total || 0);
    const gross = Number(allEarningsGross || mainBalance || 0);
    const val = total - gross;
    return val > 0 ? val : 0;
  }, [rewards.total, allEarningsGross, mainBalance]);

  const blockMath = useMemo(() => {
    const blockSize = Number((autoBlock?.block_size ?? 1000));
    const coupon = Number(breakdown?.coupon_cost ?? 150);
    const tds = Number(breakdown?.tds ?? 50);
    const drb = Number(breakdown?.direct_ref_bonus ?? 50);
    const totalDeduction = coupon + tds + drb;
    const netPerBlock = Math.max(0, blockSize - totalDeduction);
    const appliedBlocks = Number(autoBlock?.applied_blocks ?? 0);
    const pendingBlocks = Number(autoBlock?.pending_blocks ?? 0);
    const creditedAmount = appliedBlocks * netPerBlock;
    const pendingCredit = pendingBlocks * netPerBlock;
    return { blockSize, coupon, tds, drb, totalDeduction, netPerBlock, appliedBlocks, pendingBlocks, creditedAmount, pendingCredit };
  }, [autoBlock, breakdown]);

  // Withdrawals
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [wdrErr, setWdrErr] = useState("");
  const [wdrSubmitting, setWdrSubmitting] = useState(false);
  const [wdrForm, setWdrForm] = useState({
    amount: "",
    method: "bank",
  });
  const onWdrChange = (e) => setWdrForm((f) => ({ ...f, [e.target.name]: e.target.value }));

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
    if (Number(withdrawableBalance) < 500) return "Minimum withdrawable balance ₹500 required";
    if (!windowInfo?.isOpen) return "Withdrawals are allowed only on Sunday 6:00 PM to 11:59 PM (IST)";
    if (inWindowCooldown) return "You have already requested a withdrawal in this week's window";
    return "";
  }, [kyc, withdrawableBalance, windowInfo, inWindowCooldown]);

  useEffect(() => {
    const id = setInterval(() => setWindowInfo(computeWeeklyWindowLocal()), 30000);
    return () => clearInterval(id);
  }, []);

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
        setBreakdown(w?.data?.breakdown_per_block || { coupon_cost: "150.00", tds: "50.00", direct_ref_bonus: "50.00" });
        setRedeemPoints(w?.data?.redeem_points || { self: 0, refer: 0 });
        setNextBlock(w?.data?.next_block || { completed_in_current_block: "0.00", remaining_to_next_block: "1000.00", progress_percent: 0 });
        setTodayEarning(Number(w?.data?.today?.earning ?? w?.data?.today_earning ?? 0));
        const inc = w?.data?.income || {};
        setDirectRefIncome(String(inc?.directReferral ?? w?.data?.direct_ref_income_total ?? "0.00"));
        setMatrixIncome(String(inc?.matrixFive ?? w?.data?.matrix_income_total ?? "0.00"));
        setGlobalTriIncome(String(inc?.matrixThree ?? w?.data?.global_tri_income_total ?? w?.data?.global_tri_income ?? "0.00"));
        setGlobalTurnoverIncome(String(inc?.globalTurnover ?? w?.data?.global_turnover_income_total ?? w?.data?.global_turnover_income ?? "0.00"));
        setWithdrawalBenefit(String(inc?.withdrawalBenefit ?? "0.00"));
        setDirectRefWithdrawCommission(String(inc?.directRefWithdrawCommission ?? "0.00"));
        // Capture "all earnings" gross (without TDS) if backend provides it
        setAllEarningsGross(String(w?.data?.totals?.allEarnings ?? mainBal ?? "0.00"));
        // Prefer coupon counts from wallet response when available
        const cpn = w?.data?.coupons || null;
        if (cpn) {
          setCouponSummary({
            selfActivated: Number(cpn?.selfActivated ?? 0),
            monthlyActivated: Number(cpn?.monthlyActivated ?? cpn?.monthlySelfBenefitActivated ?? 0),
          });
        }
        const wlist = Array.isArray(mw?.data) ? mw.data : mw?.data?.results || [];
        setMyWithdrawals(wlist || []);
        setKyc(kycRes?.data || { verified: false });
        setWindowInfo(computeWeeklyWindowLocal());
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
        const list = Array.isArray(res) ? res : (res?.results || []);
        const approved = (list || []).filter((pp) => String(pp?.status || "").toUpperCase() === "APPROVED");
        let has150 = false, has750 = false, hasMonthly = false;
        let primeDate = null, monthlyDate = null;
        for (const pp of approved) {
          const pkg = pp?.package || {};
          const type = String(pkg?.type || "");
          const name = String(pkg?.name || "").toLowerCase();
          const code = String(pkg?.code || "").toLowerCase();
          const price = Number(pkg?.price || 0);
          const dt = pp?.approved_at || pp?.created_at || pp?.updated_at || null;
          if (type === "MONTHLY") {
            hasMonthly = true;
            if (!monthlyDate) monthlyDate = dt;
          } else if (type === "PRIME") {
            if (Math.abs(price - 150) < 0.5 || name.includes("150") || code.includes("150")) has150 = true;
            if (Math.abs(price - 750) < 0.5 || name.includes("750") || code.includes("750")) has750 = true;
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
          rs?.current_points ?? rs?.total ?? rs?.total_points ?? rs?.points_total ?? rs?.summary?.total ?? 0
        );
        // Redeemed is computed in UI from incomes according to spec
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
        const selfActivated = Number(s?.self_activated ?? s?.self ?? s?.activated_self ?? 0);
        const monthlyActivated = Number(s?.monthly_activated ?? s?.monthly ?? s?.activated_monthly ?? 0);
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
    const perTxnCap = 750;
    const maxAvail = Math.min(Number(withdrawableBalance), perTxnCap);
    if (amtNum > maxAvail) {
      setWdrErr(`Max per request is ₹${fmtAmount(perTxnCap)}. Available to withdraw now: ₹${fmtAmount(maxAvail)}.`);
      return;
    }
    const payload = {
      amount: amtNum,
      method: "bank",
    };
    // Bank details are captured from KYC; not collected on this screen.
    try {
      setWdrSubmitting(true);
      await API.post("/accounts/withdrawals/", payload);
      // Refresh wallet and withdrawals after submitting
      const [w, mw] = await Promise.all([
        API.get("/accounts/wallet/me/"),
        API.get("/accounts/withdrawals/me/"),
      ]);
      const bal = String(w?.data?.balance ?? "0.00");
      const mainBal = String(w?.data?.main_balance ?? "0.00");
      const wdBal = String(w?.data?.withdrawable_balance ?? "0.00");
      const tax = String(w?.data?.tax_percent ?? "0");
      const upd = w?.data?.updated_at || null;
      const wlist = Array.isArray(mw?.data) ? mw.data : mw?.data?.results || [];
      setBalance(bal);
      setMainBalance(mainBal);
      setWithdrawableBalance(wdBal);
      setTaxPercent(tax);
      setUpdatedAt(upd);
      setMyWithdrawals(wlist || []);
      setAutoBlock(w?.data?.auto_block || null);
      setBreakdown(w?.data?.breakdown_per_block || { coupon_cost: "150.00", tds: "50.00", direct_ref_bonus: "50.00" });
      setRedeemPoints(w?.data?.redeem_points || { self: 0, refer: 0 });
      setNextBlock(w?.data?.next_block || { completed_in_current_block: "0.00", remaining_to_next_block: "1000.00", progress_percent: 0 });
      setWdrForm({
        amount: "",
        method: wdrForm.method,
      });
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (e?.response?.data ? JSON.stringify(e.response.data) : "Failed to submit withdrawal.");
      setWdrErr(String(msg));
    } finally {
      setWdrSubmitting(false);
    }
  }

  const StatCard = ({ title, value, hint, accent }) => {
    const accentMap = {
      "Prime Package Active": "#10b981",
      "Monthly Prime Active": "#06b6d4",
      "Total Reward Points": "#3b82f6",
      "Reward Redeemed Points": "#8b5cf6",
      "Today Earning": "#22c55e",
      "Spin and win coupon": "#f59e0b",
      "Direct Refer Commission": "#f472b6",
      "Matrix Level Income": "#6366f1",
      "Global TRI income": "#0ea5e9",
      "Global turnover income": "#84cc16",
      "Self coupon benefits (Activated coupon)": "#a78bfa",
      "Monthly self coupon benefits (Activated coupon)": "#fb7185",
      "Withdrawal Wallet": "#f59e0b",
      "Direct Refer Withdraw Commission": "#64748b",
    };
    const ac = accent || accentMap[title] || "#22c55e";
    const vignette = `radial-gradient(120% 80% at 10% 10%, ${alpha(ac, 0.22)} 0%, transparent 55%)`;
    return (
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
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(180deg, #121826 0%, #0B1220 100%)",
          borderColor: alpha(ac, 0.4),
          boxShadow: "0 6px 20px rgba(2,6,23,0.35)",
          "&:hover": {
            boxShadow: `0 14px 32px ${alpha(ac, 0.22)}`,
          },
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: vignette,
            pointerEvents: "none",
          },
        }}
      >
        <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.75) }}>{title}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5, color: "#fff" }}>{value}</Typography>
        {hint ? <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.75) }}>{hint}</Typography> : null}
      </Paper>
    );
  };

  const primeDateStr = primeInfo.primeDate ? new Date(primeInfo.primeDate).toLocaleDateString() : "-";
  const monthlyDateStr = primeInfo.monthlyDate ? new Date(primeInfo.monthlyDate).toLocaleDateString() : "-";

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}>
        Earning Wallet
      </Typography>

      {/* Earning summary grid - redesigned equal cards */}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          mb: 2,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
          alignItems: "stretch",
        }}
      >
        <StatCard
          title="Prime Package Active"
          value={(primeInfo.has150 || primeInfo.has750) ? "Active" : "Inactive"}
          hint={`Date: ${primeDateStr}`}
        />
        <StatCard
          title="Monthly Prime Active"
          value={primeInfo.hasMonthly ? "Active" : "Inactive"}
          hint={`Date: ${monthlyDateStr}`}
        />
        <StatCard
          title="Total Reward Points"
          value={`${Number(rewards.total || 0).toLocaleString()}`}
        />
        <StatCard
          title="Reward Redeemed Points"
          value={`${Number(computedRewardsRedeemed || 0).toLocaleString()}`}
        />
        <StatCard
          title="Today Earning"
          value={`₹ ${fmtAmount(todayEarning)}`}
        />
        <StatCard
          title="Spin and win coupon"
          value="—"
        />
        <StatCard
          title="Direct Refer Commission"
          value={`₹ ${fmtAmount(directRefIncome)}`}
        />
        <StatCard
          title="Matrix Level Income"
          value={`₹ ${fmtAmount(matrixIncome)}`}
        />
        <StatCard
          title="Global TRI income"
          value={`₹ ${fmtAmount(globalTriIncome)}`}
        />
        <StatCard
          title="Global turnover income"
          value={`₹ ${fmtAmount(globalTurnoverIncome)}`}
        />
        <StatCard
          title="Self coupon benefits (Activated coupon)"
          value={`${Number(couponSummary.selfActivated || 0)}`}
        />
        <StatCard
          title="Monthly self coupon benefits (Activated coupon)"
          value={`${Number(couponSummary.monthlyActivated || 0)}`}
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
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(180deg, #121826 0%, #0B1220 100%)",
            borderColor: alpha("#f97316", 0.4),
            boxShadow: "0 6px 20px rgba(2,6,23,0.35)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: 0,
              background: `radial-gradient(120% 80% at 10% 10%, ${alpha("#f97316", 0.22)} 0%, transparent 55%)`,
              pointerEvents: "none",
            },
          }}
        >
          <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.75) }}>Withdrawal Limit</Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <Box sx={{ flex: 1, p: 1, border: "1px dashed", borderColor: alpha("#FFFFFF", 0.2), borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.75) }}>Earn</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5, color: "#fff" }}>
                ₹ {fmtAmount(nextBlock?.completed_in_current_block || "0")}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, p: 1, border: "1px dashed", borderColor: alpha("#FFFFFF", 0.2), borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.75) }}>Limit</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5, color: "#fff" }}>
                ₹ 1000
              </Typography>
            </Box>
          </Stack>
        </Paper>
        <StatCard
          title="Withdrawal Wallet"
          value={`₹ ${fmtAmount(blockMath.netPerBlock)}`}
          hint="Net to Withdraw per ₹1000 block (auto-credited when limit reached)"
        />
        <StatCard
          title="Direct Refer Withdraw Commission"
          value={`₹ ${fmtAmount(directRefWithdrawCommission)}`}
        />
      </Box>

      {/* <Paper elevation={3} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
          Redeem Point Wallet
        </Typography>
        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Self</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{Number(redeemPoints?.self || 0)}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Refer</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{Number(redeemPoints?.refer || 0)}</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper> */}

      <Grid container spacing={{ xs: 2, sm: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 2,
              position: "relative",
              overflow: "hidden",
              background: "linear-gradient(180deg, #121826 0%, #0B1220 100%)",
              borderColor: alpha("#06b6d4", 0.4),
              boxShadow: "0 6px 20px rgba(2,6,23,0.35)",
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                background: `radial-gradient(120% 80% at 10% 10%, ${alpha("#06b6d4", 0.22)} 0%, transparent 55%)`,
                pointerEvents: "none",
              },
            }}
          >
            <Typography variant="subtitle2" sx={{ color: alpha("#FFFFFF", 0.75) }}>
              Income Wallet
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: "#fff" }}>
              ₹ {fmtAmount(mainBalance)}
            </Typography>
            {autoBlock ? (
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Number(nextBlock?.progress_percent || 0)}
                  sx={{ height: 6, bgcolor: alpha("#FFFFFF", 0.15), "& .MuiLinearProgress-bar": { backgroundColor: "#06b6d4" } }}
                />
                <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.75), display: "block", mt: 0.5 }}>
                  Completed in current ₹1000 block: ₹ {fmtAmount(nextBlock?.completed_in_current_block || "0")}
                  {" • "}Remaining: ₹ {fmtAmount(nextBlock?.remaining_to_next_block || "1000")}
                </Typography>
                <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.75), display: "block" }}>
                  Blocks applied: {autoBlock?.applied_blocks || 0} / {autoBlock?.total_blocks || 0} • Pending: {autoBlock?.pending_blocks || 0}
                </Typography>
                <Divider sx={{ my: 1, borderColor: alpha("#FFFFFF", 0.12) }} />
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: "#fff" }}>Per ₹1000 block deductions</Typography>
                <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
                  <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.8) }}>Self coupon: ₹{fmtAmount(breakdown?.coupon_cost || "150")}</Typography>
                  <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.8) }}>TDS: ₹{fmtAmount(breakdown?.tds || "50")}</Typography>
                  <Typography variant="caption" sx={{ color: alpha("#FFFFFF", 0.8) }}>Direct refer bonus: ₹{fmtAmount(breakdown?.direct_ref_bonus || "50")}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#fff" }}>
                    Net to Withdraw: ₹{fmtAmount(1000 - Number(breakdown?.coupon_cost || 0) - Number(breakdown?.tds || 0) - Number(breakdown?.direct_ref_bonus || 0))}
                  </Typography>
                </Stack>
              </Box>
            ) : null}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2, minHeight: 120 }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1 }}>
              Request Withdrawal
            </Typography>
            {wdrErr ? <Alert severity="error" sx={{ mb: 1 }}>{wdrErr}</Alert> : null}
            {!kyc?.verified ? (
              <Alert severity="error" sx={{ mb: 1 }}>
                KYC verification required to request withdrawal. Please complete KYC in the KYC section.
              </Alert>
            ) : null}
            {Number(withdrawableBalance) < 500 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Minimum withdrawable balance ₹500 required to enable withdrawals. Short by ₹{(Math.max(0, 500 - Number(withdrawableBalance))).toFixed(2)}
              </Alert>
            ) : null}
            {!windowInfo?.isOpen ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                Withdrawals open on Sunday between 6:00 PM and 11:59 PM (IST).{" "}
                Next window: {windowInfo?.nextWindowAt ? windowInfo.nextWindowAt.toLocaleString() : "-"}
              </Alert>
            ) : null}
            {inWindowCooldown ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                You have already requested a withdrawal in this week's window.
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
                  inputProps={{ inputMode: "decimal", max: Math.min(Number(withdrawableBalance || 0), 750), step: "0.01" }}
                  helperText={`Available this request: ₹ ${fmtAmount(Math.min(Number(withdrawableBalance || 0), 750))} (cap ₹750)`}
                  required
                />
                {/* Method fixed to Bank; UPI removed */}
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
                Withdrawals are debited only from your Withdrawable Wallet (Net). Bank details are captured in the KYC screen.
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
