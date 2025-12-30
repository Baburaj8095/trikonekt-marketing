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
function Input({ label, value, onChange, step = "0.01", min = "0", placeholder = "0.00", type = "number" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 180px" }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{label}</label>
      <input
        type={type}
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 36,
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          padding: "0 10px",
          background: "#fff",
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

export default function AdminCommissionDistribute() {
  // Global page messages
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // 1) Master Commission (percents, company, geo)
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
        };
        setMServer({
          tax_percent: toNum(vals.tax_percent),
          withdrawal_sponsor_percent: toNum(vals.withdrawal_sponsor_percent),
          tax_company_user_id: cuId ? Number(cuId) : null,
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

  async function onMasterSave() {
    if (!mDirty || mSaving) return;
    setMSaving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMasterCommission(mChangedPayload);
      // Refresh local state similar to GET
      const tax = toFixedStr(data?.tax?.percent ?? 0, 2);
      const wd = toFixedStr(data?.withdrawal?.sponsor_percent ?? 0, 2);
      const cuId = data?.company_user?.id ?? "";
      const up = data?.upline || {};
      const geo = data?.geo || {};
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
      };
      setMServer({
        tax_percent: toNum(vals.tax_percent),
        withdrawal_sponsor_percent: toNum(vals.withdrawal_sponsor_percent),
        tax_company_user_id: cuId ? Number(cuId) : null,
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
      setOk("Master Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (Master Commission)");
    } finally {
      setMSaving(false);
    }
  }

  // 2) Fixed Level Commission (rupees)
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

  // 3) Matrix Commission
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
        const fiveLevels = Number(d?.five_matrix_levels ?? 0) || 0;
        const fiveAmounts = Array.isArray(d?.five_matrix_amounts_json) ? d.five_matrix_amounts_json : [];
        const fivePercs = Array.isArray(d?.five_matrix_percents_json) ? d.five_matrix_percents_json : [];
        const threeLevels = Number(d?.three_matrix_levels ?? 0) || 0;
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

  // 3b) Product-specific Overrides — 150 Coupon (Geo + Matrix)
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
  });

  useEffect(() => {
    let mounted = true;
    setM150Loading(true);
    adminGetMasterCommission(PRODUCT_COUPON_150)
      .then((data) => {
        if (!mounted) return;
        const geo = data?.geo || {};
        const vals = {
          geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
          geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
          geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
          geo_district: toFixedStr(geo.district ?? 0, 2),
          geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
          geo_state: toFixedStr(geo.state ?? 0, 2),
          geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
          geo_employee: toFixedStr(geo.employee ?? 0, 2),
          geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
        };
        setM150Server({
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
        setM150Form(vals);
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
      });
      setM150Form(vals);
      setOk("150 Coupon Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (150 Coupon Commission)");
    } finally {
      setM150Saving(false);
    }
  }

  // Matrix overrides — 150 Coupon
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
        const fiveLevels = Number(d?.five_matrix_levels ?? 0) || 0;
        const fiveAmounts = Array.isArray(d?.five_matrix_amounts_json) ? d.five_matrix_amounts_json : [];
        const fivePercs = Array.isArray(d?.five_matrix_percents_json) ? d.five_matrix_percents_json : [];
        const threeLevels = Number(d?.three_matrix_levels ?? 0) || 0;
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

  // 3c) Product-specific Overrides — ₹759 (Geo + Matrix)
  const [m759Loading, setM759Loading] = useState(true);
  const [m759Saving, setM759Saving] = useState(false);
  const [m759Server, setM759Server] = useState(null);
  const [m759Form, setM759Form] = useState({
    geo_sub_franchise: "",
    geo_pincode: "",
    geo_pincode_coord: "",
    geo_district: "",
    geo_district_coord: "",
    geo_state: "",
    geo_state_coord: "",
    geo_employee: "",
    geo_royalty: "",
  });

  useEffect(() => {
    let mounted = true;
    setM759Loading(true);
    adminGetMasterCommission(PRODUCT_RS_759)
      .then((data) => {
        if (!mounted) return;
        const geo = data?.geo || {};
        const vals = {
          geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
          geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
          geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
          geo_district: toFixedStr(geo.district ?? 0, 2),
          geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
          geo_state: toFixedStr(geo.state ?? 0, 2),
          geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
          geo_employee: toFixedStr(geo.employee ?? 0, 2),
          geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
        };
        setM759Server({
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
        setM759Form(vals);
      })
      .catch((e) => setErr(parseError(e) || "Failed to load ₹759 Geo Commission"))
      .finally(() => mounted && setM759Loading(false));
    return () => {
      mounted = false;
    };
  }, []);

  function onM759Change(name, value) {
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
    return out;
  }, [m759Server, m759Form]);
  const m759Dirty = Object.keys(m759ChangedPayload).length > 0;

  async function onM759Save() {
    if (!m759Dirty || m759Saving) return;
    setM759Saving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateMasterCommission(m759ChangedPayload, PRODUCT_RS_759);
      const geo = data?.geo || {};
      const vals = {
        geo_sub_franchise: toFixedStr(geo.sub_franchise ?? 0, 2),
        geo_pincode: toFixedStr(geo.pincode ?? 0, 2),
        geo_pincode_coord: toFixedStr(geo.pincode_coord ?? 0, 2),
        geo_district: toFixedStr(geo.district ?? 0, 2),
        geo_district_coord: toFixedStr(geo.district_coord ?? 0, 2),
        geo_state: toFixedStr(geo.state ?? 0, 2),
        geo_state_coord: toFixedStr(geo.state_coord ?? 0, 2),
        geo_employee: toFixedStr(geo.employee ?? 0, 2),
        geo_royalty: toFixedStr(geo.royalty ?? 0, 2),
      };
      setM759Server({
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
      setM759Form(vals);
      setOk("₹759 Geo Commission saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed (₹759 Geo Commission)");
    } finally {
      setM759Saving(false);
    }
  }

  // Matrix overrides — ₹759
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
        const fiveLevels = Number(d?.five_matrix_levels ?? 0) || 0;
        const fiveAmounts = Array.isArray(d?.five_matrix_amounts_json) ? d.five_matrix_amounts_json : [];
        const fivePercs = Array.isArray(d?.five_matrix_percents_json) ? d.five_matrix_percents_json : [];
        const threeLevels = Number(d?.three_matrix_levels ?? 0) || 0;
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
      onClick={onClick}
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Commission Distribute</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Single screen to manage all commission settings (consumer & agency levels) and preview Direct Refer Withdraw distribution.
          </div>
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

      {/* Master Commission */}
      <Section
        title="Master Commission (Percent & Geo)"
        subtitle="Tax %, Direct Refer Withdraw sponsor %, company user, upline percents and geo distribution for agencies."
        right={
          <button
            onClick={onMasterSave}
            disabled={mLoading || mSaving || !mDirty}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid #0b8d2b",
              background: mDirty ? "#10b981" : "#86efac",
              color: "#052e16",
              fontWeight: 900,
              cursor: mLoading || mSaving || !mDirty ? "not-allowed" : "pointer",
            }}
          >
            {mSaving ? "Saving..." : mDirty ? "Save Changes" : "Saved"}
          </button>
        }
      >
        {mLoading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input label="Tax Percent (%)" value={mForm.tax_percent} onChange={(v) => onMChange("tax_percent", v)} />
              <Input
                label="Withdrawal Sponsor Percent (%)"
                value={mForm.withdrawal_sponsor_percent}
                onChange={(v) => onMChange("withdrawal_sponsor_percent", v)}
              />
              <Input
                label="Tax Company User ID"
                type="text"
                step="1"
                min="0"
                placeholder=""
                value={mForm.tax_company_user_id}
                onChange={(v) => onMChange("tax_company_user_id", v)}
              />
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#0f172a", fontWeight: 800 }}>Upline Percents (L1–L5)</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input label="L1 (%)" value={mForm.upline_l1} onChange={(v) => onMChange("upline_l1", v)} />
              <Input label="L2 (%)" value={mForm.upline_l2} onChange={(v) => onMChange("upline_l2", v)} />
              <Input label="L3 (%)" value={mForm.upline_l3} onChange={(v) => onMChange("upline_l3", v)} />
              <Input label="L4 (%)" value={mForm.upline_l4} onChange={(v) => onMChange("upline_l4", v)} />
              <Input label="L5 (%)" value={mForm.upline_l5} onChange={(v) => onMChange("upline_l5", v)} />
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#0f172a", fontWeight: 800 }}>Geo (Agency) Percents</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input label="Sub Franchise (%)" value={mForm.geo_sub_franchise} onChange={(v) => onMChange("geo_sub_franchise", v)} />
              <Input label="Pincode (%)" value={mForm.geo_pincode} onChange={(v) => onMChange("geo_pincode", v)} />
              <Input label="Pincode Coordinator (%)" value={mForm.geo_pincode_coord} onChange={(v) => onMChange("geo_pincode_coord", v)} />
              <Input label="District (%)" value={mForm.geo_district} onChange={(v) => onMChange("geo_district", v)} />
              <Input label="District Coordinator (%)" value={mForm.geo_district_coord} onChange={(v) => onMChange("geo_district_coord", v)} />
              <Input label="State (%)" value={mForm.geo_state} onChange={(v) => onMChange("geo_state", v)} />
              <Input label="State Coordinator (%)" value={mForm.geo_state_coord} onChange={(v) => onMChange("geo_state_coord", v)} />
              <Input label="Employee (%)" value={mForm.geo_employee} onChange={(v) => onMChange("geo_employee", v)} />
              <Input label="Royalty (%)" value={mForm.geo_royalty} onChange={(v) => onMChange("geo_royalty", v)} />
            </div>
          </>
        )}
      </Section>

      {/* Fixed Level Commission */}
      <Section
        title="Fixed Level Commission (₹)"
        subtitle="Configure rupee amounts for Direct and L1–L5 (referral join payouts)."
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onLSeed}
              disabled={lLoading || lSeeding}
              style={{
                height: 36,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid #0ea5e9",
                background: "#e0f2fe",
                color: "#0369a1",
                fontWeight: 800,
                cursor: lLoading || lSeeding ? "not-allowed" : "pointer",
              }}
              title="Reset to defaults {15, 2, 1, 1, 0.5, 0.5}"
            >
              {lSeeding ? "Resetting..." : "Reset Defaults"}
            </button>
            <button
              onClick={onLSave}
              disabled={lLoading || lSaving || !lDirty}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid #0b8d2b",
                background: lDirty ? "#10b981" : "#86efac",
                color: "#052e16",
                fontWeight: 900,
                cursor: lLoading || lSaving || !lDirty ? "not-allowed" : "pointer",
              }}
            >
              {lSaving ? "Saving..." : lDirty ? "Save Changes" : "Saved"}
            </button>
          </div>
        }
      >
        {lLoading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Input label="Direct (₹)" value={lForm.direct} onChange={(v) => onLChange("direct", v)} />
              <Input label="Level 1 (₹)" value={lForm.l1} onChange={(v) => onLChange("l1", v)} />
              <Input label="Level 2 (₹)" value={lForm.l2} onChange={(v) => onLChange("l2", v)} />
              <Input label="Level 3 (₹)" value={lForm.l3} onChange={(v) => onLChange("l3", v)} />
              <Input label="Level 4 (₹)" value={lForm.l4} onChange={(v) => onLChange("l4", v)} />
              <Input label="Level 5 (₹)" value={lForm.l5} onChange={(v) => onLChange("l5", v)} />
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
              Last updated: {lServer?.updated_at ? new Date(lServer.updated_at).toLocaleString() : "—"}
            </div>
          </>
        )}
      </Section>

      {/* Matrix Commission */}
      <Section
        title="Matrix Commission (5-Matrix & 3-Matrix)"
        subtitle="Edit levels and arrays (comma-separated numbers). Amounts in ₹, Percents in %."
        right={
          <button
            onClick={onMxSave}
            disabled={mxLoading || mxSaving || !mxDirty}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid #0b8d2b",
              background: mxDirty ? "#10b981" : "#86efac",
              color: "#052e16",
              fontWeight: 900,
              cursor: mxLoading || mxSaving || !mxDirty ? "not-allowed" : "pointer",
            }}
          >
            {mxSaving ? "Saving..." : mxDirty ? "Save Changes" : "Saved"}
          </button>
        }
      >
        {mxLoading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input label="5-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 6" value={mxForm.five_levels} onChange={(v) => onMxChange("five_levels", v)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>5-Matrix Amounts (₹, CSV)</label>
                <textarea
                  value={mxForm.five_amounts}
                  onChange={(e) => onMxChange("five_amounts", e.target.value)}
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
                  value={mxForm.five_percents}
                  onChange={(e) => onMxChange("five_percents", e.target.value)}
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
              <Input label="3-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 15" value={mxForm.three_levels} onChange={(v) => onMxChange("three_levels", v)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 380px" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>3-Matrix Amounts (₹, CSV)</label>
                <textarea
                  value={mxForm.three_amounts}
                  onChange={(e) => onMxChange("three_amounts", e.target.value)}
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
                  value={mxForm.three_percents}
                  onChange={(e) => onMxChange("three_percents", e.target.value)}
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

      {/* Product Overrides — 150 Coupon */}
      <Section
        title="150 Coupon — Commission Overrides"
        subtitle="Specific overrides for 150 Coupon product. Empty values imply global defaults."
      >
        {/* 150 Direct Bonuses (₹) */}
        <SubHeader
          title="Direct Referral Bonuses (₹) — 150 Coupon"
          right={
            <SaveBtn
              onClick={onM150Save}
              disabled={m150Loading}
              saving={m150Saving}
              dirty={m150Dirty}
            />
          }
        />
        {m150Loading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <Input label="Sponsor (₹)" value={m150Form.direct_bonus_sponsor} onChange={(v) => onM150Change("direct_bonus_sponsor", v)} />
            <Input label="Self (₹)" value={m150Form.direct_bonus_self} onChange={(v) => onM150Change("direct_bonus_self", v)} />
          </div>
        )}

        {/* 150 Geo */}
        <SubHeader
          title="Geo (Agency) — 150 Coupon"
          right={
            <SaveBtn
              onClick={onM150Save}
              disabled={m150Loading}
              saving={m150Saving}
              dirty={m150Dirty}
            />
          }
        />
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
              <Input label="Royalty (%)" value={m150Form.geo_royalty} onChange={(v) => onM150Change("geo_royalty", v)} />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Geo Mode</label>
              <select
                value={m150Form.geo_mode || ""}
                onChange={(e) => onM150Change("geo_mode", e.target.value)}
                style={{ height: 36, borderRadius: 8, border: "1px solid #e2e8f0", padding: "0 10px", fontWeight: 700 }}
              >
                <option value="">—</option>
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
              <Input label="Royalty (₹)" value={m150Form.geo_fixed_royalty} onChange={(v) => onM150Change("geo_fixed_royalty", v)} />
            </div>
          </>
        )}

        {/* 150 Matrix */}
        <SubHeader
          title="Matrix Commission (5 & 3) — 150 Coupon"
          right={
            <SaveBtn
              onClick={onMx150Save}
              disabled={mx150Loading}
              saving={mx150Saving}
              dirty={mx150Dirty}
            />
          }
        />
        {mx150Loading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input label="5-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 6" value={mx150Form.five_levels} onChange={(v) => onMx150Change("five_levels", v)} />
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

      {/* Product Overrides — ₹759 */}
      <Section
        title="₹759 — Commission Overrides"
        subtitle="Specific overrides for ₹759 product. Empty values imply global defaults."
      >
        {/* 759 Geo */}
        <SubHeader
          title="Geo (Agency) Percents — ₹759"
          right={
            <SaveBtn
              onClick={onM759Save}
              disabled={m759Loading}
              saving={m759Saving}
              dirty={m759Dirty}
            />
          }
        />
        {m759Loading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <Input label="Sub Franchise (%)" value={m759Form.geo_sub_franchise} onChange={(v) => onM759Change("geo_sub_franchise", v)} />
            <Input label="Pincode (%)" value={m759Form.geo_pincode} onChange={(v) => onM759Change("geo_pincode", v)} />
            <Input label="Pincode Coordinator (%)" value={m759Form.geo_pincode_coord} onChange={(v) => onM759Change("geo_pincode_coord", v)} />
            <Input label="District (%)" value={m759Form.geo_district} onChange={(v) => onM759Change("geo_district", v)} />
            <Input label="District Coordinator (%)" value={m759Form.geo_district_coord} onChange={(v) => onM759Change("geo_district_coord", v)} />
            <Input label="State (%)" value={m759Form.geo_state} onChange={(v) => onM759Change("geo_state", v)} />
            <Input label="State Coordinator (%)" value={m759Form.geo_state_coord} onChange={(v) => onM759Change("geo_state_coord", v)} />
            <Input label="Employee (%)" value={m759Form.geo_employee} onChange={(v) => onM759Change("geo_employee", v)} />
            <Input label="Royalty (%)" value={m759Form.geo_royalty} onChange={(v) => onM759Change("geo_royalty", v)} />
          </div>
        )}

        {/* 759 Matrix */}
        <SubHeader
          title="Matrix Commission (5 & 3) — ₹759"
          right={
            <SaveBtn
              onClick={onMx759Save}
              disabled={mx759Loading}
              saving={mx759Saving}
              dirty={mx759Dirty}
            />
          }
        />
        {mx759Loading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <Input label="5-Matrix Levels" type="text" step="1" min="0" placeholder="e.g. 6" value={mx759Form.five_levels} onChange={(v) => onMx759Change("five_levels", v)} />
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

      {/* Withdraw Distribution Preview */}
      <Section
        title="Direct Refer Withdraw — Distribution Preview"
        subtitle="Enter a user (ID or username) and amount to see the sponsor bonus, TDS/company pool, and net to user."
        right={
          <button
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
                          : "—"}
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
