import React, { useEffect, useMemo, useState } from "react";
import GenealogyTree5 from "../../components/GenealogyTree5";
import API from "../../api/api";
import { adminGetMatrixCommissionConfig } from "../../api/api";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";

function StatCard({ title, value, subtitle }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h5" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Genealogy5() {
  // Data and config from MyTeam (5‑Matrix-specific)
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [levels, setLevels] = useState({ five: 10, three: 15 });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await adminGetMatrixCommissionConfig();
        if (!mounted) return;
        const five = Number(cfg?.five_matrix_levels) || 10;
        const three = Number(cfg?.three_matrix_levels) || 15;
        setLevels({ five, three });
      } catch (_) {
        // keep defaults or server-provided fallbacks
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const role = useMemo(() => {
    try {
      return (
        localStorage.getItem("role") ||
        sessionStorage.getItem("role") ||
        localStorage.getItem("role_user") ||
        sessionStorage.getItem("role_user") ||
        ""
      );
    } catch {
      return "";
    }
  }, []);
  const isUser = String(role).toLowerCase() === "user";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/accounts/team/summary/", {
          cacheTTL: 10000,
          retryAttempts: 2,
        });
        if (!mounted) return;
        setData(res?.data || {});
        setErr("");
      } catch (e) {
        if (!mounted) return;
        setErr("Failed to load team summary.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Extract 5‑matrix progress only
  const fiveProgress = useMemo(() => {
    const arr = Array.isArray(data?.matrix_progress) ? data.matrix_progress : [];
    return arr.find((p) => String(p?.pool_type).toUpperCase() === "FIVE_150") || null;
  }, [data]);

  const fiveLevelRows = useMemo(() => {
    const plc = fiveProgress?.per_level_counts || {};
    const keys = Object.keys(plc)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    return keys.map((lvl) => ({
      level: lvl,
      count: Math.max(0, parseInt(plc[String(lvl)] || 0, 10) || 0),
    }));
  }, [fiveProgress]);

  const directCount = useMemo(() => {
    try {
      const down = data?.downline || {};
      const lvls = down?.levels || {};
      const l1 = typeof lvls?.l1 === "number" ? lvls.l1 : 0;
      const direct = typeof down?.direct === "number" ? down.direct : l1;
      return Math.max(0, direct || 0);
    } catch {
      return 0;
    }
  }, [data]);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Genealogy (5‑Matrix)</div>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          View your 5‑Matrix team. Click a member to drill down; use the breadcrumb to navigate back.
        </div>
        {role ? <Chip size="small" label={`Role: ${role}`} sx={{ mt: 1 }} /> : null}
      </div>

      {err ? (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {err}
        </Typography>
      ) : null}

      {/* 5 Matrix Accounts Summary (merged from MyTeam.jsx) */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2} sx={{ mb: 1 }}>
          <Grid item xs={12} md={4}>
            <StatCard
              title="Direct Referrals"
              value={String(directCount)}
              subtitle="Total direct team members"
            />
          </Grid>
          <Grid item xs={6} md={4}>
            <StatCard
              title="5 Matrix Level Reached"
              value={String(fiveProgress?.level_reached ?? 0)}
            />
          </Grid>
          {/* <Grid item xs={6} md={4}>
            <StatCard
              title="5 Matrix Total Earned"
              value={String(fiveProgress?.total_earned ?? "0")}
            />
          </Grid> */}
        </Grid>

        {/* <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              5 Matrix Level-wise Accounts
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {!fiveProgress ? (
              <Typography variant="body2" color="text.secondary">
                No 5 Matrix progress available yet.
              </Typography>
            ) : (
              <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Level</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fiveLevelRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="body2" color="text.secondary">
                            No accounts populated yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      fiveLevelRows.map((r) => (
                        <TableRow key={r.level}>
                          <TableCell>{r.level}</TableCell>
                          <TableCell align="right">{r.count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card> */}
      </Box>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          background: "#f8fafc",
          padding: 12,
        }}
      >
        <GenealogyTree5 initialPool="FIVE_150" maxDepth={10} showPlaceholders />
      </div>
    </div>
  );
}
