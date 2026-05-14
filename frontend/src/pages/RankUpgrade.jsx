import React, { useEffect, useMemo, useState } from "react";
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
  Tooltip,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Drawer,
  TextField,
  IconButton,
  InputAdornment,
  Snackbar,
} from "@mui/material";
import {
  getRanks,
  getUpgradeEligibility,
  initiateUpgrade,
  createRankUpgradePayment,
  getEcouponStoreBootstrap,
  getMyLevelBonusProgress,
  getMyRankCommissionHolds,
  listMyPromoPurchases,
} from "../api/api";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import normalizeMediaUrl from "../utils/media";

/**
 * Rank Upgrade Screen
 * Route: /user/dashboard/upgrade
 *
 * Sections:
 * 1) Current Rank Card
 * 2) Next Rank Card
 * 3) Eligibility Status
 * 4) Upgrade Benefits (static hints)
 * 5) Payment Summary (GST breakdown, net to commission)
 * 6) Upgrade Button
 *
 * Commission logic reminder (UI-only):
 *  - GST 18% on payable amount
 *  - Net = amount - GST
 *  - 50% Direct (sponsor), 50% Level (up to 10 with pass-up)
 */

function ValueRow({ label, value, hint }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Stack direction="row" alignItems="center" spacing={1}>
        {hint ? (
          <Tooltip title={hint}>
            <Typography fontWeight={700}>{value}</Typography>
          </Tooltip>
        ) : (
          <Typography fontWeight={700}>{value}</Typography>
        )}
      </Stack>
    </Stack>
  );
}

function CommissionSplitView({ amount = 0, targetLevel = null }) {
  // amount = net (after GST)
  const direct = Math.max(0, Number(amount) * 0.5);
  const levelBonus = Math.max(0, Number(amount) * 0.5);
  return (
    <Box sx={{ p: 2, borderRadius: 1.5, border: "1px solid", borderColor: "divider", bgcolor: "grey.50" }}>
      <Typography fontWeight={800} fontSize={14} sx={{ mb: 1 }}>
        Commission Split (on Net)
      </Typography>
      <ValueRow label="Net to Commission" value={`₹${Number(amount).toFixed(2)}`} />
      <ValueRow label="Direct Sponsor (50%)" value={`₹${direct.toFixed(2)}`} />
      <Divider sx={{ my: 1 }} />
      <ValueRow label={`Level ${targetLevel ? `L${targetLevel}` : "-" } (50%)`} value={`₹${levelBonus.toFixed(2)}`} />
    </Box>
  );
}

function RankProgressStepper({ currentLevel = 1, nextLevel = null }) {
  const maxLevel = 10;
  const items = Array.from({ length: maxLevel }).map((_, i) => i + 1);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 0.5 }}>
      {items.map((lvl) => {
        const active = lvl <= Number(currentLevel || 0);
        const upcoming = nextLevel != null && lvl === Number(nextLevel || 0);
        return (
          <Box
            key={lvl}
            sx={{
              height: 8,
              borderRadius: 999,
              bgcolor: active ? "success.main" : upcoming ? "warning.main" : "divider",
            }}
            title={`L${lvl}`}
          />
        );
      })}
    </Box>
  );
}

function RankPaymentSheet({ open, onClose, data, onSuccess }) {
  const [txnId, setTxnId] = useState("");
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [payment, setPayment] = useState(null); // admin-configured UPI info
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

        {/* Summary */}
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

        {/* UPI Section */}
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
  // Optional UI-only label override (used by Digital Education Prime package wrapper)
  const labelOverride = (() => {
    try {
      return window.__tk_rank_upgrade_label_override || null;
    } catch {
      return null;
    }
  })();

  const screenTitle = labelOverride?.title || "Rank Upgrade";
  const rankWord = labelOverride?.rankWord || "Rank";

  const [ranks, setRanks] = useState([]);
  const [elig, setElig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [initDialog, setInitDialog] = useState(false);
  const [createdUpgrade, setCreatedUpgrade] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState("");
  const [selectedToRankId, setSelectedToRankId] = useState(null);
  const [selectedToRankName, setSelectedToRankName] = useState("");

  // Level Bonus progress + holds (consumer visibility)
  const [lbProgress, setLbProgress] = useState(null);
  const [lbHolds, setLbHolds] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  // Approved base purchase gate (to hide Rank-1 "Achieved" unless approved)
  const [hasApprovedBase, setHasApprovedBase] = useState(false);

  const amount = useMemo(() => Number(elig?.upgrade_amount || 0), [elig]);
  const gst = useMemo(() => Number((amount * 0.15).toFixed(2)), [amount]); // UI hint (backend computes authoritative)
  const net = useMemo(() => Math.max(0, amount - gst), [amount, gst]);

  // If user clicks Upgrade from the table, compute cumulative payable up to the selected rank
  const selectedRank = useMemo(() => {
    const r = (ranks || []).find((rr) => rr.id === selectedToRankId);
    return r || null;
  }, [ranks, selectedToRankId]);

  const selAmount = useMemo(() => {
    if (!selectedRank) return Number(amount || 0);
    const curLevel = Number(elig?.achieved_level || 0);
    const targetLevel = Number(selectedRank?.level_number || 0);
    if (!targetLevel || targetLevel <= curLevel) return 0;
    return (ranks || [])
      .filter((rr) => Number(rr.level_number || 0) > curLevel && Number(rr.level_number || 0) <= targetLevel)
      .reduce((sum, rr) => sum + Number(rr.upgrade_amount || 0), 0);
  }, [selectedRank, ranks, elig?.achieved_level, amount]);
  const selGst = useMemo(() => Number((selAmount * 0.15).toFixed(2)), [selAmount]);
  const selNet = useMemo(() => Math.max(0, selAmount - selGst), [selAmount, selGst]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const results = await Promise.allSettled([getRanks(), getUpgradeEligibility()]);
        if (!alive) return;
        const rkRes = results[0];
        const egRes = results[1];

        if (rkRes.status === "fulfilled") {
          setRanks(Array.isArray(rkRes.value) ? rkRes.value : []);
        } else if (!rkRes.reason?.__canceled) {
          setError(rkRes.reason?.response?.data?.detail || rkRes.reason?.message || "Failed to load rank data");
        }

        if (egRes.status === "fulfilled") {
          setElig(egRes.value || null);
        } else if (!egRes.reason?.__canceled) {
          setError(egRes.reason?.response?.data?.detail || egRes.reason?.message || "Failed to load rank data");
        }
      } catch (e) {
        // Safety net; with allSettled we generally won't reach here.
        if (!alive) return;
        if (!e?.__canceled) {
          setError(e?.response?.data?.detail || e?.message || "Failed to load rank data");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load Level Bonus progress + holds
  useEffect(() => {
    let alive = true;
    (async () => {
      setLbLoading(true);
      try {
        const [p, h] = await Promise.allSettled([getMyLevelBonusProgress(), getMyRankCommissionHolds()]);
        if (!alive) return;
        if (p.status === "fulfilled") setLbProgress(p.value || null);
        if (h.status === "fulfilled") setLbHolds(Array.isArray(h.value) ? h.value : []);
      } catch {}
      finally {
        if (alive) setLbLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load approved purchases to gate Rank-1 "Achieved"
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hist = await listMyPromoPurchases();
        if (!alive) return;
        const ok = Array.isArray(hist) && hist.some((h) => {
          const status = String(h?.status || "").toUpperCase();
          const type = String(h?.package?.type || "").toUpperCase();
          // Consider base "membership" purchases only (exclude MONTHLY promo boxes)
          return status === "APPROVED" && type !== "MONTHLY";
        });
        setHasApprovedBase(!!ok);
      } catch {
        if (alive) setHasApprovedBase(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const nextRankMeta = useMemo(() => {
    if (!elig?.next_rank) return null;
    const match = (ranks || []).find((r) => String(r.rank_name) === String(elig.next_rank));
    return match || null;
  }, [ranks, elig?.next_rank]);

  useEffect(() => {
    if (!defaultToRankId || !Array.isArray(ranks) || !ranks.length) return;
    const target = ranks.find((r) => String(r.id) === String(defaultToRankId));
    if (!target) return;
    setSelectedToRankId(target.id);
    setSelectedToRankName(target.rank_name || "");
  }, [defaultToRankId, ranks]);

  // Effective achieved level for UI gating:
  // If base purchase is not approved yet, keep user at level 0 so L1 stays buyable.
  const effectiveAchievedLevel = useMemo(() => {
    const apiLevel = Number(elig?.achieved_level || 0);
    if (!hasApprovedBase) return 0;
    return Math.max(0, apiLevel);
  }, [elig?.achieved_level, hasApprovedBase]);

  const canUpgrade = !!elig?.eligible && !!elig?.next_rank && Number(amount) > 0;

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography fontSize={18} fontWeight={900} sx={{ mb: 1 }}>
          {screenTitle}
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography fontSize={18} fontWeight={900} sx={{ mb: 1 }}>
        {screenTitle}
      </Typography>

      
      {/* Level Bonus Progress */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 1 }}>
          Level Bonus Progress
        </Typography>
        {lbLoading ? <LinearProgress sx={{ mb: 1 }} /> : null}
        {lbProgress ? (
          <Box>
            <ValueRow
              label="Rank-1 Directs Completed"
              value={`${Number(lbProgress?.completed_rank1_directs || 0)} / ${Number(lbProgress?.threshold || 5)}`}
            />
            <ValueRow
              label="Eligible Now"
              value={lbProgress?.eligible_now ? "Yes" : "No"}
            />
            <ValueRow
              label="Pending Holds Total"
              value={`₹${Number(lbProgress?.holds_summary?.pending_total_amount || 0).toFixed(2)}`}
            />
            {lbProgress?.holds_summary?.earliest_pending_release_date ? (
              <ValueRow
                label="Earliest Pending Release"
                value={`${lbProgress.holds_summary.earliest_pending_release_date} (${lbProgress.holds_summary.days_left_for_earliest ?? "-"} days)`}
              />
            ) : null}
          </Box>
        ) : (
          <Typography color="text.secondary">
            Level Bonus progress will appear here after you receive level commissions.
          </Typography>
        )}
      </Paper>

      {/* Rank Table (choose and buy) */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 1 }}>
          {rankWord} Upgrade Table
        </Typography>
        {/* Desktop/Tablet table */}
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Level</TableCell>
                <TableCell>Rank</TableCell>
                <TableCell align="right">Team</TableCell>
                <TableCell align="right">Upgrade Amount</TableCell>
                <TableCell align="center">Distribution</TableCell>
                <TableCell align="right">Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(ranks || []).map((r) => {
                const level = Number(r.level_number || 0);
                const achieved = effectiveAchievedLevel >= level;
                // Sequential unlock only: allow buying only the immediate next level
                const canBuy = level === effectiveAchievedLevel + 1;
                const statusLabel = achieved ? "Purchased" : canBuy ? "Available" : "Locked";
                const statusColor = achieved ? "success" : canBuy ? "info" : "default";
                return (
                  <TableRow key={r.id}>
                    <TableCell>{`L${r.level_number}`}</TableCell>
                    <TableCell>{r.rank_name}</TableCell>
                    <TableCell align="right">{Number(r.team_size_required || 0)}</TableCell>
                    <TableCell align="right">₹{Number(r.upgrade_amount || 0).toFixed(2)}</TableCell>
                    <TableCell align="center">50% Direct / 50% Level</TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={statusLabel} color={statusColor} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!canBuy}
                        onClick={() => {
                          setSelectedToRankId(r.id);
                          setSelectedToRankName(r.rank_name);
                          setInitDialog(true);
                        }}
                      >
                        {achieved ? "Purchased" : canBuy ? "BUY" : "Locked"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        {/* Mobile cards */}
        <Box sx={{ display: { xs: "block", sm: "none" } }}>
          {(ranks || []).map((r) => {
            const level = Number(r.level_number || 0);
            const achieved = effectiveAchievedLevel >= level;
            // Sequential unlock only: allow buying only the immediate next level
            const canBuy = level === effectiveAchievedLevel + 1;
            const statusLabel = achieved ? "Purchased" : canBuy ? "Available" : "Locked";
            const statusColor = achieved ? "success" : canBuy ? "info" : "default";
            return (
              <Paper key={r.id} variant="outlined" sx={{ p: 1.25, mb: 1, borderRadius: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography fontWeight={800}>
                    L{r.level_number} • {r.rank_name}
                  </Typography>
                  <Chip size="small" label={statusLabel} color={statusColor} />
                </Stack>
                <Stack spacing={0.25} sx={{ fontSize: 13 }}>
                  <Typography color="text.secondary">
                    Team: <b>{Number(r.team_size_required || 0)}</b>
                  </Typography>
                  <Typography color="text.secondary">
                    Upgrade: <b>₹{Number(r.upgrade_amount || 0).toFixed(2)}</b>
                  </Typography>
                  <Typography color="text.secondary">50% Direct / 50% Level</Typography>
                </Stack>
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={!canBuy}
                    onClick={() => {
                      setSelectedToRankId(r.id);
                      setSelectedToRankName(r.rank_name);
                      setInitDialog(true);
                    }}
                  >
                    {achieved ? "Purchased" : canBuy ? "BUY" : "Locked"}
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Box>
        <Alert severity="info" sx={{ mt: 1 }}>
          Rank upgrades are sequential. First buy L1, then L2, and so on. Only your immediate next level is enabled.
        </Alert>
      </Paper>

      {/* Upgrade Benefits */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 1 }}>
          Upgrade Benefits
        </Typography>
        <Box component="ul" sx={{ pl: 3, m: 0 }}>
          <li>
            <Typography fontSize={13}>Unlock commission distribution for higher levels.</Typography>
          </li>
          <li>
            <Typography fontSize={13}>Progress towards leadership ranks and rewards.</Typography>
          </li>
        </Box>
      </Paper>

      {/* Payment Summary */}
      {elig?.next_rank ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography fontWeight={800} sx={{ mb: 1 }}>
            Payment Summary
          </Typography>
          <Stack spacing={0.5}>
            <ValueRow label="Upgrade Amount (incl. GST)" value={`₹${Number(amount).toFixed(2)}`} />
            {/* <ValueRow label="GST (15%)" value={`₹${gst.toFixed(2)}`} />
            <ValueRow label="Net for Commission" value={`₹${net.toFixed(2)}`} hint="Used for 50/50 commission split" /> */}
          </Stack>

          <Divider sx={{ my: 1.5 }} />
          {/* <CommissionSplitView amount={net} targetLevel={elig?.level_number || null} /> */}

          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 2, height: 48, fontWeight: 800, textTransform: "none" }}
            disabled={!canUpgrade || busy}
            onClick={() => setInitDialog(true)}
          >
            {busy ? "Processing..." : `BUY ${elig?.next_rank}`}
          </Button>
        </Paper>
      ) : null}

      {/* Initiate confirmation (initiates upgrade and then shows success action) */}
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
                setPaymentOpen(true);
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

      {/* Payment Sheet for UPI/scanner flow */}
      <RankPaymentSheet
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        data={paymentData || (createdUpgrade ? { upgrade: createdUpgrade } : null)}
        onSuccess={async () => {
          setPaymentOpen(false);
          setSuccessOpen(true);
          // Refresh eligibility + Level Bonus progress/holds
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
        <DialogTitle>Payment Request Submitted</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            We will review it shortly.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSuccessOpen(false)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {error ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      ) : null}
    </Box>
  );
}
