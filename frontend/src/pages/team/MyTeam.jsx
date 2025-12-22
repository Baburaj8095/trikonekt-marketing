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
  Tabs,
  Tab,
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
  const initialTab = () => {
    try {
      const r =
        localStorage.getItem("role") ||
        sessionStorage.getItem("role") ||
        localStorage.getItem("role_user") ||
        sessionStorage.getItem("role_user") ||
        "";
      return String(r).toLowerCase() === "user" ? "direct" : "consumer";
    } catch {
      return "consumer";
    }
  };
  const [tab, setTab] = useState(initialTab); // "consumer" | "agency" | "employee" | "merchant" | "levels" | "tree"

  const role = useMemo(() => {
    try {
      // Keep legacy keys for backward compatibility
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

  // Show limited tabs for user dashboard (My Direct, My Level Team, Tree)
  const isUser = String(role).toLowerCase() === "user";

  // Build tabs list based on role and derive selected index/key to avoid invalid value warnings
  const tabsList = isUser
    ? [
        { key: "direct", label: "My Direct" },
        { key: "levels", label: "My Level Team" },
        { key: "tree", label: "Tree" },
      ]
    : [
        { key: "consumer", label: "My Consumer Direct" },
        { key: "agency", label: "My Agency Direct" },
        { key: "employee", label: "My Employee Direct" },
        { key: "merchant", label: "My Merchant Direct" },
        { key: "levels", label: "My Level Team" },
        { key: "tree", label: "Tree" },
      ];
  const selectedIndex = Math.max(0, tabsList.findIndex((t) => t.key === tab));
  const tabsValue = tabsList[selectedIndex]?.key || tabsList[0].key;


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

  const down = data?.downline || {};
  const levels = down?.levels || {};
  const genBreakdown = data?.generation_levels_breakdown || {};
  const directTeam = Array.isArray(data?.direct_team) ? data.direct_team : [];
  const directCounts = data?.direct_team_counts || { active: 0, inactive: 0 };

  // Role breakdown within my direct referrals
  const roleCounts = useMemo(() => {
    const arr = Array.isArray(directTeam) ? directTeam : [];
    let user = 0,
      employee = 0,
      agency = 0;
    for (const m of arr) {
      const r = String(m?.role || "").toLowerCase();
      const c = String(m?.category || "").toLowerCase();
      if (r === "employee" || c === "employee") employee += 1;
      else if (r === "agency" || c.startsWith("agency")) agency += 1;
      else user += 1;
    }
    return { user, employee, agency };
  }, [directTeam]);

  // Filter current direct team by active tab
  const currentDirectTeam = useMemo(() => {
    const arr = Array.isArray(directTeam) ? directTeam : [];
    const cat = (x) => String(x?.category || "").toLowerCase();
    const roleOf = (x) => String(x?.role || "").toLowerCase();
    if (tabsValue === "consumer") return arr.filter((m) => cat(m) === "consumer" || roleOf(m) === "user");
    if (tabsValue === "agency") return arr.filter((m) => roleOf(m) === "agency" || cat(m).startsWith("agency"));
    if (tabsValue === "employee") return arr.filter((m) => roleOf(m) === "employee" || cat(m) === "employee");
    if (tabsValue === "merchant") return arr.filter((m) => roleOf(m) === "business" || cat(m) === "merchant");
    return arr;
  }, [directTeam, tabsValue]);

  // Level rows: merge counts from downline.levels and generation_levels_breakdown
  const levelRows = useMemo(() => {
    const keys = new Set([
      ...Object.keys(levels || {}),
      ...Object.keys(genBreakdown || {}),
    ]);
    const numericKeys = Array.from(keys)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    return numericKeys.map((lvl) => {
      const k = String(lvl);
      const gb = genBreakdown?.[k] || {};
      const total =
        typeof levels?.[k] === "number"
          ? levels[k]
          : typeof gb.count === "number"
          ? gb.count
          : (gb.active || 0) + (gb.inactive || 0);
      return {
        level: lvl,
        total: Math.max(0, total || 0),
        active: Math.max(0, gb.active || 0),
        inactive: Math.max(0, gb.inactive || 0),
      };
    });
  }, [levels, genBreakdown]);

  const maskTRUsername = (username) => {
    if (typeof username !== "string") return username;
    const match = username.match(/^(TR)(\d+)(.*)$/i);
    if (!match) return username;
    const prefix = match[1];
    const digits = match[2];
    const suffix = match[3] || "";
    const firstMask = Math.min(2, digits.length);
    const lastMask = Math.min(2, Math.max(0, digits.length - firstMask));
    const middle = digits.slice(firstMask, digits.length - lastMask);
    return `${prefix}${"X".repeat(firstMask)}${middle}${"x".repeat(lastMask)}${suffix}`;
  };

  return (
    <Box sx={{ p: { xs: 0, md: 0 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Genealogy
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View My Directs, Level chart and Tree.
        </Typography>
        {role ? <Chip size="small" label={`Role: ${role}`} sx={{ mt: 1 }} /> : null}
      </Box>

      {err ? (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {err}
        </Typography>
      ) : null}

      {/* Top tabs */}
      <Box
        sx={{
          border: "1px solid #e2e8f0",
          borderRadius: 2,
          bgcolor: "#fff",
          mb: 2,
        }}
      >
        <Tabs
          value={selectedIndex}
          onChange={(e, idx) => setTab(tabsList[idx]?.key || tabsList[0].key)}
          variant="scrollable"
          allowScrollButtonsMobile
          textColor="primary"
          indicatorColor="primary"
        >
          {tabsList.map((t) => (
            <Tab key={t.key} label={t.label} />
          ))}
        </Tabs>
      </Box>

      {/* My Directs (filtered by tab) */}
      {["consumer","agency","employee","merchant","direct"].includes(tabsValue) ? (
        <Box>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            {/* Downline cards */}
            <Grid item xs={12} md={4}>
              <StatCard
                title="Direct Referrals"
                value={String(currentDirectTeam.length ?? 0)}
              />
            </Grid>
            <Grid item xs={6} md={4}>
              <StatCard title="Active" value={String(directCounts.active ?? 0)} />
            </Grid>
            <Grid item xs={6} md={4}>
              <StatCard
                title="Inactive"
                value={String(directCounts.inactive ?? 0)}
              />
            </Grid>

            {/* Role breakdown (direct referrals) */}
            <Grid item xs={6} md={4}>
              <StatCard title="Users" value={String(roleCounts.user ?? 0)} />
            </Grid>
            <Grid item xs={6} md={4}>
              <StatCard
                title="Employees"
                value={String(roleCounts.employee ?? 0)}
              />
            </Grid>
            <Grid item xs={6} md={4}>
              <StatCard
                title="Agencies"
                value={String(roleCounts.agency ?? 0)}
              />
            </Grid>
          </Grid>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                My Direct Referrals
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {currentDirectTeam.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No direct referrals.
                </Typography>
              ) : (
                <Box sx={{ width: "100%", overflowX: "auto" }}>
                  <Table size="small" sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Pincode</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Role</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Category</TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Joined</TableCell>
                        <TableCell align="right">Direct Team</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentDirectTeam.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{maskTRUsername(m.username)}</TableCell>
                          <TableCell>{m.phone || "-"}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{m.pincode || "-"}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={m.account_active ? "Active" : "Inactive"}
                              color={m.account_active ? "success" : "default"}
                            />
                          </TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{m.role || "-"}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{m.category || "-"}</TableCell>
                          <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{m.date_joined || "-"}</TableCell>
                          <TableCell align="right">{m.direct_referrals ?? 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      ) : null}

      {/* My Level Chart */}
      {tabsValue === "levels" ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              My Level Team
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {levelRows.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No level distribution available yet.
              </Typography>
            ) : (
              <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Level</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Active</TableCell>
                      <TableCell align="right">Inactive</TableCell>
                      <TableCell>Distribution</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {levelRows.map((r) => {
                    const total = Math.max(1, r.total || 0);
                    const activePct = Math.min(100, Math.round((r.active / total) * 100));
                    const inactivePct = Math.min(
                      100,
                      Math.max(0, 100 - activePct)
                    );
                    return (
                      <TableRow key={r.level}>
                        <TableCell>{r.level}</TableCell>
                        <TableCell align="right">{r.total}</TableCell>
                        <TableCell align="right">{r.active}</TableCell>
                        <TableCell align="right">{r.inactive}</TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              width: 220,
                              height: 10,
                              borderRadius: 5,
                              overflow: "hidden",
                              display: "flex",
                              bgcolor: "#e2e8f0",
                            }}
                          >
                            <Box
                              sx={{
                                width: `${activePct}%`,
                                bgcolor: "#16a34a",
                              }}
                            />
                            <Box
                              sx={{
                                width: `${inactivePct}%`,
                                bgcolor: "#94a3b8",
                              }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Tree */}
      {tabsValue === "tree" ? (
        <Box sx={{ mt: 2 }}>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#f8fafc",
              padding: 12,
            }}
          >
            <TreeReferralGalaxy mode="self" />
          </div>
        </Box>
      ) : null}
    </Box>
  );
}
