import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";
import TreeReferralGalaxy from "../../components/TreeReferralGalaxy";
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

export default function MyTeam() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const role = useMemo(() => {
    try {
      return localStorage.getItem("role") || sessionStorage.getItem("role") || "";
    } catch {
      return "";
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/accounts/team/summary/", { cacheTTL: 10000, retryAttempts: 2 });
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


  const down = data?.downline || {};
  const levels = down?.levels || {};
  const totals = data?.totals || {};
  const matrix = Array.isArray(data?.matrix_progress) ? data.matrix_progress : [];
  const genBreakdown = data?.generation_levels_breakdown || {};
  const commSplit = data?.commissions_split || {};
  const recentTeam = Array.isArray(data?.recent_team) ? data.recent_team : [];
  const recentTx = Array.isArray(data?.recent_transactions) ? data.recent_transactions : [];


  return (
    <Box sx={{ p: { xs: 0, md: 0 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          My Team
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View downline counts, earnings by category, matrix progress and recent activity.
        </Typography>
        {role ? (
          <Chip size="small" label={`Role: ${role}`} sx={{ mt: 1 }} />
        ) : null}
      </Box>

      {err ? (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {err}
        </Typography>
      ) : null}

      <Grid container spacing={2}>
        {/* Downline */}
        

        {/* Earnings Totals */}
        

        {/* Matrix Progress */}
        {/* <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Matrix Progress
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {matrix.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No matrix progress yet.
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {matrix.map((m, idx) => (
                    <Grid item xs={12} md={6} key={idx}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {m.pool_type}
                          </Typography>
                          <Stack direction="row" spacing={2} sx={{ mt: 1, mb: 1 }}>
                            <Chip size="small" label={`Total Earned: ₹${m.total_earned}`} />
                            <Chip size="small" label={`Level Reached: ${m.level_reached}`} />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            Updated: {m.updated_at}
                          </Typography>

                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2">Per Level Counts</Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Level</TableCell>
                                  <TableCell align="right">Count</TableCell>
                                  <TableCell align="right">Earned (₹)</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {Object.keys(m.per_level_counts || {}).sort((a, b) => parseInt(a) - parseInt(b)).map((levelKey) => (
                                  <TableRow key={levelKey}>
                                    <TableCell>{levelKey}</TableCell>
                                    <TableCell align="right">{m.per_level_counts[levelKey]}</TableCell>
                                    <TableCell align="right">{(m.per_level_earned || {})[levelKey] || "0"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid> */}

        {/* Geneology */}
        <Grid item xs={12}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", padding: 12 }}>
            <TreeReferralGalaxy mode="self" />
          </div>
        </Grid>

        {/* Recent Team & Transactions */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Recent Team Members
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {recentTeam.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No recent members.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Joined</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTeam.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.username}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.role}</TableCell>
                        <TableCell>{r.date_joined}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Recent Reward Transactions
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {recentTx.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No recent transactions.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Amount (₹)</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentTx.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.type}</TableCell>
                        <TableCell align="right">{t.amount}</TableCell>
                        <TableCell>
                          <Typography variant="caption" display="block">
                            {t.source_type || "-"}:{t.source_id || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell>{t.created_at}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid> */}
      </Grid>
    </Box>
  );
}
