import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
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
import API from "../../api/api";

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

export default function WalletDashboardV2({ showTable = true }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [walletHistory, setWalletHistory] = useState(null);
  const [eligibility, setEligibility] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [histRes, eligRes] = await Promise.allSettled([
          API.get("/accounts/wallet/me/history/"),
          API.get("/mlm/ranks/eligibility/"),
        ]);
        if (histRes.status === "fulfilled") {
          setWalletHistory(histRes.value?.data || {});
        }
        if (eligRes.status === "fulfilled") {
          setEligibility(eligRes.value?.data || {});
        }
      } catch (err) {
        setError(err?.response?.data?.detail || "Failed to load wallet dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute dynamic stats
  const savedRoyaltyConfig = useMemo(() => {
    try {
      const raw = localStorage.getItem("tri_royalty_config");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const achievedLevel = Number(
    eligibility?.achieved_level ?? walletHistory?.current_level ?? 1
  );
  const currentLevel = Math.max(1, achievedLevel);

  const tierInfo = useMemo(() => {
    return (
      RANK_TIERS.find((t) => t.level === currentLevel) || {
        limit: 1750,
        name: `Level ${currentLevel}`,
      }
    );
  }, [currentLevel]);

  const currentLimit = Number(
    walletHistory?.current_limit || tierInfo.limit || 1750
  );

  const layerMatrixEarned = useMemo(() => {
    const fromApi = Number(
      walletHistory?.layer_matrix_earned ||
        walletHistory?.income?.matrixLevel ||
        walletHistory?.income?.matrixFive ||
        walletHistory?.top?.level_earnings_total ||
        0
    );
    if (fromApi > 0) return fromApi;

    // Fallback: scan main_wallet and incoming
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

  const royaltyShopping = Number(
    walletHistory?.income?.globalTri ||
      walletHistory?.income?.globalTurnover ||
      walletHistory?.royalty_shopping ||
      0
  );

  const layerMatrixEligible = Number(
    walletHistory?.layer_matrix_eligible || Math.max(100000, currentLevel * 10000)
  );

  const missingIncome = Number(
    walletHistory?.missing_income ||
      (isLimitReached ? Math.max(0, totalEarnings - currentLimit) : 0)
  );

  const layerMatrixPercent =
    layerMatrixEligible > 0
      ? Math.min(100, (layerMatrixEarned / layerMatrixEligible) * 100)
      : 0;

  return (
    <Container maxWidth="md" sx={{ py: 2, px: { xs: 1, sm: 2 } }}>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Top Bar Indicators */}
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, mb: 2, bgcolor: "#fafafa" }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ShieldRoundedIcon color="primary" />
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                  Current Level
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#1e1b4b" }}>
                  Level {currentLevel}{" "}
                  <Chip
                    label="Eligible"
                    size="small"
                    color="primary"
                    sx={{ height: 18, fontSize: 10, fontWeight: 800 }}
                  />
                </Typography>
              </Box>
            </Stack>
          </Grid>

          <Grid item xs={4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTimeRoundedIcon color="warning" />
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                  Upgrade Window
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#d97706" }}>
                  7 Days Window{" "}
                  <Typography component="span" sx={{ fontSize: 10, color: "#92400e" }}>
                    (Sequential)
                  </Typography>
                </Typography>
              </Box>
            </Stack>
          </Grid>

          <Grid item xs={4}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TrendingUpRoundedIcon color="success" />
              <Box>
                <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                  Next Level
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#15803d" }}>
                  Level {currentLevel < 10 ? currentLevel + 1 : 10}
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Total Earnings & Limit Halt Banner */}
      <Card sx={{ bgcolor: "#1e1b4b", color: "#fff", borderRadius: 3, mb: 2, boxShadow: 4 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={7}>
              <Typography
                sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, opacity: 0.8, mb: 0.5 }}
              >
                TOTAL EARNINGS ⓘ
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 1 }}>
                ₹{fmt(totalEarnings)}{" "}
                <Typography component="span" sx={{ fontSize: 16, opacity: 0.7 }}>
                  / ₹{fmt(currentLimit)}
                </Typography>
              </Typography>
              <LinearProgress
                variant="determinate"
                value={percentUsed}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: "rgba(255,255,255,0.2)",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: isLimitReached ? "#ef4444" : "#f59e0b",
                  },
                }}
              />
              <Typography sx={{ fontSize: 12, mt: 0.8, opacity: 0.85 }}>
                {isLimitReached
                  ? `Earning Limit Reached for Level ${currentLevel} ⓘ`
                  : `Earning Limit Progress (${percentUsed.toFixed(0)}%) ⓘ`}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={5}>
              <Paper
                sx={{
                  p: 1.8,
                  bgcolor: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(6px)",
                  borderRadius: 2.5,
                  color: "#fff",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AccountBalanceWalletRoundedIcon
                    sx={{ color: isLimitReached ? "#ef4444" : "#22c55e" }}
                  />
                  <Box>
                    <Typography sx={{ fontSize: 10, opacity: 0.8, fontWeight: 700 }}>
                      WALLET STATUS
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 900,
                        color: isLimitReached ? "#ef4444" : "#22c55e",
                      }}
                    >
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
                  sx={{
                    bgcolor: "#ffffff",
                    color: "#1e1b4b",
                    fontWeight: 900,
                    "&:hover": { bgcolor: "#f3f4f6" },
                  }}
                  onClick={() => navigate("/user/rank-upgrade")}
                >
                  Upgrade Now
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Earning Limit Level Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
              EARNING LIMIT (LEVEL {currentLevel})
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0f172a", my: 0.5 }}>
              ₹{fmt(currentLimit)}
            </Typography>
            {isLimitReached ? (
              <Chip
                icon={<CheckCircleRoundedIcon />}
                label="Completed"
                color="success"
                size="small"
                sx={{ fontWeight: 800 }}
              />
            ) : (
              <Chip
                label="In Progress"
                color="info"
                size="small"
                sx={{ fontWeight: 800 }}
              />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
              EARNING LIMIT (LEVEL 10)
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0f172a", my: 0.5 }}>
              ₹1,50,000
            </Typography>
            {currentLevel >= 10 && isLimitReached ? (
              <Chip
                icon={<CheckCircleRoundedIcon />}
                label="Completed"
                color="success"
                size="small"
                sx={{ fontWeight: 800 }}
              />
            ) : (
              <Chip
                icon={<CancelRoundedIcon />}
                label="Not Completed"
                color="error"
                size="small"
                sx={{ fontWeight: 800 }}
              />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
              NEXT CYCLE
            </Typography>
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 900,
                color: isLimitReached ? "#d97706" : "#15803d",
                my: 0.5,
              }}
            >
              {isLimitReached ? "Re-Top Up Required" : "Active"}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#94a3b8" }}>
              (Same Benefits Continue)
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Royalty vs Layer Matrix Breakdown Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <ShoppingBagRoundedIcon color="success" />
                <Typography sx={{ fontWeight: 900, fontSize: 13, color: "#15803d" }}>
                  ROYALTY INCOME (SHOPPING) ⓘ
                </Typography>
              </Stack>
              <Chip
                label={`₹${fmt(royaltyShopping)}`}
                color="success"
                size="small"
                sx={{ fontWeight: 900 }}
              />
            </Stack>

            <Divider sx={{ my: 1 }} />
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 12, color: "#475569" }}>
                  {savedRoyaltyConfig?.tier1_levels || "LEVEL 1 TO LEVEL 7"} ({savedRoyaltyConfig?.tier1_percent ?? 3}% ₹{fmt(savedRoyaltyConfig?.tier1_cap ?? 10000)})
                </Typography>
                {currentLevel >= 7 ? (
                  <Chip
                    icon={<CheckCircleRoundedIcon />}
                    label="Completed"
                    color="success"
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Chip label="Pending" color="default" variant="outlined" size="small" />
                )}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 12, color: "#475569" }}>
                  {savedRoyaltyConfig?.tier2_levels || "LEVEL 10 TO LEVEL 10"} ({savedRoyaltyConfig?.tier2_percent ?? 7}% ₹{fmt(savedRoyaltyConfig?.tier2_cap ?? 40000)})
                </Typography>
                {currentLevel >= 10 ? (
                  <Chip
                    icon={<CheckCircleRoundedIcon />}
                    label="Completed"
                    color="success"
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Chip label="Pending" color="default" variant="outlined" size="small" />
                )}
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <LayersRoundedIcon color="primary" />
                <Typography sx={{ fontWeight: 900, fontSize: 13, color: "#0369a1" }}>
                  LAYER MATRIX EARNINGS ⓘ
                </Typography>
              </Stack>
              <Chip
                label={`Eligible ₹${fmt(layerMatrixEligible)}`}
                color="primary"
                size="small"
                sx={{ fontWeight: 900 }}
              />
            </Stack>

            <Divider sx={{ my: 1 }} />
            <Typography sx={{ fontSize: 12, color: "#64748b", mb: 0.5 }}>
              FROM LAYER MATRIX (All Slabs)
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#0f172a", mb: 0.5 }}>
              ₹{fmt(layerMatrixEarned)}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={layerMatrixPercent}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Missing Income Alert */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          borderRadius: 2.5,
          mb: 2,
          bgcolor: "#fff7ed",
          borderColor: "#fdba74",
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <HourglassEmptyRoundedIcon color="warning" />
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 13, color: "#c2410c" }}>
                MISSING INCOME ⓘ
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#9a3412" }}>
                Income generated after limit reached will be shown here.
              </Typography>
            </Box>
          </Stack>
          <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#c2410c" }}>
            ₹{fmt(missingIncome)}
          </Typography>
        </Stack>
      </Paper>

      {/* Rank Upgrade Level Table */}
      {showTable ? (
        <>
          <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, color: "#0f172a" }}>
            Digital Education Rank Upgrade Levels (1 - 10)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#1e1b4b" }}>
                <TableRow>
                  <TableCell sx={{ color: "#fff", fontWeight: 800 }}>Level</TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 800 }}>
                    Upgrade Amount (₹)
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 800 }}>
                    Earning Limit (₹)
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 800 }}>
                    Team Count ⓘ
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 800, textAlign: "center" }}>
                    Limit Status
                  </TableCell>
                  <TableCell sx={{ color: "#fff", fontWeight: 800, textAlign: "right" }}>
                    Next Rank Upgrade
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {RANK_TIERS.map((row) => {
                  const isCurrent = row.level === currentLevel;
                  const isPast = row.level < currentLevel;
                  return (
                    <TableRow
                      key={row.level}
                      sx={{
                        bgcolor: isCurrent ? "#f0fdf4" : "inherit",
                        "&:hover": { bgcolor: "#f8fafc" },
                      }}
                    >
                      <TableCell sx={{ fontWeight: isCurrent ? 900 : 700 }}>
                        {row.name}
                      </TableCell>
                      <TableCell>{fmt(row.upgradeAmt)}</TableCell>
                      <TableCell>{fmt(row.limit)}</TableCell>
                      <TableCell>
                        {row.teamCount !== "-" ? `👥 ${row.teamCount}` : "-"}
                      </TableCell>
                      <TableCell align="center">
                        {isCurrent ? (
                          isLimitReached ? (
                            <Chip
                              label="Limit Reached"
                              color="error"
                              size="small"
                              sx={{ fontWeight: 800, bgcolor: "#ef4444", color: "#fff" }}
                            />
                          ) : (
                            <Chip
                              label="Active"
                              color="info"
                              size="small"
                              sx={{ fontWeight: 800 }}
                            />
                          )
                        ) : isPast ? (
                          <Chip
                            label="Completed"
                            color="success"
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        ) : (
                          <Typography fontSize={13} color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {isPast ? (
                          <Chip
                            label="Purchased"
                            color="success"
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 700 }}
                          />
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={row.level > currentLevel + 1 && !isPast}
                            onClick={() => navigate("/user/rank-upgrade")}
                            sx={{ fontWeight: 800 }}
                          >
                            Upgrade
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}
    </Container>
  );
}
