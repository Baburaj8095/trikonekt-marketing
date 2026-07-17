import React, { useEffect, useState } from "react";
import {
  Box,
  Tabs,
  Tab,
  Button,
  Paper,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Stack,
  Chip,
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TreeReferralGalaxy from "../../components/TreeReferralGalaxy";
import InteractiveTree from "../../components/genealogy/InteractiveTree";
import { adminGetMatrixCommissionConfig } from "../../api/api";
import API from "../../api/api";

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

export default function AdminUserTree() {
  const [tab, setTab] = useState(0);
  const [viewMode, setViewMode] = useState("cards"); // "cards" or "visual"
  const [levels, setLevels] = useState({ five: 10, three: 15 });
  
  // Auditor States
  const [auditQuery, setAuditQuery] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditErr, setAuditErr] = useState("");
  const [auditResults, setAuditResults] = useState(null);

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
        // keep defaults
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const runAudit = async () => {
    if (!auditQuery) return;
    setAuditLoading(true);
    setAuditErr("");
    setAuditResults(null);
    try {
      // 1. Fetch user by username/phone
      const userRes = await API.get("/admin/users/", {
        params: { search: auditQuery, page_size: 1 },
      });
      const user = userRes?.data?.results?.[0];
      if (!user) {
        setAuditErr("Target user not found.");
        return;
      }

      // 2. Fetch downline users (sponsored by this user)
      const downlineRes = await API.get("/api/admin/users/", {
        params: { sponsor_id: user.username, page_size: 100 },
      });
      const downline = Array.isArray(downlineRes?.data)
        ? downlineRes.data
        : (Array.isArray(downlineRes?.data?.results) ? downlineRes.data.results : []);

      // 3. Fetch user ledger
      const ledgerRes = await API.get(`/admin/wallets/${user.id}/ledger/`, {
        params: { page_size: 150 },
      });
      const transactions = Array.isArray(ledgerRes?.data)
        ? ledgerRes.data
        : (Array.isArray(ledgerRes?.data?.results) ? ledgerRes.data.results : []);

      // 4. Reconcile commissions
      const audits = downline.map((member) => {
        // Assume default commission rules: Direct Sponsor = ₹50, Level placement = ₹10
        const isSponsor = member.sponsor_id === user.username;
        const expected = isSponsor ? 50.00 : 10.00;

        // Trace transactions remarks referencing this member's username
        const matches = transactions.filter(
          (tx) => 
            tx.amount > 0 && 
            String(tx.remarks || "").toLowerCase().includes(String(member.username).toLowerCase())
        );
        const actual = matches.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        return {
          id: member.id,
          username: member.username,
          fullName: member.full_name,
          role: member.role || "user",
          relation: isSponsor ? "Direct Sponsor" : "Placement",
          expected,
          actual,
          status: Math.abs(actual - expected) < 0.01 ? "MATCHED" : "MISMATCHED",
        };
      });

      setAuditResults({
        user,
        audits,
      });

    } catch (e) {
      console.error(e);
      setAuditErr("Failed to complete structure payout audit.");
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 900, color: "#0C2D48", mb: 2 }}>
        Genealogy Trees & Payout Auditor
      </Typography>

      {/* Main Tabs (Matrix placement choice) */}
      <Box
        sx={{
          border: "1px solid #e2e8f0",
          borderRadius: 2,
          bgcolor: "#fff",
          mb: 1.5,
        }}
      >
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="5 Matrix (Matrix Placement)" />
          <Tab label="3 Matrix (Matrix Placement)" />
        </Tabs>
      </Box>

      {/* View Mode Selector (Cards vs Zoomable SVG Tree) */}
      <Box sx={{ display: "flex", gap: 1.2, mb: 2 }}>
        <Button
          variant={viewMode === "cards" ? "contained" : "outlined"}
          onClick={() => setViewMode("cards")}
          size="small"
          sx={{ borderRadius: 99, px: 2, textTransform: "none", fontWeight: 800 }}
        >
          Card Explorer List
        </Button>
        <Button
          variant={viewMode === "visual" ? "contained" : "outlined"}
          onClick={() => setViewMode("visual")}
          size="small"
          sx={{ borderRadius: 99, px: 2, textTransform: "none", fontWeight: 800 }}
        >
          Interactive Zoomable SVG Tree
        </Button>
      </Box>

      {/* Tree Content Render */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#f8fafc", mb: 3 }}>
        {viewMode === "cards" ? (
          tab === 0 ? (
            <TreeReferralGalaxy mode="admin" preferredSource="matrix" maxDepth={levels.five} maxChildren={5} pool="FIVE_150" />
          ) : (
            <TreeReferralGalaxy mode="admin" preferredSource="matrix" maxDepth={levels.three} maxChildren={3} pool="THREE_150" />
          )
        ) : (
          <Box sx={{ height: 530, borderRadius: 2.5, overflow: "hidden" }}>
            <InteractiveTree pool={tab === 0 ? "FIVE_150" : "THREE_150"} />
          </Box>
        )}
      </Paper>

      {/* Structure Payout Auditor Section */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid #EEF2F6" }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <AssessmentIcon color="primary" />
          <Typography sx={{ fontWeight: 950, fontSize: 16, color: "#0C2D48" }}>
            Structure Payout Auditor & Reconciliation
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Audit any member's wallet ledger entries against active downline positions to reconcile commission payouts.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2, maxWidth: 500 }}>
          <TextField
            size="small"
            placeholder="Search Username / Phone / ID"
            value={auditQuery}
            onChange={(e) => setAuditQuery(e.target.value)}
            fullWidth
            onKeyDown={(e) => e.key === "Enter" && runAudit()}
          />
          <Button variant="contained" onClick={runAudit} startIcon={<SearchIcon />}>
            Audit
          </Button>
        </Stack>

        {auditLoading && (
          <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {auditErr && (
          <Typography color="error" sx={{ fontWeight: 800, fontSize: 13, p: 1 }}>
            {auditErr}
          </Typography>
        )}

        {auditResults && (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, color: "#0C2D48" }}>
              Audit Report for: {auditResults.user.full_name} ({auditResults.user.username})
            </Typography>

            <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #EEF2F6" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#F8FAFC" }}>
                    <TableCell sx={{ fontWeight: 800 }}>Downline Member</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Relation</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Expected Commission</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Actual Credited</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditResults.audits.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{row.fullName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.username}</Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{row.relation}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{money(row.expected)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{money(row.actual)}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={row.status}
                          size="small"
                          color={row.status === "MATCHED" ? "success" : "error"}
                          sx={{ fontWeight: 900, fontSize: 10, height: 20 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {auditResults.audits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                        No direct downline members found for this user.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
