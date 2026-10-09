/**
 * AccordionTree.jsx
 *
 * World-class, glossy accordion-style hierarchy view matching media_1791128351289.png.
 * Replaces the complex/slow canvas/SVG tree with clean, expandable level-by-level cards.
 *
 * Features:
 * - Hierarchy Trail navigation (Breadcrumbs): Root -> Child -> Sub-child
 * - Root Card with Entry #, Direct: N, Level 0 (Root), Active Status pill
 * - CHILDREN (5 or 3 Positions) with X Filled, Y Empty badges
 * - Dotted connecting lines with circled position numbers (1, 2, 3, 4, 5)
 * - Nested accordion expansion on tap (> or Chevron)
 * - Empty position placeholders with dashed circular avatars
 * - 100% preserves existing API contracts: works for 5-Block, 3-Block, and Rank Matrix
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Stack,
  Paper,
  Button,
  Collapse,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import API from "../../api/api";
import { getMyGenealogyTree5 } from "../../api/genealogy";

// --- Design Tokens ---
const TOKENS = {
  primary: "#4F46E5",
  primaryLight: "#EEF2FF",
  primaryBorder: "#C7D2FE",
  success: "#10B981",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  text: "#0F172A",
  textSec: "#64748B",
  border: "#E2E8F0",
  lineDotted: "#CBD5E1",
};

function getLayerActivationBadge(node, useRankMatrix, isRoot = false, defaultLevel = 0) {
  if (!node) {
    return {
      active: false,
      title: "Inactive",
      label: "Inactive",
      bg: "#FEF3C7",
      color: "#92400E",
      border: "#FDE68A",
      dot: "#D97706",
    };
  }

  const isStatusActive = node.account_active !== false && String(node.status || "ACTIVE").toUpperCase() === "ACTIVE";

  if (useRankMatrix) {
    const currentRank = Number(node.current_rank ?? node.rank_level ?? node.rank ?? 0);
    const isActive = currentRank > 0 && isStatusActive;

    if (!isActive || currentRank <= 0) {
      return {
        active: false,
        title: "Inactive Member",
        label: "Inactive (Not Upgraded)",
        bg: "#FEF3C7",
        color: "#92400E",
        border: "#FDE68A",
        dot: "#D97706",
      };
    }

    const rawName = node.rank_name || `Layer ${currentRank}`;
    const label = rawName.includes("Activated") || rawName.includes("Layer") ? (rawName.includes("Activated") ? rawName : `${rawName} Activated`) : `Layer ${currentRank} Activated`;

    return {
      active: true,
      layerNum: currentRank,
      title: `Active in Layer ${currentRank}`,
      label,
      bg: "#EEF2FF",
      color: "#4338CA",
      border: "#C7D2FE",
      dot: "#10B981",
    };
  }

  // ── AutoPool 5-Matrix and 3-Matrix Trees ──
  if (!isStatusActive) {
    return {
      active: false,
      title: "Inactive Position",
      label: "Inactive",
      bg: "#FEF3C7",
      color: "#92400E",
      border: "#FDE68A",
      dot: "#D97706",
    };
  }

  const currentRank = Number(node.current_rank ?? node.rank_level ?? node.rank ?? 0);
  let label = "Active Position";
  if (currentRank > 0) {
    label = `Layer ${currentRank} Active`;
  } else if (node.source_type) {
    const src = String(node.source_type).toUpperCase();
    if (src.includes("REBIRTH")) label = "Rebirth Active";
    else if (src.includes("MONTHLY") || src.includes("SSP")) label = "Smart SSP Active";
    else label = "Prime Active";
  }

  return {
    active: true,
    layerNum: currentRank || 1,
    title: "Active Member",
    label,
    bg: "#ECFDF5",
    color: "#059669",
    border: "#A7F3D0",
    dot: "#10B981",
  };
}

function normalizeEntry(n) {
  if (!n) return null;
  const ownerId = n.user_id || n.owner_id || n.id || null;
  const entryId = n.account_id || n.entry_id || (n.is_entry ? n.id : null) || null;
  const currentRank = Number(n.current_rank || n.rank || n.rank_level || n.current_level || (n.has_prime ? 1 : 0)) || 0;
  const rankName = n.rank_name || (currentRank > 0 ? `Layer ${currentRank}` : "");
  const isStatusActive = String(n.status || n.account_active || "ACTIVE").toUpperCase() === "ACTIVE";

  return {
    ...n,
    id: entryId || ownerId,
    account_id: entryId,
    owner_id: ownerId,
    username: String(n.username || "").trim(),
    full_name: String(n.full_name || "").trim(),
    account_active: isStatusActive,
    direct_count: Number(n.direct_count ?? n.direct_sponsor_count) || 0,
    direct_sponsor_count: Number(n.direct_sponsor_count ?? n.direct_count) || 0,
    team_count: Number(n.team_count ?? n.total_team) || 0,
    matrix_position: Number(n.position || n.matrix_position) || 0,
    layer_level: Number(n.level || n.layer_level || n.level_depth) || 0,
    current_rank: currentRank,
    rank_name: rankName,
    children: Array.isArray(n.children) ? n.children.map(normalizeEntry) : [],
  };
}

function normalizeRankNode(n) {
  if (!n) return null;
  const username = String(n.username || n.phone || n.user_id || n.id || "").trim();
  const currentRank = Number(n.current_rank ?? n.rank ?? n.rank_level ?? n.current_level ?? 0);
  const rankName = n.rank_name || (currentRank > 0 ? `Layer ${currentRank}` : "");

  return {
    ...n,
    id: n.user_id || n.id,
    username,
    account_active: currentRank > 0,
    direct_count: Number(n.direct_count ?? n.direct_sponsor_count) || 0,
    direct_sponsor_count: Number(n.direct_sponsor_count ?? n.direct_count) || 0,
    team_count: Number(n.team_count ?? n.total_team) || 0,
    matrix_position: Number(n.position || n.matrix_position) || 0,
    layer_level: Number(n.level || n.layer_level || n.level_depth) || 0,
    current_rank: currentRank,
    rank_name: rankName,
    children: Array.isArray(n.children) ? n.children.map(normalizeRankNode) : [],
  };
}

export default function AccordionTree({
  entryRootId = null,
  useEntriesTree = false,
  pool = "FIVE_150",
  maxDepth = 10,
  onNodeSelect,
  isAdmin = false,
  adminIdentifier = "",
  useRankMatrix = false,
  rankRootUserId = null,
  currentRankLevel = null,
  defaultExpanded = false,
}) {
  const is3Block = String(pool || "").toUpperCase().includes("THREE") || String(pool || "").includes("3");
  const maxSlots = is3Block ? 3 : 5;

  const [rootNode, setRootNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Hierarchy Trail (Breadcrumb navigation for deep drilldown)
  const [trail, setTrail] = useState([]);

  // Fetch Root Data
  const loadRoot = useCallback(async (targetEntryId = null, targetUserIdent = null) => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const params = { pool: is3Block ? "THREE_150" : "FIVE_150", max_depth: 2, source: "auto" };
        if (targetEntryId) params.start_entry_id = targetEntryId;
        else if (targetUserIdent) params.identifier = targetUserIdent;
        else if (adminIdentifier) params.identifier = adminIdentifier;

        const res = await API.get("/admin/matrix/tree5/", { params, cacheTTL: 5000 });
        if (res?.data) {
          setRootNode(normalizeEntry(res.data));
        } else {
          setRootNode(null);
        }
        return;
      }

      if (useRankMatrix) {
        const params = { max_depth: 2 };
        if (targetEntryId) params.start_user_id = targetEntryId;
        else if (rankRootUserId) params.root_user_id = rankRootUserId;
        const res = await API.get("/rank-matrix/tree-bfs/", { params, cacheTTL: 3000 });
        if (res?.data) {
          const norm = normalizeRankNode(res.data);
          if (!targetEntryId && currentRankLevel !== null && currentRankLevel !== undefined) {
            norm.current_rank = Number(currentRankLevel) || 0;
            norm.rank_name = norm.current_rank > 0 ? `Layer ${norm.current_rank}` : "";
            norm.account_active = norm.current_rank > 0;
          }
          setRootNode(norm);
        } else {
          setRootNode(null);
        }
        return;
      }

      if (useEntriesTree || targetEntryId || entryRootId) {
        const sid = targetEntryId || entryRootId;
        const res = await API.get("/accounts/my/matrix/tree5/entries/", {
          params: { start_entry_id: sid, max_depth: 2, pool: is3Block ? "THREE_150" : "FIVE_150" },
          cacheTTL: 3000,
        });
        if (res?.data) {
          setRootNode(normalizeEntry(res.data));
        } else {
          setRootNode(null);
        }
        return;
      }

      // Default consumer tree
      const res = await getMyGenealogyTree5({ max_depth: 2, pool: is3Block ? "THREE_150" : "FIVE_150" });
      if (res) {
        setRootNode(normalizeEntry(res));
      } else {
        setRootNode(null);
      }
    } catch (err) {
      console.error("[AccordionTree] Error fetching tree root:", err);
      setError("Unable to load matrix tree branch.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, adminIdentifier, is3Block, useRankMatrix, rankRootUserId, useEntriesTree, entryRootId]);

  // Base root information captured on initial load (or entryRootId change)
  const [baseRootInfo, setBaseRootInfo] = useState(null);

  useEffect(() => {
    loadRoot(entryRootId, adminIdentifier);
    setTrail([]);
  }, [entryRootId, adminIdentifier, pool, loadRoot]);

  useEffect(() => {
    if (rootNode && trail.length === 0) {
      setBaseRootInfo({
        label: rootNode.username
          ? `${rootNode.username}${rootNode.account_id ? ` (#${rootNode.account_id})` : ""}`
          : `Entry #${rootNode.account_id || rootNode.id || "Root"}`,
        entryId: rootNode.account_id || (useRankMatrix ? (rootNode.user_id || rootNode.id) : rootNode.id),
        username: rootNode.username || rootNode.id,
      });
    }
  }, [rootNode, trail.length, useRankMatrix]);

  // Drilldown to a specific node
  const handleDrilldown = (node) => {
    if (!node) return;
    const nextIdent = node.username || node.id;
    const nextEntryId = useRankMatrix
      ? (node.user_id || node.id)
      : (node.account_id || (useEntriesTree ? node.id : null));

    // Save current node as ancestor in the trail
    const currentIdent = rootNode?.username || rootNode?.id;
    const currentEntryId = useRankMatrix
      ? (rootNode?.user_id || rootNode?.id)
      : (rootNode?.account_id || rootNode?.id);

    const ancestor = {
      label: currentIdent
        ? `${currentIdent}${!useRankMatrix && currentEntryId ? ` (#${currentEntryId})` : ""}`
        : `Entry #${currentEntryId || "Root"}`,
      node: rootNode,
      entryId: currentEntryId,
      username: currentIdent,
    };

    setTrail((prev) => [...prev, ancestor]);

    if (onNodeSelect) onNodeSelect(nextEntryId || node.id, node);
    loadRoot(nextEntryId, nextIdent);
  };

  // Navigate back to root account
  const handleResetToRoot = () => {
    setTrail([]);
    loadRoot(useRankMatrix ? null : entryRootId, useRankMatrix ? null : adminIdentifier);
    if (onNodeSelect) onNodeSelect(useRankMatrix ? null : entryRootId, null);
  };

  // Navigate up exactly one level to immediate upline / parent
  const handleGoBackOneLevel = () => {
    if (trail.length === 0) return;
    const parent = trail[trail.length - 1];
    setTrail((prev) => prev.slice(0, prev.length - 1));
    loadRoot(parent.entryId, parent.username);
    if (onNodeSelect) onNodeSelect(parent.entryId || parent.node?.id, parent.node);
  };

  // Click on a breadcrumb item
  const handleCrumbClick = (idx) => {
    if (idx < 0) {
      handleResetToRoot();
      return;
    }
    const target = trail[idx];
    setTrail((prev) => prev.slice(0, idx));
    loadRoot(target.entryId, target.username);
    if (onNodeSelect) onNodeSelect(target.entryId || target.node?.id, target.node);
  };

  // Immediate parent label for back button
  const parentUplineLabel = useMemo(() => {
    if (trail.length === 0) return "";
    return trail[trail.length - 1]?.label || "Root Account";
  }, [trail]);

  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: "20px",
          bgcolor: "#FFFFFF",
          border: "1px solid #E2E8F0",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          minHeight: 240,
        }}
      >
        <CircularProgress size={32} sx={{ color: TOKENS.primary }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: TOKENS.textSec }}>
          Loading Layer Branch...
        </Typography>
      </Paper>
    );
  }

  if (error || !rootNode) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: "20px",
          bgcolor: "#FFFFFF",
          border: "1px dashed #E2E8F0",
          textAlign: "center",
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: TOKENS.textSec }}>
          {error || "No active matrix nodes found for this selection."}
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 640, mx: "auto" }}>
      {/* 1. Upline Navigation Action Bar (Displayed whenever drilled down into downlines) */}
      {trail.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            mb: 2,
            borderRadius: "16px",
            bgcolor: "#EEF2FF",
            border: "1.5px solid #C7D2FE",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
            boxShadow: "0 2px 8px rgba(79, 70, 229, 0.08)",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 18 }} />}
              onClick={handleGoBackOneLevel}
              sx={{
                fontWeight: 800,
                fontSize: 12.5,
                borderRadius: "10px",
                bgcolor: "#4F46E5",
                color: "#FFFFFF",
                textTransform: "none",
                px: 1.75,
                py: 0.6,
                "&:hover": { bgcolor: "#4338CA" },
                boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)",
              }}
            >
              Back to Upline ({parentUplineLabel})
            </Button>
          </Stack>

          <Button
            variant="outlined"
            size="small"
            startIcon={<HomeRoundedIcon sx={{ fontSize: 18 }} />}
            onClick={handleResetToRoot}
            sx={{
              fontWeight: 800,
              fontSize: 12,
              borderRadius: "10px",
              color: "#334155",
              borderColor: "#CBD5E1",
              bgcolor: "#FFFFFF",
              textTransform: "none",
              px: 1.5,
              py: 0.5,
              "&:hover": { bgcolor: "#F8FAFC", borderColor: "#94A3B8" },
            }}
          >
            Reset to My Root
          </Button>
        </Paper>
      )}

      {/* 2. HIERARCHY TRAIL (Breadcrumb Row matching Screen 4) */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          mb: 2,
          flexWrap: "wrap",
          gap: 0.75,
          px: 0.5,
        }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 900, color: TOKENS.textSec, letterSpacing: "0.5px", textTransform: "uppercase" }}>
          Hierarchy Trail:
        </Typography>

        <Chip
          icon={<HomeRoundedIcon sx={{ fontSize: "14px !important" }} />}
          label={baseRootInfo?.label || "Root"}
          size="small"
          onClick={handleResetToRoot}
          sx={{
            fontWeight: 800,
            fontSize: 11.5,
            bgcolor: trail.length === 0 ? TOKENS.primary : "#FFFFFF",
            color: trail.length === 0 ? "#FFFFFF" : TOKENS.text,
            border: "1px solid #CBD5E1",
            cursor: "pointer",
            "&:hover": { bgcolor: trail.length === 0 ? TOKENS.primary : "#F1F5F9" },
          }}
        />

        {trail.map((item, idx) => (
          <React.Fragment key={idx}>
            <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#94A3B8" }}>→</Typography>
            <Chip
              label={item.label}
              size="small"
              onClick={() => handleCrumbClick(idx)}
              sx={{
                fontWeight: 800,
                fontSize: 11.5,
                bgcolor: "#FFFFFF",
                color: TOKENS.text,
                border: "1px solid #CBD5E1",
                cursor: "pointer",
                "&:hover": { bgcolor: "#F1F5F9" },
              }}
            />
          </React.Fragment>
        ))}

        {trail.length > 0 && rootNode && (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#94A3B8" }}>→</Typography>
            <Chip
              label={rootNode.username ? `${rootNode.username}${rootNode.account_id ? ` (#${rootNode.account_id})` : ""}` : `Entry #${rootNode.account_id || rootNode.id}`}
              size="small"
              sx={{
                fontWeight: 900,
                fontSize: 11.5,
                bgcolor: TOKENS.primary,
                color: "#FFFFFF",
                border: "1px solid #4338CA",
              }}
            />
          </>
        )}
      </Stack>

      {/* 3. ROOT ACCORDION CONTAINER (Level Card) */}
      <AccordionBranchCard
        node={rootNode}
        levelIndex={trail.length}
        maxSlots={maxSlots}
        isRootNode={true}
        pool={pool}
        useEntriesTree={useEntriesTree}
        isAdmin={isAdmin}
        useRankMatrix={useRankMatrix}
        onDrilldown={handleDrilldown}
        trailLength={trail.length}
        parentUplineLabel={parentUplineLabel}
        onGoBackOneLevel={handleGoBackOneLevel}
        defaultExpanded={defaultExpanded}
      />
    </Box>
  );
}

/**
 * Single Accordion Level Card: renders parent node header + expandable children list
 */
function AccordionBranchCard({
  node,
  levelIndex = 0,
  maxSlots = 5,
  isRootNode = false,
  positionIndex = null,
  pool,
  useEntriesTree,
  isAdmin,
  useRankMatrix,
  onDrilldown,
  trailLength = 0,
  parentUplineLabel = "",
  onGoBackOneLevel = null,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [children, setChildren] = useState(node?.children || []);
  const [childrenLoaded, setChildrenLoaded] = useState(Array.isArray(node?.children) && node.children.length > 0);
  const [loadingKids, setLoadingKids] = useState(false);

  useEffect(() => {
    setChildren(node?.children || []);
    setChildrenLoaded(Array.isArray(node?.children) && node.children.length > 0);
    setExpanded(defaultExpanded);
  }, [node, defaultExpanded]);

  // Lazy-load kids on expand if not already available
  const toggleExpand = async () => {
    if (!expanded && !childrenLoaded) {
      setLoadingKids(true);
      try {
        const targetId = useRankMatrix
          ? (node?.user_id || node?.id)
          : (node?.account_id || node?.id);

        let fetchedKids = [];
        if (useRankMatrix) {
          const res = await API.get("/rank-matrix/tree-bfs/", {
            params: {
              start_user_id: targetId,
              max_depth: 1,
            },
            cacheTTL: 3000,
          });
          fetchedKids = Array.isArray(res?.data?.children)
            ? res.data.children.map(normalizeRankNode)
            : [];
        } else {
          const res = await API.get(
            isAdmin ? "/admin/matrix/tree5/" : "/accounts/my/matrix/tree5/entries/",
            {
              params: {
                start_entry_id: targetId,
                max_depth: 1,
                pool: String(pool || "").includes("THREE") ? "THREE_150" : "FIVE_150",
              },
              cacheTTL: 3000,
            }
          );
          fetchedKids = Array.isArray(res?.data?.children)
            ? res.data.children.map(normalizeEntry)
            : [];
        }
        setChildren(fetchedKids);
        setChildrenLoaded(true);
      } catch (_) {
        setChildren([]);
      } finally {
        setLoadingKids(false);
      }
    }
    setExpanded((prev) => !prev);
  };

  // Build fixed slot array (1 to maxSlots)
  const slottedChildren = useMemo(() => {
    const slots = Array(maxSlots).fill(null);
    (children || []).forEach((child, i) => {
      const pos = Number(child.matrix_position);
      const slotIndex = Number.isFinite(pos) && pos >= 1 && pos <= maxSlots ? pos - 1 : i;
      if (slotIndex >= 0 && slotIndex < maxSlots) {
        slots[slotIndex] = child;
      }
    });
    return slots;
  }, [children, maxSlots]);

  const filledCount = slottedChildren.filter(Boolean).length;
  const emptyCount = maxSlots - filledCount;

  const nodeLayerBadge = getLayerActivationBadge(node, useRankMatrix, isRootNode, levelIndex);

  // Visual Initial / Avatar number
  const avatarText = useMemo(() => {
    const raw = String(node?.username || node?.id || "U").trim();
    return raw.length > 0 ? raw.charAt(0) : "U";
  }, [node]);

  return (
    <Box sx={{ width: "100%", position: "relative" }}>
      {/* Node Header Card (Screen 4 Layout) */}
      <Paper
        elevation={0}
        onClick={toggleExpand}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: "20px",
          bgcolor: "#FFFFFF",
          border: isRootNode ? "2px solid #C7D2FE" : "1px solid #E2E8F0",
          boxShadow: isRootNode
            ? "0 8px 24px rgba(79, 70, 229, 0.08)"
            : "0 4px 14px rgba(15, 23, 42, 0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          transition: "all 160ms ease",
          "&:hover": {
            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
            borderColor: TOKENS.primary,
          },
        }}
      >
        {/* Left: Avatar Ring with Active Status Dot */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ position: "relative" }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: nodeLayerBadge.active ? "#EEF2FF" : "#FEF3C7",
                border: nodeLayerBadge.active ? "2.5px solid #818CF8" : "2.5px solid #FCD34D",
                color: nodeLayerBadge.active ? "#4338CA" : "#B45309",
                fontSize: 18,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: nodeLayerBadge.active ? "0 4px 10px rgba(99, 102, 241, 0.2)" : "0 4px 10px rgba(245, 158, 11, 0.15)",
              }}
            >
              {avatarText}
            </Box>
            {/* Active status dot */}
            <Box
              sx={{
                position: "absolute",
                bottom: 1,
                right: 1,
                width: 11,
                height: 11,
                borderRadius: "50%",
                bgcolor: nodeLayerBadge.dot,
                border: "2px solid #FFFFFF",
              }}
            />
          </Box>

          {/* Center Info: Username, Entry #, Direct, Level Pill, Layer Activation Pill */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <Typography sx={{ fontSize: { xs: 14, sm: 15.5 }, fontWeight: 900, color: TOKENS.text }}>
                {node?.username || node?.id || "Member"}
              </Typography>
              {node?.account_id && (
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: TOKENS.textSec }}>
                  (Entry #{node.account_id})
                </Typography>
              )}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.5, rowGap: 0.5 }}>
              {/* Direct Sponsor Count Pill */}
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.4,
                  px: 1,
                  py: 0.25,
                  borderRadius: "10px",
                  bgcolor: "#ECFDF5",
                  color: "#065F46",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                <PersonOutlineRoundedIcon sx={{ fontSize: 13 }} />
                Direct: {node?.direct_sponsor_count ?? node?.direct_count ?? 0}
              </Box>

              {/* Total Team Count Pill */}
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.4,
                  px: 1,
                  py: 0.25,
                  borderRadius: "10px",
                  bgcolor: "#EFF6FF",
                  color: "#1D4ED8",
                  border: "1px solid #BFDBFE",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                <GroupsRoundedIcon sx={{ fontSize: 13 }} />
                Total Team: {node?.team_count ?? 0}
              </Box>

              {/* Level Pill */}
              <Box
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: "10px",
                  bgcolor: "#F1F5F9",
                  color: "#475569",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {isRootNode ? (trailLength > 0 ? `Level ${trailLength} (Downline)` : "Level 0 (Root)") : `Level ${levelIndex}`}
              </Box>

              {/* Back to Upline Quick Action Badge on Card */}
              {isRootNode && trailLength > 0 && (
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onGoBackOneLevel) onGoBackOneLevel();
                  }}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.4,
                    px: 1,
                    py: 0.25,
                    borderRadius: "10px",
                    bgcolor: "#EEF2FF",
                    color: "#4338CA",
                    border: "1px solid #C7D2FE",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 140ms ease",
                    "&:hover": { bgcolor: "#E0E7FF", borderColor: "#818CF8" },
                  }}
                >
                  <ArrowBackRoundedIcon sx={{ fontSize: 13 }} />
                  Upline: {parentUplineLabel}
                </Box>
              )}

              {/* Activated Layer Badge */}
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: "10px",
                  bgcolor: nodeLayerBadge.bg,
                  color: nodeLayerBadge.color,
                  border: `1px solid ${nodeLayerBadge.border}`,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: nodeLayerBadge.dot }} />
                {nodeLayerBadge.label}
              </Box>
            </Stack>
          </Box>
        </Stack>

        {/* Right: Total Team Badge + Active pill + Chevron Button */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.25,
              py: 0.35,
              borderRadius: "12px",
              bgcolor: "#EFF6FF",
              color: "#1D4ED8",
              border: "1px solid #BFDBFE",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            <GroupsRoundedIcon sx={{ fontSize: 14 }} />
            Total Team: {node?.team_count ?? 0}
          </Box>

          <Box
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              alignItems: "center",
              gap: 0.5,
              px: 1.25,
              py: 0.35,
              borderRadius: "12px",
              bgcolor: nodeLayerBadge.active ? "#ECFDF5" : "#FEF3C7",
              color: nodeLayerBadge.active ? "#059669" : "#D97706",
              border: `1px solid ${nodeLayerBadge.active ? "#A7F3D0" : "#FDE68A"}`,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: nodeLayerBadge.active ? "#059669" : "#D97706" }} />
            {nodeLayerBadge.active ? "Active" : "Inactive"}
          </Box>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand();
            }}
            sx={{
              color: TOKENS.text,
              bgcolor: "#F8FAFC",
              "&:hover": { bgcolor: "#EEF2FF" },
            }}
          >
            {loadingKids ? (
              <CircularProgress size={18} sx={{ color: TOKENS.primary }} />
            ) : expanded ? (
              <ExpandMoreRoundedIcon sx={{ fontSize: 22 }} />
            ) : (
              <ChevronRightRoundedIcon sx={{ fontSize: 22 }} />
            )}
          </IconButton>
        </Stack>
      </Paper>

      {/* Children Section (Screen 4 Layout) */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 2, pl: { xs: 1.5, sm: 3 }, position: "relative" }}>
          {/* Vertical Dotted Connecting Line */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 20,
              left: { xs: 26, sm: 38 },
              width: "1.5px",
              borderLeft: `2px dashed ${TOKENS.lineDotted}`,
              zIndex: 0,
            }}
          />

          {/* CHILDREN Header Strip: (5 POSITIONS) • 2 Filled • 3 Empty */}
          <Paper
            elevation={0}
            sx={{
              p: "6px 12px",
              mb: 1.5,
              borderRadius: "12px",
              bgcolor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "relative",
              zIndex: 1,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 900, color: TOKENS.textSec, letterSpacing: "0.4px" }}>
              CHILDREN ({maxSlots} POSITIONS)
            </Typography>

            <Stack direction="row" spacing={1}>
              <Box
                sx={{
                  px: 1,
                  py: 0.2,
                  borderRadius: "8px",
                  bgcolor: "#EFF6FF",
                  color: "#1E40AF",
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                {filledCount} Filled
              </Box>
              <Box
                sx={{
                  px: 1,
                  py: 0.2,
                  borderRadius: "8px",
                  bgcolor: "#F1F5F9",
                  color: "#64748B",
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                {emptyCount} Empty
              </Box>
            </Stack>
          </Paper>

          {/* Children Slots List (1 through maxSlots) */}
          <Stack spacing={1.5} sx={{ position: "relative", zIndex: 1 }}>
            {slottedChildren.map((child, slotIdx) => {
              const positionNumber = slotIdx + 1;
              const childLayerBadge = getLayerActivationBadge(child, useRankMatrix, false, levelIndex + 1);

              return (
                <Stack
                  key={positionNumber}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                >
                  {/* Position Circle Number (1, 2, 3...) */}
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      bgcolor: child ? (childLayerBadge.active ? "#EFF6FF" : "#FEF3C7") : "#F8FAFC",
                      border: child ? (childLayerBadge.active ? "2px solid #818CF8" : "2px solid #FCD34D") : "1.5px dashed #CBD5E1",
                      color: child ? (childLayerBadge.active ? "#4338CA" : "#B45309") : "#94A3B8",
                      fontSize: 12,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      zIndex: 1,
                    }}
                  >
                    {positionNumber}
                  </Box>

                  {/* Horizontal Connector Dotted Line */}
                  <Box
                    sx={{
                      width: 12,
                      height: "1px",
                      borderTop: `1.5px dashed ${TOKENS.lineDotted}`,
                      flexShrink: 0,
                    }}
                  />

                  {/* Child Content Card or Empty Slot Card */}
                  <Box sx={{ flex: 1 }}>
                    {child ? (
                      <Paper
                        elevation={0}
                        onClick={() => onDrilldown && onDrilldown(child)}
                        sx={{
                          p: { xs: 1.25, sm: 1.5 },
                          borderRadius: "16px",
                          bgcolor: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          cursor: "pointer",
                          transition: "all 140ms ease",
                          "&:hover": {
                            borderColor: TOKENS.primary,
                            transform: "translateX(2px)",
                            boxShadow: "0 6px 16px rgba(79, 70, 229, 0.08)",
                          },
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1.25}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: "50%",
                              bgcolor: childLayerBadge.active ? "#EEF2FF" : "#FEF3C7",
                              border: childLayerBadge.active ? "2px solid #818CF8" : "2px solid #FCD34D",
                              color: childLayerBadge.active ? "#4338CA" : "#B45309",
                              fontSize: 15,
                              fontWeight: 900,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {String(child.username || child.id || "U").charAt(0)}
                          </Box>

                          <Box>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: TOKENS.text }}>
                                {child.username || child.id}
                              </Typography>
                              {child.account_id && (
                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOKENS.textSec }}>
                                  (Entry #{child.account_id})
                                </Typography>
                              )}
                            </Stack>

                            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.35, rowGap: 0.4 }}>
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.3,
                                  px: 0.75,
                                  py: 0.2,
                                  borderRadius: "8px",
                                  bgcolor: "#ECFDF5",
                                  color: "#065F46",
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                <PersonOutlineRoundedIcon sx={{ fontSize: 11 }} />
                                Direct: {child.direct_sponsor_count ?? child.direct_count ?? 0}
                              </Box>

                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.3,
                                  px: 0.75,
                                  py: 0.2,
                                  borderRadius: "8px",
                                  bgcolor: "#EFF6FF",
                                  color: "#1D4ED8",
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                <GroupsRoundedIcon sx={{ fontSize: 11 }} />
                                Team: {child.team_count ?? 0}
                              </Box>

                              <Box
                                sx={{
                                  px: 0.75,
                                  py: 0.2,
                                  borderRadius: "8px",
                                  bgcolor: "#F1F5F9",
                                  color: "#64748B",
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              >
                                Level {levelIndex + 1}
                              </Box>

                              {/* Child Activated Layer Pill */}
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.4,
                                  px: 0.85,
                                  py: 0.2,
                                  borderRadius: "8px",
                                  bgcolor: childLayerBadge.bg,
                                  color: childLayerBadge.color,
                                  border: `1px solid ${childLayerBadge.border}`,
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: childLayerBadge.dot }} />
                                {childLayerBadge.label}
                              </Box>
                            </Stack>
                          </Box>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box
                            sx={{
                              display: { xs: "none", sm: "inline-flex" },
                              alignItems: "center",
                              gap: 0.4,
                              px: 1,
                              py: 0.25,
                              borderRadius: "10px",
                              bgcolor: "#EFF6FF",
                              color: "#1D4ED8",
                              border: "1px solid #BFDBFE",
                              fontSize: 10.5,
                              fontWeight: 800,
                            }}
                          >
                            <GroupsRoundedIcon sx={{ fontSize: 12 }} />
                            Team: {child.team_count ?? 0}
                          </Box>

                          <Box
                            sx={{
                              display: { xs: "none", sm: "inline-flex" },
                              alignItems: "center",
                              gap: 0.4,
                              px: 1,
                              py: 0.25,
                              borderRadius: "10px",
                              bgcolor: childLayerBadge.active ? "#ECFDF5" : "#FEF3C7",
                              color: childLayerBadge.active ? "#059669" : "#D97706",
                              border: `1px solid ${childLayerBadge.active ? "#A7F3D0" : "#FDE68A"}`,
                              fontSize: 10.5,
                              fontWeight: 800,
                            }}
                          >
                            <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: childLayerBadge.active ? "#059669" : "#D97706" }} />
                            {childLayerBadge.active ? "Active" : "Inactive"}
                          </Box>

                          <ChevronRightRoundedIcon sx={{ color: TOKENS.textSec, fontSize: 20 }} />
                        </Stack>
                      </Paper>
                    ) : (
                      /* Empty Slot Card matching Screen 4 */
                      <Paper
                        elevation={0}
                        sx={{
                          p: { xs: 1.25, sm: 1.5 },
                          borderRadius: "16px",
                          bgcolor: "#FFFFFF",
                          border: "1px dashed #CBD5E1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1.25}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: "50%",
                              border: "1.5px dashed #CBD5E1",
                              bgcolor: "#F8FAFC",
                            }}
                          />
                          <Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: TOKENS.textSec }}>
                              Empty Position
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: "#94A3B8" }}>
                              Available for new member
                            </Typography>
                          </Box>
                        </Stack>

                        <ChevronRightRoundedIcon sx={{ color: "#CBD5E1", fontSize: 20 }} />
                      </Paper>
                    )}
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
