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
  TextField,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import {
  getRanks,
  adminListRankUpgrades,
  adminGetUpgradeCommissions,
  adminListRankCommissionHolds,
  adminApproveRankUpgrade,
  adminRejectRankUpgrade,
} from "../../api/api";

function ValueRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography fontWeight={700}>{value}</Typography>
    </Stack>
  );
}

function UpgradeRow({ u, onViewCommissions, onApprove, onReject }) {
  const badgeColor =
    u.payment_status === "SUCCESS"
      ? "success"
      : u.payment_status === "INITIATED"
      ? "warning"
      : "default";

  const sponsorTr = u.sponsor_username
    ? `TR ${u.sponsor_username}`
    : "-";

  const levelTr = u.level_owner_username
    ? `TR ${u.level_owner_username}`
    : "-";

  const sponsorReleased = Number(
    u.sponsor_released || 0
  );
  const sponsorHeld = Number(u.sponsor_held || 0);
  const levelReleased = Number(
    u.level_released || 0
  );
  const levelHeld = Number(u.level_held || 0);

  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        py: 1.25,
      }}
    >
      {/* ---------------- MOBILE LAYOUT ---------------- */}
      <Box sx={{ display: { xs: "block", sm: "none" } }}>
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
        >
          <Typography fontWeight={800}>
            {u.user_username ||
              u.user ||
              `#${u.user_id || "-"}`}
          </Typography>

          <Chip
            size="small"
            color={badgeColor}
            label={u.payment_status}
          />
        </Stack>

        {/* Rank */}
        <Typography
          variant="caption"
          color="text.secondary"
        >
          {u.from_rank_name || "-"} →{" "}
          {u.to_rank_name || "-"}
        </Typography>

        {/* Financial Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            mt: 1,
          }}
        >
          <ValueRow
            label="Amount"
            value={`₹${Number(
              u.upgrade_amount || 0
            ).toFixed(2)}`}
          />
          <ValueRow
            label="Net"
            value={`₹${Number(
              u.net_amount || 0
            ).toFixed(2)}`}
          />
          <ValueRow
            label="GST"
            value={`₹${Number(
              u.gst_amount || 0
            ).toFixed(2)}`}
          />
          <ValueRow
            label="Hold"
            value={`₹${(
              sponsorHeld + levelHeld
            ).toFixed(2)}`}
          />
        </Box>

        {/* Commission summary */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          Sponsor ₹{sponsorReleased.toFixed(
            2
          )} • Level ₹{levelReleased.toFixed(2)}
        </Typography>

        {/* Actions */}
        <Stack
          direction="column"
          spacing={1}
          sx={{ mt: 1 }}
          flexWrap="wrap"
        >
          {u.payment_status ===
          "INITIATED" ? (
            <>
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => onApprove(u)}
              >
                Approve
              </Button>

              <Button
                size="small"
                variant="outlined"
                color="error"
                sx={{ m: 1 }}
                onClick={() => onReject(u)}
              >
                Reject
              </Button>
            </>
          ) : null}

          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              onViewCommissions(u)
            }
          >
            Commissions
          </Button>
        </Stack>
      </Box>

      {/* ---------------- DESKTOP LAYOUT (UNCHANGED) ---------------- */}
      <Box
        sx={{
          display: {
            xs: "none",
            sm: "grid",
          },
          gridTemplateColumns:
            "1fr auto auto auto auto auto auto auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Box>
          <Typography fontWeight={800}>
            {u.user_username ||
              u.user ||
              `#${u.user_id || "-"}`}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
          >
            {u.from_rank_name || "-"} →{" "}
            {u.to_rank_name || "-"}
          </Typography>
        </Box>

        <Typography textAlign="right">
          ₹
          {Number(
            u.upgrade_amount || 0
          ).toFixed(2)}
        </Typography>

        <Typography textAlign="right">
          ₹
          {Number(
            u.gst_amount || 0
          ).toFixed(2)}
        </Typography>

        <Typography textAlign="right">
          ₹
          {Number(
            u.net_amount || 0
          ).toFixed(2)}
        </Typography>

        <Typography textAlign="right">
          {sponsorTr} • Rel ₹
          {sponsorReleased.toFixed(2)} •
          Hold ₹{sponsorHeld.toFixed(2)}
        </Typography>

        <Typography textAlign="right">
          {levelTr} • L
          {u.level_index || "-"} • Rel ₹
          {levelReleased.toFixed(2)} •
          Hold ₹{levelHeld.toFixed(2)}
        </Typography>

        <Typography textAlign="right">
          {u.latest_payment_utr ? `UTR ${u.latest_payment_utr}` : "-"}
          {u.latest_payment_proof ? <> · <a href={u.latest_payment_proof} target="_blank" rel="noreferrer">Proof</a></> : null}
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
        >
          <Chip
            size="small"
            color={badgeColor}
            label={u.payment_status}
          />

          {u.payment_status ===
          "INITIATED" ? (
            <>
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => onApprove(u)}
              >
                Approve
              </Button>

              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => onReject(u)}
              >
                Reject
              </Button>
            </>
          ) : null}

          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              onViewCommissions(u)
            }
          >
            Commissions
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}


export default function AdminRankUpgrades() {
  const [ranks, setRanks] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [fUserId, setFUserId] = useState("");
  const [fToRank, setFToRank] = useState("");
  const [fFromRank, setFFromRank] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [holds, setHolds] = useState([]);
  const [loadingComms, setLoadingComms] = useState(false);

  // Admin actions (approve/reject)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveBusy, setApproveBusy] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [selectedForAction, setSelectedForAction] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rk = await getRanks();
        if (alive) setRanks(Array.isArray(rk) ? rk : []);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fetchList = async () => {
    setLoading(true);
    setErr("");
    try {
      const params = {};
      if (String(fUserId).trim() !== "") params.user_id = fUserId;
      if (String(fToRank).trim() !== "") params.to_rank = fToRank;
      if (String(fFromRank).trim() !== "") params.from_rank = fFromRank;
      if (String(fStatus).trim() !== "") params.status = fStatus;
      const data = await adminListRankUpgrades(params);
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to fetch upgrades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const openCommissions = async (u) => {
    setSelectedUpgrade(u);
    setCommDialogOpen(true);
    setCommissions([]);
    setHolds([]);
    setLoadingComms(true);
    try {
      const [cs, hs] = await Promise.all([
        adminGetUpgradeCommissions(u.id),
        adminListRankCommissionHolds({ upgrade_id: u.id }),
      ]);
      setCommissions(Array.isArray(cs) ? cs : []);
      setHolds(Array.isArray(hs) ? hs : []);
    } catch (e) {
      // ignore, surface below
    } finally {
      setLoadingComms(false);
    }
  };

  const openApprove = (u) => {
    setSelectedForAction(u);
    setApproveDialogOpen(true);
  };

  const openReject = (u) => {
    setSelectedForAction(u);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const doApprove = async () => {
    if (!selectedForAction) return;
    setApproveBusy(true);
    setErr("");
    try {
      await adminApproveRankUpgrade(selectedForAction.id);
      setApproveDialogOpen(false);
      setSelectedForAction(null);
      await fetchList();
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to approve upgrade");
    } finally {
      setApproveBusy(false);
    }
  };

  const doReject = async () => {
    if (!selectedForAction) return;
    setRejectBusy(true);
    setErr("");
    try {
      await adminRejectRankUpgrade(selectedForAction.id, rejectReason || "");
      setRejectDialogOpen(false);
      setSelectedForAction(null);
      setRejectReason("");
      await fetchList();
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to reject upgrade");
    } finally {
      setRejectBusy(false);
    }
  };

  const statusOptions = [
    { key: "", label: "All" },
    { key: "INITIATED", label: "Initiated" },
    { key: "SUCCESS", label: "Success" },
    { key: "FAILED", label: "Failed" },
    { key: "CANCELLED", label: "Cancelled" },
  ];

  const rankOptions = useMemo(
    () => [{ id: "", rank_name: "All Ranks" }, ...ranks],
    [ranks]
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography fontWeight={900} fontSize={18} sx={{ mb: 1 }}>
        Rank Upgrades
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Divider sx={{ my: 1.5 }} />

        {loading ? <LinearProgress /> : null}
        {err ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {err}
          </Alert>
        ) : null}

        <Box sx={{ mt: 1 }}>
          <Box
            sx={{
              display: { xs: "none", sm: "grid" },
              gridTemplateColumns: { sm: "1fr auto auto auto auto auto auto auto" },
              gap: { sm: 12 },
              alignItems: "center",
              borderBottom: "1px solid",
              borderColor: "divider",
              py: 1,
              fontWeight: 800,
              color: "text.secondary",
              fontSize: 13,
            }}
          >
            <Box>User</Box>
            <Box sx={{ textAlign: "right" }}>Amount</Box>
            <Box sx={{ textAlign: "right" }}>GST</Box>
            <Box sx={{ textAlign: "right" }}>Net</Box>
            <Box sx={{ textAlign: "right" }}>Sponsor</Box>
            <Box sx={{ textAlign: "right" }}>Level Owner</Box>
            <Box sx={{ textAlign: "right" }}>Payment</Box>
            <Box sx={{ textAlign: "right" }}>Status</Box>
          </Box>

          {list.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No upgrades found.
            </Typography>
          ) : (
            list.map((u) => (
              <UpgradeRow
                key={u.id}
                u={u}
                onViewCommissions={openCommissions}
                onApprove={openApprove}
                onReject={openReject}
              />
            ))
          )}
        </Box>
      </Paper>

      {/* Approve dialog */}
      <Dialog open={approveDialogOpen} onClose={() => !approveBusy && setApproveDialogOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <DialogTitle>Approve Upgrade</DialogTitle>
        <DialogContent dividers>
          {!selectedForAction ? null : (
            <Box sx={{ mb: 1 }}>
              <Typography fontWeight={700}>
                {selectedForAction?.user_username || selectedForAction?.user || `#${selectedForAction?.user_id || "-"}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedForAction?.from_rank_name || "-"} → {selectedForAction?.to_rank_name || "-"} &nbsp; • &nbsp; ₹
                {Number(selectedForAction?.net_amount || 0).toFixed(2)} net
              </Typography>
            </Box>
          )}
          <Alert severity="warning">
            This will mark the upgrade as SUCCESS and distribute commissions. Continue?
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)} disabled={approveBusy}>Cancel</Button>
          <Button variant="contained" color="success" onClick={doApprove} disabled={approveBusy}>
            {approveBusy ? "Approving..." : "Approve"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => !rejectBusy && setRejectDialogOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <DialogTitle>Reject Upgrade</DialogTitle>
        <DialogContent dividers>
          {!selectedForAction ? null : (
            <Box sx={{ mb: 1 }}>
              <Typography fontWeight={700}>
                {selectedForAction?.user_username || selectedForAction?.user || `#${selectedForAction?.user_id || "-"}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedForAction?.from_rank_name || "-"} → {selectedForAction?.to_rank_name || "-"}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            size="small"
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            multiline
            minRows={2}
          />
          <Alert severity="info" sx={{ mt: 1 }}>
            This will mark the upgrade as CANCELLED. No commissions will be sent.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={rejectBusy}>Close</Button>
          <Button variant="outlined" color="error" onClick={doReject} disabled={rejectBusy}>
            {rejectBusy ? "Rejecting..." : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={commDialogOpen} onClose={() => setCommDialogOpen(false)} fullWidth maxWidth="md" fullScreen={fullScreen}>
        <DialogTitle>
          Upgrade Commissions
          <IconButton
            size="small"
            onClick={() => setCommDialogOpen(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {!selectedUpgrade ? null : (
            <Box sx={{ mb: 1 }}>
              <Typography fontWeight={700}>
                {selectedUpgrade?.user_username || selectedUpgrade?.user || `#${selectedUpgrade?.user_id || "-"}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedUpgrade?.from_rank_name || "-"} → {selectedUpgrade?.to_rank_name || "-"} &nbsp; • &nbsp;{" "}
                ₹{Number(selectedUpgrade?.net_amount || 0).toFixed(2)} net
              </Typography>
            </Box>
          )}

          {loadingComms ? <LinearProgress sx={{ mb: 2 }} /> : null}

          {selectedUpgrade ? (
            <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.5, mb: 2 }}>
              <Typography fontWeight={800} sx={{ mb: 0.5 }}>
                Summary
              </Typography>
              <ValueRow
                label="Sponsor"
                value={`TR ${selectedUpgrade?.sponsor_username || "-"} • Rel ₹${Number(selectedUpgrade?.sponsor_released || 0).toFixed(2)} • Hold ₹${Number(selectedUpgrade?.sponsor_held || 0).toFixed(2)}`}
              />
              <ValueRow
                label={`Level Owner${selectedUpgrade?.level_index ? ` (L${selectedUpgrade.level_index})` : ""}`}
                value={`TR ${selectedUpgrade?.level_owner_username || "-"} • Rel ₹${Number(selectedUpgrade?.level_released || 0).toFixed(2)} • Hold ₹${Number(selectedUpgrade?.level_held || 0).toFixed(2)}`}
              />
            </Paper>
          ) : null}

          <Typography fontWeight={800} sx={{ mt: 1 }}>
            Commission Rows
          </Typography>
          {commissions.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              No commission rows.
            </Typography>
          ) : (
            <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.5, mb: 2 }}>
              {commissions.map((c) => (
                <Box
                  key={c.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "80px 1fr 120px 120px 120px" },
                    gap: 8,
                    alignItems: "center",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    py: 0.75,
                  }}
                >
                  <Chip size="small" label={c.commission_type || "-"} />
                  <Typography sx={{ minWidth: 0 }} title={`To: TR ${c.to_user_username || "-"}`}>
                    To: TR {c.to_user_username || "-"}
                  </Typography>
                  <Typography sx={{ textAlign: "right" }}>L{c.level}</Typography>
                  <Typography sx={{ textAlign: "right" }}>₹{Number(c.commission_amount || 0).toFixed(2)}</Typography>
                  <Typography sx={{ textAlign: "right" }}>
                    <Chip size="small" label={c.status} color={c.status === "CREDITED" ? "success" : c.status === "HELD" ? "warning" : "default"} />
                  </Typography>
                </Box>
              ))}
            </Paper>
          )}

          <Typography fontWeight={800} sx={{ mt: 1 }}>
            Holds (Pending/Released/Forfeited)
          </Typography>
          {holds.length === 0 ? (
            <Typography color="text.secondary">No holds.</Typography>
          ) : (
            <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}>
              {holds.map((h) => (
                <Box
                  key={h.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 140px 160px 120px" },
                    gap: 8,
                    alignItems: "center",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    py: 0.75,
                  }}
                >
                  <Typography sx={{ minWidth: 0 }} noWrap title={`Commission#${h.commission || h.commission_id}`}>
                    Comm #{h.commission || h.commission_id}
                  </Typography>
                  <Typography sx={{ textAlign: "right" }}>₹{Number(h.hold_amount || 0).toFixed(2)}</Typography>
                  <Typography sx={{ textAlign: "right" }}>{h.release_date}</Typography>
                  <Typography sx={{ textAlign: "right" }}>
                    <Chip
                      size="small"
                      label={h.status}
                      color={
                        h.status === "PENDING" ? "warning" : h.status === "RELEASED" ? "success" : h.status === "FORFEITED" ? "default" : "default"
                      }
                    />
                  </Typography>
                </Box>
              ))}
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
