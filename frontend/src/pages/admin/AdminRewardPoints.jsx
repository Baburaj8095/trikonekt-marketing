import React, { useEffect, useMemo, useState } from "react";
import { adminGetRewardPointsConfig, adminUpdateRewardPointsConfig } from "../../api/api";

function Section({ title, subtitle, right, children }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", marginBottom: 12, overflow: "hidden" }}>
      <div style={{ padding: 10, background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>{title}</div>
          {subtitle ? <div style={{ color: "#64748b", fontSize: 12 }}>{subtitle}</div> : null}
        </div>
        {right || null}
      </div>
      <div style={{ padding: 12 }}>
        {children}
      </div>
    </div>
  );
}

function numberOrEmpty(v) {
  const s = String(v ?? "").trim();
  if (s === "") return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

export default function AdminRewardPoints() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Config shape: { tiers: [{count, points}, ...], after: { base_count, per_coupon }, updated_at? }
  const [config, setConfig] = useState({ tiers: [], after: { base_count: 5, per_coupon: 20000 } });

  const defaults = useMemo(() => ({
    tiers: [
      { count: 1, points: 1000 },
      { count: 2, points: 10000 },
      { count: 3, points: 30000 },
      { count: 4, points: 60000 },
      { count: 5, points: 110000 },
    ],
    after: { base_count: 5, per_coupon: 20000 },
  }), []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    setOk("");
    adminGetRewardPointsConfig()
      .then((data) => {
        if (!mounted) return;
        // basic sanitize
        const tiers = Array.isArray(data?.tiers) ? data.tiers : defaults.tiers;
        const after = data?.after && typeof data.after === "object" ? data.after : defaults.after;
        setConfig({
          tiers: tiers.map((t) => ({ count: Number(t.count) || 0, points: Number(t.points) || 0 })),
          after: { base_count: Number(after.base_count) || 5, per_coupon: Number(after.per_coupon) || 0 },
          updated_at: data?.updated_at || null,
        });
      })
      .catch(() => {
        if (!mounted) return;
        setErr("Failed to load Reward Points config");
        setConfig(defaults);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [defaults]);

  const onChangeTier = (idx, key, value) => {
    setOk("");
    setErr("");
    setConfig((prev) => {
      const tiers = [...(prev.tiers || [])];
      const current = { ...(tiers[idx] || { count: "", points: "" }) };
      current[key] = numberOrEmpty(value);
      tiers[idx] = current;
      return { ...prev, tiers };
    });
  };

  const addTier = () => {
    setOk("");
    setErr("");
    setConfig((prev) => {
      const tiers = [...(prev.tiers || [])];
      const maxCount = tiers.reduce((m, t) => Math.max(m, Number(t.count) || 0), 0);
      tiers.push({ count: maxCount + 1, points: 0 });
      return { ...prev, tiers };
    });
  };

  const removeTier = (idx) => {
    setOk("");
    setErr("");
    setConfig((prev) => {
      const tiers = [...(prev.tiers || [])];
      tiers.splice(idx, 1);
      return { ...prev, tiers };
    });
  };

  const onChangeAfter = (key, value) => {
    setOk("");
    setErr("");
    setConfig((prev) => ({
      ...prev,
      after: { ...(prev.after || {}), [key]: numberOrEmpty(value) },
    }));
  };

  const resetDefaults = () => {
    setOk("");
    setErr("");
    setConfig(defaults);
  };

  const validate = () => {
    // Validate tiers: non-empty, counts >=1, points >=0, unique counts
    const tiers = (config.tiers || []).map((t) => ({ count: Number(t.count), points: Number(t.points) }));
    if (!tiers.length) return "At least one tier is required";
    for (const t of tiers) {
      if (!Number.isFinite(t.count) || t.count < 1) return "Each tier count must be an integer >= 1";
      if (!Number.isFinite(t.points) || t.points < 0) return "Each tier points must be >= 0";
    }
    const counts = new Set(tiers.map((t) => t.count));
    if (counts.size !== tiers.length) return "Tier counts must be unique";
    const sorted = [...tiers].sort((a, b) => a.count - b.count);

    // Validate after
    const base_count = Number(config.after?.base_count);
    const per_coupon = Number(config.after?.per_coupon);
    if (!Number.isFinite(base_count) || base_count < sorted[sorted.length - 1].count) {
      return `After base_count must be >= max tier count (${sorted[sorted.length - 1].count})`;
    }
    if (!Number.isFinite(per_coupon) || per_coupon < 0) return "After per_coupon must be >= 0";
    return null;
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    setOk("");
    const msg = validate();
    if (msg) {
      setErr(msg);
      setSaving(false);
      return;
    }
    // Normalize payload
    const tiers = [...(config.tiers || [])]
      .map((t) => ({ count: Number(t.count), points: Number(t.points) }))
      .sort((a, b) => a.count - b.count);
    const payload = {
      tiers,
      after: {
        base_count: Number(config.after?.base_count),
        per_coupon: Number(config.after?.per_coupon),
      },
    };
    try {
      const res = await adminUpdateRewardPointsConfig(payload);
      setOk("Saved");
      // reflect any canonicalized values from server
      if (res && typeof res === "object") {
        setConfig({
          tiers: (res.tiers || []).map((t) => ({ count: Number(t.count), points: Number(t.points) })),
          after: { base_count: Number(res.after?.base_count) || payload.after.base_count, per_coupon: Number(res.after?.per_coupon) || payload.after.per_coupon },
          updated_at: res.updated_at || new Date().toISOString(),
        });
      }
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || "Failed to save";
      setErr(detail);
    } finally {
      setSaving(false);
    }
  };

  const maxTierCount = useMemo(() => {
    return (config.tiers || []).reduce((m, t) => Math.max(m, Number(t.count) || 0), 0);
  }, [config.tiers]);

  return (
    <div>
      {/* Page heading */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 900 }}>Rewards Points Configuration</h2>
          <span style={{ color: "#64748b", fontSize: 12 }}>Configurable tiers and per-coupon schedule</span>
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {config.updated_at ? `Updated: ${new Date(config.updated_at).toLocaleString()}` : ""}
        </div>
      </div>

      {loading ? <div style={{ color: "#64748b" }}>Loading...</div> : null}
      {err ? (
        <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>
          {err}
        </div>
      ) : null}
      {ok ? (
        <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 700 }}>
          {ok}
        </div>
      ) : null}

      <Section
        title="Tiers"
        subtitle="Define points awarded at specific coupon counts. Counts must be unique and >= 1."
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addTier} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", fontWeight: 800, cursor: "pointer" }}>
              + Add Tier
            </button>
            <button onClick={resetDefaults} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #eab308", background: "#fffbeb", color: "#92400e", fontWeight: 800, cursor: "pointer" }}>
              Reset Defaults
            </button>
          </div>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 800, fontSize: 12 }}>#</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 800, fontSize: 12 }}>Count</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 800, fontSize: 12 }}>Points</th>
                <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e2e8f0" }}></th>
              </tr>
            </thead>
            <tbody>
              {(config.tiers || []).map((t, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>
                    <input
                      type="number"
                      min={1}
                      value={t.count}
                      onChange={(e) => onChangeTier(idx, "count", e.target.value)}
                      style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: 140 }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0" }}>
                    <input
                      type="number"
                      min={0}
                      value={t.points}
                      onChange={(e) => onChangeTier(idx, "points", e.target.value)}
                      style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: 180 }}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                    <button
                      onClick={() => removeTier(idx)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontWeight: 800, cursor: "pointer" }}
                      aria-label="Remove tier"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {(config.tiers || []).length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, color: "#64748b" }}>
                    No tiers configured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="After Base" subtitle="After reaching base_count, award per_coupon points for every additional coupon.">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#475569", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Base Count</div>
            <input
              type="number"
              min={maxTierCount || 1}
              value={config.after?.base_count ?? ""}
              onChange={(e) => onChangeAfter("base_count", e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: 180 }}
            />
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
              Must be ≥ max tier count ({maxTierCount || 1})
            </div>
          </div>
          <div>
            <div style={{ color: "#475569", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Per Coupon Points</div>
            <input
              type="number"
              min={0}
              value={config.after?.per_coupon ?? ""}
              onChange={(e) => onChangeAfter("per_coupon", e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, width: 220 }}
            />
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
              Points credited for each coupon beyond Base Count
            </div>
          </div>
        </div>
      </Section>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #93c5fd",
            background: saving ? "#dbeafe" : "#eff6ff",
            color: "#1d4ed8",
            fontWeight: 900,
            cursor: "pointer",
            minWidth: 120,
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={resetDefaults}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            fontWeight: 900,
            cursor: "pointer",
            minWidth: 120,
          }}
        >
          Reset Defaults
        </button>
      </div>
    </div>
  );
}
