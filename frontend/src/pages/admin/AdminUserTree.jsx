import React, { useEffect, useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import TreeReferralGalaxy from "../../components/TreeReferralGalaxy";
import { adminGetMatrixCommissionConfig } from "../../api/api";

/**
 * AdminUserTree
 * - Shows two tabs:
 *   1) "3 Matrix (Consumer Placement)" -> sponsor-based genealogy (preferredSource="sponsor"), deeper depth (15)
 *   2) "5 Matrix (Matrix Placement)"    -> 5-matrix genealogy (preferredSource="matrix"), typical depth (6)
 *
 * Note:
 * - AdminMatrixTree (sponsor-based) supports an optional pool param only for default depth,
 *   we control depth via maxDepth prop passed into TreeReferralGalaxy.
 * - TreeReferralGalaxy admin mode provides built-in identifier search and breadcrumbs.
 */
export default function AdminUserTree() {
  const [tab, setTab] = useState(0);
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
        // keep defaults
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box sx={{ p: 0 }}>
      <Box
        sx={{
          border: "1px solid #e2e8f0",
          borderRadius: 2,
          bgcolor: "#fff",
          mb: 2,
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

     

      {tab === 0 ? (
        <Box sx={{ mt: 2 }}>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#f8fafc",
              padding: 12,
            }}
          >
            <TreeReferralGalaxy mode="admin" preferredSource="matrix" maxDepth={levels.five} maxChildren={5} pool="FIVE_150" />
          </div>
        </Box>
      ) : null}

      {tab === 1 ? (
        <Box sx={{ mt: 2 }}>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#f8fafc",
              padding: 12,
            }}
          >
            <TreeReferralGalaxy mode="admin" preferredSource="matrix" maxDepth={levels.three} maxChildren={3} pool="THREE_150" />
          </div>
        </Box>
      ) : null}
    </Box>
  );
}
