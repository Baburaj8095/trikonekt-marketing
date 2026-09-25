import React, { useEffect, useState, useMemo } from "react";
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
  const [levels, setLevels] = useState({ five: 10, three: 15 });
  
  // Drilldown & Search States
  const [treeSearchInput, setTreeSearchInput] = useState("");
  const [treeSearchIdent, setTreeSearchIdent] = useState("");
  const [treeStartEntryId, setTreeStartEntryId] = useState(null);
  const [trail, setTrail] = useState([]); // [{ identifier, startEntryId, label }]
  const [selectedNodeData, setSelectedNodeData] = useState(null);

  // Auditor States
  const [auditQuery, setAuditQuery] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditErr, setAuditErr] = useState("");
  const [auditResults, setAuditResults] = useState(null);

  const activePool = useMemo(() => {
    return tab === 0 ? "FIVE_750" : "THREE_750";
  }, [tab]);

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

  const onTreeSearch = () => {
    const q = treeSearchInput.trim();
    setTreeSearchIdent(q);
    setTreeStartEntryId(null);
    setTrail(q ? [{ identifier: q, startEntryId: null, label: q }] : []);
    setSelectedNodeData(null);
  };

  const onTreeReset = () => {
    setTreeSearchInput("");
    setTreeSearchIdent("");
    setTreeStartEntryId(null);
    setTrail([]);
    setSelectedNodeData(null);
  };

  const onDrillDown = (node) => {
    if (!node || node.isEmpty) return;
    const nextIdent = String(node.username || node.id || "");
    const nextEntryId = node.entryId || node.account_id || null;
    const label = `${nextIdent} ${nextEntryId ? `(#${nextEntryId})` : ""}`;
    
    setTreeSearchIdent(nextIdent);
    setTreeStartEntryId(nextEntryId);
    setTrail((prev) => {
      // Check if already in trail
      const existingIdx = prev.findIndex(
        (t) => (nextEntryId && t.startEntryId === nextEntryId) || (nextIdent && t.identifier === nextIdent)
      );
      if (existingIdx >= 0) {
        return prev.slice(0, existingIdx + 1);
      }
      return [...prev, { identifier: nextIdent, startEntryId: nextEntryId, label }];
    });
    setSelectedNodeData(node);
  };

  const onCrumbClick = (idx) => {
    if (idx < 0 || idx >= trail.length) return;
    const target = trail[idx];
    setTreeSearchIdent(target.identifier);
    setTreeStartEntryId(target.startEntryId);
    setTrail(trail.slice(0, idx + 1));
    setSelectedNodeData(null);
  };

  const onGoBack = () => {
    if (trail.length <= 1) {
      onTreeReset();
      return;
    }
    const newTrail = trail.slice(0, -1);
    const parent = newTrail[newTrail.length - 1];
    setTrail(newTrail);
    setTreeSearchIdent(parent?.identifier || "");
    setTreeStartEntryId(parent?.startEntryId || null);
    setSelectedNodeData(null);
  };

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
        const isSponsor = member.sponsor_id === user.username;
        const expected = isSponsor ? 50.00 : 10.00;

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
          relation: isSponsor ? "Direct Sponsor" : "Layer Placement",
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
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Typography variant="h5" sx={{ fontWeight: 900, color: "#0C2D48", mb: 0.5 }}>
        Layer Blocks & Branches
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Interactive hierarchical view. Shows <b>Direct Sponsor Headcount</b> (who sponsored whom) across 5-Block & 3-Block layer branch placements. <b>Tap any child branch to drill down & reload.</b>
      </Typography>

      {/* Main Tabs (5 Blocks & 3 Blocks Only) */}
      <Box
        sx={{
          border: "1px solid #e2e8f0",
          borderRadius: 2.5,
          bgcolor: "#fff",
          mb: 2,
        }}
      >
        <Tabs
          value={tab}
          onChange={(e, v) => {
            setTab(v);
            setSelectedNodeData(null);
            setTrail([]);
            setTreeStartEntryId(null);
          }}
          variant="scrollable"
          allowScrollButtonsMobile
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="5 Blocks (Layer Placement • 10 Layers)" sx={{ fontWeight: 800, textTransform: "none" }} />
          <Tab label="3 Blocks (Layer Placement • 15 Layers)" sx={{ fontWeight: 800, textTransform: "none" }} />
        </Tabs>
      </Box>

      {/* Search Controls */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          placeholder="Search Username / Phone / Entry #"
          value={treeSearchInput}
          onChange={(e) => setTreeSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onTreeSearch()}
          sx={{ minWidth: { xs: 200, sm: 280 }, bgcolor: "#fff", borderRadius: 1 }}
        />
        <Button
          variant="contained"
          onClick={onTreeSearch}
          startIcon={<SearchIcon />}
          sx={{ textTransform: "none", fontWeight: 800, px: 2, borderRadius: 2 }}
        >
          Search / Load
        </Button>
        {(treeSearchIdent || trail.length > 0) && (
          <Button
            variant="outlined"
            color="secondary"
            onClick={onTreeReset}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}
          >
            Reset Root
          </Button>
        )}
      </Stack>

      {/* Breadcrumb Navigation Trail */}
      {trail.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            bgcolor: "#ffffff",
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
              Hierarchy Trail:
            </Typography>
            <Chip
              label="Root"
              size="small"
              onClick={onTreeReset}
              sx={{ fontWeight: 800, cursor: "pointer", bgcolor: "#f1f5f9" }}
            />
            {trail.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <Typography sx={{ color: "#94a3b8", fontWeight: 800 }}>→</Typography>
                <Chip
                  label={crumb.label}
                  size="small"
                  onClick={() => onCrumbClick(idx)}
                  color={idx === trail.length - 1 ? "primary" : "default"}
                  variant={idx === trail.length - 1 ? "filled" : "outlined"}
                  sx={{ fontWeight: 800, cursor: "pointer" }}
                />
              </React.Fragment>
            ))}
          </Stack>
          <Button
            size="small"
            variant="outlined"
            onClick={onGoBack}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}
          >
            ← Back 1 Layer
          </Button>
        </Paper>
      )}

      {/* Selected Node Summary Card if tapped */}
      {selectedNodeData && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2.5,
            border: "1.5px solid #c7d2fe",
            bgcolor: "#eef2ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 900, color: "#1e1b4b", fontSize: 14 }}>
              Current Node: {selectedNodeData.username} {selectedNodeData.entryId ? `(Entry #${selectedNodeData.entryId})` : ""}
            </Typography>
            <Typography variant="caption" sx={{ color: "#4338ca", fontWeight: 700 }}>
              {selectedNodeData.matrixPos > 0 ? `Layer Position #${selectedNodeData.matrixPos}` : "Active Layer Root"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              label={`👤 Direct Sponsored: ${selectedNodeData.directCount || 0}`}
              color="success"
              sx={{ fontWeight: 800 }}
            />
            {!selectedNodeData.isRoot && (
              <Button
                size="small"
                variant="contained"
                onClick={() => onDrillDown(selectedNodeData)}
                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, bgcolor: "#4338ca" }}
              >
                Drill Down →
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {/* Visual Tree Branches Container */}
      <Paper elevation={0} sx={{ p: 1, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#f8fafc", mb: 3 }}>
        <Box sx={{ height: 580, borderRadius: 2.5, overflow: "hidden" }}>
          <InteractiveTree
            key={`${activePool}-${treeSearchIdent}-${treeStartEntryId || "root"}`}
            isAdmin={true}
            adminIdentifier={treeSearchIdent}
            entryRootId={treeStartEntryId}
            pool={activePool}
            onNodeSelect={(_, node) => {
              if (node && !node.isRoot) {
                onDrillDown(node);
              } else if (node) {
                setSelectedNodeData(node);
              }
            }}
          />
        </Box>
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
          <Button 
            variant="outlined" 
            color="secondary" 
            onClick={async () => {
              const targetUser = prompt("Enter User ID or Username to Re-Anchor:");
              if (!targetUser) return;
              const sponsorUser = prompt("Enter Target Sponsor ID or Username:");
              if (!sponsorUser) return;
              try {
                const res = await API.post("/admin/matrix/reanchor-user/", {
                  user_id: targetUser,
                  target_sponsor_id: sponsorUser,
                  pool_type: tab === 0 ? "FIVE_150" : "THREE_150"
                });
                alert(res?.data?.message || "Successfully re-anchored user under target sponsor!");
              } catch (err) {
                alert(err?.response?.data?.detail || "Failed to re-anchor user.");
              }
            }}
          >
            🔗 Re-Anchor Node
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
