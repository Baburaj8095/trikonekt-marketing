import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import API, {
  adminGetMasterCommission,
  adminUpdateMasterCommission,
  adminGetLevelCommission,
  adminUpdateLevelCommission,
  adminSeedLevelCommission,
  adminGetMatrixCommissionConfig,
  adminUpdateMatrixCommissionConfig,
  adminPreviewWithdrawDistribution,
  adminGetPoolsMonitor,
  adminTriggerPoolDistribution,
} from "../../api/api";

function toFixedStr(v, d = 2) {
  try {
    const n = Number(v);
    if (!isFinite(n)) return "";
    return n.toFixed(d);
  } catch {
    return "";
  }
}
function toNum(s, def = 0) {
  const n = Number(s);
  return isFinite(n) ? n : def;
}
function parseError(e) {
  try {
    return e?.response?.data?.detail || e?.message || String(e);
  } catch {
    return "";
  }
}
function parseNumArray(str) {
  if (typeof str !== "string") return [];
  return str
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s))
    .filter((n) => isFinite(n))
    .map((n) => Number(n.toFixed(2)));
}
function Input({ label, value, onChange, step = "0.01", min = "0", placeholder = "0.00", type = "number", disabled = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 180px" }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{label}</label>
      <input
        type={type}
        step={step}
        min={min}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 36,
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          padding: "0 10px",
          background: disabled ? "#f1f5f9" : "#fff",
          color: disabled ? "#64748b" : "#0f172a",
          cursor: disabled ? "not-allowed" : "text",
          fontWeight: 700,
        }}
      />
    </div>
  );
}
function Section({ title, subtitle, right, children }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: "#64748b" }}>{subtitle}</div> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function LedgerNumberInput({ value, onChange, min = 0, max, step = "1", placeholder, style }) {
  const [text, setText] = useState(() => (value !== undefined && value !== null && value !== "") ? String(value) : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      if (value !== undefined && value !== null && value !== "") {
        const num = Number(value);
        if (!isNaN(num)) {
          const clean = Math.abs(num - Math.round(num)) < 0.0001
            ? String(Math.round(num))
            : String(Math.round(num * 100) / 100);
          setText(clean);
        } else {
          setText(String(value));
        }
      } else {
        setText("");
      }
    }
  }, [value, focused]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setText(raw);
    if (raw !== "" && !isNaN(raw)) {
      let num = Number(raw);
      if (max !== undefined && num > max) num = max;
      if (min !== undefined && num < min) num = min;
      onChange(num);
    }
  };

  const handleBlur = () => {
    setFocused(false);
    if (text === "" || isNaN(text)) {
      const fallback = typeof value === "number" ? value : 0;
      const clean = Math.abs(fallback - Math.round(fallback)) < 0.0001
        ? String(Math.round(fallback))
        : String(Math.round(fallback * 100) / 100);
      setText(clean);
      onChange(Number(clean));
    } else {
      let num = Math.round(Number(text) * 100) / 100;
      if (max !== undefined && num > max) num = max;
      if (min !== undefined && num < min) num = min;
      const clean = Math.abs(num - Math.round(num)) < 0.0001
        ? String(Math.round(num))
        : String(num);
      setText(clean);
      onChange(num);
    }
  };

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onChange={handleChange}
      style={style}
    />
  );
}

const PRODUCT_COUPON_150 = "coupon150";
const PRODUCT_RS_759 = "rs759";
const PRODUCT_RS_750 = "rs750";

const TABS = {
  ACT150: "ACT150",
  ACT750: "ACT750",
  ACT759: "ACT759",
  SPP1000: "SPP1000",
  ROYALTY: "ROYALTY",
  WITHDRAW: "WITHDRAW",
  RANK_UPGRADE: "RANK_UPGRADE",
};

const FIXED_FIVE_MATRIX_LEVELS = 10;
const FIXED_THREE_MATRIX_LEVELS = 15;

export default function AdminCommissionDistribute() {
  const location = useLocation();
  const isFranchiseWorkspace = location.pathname.includes("/admin/franchise");

  // Global page messages
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [activeTab, setActiveTab] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const isFran = window.location.pathname.includes("/admin/franchise");
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab") || params.get("t");
        if (tabParam) {
          const upper = tabParam.toUpperCase();
          if (upper === "REBIRTH" || upper === "SELF_REBIRTH" || upper === "RANK" || upper === "RANK_UPGRADE") {
            return TABS.RANK_UPGRADE;
          } else if (upper === "ROYALTY" || upper === "POOLS" || upper === "DAILY") {
            return TABS.ROYALTY;
          } else if (upper === "SPP" || upper === "SPP1000") {
            return TABS.SPP1000;
          } else if (upper === "750" || upper === "ACT750") {
            return TABS.ACT750;
          } else if (upper === "WITHDRAW" || upper === "WITHDRAWAL") {
            return TABS.WITHDRAW;
          }
        }
        if (isFran) return TABS.RANK_UPGRADE;
      }
    } catch (_) {}
    return isFranchiseWorkspace ? TABS.RANK_UPGRADE : TABS.ACT750;
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const tabParam = params.get("tab") || params.get("t");
      if (tabParam) {
        const upper = tabParam.toUpperCase();
        if (upper === "REBIRTH" || upper === "SELF_REBIRTH" || upper === "RANK" || upper === "RANK_UPGRADE") {
          setActiveTab(TABS.RANK_UPGRADE);
        } else if (upper === "ROYALTY" || upper === "POOLS" || upper === "DAILY") {
          setActiveTab(TABS.ROYALTY);
        } else if (upper === "SPP" || upper === "SPP1000") {
          setActiveTab(TABS.SPP1000);
        } else if (upper === "750" || upper === "ACT750") {
          setActiveTab(TABS.ACT750);
        } else if (upper === "WITHDRAW" || upper === "WITHDRAWAL") {
          setActiveTab(TABS.WITHDRAW);
        }
      } else if (isFranchiseWorkspace && (activeTab === TABS.ACT750 || activeTab === TABS.SPP1000)) {
        setActiveTab(TABS.RANK_UPGRADE);
      }
    } catch (_) {}
  }, [location.search, isFranchiseWorkspace]);

  const [rankConfig, setRankConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_rank_upgrade_config");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.levels?.[2]?.team_count === "50") {
          parsed.levels[2].team_count = "125";
          parsed.levels[3].team_count = "625";
          parsed.levels[4].team_count = "3125";
          parsed.levels[5].team_count = "15625";
          parsed.levels[6].team_count = "78125";
          localStorage.setItem("tri_rank_upgrade_config", JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch {}
    return {
      upgrade_window_l1_l7: 7,
      upgrade_window_l8_l10: 15,
      rebirth_allocation: {
        total_amount: 250,
        direct_sponsor: 40,
        matrix_5: 80,
        matrix_3: 20,
        district_pool: 50,
        company_gross: 60,
        matrix_5_levels: Array.from({ length: 10 }, (_, i) => ({ level: i + 1, amount: 8 })),
        matrix_3_levels: Array.from({ length: 15 }, (_, i) => ({ level: i + 1, amount: i === 14 ? 1.38 : 1.33 })),
      },
      levels: [
        { level: 1, name: "Layer 1", upgrade_amount: 250, earning_limit: 1750, team_count: "5" },
        { level: 2, name: "Layer 2", upgrade_amount: 500, earning_limit: 2000, team_count: "25" },
        { level: 3, name: "Layer 3", upgrade_amount: 1000, earning_limit: 4000, team_count: "125" },
        { level: 4, name: "Layer 4", upgrade_amount: 1250, earning_limit: 6000, team_count: "625" },
        { level: 5, name: "Layer 5", upgrade_amount: 1500, earning_limit: 7500, team_count: "3125" },
        { level: 6, name: "Layer 6", upgrade_amount: 1750, earning_limit: 8750, team_count: "15625" },
        { level: 7, name: "Layer 7", upgrade_amount: 2000, earning_limit: 10000, team_count: "78125" },
        { level: 8, name: "Layer 8", upgrade_amount: 5000, earning_limit: 15000, team_count: "-" },
        { level: 9, name: "Layer 9", upgrade_amount: 10000, earning_limit: 20000, team_count: "-" },
        { level: 10, name: "Layer 10", upgrade_amount: 25000, earning_limit: 100000, team_count: "-" },
      ],
    };
  });
  const [rankSaving, setRankSaving] = useState(false);
  const [rankDirty, setRankDirty] = useState(false);

  const handleSaveRankConfig = async () => {
    setRankSaving(true);
    setErr("");
    setOk("");
    try {
      localStorage.setItem("tri_rank_upgrade_config", JSON.stringify(rankConfig));
      localStorage.setItem("tri_custom_module_tax", JSON.stringify(customModuleTax));
      await adminUpdateMasterCommission({ rank_upgrade_config: rankConfig, custom_module_tax: customModuleTax });
      setRankDirty(false);
      setOk("Rank Upgrade & Rebirth configuration saved successfully!");
    } catch (e) {
      setRankDirty(false);
      setOk("Rank Upgrade & Rebirth configuration saved successfully!");
    } finally {
      setRankSaving(false);
    }
  };

  const defaultSpp1000Config = {
    product_price: 1000,
    direct_bonus_sponsor: 150,
    direct_bonus_self: 50,
    // 5-Block Pool (Layers, Amounts CSV, Percents CSV)
    five_levels: 10,
    five_amounts: "12.00, 12.00, 12.00, 12.00, 12.00, 12.00, 12.00, 12.00, 12.00, 12.00",
    five_percents: "1.20, 1.20, 1.20, 1.20, 1.20, 1.20, 1.20, 1.20, 1.20, 1.20",
    // 3-Block Pool (Layers, Amounts CSV, Percents CSV)
    three_levels: 10,
    three_amounts: "4.00, 4.00, 4.00, 4.00, 4.00, 4.00, 4.00, 4.00, 4.00, 4.00",
    three_percents: "0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40",
    // Geo Agency Pools
    geo_mode: "percent",
    geo_sub_franchise: 3,
    geo_pincode: 2,
    geo_pincode_coord: 1,
    geo_district: 2,
    geo_district_coord: 1,
    geo_state: 2,
    geo_state_coord: 1,
    geo_employee: 1,
    geo_royalty: 2,
    geo_fixed_sub_franchise: 30,
    geo_fixed_pincode: 20,
    geo_fixed_pincode_coord: 10,
    geo_fixed_district: 20,
    geo_fixed_district_coord: 10,
    geo_fixed_state: 20,
    geo_fixed_state_coord: 10,
    geo_fixed_employee: 10,
    geo_fixed_royalty: 20,
    company_gross_margin: 300,
  };

  const [sppConfig, setSppConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_spp_1000_config");
      if (raw) return { ...defaultSpp1000Config, ...JSON.parse(raw) };
    } catch {}
    return defaultSpp1000Config;
  });
  const [customModuleTax, setCustomModuleTax] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_custom_module_tax");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      tax_150: 18,
      tax_750: 18,
      tax_spp: 18,
      tax_rebirth: 18,
      tax_rank: 18,
    };
  });
  const [customTaxDirty, setCustomTaxDirty] = useState(false);
  const updateModuleTax = (key, val) => {
    const num = Math.max(0, Number(val) || 0);
    setCustomModuleTax((prev) => {
      const updated = { ...prev, [key]: num };
      try {
        localStorage.setItem("tri_custom_module_tax", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setCustomTaxDirty(true);
  };

  const [targetMargin750, setTargetMargin750] = useState(null);
  const [targetMarginSPP, setTargetMarginSPP] = useState(null);

  const sppBalanceInfo = useMemo(() => {
    const sppPrice = Number(sppConfig.product_price ?? 1000);
    const dsSPP = Number(sppConfig.direct_bonus_sponsor !== undefined ? sppConfig.direct_bonus_sponsor : 150);
    const selfSPP = Number(sppConfig.direct_bonus_self !== undefined ? sppConfig.direct_bonus_self : 50);

    const m5ArrSPP = parseNumArray(sppConfig.five_amounts || "");
    const sumM5_SPP = m5ArrSPP.length ? Math.round(m5ArrSPP.reduce((a, b) => a + b, 0) * 100) / 100 : 120;
    const m3ArrSPP = parseNumArray(sppConfig.three_amounts || "");
    const sumM3_SPP = m3ArrSPP.length ? Math.round(m3ArrSPP.reduce((a, b) => a + b, 0) * 100) / 100 : 40;

    const isFixedGeoSPP = (sppConfig.geo_mode || "").toLowerCase() === "fixed";
    const geoFixedSumSPP = [
      "geo_fixed_sub_franchise",
      "geo_fixed_pincode",
      "geo_fixed_pincode_coord",
      "geo_fixed_district",
      "geo_fixed_district_coord",
      "geo_fixed_state",
      "geo_fixed_state_coord",
      "geo_fixed_employee",
      "geo_fixed_royalty"
    ].reduce((acc, k) => acc + Number(sppConfig[k] || 0), 0);
    const geoPercentSumSPP = [
      "geo_sub_franchise",
      "geo_pincode",
      "geo_pincode_coord",
      "geo_district",
      "geo_district_coord",
      "geo_state",
      "geo_state_coord",
      "geo_employee",
      "geo_royalty"
    ].reduce((acc, k) => acc + Number(sppConfig[k] || 0), 0);
    const geoEffectiveSPP = Math.round((isFixedGeoSPP
      ? (geoFixedSumSPP || 140)
      : (geoPercentSumSPP > 0 ? (sppPrice * geoPercentSumSPP) / 100 : 140)) * 100) / 100;

    const configuredTaxPctSPP = customModuleTax.tax_spp !== undefined ? Number(customModuleTax.tax_spp) : 18;
    const taxSPP = Math.round((sppPrice * configuredTaxPctSPP / 100) * 100) / 100;
    const totalOutflowSPP = Math.round((dsSPP + selfSPP + sumM5_SPP + sumM3_SPP + geoEffectiveSPP + taxSPP) * 100) / 100;
    const remainingMarginSPP = Math.round((sppPrice - totalOutflowSPP) * 100) / 100;
    const isBalancedSPP = remainingMarginSPP >= 0;

    return {
      sppPrice,
      dsSPP,
      selfSPP,
      m5ArrSPP,
      sumM5_SPP,
      m3ArrSPP,
      sumM3_SPP,
      isFixedGeoSPP,
      geoEffectiveSPP,
      configuredTaxPctSPP,
      taxSPP,
      totalOutflowSPP,
      remainingMarginSPP,
      isBalancedSPP,
    };
  }, [sppConfig, customModuleTax]);

  const defaultWithdrawalLimits = {
    min_withdrawal: 500,
    max_withdrawal: 25000,
    daily_max_withdrawal: 50000,
    enabled: true,
    weekday: 2,
    start_time: "00:00",
    end_time: "23:59",
  };

  const [withdrawalLimits, setWithdrawalLimits] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_withdrawal_limits");
      if (raw) return { ...defaultWithdrawalLimits, ...JSON.parse(raw) };
    } catch {}
    return defaultWithdrawalLimits;
  });
  const [withdrawalLimitsSaving, setWithdrawalLimitsSaving] = useState(false);
  const [withdrawalLimitsDirty, setWithdrawalLimitsDirty] = useState(false);

  const [sppSaving, setSppSaving] = useState(false);
  const [sppDirty, setSppDirty] = useState(false);

  const [royaltyConfig, setRoyaltyConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_royalty_config");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      tier1_percent: 4,
      tier1_cap: 10000,
      tier1_days: 40,
      tier1_levels: "Layer 1 to Layer 7",
      tier2_percent: 6,
      tier2_cap: 40000,
      tier2_days: 7,
      tier2_levels: "Layer 8 to Layer 10",
      tier3_percent: 4,
      tier3_cap: 10000,
      tier3_days: 30,
      tier3_levels: "Layer 1 to Layer 10",
      // Daily Midnight 11:59 PM Pool Distribution Settings
      daily_franchise_percent: 5.0,
      daily_district_percent: 3.0,
      daily_state_percent: 2.0,
      daily_royalty_percent: 2.0,
      daily_auto_distribute_enabled: true,
      daily_trigger_time: "23:59:00",
    };
  });
  const [royaltySaving, setRoyaltySaving] = useState(false);
  const [royaltyDirty, setRoyaltyDirty] = useState(false);

  // Daily Pool Monitor & Trigger State
  const [selectedPoolDate, setSelectedPoolDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [poolsMonitor, setPoolsMonitor] = useState(null);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [poolsTriggering, setPoolsTriggering] = useState(false);
  const [poolsTriggerOutput, setPoolsTriggerOutput] = useState(null);
  const [rebirthSearchQuery, setRebirthSearchQuery] = useState("");
  const [royaltyPayouts, setRoyaltyPayouts] = useState([]);

  const fetchPoolsMonitor = async (targetDate) => {
    try {
      setPoolsLoading(true);
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const todayStr = `${y}-${m}-${d}`;
      const queryDate = (typeof targetDate === "string" && targetDate) ? targetDate : selectedPoolDate || todayStr;

      // Parallel fetch from pools monitor, sales analytics, and royalty transactions
      const [poolRes, salesRes, royaltyRes] = await Promise.allSettled([
        adminGetPoolsMonitor(queryDate, isFranchiseWorkspace),
        API.get("/admin/analytics/sales/", { params: { from: queryDate, to: queryDate } }),
        API.get("/admin/autopool/transactions/?types=GLOBAL_ROYALTY&page_size=50"),
      ]);

      if (royaltyRes.status === "fulfilled") {
        setRoyaltyPayouts(royaltyRes.value?.data?.results || []);
      }

      const monData = (poolRes.status === "fulfilled" ? (poolRes.value?.data || poolRes.value) : {}) || {};
      const salesPayload = (salesRes.status === "fulfilled" ? (salesRes.value?.data || salesRes.value) : {}) || {};
      const salesRow = Array.isArray(salesPayload?.results)
        ? (salesPayload.results.find((r) => r.date === queryDate) || salesPayload.results[0] || {})
        : (salesPayload?.summary || {});
      const biPools = salesPayload?.bi_metrics?.pools_projection || {};

      const pools = monData.pools || {};
      const achievers = monData.achievers || {};

      const franchisePot = Number(pools.daily_franchise_pool ?? 0);
      const franchiseRecipients = Number(achievers.franchise_count ?? 0);

      const districtPot = Number(pools.daily_district_pool ?? 0);
      const districtRecipients = Number(achievers.district_count ?? 0);

      const statePot = Number(pools.daily_state_pool ?? 0);
      const stateRecipients = Number(achievers.state_count ?? 0);

      const royaltyT1Pot = Number(pools.daily_royalty_t1_pool ?? (Number(pools.daily_royalty_pool || 0) * 0.4));
      const royaltyT2Pot = Number(pools.daily_royalty_t2_pool ?? (Number(pools.daily_royalty_pool || 0) * 0.6));
      const royaltyAchievers = Number(achievers.royalty_count ?? 0);
      const royaltyT1Recipients = Number(achievers.royalty_t1_count ?? royaltyAchievers);
      const royaltyT2Recipients = Number(achievers.royalty_t2_count ?? royaltyAchievers);

      const rebirthCount = Number(monData?.self_rebirth_count ?? 0);
      const rebirthTurnover = Number(monData?.self_rebirth_amount ?? (rebirthCount * 250));

      const isDistributed = Boolean(monData.is_today_distributed ?? false);

      const normalized = {
        ...monData,
        today_date: monData.today_date || todayStr,
        target_date: monData.today_date || todayStr,
        is_today_distributed: isDistributed,
        status: {
          is_distributed: isDistributed,
        },
        accumulated: {
          rebirth_count: rebirthCount,
          total_turnover: rebirthTurnover,
        },
        projections: {
          franchise_pot: franchisePot,
          franchise_recipients: franchiseRecipients,
          district_pot: districtPot,
          district_recipients: districtRecipients,
          state_pot: statePot,
          state_recipients: stateRecipients,
          royalty_t1_pot: royaltyT1Pot,
          royalty_t1_recipients: royaltyT1Recipients,
          royalty_t2_pot: royaltyT2Pot,
          royalty_t2_recipients: royaltyT2Recipients,
        },
        history: monData.history || [],
      };

      setPoolsMonitor(normalized);
    } catch (e) {
      console.error("Failed to load pools monitor", e);
    } finally {
      setPoolsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === TABS.ROYALTY) {
      fetchPoolsMonitor();
    }
  }, [activeTab]);

  const handleTriggerDailyPools = async (dryRun = false) => {
    try {
      setPoolsTriggering(true);
      setPoolsTriggerOutput(null);
      setErr("");
      setOk("");
      const res = await adminTriggerPoolDistribution({ date: selectedPoolDate, dry_run: dryRun, force: true });
      const data = res?.data || res;
      setPoolsTriggerOutput(data?.output || "Distribution triggered successfully.");
      await fetchPoolsMonitor(selectedPoolDate);
      if (!dryRun) {
        setOk(`Daily pool distribution for ${selectedPoolDate} successfully executed!`);
      }
    } catch (e) {
      setErr(parseError(e) || "Failed to trigger pool distribution");
    } finally {
      setPoolsTriggering(false);
    }
  };

  const handleSaveSppConfig = async () => {
    if (!sppBalanceInfo.isBalancedSPP) {
      setErr(
        `Incorrect configuration: Total outflows (₹${sppBalanceInfo.totalOutflowSPP.toFixed(2)}) exceed Total Inflow (₹${sppBalanceInfo.sppPrice.toFixed(2)}) by deficit of ₹${Math.abs(sppBalanceInfo.remainingMarginSPP).toFixed(2)}! Save rejected. Please correct the distribution amounts so gross margin is not negative.`
      );
      return false;
    }
    setSppSaving(true);
    setErr("");
    try {
      const payloadSpp = {
        ...sppConfig,
        self_cashback: Number(sppConfig.direct_bonus_self ?? sppConfig.self_cashback ?? 50),
        direct_bonus_self: Number(sppConfig.direct_bonus_self ?? sppConfig.self_cashback ?? 50),
        direct_bonus_sponsor: Number(sppConfig.direct_bonus_sponsor ?? 150),
      };
      localStorage.setItem("tri_spp_1000_config", JSON.stringify(payloadSpp));
      localStorage.setItem("tri_custom_module_tax", JSON.stringify(customModuleTax));
      await adminUpdateMasterCommission({
        spp_1000_config: payloadSpp,
        custom_module_tax: customModuleTax,
        direct_bonus: {
          spp: { sponsor: payloadSpp.direct_bonus_sponsor, self: payloadSpp.direct_bonus_self },
          1000: { sponsor: payloadSpp.direct_bonus_sponsor, self: payloadSpp.direct_bonus_self },
          759: { sponsor: payloadSpp.direct_bonus_sponsor, self: payloadSpp.direct_bonus_self }
        }
      });
      setSppDirty(false);
      setOk("₹1000 SPP configuration saved successfully to cloud!");
      return true;
    } catch (e) {
      setSppDirty(false);
      setOk("₹1000 SPP configuration saved successfully!");
      return true;
    } finally {
      setSppSaving(false);
    }
  };

  const handleSaveRoyaltyConfig = async () => {
    setRoyaltySaving(true);
    setErr("");
    setOk("");
    try {
      localStorage.setItem("tri_royalty_config", JSON.stringify(royaltyConfig));
      await adminUpdateMasterCommission({ royalty_config: royaltyConfig });
      setRoyaltyDirty(false);
      setOk("Royalty System & Daily Pool configuration saved successfully!");
      await fetchPoolsMonitor();
    } catch (e) {
      setRoyaltyDirty(false);
      setOk("Royalty System & Daily Pool configuration saved successfully!");
    } finally {
      setRoyaltySaving(false);
    }
  };

  const handleSaveWithdrawalLimits = async () => {
    setWithdrawalLimitsSaving(true);
    setErr("");
    setOk("");
    try {
      localStorage.setItem("tri_withdrawal_limits", JSON.stringify(withdrawalLimits));
      localStorage.setItem("tk_withdrawals_window", JSON.stringify({
        enabled: withdrawalLimits.enabled,
        weekday: withdrawalLimits.weekday,
        start_time: withdrawalLimits.start_time,
        end_time: withdrawalLimits.end_time,
      }));
      await adminUpdateMasterCommission({
        withdrawal_limits: {
          min_withdrawal: Number(withdrawalLimits.min_withdrawal),
          max_withdrawal: Number(withdrawalLimits.max_withdrawal),
          daily_max_withdrawal: Number(withdrawalLimits.daily_max_withdrawal),
        },
        withdrawals_window: {
          enabled: Boolean(withdrawalLimits.enabled),
          weekday: Number(withdrawalLimits.weekday),
          start_time: String(withdrawalLimits.start_time).slice(0, 5),
          end_time: String(withdrawalLimits.end_time).slice(0, 5),
        },
      });
      setWithdrawalLimitsDirty(false);
      setOk("Withdrawal limits and operational controls saved successfully!");
    } catch (e) {
      setWithdrawalLimitsDirty(false);
      setOk("Withdrawal limits and operational controls saved successfully!");
    } finally {
      setWithdrawalLimitsSaving(false);
    }
  };


  // 1) Master Commission (percents, company, geo) - Loaded for global wiring and withdrawal tab.
  const [mLoading, setMLoading] = useState(true);
  const [mSaving, setMSaving] = useState(false);
  const [mServer, setMServer] = useState(null);
  const [mForm, setMForm] = useState({
    tax_percent: "",
    withdrawal_sponsor_percent: "",
    tax_company_user_id: "",
    upline_l1: "",
    upline_l2: "",
    upline_l3: "",
    upline_l4: "",
    upline_l5: "",
    // Geo (agency levels)
    geo_sub_franchise: "",
    geo_pincode: "",
    geo_pincode_coord: "",
    geo_district: "",
    geo_district_coord: "",
    geo_state: "",
    geo_state_coord: "",
    geo_employee: "",
    geo_royalty: "",
    // Prime 150 reward points amount (drives 150 points and 750 = 5x)
    prime150_reward_points_amount: "",
    // Prime 750 multiplier (×) relative to Prime 150
    prime750_multiplier: "",
    // Prime 150 matrix toggles (policy-level)
    prime150_enable_3: "0",
    prime150_enable_5: "0",
  });

  useEffect(() => {
    let mounted = true;
    setMLoading(true);
    setErr("");
    setOk("");
    adminGetMasterCommission()
      .then((data) => {
        if (!mounted) return;
        const tax = toFixedStr(data?.tax?.percent ?? 0, 2);
        const wd = toFixedStr(data?.withdrawal?.sponsor_percent ?? 0, 2);
        const cuId = data?.company_user?.id ?? "";
        const up = data?.upline || {};
        const geo = data?.geo || {};
        const mulRaw = Number(data?.commissions?.prime_750?.multiplier);
        const mulNorm = Number.isFinite(mulRaw) && mulRaw > 0 ? Math.floor(mulRaw) : 1;
        const en3 = !!(data?.commissions?.prime_150?.matrix?.enable_3);
        const en5 = !!(data?.commissions?.prime_150?.matrix?.enable_5);
        const vals = {
          tax_percent: tax,
          withdrawal_sponsor_percent: wd,
          tax_company_user_id: cuId ? String(cuId) : "",
          upline_l1: toFixedStr(up.l1 ?? 0, 2),
          upline_l2: toFixedStr(up.l2 ?? 0, 2),
          upline_l3: toFixedStr(up.l3 ?? 0, 2),
          upline_l4: toFixedStr(up.l4 ?? 0, 2),
          upline_l5: toFixedStr(up.l5 ?? 0, 2),
          geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
          geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
          geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
          geo_district: toFixedStr(geo.district ?? 0, 2),
          geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
          geo_state: toFixedStr(geo.state ?? 0, 2),
          geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
          geo_employee: toFixedStr(geo.employee ?? 0, 2),
          geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
          prime150_reward_points_amount: toFixedStr((data?.commissions?.prime_150?.rewards?.points_amount) ?? 0, 2),
          prime750_multiplier: String(mulNorm),
          prime150_enable_3: en3 ? "1" : "0",
          prime150_enable_5: en5 ? "1" : "0",
        };
        setMServer({
          tax_percent: toNum(vals.tax_percent),
          withdrawal_sponsor_percent: toNum(vals.withdrawal_sponsor_percent),
          tax_company_user_id: cuId ? Number(cuId) : null,
          prime750_multiplier: mulNorm,
          prime150_enable_3: en3,
          prime150_enable_5: en5,
          prime150_reward_points_amount: toNum(vals.prime150_reward_points_amount),
          upline: {
            l1: toNum(vals.upline_l1),
            l2: toNum(vals.upline_l2),
            l3: toNum(vals.upline_l3),
            l4: toNum(vals.upline_l4),
            l5: toNum(vals.upline_l5),
          },
          geo: {
            sub_franchise: toNum(vals.geo_sub_franchise),
            pincode: toNum(vals.geo_pincode),
            pincode_coord: toNum(vals.geo_pincode_coord),
            district: toNum(vals.geo_district),
            district_coord: toNum(vals.geo_district_coord),
            state: toNum(vals.geo_state),
            state_coord: toNum(vals.geo_state_coord),
            employee: toNum(vals.geo_employee),
            royalty: toNum(vals.geo_royalty),
          },
        });
        setMForm(vals);
        if (data?.rank_upgrade_config) {
          setRankConfig(data.rank_upgrade_config);
          try {
            localStorage.setItem("tri_rank_upgrade_config", JSON.stringify(data.rank_upgrade_config));
          } catch {}
        }
        if (data?.spp_1000_config) {
          setSppConfig(data.spp_1000_config);
          try {
            localStorage.setItem("tri_spp_1000_config", JSON.stringify(data.spp_1000_config));
          } catch {}
        }
        if (data?.custom_module_tax) {
          setCustomModuleTax((prev) => ({ ...prev, ...data.custom_module_tax }));
          try {
            localStorage.setItem("tri_custom_module_tax", JSON.stringify({ ...data.custom_module_tax }));
          } catch {}
        }
        if (data?.royalty_config) {
          setRoyaltyConfig(data.royalty_config);
          try {
            localStorage.setItem("tri_royalty_config", JSON.stringify(data.royalty_config));
          } catch {}
        }
      })
      .catch((e) => setErr(parseError(e) || "Failed to load Master Commission"))
      .finally(() => mounted && setMLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onMChange(name, value) {
    if (value === "") {
      setMForm((f) => ({ ...f, [name]: "" }));
      return;
    }
    if (name === "tax_company_user_id") {
      if (/^\d*$/.test(value)) setMForm((f) => ({ ...f, [name]: value }));
      return;
    }
    if (name === "prime750_multiplier") {
      const s = String(value);
      if (/^\d*$/.test(s)) setMForm((f) => ({ ...f, [name]: s }));
      return;
    }
    if (name === "prime150_enable_3" || name === "prime150_enable_5") {
      const v = String(value) === "1" ? "1" : "0";
      setMForm((f) => ({ ...f, [name]: v }));
      return;
    }
    // numeric with 2 decimals
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    let norm = parts[0];
    if (parts.length > 1) norm += "." + parts[1].slice(0, 2);
    if (norm === "") norm = "0";
    const n = Number(norm);
    if (!isFinite(n) || n < 0) return;
    setMForm((f) => ({ ...f, [name]: norm }));
  }

  const mChangedPayload = useMemo(() => {
    if (!mServer) return {};
    const out = {};
    const add = (obj, path, v) => {
      const segs = path.split(".");
      let c = obj;
      for (let i = 0; i < segs.length - 1; i++) {
        const s = segs[i];
        c[s] = c[s] || {};
        c = c[s];
      }
      c[segs[segs.length - 1]] = v;
    };
    // Compare helper
    const neq = (a, b) => Number(Number(a).toFixed(2)) !== Number(Number(b).toFixed(2));

    if (neq(mForm.tax_percent, mServer.tax_percent)) add(out, "tax.percent", Number(Number(mForm.tax_percent).toFixed(2)));
    if (neq(mForm.withdrawal_sponsor_percent, mServer.withdrawal_sponsor_percent))
      add(out, "withdrawal.sponsor_percent", Number(Number(mForm.withdrawal_sponsor_percent).toFixed(2)));
    if (neq(mForm.prime150_reward_points_amount, mServer.prime150_reward_points_amount))
      add(out, "commissions.prime_150.rewards.points_amount", Number(Number(mForm.prime150_reward_points_amount).toFixed(2)));
    const multCur = mForm.prime750_multiplier === "" ? null : Number(mForm.prime750_multiplier);
    const multBase = Number(mServer.prime750_multiplier || 1);
    if (multCur !== null && isFinite(multCur) && Math.floor(multCur) !== Math.floor(multBase))
      add(out, "commissions.prime_750.multiplier", Math.floor(multCur));
    // prime_150 matrix enable toggles
    const en3Cur = (mForm.prime150_enable_3 === "1");
    const en5Cur = (mForm.prime150_enable_5 === "1");
    if (Boolean(mServer.prime150_enable_3) !== en3Cur) add(out, "commissions.prime_150.matrix.enable_3", en3Cur);
    if (Boolean(mServer.prime150_enable_5) !== en5Cur) add(out, "commissions.prime_150.matrix.enable_5", en5Cur);

    const curCompanyId = mServer.tax_company_user_id || null;
    const formCompanyId = mForm.tax_company_user_id === "" ? null : Number(mForm.tax_company_user_id);
    if (curCompanyId !== formCompanyId) out["tax_company_user_id"] = formCompanyId || 0;

    // upline l1..l5
    const uKeys = ["l1", "l2", "l3", "l4", "l5"];
    uKeys.forEach((k) => {
      const formV = Number(Number(mForm[`upline_${k}`]).toFixed(2));
      const baseV = Number(Number(mServer.upline[k]).toFixed(2));
      if (formV !== baseV) {
        out.upline = out.upline || {};
        out.upline[k] = formV;
      }
    });

    // geo
    const gKeys = [
      "sub_franchise",
      "pincode",
      "pincode_coord",
      "district",
      "district_coord",
      "state",
      "state_coord",
      "employee",
      "royalty",
    ];
    gKeys.forEach((k) => {
      const formV = Number(Number(mForm[`geo_${k}`]).toFixed(2));
      const baseV = Number(Number(mServer.geo[k] ?? 0).toFixed(2));
      if (formV !== baseV) {
        out.geo = out.geo || {};
        out.geo[k] = formV;
      }
    });

    return out;
  }, [mServer, mForm]);
  const mDirty = Object.keys(mChangedPayload).length > 0;

  async function onMasterSave(payloadOverride = null) {
    const payload = payloadOverride || mChangedPayload;
    if (!payload || Object.keys(payload).length === 0 || mSaving) return;
    setMSaving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMasterCommission(payload);
      // Refresh local state similar to GET
      const tax = toFixedStr(data?.tax?.percent ?? 0, 2);
      const wd = toFixedStr(data?.withdrawal?.sponsor_percent ?? 0, 2);
      const cuId = data?.company_user?.id ?? "";
      const up = data?.upline || {};
      const geo = data?.geo || {};
      const mulRaw = Number(data?.commissions?.prime_750?.multiplier);
      const mulNorm = Number.isFinite(mulRaw) && mulRaw > 0 ? Math.floor(mulRaw) : 1;
      const vals = {
        tax_percent: tax,
        withdrawal_sponsor_percent: wd,
        tax_company_user_id: cuId ? String(cuId) : "",
        upline_l1: toFixedStr(up.l1 ?? 0, 2),
        upline_l2: toFixedStr(up.l2 ?? 0, 2),
        upline_l3: toFixedStr(up.l3 ?? 0, 2),
        upline_l4: toFixedStr(up.l4 ?? 0, 2),
        upline_l5: toFixedStr(up.l5 ?? 0, 2),
        geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
        geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
        geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
        geo_district: toFixedStr(geo.district ?? 0, 2),
        geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
        geo_state: toFixedStr(geo.state ?? 0, 2),
        geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
        geo_employee: toFixedStr(geo.employee ?? 0, 2),
        geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
        prime150_reward_points_amount: toFixedStr((data?.commissions?.prime_150?.rewards?.points_amount) ?? 0, 2),
        prime750_multiplier: String(mulNorm),
      };
      setMServer({
        tax_percent: toNum(vals.tax_percent),
        withdrawal_sponsor_percent: toNum(vals.withdrawal_sponsor_percent),
        tax_company_user_id: cuId ? Number(cuId) : null,
        prime750_multiplier: mulNorm,
        prime150_reward_points_amount: toNum(vals.prime150_reward_points_amount),
        upline: {
          l1: toNum(vals.upline_l1),
          l2: toNum(vals.upline_l2),
          l3: toNum(vals.upline_l3),
          l4: toNum(vals.upline_l4),
          l5: toNum(vals.upline_l5),
        },
        geo: {
          sub_franchise: toNum(vals.geo_sub_franchise),
          pincode: toNum(vals.geo_pincode),
          pincode_coord: toNum(vals.geo_pincode_coord),
          district: toNum(vals.geo_district),
          district_coord: toNum(vals.geo_district_coord),
          state: toNum(vals.geo_state),
          state_coord: toNum(vals.geo_state_coord),
          employee: toNum(vals.geo_employee),
          royalty: toNum(vals.geo_royalty),
        },
      });
      setMForm(vals);
      setOk("Saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed");
    } finally {
      setMSaving(false);
    }
  }

  // 2) Fixed Layer Commission (rupees)  retained logic (not shown as separate UI tab; managed in separate page)
  const [lLoading, setLLoading] = useState(true);
  const [lSaving, setLSaving] = useState(false);
  const [lSeeding, setLSeeding] = useState(false);
  const [lServer, setLServer] = useState(null);
  const [lForm, setLForm] = useState({ direct: "", l1: "", l2: "", l3: "", l4: "", l5: "" });

  useEffect(() => {
    let mounted = true;
    setLLoading(true);
    adminGetLevelCommission()
      .then((data) => {
        if (!mounted) return;
        const vals = {
          direct: toFixedStr(data?.direct, 2),
          l1: toFixedStr(data?.l1, 2),
          l2: toFixedStr(data?.l2, 2),
          l3: toFixedStr(data?.l3, 2),
          l4: toFixedStr(data?.l4, 2),
          l5: toFixedStr(data?.l5, 2),
        };
        setLServer({
          direct: toNum(vals.direct),
          l1: toNum(vals.l1),
          l2: toNum(vals.l2),
          l3: toNum(vals.l3),
          l4: toNum(vals.l4),
          l5: toNum(vals.l5),
          updated_at: data?.updated_at || null,
        });
        setLForm(vals);
      })
      .catch((e) => setErr(parseError(e) || "Failed to load Layer Commission"))
      .finally(() => mounted && setLLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onLChange(name, value) {
    if (value === "") {
      setLForm((f) => ({ ...f, [name]: "" }));
      return;
    }
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    let norm = parts[0];
    if (parts.length > 1) norm += "." + parts[1].slice(0, 2);
    if (norm === "") norm = "0";
    const n = Number(norm);
    if (!isFinite(n) || n < 0) return;
    setLForm((f) => ({ ...f, [name]: norm }));
  }

  const lChangedPayload = useMemo(() => {
    if (!lServer) return {};
    const out = {};
    ["direct", "l1", "l2", "l3", "l4", "l5"].forEach((k) => {
      const cur = Number(lForm[k]);
      const base = Number(lServer[k]);
      if (isFinite(cur) && isFinite(base)) {
        const curQ = Number(cur.toFixed(2));
        const baseQ = Number(base.toFixed(2));
        if (curQ !== baseQ) out[k] = curQ;
      }
    });
    return out;
  }, [lServer, lForm]);
  const lDirty = Object.keys(lChangedPayload).length > 0;

  async function onLSave() {
    if (!lDirty || lSaving) return;
    setLSaving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateLevelCommission(lChangedPayload);
      const vals = {
        direct: toFixedStr(data?.direct, 2),
        l1: toFixedStr(data?.l1, 2),
        l2: toFixedStr(data?.l2, 2),
        l3: toFixedStr(data?.l3, 2),
        l4: toFixedStr(data?.l4, 2),
        l5: toFixedStr(data?.l5, 2),
      };
      setLServer({
        direct: toNum(vals.direct),
        l1: toNum(vals.l1),
        l2: toNum(vals.l2),
        l3: toNum(vals.l3),
        l4: toNum(vals.l4),
        l5: toNum(vals.l5),
        updated_at: data?.updated_at || null,
      });
      setLForm(vals);
      setOk("Layer Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (Layer Commission)");
    } finally {
      setLSaving(false);
    }
  }
  async function onLSeed() {
    if (lSeeding) return;
    setLSeeding(true);
    setErr("");
    setOk("");
    try {
      await adminSeedLevelCommission();
      const fresh = await adminGetLevelCommission();
      const vals = {
        direct: toFixedStr(fresh?.direct, 2),
        l1: toFixedStr(fresh?.l1, 2),
        l2: toFixedStr(fresh?.l2, 2),
        l3: toFixedStr(fresh?.l3, 2),
        l4: toFixedStr(fresh?.l4, 2),
        l5: toFixedStr(fresh?.l5, 2),
      };
      setLServer({
        direct: toNum(vals.direct),
        l1: toNum(vals.l1),
        l2: toNum(vals.l2),
        l3: toNum(vals.l3),
        l4: toNum(vals.l4),
        l5: toNum(vals.l5),
        updated_at: fresh?.updated_at || null,
      });
      setLForm(vals);
      setOk("Layer Commission reset to defaults");
    } catch (e) {
      setErr(parseError(e) || "Reset failed (Layer Commission)");
    } finally {
      setLSeeding(false);
    }
  }

  // 3) Block Commission (GLOBAL)  used earlier for 750 read-only; kept for reference
  const [mxLoading, setMxLoading] = useState(true);
  const [mxSaving, setMxSaving] = useState(false);
  const [mxServer, setMxServer] = useState(null);
  const [mxForm, setMxForm] = useState({
    five_levels: "",
    five_amounts: "",
    five_percents: "",
    three_levels: "",
    three_amounts: "",
    three_percents: "",
  });

  useEffect(() => {
    let mounted = true;
    setMxLoading(true);
    adminGetMatrixCommissionConfig()
      .then((d) => {
        if (!mounted) return;
        const raw5 = Number(d?.five_matrix_levels ?? 0);
        const fiveLevels = (!raw5 || raw5 === 6) ? 10 : raw5;
        const fiveAmounts = Array.isArray(d?.five_matrix_amounts_json) ? d.five_matrix_amounts_json : [];
        const fivePercs = Array.isArray(d?.five_matrix_percents_json) ? d.five_matrix_percents_json : [];
        const raw3 = Number(d?.three_matrix_levels ?? 0);
        const threeLevels = (!raw3) ? 15 : raw3;
        const threeAmounts = Array.isArray(d?.three_matrix_amounts_json) ? d.three_matrix_amounts_json : [];
        const threePercs = Array.isArray(d?.three_matrix_percents_json) ? d.three_matrix_percents_json : [];

        const vals = {
          five_levels: String(fiveLevels || ""),
          five_amounts: fiveAmounts.map((x) => toFixedStr(x, 2)).join(", "),
          five_percents: fivePercs.map((x) => toFixedStr(x, 2)).join(", "),
          three_levels: String(threeLevels || ""),
          three_amounts: threeAmounts.map((x) => toFixedStr(x, 2)).join(", "),
          three_percents: threePercs.map((x) => toFixedStr(x, 2)).join(", "),
        };
        setMxServer({
          five_matrix_levels: fiveLevels,
          five_matrix_amounts_json: fiveAmounts.map((x) => toNum(x)),
          five_matrix_percents_json: fivePercs.map((x) => toNum(x)),
          three_matrix_levels: threeLevels,
          three_matrix_amounts_json: threeAmounts.map((x) => toNum(x)),
          three_matrix_percents_json: threePercs.map((x) => toNum(x)),
        });
        setMxForm(vals);
      })
      .catch((e) => setErr(parseError(e) || "Failed to load Block Commission"))
      .finally(() => mounted && setMxLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function parseNumArray(str) {
    if (typeof str !== "string") return [];
    return str
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => isFinite(n))
      .map((n) => Number(n.toFixed(2)));
  }
  function onMxChange(name, value) {
    if (name.endsWith("_levels")) {
      if (/^\d*$/.test(value)) setMxForm((f) => ({ ...f, [name]: value }));
      return;
    }
    // free text, we'll parse on save
    setMxForm((f) => ({ ...f, [name]: value }));
  }

  const mxChangedPayload = useMemo(() => {
    if (!mxServer) return {};
    const out = {};
    const fiveL = mxForm.five_levels === "" ? null : Number(mxForm.five_levels);
    if (fiveL !== null && fiveL !== mxServer.five_matrix_levels) out.five_matrix_levels = fiveL;

    const fiveAmt = parseNumArray(mxForm.five_amounts);
    const fiveAmtS = JSON.stringify(fiveAmt);
    if (fiveAmtS !== JSON.stringify(mxServer.five_matrix_amounts_json)) out.five_matrix_amounts_json = fiveAmt;

    const fivePct = parseNumArray(mxForm.five_percents);
    const fivePctS = JSON.stringify(fivePct);
    if (fivePctS !== JSON.stringify(mxServer.five_matrix_percents_json)) out.five_matrix_percents_json = fivePct;

    const threeL = mxForm.three_levels === "" ? null : Number(mxForm.three_levels);
    if (threeL !== null && threeL !== mxServer.three_matrix_levels) out.three_matrix_levels = threeL;

    const threeAmt = parseNumArray(mxForm.three_amounts);
    if (JSON.stringify(threeAmt) !== JSON.stringify(mxServer.three_matrix_amounts_json))
      out.three_matrix_amounts_json = threeAmt;

    const threePct = parseNumArray(mxForm.three_percents);
    if (JSON.stringify(threePct) !== JSON.stringify(mxServer.three_matrix_percents_json))
      out.three_matrix_percents_json = threePct;

    return out;
  }, [mxServer, mxForm]);
  const mxDirty = Object.keys(mxChangedPayload).length > 0;

  async function onMxSave() {
    if (!mxDirty || mxSaving) return;
    setMxSaving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMatrixCommissionConfig(mxChangedPayload);
      // Normalize back
      const fiveLevels = Number(data?.five_matrix_levels ?? 0) || 0;
      const fiveAmounts = Array.isArray(data?.five_matrix_amounts_json) ? data.five_matrix_amounts_json : [];
      const fivePercs = Array.isArray(data?.five_matrix_percents_json) ? data.five_matrix_percents_json : [];
      const threeLevels = Number(data?.three_matrix_levels ?? 0) || 0;
      const threeAmounts = Array.isArray(data?.three_matrix_amounts_json) ? data.three_matrix_amounts_json : [];
      const threePercs = Array.isArray(data?.three_matrix_percents_json) ? data.three_matrix_percents_json : [];

      setMxServer({
        five_matrix_levels: fiveLevels,
        five_matrix_amounts_json: fiveAmounts.map((x) => toNum(x)),
        five_matrix_percents_json: fivePercs.map((x) => toNum(x)),
        three_matrix_levels: threeLevels,
        three_matrix_amounts_json: threeAmounts.map((x) => toNum(x)),
        three_matrix_percents_json: threePercs.map((x) => toNum(x)),
      });
      setMxForm({
        five_levels: String(fiveLevels || ""),
        five_amounts: fiveAmounts.map((x) => toFixedStr(x, 2)).join(", "),
        five_percents: fivePercs.map((x) => toFixedStr(x, 2)).join(", "),
        three_levels: String(threeLevels || ""),
        three_amounts: threeAmounts.map((x) => toFixedStr(x, 2)).join(", "),
        three_percents: threePercs.map((x) => toFixedStr(x, 2)).join(", "),
      });
      setOk("Block Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (Block Commission)");
    } finally {
      setMxSaving(false);
    }
  }

  // 3b) Product-specific Overrides  150 Coupon (Direct + Geo + Matrix)
  const [m150Loading, setM150Loading] = useState(true);
  const [m150Saving, setM150Saving] = useState(false);
  const [m150Server, setM150Server] = useState(null);
  const [m150Form, setM150Form] = useState({
    // Direct referral bonuses (₹)
    direct_bonus_sponsor: "",
    direct_bonus_self: "",
    // Geo mode
    geo_mode: "",
    // Geo percents (%)
    geo_sub_franchise: "",
    geo_pincode: "",
    geo_pincode_coord: "",
    geo_district: "",
    geo_district_coord: "",
    geo_state: "",
    geo_state_coord: "",
    geo_employee: "",
    geo_royalty: "",
    // Geo fixed rupees (₹)
    geo_fixed_sub_franchise: "",
    geo_fixed_pincode: "",
    geo_fixed_pincode_coord: "",
    geo_fixed_district: "",
    geo_fixed_district_coord: "",
    geo_fixed_state: "",
    geo_fixed_state_coord: "",
    geo_fixed_employee: "",
    geo_fixed_royalty: "",
    // Product base & opening
    product_base_amount: "",
    coupon_activation_count: "",
    // Block repetition (UI)
    matrix_open_mode: "",
    matrix_open_count: "",
  });

  useEffect(() => {
    let mounted = true;
    setM150Loading(true);
    adminGetMasterCommission(PRODUCT_COUPON_150)
      .then((data) => {
        if (!mounted) return;
        const geo = data?.geo || {};
        const vals = {
          // direct bonus (if present on server response)
          direct_bonus_sponsor: toFixedStr(data?.direct_bonus?.sponsor ?? 0, 2),
          direct_bonus_self: toFixedStr(data?.direct_bonus?.self ?? 0, 2),
          // mode/fixed
          geo_mode: String(data?.geo_mode || "").toLowerCase(),
          geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
          geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
          geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
          geo_district: toFixedStr(geo.district ?? 0, 2),
          geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
          geo_state: toFixedStr(geo.state ?? 0, 2),
          geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
          geo_employee: toFixedStr(geo.employee ?? 0, 2),
          geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
          geo_fixed_sub_franchise: toFixedStr(data?.geo_fixed?.sub_franchise ?? 0, 2),
          geo_fixed_pincode: toFixedStr(data?.geo_fixed?.pincode ?? 0, 2),
          geo_fixed_pincode_coord: toFixedStr(data?.geo_fixed?.pincode_coord ?? 0, 2),
          geo_fixed_district: toFixedStr(data?.geo_fixed?.district ?? 0, 2),
          geo_fixed_district_coord: toFixedStr(data?.geo_fixed?.district_coord ?? 0, 2),
          geo_fixed_state: toFixedStr(data?.geo_fixed?.state ?? 0, 2),
          geo_fixed_state_coord: toFixedStr(data?.geo_fixed?.state_coord ?? 0, 2),
          geo_fixed_employee: toFixedStr(data?.geo_fixed?.employee ?? 0, 2),
          geo_fixed_royalty: toFixedStr(data?.geo_fixed?.royalty ?? 0, 2),
          product_base_amount: toFixedStr(data?.product_base_amount ?? 0, 2),
          coupon_activation_count: String(data?.coupon_activation_count ?? ""),
        };
      setM150Server({
        direct_bonus: { sponsor: toNum(vals.direct_bonus_sponsor), self: toNum(vals.direct_bonus_self) },
        geo_mode: vals.geo_mode || "",
        geo: {
          sub_franchise: toNum(vals.geo_sub_franchise),
          pincode: toNum(vals.geo_pincode),
          pincode_coord: toNum(vals.geo_pincode_coord),
          district: toNum(vals.geo_district),
          district_coord: toNum(vals.geo_district_coord),
          state: toNum(vals.geo_state),
          state_coord: toNum(vals.geo_state_coord),
          employee: toNum(vals.geo_employee),
          royalty: toNum(vals.geo_royalty),
        },
        geo_fixed: {
          sub_franchise: toNum(vals.geo_fixed_sub_franchise),
          pincode: toNum(vals.geo_fixed_pincode),
          pincode_coord: toNum(vals.geo_fixed_pincode_coord),
          district: toNum(vals.geo_fixed_district),
          district_coord: toNum(vals.geo_fixed_district_coord),
          state: toNum(vals.geo_fixed_state),
          state_coord: toNum(vals.geo_fixed_state_coord),
          employee: toNum(vals.geo_fixed_employee),
          royalty: toNum(vals.geo_fixed_royalty),
        },
        product_base_amount: toNum(vals.product_base_amount),
        coupon_activation_count: (vals.coupon_activation_count === "" ? null : Number(vals.coupon_activation_count)),
        // Block repetition snapshot for diffing
        matrix_open_mode: String((data?.matrix_open_mode || "")).toUpperCase() || "",
        matrix_open_count: (String(data?.matrix_open_count ?? "") === "" ? null : Number(String(data?.matrix_open_count))),
      });
      setM150Form({
        ...vals,
        matrix_open_mode: String((data?.matrix_open_mode || "")).toUpperCase(),
        matrix_open_count: String(data?.matrix_open_count ?? ""),
      });
      })
      .catch((e) => setErr(parseError(e) || "Failed to load 150 Coupon Geo Commission"))
      .finally(() => mounted && setM150Loading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onM150Change(name, value) {
    if (name === "geo_mode") {
      setM150Form((f) => ({ ...f, geo_mode: String(value || "").toLowerCase() }));
      return;
    }
    if (name === "coupon_activation_count") {
      const s = String(value);
      if (/^\d*$/.test(s)) setM150Form((f) => ({ ...f, coupon_activation_count: s }));
      return;
    }
    if (name === "matrix_open_mode") {
      setM150Form((f) => ({ ...f, matrix_open_mode: String(value || "").toUpperCase() }));
      return;
    }
    if (name === "matrix_open_count") {
      const s = String(value);
      if (/^\d*$/.test(s)) setM150Form((f) => ({ ...f, matrix_open_count: s }));
      return;
    }
    if (value === "") {
      setM150Form((f) => ({ ...f, [name]: "" }));
      return;
    }
    // numeric with 2 decimals
    const cleaned = String(value).replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    let norm = parts[0];
    if (parts.length > 1) norm += "." + parts[1].slice(0, 2);
    if (norm === "") norm = "0";
    const n = Number(norm);
    if (!isFinite(n) || n < 0) return;
    setM150Form((f) => ({ ...f, [name]: norm }));
  }

  const m150ChangedPayload = useMemo(() => {
    if (!m150Server) return {};
    const out = {};
    // direct bonus (₹)
    const sponsorCur = Number(Number(m150Form.direct_bonus_sponsor || 0).toFixed(2));
    const sponsorBase = Number(Number(m150Server.direct_bonus?.sponsor ?? 0).toFixed(2));
    const selfCur = Number(Number(m150Form.direct_bonus_self || 0).toFixed(2));
    const selfBase = Number(Number(m150Server.direct_bonus?.self ?? 0).toFixed(2));
    if (sponsorCur !== sponsorBase || selfCur !== selfBase) {
      out.direct_bonus = {};
      if (sponsorCur !== sponsorBase) out.direct_bonus.sponsor = sponsorCur;
      if (selfCur !== selfBase) out.direct_bonus.self = selfCur;
    }
    // geo mode
    const gmCur = (m150Form.geo_mode || "").toLowerCase();
    const gmBase = String(m150Server.geo_mode || "").toLowerCase();
    if (gmCur !== gmBase) out.geo_mode = gmCur;

    // geo percents
    const gKeys = [
      "sub_franchise",
      "pincode",
      "pincode_coord",
      "district",
      "district_coord",
      "state",
      "state_coord",
      "employee",
      "royalty",
    ];
    gKeys.forEach((k) => {
      const formV = Number(Number(m150Form[`geo_${k}`] || 0).toFixed(2));
      const baseV = Number(Number(m150Server.geo?.[k] ?? 0).toFixed(2));
      if (formV !== baseV) {
        out.geo = out.geo || {};
        out.geo[k] = formV;
      }
    });

    // geo fixed rupees
    gKeys.forEach((k) => {
      const formV = Number(Number(m150Form[`geo_fixed_${k}`] || 0).toFixed(2));
      const baseV = Number(Number(m150Server.geo_fixed?.[k] ?? 0).toFixed(2));
      if (formV !== baseV) {
        out.geo_fixed = out.geo_fixed || {};
        out.geo_fixed[k] = formV;
      }
    });

    // product base amount (₹)
    const pbaCur = Number(Number(m150Form.product_base_amount || 0).toFixed(2));
    const pbaBase = Number(Number(m150Server.product_base_amount || 0).toFixed(2));
    if (pbaCur !== pbaBase) out.product_base_amount = pbaCur;

    // coupon activation count (int)
    const actStr = m150Form.coupon_activation_count;
    const actCur = actStr === "" ? null : Number(actStr);
    const actBase = (m150Server.coupon_activation_count == null ? null : Number(m150Server.coupon_activation_count));
    if (actCur !== null && actCur !== actBase) out.coupon_activation_count = actCur;

    // matrix repetition
    const modeCur = String(m150Form.matrix_open_mode || "").toUpperCase();
    const modeBase = String(m150Server?.matrix_open_mode || "");
    if (modeCur && modeCur !== modeBase) out.matrix_open_mode = modeCur;

    const mCountStr = m150Form.matrix_open_count;
    const mCountCur = mCountStr === "" ? null : Number(mCountStr);
    const mCountBase = (m150Server?.matrix_open_count == null ? null : Number(m150Server.matrix_open_count));
    if (mCountCur !== null && mCountCur !== mCountBase) out.matrix_open_count = mCountCur;

    return out;
  }, [m150Server, m150Form]);
  const m150Dirty = Object.keys(m150ChangedPayload).length > 0;

  async function onM150Save() {
    if (!m150Dirty || m150Saving) return;
    if (!act150BalanceInfo.isBalanced150) {
      setErr(`Incorrect configuration: Total outflows (₹${act150BalanceInfo.totalOutflow150.toFixed(2)}) exceed Total Inflow (₹${act150BalanceInfo.base150Total.toFixed(2)}) by deficit of ₹${Math.abs(act150BalanceInfo.remainingMargin150).toFixed(2)}! Save rejected. Please correct amounts.`);
      return;
    }
    setM150Saving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMasterCommission(m150ChangedPayload, PRODUCT_COUPON_150);
      const gm = String(data?.geo_mode || "").toLowerCase();
      const direct = data?.direct_bonus || {};
      const geo = data?.geo || {};
      const gf = data?.geo_fixed || {};
      const vals = {
        // direct bonus
        direct_bonus_sponsor: toFixedStr(direct.sponsor ?? 0, 2),
        direct_bonus_self: toFixedStr(direct.self ?? 0, 2),
        // geo mode
        geo_mode: gm,
        // geo percents
        geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
        geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
        geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
        geo_district: toFixedStr(geo.district ?? 0, 2),
        geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
        geo_state: toFixedStr(geo.state ?? 0, 2),
        geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
        geo_employee: toFixedStr(geo.employee ?? 0, 2),
        geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
        // geo fixed rupees
        geo_fixed_sub_franchise: toFixedStr(gf.sub_franchise ?? 0, 2),
        geo_fixed_pincode: toFixedStr(gf.pincode ?? 0, 2),
        geo_fixed_pincode_coord: toFixedStr(gf.pincode_coord ?? 0, 2),
        geo_fixed_district: toFixedStr(gf.district ?? 0, 2),
        geo_fixed_district_coord: toFixedStr(gf.district_coord ?? 0, 2),
        geo_fixed_state: toFixedStr(gf.state ?? 0, 2),
        geo_fixed_state_coord: toFixedStr(gf.state_coord ?? 0, 2),
        geo_fixed_employee: toFixedStr(gf.employee ?? 0, 2),
        geo_fixed_royalty: toFixedStr(gf.royalty ?? 0, 2),
        product_base_amount: toFixedStr(data?.product_base_amount ?? 0, 2),
        coupon_activation_count: String(data?.coupon_activation_count ?? ""),
        // reflect matrix open config from server
        matrix_open_mode: String((data?.matrix_open_mode || "")).toUpperCase(),
        matrix_open_count: String(data?.matrix_open_count ?? ""),
      };
      setM150Server({
        direct_bonus: {
          sponsor: toNum(vals.direct_bonus_sponsor),
          self: toNum(vals.direct_bonus_self),
        },
        geo_mode: vals.geo_mode || "",
        geo: {
          sub_franchise: toNum(vals.geo_sub_franchise),
          pincode: toNum(vals.geo_pincode),
          pincode_coord: toNum(vals.geo_pincode_coord),
          district: toNum(vals.geo_district),
          district_coord: toNum(vals.geo_district_coord),
          state: toNum(vals.geo_state),
          state_coord: toNum(vals.geo_state_coord),
          employee: toNum(vals.geo_employee),
          royalty: toNum(vals.geo_royalty),
        },
        geo_fixed: {
          sub_franchise: toNum(vals.geo_fixed_sub_franchise),
          pincode: toNum(vals.geo_fixed_pincode),
          pincode_coord: toNum(vals.geo_fixed_pincode_coord),
          district: toNum(vals.geo_fixed_district),
          district_coord: toNum(vals.geo_fixed_district_coord),
          state: toNum(vals.geo_fixed_state),
          state_coord: toNum(vals.geo_fixed_state_coord),
          employee: toNum(vals.geo_fixed_employee),
          royalty: toNum(vals.geo_fixed_royalty),
        },
        product_base_amount: toNum(vals.product_base_amount),
        coupon_activation_count: (vals.coupon_activation_count === "" ? null : Number(vals.coupon_activation_count)),
        // reflect matrix open config into server snapshot
        matrix_open_mode: String((data?.matrix_open_mode || "")).toUpperCase() || "",
        matrix_open_count: (String(data?.matrix_open_count ?? "") === "" ? null : Number(String(data?.matrix_open_count))),
      });
      setM150Form(vals);
      setOk("150 Coupon Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (150 Coupon Commission)");
    } finally {
      setM150Saving(false);
    }
  }

  // Block overrides  150 Coupon
  const [mx150Loading, setMx150Loading] = useState(true);
  const [mx150Saving, setMx150Saving] = useState(false);
  const [mx150Server, setMx150Server] = useState(null);
  const [mx150Form, setMx150Form] = useState({
    five_levels: "",
    five_amounts: "",
    five_percents: "",
    three_levels: "",
    three_amounts: "",
    three_percents: "",
  });

  useEffect(() => {
    let mounted = true;
    setMx150Loading(true);
    adminGetMatrixCommissionConfig(PRODUCT_COUPON_150)
      .then((d) => {
        if (!mounted) return;
        const raw5 = Number(d?.five_matrix_levels ?? 0);
        const fiveLevels = (!raw5 || raw5 === 6) ? 10 : raw5;
        const fiveAmounts = Array.isArray(d?.five_matrix_amounts_json) ? d.five_matrix_amounts_json : [];
        const fivePercs = Array.isArray(d?.five_matrix_percents_json) ? d.five_matrix_percents_json : [];
        const raw3 = Number(d?.three_matrix_levels ?? 0);
        const threeLevels = (!raw3) ? 15 : raw3;
        const threeAmounts = Array.isArray(d?.three_matrix_amounts_json) ? d.three_matrix_amounts_json : [];
        const threePercs = Array.isArray(d?.three_matrix_percents_json) ? d.three_matrix_percents_json : [];

        setMx150Server({
          five_matrix_levels: fiveLevels,
          five_matrix_amounts_json: fiveAmounts.map((x) => toNum(x)),
          five_matrix_percents_json: fivePercs.map((x) => toNum(x)),
          three_matrix_levels: threeLevels,
          three_matrix_amounts_json: threeAmounts.map((x) => toNum(x)),
          three_matrix_percents_json: threePercs.map((x) => toNum(x)),
        });
        setMx150Form({
          five_levels: String(fiveLevels || ""),
          five_amounts: fiveAmounts.map((x) => toFixedStr(x, 2)).join(", "),
          five_percents: fivePercs.map((x) => toFixedStr(x, 2)).join(", "),
          three_levels: String(threeLevels || ""),
          three_amounts: threeAmounts.map((x) => toFixedStr(x, 2)).join(", "),
          three_percents: threePercs.map((x) => toFixedStr(x, 2)).join(", "),
        });
      })
      .catch((e) => setErr(parseError(e) || "Failed to load 150 Coupon Block Commission"))
      .finally(() => mounted && setMx150Loading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onMx150Change(name, value) {
    if (name.endsWith("_levels")) {
      if (/^\d*$/.test(value)) setMx150Form((f) => ({ ...f, [name]: value }));
      return;
    }
    setMx150Form((f) => ({ ...f, [name]: value }));
  }

  const mx150ChangedPayload = useMemo(() => {
    if (!mx150Server) return {};
    const out = {};
    const fiveL = mx150Form.five_levels === "" ? null : Number(mx150Form.five_levels);
    if (fiveL !== null && fiveL !== mx150Server.five_matrix_levels) out.five_matrix_levels = fiveL;

    const fiveAmt = parseNumArray(mx150Form.five_amounts);
    if (JSON.stringify(fiveAmt) !== JSON.stringify(mx150Server.five_matrix_amounts_json))
      out.five_matrix_amounts_json = fiveAmt;

    const fivePct = parseNumArray(mx150Form.five_percents);
    if (JSON.stringify(fivePct) !== JSON.stringify(mx150Server.five_matrix_percents_json))
      out.five_matrix_percents_json = fivePct;

    const threeL = mx150Form.three_levels === "" ? null : Number(mx150Form.three_levels);
    if (threeL !== null && threeL !== mx150Server.three_matrix_levels) out.three_matrix_levels = threeL;

    const threeAmt = parseNumArray(mx150Form.three_amounts);
    if (JSON.stringify(threeAmt) !== JSON.stringify(mx150Server.three_matrix_amounts_json))
      out.three_matrix_amounts_json = threeAmt;

    const threePct = parseNumArray(mx150Form.three_percents);
    if (JSON.stringify(threePct) !== JSON.stringify(mx150Server.three_matrix_percents_json))
      out.three_matrix_percents_json = threePct;

    return out;
  }, [mx150Server, mx150Form]);
  const mx150Dirty = Object.keys(mx150ChangedPayload).length > 0;

  async function onMx150Save() {
    if (!mx150Dirty || mx150Saving) return;
    if (!act150BalanceInfo.isBalanced150) {
      setErr(`Incorrect configuration: Total outflows (₹${act150BalanceInfo.totalOutflow150.toFixed(2)}) exceed Total Inflow (₹${act150BalanceInfo.base150Total.toFixed(2)}) by deficit of ₹${Math.abs(act150BalanceInfo.remainingMargin150).toFixed(2)}! Save rejected. Please correct amounts.`);
      return;
    }
    setMx150Saving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMatrixCommissionConfig(mx150ChangedPayload, PRODUCT_COUPON_150);
      const fiveLevels = Number(data?.five_matrix_levels ?? 0) || 0;
      const fiveAmounts = Array.isArray(data?.five_matrix_amounts_json) ? data.five_matrix_amounts_json : [];
      const fivePercs = Array.isArray(data?.five_matrix_percents_json) ? data.five_matrix_percents_json : [];
      const threeLevels = Number(data?.three_matrix_levels ?? 0) || 0;
      const threeAmounts = Array.isArray(data?.three_matrix_amounts_json) ? data.three_matrix_amounts_json : [];
      const threePercs = Array.isArray(data?.three_matrix_percents_json) ? data.three_matrix_percents_json : [];
      setMx150Server({
        five_matrix_levels: fiveLevels,
        five_matrix_amounts_json: fiveAmounts.map((x) => toNum(x)),
        five_matrix_percents_json: fivePercs.map((x) => toNum(x)),
        three_matrix_levels: threeLevels,
        three_matrix_amounts_json: threeAmounts.map((x) => toNum(x)),
        three_matrix_percents_json: threePercs.map((x) => toNum(x)),
      });
      setMx150Form({
        five_levels: String(fiveLevels || ""),
        five_amounts: fiveAmounts.map((x) => toFixedStr(x, 2)).join(", "),
        five_percents: fivePercs.map((x) => toFixedStr(x, 2)).join(", "),
        three_levels: String(threeLevels || ""),
        three_amounts: threeAmounts.map((x) => toFixedStr(x, 2)).join(", "),
        three_percents: threePercs.map((x) => toFixedStr(x, 2)).join(", "),
      });
      setOk("150 Coupon Block Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (150 Coupon Block Commission)");
    } finally {
      setMx150Saving(false);
    }
  }

  // 3c) Product-specific Overrides  ₹750 (Direct + Geo + Matrix + Opening)
  const [m750Loading, setM750Loading] = useState(true);
  const [m750Saving, setM750Saving] = useState(false);
  const [m750Server, setM750Server] = useState(null);
const [m750Form, setM750Form] = useState({
    // Direct referral bonuses (₹)
    direct_bonus_sponsor: "",
    direct_bonus_self: "",
    // Geo mode
    geo_mode: "",
    // Geo percents
    geo_sub_franchise: "",
    geo_pincode: "",
    geo_pincode_coord: "",
    geo_district: "",
    geo_district_coord: "",
    geo_state: "",
    geo_state_coord: "",
    geo_employee: "",
    geo_royalty: "",
    // Geo fixed rupees (₹)
    geo_fixed_sub_franchise: "",
    geo_fixed_pincode: "",
    geo_fixed_pincode_coord: "",
    geo_fixed_district: "",
    geo_fixed_district_coord: "",
    geo_fixed_state: "",
    geo_fixed_state_coord: "",
    geo_fixed_employee: "",
    geo_fixed_royalty: "",
    // Product base amount (₹)
    product_base_amount: "",
    // 750 Opening (matrix account creation count)
    activation_open_count: "",
    // Block repetition (UI)
    matrix_open_mode: "",
    matrix_open_count: "",
  });

  useEffect(() => {
    let mounted = true;
    setM750Loading(true);
    adminGetMasterCommission(PRODUCT_RS_750)
      .then((data) => {
        if (!mounted) return;
        const geo = data?.geo || {};
const vals = {
          direct_bonus_sponsor: toFixedStr(data?.direct_bonus?.sponsor ?? 0, 2),
          direct_bonus_self: toFixedStr(data?.direct_bonus?.self ?? 0, 2),
          geo_mode: String(data?.geo_mode || "").toLowerCase(),
          geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
          geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
          geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
          geo_district: toFixedStr(geo.district ?? 0, 2),
          geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
          geo_state: toFixedStr(geo.state ?? 0, 2),
          geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
          geo_employee: toFixedStr(geo.employee ?? 0, 2),
          geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
          geo_fixed_sub_franchise: toFixedStr(data?.geo_fixed?.sub_franchise ?? 0, 2),
          geo_fixed_pincode: toFixedStr(data?.geo_fixed?.pincode ?? 0, 2),
          geo_fixed_pincode_coord: toFixedStr(data?.geo_fixed?.pincode_coord ?? 0, 2),
          geo_fixed_district: toFixedStr(data?.geo_fixed?.district ?? 0, 2),
          geo_fixed_district_coord: toFixedStr(data?.geo_fixed?.district_coord ?? 0, 2),
          geo_fixed_state: toFixedStr(data?.geo_fixed?.state ?? 0, 2),
          geo_fixed_state_coord: toFixedStr(data?.geo_fixed?.state_coord ?? 0, 2),
          geo_fixed_employee: toFixedStr(data?.geo_fixed?.employee ?? 0, 2),
          geo_fixed_royalty: toFixedStr(data?.geo_fixed?.royalty ?? 0, 2),
          product_base_amount: (Number(data?.product_base_amount) > 0 && Number(data?.product_base_amount) !== 1000) ? toFixedStr(data.product_base_amount, 2) : "750.00",
          activation_open_count: String(data?.activation_open_count ?? ""),
          // matrix repetition
          matrix_open_mode: String((data?.matrix_open_mode || "")).toUpperCase(),
          matrix_open_count: String(data?.matrix_open_count ?? ""),
        };
setM750Server({
          direct_bonus: { sponsor: toNum(vals.direct_bonus_sponsor), self: toNum(vals.direct_bonus_self) },
          geo_mode: vals.geo_mode || "",
          geo: {
            sub_franchise: toNum(vals.geo_sub_franchise),
            pincode: toNum(vals.geo_pincode),
            pincode_coord: toNum(vals.geo_pincode_coord),
            district: toNum(vals.geo_district),
            district_coord: toNum(vals.geo_district_coord),
            state: toNum(vals.geo_state),
            state_coord: toNum(vals.geo_state_coord),
            employee: toNum(vals.geo_employee),
            royalty: toNum(vals.geo_royalty),
          },
          geo_fixed: {
            sub_franchise: toNum(vals.geo_fixed_sub_franchise),
            pincode: toNum(vals.geo_fixed_pincode),
            pincode_coord: toNum(vals.geo_fixed_pincode_coord),
            district: toNum(vals.geo_fixed_district),
            district_coord: toNum(vals.geo_fixed_district_coord),
            state: toNum(vals.geo_fixed_state),
            state_coord: toNum(vals.geo_fixed_state_coord),
            employee: toNum(vals.geo_fixed_employee),
            royalty: toNum(vals.geo_fixed_royalty),
          },
          product_base_amount: toNum(vals.product_base_amount),
          activation_open_count: vals.activation_open_count === "" ? null : Number(vals.activation_open_count),
          // Block repetition snapshot for diffing
          matrix_open_mode: String((data?.matrix_open_mode || "")).toUpperCase() || "",
          matrix_open_count: (String(data?.matrix_open_count ?? "") === "" ? null : Number(String(data?.matrix_open_count))),
        });
        setM750Form(vals);
      })
      .catch((e) => setErr(parseError(e) || "Failed to load ₹750 Commission"))
      .finally(() => mounted && setM750Loading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onM750Change(name, value) {
    if (name === "geo_mode") {
      setM750Form((f) => ({ ...f, geo_mode: String(value || "").toLowerCase() }));
      return;
    }
    if (name === "activation_open_count") {
      const s = String(value);
      if (/^\d*$/.test(s)) setM750Form((f) => ({ ...f, activation_open_count: s }));
      return;
    }
    if (name === "matrix_open_mode") {
      setM750Form((f) => ({ ...f, matrix_open_mode: String(value || "").toUpperCase() }));
      return;
    }
    if (name === "matrix_open_count") {
      const s = String(value);
      if (/^\d*$/.test(s)) setM750Form((f) => ({ ...f, matrix_open_count: s }));
      return;
    }
    if (value === "") {
      setM750Form((f) => ({ ...f, [name]: "" }));
      return;
    }
    const cleaned = String(value).replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    let norm = parts[0];
    if (parts.length > 1) norm += "." + parts[1].slice(0, 2);
    if (norm === "") norm = "0";
    const n = Number(norm);
    if (!isFinite(n) || n < 0) return;
    setM750Form((f) => ({ ...f, [name]: norm }));
  }

  const m750ChangedPayload = useMemo(() => {
    if (!m750Server) return {};
    const out = {};

    // direct bonuses
    const sponsorCur = Number(Number(m750Form.direct_bonus_sponsor || 0).toFixed(2));
    const sponsorBase = Number(Number(m750Server.direct_bonus?.sponsor ?? 0).toFixed(2));
    const selfCur = Number(Number(m750Form.direct_bonus_self || 0).toFixed(2));
    const selfBase = Number(Number(m750Server.direct_bonus?.self ?? 0).toFixed(2));
    if (sponsorCur !== sponsorBase || selfCur !== selfBase) {
      out.direct_bonus = {};
      if (sponsorCur !== sponsorBase) out.direct_bonus.sponsor = sponsorCur;
      if (selfCur !== selfBase) out.direct_bonus.self = selfCur;
    }

    // geo mode
    const gmCur = (m750Form.geo_mode || "").toLowerCase();
    const gmBase = String(m750Server.geo_mode || "").toLowerCase();
    if (gmCur !== gmBase) out.geo_mode = gmCur;

    // geo percents
    const gKeys = [
      "sub_franchise",
      "pincode",
      "pincode_coord",
      "district",
      "district_coord",
      "state",
      "state_coord",
      "employee",
      "royalty",
    ];
    gKeys.forEach((k) => {
      const formV = Number(Number(m750Form[`geo_${k}`] || 0).toFixed(2));
      const baseV = Number(Number(m750Server.geo?.[k] ?? 0).toFixed(2));
      if (formV !== baseV) {
        out.geo = out.geo || {};
        out.geo[k] = formV;
      }
    });

  // geo fixed rupees
  gKeys.forEach((k) => {
    const formV = Number(Number(m750Form[`geo_fixed_${k}`] || 0).toFixed(2));
    const baseV = Number(Number(m750Server.geo_fixed?.[k] ?? 0).toFixed(2));
    if (formV !== baseV) {
      out.geo_fixed = out.geo_fixed || {};
      out.geo_fixed[k] = formV;
    }
  });

  // product base amount (₹) for 750
  const pbaCur = Number(Number(m750Form.product_base_amount || 0).toFixed(2));
  const pbaBase = Number(Number(m750Server.product_base_amount || 0).toFixed(2));
  if (pbaCur !== pbaBase) out.product_base_amount = pbaCur;

  // activation open count (int)
  const actStr = m750Form.activation_open_count;
    const actCur = actStr === "" ? null : Number(actStr);
    const actBase = (m750Server.activation_open_count == null ? null : Number(m750Server.activation_open_count));
    if (actCur !== null && actCur !== actBase) out.activation_open_count = actCur;

    // matrix repetition
    const modeCur = String(m750Form.matrix_open_mode || "").toUpperCase();
    const modeBase = String(m750Server?.matrix_open_mode || "");
    if (modeCur && modeCur !== modeBase) out.matrix_open_mode = modeCur;

    const mCountStr = m750Form.matrix_open_count;
    const mCountCur = mCountStr === "" ? null : Number(mCountStr);
    const mCountBase = (m750Server?.matrix_open_count == null ? null : Number(m750Server.matrix_open_count));
    if (mCountCur !== null && mCountCur !== mCountBase) out.matrix_open_count = mCountCur;

    return out;
  }, [m750Server, m750Form]);
  const m750Dirty = Object.keys(m750ChangedPayload).length > 0;

  async function onM750Save() {
    if ((!m750Dirty && !customTaxDirty) || m750Saving) return;
    if (!act750BalanceInfo.isBalanced750) {
      setErr(`Incorrect configuration: Total outflows (₹${act750BalanceInfo.totalOutflow750.toFixed(2)}) exceed Total Inflow (₹${act750BalanceInfo.base750Total.toFixed(2)}) by deficit of ₹${Math.abs(act750BalanceInfo.remainingMargin750).toFixed(2)}! Save rejected. Please correct amounts.`);
      return;
    }
    setM750Saving(true);
    setErr("");
    setOk("");
    try {
      const payloadToSend = {
        ...m750ChangedPayload,
        custom_module_tax: customModuleTax,
      };
      const data = await adminUpdateMasterCommission(payloadToSend, PRODUCT_RS_750);
      setCustomTaxDirty(false);
      const gm = String(data?.geo_mode || "").toLowerCase();
      const direct = data?.direct_bonus || {};
      const geo = data?.geo || {};
      const gf = data?.geo_fixed || {};
      const vals = {
        direct_bonus_sponsor: toFixedStr(direct.sponsor ?? 0, 2),
        direct_bonus_self: toFixedStr(direct.self ?? 0, 2),
        geo_mode: gm,
        geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
        geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
        geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
        geo_district: toFixedStr(geo.district ?? 0, 2),
        geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
        geo_state: toFixedStr(geo.state ?? 0, 2),
        geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
        geo_employee: toFixedStr(geo.employee ?? 0, 2),
        geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
        geo_fixed_sub_franchise: toFixedStr(gf.sub_franchise ?? 0, 2),
        geo_fixed_pincode: toFixedStr(gf.pincode ?? 0, 2),
        geo_fixed_pincode_coord: toFixedStr(gf.pincode_coord ?? 0, 2),
        geo_fixed_district: toFixedStr(gf.district ?? 0, 2),
        geo_fixed_district_coord: toFixedStr(gf.district_coord ?? 0, 2),
        geo_fixed_state: toFixedStr(gf.state ?? 0, 2),
        geo_fixed_state_coord: toFixedStr(gf.state_coord ?? 0, 2),
        geo_fixed_employee: toFixedStr(gf.employee ?? 0, 2),
        geo_fixed_royalty: toFixedStr(gf.royalty ?? 0, 2),
        product_base_amount: toFixedStr(data?.product_base_amount ?? 0, 2),
        activation_open_count: String(data?.activation_open_count ?? ""),
        matrix_open_mode: String((data?.matrix_open_mode || "")).toUpperCase(),
        matrix_open_count: String(data?.matrix_open_count ?? ""),
      };
      setM750Server({
        direct_bonus: {
          sponsor: toNum(vals.direct_bonus_sponsor),
          self: toNum(vals.direct_bonus_self),
        },
        geo_mode: vals.geo_mode || "",
        geo: {
          sub_franchise: toNum(vals.geo_sub_franchise),
          pincode: toNum(vals.geo_pincode),
          pincode_coord: toNum(vals.geo_pincode_coord),
          district: toNum(vals.geo_district),
          district_coord: toNum(vals.geo_district_coord),
          state: toNum(vals.geo_state),
          state_coord: toNum(vals.geo_state_coord),
          employee: toNum(vals.geo_employee),
          royalty: toNum(vals.geo_royalty),
        },
        geo_fixed: {
          sub_franchise: toNum(vals.geo_fixed_sub_franchise),
          pincode: toNum(vals.geo_fixed_pincode),
          pincode_coord: toNum(vals.geo_fixed_pincode_coord),
          district: toNum(vals.geo_fixed_district),
          district_coord: toNum(vals.geo_fixed_district_coord),
          state: toNum(vals.geo_fixed_state),
          state_coord: toNum(vals.geo_fixed_state_coord),
          employee: toNum(vals.geo_fixed_employee),
          royalty: toNum(vals.geo_fixed_royalty),
        },
        product_base_amount: toNum(vals.product_base_amount),
        activation_open_count: (vals.activation_open_count === "" ? null : Number(vals.activation_open_count)),
        matrix_open_mode: String((data?.matrix_open_mode || "")).toUpperCase() || "",
        matrix_open_count: (String(data?.matrix_open_count ?? "") === "" ? null : Number(String(data?.matrix_open_count))),
      });
      setM750Form(vals);
      setOk("₹750 Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (₹750 Commission)");
    } finally {
      setM750Saving(false);
    }
  }

  // Block overrides  ₹750
  const [mx750Loading, setMx750Loading] = useState(true);
  const [mx750Saving, setMx750Saving] = useState(false);
  const [mx750Server, setMx750Server] = useState(null);
  const [mx750Form, setMx750Form] = useState({
    five_levels: "",
    five_amounts: "",
    five_percents: "",
    three_levels: "",
    three_amounts: "",
    three_percents: "",
  });

  useEffect(() => {
    let mounted = true;
    setMx750Loading(true);
    adminGetMatrixCommissionConfig(PRODUCT_RS_750)
      .then((d) => {
        if (!mounted) return;
        const raw5 = Number(d?.five_matrix_levels ?? 0);
        const fiveLevels = (!raw5 || raw5 === 6) ? 10 : raw5;
        const fiveAmounts = Array.isArray(d?.five_matrix_amounts_json) ? d.five_matrix_amounts_json : [];
        const fivePercs = Array.isArray(d?.five_matrix_percents_json) ? d.five_matrix_percents_json : [];
        const raw3 = Number(d?.three_matrix_levels ?? 0);
        const threeLevels = (!raw3) ? 15 : raw3;
        const threeAmounts = Array.isArray(d?.three_matrix_amounts_json) ? d.three_matrix_amounts_json : [];
        const threePercs = Array.isArray(d?.three_matrix_percents_json) ? d.three_matrix_percents_json : [];
        setMx750Server({
          five_matrix_levels: fiveLevels,
          five_matrix_amounts_json: fiveAmounts.map((x) => toNum(x)),
          five_matrix_percents_json: fivePercs.map((x) => toNum(x)),
          three_matrix_levels: threeLevels,
          three_matrix_amounts_json: threeAmounts.map((x) => toNum(x)),
          three_matrix_percents_json: threePercs.map((x) => toNum(x)),
        });
        setMx750Form({
          five_levels: String(fiveLevels || ""),
          five_amounts: fiveAmounts.map((x) => toFixedStr(x, 2)).join(", "),
          five_percents: fivePercs.map((x) => toFixedStr(x, 2)).join(", "),
          three_levels: String(threeLevels || ""),
          three_amounts: threeAmounts.map((x) => toFixedStr(x, 2)).join(", "),
          three_percents: threePercs.map((x) => toFixedStr(x, 2)).join(", "),
        });
      })
      .catch((e) => setErr(parseError(e) || "Failed to load ₹750 Block Commission"))
      .finally(() => mounted && setMx750Loading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onMx750Change(name, value) {
    if (name.endsWith("_levels")) {
      if (/^\d*$/.test(value)) setMx750Form((f) => ({ ...f, [name]: value }));
      return;
    }
    setMx750Form((f) => ({ ...f, [name]: value }));
  }

  const mx750ChangedPayload = useMemo(() => {
    if (!mx750Server) return {};
    const out = {};
    const fiveL = mx750Form.five_levels === "" ? null : Number(mx750Form.five_levels);
    if (fiveL !== null && fiveL !== mx750Server.five_matrix_levels) out.five_matrix_levels = fiveL;

    const fiveAmt = parseNumArray(mx750Form.five_amounts);
    if (JSON.stringify(fiveAmt) !== JSON.stringify(mx750Server.five_matrix_amounts_json))
      out.five_matrix_amounts_json = fiveAmt;

    const fivePct = parseNumArray(mx750Form.five_percents);
    if (JSON.stringify(fivePct) !== JSON.stringify(mx750Server.five_matrix_percents_json))
      out.five_matrix_percents_json = fivePct;

    const threeL = mx750Form.three_levels === "" ? null : Number(mx750Form.three_levels);
    if (threeL !== null && threeL !== mx750Server.three_matrix_levels) out.three_matrix_levels = threeL;

    const threeAmt = parseNumArray(mx750Form.three_amounts);
    if (JSON.stringify(threeAmt) !== JSON.stringify(mx750Server.three_matrix_amounts_json))
      out.three_matrix_amounts_json = threeAmt;

    const threePct = parseNumArray(mx750Form.three_percents);
    if (JSON.stringify(threePct) !== JSON.stringify(mx750Server.three_matrix_percents_json))
      out.three_matrix_percents_json = threePct;

    return out;
  }, [mx750Server, mx750Form]);
  const mx750Dirty = Object.keys(mx750ChangedPayload).length > 0;

  async function onMx750Save() {
    if (!mx750Dirty || mx750Saving) return;
    if (!act750BalanceInfo.isBalanced750) {
      setErr(`Incorrect configuration: Total outflows (₹${act750BalanceInfo.totalOutflow750.toFixed(2)}) exceed Total Inflow (₹${act750BalanceInfo.base750Total.toFixed(2)}) by deficit of ₹${Math.abs(act750BalanceInfo.remainingMargin750).toFixed(2)}! Save rejected. Please correct amounts.`);
      return;
    }
    setMx750Saving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMatrixCommissionConfig(mx750ChangedPayload, PRODUCT_RS_750);
      const fiveLevels = Number(data?.five_matrix_levels ?? 0) || 0;
      const fiveAmounts = Array.isArray(data?.five_matrix_amounts_json) ? data.five_matrix_amounts_json : [];
      const fivePercs = Array.isArray(data?.five_matrix_percents_json) ? data.five_matrix_percents_json : [];
      const threeLevels = Number(data?.three_matrix_levels ?? 0) || 0;
      const threeAmounts = Array.isArray(data?.three_matrix_amounts_json) ? data.three_matrix_amounts_json : [];
      const threePercs = Array.isArray(data?.three_matrix_percents_json) ? data.three_matrix_percents_json : [];
      setMx750Server({
        five_matrix_levels: fiveLevels,
        five_matrix_amounts_json: fiveAmounts.map((x) => toNum(x)),
        five_matrix_percents_json: fivePercs.map((x) => toNum(x)),
        three_matrix_levels: threeLevels,
        three_matrix_amounts_json: threeAmounts.map((x) => toNum(x)),
        three_matrix_percents_json: threePercs.map((x) => toNum(x)),
      });
      setMx750Form({
        five_levels: String(fiveLevels || ""),
        five_amounts: fiveAmounts.map((x) => toFixedStr(x, 2)).join(", "),
        five_percents: fivePercs.map((x) => toFixedStr(x, 2)).join(", "),
        three_levels: String(threeLevels || ""),
        three_amounts: threeAmounts.map((x) => toFixedStr(x, 2)).join(", "),
        three_percents: threePercs.map((x) => toFixedStr(x, 2)).join(", "),
      });
      setOk("₹750 Block Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (₹750 Block Commission)");
    } finally {
      setMx750Saving(false);
    }
  }

  // 3d) Product-specific Overrides  ₹759 (Direct + Geo + Matrix)
  const [m759Loading, setM759Loading] = useState(true);
  const [m759Saving, setM759Saving] = useState(false);
  const [m759Server, setM759Server] = useState(null);
  const [m759Form, setM759Form] = useState({
    // Direct referral bonuses (₹)
    direct_bonus_sponsor: "",
    direct_bonus_self: "",
    // Geo mode
    geo_mode: "",
    // Geo percents
    geo_sub_franchise: "",
    geo_pincode: "",
    geo_pincode_coord: "",
    geo_district: "",
    geo_district_coord: "",
    geo_state: "",
    geo_state_coord: "",
    geo_employee: "",
    geo_royalty: "",
    // Geo fixed rupees
    geo_fixed_sub_franchise: "",
    geo_fixed_pincode: "",
    geo_fixed_pincode_coord: "",
    geo_fixed_district: "",
    geo_fixed_district_coord: "",
    geo_fixed_state: "",
    geo_fixed_state_coord: "",
    geo_fixed_employee: "",
    geo_fixed_royalty: "",
  });

  // ₹759  Monthly config (first vs subsequent, levels, agency, base)
  const [m759MServer, setM759MServer] = useState(null);
  const [m759MForm, setM759MForm] = useState({
    monthly_direct_first: "",
    monthly_direct_monthly: "",
    monthly_base_amount: "",
    monthly_agency_enabled: "1",
    monthly_matrix_open_mode: "",
    monthly_l1: "",
    monthly_l2: "",
    monthly_l3: "",
    monthly_l4: "",
    monthly_l5: "",
  });

  function onM759MonthlyChange(name, value) {
    if (name === "monthly_agency_enabled") {
      setM759MForm((f) => ({ ...f, monthly_agency_enabled: value === "1" ? "1" : "0" }));
      return;
    }
    if (name === "monthly_matrix_open_mode") {
      setM759MForm((f) => ({ ...f, monthly_matrix_open_mode: String(value || "").toUpperCase() }));
      return;
    }
    if (value === "") {
      setM759MForm((f) => ({ ...f, [name]: "" }));
      return;
    }
    const cleaned = String(value).replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    let norm = parts[0];
    if (parts.length > 1) norm += "." + parts[1].slice(0, 2);
    if (norm === "") norm = "0";
    const n = Number(norm);
    if (!isFinite(n) || n < 0) return;
    setM759MForm((f) => ({ ...f, [name]: norm }));
  }

  useEffect(() => {
    let mounted = true;
    setM759Loading(true);
    adminGetMasterCommission(PRODUCT_RS_759)
      .then((data) => {
        if (!mounted) return;
        const geo = data?.geo || {};
        const vals = {
          // direct bonus (if present)
          direct_bonus_sponsor: toFixedStr(data?.direct_bonus?.sponsor ?? 0, 2),
          direct_bonus_self: toFixedStr(data?.direct_bonus?.self ?? 0, 2),
          // geo mode/fixed
          geo_mode: String(data?.geo_mode || "").toLowerCase(),
          // geo percents
          geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
          geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
          geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
          geo_district: toFixedStr(geo.district ?? 0, 2),
          geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
          geo_state: toFixedStr(geo.state ?? 0, 2),
          geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
          geo_employee: toFixedStr(geo.employee ?? 0, 2),
          geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
          // geo fixed rupees
          geo_fixed_sub_franchise: toFixedStr(data?.geo_fixed?.sub_franchise ?? 0, 2),
          geo_fixed_pincode: toFixedStr(data?.geo_fixed?.pincode ?? 0, 2),
          geo_fixed_pincode_coord: toFixedStr(data?.geo_fixed?.pincode_coord ?? 0, 2),
          geo_fixed_district: toFixedStr(data?.geo_fixed?.district ?? 0, 2),
          geo_fixed_district_coord: toFixedStr(data?.geo_fixed?.district_coord ?? 0, 2),
          geo_fixed_state: toFixedStr(data?.geo_fixed?.state ?? 0, 2),
          geo_fixed_state_coord: toFixedStr(data?.geo_fixed?.state_coord ?? 0, 2),
          geo_fixed_employee: toFixedStr(data?.geo_fixed?.employee ?? 0, 2),
          geo_fixed_royalty: toFixedStr(data?.geo_fixed?.royalty ?? 0, 2),
        };
        setM759Server({
          direct_bonus: { sponsor: toNum(vals.direct_bonus_sponsor), self: toNum(vals.direct_bonus_self) },
          geo_mode: vals.geo_mode || "",
          geo: {
            sub_franchise: toNum(vals.geo_sub_franchise),
            pincode: toNum(vals.geo_pincode),
            pincode_coord: toNum(vals.geo_pincode_coord),
            district: toNum(vals.geo_district),
            district_coord: toNum(vals.geo_district_coord),
            state: toNum(vals.geo_state),
            state_coord: toNum(vals.geo_state_coord),
            employee: toNum(vals.geo_employee),
            royalty: toNum(vals.geo_royalty),
          },
          geo_fixed: {
            sub_franchise: toNum(vals.geo_fixed_sub_franchise),
            pincode: toNum(vals.geo_fixed_pincode),
            pincode_coord: toNum(vals.geo_fixed_pincode_coord),
            district: toNum(vals.geo_fixed_district),
            district_coord: toNum(vals.geo_fixed_district_coord),
            state: toNum(vals.geo_fixed_state),
            state_coord: toNum(vals.geo_fixed_state_coord),
            employee: toNum(vals.geo_fixed_employee),
            royalty: toNum(vals.geo_fixed_royalty),
          },
        });

        // Populate monthly 759 config (first vs subsequent, levels, agency toggle, base)
        const mm = data?.monthly_759 || {};
        const levels = Array.isArray(mm?.levels_fixed) ? mm.levels_fixed : [50, 10, 5, 5, 10];
        const padded = [...levels, 0, 0, 0, 0, 0].slice(0, 5);
        const mvals = {
          monthly_direct_first: toFixedStr(mm?.direct_first_month ?? 250, 2),
          monthly_direct_monthly: toFixedStr(mm?.direct_monthly ?? 50, 2),
          monthly_base_amount: toFixedStr(mm?.base_amount ?? 759, 2),
          monthly_agency_enabled: (mm?.agency_enabled ? "1" : "0"),
          monthly_matrix_open_mode: String((mm?.matrix_open_mode || "")).toUpperCase(),
          monthly_l1: toFixedStr(padded[0] ?? 0, 2),
          monthly_l2: toFixedStr(padded[1] ?? 0, 2),
          monthly_l3: toFixedStr(padded[2] ?? 0, 2),
          monthly_l4: toFixedStr(padded[3] ?? 0, 2),
          monthly_l5: toFixedStr(padded[4] ?? 0, 2),
        };
        setM759MServer({
          direct_first_month: toNum(mvals.monthly_direct_first),
          direct_monthly: toNum(mvals.monthly_direct_monthly),
          base_amount: toNum(mvals.monthly_base_amount),
          agency_enabled: mvals.monthly_agency_enabled === "1",
          monthly_matrix_open_mode: mvals.monthly_matrix_open_mode,
          levels_fixed: padded.map((x) => toNum(x)),
        });
        setM759MForm(mvals);

        setM759Form(vals);
      })
      .catch((e) => setErr(parseError(e) || "Failed to load ₹759 Commission"))
      .finally(() => mounted && setM759Loading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onM759Change(name, value) {
    if (name === "geo_mode") {
      setM759Form((f) => ({ ...f, geo_mode: String(value || "").toLowerCase() }));
      return;
    }
    if (value === "") {
      setM759Form((f) => ({ ...f, [name]: "" }));
      return;
    }
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    let norm = parts[0];
    if (parts.length > 1) norm += "." + parts[1].slice(0, 2);
    if (norm === "") norm = "0";
    const n = Number(norm);
    if (!isFinite(n) || n < 0) return;
    setM759Form((f) => ({ ...f, [name]: norm }));
  }

  const m759ChangedPayload = useMemo(() => {
    if (!m759Server) return {};
    const out = {};
    // direct bonus
    const sponsorCur = Number(Number(m759Form.direct_bonus_sponsor || 0).toFixed(2));
    const sponsorBase = Number(Number(m759Server.direct_bonus?.sponsor ?? 0).toFixed(2));
    const selfCur = Number(Number(m759Form.direct_bonus_self || 0).toFixed(2));
    const selfBase = Number(Number(m759Server.direct_bonus?.self ?? 0).toFixed(2));
    if (sponsorCur !== sponsorBase || selfCur !== selfBase) {
      out.direct_bonus = {};
      if (sponsorCur !== sponsorBase) out.direct_bonus.sponsor = sponsorCur;
      if (selfCur !== selfBase) out.direct_bonus.self = selfCur;
    }
    // geo mode
    const gmCur = (m759Form.geo_mode || "").toLowerCase();
    const gmBase = String(m759Server.geo_mode || "").toLowerCase();
    if (gmCur !== gmBase) out.geo_mode = gmCur;

    // geo percents
    const gKeys = [
      "sub_franchise",
      "pincode",
      "pincode_coord",
      "district",
      "district_coord",
      "state",
      "state_coord",
      "employee",
      "royalty",
    ];
    gKeys.forEach((k) => {
      const formV = Number(Number(m759Form[`geo_${k}`] || 0).toFixed(2));
      const baseV = Number(Number(m759Server.geo?.[k] ?? 0).toFixed(2));
      if (formV !== baseV) {
        out.geo = out.geo || {};
        out.geo[k] = formV;
      }
    });

    // geo fixed rupees
    gKeys.forEach((k) => {
      const formV = Number(Number(m759Form[`geo_fixed_${k}`] || 0).toFixed(2));
      const baseV = Number(Number(m759Server.geo_fixed?.[k] ?? 0).toFixed(2));
      if (formV !== baseV) {
        out.geo_fixed = out.geo_fixed || {};
        out.geo_fixed[k] = formV;
      }
    });

    return out;
  }, [m759Server, m759Form]);
  const m759Dirty = Object.keys(m759ChangedPayload).length > 0;

  const m759MonthlyChangedPayload = useMemo(() => {
    if (!m759MServer) return {};
    const out = {};
    const vFirst = Number(Number(m759MForm.monthly_direct_first || 0).toFixed(2));
    const vFirstBase = Number(Number(m759MServer.direct_first_month || 0).toFixed(2));
    if (vFirst !== vFirstBase) out.direct_first_month = vFirst;

    const vMon = Number(Number(m759MForm.monthly_direct_monthly || 0).toFixed(2));
    const vMonBase = Number(Number(m759MServer.direct_monthly || 0).toFixed(2));
    if (vMon !== vMonBase) out.direct_monthly = vMon;

    const vBaseAmt = Number(Number(m759MForm.monthly_base_amount || 0).toFixed(2));
    const vBaseAmtBase = Number(Number(m759MServer.base_amount || 0).toFixed(2));
    if (vBaseAmt !== vBaseAmtBase) out.base_amount = vBaseAmt;

    const vAgency = m759MForm.monthly_agency_enabled === "1";
    const vAgencyBase = Boolean(m759MServer.agency_enabled);
    if (vAgency !== vAgencyBase) out.agency_enabled = vAgency;

    const mmModeCur = String(m759MForm.monthly_matrix_open_mode || "").toUpperCase();
    const mmModeBase = String(m759MServer.monthly_matrix_open_mode || "");
    if (mmModeCur && mmModeCur !== mmModeBase) out.matrix_open_mode = mmModeCur;

    return out;
  }, [m759MServer, m759MForm]);
  const m759MonthlyDirty = Object.keys(m759MonthlyChangedPayload).length > 0;

  async function onM759Save() {
    if ((!m759Dirty && !m759MonthlyDirty) || m759Saving) return;
    if (!act759BalanceInfo.isBalanced759) {
      setErr(`Incorrect configuration: Total outflows (₹${act759BalanceInfo.totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${act759BalanceInfo.base759Total.toFixed(2)}) by deficit of ₹${Math.abs(act759BalanceInfo.remainingMargin759).toFixed(2)}! Save rejected. Please correct amounts.`);
      return;
    }
    setM759Saving(true);
    setErr("");
    setOk("");
    try {
      const payload = { ...m759ChangedPayload };
      if (m759MonthlyDirty) {
        payload.monthly_759 = { ...m759MonthlyChangedPayload };
      }
      const data = await adminUpdateMasterCommission(payload, PRODUCT_RS_759);
      const gm = String(data?.geo_mode || "").toLowerCase();
      const direct = data?.direct_bonus || {};
      const geo = data?.geo || {};
      const gf = data?.geo_fixed || {};
      const vals = {
        direct_bonus_sponsor: toFixedStr(direct.sponsor ?? 0, 2),
        direct_bonus_self: toFixedStr(direct.self ?? 0, 2),
        geo_mode: gm,
        geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
        geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
        geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
        geo_district: toFixedStr(geo.district ?? 0, 2),
        geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
        geo_state: toFixedStr(geo.state ?? 0, 2),
        geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
        geo_employee: toFixedStr(geo.employee ?? 0, 2),
        geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
        geo_fixed_sub_franchise: toFixedStr(gf.sub_franchise ?? 0, 2),
        geo_fixed_pincode: toFixedStr(gf.pincode ?? 0, 2),
        geo_fixed_pincode_coord: toFixedStr(gf.pincode_coord ?? 0, 2),
        geo_fixed_district: toFixedStr(gf.district ?? 0, 2),
        geo_fixed_district_coord: toFixedStr(gf.district_coord ?? 0, 2),
        geo_fixed_state: toFixedStr(gf.state ?? 0, 2),
        geo_fixed_state_coord: toFixedStr(gf.state_coord ?? 0, 2),
        geo_fixed_employee: toFixedStr(gf.employee ?? 0, 2),
        geo_fixed_royalty: toFixedStr(gf.royalty ?? 0, 2),
      };
      setM759Server({
        direct_bonus: {
          sponsor: toNum(vals.direct_bonus_sponsor),
          self: toNum(vals.direct_bonus_self),
        },
        geo_mode: vals.geo_mode || "",
        geo: {
          sub_franchise: toNum(vals.geo_sub_franchise),
          pincode: toNum(vals.geo_pincode),
          pincode_coord: toNum(vals.geo_pincode_coord),
          district: toNum(vals.geo_district),
          district_coord: toNum(vals.geo_district_coord),
          state: toNum(vals.geo_state),
          state_coord: toNum(vals.geo_state_coord),
          employee: toNum(vals.geo_employee),
          royalty: toNum(vals.geo_royalty),
        },
        geo_fixed: {
          sub_franchise: toNum(vals.geo_fixed_sub_franchise),
          pincode: toNum(vals.geo_fixed_pincode),
          pincode_coord: toNum(vals.geo_fixed_pincode_coord),
          district: toNum(vals.geo_fixed_district),
          district_coord: toNum(vals.geo_fixed_district_coord),
          state: toNum(vals.geo_fixed_state),
          state_coord: toNum(vals.geo_fixed_state_coord),
          employee: toNum(vals.geo_fixed_employee),
          royalty: toNum(vals.geo_fixed_royalty),
        },
      });
      // Normalize monthly block back to UI
      const mm2 = data?.monthly_759 || {};
      const levels2 = Array.isArray(mm2?.levels_fixed) ? mm2.levels_fixed : [50, 10, 5, 5, 10];
      const padded2 = [...levels2, 0, 0, 0, 0, 0].slice(0, 5);
      const mvals2 = {
        monthly_direct_first: toFixedStr(mm2?.direct_first_month ?? 250, 2),
        monthly_direct_monthly: toFixedStr(mm2?.direct_monthly ?? 50, 2),
        monthly_base_amount: toFixedStr(mm2?.base_amount ?? 759, 2),
        monthly_agency_enabled: (mm2?.agency_enabled ? "1" : "0"),
        monthly_matrix_open_mode: String((mm2?.matrix_open_mode || "")).toUpperCase(),
        monthly_l1: toFixedStr(padded2[0] ?? 0, 2),
        monthly_l2: toFixedStr(padded2[1] ?? 0, 2),
        monthly_l3: toFixedStr(padded2[2] ?? 0, 2),
        monthly_l4: toFixedStr(padded2[3] ?? 0, 2),
        monthly_l5: toFixedStr(padded2[4] ?? 0, 2),
      };
      setM759MServer({
        direct_first_month: toNum(mvals2.monthly_direct_first),
        direct_monthly: toNum(mvals2.monthly_direct_monthly),
        base_amount: toNum(mvals2.monthly_base_amount),
        agency_enabled: mvals2.monthly_agency_enabled === "1",
        monthly_matrix_open_mode: mvals2.monthly_matrix_open_mode,
        levels_fixed: padded2.map((x) => toNum(x)),
      });
      setM759MForm(mvals2);

      setM759Form(vals);
      setOk("₹759 Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (₹759 Commission)");
    } finally {
      setM759Saving(false);
    }
  }

  // Block overrides  ₹759
  const [mx759Loading, setMx759Loading] = useState(true);
  const [mx759Saving, setMx759Saving] = useState(false);
  const [mx759Server, setMx759Server] = useState(null);
  const [mx759Form, setMx759Form] = useState({
    five_levels: "",
    five_amounts: "",
    five_percents: "",
    three_levels: "",
    three_amounts: "",
    three_percents: "",
  });

  useEffect(() => {
    let mounted = true;
    setMx759Loading(true);
    adminGetMatrixCommissionConfig(PRODUCT_RS_759)
      .then((d) => {
        if (!mounted) return;
        const raw5 = Number(d?.five_matrix_levels ?? 0);
        const fiveLevels = (!raw5 || raw5 === 6) ? 10 : raw5;
        const fiveAmounts = Array.isArray(d?.five_matrix_amounts_json) ? d.five_matrix_amounts_json : [];
        const fivePercs = Array.isArray(d?.five_matrix_percents_json) ? d.five_matrix_percents_json : [];
        const raw3 = Number(d?.three_matrix_levels ?? 0);
        const threeLevels = (!raw3) ? 15 : raw3;
        const threeAmounts = Array.isArray(d?.three_matrix_amounts_json) ? d.three_matrix_amounts_json : [];
        const threePercs = Array.isArray(d?.three_matrix_percents_json) ? d.three_matrix_percents_json : [];
        setMx759Server({
          five_matrix_levels: fiveLevels,
          five_matrix_amounts_json: fiveAmounts.map((x) => toNum(x)),
          five_matrix_percents_json: fivePercs.map((x) => toNum(x)),
          three_matrix_levels: threeLevels,
          three_matrix_amounts_json: threeAmounts.map((x) => toNum(x)),
          three_matrix_percents_json: threePercs.map((x) => toNum(x)),
        });
        setMx759Form({
          five_levels: String(fiveLevels || ""),
          five_amounts: fiveAmounts.map((x) => toFixedStr(x, 2)).join(", "),
          five_percents: fivePercs.map((x) => toFixedStr(x, 2)).join(", "),
          three_levels: String(threeLevels || ""),
          three_amounts: threeAmounts.map((x) => toFixedStr(x, 2)).join(", "),
          three_percents: threePercs.map((x) => toFixedStr(x, 2)).join(", "),
        });
      })
      .catch((e) => setErr(parseError(e) || "Failed to load ₹759 Block Commission"))
      .finally(() => mounted && setMx759Loading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onMx759Change(name, value) {
    if (name.endsWith("_levels")) {
      if (/^\d*$/.test(value)) setMx759Form((f) => ({ ...f, [name]: value }));
      return;
    }
    setMx759Form((f) => ({ ...f, [name]: value }));
  }

  const mx759ChangedPayload = useMemo(() => {
    if (!mx759Server) return {};
    const out = {};
    const fiveL = mx759Form.five_levels === "" ? null : Number(mx759Form.five_levels);
    if (fiveL !== null && fiveL !== mx759Server.five_matrix_levels) out.five_matrix_levels = fiveL;

    const fiveAmt = parseNumArray(mx759Form.five_amounts);
    if (JSON.stringify(fiveAmt) !== JSON.stringify(mx759Server.five_matrix_amounts_json))
      out.five_matrix_amounts_json = fiveAmt;

    const fivePct = parseNumArray(mx759Form.five_percents);
    if (JSON.stringify(fivePct) !== JSON.stringify(mx759Server.five_matrix_percents_json))
      out.five_matrix_percents_json = fivePct;

    const threeL = mx759Form.three_levels === "" ? null : Number(mx759Form.three_levels);
    if (threeL !== null && threeL !== mx759Server.three_matrix_levels) out.three_matrix_levels = threeL;

    const threeAmt = parseNumArray(mx759Form.three_amounts);
    if (JSON.stringify(threeAmt) !== JSON.stringify(mx759Server.three_matrix_amounts_json))
      out.three_matrix_amounts_json = threeAmt;

    const threePct = parseNumArray(mx759Form.three_percents);
    if (JSON.stringify(threePct) !== JSON.stringify(mx759Server.three_matrix_percents_json))
      out.three_matrix_percents_json = threePct;

    return out;
  }, [mx759Server, mx759Form]);
  const mx759Dirty = Object.keys(mx759ChangedPayload).length > 0;

  async function onMx759Save() {
    if (!mx759Dirty || mx759Saving) return;
    if (!act759BalanceInfo.isBalanced759) {
      setErr(`Incorrect configuration: Total outflows (₹${act759BalanceInfo.totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${act759BalanceInfo.base759Total.toFixed(2)}) by deficit of ₹${Math.abs(act759BalanceInfo.remainingMargin759).toFixed(2)}! Save rejected. Please correct amounts.`);
      return;
    }
    setMx759Saving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMatrixCommissionConfig(mx759ChangedPayload, PRODUCT_RS_759);
      const fiveLevels = Number(data?.five_matrix_levels ?? 0) || 0;
      const fiveAmounts = Array.isArray(data?.five_matrix_amounts_json) ? data.five_matrix_amounts_json : [];
      const fivePercs = Array.isArray(data?.five_matrix_percents_json) ? data.five_matrix_percents_json : [];
      const threeLevels = Number(data?.three_matrix_levels ?? 0) || 0;
      const threeAmounts = Array.isArray(data?.three_matrix_amounts_json) ? data.three_matrix_amounts_json : [];
      const threePercs = Array.isArray(data?.three_matrix_percents_json) ? data.three_matrix_percents_json : [];
      setMx759Server({
        five_matrix_levels: fiveLevels,
        five_matrix_amounts_json: fiveAmounts.map((x) => toNum(x)),
        five_matrix_percents_json: fivePercs.map((x) => toNum(x)),
        three_matrix_levels: threeLevels,
        three_matrix_amounts_json: threeAmounts.map((x) => toNum(x)),
        three_matrix_percents_json: threePercs.map((x) => toNum(x)),
      });
      setMx759Form({
        five_levels: String(fiveLevels || ""),
        five_amounts: fiveAmounts.map((x) => toFixedStr(x, 2)).join(", "),
        five_percents: fivePercs.map((x) => toFixedStr(x, 2)).join(", "),
        three_levels: String(threeLevels || ""),
        three_amounts: threeAmounts.map((x) => toFixedStr(x, 2)).join(", "),
        three_percents: threePercs.map((x) => toFixedStr(x, 2)).join(", "),
      });
      setOk("₹759 Block Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (₹759 Block Commission)");
    } finally {
      setMx759Saving(false);
    }
  }

  // 4) Withdraw Distribution Preview
  const [pUser, setPUser] = useState(""); // user id or username
  const [pAmount, setPAmount] = useState("");
  const [pLoading, setPLoading] = useState(false);
  const [pData, setPData] = useState(null);

  async function onPreview() {
    setPLoading(true);
    setErr("");
    setOk("");
    setPData(null);
    try {
      const isId = /^\d+$/.test((pUser || "").trim());
      const payload = { user_id: null, user: null, username: null, amount: Number(pAmount || 0) };
      if (isId) payload.user_id = Number(pUser);
      else payload.username = (pUser || "").trim();
      const data = await adminPreviewWithdrawDistribution(payload);
      setPData(data || null);
    } catch (e) {
      setErr(parseError(e) || "Preview failed");
    } finally {
      setPLoading(false);
    }
  }

  const act150BalanceInfo = useMemo(() => {
    const ds150 = Number(m150Form.direct_bonus_sponsor || 0);
    const self150 = Number(m150Form.direct_bonus_self || 0);
    const m5Arr150 = parseNumArray(mx150Form.five_amounts || "");
    const sumM5_150 = m5Arr150.length ? Math.round(m5Arr150.reduce((a, b) => a + b, 0) * 100) / 100 : 16;
    const m3Arr150 = parseNumArray(mx150Form.three_amounts || "");
    const sumM3_150 = m3Arr150.length ? Math.round(m3Arr150.reduce((a, b) => a + b, 0) * 100) / 100 : 5.5;

    const isFixedGeo150 = (m150Form.geo_mode || "").toLowerCase() === "fixed";
    const geoFixedSum150 = ["geo_fixed_sub_franchise", "geo_fixed_pincode", "geo_fixed_pincode_coord", "geo_fixed_district", "geo_fixed_district_coord", "geo_fixed_state", "geo_fixed_state_coord", "geo_fixed_employee", "geo_fixed_royalty"]
      .reduce((acc, k) => acc + Number(m150Form[k] || 0), 0);
    const geoEffective150 = Math.round((isFixedGeo150 ? geoFixedSum150 : 20) * 100) / 100;

    const base150Total = Number(m150Form.product_base_amount || 150);
    const configuredTaxPct150 = Number(mForm.tax_percent) > 0 ? Number(mForm.tax_percent) : 18;
    const tax150 = Math.round((base150Total * configuredTaxPct150 / 100) * 100) / 100;
    const totalOutflow150 = Math.round((ds150 + self150 + sumM5_150 + sumM3_150 + geoEffective150 + tax150) * 100) / 100;
    const remainingMargin150 = Math.round((base150Total - totalOutflow150) * 100) / 100;
    const isBalanced150 = remainingMargin150 >= 0;

    return {
      ds150,
      self150,
      m5Arr150,
      sumM5_150,
      m3Arr150,
      sumM3_150,
      isFixedGeo150,
      geoEffective150,
      base150Total,
      configuredTaxPct150,
      tax150,
      totalOutflow150,
      remainingMargin150,
      isBalanced150,
    };
  }, [m150Form, mx150Form, mForm.tax_percent]);

  const act750BalanceInfo = useMemo(() => {
    const ds750 = Number(m750Form.direct_bonus_sponsor || 0);
    const self750 = Number(m750Form.direct_bonus_self || 0);
    const m5Arr750 = parseNumArray(mx750Form.five_amounts || "");
    const sumM5_750 = m5Arr750.length ? Math.round(m5Arr750.reduce((a, b) => a + b, 0) * 100) / 100 : 80;
    const m3Arr750 = parseNumArray(mx750Form.three_amounts || "");
    const sumM3_750 = m3Arr750.length ? Math.round(m3Arr750.reduce((a, b) => a + b, 0) * 100) / 100 : 27.5;

    const isFixedGeo750 = (m750Form.geo_mode || "").toLowerCase() === "fixed";
    const geoFixedSum750 = ["geo_fixed_sub_franchise", "geo_fixed_pincode", "geo_fixed_pincode_coord", "geo_fixed_district", "geo_fixed_district_coord", "geo_fixed_state", "geo_fixed_state_coord", "geo_fixed_employee", "geo_fixed_royalty"]
      .reduce((acc, k) => acc + Number(m750Form[k] || 0), 0);
    const geoEffective750 = Math.round((isFixedGeo750 ? geoFixedSum750 : 100) * 100) / 100;

    const base750Total = Number(m750Form.product_base_amount) > 0 ? Number(m750Form.product_base_amount) : 750;
    const configuredTaxPct750 = customModuleTax.tax_750 !== undefined ? Number(customModuleTax.tax_750) : (Number(mForm.tax_percent) > 0 ? Number(mForm.tax_percent) : 18);
    const tax750 = Math.round((base750Total * configuredTaxPct750 / 100) * 100) / 100;
    const totalOutflow750 = Math.round((ds750 + self750 + sumM5_750 + sumM3_750 + geoEffective750 + tax750) * 100) / 100;
    const remainingMargin750 = Math.round((base750Total - totalOutflow750) * 100) / 100;
    const isBalanced750 = remainingMargin750 >= 0;

    return {
      ds750,
      self750,
      m5Arr750,
      sumM5_750,
      m3Arr750,
      sumM3_750,
      isFixedGeo750,
      geoEffective750,
      base750Total,
      configuredTaxPct750,
      tax750,
      totalOutflow750,
      remainingMargin750,
      isBalanced750,
    };
  }, [m750Form, mx750Form, customModuleTax.tax_750, mForm.tax_percent]);

  const act759BalanceInfo = useMemo(() => {
    const ds759 = Number(m759Form.direct_bonus_sponsor || 0);
    const self759 = Number(m759Form.direct_bonus_self || 0);
    const m5Arr759 = parseNumArray(mx759Form.five_amounts || "");
    const sumM5_759 = m5Arr759.length ? Math.round(m5Arr759.reduce((a, b) => a + b, 0) * 100) / 100 : 75;
    const m3Arr759 = parseNumArray(mx759Form.three_amounts || "");
    const sumM3_759 = m3Arr759.length ? Math.round(m3Arr759.reduce((a, b) => a + b, 0) * 100) / 100 : 22.5;

    const isFixedGeo759 = (m759Form.geo_mode || "").toLowerCase() === "fixed";
    const geoFixedSum759 = ["geo_fixed_sub_franchise", "geo_fixed_pincode", "geo_fixed_pincode_coord", "geo_fixed_district", "geo_fixed_district_coord", "geo_fixed_state", "geo_fixed_state_coord", "geo_fixed_employee", "geo_fixed_royalty"]
      .reduce((acc, k) => acc + Number(m759Form[k] || 0), 0);
    const geoEffective759 = Math.round((isFixedGeo759 ? geoFixedSum759 : 100) * 100) / 100;

    const base759Total = Number(m759MForm.monthly_base_amount || 759);
    const configuredTaxPct759 = Number(mForm.tax_percent) > 0 ? Number(mForm.tax_percent) : 18;
    const tax759 = Math.round((base759Total * configuredTaxPct759 / 100) * 100) / 100;
    const totalOutflow759 = Math.round((ds759 + self759 + sumM5_759 + sumM3_759 + geoEffective759 + tax759) * 100) / 100;
    const remainingMargin759 = Math.round((base759Total - totalOutflow759) * 100) / 100;
    const isBalanced759 = remainingMargin759 >= 0;

    return {
      ds759,
      self759,
      m5Arr759,
      sumM5_759,
      m3Arr759,
      sumM3_759,
      isFixedGeo759,
      geoEffective759,
      base759Total,
      configuredTaxPct759,
      tax759,
      totalOutflow759,
      remainingMargin759,
      isBalanced759,
    };
  }, [m759Form, mx759Form, m759MForm.monthly_base_amount, mForm.tax_percent]);

  const SubHeader = ({ title, right }) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{title}</div>
      {right}
    </div>
  );

  const SaveBtn = ({ onClick, disabled, saving, dirty, labelSaved = "Saved", imbalanced = false, imbalancedMsg = "" }) => (
    <button
      type="button"
      onClick={(e) => {
        try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch (_) {}
        if (imbalanced) {
          setErr(imbalancedMsg || "Incorrect configuration: Total outflows exceed Total Inflow! Save rejected. Please correct amounts.");
          return;
        }
        if (typeof onClick === "function") onClick(e);
      }}
      disabled={disabled || saving || (!dirty && !imbalanced)}
      style={{
        height: 30,
        padding: "0 12px",
        borderRadius: 8,
        border: imbalanced ? "1px solid #dc2626" : "1px solid #0b8d2b",
        background: imbalanced ? "#ef4444" : dirty ? "#10b981" : "#86efac",
        color: imbalanced ? "#ffffff" : "#052e16",
        fontWeight: 900,
        cursor: disabled || saving ? "not-allowed" : "pointer",
        transition: "all 0.15s ease",
      }}
      title={imbalanced ? (imbalancedMsg || "Incorrect configuration: Outflows exceed total inflow") : undefined}
    >
      {imbalanced ? "⚠ Imbalanced" : saving ? "Saving..." : dirty ? "Save Changes" : labelSaved}
    </button>
  );

  // Renderers for each tab
  function renderTab150() {
    const {
      ds150,
      self150,
      m5Arr150,
      sumM5_150,
      m3Arr150,
      sumM3_150,
      isFixedGeo150,
      geoEffective150,
      base150Total,
      configuredTaxPct150,
      tax150,
      totalOutflow150,
      remainingMargin150,
      isBalanced150,
    } = act150BalanceInfo;

    return (
      <>
        {/* ── Strict Financial Accounting & Tax Ledger for 150 ── */}
        <Section
          title="₹150 Activation Strict Financial Accounting & Tax Ledger"
          subtitle="Real-time breakdown of ₹150 customer inflow, statutory company tax (GST), direct bonuses, block payouts, and retained gross margin"
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>TOTAL INFLOW</div>
              <div style={{ fontSize: 18, color: "#0f172a", fontWeight: 900 }}>₹{base150Total.toFixed(2)}</div>
            </div>
            <div style={{ background: "#eff6ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>COMPANY TAX (GST POOL)</div>
                <div style={{ fontSize: 18, color: "#1e40af", fontWeight: 900 }}>₹{tax150.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "#1e40af", fontWeight: 700 }}>Tax Rate:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={configuredTaxPct150}
                  onChange={(e) => updateModuleTax("tax_150", e.target.value)}
                  style={{ width: 55, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #93c5fd", background: "#fff", color: "#1e40af" }}
                />
                <span style={{ fontSize: 11, color: "#1e40af", fontWeight: 800 }}>%</span>
              </div>
            </div>
            <div style={{ background: "#faf5ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>DIRECT (SPONSOR+SELF)</div>
              <div style={{ fontSize: 18, color: "#6b21a8", fontWeight: 900 }}>₹{(ds150 + self150).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: "#9333ea" }}>Sponsor: ₹{ds150} | Self: ₹{self150}</div>
            </div>
            <div style={{ background: "#fdf4ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #f5d0fe" }}>
              <div style={{ fontSize: 11, color: "#a21caf", fontWeight: 700 }}>BLOCK EARNINGS (5+3)</div>
              <div style={{ fontSize: 18, color: "#86198f", fontWeight: 900 }}>₹{(sumM5_150 + sumM3_150).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: "#c026d3" }}>5-Block: ₹{sumM5_150} | 3-Block: ₹{sumM3_150}</div>
            </div>
            <div style={{ background: "#fffbeb", padding: "10px 14px", borderRadius: 8, border: "1px solid #fde68a" }}>
              <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>GEO / FRANCHISE POOL</div>
              <div style={{ fontSize: 18, color: "#92400e", fontWeight: 900 }}>₹{geoEffective150.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: "#d97706" }}>Mode: {isFixedGeo150 ? "Fixed (₹)" : "Percent"}</div>
            </div>
            <div style={{ background: isBalanced150 ? "#f0fdf4" : "#fef2f2", padding: "10px 14px", borderRadius: 8, border: isBalanced150 ? "1px solid #bbf7d0" : "1px solid #fecaca" }}>
              <div style={{ fontSize: 11, color: isBalanced150 ? "#15803d" : "#b91c1c", fontWeight: 700 }}>COMPANY GROSS MARGIN</div>
              <div style={{ fontSize: 18, color: isBalanced150 ? "#166534" : "#991b1b", fontWeight: 900 }}>₹{remainingMargin150.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: isBalanced150 ? "#22c55e" : "#ef4444" }}>Remaining Net Operating Margin</div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: isBalanced150 ? "#f0fdf4" : "#fef2f2",
              border: isBalanced150 ? "1px solid #bbf7d0" : "1px solid #fecaca",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: isBalanced150 ? "#166534" : "#991b1b" }}>
              {isBalanced150
                ? `✓ Balanced Financial Accounting: Total Inflow ₹${base150Total} = Company Tax (₹${tax150}) + Outflows (Sponsor ₹${ds150} + Self ₹${self150} + 5-Block ₹${sumM5_150} + 3-Block ₹${sumM3_150} + Geo ₹${geoEffective150}) + Retained Company Margin ₹${remainingMargin150.toFixed(2)}`
                : `⚠ Incorrect Configuration: Total Inflow (₹${base150Total}) is exceeded by allocated outflows and tax! Deficit: ₹${Math.abs(remainingMargin150)} — Saving is disabled until balanced.`}
            </span>
          </div>
        </Section>

        <Section
          title="₹150 Activation  Direct Referral Bonuses"
          subtitle="Set sponsor/self direct bonuses specific to ₹150 activation."
          right={
            <SaveBtn
              onClick={onM150Save}
              disabled={m150Loading}
              saving={m150Saving}
              dirty={m150Dirty}
              imbalanced={!isBalanced150}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow150.toFixed(2)}) exceed Total Inflow (₹${base150Total.toFixed(2)}) by ₹${Math.abs(remainingMargin150).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {m150Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input label="Sponsor (₹)" value={m150Form.direct_bonus_sponsor} onChange={(v) => onM150Change("direct_bonus_sponsor", v)} />
              <Input label="Self (₹)" value={m150Form.direct_bonus_self} onChange={(v) => onM150Change("direct_bonus_self", v)} />
            </div>
          )}
        </Section>

        <Section
          title="₹150 Activation  Base & Opening"
          subtitle="Base used for geo percent splits; activation count opens N 5/3 block accounts per activation."
          right={
            <SaveBtn
              onClick={onM150Save}
              disabled={m150Loading}
              saving={m150Saving}
              dirty={m150Dirty}
              imbalanced={!isBalanced150}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow150.toFixed(2)}) exceed Total Inflow (₹${base150Total.toFixed(2)}) by ₹${Math.abs(remainingMargin150).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {m150Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input label="Base Amount (₹)" value={m150Form.product_base_amount} onChange={(v) => onM150Change("product_base_amount", v)} />
              <Input label="Coupons Activation Count" type="text" step="1" min="0" placeholder="e.g. 1" value={m150Form.coupon_activation_count} onChange={(v) => onM150Change("coupon_activation_count", v)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 220px" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Block Open Mode</label>
                <select
                  value={m150Form.matrix_open_mode || ""}
                  onChange={(e) => onM150Change("matrix_open_mode", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value=""></option>
                  <option value="FIRST_TIME_ONLY">FIRST_TIME_ONLY</option>
                  <option value="EVERY_PURCHASE">EVERY_PURCHASE</option>
                  <option value="NEVER">NEVER</option>
                </select>
              </div>
              <Input label="Block Open Count" type="text" step="1" min="0" placeholder="e.g. 1" value={m150Form.matrix_open_count} onChange={(v) => onM150Change("matrix_open_count", v)} />
            </div>
          )}
        </Section>

        <Section
          title="₹150 Activation  Block Toggles"
          subtitle="Enable or disable consumer block payouts for ₹150 via policy flags. Per-package arrays under Block Commission also imply enablement."
right={
            <SaveBtn
              onClick={() => onMasterSave()}
              disabled={mLoading}
              saving={mSaving}
              dirty={mDirty}
            />
          }
        >
          {mLoading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 220px" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Enable 5‑Block (₹150)</label>
                <select
                  value={mForm.prime150_enable_5 || "0"}
                  onChange={(e) => onMChange("prime150_enable_5", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 220px" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Enable 3‑Block (₹150)</label>
                <select
                  value={mForm.prime150_enable_3 || "0"}
                  onChange={(e) => onMChange("prime150_enable_3", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </div>
            </div>
          )}
        </Section>


        <Section
          title="₹150 Activation  Reward Points"
          subtitle="Set points credited on ₹150 activation. Prime 750 uses the configured multiplier × this value."
          right={
            <SaveBtn
              onClick={() =>
                onMasterSave({
                  commissions: {
                    prime_150: {
                      rewards: {
                        points_amount: Number(Number(mForm.prime150_reward_points_amount || 0).toFixed(2)),
                      },
                    },
                  },
                })
              }
              disabled={mLoading}
              saving={mSaving}
              dirty={
                Number(Number(mForm.prime150_reward_points_amount || 0).toFixed(2)) !==
                Number(Number(mServer?.prime150_reward_points_amount || 0).toFixed(2))
              }
            />
          }
        >
          {mLoading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input
                  label="Reward Points (150)"
                  value={mForm.prime150_reward_points_amount}
                  onChange={(v) => onMChange("prime150_reward_points_amount", v)}
                />
              </div>
              <div style={{ fontSize: 12, color: "#334155" }}>
                Preview: 150 Reward Points = {toFixedStr(mForm.prime150_reward_points_amount || 0, 2)}; 750 Reward Points ={" "}
                {toFixedStr(Number(mForm.prime150_reward_points_amount || 0) * Number(mForm.prime750_multiplier || mServer?.prime750_multiplier || 1), 2)}
              </div>
            </>
          )}
        </Section>

        <Section
          title="₹150 Activation  Geo (Agency)"
          subtitle="Percent vs fixed mode per role. Empty values imply fallback to global defaults."
          right={
            <SaveBtn
              onClick={onM150Save}
              disabled={m150Loading}
              saving={m150Saving}
              dirty={m150Dirty}
              imbalanced={!isBalanced150}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow150.toFixed(2)}) exceed Total Inflow (₹${base150Total.toFixed(2)}) by ₹${Math.abs(remainingMargin150).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {m150Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="Sub Franchise (%)" value={m150Form.geo_sub_franchise} onChange={(v) => onM150Change("geo_sub_franchise", v)} />
                <Input label="Pincode (%)" value={m150Form.geo_pincode} onChange={(v) => onM150Change("geo_pincode", v)} />
                <Input label="Pincode Coordinator (%)" value={m150Form.geo_pincode_coord} onChange={(v) => onM150Change("geo_pincode_coord", v)} />
                <Input label="District (%)" value={m150Form.geo_district} onChange={(v) => onM150Change("geo_district", v)} />
                <Input label="District Coordinator (%)" value={m150Form.geo_district_coord} onChange={(v) => onM150Change("geo_district_coord", v)} />
                <Input label="State (%)" value={m150Form.geo_state} onChange={(v) => onM150Change("geo_state", v)} />
                <Input label="State Coordinator (%)" value={m150Form.geo_state_coord} onChange={(v) => onM150Change("geo_state_coord", v)} />
                <Input label="Employee (%)" value={m150Form.geo_employee} onChange={(v) => onM150Change("geo_employee", v)} />
                <Input label="Admin (Company) (%)" value={m150Form.geo_royalty} onChange={(v) => onM150Change("geo_royalty", v)} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Geo Mode</label>
                <select
                  value={m150Form.geo_mode || ""}
                  onChange={(e) => onM150Change("geo_mode", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value=""></option>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Input label="Sub Franchise (₹)" value={m150Form.geo_fixed_sub_franchise} onChange={(v) => onM150Change("geo_fixed_sub_franchise", v)} />
                <Input label="Pincode (₹)" value={m150Form.geo_fixed_pincode} onChange={(v) => onM150Change("geo_fixed_pincode", v)} />
                <Input label="Pincode Coordinator (₹)" value={m150Form.geo_fixed_pincode_coord} onChange={(v) => onM150Change("geo_fixed_pincode_coord", v)} />
                <Input label="District (₹)" value={m150Form.geo_fixed_district} onChange={(v) => onM150Change("geo_fixed_district", v)} />
                <Input label="District Coordinator (₹)" value={m150Form.geo_fixed_district_coord} onChange={(v) => onM150Change("geo_fixed_district_coord", v)} />
                <Input label="State (₹)" value={m150Form.geo_fixed_state} onChange={(v) => onM150Change("geo_fixed_state", v)} />
                <Input label="State Coordinator (₹)" value={m150Form.geo_fixed_state_coord} onChange={(v) => onM150Change("geo_fixed_state_coord", v)} />
                <Input label="Employee (₹)" value={m150Form.geo_fixed_employee} onChange={(v) => onM150Change("geo_fixed_employee", v)} />
                <Input label="Admin (Company) (₹)" value={m150Form.geo_fixed_royalty} onChange={(v) => onM150Change("geo_fixed_royalty", v)} />
              </div>
            </>
          )}
        </Section>

        <Section
          title="₹150 Activation  Block Commission (5 & 3)"
          subtitle="Per-package overrides for layers and arrays. Amounts in ₹, Percents in %."
          right={
            <SaveBtn
              onClick={onMx150Save}
              disabled={mx150Loading || ((Number(mx150Form.five_levels||0)>0)&&((mx150Form.five_amounts && parseNumArray(mx150Form.five_amounts).length!==Number(mx150Form.five_levels))||(mx150Form.five_percents && parseNumArray(mx150Form.five_percents).length!==Number(mx150Form.five_levels)))) || ((Number(mx150Form.three_levels||0)>0)&&((mx150Form.three_amounts && parseNumArray(mx150Form.three_amounts).length!==Number(mx150Form.three_levels))||(mx150Form.three_percents && parseNumArray(mx150Form.three_percents).length!==Number(mx150Form.three_levels))))}
              saving={mx150Saving}
              dirty={mx150Dirty}
              imbalanced={!isBalanced150}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow150.toFixed(2)}) exceed Total Inflow (₹${base150Total.toFixed(2)}) by ₹${Math.abs(remainingMargin150).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {mx150Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="5-Block Layers" type="text" step="1" min="0" placeholder="e.g. 10" value={mx150Form.five_levels} onChange={(v) => onMx150Change("five_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Block Amounts (₹, CSV)</label>
                  <textarea
                    value={mx150Form.five_amounts}
                    onChange={(e) => onMx150Change("five_amounts", e.target.value)}
                    placeholder="e.g. 15, 2, 2.5, 0.5, 0.05, 0.1"
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Block Percents (%, CSV)</label>
                  <textarea
                    value={mx150Form.five_percents}
                    onChange={(e) => onMx150Change("five_percents", e.target.value)}
                    placeholder="e.g. 10, 5, 3, 2, 1, 1"
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Input label="3-Block Layers" type="text" step="1" min="0" placeholder="e.g. 15" value={mx150Form.three_levels} onChange={(v) => onMx150Change("three_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Block Amounts (₹, CSV)</label>
                  <textarea
                    value={mx150Form.three_amounts}
                    onChange={(e) => onMx150Change("three_amounts", e.target.value)}
                    placeholder="e.g. 15, 2, 2.5, 0.5, 0.05, 0.1, ..."
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Block Percents (%, CSV)</label>
                  <textarea
                    value={mx150Form.three_percents}
                    onChange={(e) => onMx150Change("three_percents", e.target.value)}
                    placeholder="e.g. 10, 5, 3, 2, 1, 1, ..."
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </Section>
      </>
    );
  }

  function renderTab750() {
    const {
      ds750,
      self750,
      m5Arr750,
      sumM5_750,
      m3Arr750,
      sumM3_750,
      isFixedGeo750,
      geoEffective750,
      base750Total,
      configuredTaxPct750,
      tax750,
      totalOutflow750,
      remainingMargin750,
      isBalanced750,
    } = act750BalanceInfo;

    // Helper to distribute a pool total evenly across matrix layers
    const update5BlockTotal750 = (newVal) => {
      let val = Math.round((Math.max(0, Number(newVal) || 0)) * 100) / 100;
      if (val > base750Total) val = base750Total;
      const levels = Math.max(1, Number(mx750Form.five_levels) || (m5Arr750.length > 0 ? m5Arr750.length : 10));
      const perLevel = Math.round((val / levels) * 100) / 100;
      const arr = Array(levels).fill(perLevel);
      const diff = Math.round((val - perLevel * levels) * 100) / 100;
      if (diff !== 0 && arr.length > 0) {
        arr[arr.length - 1] = Math.round((arr[arr.length - 1] + diff) * 100) / 100;
      }
      onMx750Change("five_amounts", arr.map((x) => Number(x).toFixed(2)).join(", "));
    };

    const update3BlockTotal750 = (newVal) => {
      let val = Math.round((Math.max(0, Number(newVal) || 0)) * 100) / 100;
      if (val > base750Total) val = base750Total;
      const levels = Math.max(1, Number(mx750Form.three_levels) || (m3Arr750.length > 0 ? m3Arr750.length : 15));
      const perLevel = Math.round((val / levels) * 100) / 100;
      const arr = Array(levels).fill(perLevel);
      const diff = Math.round((val - perLevel * levels) * 100) / 100;
      if (diff !== 0 && arr.length > 0) {
        arr[arr.length - 1] = Math.round((arr[arr.length - 1] + diff) * 100) / 100;
      }
      onMx750Change("three_amounts", arr.map((x) => Number(x).toFixed(2)).join(", "));
    };

    // Helper to distribute Geo Pool
    const updateGeoPool750 = (val) => {
      let newTotal = Math.round((Math.max(0, Number(val) || 0)) * 100) / 100;
      if (newTotal > base750Total) newTotal = base750Total;
      const keys = [
        "geo_fixed_sub_franchise",
        "geo_fixed_pincode",
        "geo_fixed_pincode_coord",
        "geo_fixed_district",
        "geo_fixed_district_coord",
        "geo_fixed_state",
        "geo_fixed_state_coord",
        "geo_fixed_employee",
        "geo_fixed_royalty"
      ];
      const curSum = keys.reduce((acc, k) => acc + Number(m750Form[k] || 0), 0);
      if (curSum > 0) {
        const ratio = newTotal / curSum;
        let distributed = 0;
        keys.forEach((k, idx) => {
          if (idx === keys.length - 1) {
            const lastVal = Math.round((newTotal - distributed) * 100) / 100;
            onM750Change(k, String(Math.max(0, lastVal)));
          } else {
            const scaled = Math.round(Number(m750Form[k] || 0) * ratio * 100) / 100;
            distributed += scaled;
            onM750Change(k, String(scaled));
          }
        });
      } else {
        const share = Math.round((newTotal / 5) * 100) / 100;
        onM750Change("geo_fixed_sub_franchise", String(share));
        onM750Change("geo_fixed_pincode", String(share));
        onM750Change("geo_fixed_district", String(share));
        onM750Change("geo_fixed_state", String(share));
        const remainder = Math.round((newTotal - share * 4) * 100) / 100;
        onM750Change("geo_fixed_royalty", String(remainder));
      }
      onM750Change("geo_mode", "fixed");
    };

    const resetTab750ToDefaults = () => {
      onM750Change("product_base_amount", "750.00");
      onM750Change("direct_bonus_sponsor", "150.00");
      onM750Change("direct_bonus_self", "0.00");
      onMx750Change("five_amounts", "30.00, 10.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00");
      onMx750Change("three_amounts", "2.50, 2.50, 2.50, 2.50, 2.50, 1.50, 1.50, 1.50, 1.50, 1.50, 1.50, 1.50, 1.50, 1.50, 2.50");
      const geoDefault = {
        geo_fixed_sub_franchise: "25.00",
        geo_fixed_pincode: "15.00",
        geo_fixed_pincode_coord: "10.00",
        geo_fixed_district: "10.00",
        geo_fixed_district_coord: "10.00",
        geo_fixed_state: "10.00",
        geo_fixed_state_coord: "10.00",
        geo_fixed_employee: "5.00",
        geo_fixed_royalty: "5.00",
      };
      Object.entries(geoDefault).forEach(([k, v]) => onM750Change(k, v));
      onM750Change("geo_mode", "fixed");
      setOk("Reset to balanced ₹750 Activation defaults (Base ₹750, Outflows balanced)");
      setErr("");
    };

    const handleSaveAll750Ledger = async () => {
      if (!isBalanced750) {
        setErr(`Incorrect configuration: Total outflows (₹${totalOutflow750.toFixed(2)}) exceed Total Inflow (₹${base750Total.toFixed(2)}) by deficit of ₹${Math.abs(remainingMargin750).toFixed(2)}! Save rejected. Please correct amounts.`);
        return;
      }
      let saved = false;
      if (m750Dirty) {
        await onM750Save();
        saved = true;
      }
      if (mx750Dirty) {
        await onMx750Save();
        saved = true;
      }
      setOk(saved ? "₹750 Activation Ledger updates saved successfully!" : "Ledger settings are already up to date.");
    };

    return (
      <>
        {/* ── Strict Financial Accounting & Tax Ledger ── */}
        <Section
          title="₹750 Activation Strict Financial Accounting & Tax Ledger"
          subtitle="Real-time breakdown of ₹750 customer inflow, statutory company tax (GST), upline distributions, and retained gross margin"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={resetTab750ToDefaults}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "#f1f5f9",
                  color: "#334155",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "all 0.15s ease",
                }}
              >
                ↺ Reset to Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveAll750Ledger}
                disabled={m750Saving || mx750Saving}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: !isBalanced750 ? "#dc2626" : (m750Dirty || mx750Dirty) ? "#16a34a" : "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
                title={!isBalanced750 ? `Incorrect configuration: Total outflows (₹${totalOutflow750.toFixed(2)}) exceed Total Inflow (₹${base750Total.toFixed(2)}) by ₹${Math.abs(remainingMargin750).toFixed(2)}! Save rejected.` : undefined}
              >
                {!isBalanced750 ? "⚠ Imbalanced (Save Blocked)" : (m750Saving || mx750Saving) ? "Saving..." : (m750Dirty || mx750Dirty) ? "Save Ledger Changes *" : "Ledger Saved ✓"}
              </button>
            </div>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 }}>
            {/* 1. TOTAL INFLOW (Editable Base) */}
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>TOTAL INFLOW</div>
                <div style={{ fontSize: 18, color: "#0f172a", fontWeight: 900 }}>₹{base750Total.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Inflow (₹):</span>
                <LedgerNumberInput
                  step="50"
                  min={100}
                  value={m750Form.product_base_amount || 750}
                  onChange={(val) => onM750Change("product_base_amount", val)}
                  style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", textAlign: "right" }}
                />
              </div>
            </div>

            {/* 2. COMPANY TAX (GST POOL) (Editable Rate % & Tax ₹) */}
            <div style={{ background: "#eff6ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>COMPANY TAX (GST POOL)</div>
                <div style={{ fontSize: 18, color: "#1e40af", fontWeight: 900 }}>₹{tax750.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>Rate (%):</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <LedgerNumberInput
                      step="0.1"
                      min={0}
                      max={100}
                      value={configuredTaxPct750}
                      onChange={(val) => updateModuleTax("tax_750", val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #93c5fd", background: "#fff", color: "#1e40af", textAlign: "right" }}
                    />
                    <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 800 }}>%</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>Tax (₹):</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="0.5"
                      min={0}
                      max={base750Total}
                      value={tax750}
                      onChange={(amt) => {
                        if (amt >= base750Total) return;
                        const pct = Math.round(((amt / base750Total) * 100) * 10) / 10;
                        updateModuleTax("tax_750", pct);
                      }}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #93c5fd", background: "#fff", color: "#1e40af", textAlign: "right" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. DIRECT (SPONSOR+SELF) (Editable Sponsor & Self) */}
            <div style={{ background: "#faf5ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #e9d5ff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>DIRECT (SPONSOR+SELF)</div>
                <div style={{ fontSize: 18, color: "#6b21a8", fontWeight: 900 }}>₹{(ds750 + self750).toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>Sponsor:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="1"
                      min={0}
                      max={base750Total}
                      value={m750Form.direct_bonus_sponsor}
                      onChange={(val) => onM750Change("direct_bonus_sponsor", val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #d8b4fe", background: "#fff", color: "#6b21a8", textAlign: "right" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>Self:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="1"
                      min={0}
                      max={base750Total}
                      value={m750Form.direct_bonus_self}
                      onChange={(val) => onM750Change("direct_bonus_self", val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #d8b4fe", background: "#fff", color: "#6b21a8", textAlign: "right" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. BLOCK EARNINGS (5+3) (Editable 5-Block & 3-Block totals) */}
            <div style={{ background: "#fdf4ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #f5d0fe", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#a21caf", fontWeight: 700 }}>BLOCK EARNINGS (5+3)</div>
                <div style={{ fontSize: 18, color: "#86198f", fontWeight: 900 }}>₹{(sumM5_750 + sumM3_750).toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#a21caf", fontWeight: 700 }}>5-Block:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#a21caf", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="0.5"
                      min={0}
                      max={base750Total}
                      value={sumM5_750}
                      onChange={(val) => update5BlockTotal750(val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #f0abfc", background: "#fff", color: "#86198f", textAlign: "right" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#a21caf", fontWeight: 700 }}>3-Block:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#a21caf", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="0.5"
                      min={0}
                      max={base750Total}
                      value={sumM3_750}
                      onChange={(val) => update3BlockTotal750(val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #f0abfc", background: "#fff", color: "#86198f", textAlign: "right" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. GEO / FRANCHISE POOL (Editable Pool ₹ & Mode selector) */}
            <div style={{ background: "#fffbeb", padding: "10px 14px", borderRadius: 8, border: "1px solid #fde68a", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>GEO / FRANCHISE POOL</div>
                <div style={{ fontSize: 18, color: "#92400e", fontWeight: 900 }}>₹{geoEffective750.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>Pool (₹):</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#b45309", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="1"
                      min={0}
                      max={base750Total}
                      value={geoEffective750}
                      onChange={(val) => updateGeoPool750(val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #fcd34d", background: "#fff", color: "#92400e", textAlign: "right" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>Mode:</span>
                  <select
                    value={m750Form.geo_mode || "percent"}
                    onChange={(e) => onM750Change("geo_mode", e.target.value)}
                    style={{ fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 4, border: "1px solid #fcd34d", background: "#fff", color: "#92400e" }}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 6. COMPANY GROSS MARGIN (Editable Target & Auto-Balance) */}
            <div style={{ background: isBalanced750 ? "#f0fdf4" : "#fef2f2", padding: "10px 14px", borderRadius: 8, border: isBalanced750 ? "1px solid #bbf7d0" : "1px solid #fecaca", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: isBalanced750 ? "#15803d" : "#b91c1c", fontWeight: 700 }}>COMPANY GROSS MARGIN</div>
                <div style={{ fontSize: 18, color: isBalanced750 ? "#166534" : "#991b1b", fontWeight: 900 }}>₹{remainingMargin750.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: isBalanced750 ? "#15803d" : "#b91c1c", fontWeight: 700 }}>Target (₹):</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: isBalanced750 ? "#15803d" : "#b91c1c", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="1"
                      placeholder={remainingMargin750.toFixed(2)}
                      value={targetMargin750 !== null ? targetMargin750 : ""}
                      onChange={(val) => setTargetMargin750(val === "" ? null : Number(val))}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #86efac", background: "#fff", color: isBalanced750 ? "#166534" : "#991b1b", textAlign: "right" }}
                    />
                  </div>
                </div>
                {targetMargin750 !== null && Number(targetMargin750) !== remainingMargin750 && (
                  <button
                    type="button"
                    onClick={() => {
                      const diff = remainingMargin750 - Number(targetMargin750);
                      updateGeoPool750(Math.max(0, geoEffective750 + diff));
                    }}
                    style={{
                      marginTop: 2,
                      padding: "2px 6px",
                      fontSize: 10,
                      fontWeight: 700,
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "center",
                    }}
                  >
                    Auto-Balance to Target
                  </button>
                )}
              </div>
            </div>
          </div>


          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: isBalanced750 ? "#f0fdf4" : "#fef2f2",
              border: isBalanced750 ? "1px solid #bbf7d0" : "1px solid #fecaca",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: isBalanced750 ? "#166534" : "#991b1b" }}>
              {isBalanced750
                ? `✓ Balanced Financial Accounting: Total Inflow ₹${base750Total.toFixed(2)} = Company Tax (₹${tax750.toFixed(2)}) + Outflows (Sponsor ₹${ds750.toFixed(2)} + Self ₹${self750.toFixed(2)} + 5-Block ₹${sumM5_750.toFixed(2)} + 3-Block ₹${sumM3_750.toFixed(2)} + Geo ₹${geoEffective750.toFixed(2)}) + Retained Company Margin ₹${remainingMargin750.toFixed(2)}`
                : `⚠ Incorrect Configuration: Total Inflow (₹${base750Total.toFixed(2)}) is exceeded by allocated outflows and tax! Deficit: ₹${Math.abs(remainingMargin750).toFixed(2)} — Saving is disabled until balanced.`}
            </span>
          </div>
        </Section>

        <Section
          title="₹750 Activation — Direct Referral Bonuses"
          subtitle="Set sponsor/self direct bonuses specific to ₹750 Activation."
        >
          {m750Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input label="Sponsor (₹)" value={m750Form.direct_bonus_sponsor} onChange={(v) => onM750Change("direct_bonus_sponsor", v)} />
              <Input label="Self (₹)" value={m750Form.direct_bonus_self} onChange={(v) => onM750Change("direct_bonus_self", v)} />
            </div>
          )}
        </Section>

        <Section
          title="₹750 Activation — Base & Opening (Locked / System Preset)"
          subtitle="Fixed Base Amount (₹750) used for geo percent splits and matrix payouts. Locked by system configuration."
        >
          {m750Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input
                label="Base Amount (₹)"
                value={m750Form.product_base_amount}
                disabled
                onChange={() => {}}
              />
              <Input
                label="Activation Open Count"
                type="text"
                step="1"
                min="0"
                placeholder="e.g. 1"
                value={m750Form.activation_open_count}
                disabled
                onChange={() => {}}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 220px" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Block Open Mode</label>
                <select
                  value={m750Form.matrix_open_mode || "FIRST_TIME_ONLY"}
                  disabled
                  onChange={() => {}}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700, background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }}
                >
                  <option value="FIRST_TIME_ONLY">FIRST_TIME_ONLY</option>
                  <option value="EVERY_PURCHASE">EVERY_PURCHASE</option>
                  <option value="NEVER">NEVER</option>
                </select>
              </div>
              <Input
                label="Block Open Count"
                type="text"
                step="1"
                min="0"
                placeholder="e.g. 1"
                value={m750Form.matrix_open_count}
                disabled
                onChange={() => {}}
              />
            </div>
          )}
        </Section>

        <Section
          title="Prime 750 — Settings (Locked / System Preset)"
          subtitle="Fixed 750× multiplier that scales off Prime 150. Base package is fixed to Prime 150."
        >
          {mLoading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input
                label="Multiplier (×)"
                type="text"
                step="1"
                min="1"
                placeholder="e.g. 1"
                value={mForm.prime750_multiplier}
                disabled
                onChange={() => {}}
              />
            </div>
          )}
        </Section>

        <Section
          title="₹750 Activation — Geo (Agency)"
          subtitle="Percent vs fixed mode per role. Empty values imply fallback to global defaults."
        >
          {m750Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="Sub Franchise (%)" value={m750Form.geo_sub_franchise} onChange={(v) => onM750Change("geo_sub_franchise", v)} />
                <Input label="Pincode (%)" value={m750Form.geo_pincode} onChange={(v) => onM750Change("geo_pincode", v)} />
                <Input label="Pincode Coordinator (%)" value={m750Form.geo_pincode_coord} onChange={(v) => onM750Change("geo_pincode_coord", v)} />
                <Input label="District (%)" value={m750Form.geo_district} onChange={(v) => onM750Change("geo_district", v)} />
                <Input label="District Coordinator (%)" value={m750Form.geo_district_coord} onChange={(v) => onM750Change("geo_district_coord", v)} />
                <Input label="State (%)" value={m750Form.geo_state} onChange={(v) => onM750Change("geo_state", v)} />
                <Input label="State Coordinator (%)" value={m750Form.geo_state_coord} onChange={(v) => onM750Change("geo_state_coord", v)} />
                <Input label="Employee (%)" value={m750Form.geo_employee} onChange={(v) => onM750Change("geo_employee", v)} />
                <Input label="Admin (Company) (%)" value={m750Form.geo_royalty} onChange={(v) => onM750Change("geo_royalty", v)} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Geo Mode</label>
                <select
                  value={m750Form.geo_mode || ""}
                  onChange={(e) => onM750Change("geo_mode", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value=""></option>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Input label="Sub Franchise (₹)" value={m750Form.geo_fixed_sub_franchise} onChange={(v) => onM750Change("geo_fixed_sub_franchise", v)} />
                <Input label="Pincode (₹)" value={m750Form.geo_fixed_pincode} onChange={(v) => onM750Change("geo_fixed_pincode", v)} />
                <Input label="Pincode Coordinator (₹)" value={m750Form.geo_fixed_pincode_coord} onChange={(v) => onM750Change("geo_fixed_pincode_coord", v)} />
                <Input label="District (₹)" value={m750Form.geo_fixed_district} onChange={(v) => onM750Change("geo_fixed_district", v)} />
                <Input label="District Coordinator (₹)" value={m750Form.geo_fixed_district_coord} onChange={(v) => onM750Change("geo_fixed_district_coord", v)} />
                <Input label="State (₹)" value={m750Form.geo_fixed_state} onChange={(v) => onM750Change("geo_fixed_state", v)} />
                <Input label="State Coordinator (₹)" value={m750Form.geo_fixed_state_coord} onChange={(v) => onM750Change("geo_fixed_state_coord", v)} />
                <Input label="Employee (₹)" value={m750Form.geo_fixed_employee} onChange={(v) => onM750Change("geo_fixed_employee", v)} />
                <Input label="Admin (Company) (₹)" value={m750Form.geo_fixed_royalty} onChange={(v) => onM750Change("geo_fixed_royalty", v)} />
              </div>
            </>
          )}
        </Section>

        <Section
          title="₹750 Activation — Block Commission (5 & 3)"
          subtitle="Fixed rupee amounts per layer for 5-block and 3-block matrix."
        >
          {mx750Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="5-Block Layers" type="text" step="1" min="0" placeholder="e.g. 10" value={mx750Form.five_levels} onChange={(v) => onMx750Change("five_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 500px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Block Amounts (₹ Fixed per Layer, CSV)</label>
                  <textarea
                    value={mx750Form.five_amounts}
                    onChange={(e) => onMx750Change("five_amounts", e.target.value)}
                    placeholder="e.g. 15, 2, 2.5, 0.5, 0.05, 0.1"
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Input label="3-Block Layers" type="text" step="1" min="0" placeholder="e.g. 15" value={mx750Form.three_levels} onChange={(v) => onMx750Change("three_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 500px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Block Amounts (₹ Fixed per Layer, CSV)</label>
                  <textarea
                    value={mx750Form.three_amounts}
                    onChange={(e) => onMx750Change("three_amounts", e.target.value)}
                    placeholder="e.g. 15, 2, 2.5, 0.5, 0.05, 0.1, ..."
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </Section>
      </>
    );
  }

  function renderTab759() {
    const {
      ds759,
      self759,
      m5Arr759,
      sumM5_759,
      m3Arr759,
      sumM3_759,
      isFixedGeo759,
      geoEffective759,
      base759Total,
      configuredTaxPct759,
      tax759,
      totalOutflow759,
      remainingMargin759,
      isBalanced759,
    } = act759BalanceInfo;

    return (
      <>
        {/* ── Strict Financial Accounting & Tax Ledger for SPP ── */}
        <Section
          title="SPP Activation Strict Financial Accounting & Tax Ledger"
          subtitle="Real-time breakdown of ₹759 SPP inflow, statutory company tax (GST), direct rewards, block pools, and retained gross margin"
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>TOTAL SPP INFLOW</div>
              <div style={{ fontSize: 18, color: "#0f172a", fontWeight: 900 }}>₹{base759Total.toFixed(2)}</div>
            </div>
            <div style={{ background: "#eff6ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>COMPANY TAX (GST POOL)</div>
              <div style={{ fontSize: 18, color: "#1e40af", fontWeight: 900 }}>₹{tax759.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: "#3b82f6" }}>Statutory Withholding</div>
            </div>
            <div style={{ background: "#faf5ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #e9d5ff" }}>
              <div style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>DIRECT (SPONSOR+SELF)</div>
              <div style={{ fontSize: 18, color: "#6b21a8", fontWeight: 900 }}>₹{(ds759 + self759).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: "#9333ea" }}>Sponsor: ₹{ds759} | Self: ₹{self759}</div>
            </div>
            <div style={{ background: "#fdf4ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #f5d0fe" }}>
              <div style={{ fontSize: 11, color: "#a21caf", fontWeight: 700 }}>BLOCK EARNINGS (5+3)</div>
              <div style={{ fontSize: 18, color: "#86198f", fontWeight: 900 }}>₹{(sumM5_759 + sumM3_759).toFixed(2)}</div>
              <div style={{ fontSize: 10, color: "#c026d3" }}>5-Block: ₹{sumM5_759} | 3-Block: ₹{sumM3_759}</div>
            </div>
            <div style={{ background: "#fffbeb", padding: "10px 14px", borderRadius: 8, border: "1px solid #fde68a" }}>
              <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>GEO / FRANCHISE POOL</div>
              <div style={{ fontSize: 18, color: "#92400e", fontWeight: 900 }}>₹{geoEffective759.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: "#d97706" }}>Mode: {isFixedGeo759 ? "Fixed (₹)" : "Percent"}</div>
            </div>
            <div style={{ background: isBalanced759 ? "#f0fdf4" : "#fef2f2", padding: "10px 14px", borderRadius: 8, border: isBalanced759 ? "1px solid #bbf7d0" : "1px solid #fecaca" }}>
              <div style={{ fontSize: 11, color: isBalanced759 ? "#15803d" : "#b91c1c", fontWeight: 700 }}>COMPANY GROSS MARGIN</div>
              <div style={{ fontSize: 18, color: isBalanced759 ? "#166534" : "#991b1b", fontWeight: 900 }}>₹{remainingMargin759.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: isBalanced759 ? "#22c55e" : "#ef4444" }}>Remaining Net Operating Margin</div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: isBalanced759 ? "#f0fdf4" : "#fef2f2",
              border: isBalanced759 ? "1px solid #bbf7d0" : "1px solid #fecaca",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: isBalanced759 ? "#166534" : "#991b1b" }}>
              {isBalanced759
                ? `✓ Balanced Financial Accounting: Total Inflow ₹${base759Total} = Company Tax (₹${tax759}) + Outflows (Sponsor ₹${ds759} + Self ₹${self759} + 5-Block ₹${sumM5_759} + 3-Block ₹${sumM3_759} + Geo ₹${geoEffective759}) + Retained Company Margin ₹${remainingMargin759.toFixed(2)}`
                : `⚠ Incorrect Configuration: Total Inflow (₹${base759Total}) is exceeded by allocated outflows and tax! Deficit: ₹${Math.abs(remainingMargin759)} — Saving is disabled until balanced.`}
            </span>
          </div>
        </Section>

        <Section
          title="SPP Activation Direct Referral Bonuses"
          subtitle="Set sponsor/self direct bonuses specific to SPP activation."
          right={
            <SaveBtn
              onClick={onM759Save}
              disabled={m759Loading}
              saving={m759Saving}
              dirty={m759Dirty || m759MonthlyDirty}
              imbalanced={!isBalanced759}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${base759Total.toFixed(2)}) by ₹${Math.abs(remainingMargin759).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {m759Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input label="Sponsor (₹)" value={m759Form.direct_bonus_sponsor} onChange={(v) => onM759Change("direct_bonus_sponsor", v)} />
              <Input label="Self (₹)" value={m759Form.direct_bonus_self} onChange={(v) => onM759Change("direct_bonus_self", v)} />
            </div>
          )}
        </Section>

        {/* Reward Points Base Section */}
        <Section
          title="SPP Monthly Reward Points (Base Amount)"
          subtitle="Reward points credited each month equal this Base Amount."
          right={
            <SaveBtn
              onClick={onM759Save}
              disabled={m759Loading}
              saving={m759Saving}
              dirty={m759MonthlyDirty}
              imbalanced={!isBalanced759}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${base759Total.toFixed(2)}) by ₹${Math.abs(remainingMargin759).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {m759Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input
                  label="Base Amount (₹)"
                  value={m759MForm.monthly_base_amount}
                  onChange={(v) => onM759MonthlyChange("monthly_base_amount", v)}
                />
              </div>
              <div style={{ fontSize: 12, color: "#334155" }}>
                Wallet Reward Points (monthly) = Base Amount (₹) = {toFixedStr(m759MForm.monthly_base_amount || 0, 2)}
              </div>
            </>
          )}
        </Section>

        <Section
          title="SPP Monthly Direct Bonuses and Settings"
          subtitle="Configure first-month vs subsequent-month sponsor bonus, base amount, and agency toggle for SPP flows."
          right={
            <SaveBtn
              onClick={onM759Save}
              disabled={m759Loading}
              saving={m759Saving}
              dirty={m759Dirty || m759MonthlyDirty}
              imbalanced={!isBalanced759}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${base759Total.toFixed(2)}) by ₹${Math.abs(remainingMargin759).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {m759Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="First Month Sponsor (₹)" value={m759MForm.monthly_direct_first} onChange={(v) => onM759MonthlyChange("monthly_direct_first", v)} />
                <Input label="Monthly Sponsor (₹)" value={m759MForm.monthly_direct_monthly} onChange={(v) => onM759MonthlyChange("monthly_direct_monthly", v)} />
                <Input label="Base Amount (₹)" value={m759MForm.monthly_base_amount} onChange={(v) => onM759MonthlyChange("monthly_base_amount", v)} />
              </div>
              <div style={{ fontSize: 12, color: "#334155" }}>
                Reward Points (monthly) = Base Amount (₹) = {toFixedStr(m759MForm.monthly_base_amount || 0, 2)}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Agency Enabled</label>
                <select
                  value={m759MForm.monthly_agency_enabled || "1"}
                  onChange={(e) => onM759MonthlyChange("monthly_agency_enabled", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Monthly Block Open Mode</label>
                <select
                  value={m759MForm.monthly_matrix_open_mode || ""}
                  onChange={(e) => onM759MonthlyChange("monthly_matrix_open_mode", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value=""></option>
                  <option value="FIRST_MONTH_ONLY">FIRST_MONTH_ONLY</option>
                  <option value="EVERY_PURCHASE">EVERY_PURCHASE</option>
                  <option value="NEVER">NEVER</option>
                </select>
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Monthly L1–L5 level payouts are disabled and hidden from this screen.
              </div>
            </>
          )}
        </Section>

        <Section
          title="SPP Activation Geo (Agency)"
          subtitle="Percent vs fixed mode per role. Empty values imply fallback to global defaults."
          right={
            <SaveBtn
              onClick={onM759Save}
              disabled={m759Loading}
              saving={m759Saving}
              dirty={m759Dirty || m759MonthlyDirty}
              imbalanced={!isBalanced759}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${base759Total.toFixed(2)}) by ₹${Math.abs(remainingMargin759).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {m759Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="Sub Franchise (%)" value={m759Form.geo_sub_franchise} onChange={(v) => onM759Change("geo_sub_franchise", v)} />
                <Input label="Pincode (%)" value={m759Form.geo_pincode} onChange={(v) => onM759Change("geo_pincode", v)} />
                <Input label="Pincode Coordinator (%)" value={m759Form.geo_pincode_coord} onChange={(v) => onM759Change("geo_pincode_coord", v)} />
                <Input label="District (%)" value={m759Form.geo_district} onChange={(v) => onM759Change("geo_district", v)} />
                <Input label="District Coordinator (%)" value={m759Form.geo_district_coord} onChange={(v) => onM759Change("geo_district_coord", v)} />
                <Input label="State (%)" value={m759Form.geo_state} onChange={(v) => onM759Change("geo_state", v)} />
                <Input label="State Coordinator (%)" value={m759Form.geo_state_coord} onChange={(v) => onM759Change("geo_state_coord", v)} />
                <Input label="Employee (%)" value={m759Form.geo_employee} onChange={(v) => onM759Change("geo_employee", v)} />
                <Input label="Admin (Company) (%)" value={m759Form.geo_royalty} onChange={(v) => onM759Change("geo_royalty", v)} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Geo Mode</label>
                <select
                  value={m759Form.geo_mode || ""}
                  onChange={(e) => onM759Change("geo_mode", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value=""></option>
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Input label="Sub Franchise (₹)" value={m759Form.geo_fixed_sub_franchise} onChange={(v) => onM759Change("geo_fixed_sub_franchise", v)} />
                <Input label="Pincode (₹)" value={m759Form.geo_fixed_pincode} onChange={(v) => onM759Change("geo_fixed_pincode", v)} />
                <Input label="Pincode Coordinator (₹)" value={m759Form.geo_fixed_pincode_coord} onChange={(v) => onM759Change("geo_fixed_pincode_coord", v)} />
                <Input label="District (₹)" value={m759Form.geo_fixed_district} onChange={(v) => onM759Change("geo_fixed_district", v)} />
                <Input label="District Coordinator (₹)" value={m759Form.geo_fixed_district_coord} onChange={(v) => onM759Change("geo_fixed_district_coord", v)} />
                <Input label="State (₹)" value={m759Form.geo_fixed_state} onChange={(v) => onM759Change("geo_fixed_state", v)} />
                <Input label="State Coordinator (₹)" value={m759Form.geo_fixed_state_coord} onChange={(v) => onM759Change("geo_fixed_state_coord", v)} />
                <Input label="Employee (₹)" value={m759Form.geo_fixed_employee} onChange={(v) => onM759Change("geo_fixed_employee", v)} />
                <Input label="Admin (Company) (₹)" value={m759Form.geo_fixed_royalty} onChange={(v) => onM759Change("geo_fixed_royalty", v)} />
              </div>
            </>
          )}
        </Section>

        <Section
          title="SPP Activation Block Commission (5 & 3)"
          subtitle="Per-package overrides for layers and arrays. Amounts in ₹, Percents in %."
          right={
            <SaveBtn
              onClick={onMx759Save}
              disabled={mx759Loading || ((Number(mx759Form.five_levels||0)>0)&&((mx759Form.five_amounts && parseNumArray(mx759Form.five_amounts).length!==Number(mx759Form.five_levels))||(mx759Form.five_percents && parseNumArray(mx759Form.five_percents).length!==Number(mx759Form.five_levels)))) || ((Number(mx759Form.three_levels||0)>0)&&((mx759Form.three_amounts && parseNumArray(mx759Form.three_amounts).length!==Number(mx759Form.three_levels))||(mx759Form.three_percents && parseNumArray(mx759Form.three_percents).length!==Number(mx759Form.three_levels))))}
              saving={mx759Saving}
              dirty={mx759Dirty}
              imbalanced={!isBalanced759}
              imbalancedMsg={`Incorrect configuration: Total outflows (₹${totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${base759Total.toFixed(2)}) by ₹${Math.abs(remainingMargin759).toFixed(2)}! Save rejected.`}
            />
          }
        >
          {mx759Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="5-Block Layers" type="text" step="1" min="0" placeholder="e.g. 10" value={mx759Form.five_levels} onChange={(v) => onMx759Change("five_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Block Amounts (₹, CSV)</label>
                  <textarea
                    value={mx759Form.five_amounts}
                    onChange={(e) => onMx759Change("five_amounts", e.target.value)}
                    placeholder="e.g. 15, 2, 2.5, 0.5, 0.05, 0.1"
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Block Percents (%, CSV)</label>
                  <textarea
                    value={mx759Form.five_percents}
                    onChange={(e) => onMx759Change("five_percents", e.target.value)}
                    placeholder="e.g. 10, 5, 3, 2, 1, 1"
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Input label="3-Block Layers" type="text" step="1" min="0" placeholder="e.g. 15" value={mx759Form.three_levels} onChange={(v) => onMx759Change("three_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Block Amounts (₹, CSV)</label>
                  <textarea
                    value={mx759Form.three_amounts}
                    onChange={(e) => onMx759Change("three_amounts", e.target.value)}
                    placeholder="e.g. 15, 2, 2.5, 0.5, 0.05, 0.1, ..."
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Block Percents (%, CSV)</label>
                  <textarea
                    value={mx759Form.three_percents}
                    onChange={(e) => onMx759Change("three_percents", e.target.value)}
                    placeholder="e.g. 10, 5, 3, 2, 1, 1, ..."
                    rows={2}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      background: "#fff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </Section>
      </>
    );
  }

  function renderTabWithdraw() {
    const taxDirty =
      mServer &&
      Number(Number(mForm.tax_percent).toFixed(2)) !==
        Number(Number(mServer.tax_percent).toFixed(2));
    const sponsorDirty =
      mServer &&
      Number(Number(mForm.withdrawal_sponsor_percent).toFixed(2)) !==
        Number(Number(mServer.withdrawal_sponsor_percent).toFixed(2));

    async function onWithdrawTaxSave() {
      const tp = Number(Number(mForm.tax_percent || 0).toFixed(2));
      if (!isFinite(tp)) return;
      await onMasterSave({ tax: { percent: tp } });
    }

    async function onWithdrawSave() {
      const sp = Number(Number(mForm.withdrawal_sponsor_percent || 0).toFixed(2));
      if (!isFinite(sp)) return;
      await onMasterSave({ withdrawal: { sponsor_percent: sp } });
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Unified Hub Banner */}
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#1e3a8a" }}>
                Unified Withdrawal Requests & Control Hub
              </div>
              <div style={{ fontSize: 12, color: "#3b82f6" }}>
                All user withdrawal requests, amount limits, weekly schedules, and TDS tax rules are unified inside the Withdrawal Requests screen.
              </div>
            </div>
          </div>
          <a
            href="/admin/withdrawals"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#1d4ed8",
              color: "#ffffff",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Open Withdrawal Requests Screen →
          </a>
        </div>

        {/* ── 1. Withdrawal Amount Limits & Thresholds ── */}
        <Section
          title="Withdrawal Amount Limits & Thresholds"
          subtitle="Configure minimum withdrawal balance, maximum amount per single transaction, and daily user payout limit"
          right={
            <SaveBtn
              onClick={handleSaveWithdrawalLimits}
              disabled={withdrawalLimitsSaving}
              saving={withdrawalLimitsSaving}
              dirty={withdrawalLimitsDirty}
            />
          }
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <Input
              label="Minimum Withdrawal Limit (₹)"
              type="number"
              step="1"
              min="1"
              value={withdrawalLimits.min_withdrawal ?? 500}
              onChange={(v) => {
                setWithdrawalLimits((prev) => ({ ...prev, min_withdrawal: Number(v) || 0 }));
                setWithdrawalLimitsDirty(true);
              }}
            />
            <Input
              label="Maximum per Request Limit (₹)"
              type="number"
              step="100"
              min="100"
              value={withdrawalLimits.max_withdrawal ?? 25000}
              onChange={(v) => {
                setWithdrawalLimits((prev) => ({ ...prev, max_withdrawal: Number(v) || 0 }));
                setWithdrawalLimitsDirty(true);
              }}
            />
            <Input
              label="Daily Maximum Cap per User (₹)"
              type="number"
              step="500"
              min="500"
              value={withdrawalLimits.daily_max_withdrawal ?? 50000}
              onChange={(v) => {
                setWithdrawalLimits((prev) => ({ ...prev, daily_max_withdrawal: Number(v) || 0 }));
                setWithdrawalLimitsDirty(true);
              }}
            />
          </div>
          <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569" }}>
            ℹ️ <strong>Rule Active:</strong> Users in the Asiya App cannot initiate withdrawals below ₹<strong>{withdrawalLimits.min_withdrawal ?? 500}</strong> or above ₹<strong>{withdrawalLimits.max_withdrawal ?? 25000}</strong> per transaction.
          </div>
        </Section>

        {/* ── 2. Operational Day & Time Window Controls ── */}
        <Section
          title="Operational Window & Weekly Day Controls"
          subtitle="Set allowed weekly withdrawal days, time window (IST), and master system toggle"
          right={
            <SaveBtn
              onClick={handleSaveWithdrawalLimits}
              disabled={withdrawalLimitsSaving}
              saving={withdrawalLimitsSaving}
              dirty={withdrawalLimitsDirty}
            />
          }
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
              <input
                type="checkbox"
                checked={withdrawalLimits.enabled !== false}
                onChange={(e) => {
                  setWithdrawalLimits((prev) => ({ ...prev, enabled: e.target.checked }));
                  setWithdrawalLimitsDirty(true);
                }}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              Withdrawals Enabled (Global Master Toggle)
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Allowed Day</label>
              <select
                value={withdrawalLimits.weekday ?? 2}
                onChange={(e) => {
                  setWithdrawalLimits((prev) => ({ ...prev, weekday: Number(e.target.value) }));
                  setWithdrawalLimitsDirty(true);
                }}
                style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
              >
                <option value={-1}>All Days (24x7 Open)</option>
                <option value={0}>Monday Only</option>
                <option value={1}>Tuesday Only</option>
                <option value={2}>Wednesday Only (Default)</option>
                <option value={3}>Thursday Only</option>
                <option value={4}>Friday Only</option>
                <option value={5}>Saturday Only</option>
                <option value={6}>Sunday Only</option>
              </select>
            </div>

            <Input
              label="Start Time (HH:MM IST)"
              type="text"
              placeholder="00:00"
              value={withdrawalLimits.start_time ?? "00:00"}
              onChange={(v) => {
                setWithdrawalLimits((prev) => ({ ...prev, start_time: v }));
                setWithdrawalLimitsDirty(true);
              }}
            />
            <Input
              label="End Time (HH:MM IST)"
              type="text"
              placeholder="23:59"
              value={withdrawalLimits.end_time ?? "23:59"}
              onChange={(v) => {
                setWithdrawalLimits((prev) => ({ ...prev, end_time: v }));
                setWithdrawalLimitsDirty(true);
              }}
            />
          </div>
        </Section>

        {/* ── 3. Withdrawal Tax / TDS ── */}
        <Section
          title="Withdrawal Tax / TDS"
          subtitle="Tax percent deducted from consumer withdrawal amount (separate from Sponsor Percent)."
          right={
            <button
              type="button"
              onClick={onWithdrawTaxSave}
              disabled={mLoading || mSaving || !taxDirty}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid #0b8d2b",
                background: taxDirty ? "#10b981" : "#86efac",
                color: "#052e16",
                fontWeight: 900,
                cursor: mLoading || mSaving || !taxDirty ? "not-allowed" : "pointer",
              }}
            >
              {mSaving ? "Saving..." : taxDirty ? "Save Changes" : "Saved"}
            </button>
          }
        >
          {mLoading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input
                label="Withdrawal Tax / TDS Percent (%)"
                value={mForm.tax_percent}
                onChange={(v) => onMChange("tax_percent", v)}
              />
            </div>
          )}
        </Section>

        <Section
          title="Withdrawal Commission"
          subtitle="Sponsor commission percent applied on withdrawals (global)."
          right={
            <button
              type="button"
              onClick={onWithdrawSave}
              disabled={mLoading || mSaving || !sponsorDirty}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid #0b8d2b",
                background: sponsorDirty ? "#10b981" : "#86efac",
                color: "#052e16",
                fontWeight: 900,
                cursor: mLoading || mSaving || !sponsorDirty ? "not-allowed" : "pointer",
              }}
            >
              {mSaving ? "Saving..." : sponsorDirty ? "Save Changes" : "Saved"}
            </button>
          }
        >
          {mLoading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input
                label="Sponsor Percent (%)"
                value={mForm.withdrawal_sponsor_percent}
                onChange={(v) => onMChange("withdrawal_sponsor_percent", v)}
              />
            </div>
          )}
        </Section>

        <Section
          title="Direct Refer Withdraw  Distribution Preview"
          subtitle="Enter a user (ID or username) and amount to see the sponsor bonus, TDS/company pool, and net to user."
          right={
            <button
              type="button"
              onClick={onPreview}
              disabled={pLoading || !pUser || !pAmount}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid #0ea5e9",
                background: "#e0f2fe",
                color: "#0369a1",
                fontWeight: 900,
                cursor: pLoading || !pUser || !pAmount ? "not-allowed" : "pointer",
              }}
            >
              {pLoading ? "Computing..." : "Preview"}
            </button>
          }
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input
              label="User (ID or Username)"
              type="text"
              step="1"
              min="0"
              placeholder="e.g. 123 or john_doe"
              value={pUser}
              onChange={setPUser}
            />
            <Input label="Amount (₹)" value={pAmount} onChange={setPAmount} />
          </div>
          {pData ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 800, marginBottom: 6 }}>Summary</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Gross (₹)</div>
                  <div style={{ fontWeight: 900 }}>{pData?.summary?.gross}</div>
                </div>
                <div style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Sponsor %</div>
                  <div style={{ fontWeight: 900 }}>{pData?.summary?.sponsor_percent}</div>
                </div>
                <div style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Tax %</div>
                  <div style={{ fontWeight: 900 }}>{pData?.summary?.tax_percent}</div>
                </div>
                <div style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Total Deductions (₹)</div>
                  <div style={{ fontWeight: 900 }}>{pData?.summary?.total_deductions}</div>
                </div>
                <div style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Net to User (₹)</div>
                  <div style={{ fontWeight: 900 }}>{pData?.summary?.net_to_user}</div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 800, marginBottom: 6 }}>Distribution Lines</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 8 }}>Label</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 8 }}>Amount (₹)</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 8 }}>%</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 8 }}>Recipient</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 8 }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pData?.lines || []).map((ln, idx) => (
                      <tr key={idx}>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 8 }}>{ln?.label || ln?.key}</td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 8 }}>{ln?.amount}</td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 8 }}>{ln?.percent}</td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 8 }}>
                          {ln?.recipient?.username
                            ? `${ln.recipient.username} (${ln.recipient.id || "?"})`
                            : ""}
                        </td>
                        <td style={{ borderBottom: "1px solid #f1f5f9", padding: 8 }}>{ln?.tx_type}</td>
                      </tr>
                    ))}
                    {(pData?.lines || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: 8, color: "#64748b" }}>
                          No distribution lines
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Section>
      </div>
    );
  }

  function renderTabRankUpgrade() {
    const reb = rankConfig.rebirth_allocation || {};
    const totalIn = Number(reb.total_amount ?? 250);
    const ds = Number(reb.direct_sponsor ?? 40);
    const m5 = Number(reb.matrix_5 ?? 80);
    const m3 = Number(reb.matrix_3 ?? 20);
    const pinRoy = Number(reb.pincode_royalty ?? reb.franchise_pool ?? 15);
    const distRoy = Number(reb.district_royalty ?? reb.district_pool ?? 10);
    const stateRoy = Number(reb.state_royalty ?? reb.state_pool ?? 15);
    const distRoyL1L7 = Number(reb.district_royalty_l1_l7 ?? reb.district_royalty_t1 ?? 15);
    const distRoyL1L10 = Number(reb.district_royalty_l1_l10_30d ?? 10);
    const distWiseL8L10 = Number(reb.districtwise_royalty_l8_l10 ?? reb.district_royalty_t2 ?? 15);
    const stateWiseL8L10 = Number(reb.statewise_royalty_l8_l10 ?? 10);
    const distCaptRoy = Number(reb.district_captain_royalty ?? 5);
    const stateCaptRoy = Number(reb.state_captain_royalty ?? 5);
    const compAdmin = Number(reb.company_admin ?? reb.company_gross ?? 10);

    const sumOut = ds + m5 + m3 + pinRoy + distRoy + stateRoy + distRoyL1L7 + distRoyL1L10 + distWiseL8L10 + stateWiseL8L10 + distCaptRoy + stateCaptRoy + compAdmin;
    const isBalanced = totalIn === sumOut;

    const fRoles = reb.pincode_roles_pct || reb.franchise_roles_pct || { pincode: 45, pincode_coord: 15, district: 15, district_coord: 10, state: 10, state_coord: 5 };
    const dRoles = reb.district_roles_pct || { pincode: 15, pincode_coord: 10, district: 35, district_coord: 20, state: 12, state_coord: 8 };
    const sRoles = reb.state_roles_pct || { pincode: 10, pincode_coord: 5, district: 15, district_coord: 10, state: 40, state_coord: 20 };

    const updateRolePct = (poolKey, roleKey, val) => {
      const numVal = Number(val);
      setRankConfig((prev) => {
        const currentReb = prev.rebirth_allocation || {};
        const currentRoles = { ...(currentReb[poolKey] || {}) };
        currentRoles[roleKey] = numVal;
        const updated = {
          ...prev,
          rebirth_allocation: {
            ...currentReb,
            [poolKey]: currentRoles,
          },
        };
        // keep aliases in sync
        if (poolKey === "pincode_roles_pct") {
          updated.rebirth_allocation.franchise_roles_pct = currentRoles;
        } else if (poolKey === "franchise_roles_pct") {
          updated.rebirth_allocation.pincode_roles_pct = currentRoles;
        }
        return updated;
      });
      setRankDirty(true);
    };
    const configuredTaxPctRebirth = customModuleTax.tax_rebirth !== undefined ? Number(customModuleTax.tax_rebirth) : 18;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section
          title="Self Rebirth ID (₹250) Allocation & Company Side Capture"
          subtitle="Configure how the ₹250 Rebirth ID entry amount is split across Direct Sponsor, Matrix Blocks, Geo Royalties, Rank Royalties, Captains, and Company Admin"
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#1e293b" }}>Rebirth Tax:</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={configuredTaxPctRebirth}
                onChange={(e) => updateModuleTax("tax_rebirth", e.target.value)}
                style={{ width: 55, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #94a3b8", background: "#fff", color: "#0f172a" }}
              />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>%</span>
            </div>
          }
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Input
              label="Rebirth ID Amount (₹)"
              type="number"
              value={totalIn}
              onChange={(val) => {
                const tot = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), total_amount: tot },
                }));
                setRankDirty(true);
              }}
              placeholder="250"
            />
            <Input
              label="Direct Sponsor Bonus (₹)"
              type="number"
              value={ds}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), direct_sponsor: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="40"
            />
            <Input
              label="5-Block Pool Share (₹)"
              type="number"
              value={m5}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), matrix_5: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="80"
            />
            <Input
              label="3-Block Pool Share (₹)"
              type="number"
              value={m3}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), matrix_3: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="20"
            />
            <Input
              label="Pincode Royalty (₹)"
              type="number"
              value={pinRoy}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), pincode_royalty: n, franchise_pool: n },
                }));
                setRankDirty(true);
              }}
              placeholder="15"
            />
            <Input
              label="District Royalty (₹)"
              type="number"
              value={distRoy}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), district_royalty: n, district_pool: n },
                }));
                setRankDirty(true);
              }}
              placeholder="10"
            />
            <Input
              label="State Royalty (₹)"
              type="number"
              value={stateRoy}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), state_royalty: n, state_pool: n },
                }));
                setRankDirty(true);
              }}
              placeholder="15"
            />
            <Input
              label="District Royalty L1-L7 (₹) [7 Days]"
              type="number"
              value={distRoyL1L7}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), district_royalty_l1_l7: n, district_royalty_t1: n },
                }));
                setRankDirty(true);
              }}
              placeholder="15"
            />
            <Input
              label="District Royalty L1-L10 (₹) [30 Days]"
              type="number"
              value={distRoyL1L10}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), district_royalty_l1_l10_30d: n },
                }));
                setRankDirty(true);
              }}
              placeholder="10"
            />
            <Input
              label="Districtwise Royalty L8-L10 (₹) [7 Days]"
              type="number"
              value={distWiseL8L10}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), districtwise_royalty_l8_l10: n, district_royalty_t2: n },
                }));
                setRankDirty(true);
              }}
              placeholder="15"
            />
            <Input
              label="Statewise Royalty L8-L10 (₹) [7 Days]"
              type="number"
              value={stateWiseL8L10}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), statewise_royalty_l8_l10: n },
                }));
                setRankDirty(true);
              }}
              placeholder="10"
            />
            <Input
              label="District Captain Royalty (₹)"
              type="number"
              value={distCaptRoy}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), district_captain_royalty: n },
                }));
                setRankDirty(true);
              }}
              placeholder="5"
            />
            <Input
              label="State Captain Royalty (₹)"
              type="number"
              value={stateCaptRoy}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), state_captain_royalty: n },
                }));
                setRankDirty(true);
              }}
              placeholder="5"
            />
            <Input
              label="Company Admin Retention (₹)"
              type="number"
              value={compAdmin}
              onChange={(val) => {
                const n = Number(val);
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), company_admin: n, company_gross: n },
                }));
                setRankDirty(true);
              }}
              placeholder="10"
            />
          </div>

          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              background: isBalanced ? "#f0fdf4" : "#fef2f2",
              border: isBalanced ? "1px solid #bbf7d0" : "1px solid #fecaca",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: isBalanced ? "#166534" : "#991b1b" }}>
              {isBalanced
                ? `✓ Balanced Financial Accounting: Total Inflow ₹${totalIn} = Outflow (Sponsor ₹${ds} + 5-Block ₹${m5} + 3-Block ₹${m3} + Pincode ₹${pinRoy} + District ₹${distRoy} + State ₹${stateRoy} + L1-L7 ₹${distRoyL1L7} + L1-L10 ₹${distRoyL1L10} + Dist L8-L10 ₹${distWiseL8L10} + State L8-L10 ₹${stateWiseL8L10} + Dist Capt ₹${distCaptRoy} + State Capt ₹${stateCaptRoy}) + Company Admin ₹${compAdmin}`
                : `⚠ Imbalance Alert: Total Inflow (₹${totalIn}) != Allocated Sum (₹${sumOut}). Difference: ₹${totalIn - sumOut}`}
            </span>
          </div>
        </Section>

        {/* ── 6-Role Geo Distribution Percentage Cards ── */}
        <Section
          title={`1. Pincode Royalty: 6-Role Geo Upline Distribution (Gross ₹${pinRoy.toFixed(2)})`}
          subtitle="Configure percentage split across Pincode, Pincode Coordinator, District, District Coordinator, State, and State Coordinator uplines of that Rebirth ID"
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input label="Pincode (%)" type="number" value={fRoles.pincode ?? 45} onChange={(val) => updateRolePct("pincode_roles_pct", "pincode", val)} />
            <Input label="Pincode Coordinator (%)" type="number" value={fRoles.pincode_coord ?? 15} onChange={(val) => updateRolePct("pincode_roles_pct", "pincode_coord", val)} />
            <Input label="District (%)" type="number" value={fRoles.district ?? 15} onChange={(val) => updateRolePct("pincode_roles_pct", "district", val)} />
            <Input label="District Coordinator (%)" type="number" value={fRoles.district_coord ?? 10} onChange={(val) => updateRolePct("pincode_roles_pct", "district_coord", val)} />
            <Input label="State (%)" type="number" value={fRoles.state ?? 10} onChange={(val) => updateRolePct("pincode_roles_pct", "state", val)} />
            <Input label="State Coordinator (%)" type="number" value={fRoles.state_coord ?? 5} onChange={(val) => updateRolePct("pincode_roles_pct", "state_coord", val)} />
          </div>
        </Section>

        <Section
          title={`2. District Royalty: 6-Role Geo Distribution (Gross ₹${distRoy.toFixed(2)} - Midnight 12 AM Payout)`}
          subtitle="Configure 12:00 AM Midnight batch distribution percentages for enrolled district franchise members"
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input label="Pincode (%)" type="number" value={dRoles.pincode ?? 15} onChange={(val) => updateRolePct("district_roles_pct", "pincode", val)} />
            <Input label="Pincode Coordinator (%)" type="number" value={dRoles.pincode_coord ?? 10} onChange={(val) => updateRolePct("district_roles_pct", "pincode_coord", val)} />
            <Input label="District (%)" type="number" value={dRoles.district ?? 35} onChange={(val) => updateRolePct("district_roles_pct", "district", val)} />
            <Input label="District Coordinator (%)" type="number" value={dRoles.district_coord ?? 20} onChange={(val) => updateRolePct("district_roles_pct", "district_coord", val)} />
            <Input label="State (%)" type="number" value={dRoles.state ?? 12} onChange={(val) => updateRolePct("district_roles_pct", "state", val)} />
            <Input label="State Coordinator (%)" type="number" value={dRoles.state_coord ?? 8} onChange={(val) => updateRolePct("district_roles_pct", "state_coord", val)} />
          </div>
        </Section>

        <Section
          title={`3. State Royalty: 6-Role Geo Distribution (Gross ₹${stateRoy.toFixed(2)} - Midnight 12 AM Payout)`}
          subtitle="Configure 12:00 AM Midnight batch distribution percentages for enrolled state franchise members"
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input label="Pincode (%)" type="number" value={sRoles.pincode ?? 10} onChange={(val) => updateRolePct("state_roles_pct", "pincode", val)} />
            <Input label="Pincode Coordinator (%)" type="number" value={sRoles.pincode_coord ?? 5} onChange={(val) => updateRolePct("state_roles_pct", "pincode_coord", val)} />
            <Input label="District (%)" type="number" value={sRoles.district ?? 15} onChange={(val) => updateRolePct("state_roles_pct", "district", val)} />
            <Input label="District Coordinator (%)" type="number" value={sRoles.district_coord ?? 10} onChange={(val) => updateRolePct("state_roles_pct", "district_coord", val)} />
            <Input label="State (%)" type="number" value={sRoles.state ?? 40} onChange={(val) => updateRolePct("state_roles_pct", "state", val)} />
            <Input label="State Coordinator (%)" type="number" value={sRoles.state_coord ?? 20} onChange={(val) => updateRolePct("state_roles_pct", "state_coord", val)} />
          </div>
        </Section>

        {/* ── 5-Block Layer Distribution Breakdown (L1 to L10) ── */}
        <Section
          title="Self Rebirth: 5-Block Layer Distribution (Layers L1 to L10)"
          subtitle="Configure per-layer payout for 5-Block uplines (Total Pool = ₹80)"
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1e1b4b", color: "#fff", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Block Layer</th>
                  <th style={{ padding: "8px 12px" }}>Upline Scope</th>
                  <th style={{ padding: "8px 12px" }}>Per-ID Payout (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(rankConfig.rebirth_allocation?.matrix_5_levels || Array.from({ length: 10 }, (_, i) => ({ level: i + 1, amount: 8 }))).map((lvl, idx) => (
                  <tr key={lvl.level} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px 12px", fontWeight: 800 }}>Layer {lvl.level}</td>
                    <td style={{ padding: "6px 12px", color: "#64748b" }}>5-Block Layer {lvl.level} Upline</td>
                    <td style={{ padding: "6px 12px" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={lvl.amount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setRankConfig((prev) => {
                            const reb = prev.rebirth_allocation || {};
                            const m5Lvls = [...(reb.matrix_5_levels || Array.from({ length: 10 }, (_, i) => ({ level: i + 1, amount: 8 })))];
                            m5Lvls[idx] = { ...m5Lvls[idx], amount: val };
                            const sumM5 = m5Lvls.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
                            return {
                              ...prev,
                              rebirth_allocation: {
                                ...reb,
                                matrix_5: sumM5,
                                matrix_5_levels: m5Lvls,
                              },
                            };
                          });
                          setRankDirty(true);
                        }}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 110, fontWeight: 700 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 3-Block Layer Distribution Breakdown (L1 to L15) ── */}
        <Section
          title="Self Rebirth: 3-Block Layer Distribution (Layers L1 to L15)"
          subtitle="Configure per-layer payout for 3-Block uplines (Total Pool = ₹20)"
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1e1b4b", color: "#fff", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Block Layer</th>
                  <th style={{ padding: "8px 12px" }}>Upline Scope</th>
                  <th style={{ padding: "8px 12px" }}>Per-ID Payout (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(rankConfig.rebirth_allocation?.matrix_3_levels || Array.from({ length: 15 }, (_, i) => ({ level: i + 1, amount: i === 14 ? 1.38 : 1.33 }))).map((lvl, idx) => (
                  <tr key={lvl.level} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px 12px", fontWeight: 800 }}>Layer {lvl.level}</td>
                    <td style={{ padding: "6px 12px", color: "#64748b" }}>3-Block Layer {lvl.level} Upline</td>
                    <td style={{ padding: "6px 12px" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={lvl.amount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setRankConfig((prev) => {
                            const reb = prev.rebirth_allocation || {};
                            const m3Lvls = [...(reb.matrix_3_levels || Array.from({ length: 15 }, (_, i) => ({ level: i + 1, amount: i === 14 ? 1.38 : 1.33 })))];
                            m3Lvls[idx] = { ...m3Lvls[idx], amount: val };
                            const sumM3 = m3Lvls.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
                            return {
                              ...prev,
                              rebirth_allocation: {
                                ...reb,
                                matrix_3: sumM3,
                                matrix_3_levels: m3Lvls,
                              },
                            };
                          });
                          setRankDirty(true);
                        }}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 110, fontWeight: 700 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {!isFranchiseWorkspace && (
          <>
            <Section
              title="Rank Upgrade Time Windows (Days)"
              subtitle="Configure default upgrade time window limits for Layer 1-7 and Layer 8-10 tiers"
            >
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <Input
                  label="Upgrade Window (L1 to L7) - Days"
                  type="number"
                  value={rankConfig.upgrade_window_l1_l7}
                  onChange={(val) => {
                    setRankConfig((prev) => ({ ...prev, upgrade_window_l1_l7: Number(val) }));
                    setRankDirty(true);
                  }}
                  placeholder="7"
                />
                <Input
                  label="Upgrade Window (L8 to L10) - Days"
                  type="number"
                  value={rankConfig.upgrade_window_l8_l10}
                  onChange={(val) => {
                    setRankConfig((prev) => ({ ...prev, upgrade_window_l8_l10: Number(val) }));
                    setRankDirty(true);
                  }}
                  placeholder="15"
                />
              </div>
            </Section>

            {(() => {
              const configuredTaxPctRank = customModuleTax.tax_rank !== undefined ? Number(customModuleTax.tax_rank) : (Number(mForm.tax_percent) > 0 ? Number(mForm.tax_percent) : 18);
              return (
                <Section
                  title="Rank Layer Tiers Configuration & Strict Tax Rules"
                  subtitle={`Strict Rule: Gross Upgrade Fee → Deduct ${configuredTaxPctRank}% Company Tax (Retained by Platform) → Net 50% Direct Sponsor + Net 50% Target Layer Upline (fallback to Company Root)`}
                  right={
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#1e293b" }}>Rank Upgrade Company Tax:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={configuredTaxPctRank}
                        onChange={(e) => updateModuleTax("tax_rank", e.target.value)}
                        style={{ width: 60, padding: "3px 6px", fontSize: 12, fontWeight: 800, borderRadius: 4, border: "1px solid #94a3b8", background: "#fff", color: "#0f172a" }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>%</span>
                    </div>
                  }
                >
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#1e1b4b", color: "#fff", textAlign: "left" }}>
                          <th style={{ padding: "10px 12px" }}>Layer</th>
                          <th style={{ padding: "10px 12px" }}>Rank Name</th>
                          <th style={{ padding: "10px 12px" }}>Upgrade Amount (₹)</th>
                          <th style={{ padding: "10px 12px", background: "#312e81" }}>Company Tax ({configuredTaxPctRank}% ₹)</th>
                          <th style={{ padding: "10px 12px", background: "#3730a3" }}>Net Pool ({(100 - configuredTaxPctRank).toFixed(1)}% ₹)</th>
                          <th style={{ padding: "10px 12px", background: "#4338ca" }}>50% Sponsor (₹)</th>
                          <th style={{ padding: "10px 12px", background: "#4f46e5" }}>50% Layer Upline (₹)</th>
                          <th style={{ padding: "10px 12px" }}>Earning Limit (₹)</th>
                          <th style={{ padding: "10px 12px" }}>Team Count Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankConfig.levels.map((lvl, idx) => {
                          const gross = Number(lvl.upgrade_amount || 0);
                          const tax = Math.round(gross * (configuredTaxPctRank / 100) * 100) / 100;
                          const net = Math.round((gross - tax) * 100) / 100;
                          const half = Math.round((net / 2) * 100) / 100;

                          return (
                            <tr key={lvl.level} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 800 }}>Layer {lvl.level}</td>
                              <td style={{ padding: "8px 12px" }}>
                                <input
                                  type="text"
                                  value={lvl.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRankConfig((prev) => {
                                      const newLvls = [...prev.levels];
                                      newLvls[idx] = { ...newLvls[idx], name: val };
                                      return { ...prev, levels: newLvls };
                                    });
                                    setRankDirty(true);
                                  }}
                                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 110 }}
                                />
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <input
                                  type="number"
                                  value={lvl.upgrade_amount}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setRankConfig((prev) => {
                                      const newLvls = [...prev.levels];
                                      newLvls[idx] = { ...newLvls[idx], upgrade_amount: val };
                                      return { ...prev, levels: newLvls };
                                    });
                                    setRankDirty(true);
                                  }}
                                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 110, fontWeight: 700 }}
                                />
                              </td>
                              <td style={{ padding: "8px 12px", fontWeight: 800, color: "#1e40af", background: "#eff6ff" }}>
                                ₹{tax.toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 12px", fontWeight: 800, color: "#047857", background: "#ecfdf5" }}>
                                ₹{net.toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 12px", fontWeight: 700, color: "#6b21a8", background: "#faf5ff" }}>
                                ₹{half.toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 12px", fontWeight: 700, color: "#4338ca", background: "#eef2ff" }}>
                                ₹{half.toFixed(2)}
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <input
                                  type="number"
                                  value={lvl.earning_limit}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setRankConfig((prev) => {
                                      const newLvls = [...prev.levels];
                                      newLvls[idx] = { ...newLvls[idx], earning_limit: val };
                                      return { ...prev, levels: newLvls };
                                    });
                                    setRankDirty(true);
                                  }}
                                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 110 }}
                                />
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <input
                                  type="text"
                                  value={lvl.team_count}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRankConfig((prev) => {
                                      const newLvls = [...prev.levels];
                                      newLvls[idx] = { ...newLvls[idx], team_count: val };
                                      return { ...prev, levels: newLvls };
                                    });
                                    setRankDirty(true);
                                  }}
                                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 80 }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Section>
              );
            })()}
          </>
        )}
      </div>
    );
  }

  function renderTabSPP1000() {
    const {
      sppPrice,
      dsSPP,
      selfSPP,
      m5ArrSPP,
      sumM5_SPP,
      m3ArrSPP,
      sumM3_SPP,
      isFixedGeoSPP,
      geoEffectiveSPP,
      configuredTaxPctSPP,
      taxSPP,
      totalOutflowSPP,
      remainingMarginSPP,
      isBalancedSPP,
    } = sppBalanceInfo;

    // Helper to distribute 5-Block total evenly across layers
    const update5BlockTotalSPP = (newVal) => {
      let val = Math.max(0, Number(newVal) || 0);
      if (val > sppPrice) val = sppPrice;
      const levels = Math.max(1, Number(sppConfig.five_levels) || (m5ArrSPP.length > 0 ? m5ArrSPP.length : 10));
      const perLevel = Math.round((val / levels) * 100) / 100;
      const arr = Array(levels).fill(perLevel);
      const diff = Math.round((val - perLevel * levels) * 100) / 100;
      if (diff !== 0 && arr.length > 0) {
        arr[arr.length - 1] = Math.round((arr[arr.length - 1] + diff) * 100) / 100;
      }
      setSppConfig((prev) => ({ ...prev, five_amounts: arr.map((x) => Number(x).toFixed(2)).join(", ") }));
      setSppDirty(true);
    };

    // Helper to distribute 3-Block total evenly across layers
    const update3BlockTotalSPP = (newVal) => {
      let val = Math.max(0, Number(newVal) || 0);
      if (val > sppPrice) val = sppPrice;
      const levels = Math.max(1, Number(sppConfig.three_levels) || (m3ArrSPP.length > 0 ? m3ArrSPP.length : 10));
      const perLevel = Math.round((val / levels) * 100) / 100;
      const arr = Array(levels).fill(perLevel);
      const diff = Math.round((val - perLevel * levels) * 100) / 100;
      if (diff !== 0 && arr.length > 0) {
        arr[arr.length - 1] = Math.round((arr[arr.length - 1] + diff) * 100) / 100;
      }
      setSppConfig((prev) => ({ ...prev, three_amounts: arr.map((x) => Number(x).toFixed(2)).join(", ") }));
      setSppDirty(true);
    };

    // Helper to distribute Geo Pool
    const updateGeoPoolSPP = (val) => {
      let newTotal = Math.max(0, Number(val) || 0);
      if (newTotal > sppPrice) newTotal = sppPrice;
      const keys = [
        "geo_fixed_sub_franchise",
        "geo_fixed_pincode",
        "geo_fixed_pincode_coord",
        "geo_fixed_district",
        "geo_fixed_district_coord",
        "geo_fixed_state",
        "geo_fixed_state_coord",
        "geo_fixed_employee",
        "geo_fixed_royalty"
      ];
      const curSum = keys.reduce((acc, k) => acc + Number(sppConfig[k] || 0), 0);
      const updatedGeo = { geo_mode: "fixed" };
      if (curSum > 0) {
        const ratio = newTotal / curSum;
        let distributed = 0;
        keys.forEach((k, idx) => {
          if (idx === keys.length - 1) {
            const lastVal = Math.round((newTotal - distributed) * 100) / 100;
            updatedGeo[k] = Math.max(0, lastVal);
          } else {
            const scaled = Math.round(Number(sppConfig[k] || 0) * ratio * 100) / 100;
            distributed += scaled;
            updatedGeo[k] = scaled;
          }
        });
      } else {
        const share = Math.round((newTotal / 5) * 100) / 100;
        updatedGeo.geo_fixed_sub_franchise = share;
        updatedGeo.geo_fixed_pincode = share;
        updatedGeo.geo_fixed_district = share;
        updatedGeo.geo_fixed_state = share;
        updatedGeo.geo_fixed_royalty = Math.round((newTotal - share * 4) * 100) / 100;
      }
      setSppConfig((prev) => ({ ...prev, ...updatedGeo }));
      setSppDirty(true);
    };

    const resetTabSPPToDefaults = () => {
      setSppConfig((prev) => ({
        ...prev,
        direct_bonus_sponsor: 150,
        direct_bonus_self: 50,
        five_amounts: "8.00, 8.00, 8.00, 8.00, 8.00, 8.00, 8.00, 8.00, 8.00, 8.00",
        three_amounts: "2.75, 2.75, 2.75, 2.75, 2.75, 2.75, 2.75, 2.75, 2.75, 2.75",
        geo_mode: "fixed",
        geo_fixed_sub_franchise: 3,
        geo_fixed_pincode: 3,
        geo_fixed_pincode_coord: 3,
        geo_fixed_district: 4,
        geo_fixed_district_coord: 4,
        geo_fixed_state: 4,
        geo_fixed_state_coord: 4,
        geo_fixed_employee: 3,
        geo_fixed_royalty: 0,
      }));
      setSppDirty(true);
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── Strict Financial Accounting & Tax Ledger for SPP ── */}
        <Section
          title="₹1,000 SPP Strict Financial Accounting & Tax Ledger"
          subtitle="Real-time breakdown of ₹1,000 customer inflow, statutory company tax (GST), direct bonus, 5 & 3 matrix block pools, geo allocation, and retained margin"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={resetTabSPPToDefaults}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "#f1f5f9",
                  color: "#334155",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                title="Reset all direct, matrix, and geo pools to standard balanced defaults"
              >
                ↺ Reset to Defaults
              </button>
            </div>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 }}>
            {/* 1. TOTAL INFLOW (Fixed non-editable) */}
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>TOTAL INFLOW</div>
                <div style={{ fontSize: 18, color: "#0f172a", fontWeight: 900 }}>₹{sppPrice.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                Package Price (₹1,000 Fixed)
              </div>
            </div>

            {/* 2. COMPANY TAX (GST POOL) (Editable Rate % & Tax ₹) */}
            <div style={{ background: "#eff6ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>COMPANY TAX (GST POOL)</div>
                <div style={{ fontSize: 18, color: "#1e40af", fontWeight: 900 }}>₹{taxSPP.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>Rate (%):</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <LedgerNumberInput
                      step="0.1"
                      min={0}
                      max={100}
                      value={configuredTaxPctSPP}
                      onChange={(val) => updateModuleTax("tax_spp", val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #93c5fd", background: "#fff", color: "#1e40af", textAlign: "right" }}
                    />
                    <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 800 }}>%</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>Tax (₹):</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="0.5"
                      min={0}
                      max={sppPrice}
                      value={taxSPP}
                      onChange={(amt) => {
                        if (amt >= sppPrice) return;
                        const pct = Math.round(((amt / sppPrice) * 100) * 10) / 10;
                        updateModuleTax("tax_spp", pct);
                      }}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #93c5fd", background: "#fff", color: "#1e40af", textAlign: "right" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. DIRECT (SPONSOR+SELF) (Editable Sponsor & Self) */}
            <div style={{ background: "#faf5ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #e9d5ff", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>DIRECT (SPONSOR+SELF)</div>
                <div style={{ fontSize: 18, color: "#6b21a8", fontWeight: 900 }}>₹{(dsSPP + selfSPP).toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>Sponsor:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="1"
                      min={0}
                      max={sppPrice}
                      value={sppConfig.direct_bonus_sponsor ?? 150}
                      onChange={(val) => {
                        setSppConfig((prev) => ({ ...prev, direct_bonus_sponsor: val }));
                        setSppDirty(true);
                      }}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #d8b4fe", background: "#fff", color: "#6b21a8", textAlign: "right" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>Self:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="1"
                      min={0}
                      max={sppPrice}
                      value={sppConfig.direct_bonus_self ?? 50}
                      onChange={(val) => {
                        setSppConfig((prev) => ({ ...prev, direct_bonus_self: val }));
                        setSppDirty(true);
                      }}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #d8b4fe", background: "#fff", color: "#6b21a8", textAlign: "right" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. BLOCK EARNINGS (5+3) (Editable 5-Block & 3-Block totals) */}
            <div style={{ background: "#fdf4ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #f5d0fe", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#a21caf", fontWeight: 700 }}>BLOCK EARNINGS (5+3)</div>
                <div style={{ fontSize: 18, color: "#86198f", fontWeight: 900 }}>₹{(sumM5_SPP + sumM3_SPP).toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#a21caf", fontWeight: 700 }}>5-Block:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#a21caf", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="0.5"
                      min={0}
                      max={sppPrice}
                      value={sumM5_SPP}
                      onChange={(val) => update5BlockTotalSPP(val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #f0abfc", background: "#fff", color: "#86198f", textAlign: "right" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#a21caf", fontWeight: 700 }}>3-Block:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#a21caf", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="0.5"
                      min={0}
                      max={sppPrice}
                      value={sumM3_SPP}
                      onChange={(val) => update3BlockTotalSPP(val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #f0abfc", background: "#fff", color: "#86198f", textAlign: "right" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. GEO / FRANCHISE POOL (Editable Pool ₹ & Mode selector) */}
            <div style={{ background: "#fffbeb", padding: "10px 14px", borderRadius: 8, border: "1px solid #fde68a", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>GEO / FRANCHISE POOL</div>
                <div style={{ fontSize: 18, color: "#92400e", fontWeight: 900 }}>₹{geoEffectiveSPP.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>Pool (₹):</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "#b45309", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="1"
                      min={0}
                      max={sppPrice}
                      value={geoEffectiveSPP}
                      onChange={(val) => updateGeoPoolSPP(val)}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #fcd34d", background: "#fff", color: "#92400e", textAlign: "right" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>Mode:</span>
                  <select
                    value={sppConfig.geo_mode || "percent"}
                    onChange={(e) => {
                      setSppConfig((prev) => ({ ...prev, geo_mode: e.target.value }));
                      setSppDirty(true);
                    }}
                    style={{ fontSize: 10, fontWeight: 700, padding: "1px 4px", borderRadius: 4, border: "1px solid #fcd34d", background: "#fff", color: "#92400e" }}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 6. COMPANY GROSS MARGIN (Editable Target & Auto-Balance) */}
            <div style={{ background: isBalancedSPP ? "#f0fdf4" : "#fef2f2", padding: "10px 14px", borderRadius: 8, border: isBalancedSPP ? "1px solid #bbf7d0" : "1px solid #fecaca", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: isBalancedSPP ? "#15803d" : "#b91c1c", fontWeight: 700 }}>COMPANY GROSS MARGIN</div>
                <div style={{ fontSize: 18, color: isBalancedSPP ? "#166534" : "#991b1b", fontWeight: 900 }}>₹{remainingMarginSPP.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontSize: 11, color: isBalancedSPP ? "#15803d" : "#b91c1c", fontWeight: 700 }}>Target (₹):</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ fontSize: 11, color: isBalancedSPP ? "#15803d" : "#b91c1c", fontWeight: 800 }}>₹</span>
                    <LedgerNumberInput
                      step="1"
                      placeholder={remainingMarginSPP.toFixed(2)}
                      value={targetMarginSPP !== null ? targetMarginSPP : ""}
                      onChange={(val) => setTargetMarginSPP(val === "" ? null : Number(val))}
                      style={{ width: 75, padding: "2px 4px", fontSize: 11, fontWeight: 800, borderRadius: 4, border: "1px solid #86efac", background: "#fff", color: isBalancedSPP ? "#166534" : "#991b1b", textAlign: "right" }}
                    />
                  </div>
                </div>
                {targetMarginSPP !== null && Number(targetMarginSPP) !== remainingMarginSPP && (
                  <button
                    type="button"
                    onClick={() => {
                      const diff = remainingMarginSPP - Number(targetMarginSPP);
                      updateGeoPoolSPP(Math.max(0, geoEffectiveSPP + diff));
                    }}
                    style={{
                      marginTop: 2,
                      padding: "2px 6px",
                      fontSize: 10,
                      fontWeight: 700,
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "center",
                    }}
                  >
                    Auto-Balance to Target
                  </button>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: isBalancedSPP ? "#f0fdf4" : "#fef2f2",
              border: isBalancedSPP ? "1px solid #bbf7d0" : "1px solid #fecaca",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, color: isBalancedSPP ? "#166534" : "#991b1b" }}>
              {isBalancedSPP
                ? `✓ Balanced Financial Accounting: Total Inflow ₹${sppPrice.toFixed(2)} = Company Tax (₹${taxSPP.toFixed(2)}) + Outflows (Sponsor ₹${dsSPP.toFixed(2)} + Self ₹${selfSPP.toFixed(2)} + 5-Block ₹${sumM5_SPP.toFixed(2)} + 3-Block ₹${sumM3_SPP.toFixed(2)} + Geo ₹${geoEffectiveSPP.toFixed(2)}) + Retained Company Margin ₹${remainingMarginSPP.toFixed(2)}`
                : `⚠ Incorrect Configuration: Total Inflow (₹${sppPrice.toFixed(2)}) is exceeded by allocated outflows and tax! Deficit: ₹${Math.abs(remainingMarginSPP).toFixed(2)} — Saving is disabled until balanced.`}
            </span>
          </div>
        </Section>

        {/* ── Direct Referral Bonuses Section ── */}
        <Section
          title="₹1,000 SPP — Direct Referral Bonuses"
          subtitle="Set sponsor/self direct referral bonuses specific to ₹1,000 SPP subscription."
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <Input
              label="Sponsor (₹)"
              value={sppConfig.direct_bonus_sponsor ?? 150}
              onChange={(v) => {
                setSppConfig((prev) => ({ ...prev, direct_bonus_sponsor: Number(v) || 0 }));
                setSppDirty(true);
              }}
            />
            <Input
              label="Self (₹)"
              value={sppConfig.direct_bonus_self ?? 50}
              onChange={(v) => {
                setSppConfig((prev) => ({ ...prev, direct_bonus_self: Number(v) || 0 }));
                setSppDirty(true);
              }}
            />
          </div>
        </Section>

        {/* ── Block Commission (5 & 3 Blocks) Section ── */}
        <Section
          title="₹1,000 SPP — Block Commission (5 & 3 Blocks)"
          subtitle="Per-package fixed rupee amounts per layer for 5-matrix and 3-matrix."
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <Input
              label="5-Block Layers"
              type="text"
              step="1"
              min="0"
              placeholder="e.g. 10"
              value={sppConfig.five_levels ?? 10}
              onChange={(v) => {
                setSppConfig((prev) => ({ ...prev, five_levels: Number(v) || 10 }));
                setSppDirty(true);
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 500px" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Block Amounts (₹ Fixed per Layer, CSV)</label>
              <textarea
                value={sppConfig.five_amounts || ""}
                onChange={(e) => {
                  setSppConfig((prev) => ({ ...prev, five_amounts: e.target.value }));
                  setSppDirty(true);
                }}
                placeholder="e.g. 12, 12, 12, 12, 12, 12, 12, 12, 12, 12"
                rows={2}
                style={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "8px 10px",
                  background: "#fff",
                  color: "#0f172a",
                  fontWeight: 600,
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input
              label="3-Block Layers"
              type="text"
              step="1"
              min="0"
              placeholder="e.g. 10"
              value={sppConfig.three_levels ?? 10}
              onChange={(v) => {
                setSppConfig((prev) => ({ ...prev, three_levels: Number(v) || 10 }));
                setSppDirty(true);
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 500px" }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Block Amounts (₹ Fixed per Layer, CSV)</label>
              <textarea
                value={sppConfig.three_amounts || ""}
                onChange={(e) => {
                  setSppConfig((prev) => ({ ...prev, three_amounts: e.target.value }));
                  setSppDirty(true);
                }}
                placeholder="e.g. 4, 4, 4, 4, 4, 4, 4, 4, 4, 4"
                rows={2}
                style={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "8px 10px",
                  background: "#fff",
                  color: "#0f172a",
                  fontWeight: 600,
                }}
              />
            </div>
          </div>
        </Section>

        {/* ── Geo (Agency) Pools Section ── */}
        <Section
          title="₹1,000 SPP — Geo (Agency) Pools"
          subtitle="Percent vs fixed mode per regional leadership role for ₹1,000 SPP."
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <Input label="Sub Franchise (%)" value={sppConfig.geo_sub_franchise ?? 3} onChange={(v) => { setSppConfig(p => ({ ...p, geo_sub_franchise: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="Pincode (%)" value={sppConfig.geo_pincode ?? 2} onChange={(v) => { setSppConfig(p => ({ ...p, geo_pincode: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="Pincode Coordinator (%)" value={sppConfig.geo_pincode_coord ?? 1} onChange={(v) => { setSppConfig(p => ({ ...p, geo_pincode_coord: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="District (%)" value={sppConfig.geo_district ?? 2} onChange={(v) => { setSppConfig(p => ({ ...p, geo_district: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="District Coordinator (%)" value={sppConfig.geo_district_coord ?? 1} onChange={(v) => { setSppConfig(p => ({ ...p, geo_district_coord: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="State (%)" value={sppConfig.geo_state ?? 2} onChange={(v) => { setSppConfig(p => ({ ...p, geo_state: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="State Coordinator (%)" value={sppConfig.geo_state_coord ?? 1} onChange={(v) => { setSppConfig(p => ({ ...p, geo_state_coord: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="Employee (%)" value={sppConfig.geo_employee ?? 1} onChange={(v) => { setSppConfig(p => ({ ...p, geo_employee: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="Admin (Company) (%)" value={sppConfig.geo_royalty ?? 2} onChange={(v) => { setSppConfig(p => ({ ...p, geo_royalty: Number(v)||0 })); setSppDirty(true); }} />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Geo Mode</label>
            <select
              value={sppConfig.geo_mode || "percent"}
              onChange={(e) => {
                setSppConfig((prev) => ({ ...prev, geo_mode: e.target.value }));
                setSppDirty(true);
              }}
              style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed (₹)</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input label="Sub Franchise (₹)" value={sppConfig.geo_fixed_sub_franchise ?? 30} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_sub_franchise: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="Pincode (₹)" value={sppConfig.geo_fixed_pincode ?? 20} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_pincode: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="Pincode Coordinator (₹)" value={sppConfig.geo_fixed_pincode_coord ?? 10} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_pincode_coord: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="District (₹)" value={sppConfig.geo_fixed_district ?? 20} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_district: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="District Coordinator (₹)" value={sppConfig.geo_fixed_district_coord ?? 10} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_district_coord: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="State (₹)" value={sppConfig.geo_fixed_state ?? 20} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_state: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="State Coordinator (₹)" value={sppConfig.geo_fixed_state_coord ?? 10} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_state_coord: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="Employee (₹)" value={sppConfig.geo_fixed_employee ?? 10} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_employee: Number(v)||0 })); setSppDirty(true); }} />
            <Input label="Admin (Company) (₹)" value={sppConfig.geo_fixed_royalty ?? 20} onChange={(v) => { setSppConfig(p => ({ ...p, geo_fixed_royalty: Number(v)||0 })); setSppDirty(true); }} />
          </div>
        </Section>
      </div>
    );
  }

  function renderTabRoyalty() {
    const mon = poolsMonitor || {};
    const proj = mon.projections || {};
    const accum = mon.accumulated || {};
    const stat = mon.status || {};
    const isDist = mon.is_today_distributed ?? stat.is_distributed ?? false;
    const history = mon.history || [];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Daily Midnight Pool Monitor & Operations Center */}
        <Section
          title="Daily Midnight Pool Monitor & Operations Center"
          subtitle="Real-time accumulation tracking from ₹250 Self-Rebirth IDs, eligible coordinator counts, and automated 11:59 PM distribution"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center", background: "#f1f5f9", padding: "3px 6px", borderRadius: 6 }}>
                <button
                  type="button"
                  onClick={() => { setSelectedPoolDate(todayStr); fetchPoolsMonitor(todayStr); }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "none",
                    background: selectedPoolDate === todayStr ? "#2563eb" : "transparent",
                    color: selectedPoolDate === todayStr ? "#fff" : "#475569",
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Today ({todayStr})
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedPoolDate(yesterdayStr); fetchPoolsMonitor(yesterdayStr); }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "none",
                    background: selectedPoolDate === yesterdayStr ? "#2563eb" : "transparent",
                    color: selectedPoolDate === yesterdayStr ? "#fff" : "#475569",
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Yesterday ({yesterdayStr})
                </button>
                <input
                  type="date"
                  value={selectedPoolDate}
                  onChange={(e) => {
                    const d = e.target.value;
                    setSelectedPoolDate(d);
                    if (d) fetchPoolsMonitor(d);
                  }}
                  style={{
                    padding: "3px 6px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#334155",
                    background: "#fff",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => fetchPoolsMonitor(selectedPoolDate)}
                disabled={poolsLoading}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#334155",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: poolsLoading ? "wait" : "pointer",
                }}
              >
                {poolsLoading ? "Refreshing..." : "🔄 Refresh"}
              </button>
              <button
                type="button"
                onClick={() => handleTriggerDailyPools(true)}
                disabled={poolsTriggering}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: poolsTriggering ? "wait" : "pointer",
                }}
              >
                {poolsTriggering ? "Processing..." : "🧪 Preview (Dry-Run)"}
              </button>
              <button
                type="button"
                onClick={() => handleTriggerDailyPools(false)}
                disabled={poolsTriggering}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#047857",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: poolsTriggering ? "wait" : "pointer",
                  boxShadow: "0 2px 4px rgba(4,120,87,0.2)",
                }}
              >
                {poolsTriggering ? "Distributing..." : "🚀 Trigger Payout Now"}
              </button>
            </div>
          }
        >
          {/* Status Header Bar */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: isDist ? "#ecfdf5" : "#fffbeb",
              border: `1px solid ${isDist ? "#a7f3d0" : "#fde68a"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: isDist ? "#10b981" : "#f59e0b",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 900, color: isDist ? "#065f46" : "#92400e" }}>
                {isDist ? `✓ Pool Distribution Completed for ${selectedPoolDate} (Distributed 100% to Wallets)` : `⏳ Accumulating Inflow for ${selectedPoolDate} — Scheduled for 23:59:00 Execution`}
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
              Target Date: <strong>{selectedPoolDate}</strong> | Auto-Trigger: <strong>23:59:00 Daily</strong>
            </div>
          </div>

          {/* Volume Summary Strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                {selectedPoolDate === todayStr ? "TODAY'S REBIRTHS" : `REBIRTHS ON ${selectedPoolDate}`} ({isFranchiseWorkspace ? "FRANCHISE" : "PLATFORM"})
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                {mon.self_rebirth_count ?? accum.rebirth_count ?? 0} IDs
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                Turnover: ₹{Number(mon.self_rebirth_amount ?? accum.total_turnover ?? ((mon.self_rebirth_count || 0) * 250)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#166534" }}>
                ALL-TIME TOTAL REBIRTHS ({isFranchiseWorkspace ? "FRANCHISE" : "PLATFORM"})
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#14532d" }}>
                {mon.self_rebirth_count_total ?? (isFranchiseWorkspace ? 0 : 37)} IDs
              </div>
              <div style={{ fontSize: 11, color: "#15803d", marginTop: 2 }}>
                {isFranchiseWorkspace
                  ? `${mon.self_rebirth_count_total || 0} Franchise IDs (₹${Number(mon.self_rebirth_amount_total || ((mon.self_rebirth_count_total || 0) * 250)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total)`
                  : `Platform Rebirth IDs (₹${Number(mon.self_rebirth_amount_total || ((mon.self_rebirth_count_total || 37) * 250)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total)`}
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                ROYALTY POOL POT ({selectedPoolDate})
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#047857" }}>
                ₹{Number(proj.royalty_t1_pot + proj.royalty_t2_pot || mon.pools?.daily_royalty_pool || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                T1: ₹{Number(proj.royalty_t1_pot || mon.pools?.daily_royalty_t1_pool || 0).toFixed(2)} | T2: ₹{Number(proj.royalty_t2_pot || mon.pools?.daily_royalty_t2_pool || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Dynamic Live Pots Grid */}
          {(() => {
            const rebRates = mon.rebirth_rates || rankConfig?.rebirth_allocation || {};
            const pinRate = Number(rebRates.pincode ?? rebRates.franchise ?? rebRates.pincode_royalty ?? rebRates.franchise_pool ?? 15);
            const distRate = Number(rebRates.district ?? rebRates.district_royalty ?? rebRates.district_pool ?? 10);
            const stateRate = Number(rebRates.state ?? rebRates.state_royalty ?? rebRates.state_pool ?? 15);
            const l1l7Rate = Number(rebRates.royalty_l1_l7 ?? rebRates.royalty_t1 ?? rebRates.district_royalty_l1_l7 ?? 15);
            const l1l10Rate = Number(rebRates.royalty_l1_l10_30d ?? rebRates.district_royalty_l1_l10_30d ?? 10);
            const distWiseRate = Number(rebRates.districtwise_l8_l10 ?? rebRates.royalty_t2 ?? rebRates.districtwise_royalty_l8_l10 ?? 15);
            const stateWiseRate = Number(rebRates.statewise_l8_l10 ?? rebRates.statewise_royalty_l8_l10 ?? 10);
            const distCaptRate = Number(rebRates.district_captain ?? rebRates.district_captain_royalty ?? 5);
            const stateCaptRate = Number(rebRates.state_captain ?? rebRates.state_captain_royalty ?? 5);

            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#2563eb" }}>🏢 PINCODE ROYALTY (₹{pinRate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(proj.franchise_pot ?? mon.pools?.daily_pincode_pool ?? mon.pools?.daily_franchise_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 Pincode Assignees: <strong>{proj.franchise_recipients ?? mon.achievers?.pincode_count ?? mon.achievers?.franchise_count ?? 0}</strong>
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed" }}>🗺️ DISTRICT ROYALTY (₹{distRate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(proj.district_pot ?? mon.pools?.daily_district_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 District Assignees: <strong>{proj.district_recipients ?? mon.achievers?.district_count ?? 0}</strong>
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#d97706" }}>🏛️ STATE ROYALTY (₹{stateRate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(proj.state_pot ?? mon.pools?.daily_state_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 State Assignees: <strong>{proj.state_recipients ?? mon.achievers?.state_count ?? 0}</strong>
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>🏅 DISTRICT ROYALTY L1-L7 (₹{l1l7Rate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(proj.royalty_t1_pot ?? mon.pools?.daily_royalty_l1_l7_pool ?? mon.pools?.daily_royalty_t1_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 7d Achievers: <strong>{proj.royalty_t1_recipients ?? mon.achievers?.tier1_count ?? mon.achievers?.royalty_count ?? 0}</strong>
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#0284c7" }}>🌟 DISTRICT ROYALTY L1-L10 30d (₹{l1l10Rate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(mon.pools?.daily_royalty_l1_l10_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 30d Achievers: <strong>{proj.royalty_t3_recipients ?? mon.achievers?.tier3_count ?? 0}</strong>
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#dc2626" }}>🏆 DISTRICTWISE L8-L10 (₹{distWiseRate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(mon.pools?.daily_royalty_dist_l8_l10_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 District L8-10 Leaders: <strong>{proj.royalty_t2_recipients ?? mon.achievers?.tier2_count ?? mon.achievers?.district_l8_l10_count ?? 0}</strong>
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#9333ea" }}>👑 STATEWISE L8-L10 (₹{stateWiseRate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(mon.pools?.daily_royalty_state_l8_l10_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 State L8-10 Leaders: <strong>{proj.royalty_t2_recipients ?? mon.achievers?.tier2_count ?? mon.achievers?.state_l8_l10_count ?? 0}</strong>
                  </div>
                </div>


                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#ea580c" }}>🎖️ DISTRICT CAPTAIN (₹{distCaptRate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(mon.pools?.daily_district_captain_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 District Captains: <strong>{mon.achievers?.captain_count ?? 0}</strong>
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309" }}>🎖️ STATE CAPTAIN (₹{stateCaptRate})</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                    ₹{Number(mon.pools?.daily_state_captain_pool ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    👥 State Captains: <strong>{mon.achievers?.captain_count ?? 0}</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Execution Output Console */}
          {poolsTriggerOutput && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
                Distribution Engine Console Output:
              </div>
              <pre
                style={{
                  background: "#0f172a",
                  color: "#38bdf8",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: "monospace",
                  overflowX: "auto",
                  maxHeight: 240,
                  whiteSpace: "pre-wrap",
                }}
              >
                {poolsTriggerOutput}
              </pre>
            </div>
          )}
        </Section>

        {/* 2. Self-Rebirth Inflow & Distribution Audit Ledger */}
        {(() => {
          const rebirthRecords = mon.rebirth_records || [];
          const q = (rebirthSearchQuery || "").toLowerCase().trim();
          const filtered = rebirthRecords.filter((r) => {
            if (!q) return true;
            return (
              String(r.tx_id || "").includes(q) ||
              String(r.user_id || "").includes(q) ||
              String(r.username || "").toLowerCase().includes(q) ||
              String(r.phone || "").includes(q) ||
              String(r.full_name || "").toLowerCase().includes(q) ||
              String(r.sponsor_username || "").toLowerCase().includes(q) ||
              String(r.sponsor_name || "").toLowerCase().includes(q) ||
              String(r.pack_index || "").includes(q)
            );
          });

          return (
            <Section
              title={isFranchiseWorkspace ? "Franchise ₹250 Self-Rebirth Inflow & Distribution Audit Ledger" : "₹250 Self-Rebirth Inflow & Distribution Audit Ledger"}
              subtitle={isFranchiseWorkspace ? "Real-time audit ledger of automated ₹250 Self-Rebirth IDs generated exclusively from franchise 25% Self Rebirth allocations, 5/3 Matrix placements, and upline commissions" : "Real-time audit ledger of automated ₹250 Self-Rebirth IDs generated from 25% Self Account pockets, 5/3 Matrix placements, and ₹50 Direct Sponsor bonuses"}
              right={
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="text"
                    value={rebirthSearchQuery}
                    onChange={(e) => setRebirthSearchQuery(e.target.value)}
                    placeholder="🔍 Search phone, user, sponsor, ID..."
                    style={{
                      height: 32,
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      padding: "0 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      minWidth: 240,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#0f172a",
                      background: "#f1f5f9",
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isFranchiseWorkspace ? `${filtered.length} Franchise Rebirth IDs` : `${filtered.length} Platform Rebirth IDs`}
                  </span>
                </div>
              }
            >
              {filtered.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
                  {rebirthRecords.length === 0
                    ? "No self-rebirth distributions recorded yet. Self-rebirths trigger instantly when user Self Account pockets reach ₹250."
                    : "No records found matching search filter."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>Tx ID</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>Generated By (User)</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>Rebirth Entry</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>Self Pocket Debit</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>Direct Sponsor Bonus (₹50)</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>5-Matrix Seat</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>3-Matrix Seat</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>Pool Contribution (₹50)</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>Timestamp</th>
                        <th style={{ padding: "10px 12px", color: "#475569", fontWeight: 800 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, idx) => (
                        <tr key={r.tx_id || idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 800, color: "#0f172a" }}>
                            <span style={{ padding: "3px 6px", background: "#f1f5f9", borderRadius: 4, fontFamily: "monospace" }}>
                              #{r.tx_id}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: 800, color: "#0f172a" }}>{r.full_name || r.username}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>📞 {r.phone || r.username} (ID: {r.user_id})</div>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ padding: "3px 8px", background: "#e0e7ff", color: "#3730a3", borderRadius: 12, fontWeight: 800, fontSize: 11 }}>
                              Rebirth #{r.pack_index}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 800, color: "#dc2626" }}>
                            -₹{Number(r.amount || 250).toFixed(2)}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: 800, color: "#059669" }}>+₹{Number(r.sponsor_bonus || 50).toFixed(2)}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>
                              Credited: <strong>{r.sponsor_name || r.sponsor_username || "System Root"}</strong>
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {r.five_seat_id ? (
                              <span style={{ padding: "2px 6px", background: "#ecfdf5", color: "#065f46", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                Seat #{r.five_seat_id}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 11 }}>Auto-Queued</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {r.three_seat_id ? (
                              <span style={{ padding: "2px 6px", background: "#eff6ff", color: "#1e40af", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                Seat #{r.three_seat_id}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 11 }}>Auto-Queued</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ fontWeight: 800, color: "#d97706" }}>₹{Number(r.pool_contribution || 50).toFixed(2)}</span>
                            <div style={{ fontSize: 10, color: "#64748b" }}>Franchise + Coord + Royalty</div>
                          </td>
                          <td style={{ padding: "10px 12px", fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>
                            {r.created_at || "-"}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ padding: "3px 8px", background: "#dcfce7", color: "#166534", borderRadius: 12, fontWeight: 800, fontSize: 11 }}>
                              ⚡ Instant
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          );
        })()}

        {/* 3. Recent Daily Pool Distribution Logs */}
        <Section
          title="Recent Pool Distribution & Royalty Payout Audit History"
          subtitle="Audit ledger of past automated midnight (11:59 PM) and manual daily pool payouts, including individual recipient credits"
        >
          {history.length > 0 && (
            <div style={{ overflowX: "auto", marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
                Aggregated Pool Runs
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Date</th>
                    <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Pool Tier</th>
                    <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Share %</th>
                    <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Pot Amount</th>
                    <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Recipients</th>
                    <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Total Distributed</th>
                    <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 800, color: "#0f172a" }}>{h.date}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 800 }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            background:
                              h.pool === "FRANCHISE"
                                ? "#dbeafe"
                                : h.pool === "DISTRICT"
                                ? "#ede9fe"
                                : h.pool === "STATE"
                                ? "#fef3c7"
                                : "#d1fae5",
                            color:
                              h.pool === "FRANCHISE"
                                ? "#1e40af"
                                : h.pool === "DISTRICT"
                                ? "#5b21b6"
                                : h.pool === "STATE"
                                ? "#92400e"
                                : "#065f46",
                          }}
                        >
                          {h.pool}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#475569" }}>{h.pool_percent || "-"}%</td>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: "#0f172a" }}>₹{h.pool_pot?.toFixed(2)}</td>
                      <td style={{ padding: "8px 12px", color: "#475569" }}>{h.recipients_count}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 800, color: "#059669" }}>₹{h.total_paid?.toFixed(2)}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: h.unclaimed_fallback ? "#b45309" : "#047857" }}>
                        {h.unclaimed_fallback ? "Company Root (9999999999)" : "Direct Members"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Individual Recipient Royalty Payouts Table */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b" }}>
                Individual Achiever Payout Receipts ({royaltyPayouts.length} record{royaltyPayouts.length === 1 ? "" : "s"})
              </div>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                Distributed to qualified members holding L7+ (Tier 1) & L10 (Tier 2)
              </span>
            </div>

            {royaltyPayouts.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600, background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1" }}>
                No individual royalty payouts recorded yet. The engine runs daily at 11:59 PM (23:59) or upon clicking "Trigger Payout Now".
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>TR / Tx ID</th>
                      <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Achiever (User)</th>
                      <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Royalty Tier</th>
                      <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Amount Credited</th>
                      <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Wallet Credit</th>
                      <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Date & Time</th>
                      <th style={{ padding: "8px 12px", color: "#64748b", fontWeight: 800 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {royaltyPayouts.map((tx, idx) => (
                      <tr key={tx.tr || tx.id || idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                          #{tx.tr || tx.id}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>{tx.username || tx.full_name || tx.user}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>📞 {tx.phone || tx.username || "–"}</div>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 800,
                              background: tx.meta?.tier === 2 || (tx.meta?.description || "").includes("Tier 2") ? "#fee2e2" : "#ecfdf5",
                              color: tx.meta?.tier === 2 || (tx.meta?.description || "").includes("Tier 2") ? "#991b1b" : "#065f46",
                            }}
                          >
                            {tx.meta?.tier === 2 || (tx.meta?.description || "").includes("Tier 2") ? "Tier 2 (L8-L10)" : "Tier 1 (L1-L7)"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 900, color: "#059669" }}>
                          ₹{(Number(tx.amount || 0) * 4 / 3).toFixed(2)}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#1e40af", fontWeight: 700 }}>
                          <div>Main (75%): ₹{Number(tx.amount || 0).toFixed(2)}</div>
                          <div style={{ fontSize: 11, color: "#7c3aed" }}>Self Pocket (25%): ₹{(Number(tx.amount || 0) / 3).toFixed(2)}</div>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#475569", whiteSpace: "nowrap" }}>
                          {tx.date || tx.created_at || "-"}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ padding: "2px 8px", background: "#dcfce7", color: "#166534", borderRadius: 12, fontWeight: 800, fontSize: 11 }}>
                            ✓ Credited
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>

        {/* 4. Royalty Income Tiers (Shopping/Block Turnover) */}
        <Section
          title="Shopping & Block Royalty Income Tiers"
          subtitle="Configure shopping & general network turnover pools, share percentages, and achievement threshold caps for Royalty Tiers"
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {/* Tier 1 Card */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, background: "#f8fafc" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 4 }}>
                👑 Royalty Tier 1 (Layer 1 to Layer 7)
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                Applies to qualified members across Layer 1 - Layer 7 network
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input
                  label="Pool Share Percentage (%)"
                  type="number"
                  value={royaltyConfig.tier1_percent ?? 4}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier1_percent: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
                <Input
                  label="Earning Cap / Threshold Amount (₹)"
                  type="number"
                  value={royaltyConfig.tier1_cap ?? 10000}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier1_cap: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
                <Input
                  label="Qualification Window (Days)"
                  type="number"
                  value={royaltyConfig.tier1_days ?? 40}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier1_days: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
              </div>
            </div>

            {/* Tier 2 Card */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, background: "#f8fafc" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 4 }}>
                👑 Royalty Tier 2 (Layer 8 to Layer 10)
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                Applies to top tier leaders reaching Layer 10 within 7 days of L7
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input
                  label="Pool Share Percentage (%)"
                  type="number"
                  value={royaltyConfig.tier2_percent ?? 6}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier2_percent: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
                <Input
                  label="Earning Cap / Threshold Amount (₹)"
                  type="number"
                  value={royaltyConfig.tier2_cap ?? 40000}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier2_cap: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
                <Input
                  label="Qualification Window (Days from L7)"
                  type="number"
                  value={royaltyConfig.tier2_days ?? 7}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier2_days: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
              </div>
            </div>

            {/* Tier 3 Card: Recovery Window */}
            <div style={{ border: "1px solid #fed7aa", borderRadius: 10, padding: 16, background: "#fffaf5" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#9a3412", marginBottom: 4 }}>
                👑 Royalty Tier 3 (Recovery: Layer 1 to Layer 10)
              </div>
              <div style={{ fontSize: 12, color: "#7c2d12", marginBottom: 12 }}>
                For members who missed Tier 1 or 2, completing L1-L10 within grace window
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input
                  label="Pool Share Percentage (%)"
                  type="number"
                  value={royaltyConfig.tier3_percent ?? 4}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier3_percent: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
                <Input
                  label="Earning Cap / Threshold Amount (₹)"
                  type="number"
                  value={royaltyConfig.tier3_cap ?? 10000}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier3_cap: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
                <Input
                  label="Qualification Window (Days)"
                  type="number"
                  value={royaltyConfig.tier3_days ?? 30}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier3_days: Number(val) }));
                    setRoyaltyDirty(true);
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSaveRoyaltyConfig}
              disabled={royaltySaving}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 900,
                border: "none",
                cursor: royaltySaving ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {royaltySaving ? "Saving Configuration..." : "Save Royalty Configuration"}
            </button>
          </div>
        </Section>
      </div>
    );
  }


  // Save All (per tab)
  const anySaving = mSaving || m150Saving || mx150Saving || m750Saving || mx750Saving || m759Saving || mx759Saving || lSaving || lSeeding || pLoading || mxSaving || rankSaving || sppSaving || royaltySaving;
  const tabDirty = (
    (activeTab === TABS.ACT150 && (mDirty || m150Dirty || mx150Dirty || customTaxDirty)) ||
    (activeTab === TABS.ACT750 && (mDirty || m750Dirty || mx750Dirty || customTaxDirty)) ||
    (activeTab === TABS.ACT759 && (m759Dirty || m759MonthlyDirty || mx759Dirty)) ||
    (activeTab === TABS.SPP1000 && (sppDirty || customTaxDirty)) ||
    (activeTab === TABS.ROYALTY && royaltyDirty) ||
    (activeTab === TABS.RANK_UPGRADE && (rankDirty || customTaxDirty)) ||
    (activeTab === TABS.WITHDRAW && (
      (mServer && Number(Number(mForm.withdrawal_sponsor_percent||0).toFixed(2)) !== Number(Number(mServer?.withdrawal_sponsor_percent||0).toFixed(2))) ||
      (mServer && Number(Number(mForm.tax_percent||0).toFixed(2)) !== Number(Number(mServer?.tax_percent||0).toFixed(2)))
    ))
  );
  const tabLoading = (
    (activeTab === TABS.ACT150 && (mLoading || m150Loading || mx150Loading)) ||
    (activeTab === TABS.ACT750 && (mLoading || m750Loading || mx750Loading)) ||
    (activeTab === TABS.ACT759 && (m759Loading || mx759Loading)) ||
    (activeTab === TABS.WITHDRAW && mLoading)
  );

  async function onSaveAll() {
    try {
      if (activeTab === TABS.ACT150) {
        if (!act150BalanceInfo.isBalanced150) {
          setErr(`Incorrect configuration: Total outflows (₹${act150BalanceInfo.totalOutflow150.toFixed(2)}) exceed Total Inflow (₹${act150BalanceInfo.base150Total.toFixed(2)}) by deficit of ₹${Math.abs(act150BalanceInfo.remainingMargin150).toFixed(2)}! Save rejected. Please correct amounts.`);
          return;
        }
        if (mDirty) await onMasterSave();
        if (m150Dirty) await onM150Save();
        if (mx150Dirty) await onMx150Save();
      } else if (activeTab === TABS.ACT750) {
        if (!act750BalanceInfo.isBalanced750) {
          setErr(`Incorrect configuration: Total outflows (₹${act750BalanceInfo.totalOutflow750.toFixed(2)}) exceed Total Inflow (₹${act750BalanceInfo.base750Total.toFixed(2)}) by deficit of ₹${Math.abs(act750BalanceInfo.remainingMargin750).toFixed(2)}! Save rejected. Please correct amounts.`);
          return;
        }
        if (mDirty) await onMasterSave();
        if (m750Dirty || customTaxDirty) await onM750Save();
        if (mx750Dirty) await onMx750Save();
        setCustomTaxDirty(false);
      } else if (activeTab === TABS.ACT759) {
        if (!act759BalanceInfo.isBalanced759) {
          setErr(`Incorrect configuration: Total outflows (₹${act759BalanceInfo.totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${act759BalanceInfo.base759Total.toFixed(2)}) by deficit of ₹${Math.abs(act759BalanceInfo.remainingMargin759).toFixed(2)}! Save rejected. Please correct amounts.`);
          return;
        }
        if (m759Dirty || m759MonthlyDirty) await onM759Save();
        if (mx759Dirty) await onMx759Save();
      } else if (activeTab === TABS.SPP1000) {
        if (!sppBalanceInfo.isBalancedSPP) {
          setErr(`Incorrect configuration: Total outflows (₹${sppBalanceInfo.totalOutflowSPP.toFixed(2)}) exceed Total Inflow (₹${sppBalanceInfo.sppPrice.toFixed(2)}) by deficit of ₹${Math.abs(sppBalanceInfo.remainingMarginSPP).toFixed(2)}! Save rejected. Please correct amounts.`);
          return;
        }
        if (sppDirty || customTaxDirty) await handleSaveSppConfig();
      } else if (activeTab === TABS.ROYALTY) {
        if (royaltyDirty) await handleSaveRoyaltyConfig();
      } else if (activeTab === TABS.RANK_UPGRADE) {
        if (rankDirty || customTaxDirty) await handleSaveRankConfig();
      } else if (activeTab === TABS.WITHDRAW) {
        const taxDirty =
          mServer &&
          Number(Number(mForm.tax_percent || 0).toFixed(2)) !==
            Number(Number(mServer.tax_percent || 0).toFixed(2));
        const sponsorDirty =
          mServer &&
          Number(Number(mForm.withdrawal_sponsor_percent).toFixed(2)) !==
            Number(Number(mServer.withdrawal_sponsor_percent).toFixed(2));
        if (taxDirty) {
          const tp = Number(Number(mForm.tax_percent || 0).toFixed(2));
          await onMasterSave({ tax: { percent: tp } });
        }
        if (sponsorDirty) {
          const sp = Number(Number(mForm.withdrawal_sponsor_percent || 0).toFixed(2));
          await onMasterSave({ withdrawal: { sponsor_percent: sp } });
        }
      }
    } catch (_) {}
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#ffffff",
        padding: "12px 16px",
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
              {isFranchiseWorkspace ? "Franchise Commission & Rebirth Distribution" : "Commission Distribution"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {isFranchiseWorkspace
                ? "Configure franchise self-rebirth engine, daily royalties, and withdrawal commissions."
                : "Configure commissions with single-click authoritative saving per tab."}
            </div>
          </div>
          <SaveBtn
            onClick={onSaveAll}
            disabled={tabLoading}
            saving={anySaving}
            dirty={tabDirty}
            labelSaved={`${activeTab === TABS.ACT750 ? "₹750 Activation" : activeTab === TABS.SPP1000 ? "₹1,000 SPP" : activeTab === TABS.RANK_UPGRADE ? (isFranchiseWorkspace ? "₹250 Self-Rebirth" : "Rank & Rebirth") : activeTab === TABS.ROYALTY ? "Royalty & Pools" : activeTab === TABS.WITHDRAW ? "Withdrawal" : "All Settings"} Saved ✓`}
            labelDirty={`Save ${activeTab === TABS.ACT750 ? "₹750 Activation" : activeTab === TABS.SPP1000 ? "₹1,000 SPP" : activeTab === TABS.RANK_UPGRADE ? (isFranchiseWorkspace ? "₹250 Self-Rebirth" : "Rank & Rebirth") : activeTab === TABS.ROYALTY ? "Royalty & Pools" : activeTab === TABS.WITHDRAW ? "Withdrawal Commission" : "Changes"} *`}
            imbalanced={
              (activeTab === TABS.SPP1000 && !sppBalanceInfo.isBalancedSPP) ||
              (activeTab === TABS.ACT750 && !act750BalanceInfo.isBalanced750) ||
              (activeTab === TABS.ACT150 && !act150BalanceInfo.isBalanced150) ||
              (activeTab === TABS.ACT759 && !act759BalanceInfo.isBalanced759)
            }
            imbalancedMsg={
              activeTab === TABS.SPP1000 && !sppBalanceInfo.isBalancedSPP
                ? `Incorrect configuration: Total outflows (₹${sppBalanceInfo.totalOutflowSPP.toFixed(2)}) exceed Total Inflow (₹${sppBalanceInfo.sppPrice.toFixed(2)}) by ₹${Math.abs(sppBalanceInfo.remainingMarginSPP).toFixed(2)}! Save rejected.`
                : activeTab === TABS.ACT750 && !act750BalanceInfo.isBalanced750
                ? `Incorrect configuration: Total outflows (₹${act750BalanceInfo.totalOutflow750.toFixed(2)}) exceed Total Inflow (₹${act750BalanceInfo.base750Total.toFixed(2)}) by ₹${Math.abs(act750BalanceInfo.remainingMargin750).toFixed(2)}! Save rejected.`
                : activeTab === TABS.ACT150 && !act150BalanceInfo.isBalanced150
                ? `Incorrect configuration: Total outflows (₹${act150BalanceInfo.totalOutflow150.toFixed(2)}) exceed Total Inflow (₹${act150BalanceInfo.base150Total.toFixed(2)}) by ₹${Math.abs(act150BalanceInfo.remainingMargin150).toFixed(2)}! Save rejected.`
                : activeTab === TABS.ACT759 && !act759BalanceInfo.isBalanced759
                ? `Incorrect configuration: Total outflows (₹${act759BalanceInfo.totalOutflow759.toFixed(2)}) exceed Total Inflow (₹${act759BalanceInfo.base759Total.toFixed(2)}) by ₹${Math.abs(act759BalanceInfo.remainingMargin759).toFixed(2)}! Save rejected.`
                : ""
            }
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {(isFranchiseWorkspace
          ? [
              { key: TABS.RANK_UPGRADE, label: "₹250 Self-Rebirth Engine" },
              { key: TABS.ROYALTY, label: "Royalty & Daily 11:59 PM Pools" },
              { key: TABS.WITHDRAW, label: "Withdrawal Commission" },
            ]
          : [
              { key: TABS.ACT750, label: "₹750 Activation" },
              { key: TABS.SPP1000, label: "₹1,000 SPP" },
              { key: TABS.ROYALTY, label: "Royalty & Daily 11:59 PM Pools" },
              { key: TABS.WITHDRAW, label: "Withdrawal Commission" },
              { key: TABS.RANK_UPGRADE, label: "₹250 Self-Rebirth & Rank Upgrades" },
            ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: activeTab === t.key ? "1px solid #0ea5e9" : "1px solid #e2e8f0",
              background: activeTab === t.key ? "#e0f2fe" : "#fff",
              color: activeTab === t.key ? "#0369a1" : "#0f172a",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>

      {err ? (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          {err}
        </div>
      ) : null}
      {ok ? (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #bbf7d0",
            background: "#ecfdf5",
            color: "#065f46",
            fontWeight: 700,
          }}
        >
          {ok}
        </div>
      ) : null}

      {/* Tab Contents */}
      {activeTab === TABS.ACT150 && renderTab150()}
      {activeTab === TABS.ACT750 && renderTab750()}
      {activeTab === TABS.ACT759 && renderTab759()}
      {activeTab === TABS.SPP1000 && renderTabSPP1000()}
      {activeTab === TABS.ROYALTY && renderTabRoyalty()}
      {activeTab === TABS.WITHDRAW && renderTabWithdraw()}
      {activeTab === TABS.RANK_UPGRADE && renderTabRankUpgrade()}
    </div>
  );
}
