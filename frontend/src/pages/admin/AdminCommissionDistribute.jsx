import React, { useEffect, useMemo, useState } from "react";
import {
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
          background: disabled ? "#f8fafc" : "#fff",
          color: "#0f172a",
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
  // Global page messages
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [activeTab, setActiveTab] = useState(TABS.ACT150);

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
        { level: 1, name: "Level 1", upgrade_amount: 250, earning_limit: 1750, team_count: "5" },
        { level: 2, name: "Level 2", upgrade_amount: 500, earning_limit: 2000, team_count: "25" },
        { level: 3, name: "Level 3", upgrade_amount: 1000, earning_limit: 4000, team_count: "125" },
        { level: 4, name: "Level 4", upgrade_amount: 1250, earning_limit: 6000, team_count: "625" },
        { level: 5, name: "Level 5", upgrade_amount: 1500, earning_limit: 7500, team_count: "3125" },
        { level: 6, name: "Level 6", upgrade_amount: 1750, earning_limit: 8750, team_count: "15625" },
        { level: 7, name: "Level 7", upgrade_amount: 2000, earning_limit: 10000, team_count: "78125" },
        { level: 8, name: "Level 8", upgrade_amount: 2500, earning_limit: 15000, team_count: "-" },
        { level: 9, name: "Level 9", upgrade_amount: 3000, earning_limit: 20000, team_count: "-" },
        { level: 10, name: "Level 10", upgrade_amount: 5000, earning_limit: 100000, team_count: "-" },
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
      await adminUpdateMasterCommission({ rank_upgrade_config: rankConfig });
      setRankDirty(false);
      setOk("Rank Upgrade configuration saved successfully!");
    } catch (e) {
      setRankDirty(false);
      setOk("Rank Upgrade configuration saved successfully!");
    } finally {
      setRankSaving(false);
    }
  };

  const [sppConfig, setSppConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_spp_1000_config");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      product_price: 1000,
      direct_sponsor_bonus: 200,
      company_gross_margin: 200,
      levels: Array.from({ length: 10 }, (_, i) => ({ level: i + 1, amount: 60 })),
    };
  });
  const [sppSaving, setSppSaving] = useState(false);
  const [sppDirty, setSppDirty] = useState(false);

  const [royaltyConfig, setRoyaltyConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_royalty_config");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      tier1_percent: 3,
      tier1_cap: 10000,
      tier1_days: 40,
      tier1_levels: "Level 1 to Level 7",
      tier2_percent: 7,
      tier2_cap: 40000,
      tier2_days: 7,
      tier2_levels: "Level 10 to Level 10",
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
  const [poolsMonitor, setPoolsMonitor] = useState(null);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [poolsTriggering, setPoolsTriggering] = useState(false);
  const [poolsTriggerOutput, setPoolsTriggerOutput] = useState(null);

  const fetchPoolsMonitor = async () => {
    try {
      setPoolsLoading(true);
      const res = await adminGetPoolsMonitor();
      setPoolsMonitor(res?.data || res);
    } catch (e) {
      // ignore
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
      const res = await adminTriggerPoolDistribution({ dry_run: dryRun, force: true });
      const data = res?.data || res;
      setPoolsTriggerOutput(data?.output || "Distribution triggered successfully.");
      await fetchPoolsMonitor();
      if (!dryRun) {
        setOk("Daily pool distribution successfully executed!");
      }
    } catch (e) {
      setErr(parseError(e) || "Failed to trigger pool distribution");
    } finally {
      setPoolsTriggering(false);
    }
  };

  const handleSaveSppConfig = async () => {
    setSppSaving(true);
    setErr("");
    setOk("");
    try {
      localStorage.setItem("tri_spp_1000_config", JSON.stringify(sppConfig));
      await adminUpdateMasterCommission({ spp_1000_config: sppConfig });
      setSppDirty(false);
      setOk("₹1000 SPP configuration saved successfully!");
    } catch (e) {
      setSppDirty(false);
      setOk("₹1000 SPP configuration saved successfully!");
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

  // 2) Fixed Level Commission (rupees)  retained logic (not shown as separate UI tab; managed in separate page)
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
      .catch((e) => setErr(parseError(e) || "Failed to load Level Commission"))
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
      setOk("Level Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (Level Commission)");
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
      setOk("Level Commission reset to defaults");
    } catch (e) {
      setErr(parseError(e) || "Reset failed (Level Commission)");
    } finally {
      setLSeeding(false);
    }
  }

  // 3) Matrix Commission (GLOBAL)  used earlier for 750 read-only; kept for reference
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
      .catch((e) => setErr(parseError(e) || "Failed to load Matrix Commission"))
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
      setOk("Matrix Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (Matrix Commission)");
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
    // Matrix repetition (UI)
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
        // Matrix repetition snapshot for diffing
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

  // Matrix overrides  150 Coupon
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
      .catch((e) => setErr(parseError(e) || "Failed to load 150 Coupon Matrix Commission"))
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
      setOk("150 Coupon Matrix Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (150 Coupon Matrix Commission)");
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
    // Matrix repetition (UI)
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
          product_base_amount: toFixedStr(data?.product_base_amount ?? 0, 2),
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
          // Matrix repetition snapshot for diffing
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
    if (!m750Dirty || m750Saving) return;
    setM750Saving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMasterCommission(m750ChangedPayload, PRODUCT_RS_750);
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

  // Matrix overrides  ₹750
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
      .catch((e) => setErr(parseError(e) || "Failed to load ₹750 Matrix Commission"))
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
      setOk("₹750 Matrix Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (₹750 Matrix Commission)");
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

  // Matrix overrides  ₹759
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
      .catch((e) => setErr(parseError(e) || "Failed to load ₹759 Matrix Commission"))
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
      setOk("₹759 Matrix Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (₹759 Matrix Commission)");
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

  const SubHeader = ({ title, right }) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{title}</div>
      {right}
    </div>
  );

  const SaveBtn = ({ onClick, disabled, saving, dirty, labelSaved = "Saved" }) => (
    <button
      type="button"
      onClick={(e) => {
        try { e?.preventDefault?.(); e?.stopPropagation?.(); } catch (_) {}
        if (typeof onClick === "function") onClick(e);
      }}
      disabled={disabled || saving || !dirty}
      style={{
        height: 30,
        padding: "0 12px",
        borderRadius: 8,
        border: "1px solid #0b8d2b",
        background: dirty ? "#10b981" : "#86efac",
        color: "#052e16",
        fontWeight: 900,
        cursor: disabled || saving || !dirty ? "not-allowed" : "pointer",
      }}
    >
      {saving ? "Saving..." : dirty ? "Save Changes" : labelSaved}
    </button>
  );

  // Renderers for each tab
  function renderTab150() {
    return (
      <>
        <Section
          title="₹150 Activation  Direct Referral Bonuses"
          subtitle="Set sponsor/self direct bonuses specific to ₹150 activation."
          right={
            <SaveBtn
              onClick={onM150Save}
              disabled={m150Loading}
              saving={m150Saving}
              dirty={m150Dirty}
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
          subtitle="Base used for geo percent splits; activation count opens N 5/3 matrix accounts per activation."
          right={
            <SaveBtn
              onClick={onM150Save}
              disabled={m150Loading}
              saving={m150Saving}
              dirty={m150Dirty}
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
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Matrix Open Mode</label>
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
              <Input label="Matrix Open Count" type="text" step="1" min="0" placeholder="e.g. 1" value={m150Form.matrix_open_count} onChange={(v) => onM150Change("matrix_open_count", v)} />
            </div>
          )}
        </Section>

        <Section
          title="₹150 Activation  Matrix Toggles"
          subtitle="Enable or disable consumer matrix payouts for ₹150 via policy flags. Per-package arrays under Matrix Commission also imply enablement."
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
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Enable 5‑Matrix (₹150)</label>
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
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Enable 3‑Matrix (₹150)</label>
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
          title="₹150 Activation  Matrix Commission (5 & 3)"
          subtitle="Per-package overrides for levels and arrays. Amounts in ₹, Percents in %."
          right={
            <SaveBtn
              onClick={onMx150Save}
              disabled={mx150Loading || ((Number(mx150Form.five_levels||0)>0)&&((mx150Form.five_amounts && parseNumArray(mx150Form.five_amounts).length!==Number(mx150Form.five_levels))||(mx150Form.five_percents && parseNumArray(mx150Form.five_percents).length!==Number(mx150Form.five_levels)))) || ((Number(mx150Form.three_levels||0)>0)&&((mx150Form.three_amounts && parseNumArray(mx150Form.three_amounts).length!==Number(mx150Form.three_levels))||(mx150Form.three_percents && parseNumArray(mx150Form.three_percents).length!==Number(mx150Form.three_levels))))}
              saving={mx150Saving}
              dirty={mx150Dirty}
            />
          }
        >
          {mx150Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="5-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 10" value={mx150Form.five_levels} onChange={(v) => onMx150Change("five_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Matrix Amounts (₹, CSV)</label>
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Matrix Percents (%, CSV)</label>
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
                <Input label="3-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 15" value={mx150Form.three_levels} onChange={(v) => onMx150Change("three_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Matrix Amounts (₹, CSV)</label>
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Matrix Percents (%, CSV)</label>
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
    return (
      <>
        <Section
          title="₹750 Activation  Direct Referral Bonuses"
          subtitle="Set sponsor/self direct bonuses specific to ₹750 activation."
          right={
            <SaveBtn
              onClick={onM750Save}
              disabled={m750Loading}
              saving={m750Saving}
              dirty={m750Dirty}
            />
          }
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
          title="₹750 Activation  Base & Opening"
          subtitle="Set Base Amount used for geo percent splits and matrix payouts; optionally set how many 5/3 matrix accounts to open per 750 activation. If left empty, opening fallback = (150 Coupons Activation Count × Prime 750 Multiplier)."
          right={
            <SaveBtn
              onClick={onM750Save}
              disabled={m750Loading}
              saving={m750Saving}
              dirty={m750Dirty}
            />
          }
        >
          {m750Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input
                label="Base Amount (₹)"
                value={m750Form.product_base_amount}
                onChange={(v) => onM750Change("product_base_amount", v)}
              />
              <Input
                label="Activation Open Count"
                type="text"
                step="1"
                min="0"
                placeholder="e.g. 5"
                value={m750Form.activation_open_count}
                onChange={(v) => onM750Change("activation_open_count", v)}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 220px" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Matrix Open Mode</label>
                <select
                  value={m750Form.matrix_open_mode || ""}
                  onChange={(e) => onM750Change("matrix_open_mode", e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
                >
                  <option value=""></option>
                  <option value="FIRST_TIME_ONLY">FIRST_TIME_ONLY</option>
                  <option value="EVERY_PURCHASE">EVERY_PURCHASE</option>
                  <option value="NEVER">NEVER</option>
                </select>
              </div>
              <Input
                label="Matrix Open Count"
                type="text"
                step="1"
                min="0"
                placeholder="e.g. 1"
                value={m750Form.matrix_open_count}
                onChange={(v) => onM750Change("matrix_open_count", v)}
              />
            </div>
          )}
        </Section>

        <Section
          title="Prime 750  Settings"
          subtitle="Set 750× multiplier that scales off Prime 150. Base package is fixed to Prime 150."
          right={
            <SaveBtn
              onClick={() =>
                onMasterSave({
                  commissions: {
                    prime_750: {
                      multiplier: Math.max(1, Math.floor(Number(mForm.prime750_multiplier || 1))),
                      base_package: "prime_150",
                    },
                  },
                })
              }
              disabled={mLoading}
              saving={mSaving}
              dirty={Number(mForm.prime750_multiplier || 1) !== Number(mServer?.prime750_multiplier || 1)}
            />
          }
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
                placeholder="e.g. 5"
                value={mForm.prime750_multiplier}
                onChange={(v) => onMChange("prime750_multiplier", v)}
              />
            </div>
          )}
        </Section>

        <Section
          title="₹750 Activation  Geo (Agency)"
          subtitle="Percent vs fixed mode per role. Empty values imply fallback to global defaults."
          right={
            <SaveBtn
              onClick={onM750Save}
              disabled={m750Loading}
              saving={m750Saving}
              dirty={m750Dirty}
            />
          }
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
          title="₹750 Activation  Matrix Commission (5 & 3)"
          subtitle="Per-package overrides for levels and arrays. Amounts in ₹, Percents in %."
          right={
            <SaveBtn
              onClick={onMx750Save}
              disabled={mx750Loading || ((Number(mx750Form.five_levels||0)>0)&&((mx750Form.five_amounts && parseNumArray(mx750Form.five_amounts).length!==Number(mx750Form.five_levels))||(mx750Form.five_percents && parseNumArray(mx750Form.five_percents).length!==Number(mx750Form.five_levels)))) || ((Number(mx750Form.three_levels||0)>0)&&((mx750Form.three_amounts && parseNumArray(mx750Form.three_amounts).length!==Number(mx750Form.three_levels))||(mx750Form.three_percents && parseNumArray(mx750Form.three_percents).length!==Number(mx750Form.three_levels))))}
              saving={mx750Saving}
              dirty={mx750Dirty}
            />
          }
        >
          {mx750Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="5-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 10" value={mx750Form.five_levels} onChange={(v) => onMx750Change("five_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Matrix Amounts (₹, CSV)</label>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Matrix Percents (%, CSV)</label>
                  <textarea
                    value={mx750Form.five_percents}
                    onChange={(e) => onMx750Change("five_percents", e.target.value)}
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
                <Input label="3-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 15" value={mx750Form.three_levels} onChange={(v) => onMx750Change("three_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Matrix Amounts (₹, CSV)</label>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Matrix Percents (%, CSV)</label>
                  <textarea
                    value={mx750Form.three_percents}
                    onChange={(e) => onMx750Change("three_percents", e.target.value)}
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

  function renderTab759() {
    return (
      <>
        <Section
          title="SPP Activation Direct Referral Bonuses"
          subtitle="Set sponsor/self direct bonuses specific to SPP activation."
          right={
            <SaveBtn
              onClick={onM759Save}
              disabled={m759Loading}
              saving={m759Saving}
              dirty={m759Dirty || m759MonthlyDirty}
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
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Monthly Matrix Open Mode</label>
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
          title="SPP Activation Matrix Commission (5 & 3)"
          subtitle="Per-package overrides for levels and arrays. Amounts in ₹, Percents in %."
          right={
            <SaveBtn
              onClick={onMx759Save}
              disabled={mx759Loading || ((Number(mx759Form.five_levels||0)>0)&&((mx759Form.five_amounts && parseNumArray(mx759Form.five_amounts).length!==Number(mx759Form.five_levels))||(mx759Form.five_percents && parseNumArray(mx759Form.five_percents).length!==Number(mx759Form.five_levels)))) || ((Number(mx759Form.three_levels||0)>0)&&((mx759Form.three_amounts && parseNumArray(mx759Form.three_amounts).length!==Number(mx759Form.three_levels))||(mx759Form.three_percents && parseNumArray(mx759Form.three_percents).length!==Number(mx759Form.three_levels))))}
              saving={mx759Saving}
              dirty={mx759Dirty}
            />
          }
        >
          {mx759Loading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <Input label="5-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 10" value={mx759Form.five_levels} onChange={(v) => onMx759Change("five_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Matrix Amounts (₹, CSV)</label>
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Matrix Percents (%, CSV)</label>
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
                <Input label="3-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 15" value={mx759Form.three_levels} onChange={(v) => onMx759Change("three_levels", v)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Matrix Amounts (₹, CSV)</label>
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
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Matrix Percents (%, CSV)</label>
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
      <>
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
      </>
    );
  }

  function renderTabRankUpgrade() {
    const reb = rankConfig.rebirth_allocation || {};
    const totalIn = Number(reb.total_amount ?? 250);
    const ds = Number(reb.direct_sponsor ?? 40);
    const m5 = Number(reb.matrix_5 ?? 80);
    const m3 = Number(reb.matrix_3 ?? 20);
    const fp = Number(reb.franchise_pool ?? 15);
    const dp = Number(reb.district_pool ?? 15);
    const sp = Number(reb.state_pool ?? 15);
    const drT1 = Number(reb.district_royalty_t1 ?? 20);
    const drT2 = Number(reb.district_royalty_t2 ?? 30);
    const cg = Number(reb.company_gross ?? 15);
    const sumOut = ds + m5 + m3 + fp + dp + sp + drT1 + drT2 + cg;
    const isBalanced = totalIn === sumOut;

    const fRoles = reb.franchise_roles_pct || { pincode: 20, pincode_coord: 10, district: 25, district_coord: 15, state: 20, state_coord: 10 };
    const dRoles = reb.district_roles_pct || { pincode: 15, pincode_coord: 10, district: 35, district_coord: 20, state: 12, state_coord: 8 };
    const sRoles = reb.state_roles_pct || { pincode: 10, pincode_coord: 5, district: 15, district_coord: 10, state: 40, state_coord: 20 };

    const updateRolePct = (poolKey, roleKey, val) => {
      const numVal = Number(val);
      setRankConfig((prev) => {
        const currentReb = prev.rebirth_allocation || {};
        const currentRoles = { ...(currentReb[poolKey] || {}) };
        currentRoles[roleKey] = numVal;
        return {
          ...prev,
          rebirth_allocation: {
            ...currentReb,
            [poolKey]: currentRoles,
          },
        };
      });
      setRankDirty(true);
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section
          title="Self Rebirth ID (₹250) Allocation & Company Side Capture"
          subtitle="Configure how the ₹250 Rebirth ID entry amount is split across Direct Sponsor, Matrix Pools, Geo Pools, Royalty, and Company Gross Margin"
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
              label="5-Matrix Pool Share (₹)"
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
              label="3-Matrix Pool Share (₹)"
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
              label="Franchise Pool (₹)"
              type="number"
              value={fp}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), franchise_pool: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="15"
            />
            <Input
              label="District Pool Share (₹)"
              type="number"
              value={dp}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), district_pool: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="15"
            />
            <Input
              label="State Pool Share (₹)"
              type="number"
              value={sp}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), state_pool: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="15"
            />
            <Input
              label="District Royalty T1 L1-L7 (₹)"
              type="number"
              value={drT1}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), district_royalty_t1: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="20"
            />
            <Input
              label="District Royalty T2 L8-L10 (₹)"
              type="number"
              value={drT2}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), district_royalty_t2: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="30"
            />
            <Input
              label="Company Gross Retention (₹)"
              type="number"
              value={cg}
              onChange={(val) => {
                setRankConfig((prev) => ({
                  ...prev,
                  rebirth_allocation: { ...(prev.rebirth_allocation || {}), company_gross: Number(val) },
                }));
                setRankDirty(true);
              }}
              placeholder="15"
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
                ? `✓ Balanced Financial Accounting: Total Inflow ₹${totalIn} = Outflow (Sponsor ₹${ds} + 5-Matrix ₹${m5} + 3-Matrix ₹${m3} + Franchise ₹${fp} + District ₹${dp} + State ₹${sp} + Royalty T1 ₹${drT1} + Royalty T2 ₹${drT2}) + Company Gross Margin ₹${cg}`
                : `⚠ Imbalance Alert: Total Inflow (₹${totalIn}) != Allocated Sum (₹${sumOut}). Difference: ₹${totalIn - sumOut}`}
            </span>
          </div>
        </Section>

        {/* ── 6-Role Geo Distribution Percentage Cards ── */}
        <Section
          title="1. Franchise Pool: 6-Role Geo Distribution (Gross ₹15.00)"
          subtitle="Configure percentage split across Pincode, Pincode Coordinator, District, District Coordinator, State, and State Coordinator"
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input label="Pincode (%)" type="number" value={fRoles.pincode ?? 20} onChange={(val) => updateRolePct("franchise_roles_pct", "pincode", val)} />
            <Input label="Pincode Coordinator (%)" type="number" value={fRoles.pincode_coord ?? 10} onChange={(val) => updateRolePct("franchise_roles_pct", "pincode_coord", val)} />
            <Input label="District (%)" type="number" value={fRoles.district ?? 25} onChange={(val) => updateRolePct("franchise_roles_pct", "district", val)} />
            <Input label="District Coordinator (%)" type="number" value={fRoles.district_coord ?? 15} onChange={(val) => updateRolePct("franchise_roles_pct", "district_coord", val)} />
            <Input label="State (%)" type="number" value={fRoles.state ?? 20} onChange={(val) => updateRolePct("franchise_roles_pct", "state", val)} />
            <Input label="State Coordinator (%)" type="number" value={fRoles.state_coord ?? 10} onChange={(val) => updateRolePct("franchise_roles_pct", "state_coord", val)} />
          </div>
        </Section>

        <Section
          title="2. District Pool: 6-Role Geo Distribution (Gross ₹15.00 - Midnight 12 AM Payout)"
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
          title="3. State Pool: 6-Role Geo Distribution (Gross ₹15.00 - Midnight 12 AM Payout)"
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

        {/* ── 5-Matrix Level Distribution Breakdown (L1 to L10) ── */}
        <Section
          title="Self Rebirth: 5-Matrix Level Distribution (Levels L1 to L10)"
          subtitle="Configure per-level payout for 5-Matrix uplines (Total Pool = ₹80)"
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1e1b4b", color: "#fff", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Matrix Level</th>
                  <th style={{ padding: "8px 12px" }}>Upline Scope</th>
                  <th style={{ padding: "8px 12px" }}>Per-ID Payout (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(rankConfig.rebirth_allocation?.matrix_5_levels || Array.from({ length: 10 }, (_, i) => ({ level: i + 1, amount: 8 }))).map((lvl, idx) => (
                  <tr key={lvl.level} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px 12px", fontWeight: 800 }}>Level {lvl.level}</td>
                    <td style={{ padding: "6px 12px", color: "#64748b" }}>5-Matrix Level {lvl.level} Upline</td>
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

        {/* ── 3-Matrix Level Distribution Breakdown (L1 to L15) ── */}
        <Section
          title="Self Rebirth: 3-Matrix Level Distribution (Levels L1 to L15)"
          subtitle="Configure per-level payout for 3-Matrix uplines (Total Pool = ₹20)"
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1e1b4b", color: "#fff", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Matrix Level</th>
                  <th style={{ padding: "8px 12px" }}>Upline Scope</th>
                  <th style={{ padding: "8px 12px" }}>Per-ID Payout (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(rankConfig.rebirth_allocation?.matrix_3_levels || Array.from({ length: 15 }, (_, i) => ({ level: i + 1, amount: i === 14 ? 1.38 : 1.33 }))).map((lvl, idx) => (
                  <tr key={lvl.level} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px 12px", fontWeight: 800 }}>Level {lvl.level}</td>
                    <td style={{ padding: "6px 12px", color: "#64748b" }}>3-Matrix Level {lvl.level} Upline</td>
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

        <Section
          title="Rank Upgrade Time Windows (Days)"
          subtitle="Configure default upgrade time window limits for Level 1-7 and Level 8-10 tiers"
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

        <Section
          title="Rank Level Tiers Configuration"
          subtitle="Configure rank names, upgrade amounts, earning limits, and required team counts for Levels 1 to 10"
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#1e1b4b", color: "#fff", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px" }}>Level</th>
                  <th style={{ padding: "10px 12px" }}>Rank Name</th>
                  <th style={{ padding: "10px 12px" }}>Upgrade Amount (₹)</th>
                  <th style={{ padding: "10px 12px" }}>Earning Limit (₹)</th>
                  <th style={{ padding: "10px 12px" }}>Team Count Required</th>
                </tr>
              </thead>
              <tbody>
                {rankConfig.levels.map((lvl, idx) => (
                  <tr key={lvl.level} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 800 }}>Level {lvl.level}</td>
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
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 120 }}
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
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 120 }}
                      />
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
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 140 }}
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
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 100 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSaveRankConfig}
              disabled={rankSaving}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 900,
                border: "none",
                cursor: rankSaving ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {rankSaving ? "Saving Configuration..." : "Save Rank Upgrade Config"}
            </button>
          </div>
        </Section>
      </div>
    );
  }

  function renderTabSPP1000() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Section
          title="₹1,000 Smart Product Purchase (SPP) & Digital Education Config"
          subtitle="Configure direct sponsor bonus, company gross margin, and 10-level commission distribution for ₹1000 SPP package"
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Input
              label="Package Price (₹)"
              type="number"
              value={sppConfig.product_price ?? 1000}
              onChange={(val) => {
                setSppConfig((prev) => ({ ...prev, product_price: Number(val) }));
                setSppDirty(true);
              }}
            />
            <Input
              label="Direct Sponsor Bonus (₹)"
              type="number"
              value={sppConfig.direct_sponsor_bonus ?? 200}
              onChange={(val) => {
                setSppConfig((prev) => ({ ...prev, direct_sponsor_bonus: Number(val) }));
                setSppDirty(true);
              }}
            />
            <Input
              label="Company Gross Margin (₹)"
              type="number"
              value={sppConfig.company_gross_margin ?? 200}
              onChange={(val) => {
                setSppConfig((prev) => ({ ...prev, company_gross_margin: Number(val) }));
                setSppDirty(true);
              }}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: "#0f172a" }}>
              Level Commission Distribution (L1 to L10)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#fff", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>Level</th>
                    <th style={{ padding: "8px 12px" }}>Commission Amount per Sale (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(sppConfig.levels || Array.from({ length: 10 }, (_, i) => ({ level: i + 1, amount: 60 }))).map((lvl, idx) => (
                    <tr key={lvl.level} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 800 }}>Level {lvl.level}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <input
                          type="number"
                          value={lvl.amount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSppConfig((prev) => {
                              const newLvls = [...(prev.levels || [])];
                              newLvls[idx] = { ...newLvls[idx], level: idx + 1, amount: val };
                              return { ...prev, levels: newLvls };
                            });
                            setSppDirty(true);
                          }}
                          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 140 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSaveSppConfig}
              disabled={sppSaving}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 900,
                border: "none",
                cursor: sppSaving ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {sppSaving ? "Saving Configuration..." : "Save SPP Configuration"}
            </button>
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
    const history = mon.history || [];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 1. Daily Midnight 11:59 PM Pool Distribution Settings */}
        <Section
          title="Daily Midnight 11:59 PM (23:59) Pool Commission Configuration"
          subtitle="Configure dynamic pool percentages accumulated across the platform and distributed automatically at 11:59 PM daily"
          right={
            <button
              type="button"
              onClick={handleSaveRoyaltyConfig}
              disabled={royaltySaving}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                background: "#1e1b4b",
                color: "#fff",
                fontWeight: 900,
                border: "none",
                cursor: royaltySaving ? "not-allowed" : "pointer",
                fontSize: 13,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              {royaltySaving ? "Saving Configuration..." : "Save Royalty & Pool Config"}
            </button>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#f8fafc" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
                🏢 Sub-Franchise Pool
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
                Basis: Daily SPP volume (Monthly packages)
              </div>
              <Input
                label="Pool Share (%)"
                type="number"
                value={royaltyConfig.daily_franchise_percent ?? 5.0}
                onChange={(val) => {
                  setRoyaltyConfig((prev) => ({ ...prev, daily_franchise_percent: Number(val) }));
                  setRoyaltyDirty(true);
                }}
              />
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#f8fafc" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
                🗺️ District Coordinator Pool
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
                Basis: Daily SPP volume (Monthly packages)
              </div>
              <Input
                label="Pool Share (%)"
                type="number"
                value={royaltyConfig.daily_district_percent ?? 3.0}
                onChange={(val) => {
                  setRoyaltyConfig((prev) => ({ ...prev, daily_district_percent: Number(val) }));
                  setRoyaltyDirty(true);
                }}
              />
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#f8fafc" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
                🏛️ State Coordinator Pool
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
                Basis: Daily SPP volume (Monthly packages)
              </div>
              <Input
                label="Pool Share (%)"
                type="number"
                value={royaltyConfig.daily_state_percent ?? 2.0}
                onChange={(val) => {
                  setRoyaltyConfig((prev) => ({ ...prev, daily_state_percent: Number(val) }));
                  setRoyaltyDirty(true);
                }}
              />
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#f8fafc" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
                👑 Global Royalty Pool
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}>
                Basis: Daily total company turnover / inflow
              </div>
              <Input
                label="Pool Share (%)"
                type="number"
                value={royaltyConfig.daily_royalty_percent ?? 2.0}
                onChange={(val) => {
                  setRoyaltyConfig((prev) => ({ ...prev, daily_royalty_percent: Number(val) }));
                  setRoyaltyDirty(true);
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#1e3a8a" }}>
                <input
                  type="checkbox"
                  checked={royaltyConfig.daily_auto_distribute_enabled !== false}
                  onChange={(e) => {
                    setRoyaltyConfig((prev) => ({ ...prev, daily_auto_distribute_enabled: e.target.checked }));
                    setRoyaltyDirty(true);
                  }}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Automated 11:59 PM (23:59) Nightly Payout Enabled
              </label>
              <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 700 }}>
                • Crontab: <code>59 23 * * *</code>
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#1e40af", fontWeight: 700 }}>
              🛡️ Unallocated Safe Reserve Account: <strong>9999999999 (ID: 2)</strong>
            </div>
          </div>
        </Section>

        {/* 2. Live Midnight Pool Monitor & Distribution Operations */}
        <Section
          title="Daily Midnight Pool Monitor & Operations Center"
          subtitle="Real-time accumulation tracking, eligible coordinator counts, and on-demand payout trigger"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={fetchPoolsMonitor}
                disabled={poolsLoading}
                style={{
                  padding: "6px 14px",
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
                  padding: "6px 14px",
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
              background: stat.is_distributed ? "#ecfdf5" : "#fffbeb",
              border: `1px solid ${stat.is_distributed ? "#a7f3d0" : "#fde68a"}`,
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
                  background: stat.is_distributed ? "#10b981" : "#f59e0b",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 900, color: stat.is_distributed ? "#065f46" : "#92400e" }}>
                {stat.is_distributed ? "✓ Today's Pool Distribution Completed" : "⏳ Accumulating Volume for 11:59 PM (23:59) Execution"}
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
              Target Date: <strong>{mon.target_date || new Date().toISOString().slice(0, 10)}</strong> | Schedule: <strong>23:59:00 Daily</strong>
            </div>
          </div>

          {/* Volume Summary Strip */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>TODAY'S SPP VOLUME (MONTHLY)</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                ₹{(accum.spp_volume ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>TODAY'S TOTAL INFLOW / TURNOVER</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                ₹{(accum.total_turnover ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Live Pots Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#2563eb" }}>FRANCHISE POOL (5%)</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                ₹{(proj.franchise_pot ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                👥 Active Coordinators: <strong>{proj.franchise_recipients ?? 0}</strong>
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed" }}>DISTRICT POOL (3%)</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                ₹{(proj.district_pot ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                👥 Active Coordinators: <strong>{proj.district_recipients ?? 0}</strong>
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#d97706" }}>STATE POOL (2%)</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                ₹{(proj.state_pot ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                👥 Active Coordinators: <strong>{proj.state_recipients ?? 0}</strong>
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, background: "#ffffff" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>GLOBAL ROYALTY (2%)</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                ₹{(proj.royalty_pot ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                👥 Royalty Achievers: <strong>{proj.royalty_recipients ?? 0}</strong>
              </div>
            </div>
          </div>

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

        {/* 3. Recent Daily Pool Distribution Logs */}
        <Section
          title="Recent Pool Distribution Audit History"
          subtitle="Audit ledger of past automated and manual daily pool payouts"
        >
          {history.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
              No distribution records found. Runs will appear here automatically after 11:59 PM execution.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
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
        </Section>

        {/* 4. Royalty Income Tiers (Shopping/Matrix Turnover) */}
        <Section
          title="Shopping & Matrix Royalty Income Tiers"
          subtitle="Configure shopping & general network turnover pools, share percentages, and achievement threshold caps for Royalty Tiers"
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Tier 1 Card */}
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 16, background: "#f8fafc" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 4 }}>
                👑 Royalty Tier 1 (Level 1 to Level 7)
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                Applies to qualified members across L1 - L7 network
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input
                  label="Pool Share Percentage (%)"
                  type="number"
                  value={royaltyConfig.tier1_percent ?? 3}
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
                👑 Royalty Tier 2 (Level 10)
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                Applies to top tier leaders reaching Level 10
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input
                  label="Pool Share Percentage (%)"
                  type="number"
                  value={royaltyConfig.tier2_percent ?? 7}
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
                  label="Qualification Window (Days)"
                  type="number"
                  value={royaltyConfig.tier2_days ?? 7}
                  onChange={(val) => {
                    setRoyaltyConfig((prev) => ({ ...prev, tier2_days: Number(val) }));
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
    (activeTab === TABS.ACT150 && (mDirty || m150Dirty || mx150Dirty)) ||
    (activeTab === TABS.ACT750 && (mDirty || m750Dirty || mx750Dirty)) ||
    (activeTab === TABS.ACT759 && (m759Dirty || m759MonthlyDirty || mx759Dirty)) ||
    (activeTab === TABS.SPP1000 && sppDirty) ||
    (activeTab === TABS.ROYALTY && royaltyDirty) ||
    (activeTab === TABS.RANK_UPGRADE && rankDirty) ||
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
        if (mDirty) await onMasterSave();
        if (m150Dirty) await onM150Save();
        if (mx150Dirty) await onMx150Save();
      } else if (activeTab === TABS.ACT750) {
        if (mDirty) await onMasterSave();
        if (m750Dirty) await onM750Save();
        if (mx750Dirty) await onMx750Save();
      } else if (activeTab === TABS.ACT759) {
        if (m759Dirty || m759MonthlyDirty) await onM759Save();
        if (mx759Dirty) await onMx759Save();
      } else if (activeTab === TABS.SPP1000) {
        if (sppDirty) await handleSaveSppConfig();
      } else if (activeTab === TABS.ROYALTY) {
        if (royaltyDirty) await handleSaveRoyaltyConfig();
      } else if (activeTab === TABS.RANK_UPGRADE) {
        if (rankDirty) await handleSaveRankConfig();
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Commission Distribution</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Tab-based configuration without changing payout formulas. Package-specific overrides where supported.
          </div>
        </div>
        <SaveBtn
          onClick={onSaveAll}
          disabled={tabLoading}
          saving={anySaving}
          dirty={tabDirty}
          labelSaved="All Saved"
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {[
          { key: TABS.ACT150, label: "₹150 Activation" },
          { key: TABS.ACT750, label: "₹750 Activation" },
          { key: TABS.ACT759, label: "SPP" },
          { key: TABS.ROYALTY, label: "Royalty & Daily 11:59 PM Pools" },
          { key: TABS.WITHDRAW, label: "Withdrawal Commission" },
          { key: TABS.RANK_UPGRADE, label: "Rank Upgrade Config" },
        ].map((t) => (
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
