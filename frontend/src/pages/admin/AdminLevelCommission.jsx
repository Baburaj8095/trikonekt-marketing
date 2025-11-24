import React, { useEffect, useMemo, useState } from "react";
import { adminGetLevelCommission, adminUpdateLevelCommission, adminSeedLevelCommission } from "../../api/api";

export default function AdminLevelCommission() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [server, setServer] = useState(null); // { direct, l1..l5, updated_at }
  const [form, setForm] = useState({
    direct: "",
    l1: "",
    l2: "",
    l3: "",
    l4: "",
    l5: "",
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    setOk("");
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
        setServer({
          direct: toNum(vals.direct),
          l1: toNum(vals.l1),
          l2: toNum(vals.l2),
          l3: toNum(vals.l3),
          l4: toNum(vals.l4),
          l5: toNum(vals.l5),
          updated_at: data?.updated_at || null,
        });
        setForm(vals);
      })
      .catch((e) => {
        setErr(parseError(e) || "Failed to load commission config");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function toFixedStr(v, d = 2) {
    try {
      const n = Number(v);
      if (!isFinite(n)) return "";
      return n.toFixed(d);
    } catch {
      return "";
    }
  }
  function toNum(s) {
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }
  function parseError(e) {
    try {
      return e?.response?.data?.detail || e?.message || String(e);
    } catch {
      return "";
    }
  }

  function onChange(name, value) {
    // Allow empty string while typing; enforce numeric >= 0 when non-empty
    if (value === "") {
      setForm((f) => ({ ...f, [name]: "" }));
      return;
    }
    // Normalize value: keep up to 2 decimals, min 0
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    let norm = parts[0];
    if (parts.length > 1) {
      norm += "." + parts[1].slice(0, 2);
    }
    if (norm === "") norm = "0";
    const n = Number(norm);
    if (!isFinite(n) || n < 0) return;
    setForm((f) => ({ ...f, [name]: norm }));
  }

  const changedPayload = useMemo(() => {
    if (!server) return {};
    const out = {};
    const keys = ["direct", "l1", "l2", "l3", "l4", "l5"];
    keys.forEach((k) => {
      const cur = Number(form[k]);
      const base = Number(server[k]);
      if (isFinite(cur) && isFinite(base)) {
        // Compare at 2 decimals
        const curQ = Number(cur.toFixed(2));
        const baseQ = Number(base.toFixed(2));
        if (curQ !== baseQ) out[k] = curQ;
      }
    });
    return out;
  }, [server, form]);

  const isDirty = Object.keys(changedPayload).length > 0;

  async function onSave() {
    if (!isDirty || saving) return;
    setSaving(true);
    setErr("");
    setOk("");
    try {
      const data = await adminUpdateLevelCommission(changedPayload);
      // Refresh local copies from server response
      const vals = {
        direct: toFixedStr(data?.direct, 2),
        l1: toFixedStr(data?.l1, 2),
        l2: toFixedStr(data?.l2, 2),
        l3: toFixedStr(data?.l3, 2),
        l4: toFixedStr(data?.l4, 2),
        l5: toFixedStr(data?.l5, 2),
      };
      setServer({
        direct: toNum(vals.direct),
        l1: toNum(vals.l1),
        l2: toNum(vals.l2),
        l3: toNum(vals.l3),
        l4: toNum(vals.l4),
        l5: toNum(vals.l5),
        updated_at: data?.updated_at || null,
      });
      setForm(vals);
      setOk("Saved");
    } catch (e) {
      setErr(parseError(e) || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onSeed() {
    if (seeding) return;
    setSeeding(true);
    setErr("");
    setOk("");
    try {
      const res = await adminSeedLevelCommission();
      // Reload after seed
      const fresh = await adminGetLevelCommission();
      const vals = {
        direct: toFixedStr(fresh?.direct, 2),
        l1: toFixedStr(fresh?.l1, 2),
        l2: toFixedStr(fresh?.l2, 2),
        l3: toFixedStr(fresh?.l3, 2),
        l4: toFixedStr(fresh?.l4, 2),
        l5: toFixedStr(fresh?.l5, 2),
      };
      setServer({
        direct: toNum(vals.direct),
        l1: toNum(vals.l1),
        l2: toNum(vals.l2),
        l3: toNum(vals.l3),
        l4: toNum(vals.l4),
        l5: toNum(vals.l5),
        updated_at: fresh?.updated_at || null,
      });
      setForm(vals);
      setOk("Reset to defaults");
    } catch (e) {
      setErr(parseError(e) || "Reset failed");
    } finally {
      setSeeding(false);
    }
  }

  function Field({ label, name }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 200px" }}>
        <label htmlFor={name} style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
          {label}
        </label>
        <input
          id={name}
          name={name}
          type="number"
          step="0.01"
          min="0"
          value={form[name]}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder="0.00"
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Master Level Commission</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Configure fixed rupee amounts for Direct and L1–L5. Applies on referral join payouts.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onSeed}
            disabled={loading || seeding}
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid #0ea5e9",
              background: "#e0f2fe",
              color: "#0369a1",
              fontWeight: 800,
              cursor: loading || seeding ? "not-allowed" : "pointer",
            }}
            title="Reset to defaults {15, 2, 1, 1, 0.5, 0.5}"
          >
            {seeding ? "Resetting..." : "Reset Defaults"}
          </button>
          <button
            onClick={onSave}
            disabled={loading || saving || !isDirty}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "1px solid #0b8d2b",
              background: isDirty ? "#10b981" : "#86efac",
              color: "#052e16",
              fontWeight: 900,
              cursor: loading || saving || !isDirty ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
          </button>
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

      <div
        style={{
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          padding: 16,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        {loading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Field label="Direct (₹)" name="direct" />
              <Field label="Level 1 (₹)" name="l1" />
              <Field label="Level 2 (₹)" name="l2" />
              <Field label="Level 3 (₹)" name="l3" />
              <Field label="Level 4 (₹)" name="l4" />
              <Field label="Level 5 (₹)" name="l5" />
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
              Last updated:{" "}
              {server?.updated_at
                ? new Date(server.updated_at).toLocaleString()
                : "—"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
