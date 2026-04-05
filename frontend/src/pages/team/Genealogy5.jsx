import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import API, { adminGetMatrixCommissionConfig } from "../../api/api";
import EarningsTab from "../../components/genealogy/EarningsTab";
import ProgressTab from "../../components/genealogy/ProgressTab";
import DirectSponsorTab from "../../components/genealogy/DirectSponsorTab";
import FiveMatrixTab from "../../components/genealogy/FiveMatrixTab";
import ThreeMatrixTab from "../../components/genealogy/ThreeMatrixTab";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  appBg: "#f0f4ff",
  surface: "#ffffff",
  primary: "#4f46e5",
  text: "#111827",
  textSec: "#6b7280",
  border: "#e5e7eb",
  error: "#dc2626",
  errorBg: "#fef2f2",
};

// ─── Tab order (used for swipe direction) ─────────────────────────────────────
const TAB_ORDER = ["directs", "five_matrix", "three_matrix", "earnings", "progress"];

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const TreeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="4" r="2.5" />
    <circle cx="4.5" cy="20" r="2.5" />
    <circle cx="19.5" cy="20" r="2.5" />
    <line x1="12" y1="6.5" x2="12" y2="13" />
    <line x1="12" y1="13" x2="4.5" y2="17.5" />
    <line x1="12" y1="13" x2="19.5" y2="17.5" />
  </svg>
);

const EarningsIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9.5" />
    <path d="M14.8 8.5a3 3 0 0 0-5.6 1.5c0 3.5 5.6 3.5 5.6 7a3 3 0 0 1-5.6 1.5" />
    <line x1="12" y1="5.5" x2="12" y2="7.5" />
    <line x1="12" y1="16.5" x2="12" y2="18.5" />
  </svg>
);

const ProgressIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22,20 2,20" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="18" y1="20" x2="18" y2="10" />
  </svg>
);

const DirectsIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="7" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6h.5" />
    <circle cx="17" cy="11" r="2.5" />
    <path d="M15 20c0-2.8 1.8-5 4-5" />
    <path d="M21 20c0-2.8-1.8-5-4-5" />
  </svg>
);

const FiveMatrixIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="4" height="4" rx="1" />
    <rect x="10" y="2" width="4" height="4" rx="1" />
    <rect x="18" y="2" width="4" height="4" rx="1" />
    <rect x="6" y="11" width="4" height="4" rx="1" />
    <rect x="14" y="11" width="4" height="4" rx="1" />
    <line x1="4" y1="6" x2="8" y2="11" />
    <line x1="12" y1="6" x2="8" y2="11" />
    <line x1="12" y1="6" x2="16" y2="11" />
    <line x1="20" y1="6" x2="16" y2="11" />
  </svg>
);

const ThreeMatrixIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="4" r="2.5" />
    <circle cx="4.5" cy="18" r="2.5" />
    <circle cx="19.5" cy="18" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <line x1="12" y1="6.5" x2="12" y2="15.5" />
    <line x1="12" y1="6.5" x2="4.5" y2="15.5" />
    <line x1="12" y1="6.5" x2="19.5" y2="15.5" />
  </svg>
);

const TABS = [
  { id: "directs",      label: "Direct",     Icon: DirectsIcon },
  { id: "five_matrix",  label: "5 Matrix",   Icon: FiveMatrixIcon },
  { id: "three_matrix", label: "3 Matrix",   Icon: ThreeMatrixIcon },
  { id: "earnings",     label: "Rank Up",    Icon: EarningsIcon },
  // { id: "progress",     label: "Account",    Icon: ProgressIcon },
];

// ─── AppTabBar ───────────────────────────────────────────────────────────────
const AppTabBar = React.memo(function AppTabBar({ active, onChange }) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        background: C.surface,
        borderBottom: `1.5px solid ${C.border}`,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 4px 8px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              position: "relative",
              color: isActive ? C.primary : "#9ca3af",
              transition: "color 0.18s ease",
              WebkitTapHighlightColor: "transparent",
              outline: "none",
            }}
          >
            <Icon />
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                marginTop: 4,
                lineHeight: 1,
                letterSpacing: "0.01em",
              }}
            >
              {label}
            </span>
            {/* Active underline */}
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "18%",
                  right: "18%",
                  height: 3,
                  background: C.primary,
                  borderRadius: "3px 3px 0 0",
                  display: "block",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
});

// ─── AppHeader ───────────────────────────────────────────────────────────────
const AppHeader = React.memo(function AppHeader({ role, err }) {
  return (
    <div
      style={{
        padding: "14px 16px 11px",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              color: C.text,
              letterSpacing: "-0.5px",
              lineHeight: 1.1,
            }}
          >
            Genealogy
          </h1>
          <p
            style={{
              margin: "3px 0 0",
              fontSize: 12,
              color: "#94a3b8",
              lineHeight: 1.4,
            }}
          >
            Your network &amp; team overview
          </p>
        </div>
        {role ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.primary,
              background: "#ede9fe",
              borderRadius: 99,
              padding: "4px 12px",
              textTransform: "capitalize",
              flexShrink: 0,
              marginLeft: 8,
              marginTop: 2,
            }}
          >
            {role}
          </span>
        ) : null}
      </div>

      {err ? (
        <div
          style={{
            marginTop: 8,
            background: C.errorBg,
            color: C.error,
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 12px",
            borderRadius: 10,
          }}
        >
          {err}
        </div>
      ) : null}
    </div>
  );
});

// ─── Main page component ──────────────────────────────────────────────────────
export default function Genealogy5() {
  // ── Data state ──
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [levels, setLevels] = useState({ five: 10, three: 15 });

  // ── Navigation ──
  const [tab, setTab] = useState("directs");
  const [tabDir, setTabDir] = useState(1); // +1 = forward, -1 = backward

  // ── Matrix progress ──
  const [levelCounts, setLevelCounts] = useState(null);
  const [fiveCounts, setFiveCounts] = useState(null);
  const [threeCounts, setThreeCounts] = useState(null);
  const [selectedRoot, setSelectedRoot] = useState(null);
  const [selectedThreeRoot, setSelectedThreeRoot] = useState(null);

  // ── Category selection (Subscription 750 / Smart SSP / Self Rebirth) ──
  const [fiveCategory, setFiveCategory] = useState(null);   // null = auto (first available)
  const [threeCategory, setThreeCategory] = useState(null); // null = auto (first available)

  // ── Direct team ──
  const [directList, setDirectList] = useState(null);
  const [directCountsState, setDirectCountsState] = useState(null);
  const [loadingDirects, setLoadingDirects] = useState(false);
  const [directRefreshKey, setDirectRefreshKey] = useState(0);

  // ── Rank matrix ──
  const [rankMx, setRankMx] = useState(null);
  const [rankMxLoading, setRankMxLoading] = useState(false);
  const [rankMxErr, setRankMxErr] = useState("");

  // ── Touch swipe refs ──
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // ── Role ──
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

  // ── Tab switch with direction tracking ──
  const switchTab = useCallback(
    (newTab) => {
      const oldIdx = TAB_ORDER.indexOf(tab);
      const newIdx = TAB_ORDER.indexOf(newTab);
      setTabDir(newIdx >= oldIdx ? 1 : -1);
      setTab(newTab);
    },
    [tab]
  );

  // ── Swipe gestures ──
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      if (touchStartX.current == null) return;
      const dx = touchStartX.current - e.changedTouches[0].clientX;
      const dy = Math.abs((touchStartY.current || 0) - e.changedTouches[0].clientY);
      // Only trigger on clear horizontal swipe (not vertical scroll)
      if (Math.abs(dx) > 60 && dy < 40) {
        const idx = TAB_ORDER.indexOf(tab);
        if (dx > 0 && idx < TAB_ORDER.length - 1) {
          // swipe left → next tab
          switchTab(TAB_ORDER[idx + 1]);
        } else if (dx < 0 && idx > 0) {
          // swipe right → previous tab
          switchTab(TAB_ORDER[idx - 1]);
        }
      }
      touchStartX.current = null;
    },
    [tab, switchTab]
  );

  // ── Rank matrix fetch ──
  const refetchRankMx = useCallback(async () => {
    setRankMxLoading(true);
    setRankMxErr("");
    try {
      const res = await API.get("/rank-matrix/tree/", {
        cacheTTL: 3000,
        dedupe: "cancelPrevious",
      });
      setRankMx(res?.data || null);
    } catch (_) {
      setRankMxErr("Unable to load rank matrix.");
    } finally {
      setRankMxLoading(false);
    }
  }, []);

  // ── Admin matrix levels config ──
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (isUser) return;
        const cfg = await adminGetMatrixCommissionConfig();
        if (!mounted) return;
        const five = Number(cfg?.five_matrix_levels) || 10;
        const three = Number(cfg?.three_matrix_levels) || 15;
        setLevels({ five, three });
      } catch (_) {}
    })();
    return () => {
      mounted = false;
    };
  }, [isUser]);

  // ── Team summary ──
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/accounts/team/summary/", {
          cacheTTL: 10000,
          retryAttempts: 2,
        });
        if (!mounted) return;
        const payload = res?.data || {};
        setData(payload);
        try {
          if (Array.isArray(payload?.direct_team)) setDirectList(payload.direct_team);
          if (payload?.direct_team_counts) setDirectCountsState(payload.direct_team_counts);
        } catch (_) {}
        setErr("");
      } catch (_) {
        if (!mounted) return;
        setErr("Failed to load team data.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── Rank matrix initial load ──
  useEffect(() => {
    refetchRankMx();
  }, [refetchRankMx]);

  // ── 5-matrix level counts (per selected root) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const qs =
          (selectedRoot
            ? "root_id=" + encodeURIComponent(String(selectedRoot)) + "&"
            : "") +
          "depth=" +
          encodeURIComponent(String(Number(levels?.five ?? 10))) +
          "&pool=FIVE_150";
        const res = await API.get("/accounts/genealogy/5m/counts/?" + qs, {
          cacheTTL: 10000,
          retryAttempts: 2,
        });
        if (!alive) return;
        setFiveCounts(res?.data || null);
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
  }, [selectedRoot, levels]);

  // ── 3-matrix level counts (per selected three root) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const qs =
          (selectedThreeRoot
            ? "root_id=" + encodeURIComponent(String(selectedThreeRoot)) + "&"
            : "") +
          "depth=" +
          encodeURIComponent(String(Number(levels?.three ?? 15))) +
          "&pool=THREE_150";
        const res = await API.get("/accounts/genealogy/5m/counts/?" + qs, {
          cacheTTL: 10000,
          retryAttempts: 2,
        });
        if (!alive) return;
        setThreeCounts(res?.data || null);
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
  }, [selectedThreeRoot, levels]);

  // ── 5-matrix progress from summary ──
  const fiveProgress = useMemo(() => {
    const arr = Array.isArray(data?.matrix_progress) ? data.matrix_progress : [];
    return (
      arr.find((p) => String(p?.pool_type).toUpperCase() === "FIVE_150") || null
    );
  }, [data]);

  // ── 3-matrix progress from summary ──
  const threeProgress = useMemo(() => {
    const arr = Array.isArray(data?.matrix_progress) ? data.matrix_progress : [];
    return (
      arr.find((p) => String(p?.pool_type).toUpperCase() === "THREE_150") || null
    );
  }, [data]);

  // ── Level counts fallback from tree walk ──
  useEffect(() => {
    const plc = fiveProgress?.per_level_counts || {};
    const has = plc && Object.keys(plc).length > 0;
    if (has) {
      setLevelCounts(plc);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const maxL = Math.max(1, Number(levels?.five ?? 10));
        const res = await API.get(
          `/accounts/my/matrix/tree/?max_depth=${encodeURIComponent(maxL)}`,
          { cacheTTL: 8000, retryAttempts: 1 }
        );
        if (cancelled) return;
        const tree = res?.data;
        if (!tree) return;
        const counts = {};
        for (let i = 1; i <= maxL; i += 1) counts[String(i)] = 0;
        const walk = (node) => {
          if (!node) return;
          const lvl = Number(node.level || 0);
          const idx = lvl - 1;
          if (idx >= 1 && idx <= maxL) {
            const k = String(idx);
            counts[k] = (counts[k] || 0) + 1;
          }
          (Array.isArray(node.children) ? node.children : []).forEach(walk);
        };
        walk(tree);
        setLevelCounts(counts);
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [fiveProgress, levels]);

  // ── Direct team: load when "directs" or "progress" tab activates ──
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (tab !== "progress" && tab !== "directs") return;
      try {
        setLoadingDirects(true);
        const res = await API.get("/accounts/team/summary/", {
          dedupe: "cancelPrevious",
        });
        const payload = res?.data || res;
        let list = Array.isArray(payload?.direct_team) ? payload.direct_team : [];
        let counts = payload?.direct_team_counts || null;
        const dcount = Math.max(0, Number(payload?.downline?.direct ?? 0));
        if ((!list || list.length === 0) && dcount > 0) {
          try {
            const r2 = await API.get("/accounts/users/", {
              params: { registered_by: "me", page_size: 200 },
              dedupe: "cancelPrevious",
            });
            const arr = Array.isArray(r2?.data?.results)
              ? r2.data.results
              : Array.isArray(r2?.data)
              ? r2.data
              : [];
            list = arr.map((x) => ({
              id: x?.id,
              username: x?.username,
              full_name: x?.full_name,
              account_active: !!x?.account_active,
              phone: x?.phone || "",
              pincode: x?.pincode || "",
              date_joined: x?.date_joined || null,
              direct_referrals: x?.direct_referrals ?? undefined,
            }));
            const a = list.filter((m) => !!m.account_active).length;
            counts = { active: a, inactive: Math.max(0, list.length - a) };
          } catch (_) {}
        }
        if (!alive) return;
        if (list && list.length) setDirectList(list);
        if (counts) setDirectCountsState(counts);
      } catch (_) {
      } finally {
        if (alive) setLoadingDirects(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [tab, directRefreshKey]);

  // ── Derived: myPositions ──
  const myPositions = useMemo(() => {
    try {
      return (Array.isArray(data?.my_positions) ? data.my_positions : []).map(
        (p) => ({
          id: p?.id,
          username_key: p?.username_key,
          pool_type: p?.pool_type,
          status: p?.status,
          level: p?.level,
          user_entry_index: p?.user_entry_index,
          source_type: p?.source_type || "",
          source_id: p?.source_id || "",
          inferred_category: p?.inferred_category || "",
          created_at: p?.created_at,
        })
      );
    } catch {
      return [];
    }
  }, [data]);

  // ── Derived: active 5-matrix roots list ──
  const fiveRootsList = useMemo(() => {
    try {
      const rows = myPositions.filter(
        (p) =>
          String(p?.pool_type) === "FIVE_150" &&
          String(p?.status || "").toUpperCase() === "ACTIVE"
      );
      return [...rows].sort(
        (a, b) =>
          new Date(a?.created_at || 0) - new Date(b?.created_at || 0)
      );
    } catch {
      return [];
    }
  }, [myPositions]);

  // ── Derived: active 3-matrix roots list ──
  const threeRootsList = useMemo(() => {
    try {
      const rows = myPositions.filter(
        (p) =>
          String(p?.pool_type) === "THREE_150" &&
          String(p?.status || "").toUpperCase() === "ACTIVE"
      );
      return [...rows].sort(
        (a, b) =>
          new Date(a?.created_at || 0) - new Date(b?.created_at || 0)
      );
    } catch {
      return [];
    }
  }, [myPositions]);

  // ── Auto-select first root ──
  useEffect(() => {
    if (!selectedRoot && fiveRootsList.length > 0) {
      setSelectedRoot(fiveRootsList[0]?.id || null);
    }
  }, [fiveRootsList, selectedRoot]);

  // ── Auto-select first 3-matrix root ──
  useEffect(() => {
    if (!selectedThreeRoot && threeRootsList.length > 0) {
      setSelectedThreeRoot(threeRootsList[0]?.id || null);
    }
  }, [threeRootsList, selectedThreeRoot]);

  // ── Derived: fiveLevelGrid ──
  const fiveLevelGrid = useMemo(() => {
    if (fiveCounts?.levels && Array.isArray(fiveCounts.levels)) {
      return fiveCounts.levels.map((x) => ({
        sn: Number(x.level),
        level: Number(x.level),
        count: Number(x.team_count || 0),
      }));
    }
    const plc = levelCounts || fiveProgress?.per_level_counts || {};
    const maxL = Math.max(1, Number(levels?.five ?? 10));
    return Array.from({ length: maxL }, (_, i) => ({
      sn: i + 1,
      level: i + 1,
      count: Math.max(0, parseInt(plc[String(i + 1)] ?? 0, 10) || 0),
    }));
  }, [fiveCounts, levelCounts, fiveProgress, levels]);

  // ── Derived: totalTeam ──
  const totalTeam = useMemo(
    () =>
      (fiveLevelGrid || []).reduce((acc, r) => acc + Number(r?.count || 0), 0),
    [fiveLevelGrid]
  );

  // ── Derived: activeLevelsReached ──
  const activeLevelsReached = useMemo(() => {
    let active = 0;
    for (let i = 1; i <= fiveLevelGrid.length; i += 1) {
      const row = fiveLevelGrid.find((r) => Number(r.level) === i);
      if (row && Number(row.count || 0) > 0) active = i;
      else break;
    }
    return active;
  }, [fiveLevelGrid]);

  // ── Derived: threeLevelGrid ──
  const threeLevelGrid = useMemo(() => {
    if (threeCounts?.levels && Array.isArray(threeCounts.levels)) {
      return threeCounts.levels.map((x) => ({
        sn: Number(x.level),
        level: Number(x.level),
        count: Number(x.team_count || 0),
      }));
    }
    const plc = threeProgress?.per_level_counts || {};
    const maxL = Math.max(1, Number(levels?.three ?? 15));
    return Array.from({ length: maxL }, (_, i) => ({
      sn: i + 1,
      level: i + 1,
      count: Math.max(0, parseInt(plc[String(i + 1)] ?? 0, 10) || 0),
    }));
  }, [threeCounts, threeProgress, levels]);

  // ── Derived: totalThreeTeam ──
  const totalThreeTeam = useMemo(
    () => (threeLevelGrid || []).reduce((acc, r) => acc + Number(r?.count || 0), 0),
    [threeLevelGrid]
  );

  // ── Derived: threeActiveLevelsReached ──
  const threeActiveLevelsReached = useMemo(() => {
    let active = 0;
    for (let i = 1; i <= threeLevelGrid.length; i += 1) {
      const row = threeLevelGrid.find((r) => Number(r.level) === i);
      if (row && Number(row.count || 0) > 0) active = i;
      else break;
    }
    return active;
  }, [threeLevelGrid]);

  // ── Derived: totalFiveEarning / totalThreeEarning ──
  const totalFiveEarning = useMemo(
    () => {
      // 1st priority: wallet-level totals from summary API
      const fromTotals = Number(data?.totals?.autopool_five || 0);
      if (fromTotals > 0) return fromTotals;
      // 2nd: UserMatrixProgress total_earned
      return Number(fiveProgress?.total_earned || 0);
    },
    [data, fiveProgress]
  );
  const totalThreeEarning = useMemo(
    () => {
      const fromTotals = Number(data?.totals?.autopool_three || 0);
      if (fromTotals > 0) return fromTotals;
      return Number(threeProgress?.total_earned || 0);
    },
    [data, threeProgress]
  );

  // ── Derived: directCount ──
  const directCount = useMemo(() => {
    try {
      const listLen = Array.isArray(directList) ? directList.length : 0;
      const listLenData = Array.isArray(data?.direct_team)
        ? data.direct_team.length
        : 0;
      const countsTotal =
        (Number(directCountsState?.active || 0) +
          Number(directCountsState?.inactive || 0)) ||
        0;
      const countsTotalData =
        (Number(data?.direct_team_counts?.active || 0) +
          Number(data?.direct_team_counts?.inactive || 0)) ||
        0;
      const down = data?.downline || {};
      const lvls = down?.levels || {};
      const l1 = typeof lvls?.l1 === "number" ? lvls.l1 : 0;
      const direct =
        typeof down?.direct === "number" ? down.direct : l1;
      return Math.max(
        0,
        Number(
          listLen ||
            listLenData ||
            countsTotal ||
            countsTotalData ||
            direct ||
            0
        )
      );
    } catch {
      return 0;
    }
  }, [data, directList, directCountsState]);

  // ── Resolved directList ──
  const resolvedDirectList = Array.isArray(directList)
    ? directList
    : Array.isArray(data?.direct_team)
    ? data.direct_team
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.appBg,
        fontFamily:
          "-apple-system, 'Poppins', BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ── Sticky shell: header + tab bar ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 200,
          background: C.surface,
          boxShadow: "0 1px 10px rgba(0,0,0,0.08)",
        }}
      >
        <AppHeader role={role} err={err} />
        <AppTabBar active={tab} onChange={switchTab} />
      </div>

      {/* ── Scrollable + swipeable content ── */}
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              style={{
                maxWidth: 480,
                margin: "0 auto",
                padding: "16px 16px 64px",
              }}
            >
              {/* ── Direct Sponsor Tab ── */}
              {tab === "directs" && (
                <DirectSponsorTab
                  directList={resolvedDirectList}
                  loading={loadingDirects}
                  onRefresh={() => setDirectRefreshKey((k) => k + 1)}
                />
              )}

              {/* ── 5 Matrix & Chart Tab ── */}
              {tab === "five_matrix" && (
                <FiveMatrixTab
                  fiveRootsList={fiveRootsList}
                  selectedRoot={selectedRoot}
                  setSelectedRoot={setSelectedRoot}
                  fiveCategory={fiveCategory}
                  setFiveCategory={setFiveCategory}
                  fiveLevelGrid={fiveLevelGrid}
                  fiveCounts={fiveCounts}
                  totalTeam={totalTeam}
                  activeLevelsReached={activeLevelsReached}
                  totalFiveEarning={totalFiveEarning}
                  levels={levels}
                />
              )}

              {/* ── 3 Matrix Tree Tab ── */}
              {tab === "three_matrix" && (
                <ThreeMatrixTab
                  threeRootsList={threeRootsList}
                  selectedThreeRoot={selectedThreeRoot}
                  setSelectedThreeRoot={setSelectedThreeRoot}
                  threeCategory={threeCategory}
                  setThreeCategory={setThreeCategory}
                  threeLevelGrid={threeLevelGrid}
                  threeCounts={threeCounts}
                  totalThreeTeam={totalThreeTeam}
                  activeLevelsReached={threeActiveLevelsReached}
                  totalThreeEarning={totalThreeEarning}
                  levels={levels}
                />
              )}

              {/* ── Earnings Tab ── */}
              {tab === "earnings" && (
                <EarningsTab
                  rankMx={rankMx}
                  rankMxLoading={rankMxLoading}
                  rankMxErr={rankMxErr}
                  onRefresh={refetchRankMx}
                  directList={resolvedDirectList}
                />
              )}

              {/* ── Progress Tab ── */}
              {tab === "progress" && (
                <ProgressTab
                  fiveLevelGrid={fiveLevelGrid}
                  activeLevelsReached={activeLevelsReached}
                  totalTeam={totalTeam}
                  directCount={directCount}
                  directCountsState={
                    directCountsState || data?.direct_team_counts
                  }
                  directList={resolvedDirectList}
                  myPositions={myPositions}
                  loadingDirects={loadingDirects}
                  onRefreshDirects={() =>
                    setDirectRefreshKey((k) => k + 1)
                  }
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}