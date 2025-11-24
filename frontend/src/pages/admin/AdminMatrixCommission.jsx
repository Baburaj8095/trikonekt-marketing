import React, { useEffect, useMemo, useState } from "react";
import { adminGetMatrixCommissionConfig, adminUpdateMatrixCommissionConfig } from "../../api/api";

function Section({ title, children, extraRight }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "10px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, color: "#0f172a" }}>{title}</div>
        {extraRight || null}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          outline: "none",
          background: "#fff",
        }}
      />
    </div>
  );
}

function Pill({ children, color = "#0ea5e9" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 8px",
        borderRadius: 999,
        background: "rgba(14,165,233,0.12)",
        border: "1px solid rgba(14,165,233,0.35)",
        color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function parseArray(input) {
  // Accept JSON array string or comma/space separated list
  if (input == null) return [];
  const s = String(input).trim();
  if (!s) return [];
  try {
    const asJson = JSON.parse(s);
    if (Array.isArray(asJson)) return asJson.map((v) => Number(v));
  } catch (_) {}
  // fallback CSV
  return s
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((v) => Number(v));
}

function toCSV(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.join(", ");
}

export default function AdminMatrixCommission() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Raw config from server
  const [cfg, setCfg] = useState(null);

  // Form state
  const [fiveLevels, setFiveLevels] = useState("6");
  const [fiveAmounts, setFiveAmounts] = useState("");
  const [fivePercents, setFivePercents] = useState("");

  const [threeLevels, setThreeLevels] = useState("15");
  const [threeAmounts, setThreeAmounts] = useState("");
  const [threePercents, setThreePercents] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    setOk("");
    try {
      const data = await adminGetMatrixCommissionConfig();
      setCfg(data || {});
      setFiveLevels(String(data?.five_matrix_levels ?? 6));
      setThreeLevels(String(data?.three_matrix_levels ?? 15));
      setFiveAmounts(toCSV(data?.five_matrix_amounts_json || []));
      setFivePercents(toCSV(data?.five_matrix_percents_json || []));
      setThreeAmounts(toCSV(data?.three_matrix_amounts_json || []));
      setThreePercents(toCSV(data?.three_matrix_percents_json || []));
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load config");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const examples = useMemo(
    () => ({
      fiveAmounts: "15, 2, 2.5, 0.5, 0.05, 0.1",
      threePercents: "10, 5, 3, 2, 1, 1, 1, 0.5, 0.5, 0.2, 0.2, 0.1, 0.1, 0.05, 0.05",
    }),
    []
  );

  async function save() {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      const payload = {};

      // Coerce levels
      const fL = parseInt(String(fiveLevels || "").trim() || "0", 10);
      const tL = parseInt(String(threeLevels || "").trim() || "0", 10);
      if (!Number.isNaN(fL) && fL > 0) payload.five_matrix_levels = fL;
      if (!Number.isNaN(tL) && tL > 0) payload.three_matrix_levels = tL;

      // Arrays
      const fAmt = parseArray(fiveAmounts);
      const fPct = parseArray(fivePercents);
      const tAmt = parseArray(threeAmounts);
      const tPct = parseArray(threePercents);

      if (fAmt.length) payload.five_matrix_amounts_json = fAmt;
      if (fPct.length) payload.five_matrix_percents_json = fPct;
      if (tAmt.length) payload.three_matrix_amounts_json = tAmt;
      if (tPct.length) payload.three_matrix_percents_json = tPct;

      const data = await adminUpdateMatrixCommissionConfig(payload);
      setCfg(data || {});
      setOk("Configuration updated");
      // Refresh form from server response
      setFiveLevels(String((data?.five_matrix_levels ?? fL) || ""));
      setThreeLevels(String((data?.three_matrix_levels ?? tL) || ""));
      setFiveAmounts(toCSV(data?.five_matrix_amounts_json || fAmt));
      setFivePercents(toCSV(data?.five_matrix_percents_json || fPct));
      setThreeAmounts(toCSV(data?.three_matrix_amounts_json || tAmt));
      setThreePercents(toCSV(data?.three_matrix_percents_json || tPct));
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "object" ? JSON.stringify(e.response.data) : e?.message) ||
        "Failed to update";
      setErr(String(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Matrix Commission</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Configure 5‑Matrix (FIVE_150) and 3‑Matrix (THREE_50/THREE_150) level-wise payouts. Amount arrays override percents when present.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#0f172a",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Reload"}
        </button>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 12px",
            background: "#2563eb",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {ok ? <span style={{ color: "#059669", fontWeight: 700 }}>{ok}</span> : null}
        {err ? <span style={{ color: "#dc2626" }}>{err}</span> : null}
      </div>

      <Section
        title="5‑Matrix (FIVE_150)"
        extraRight={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill>Levels: {fiveLevels || "-"}</Pill>
          </div>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          <TextInput
            label="Levels"
            value={fiveLevels}
            onChange={setFiveLevels}
            placeholder="e.g. 6"
            type="number"
          />
          <TextInput
            label="Fixed Amounts per level (₹) [overrides percents]"
            value={fiveAmounts}
            onChange={setFiveAmounts}
            placeholder={`e.g. ${examples.fiveAmounts}`}
          />
          <TextInput
            label="Percents per level (%) [used when amounts empty]"
            value={fivePercents}
            onChange={setFivePercents}
            placeholder="e.g. 10, 5, 3, 2, 1, 1"
          />
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Tip: Enter JSON array or comma separated values. Amounts take precedence over percents.
        </div>
      </Section>

      <Section
        title="3‑Matrix (THREE_50 / THREE_150)"
        extraRight={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill>Levels: {threeLevels || "-"}</Pill>
          </div>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          <TextInput
            label="Levels"
            value={threeLevels}
            onChange={setThreeLevels}
            placeholder="e.g. 15"
            type="number"
          />
          <TextInput
            label="Fixed Amounts per level (₹) [overrides percents]"
            value={threeAmounts}
            onChange={setThreeAmounts}
            placeholder="e.g. 5, 3, 2, 2, 1, 1, 1, 0.5, ..."
          />
          <TextInput
            label="Percents per level (%) [used when amounts empty]"
            value={threePercents}
            onChange={setThreePercents}
            placeholder={`e.g. ${examples.threePercents}`}
          />
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Base for percent distribution is 50 for THREE_50 by default.
        </div>
      </Section>
    </div>
  );
}
