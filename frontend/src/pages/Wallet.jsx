import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  Chip,
  Stack,
  LinearProgress,
} from "@mui/material";
import API from "../api/api";

function fmtAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2);
}

function Amount({ value }) {
  const num = Number(value || 0);
  const color = num >= 0 ? "success.main" : "error.main";
  const sign = num >= 0 ? "+" : "";
  return (
    <Typography component="span" sx={{ color, fontWeight: 600 }}>
      {sign}
      {fmtAmount(num)}
    </Typography>
  );
}

function TxTypeChip({ type }) {
  let color = "default";
  if (type === "COMMISSION_CREDIT" || (type || "").endsWith("_CREDIT")) color = "success";
  if ((type || "").endsWith("_DEBIT")) color = "warning";
  return <Chip size="small" color={color} label={type || "TX"} />;
}

export default function Wallet() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState("0.00");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [txs, setTxs] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        setLoading(true);
        setErr("");
        const [w, t] = await Promise.all([
          API.get("/accounts/wallet/me/"),
          API.get("/accounts/wallet/me/transactions/"),
        ]);
        if (!mounted) return;
        const bal = String(w?.data?.balance ?? "0.00");
        const upd = w?.data?.updated_at || null;
        const list = Array.isArray(t?.data) ? t.data : t?.data?.results || [];
        setBalance(bal);
        setUpdatedAt(upd);
        setTxs((list || []).slice(0, 100));
      } catch (e) {
        if (!mounted) return;
        setErr("Failed to load wallet. Please try again.");
        setTxs([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: "#0C2D48" }}>
        Wallet
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
              Current Balance
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>
              ₹ {fmtAmount(balance)}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "-"}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2, minHeight: 120 }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1 }}>
              Recent Activity
            </Typography>
            {loading ? (
              <LinearProgress />
            ) : err ? (
              <Typography variant="body2" color="error">
                {err}
              </Typography>
            ) : (txs || []).length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No transactions yet.
              </Typography>
            ) : (
              <Box>
                {(txs || []).map((tx) => (
                  <Box key={tx.id} sx={{ py: 1.2 }}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs={12} sm={5} md={4}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TxTypeChip type={tx.type} />
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {tx.source_type || "-"}
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid item xs={6} sm={3} md={3}>
                        <Typography variant="body2">
                          <Amount value={tx.amount} />
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={4} md={3}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Bal: ₹ {fmtAmount(tx.balance_after)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}
                        </Typography>
                      </Grid>
                    </Grid>
                    {tx.meta ? (
                      <Typography variant="caption" sx={{ color: "text.disabled" }}>
                        {(() => {
                          try {
                            return JSON.stringify(tx.meta);
                          } catch {
                            return String(tx.meta);
                          }
                        })()}
                      </Typography>
                    ) : null}
                    <Divider sx={{ mt: 1.2 }} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
