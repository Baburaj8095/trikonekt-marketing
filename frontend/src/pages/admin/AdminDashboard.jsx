import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";
import { getAdminMeta } from "../../admin-panel/api/adminMeta";

function paletteStyles(key) {
  // Solid, high-contrast gradients for colored cards with elevated shadows
  switch (key) {
    case "indigo":
      return {
        bg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        border: "rgba(99,102,241,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(99,102,241,0.32)",
        hoverShadow: "0 14px 30px rgba(99,102,241,0.38)",
      };
    case "blue":
      return {
        bg: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)",
        border: "rgba(59,130,246,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(59,130,246,0.32)",
        hoverShadow: "0 14px 30px rgba(59,130,246,0.38)",
      };
    case "green":
      return {
        bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
        border: "rgba(16,185,129,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(16,185,129,0.32)",
        hoverShadow: "0 14px 30px rgba(16,185,129,0.38)",
      };
    case "red":
      return {
        bg: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
        border: "rgba(244,63,94,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(244,63,94,0.32)",
        hoverShadow: "0 14px 30px rgba(244,63,94,0.38)",
      };
    case "amber":
      return {
        bg: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
        border: "rgba(245,158,11,0.35)",
        text: "#0f172a",
        sub: "rgba(15,23,42,0.8)",
        shadow: "0 10px 24px rgba(245,158,11,0.30)",
        hoverShadow: "0 14px 30px rgba(245,158,11,0.36)",
      };
    case "purple":
      return {
        bg: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
        border: "rgba(168,85,247,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(168,85,247,0.32)",
        hoverShadow: "0 14px 30px rgba(168,85,247,0.38)",
      };
    case "pink":
      return {
        bg: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
        border: "rgba(236,72,153,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(236,72,153,0.32)",
        hoverShadow: "0 14px 30px rgba(236,72,153,0.38)",
      };
    case "teal":
      return {
        bg: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
        border: "rgba(20,184,166,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(20,184,166,0.32)",
        hoverShadow: "0 14px 30px rgba(20,184,166,0.38)",
      };
    case "cyan":
      return {
        bg: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
        border: "rgba(6,182,212,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(6,182,212,0.32)",
        hoverShadow: "0 14px 30px rgba(6,182,212,0.38)",
      };
    case "lime":
      return {
        bg: "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
        border: "rgba(132,204,22,0.35)",
        text: "#0f172a",
        sub: "rgba(15,23,42,0.8)",
        shadow: "0 10px 24px rgba(132,204,22,0.30)",
        hoverShadow: "0 14px 30px rgba(132,204,22,0.36)",
      };
    case "orange":
      return {
        bg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
        border: "rgba(249,115,22,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(249,115,22,0.32)",
        hoverShadow: "0 14px 30px rgba(249,115,22,0.38)",
      };
    case "rose":
      return {
        bg: "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
        border: "rgba(251,113,133,0.35)",
        text: "#ffffff",
        sub: "rgba(255,255,255,0.92)",
        shadow: "0 10px 24px rgba(251,113,133,0.30)",
        hoverShadow: "0 14px 30px rgba(251,113,133,0.36)",
      };
    default:
      return {
        bg: "#ffffff",
        border: "#e2e8f0",
        text: "#0f172a",
        sub: "#64748b",
        shadow: "0 6px 14px rgba(15,23,42,0.10)",
        hoverShadow: "0 12px 24px rgba(15,23,42,0.16)",
      };
  }
}

const paletteOrder = ["indigo", "blue", "green", "red", "amber", "purple", "pink", "teal", "cyan", "lime", "orange", "rose"];

function hashIndex(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i); // h * 33 + c
  }
  return Math.abs(h);
}
function choosePaletteForModel(app, model) {
  const key = `${String(app || "")}.${String(model || "")}`.toLowerCase();
  return paletteOrder[hashIndex(key) % paletteOrder.length];
}

function Card({ title, value, subtitle, onClick, palette = "blue" }) {
  const pal = paletteStyles(palette);
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        cursor: onClick ? "pointer" : "default",
        background: pal.bg,
        border: `1px solid ${pal.border}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: pal.shadow,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "transform 120ms ease, box-shadow 120ms ease",
        color: pal.text,
        minHeight: 104,
      }}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = pal.hoverShadow || "0 12px 24px rgba(15,23,42,0.16)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = pal.shadow;
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3, opacity: 0.95 }}>
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, wordBreak: "break-word" }}>
        {value}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 12, color: pal.sub, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

/**
 * AdminDashboard
 * - Merged overview counters and Admin Models into a single responsive card grid.
 * - Keeps only the requested account counters: Users, Withdrawal Requests, User KYC, Wallets, Transactions.
 * - Removed Quick Actions and Recent E‑Coupon Assignments sections as requested.
 */
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // Dynamic models (from Django Admin)
  const [modelsMeta, setModelsMeta] = useState([]);
  const [modelsErr, setModelsErr] = useState("");
  const nav = useNavigate();

  // Load metrics
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const fetchMetrics = async () => {
      try {
        const res = await API.get("admin/metrics/", { timeout: 12000, retryAttempts: 1, dedupe: "none" });
        if (!mounted) return;
        setData(res?.data || {});
        setErr("");
      } catch (e1) {
        try {
          // Fallback alias path registered in backend/core/urls.py
          const res2 = await API.get("adminapi/metrics/", { timeout: 12000, retryAttempts: 1, dedupe: "none" });
          if (!mounted) return;
          setData(res2?.data || {});
          setErr("");
        } catch (e2) {
          if (!mounted) return;
          const msg = (e2 && (e2.message || e2.code)) || "";
          if (msg === "deduped" || msg === "ERR_CANCELED" || msg === "canceled") return;
          setData({});
          setErr("Failed to load metrics");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMetrics();
    return () => {
      mounted = false;
    };
  }, []);

  // Load admin model metadata for cards
  useEffect(() => {
    let mounted = true;
    getAdminMeta()
      .then((meta) => {
        if (!mounted) return;
        setModelsMeta(meta?.models || []);
        setModelsErr("");
      })
      .catch(() => {
        if (!mounted) return;
        setModelsMeta([]);
        setModelsErr("Failed to load admin models");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const users = data?.users || {};
  const wallets = data?.wallets || {};
  const withdrawals = data?.withdrawals || {};

  // Group models by app with de-duplication
  const modelsByApp = React.useMemo(() => {
    const norm = (s) => String(s || "").toLowerCase();
    const seen = new Set();
    const grouped = {};
    for (const m of (modelsMeta || [])) {
      if (!m) continue;
      const app = norm(m.app_label);
      const model = norm(m.model);
      const key = `${app}.${model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      (grouped[m.app_label] = grouped[m.app_label] || []).push(m);
    }
    return grouped;
  }, [modelsMeta]);

  return (
    <div>
      {/* Page heading */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 900 }}>Overview</h2>
          <span style={{ color: "#64748b", fontSize: 12 }}>Accounts and Admin Models</span>
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {new Date().toLocaleDateString()}
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#64748b" }}>Loading...</div>
      ) : null /* do not block UI on metrics errors */}
      {/* Always render the cards with safe fallbacks so the dashboard never hard-fails */}
      <>
        <>
          {/* Merged Overview Counters + Admin Models */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {/* Required account counters */}
            <Card
              title="Users"
              value={users.total ?? 0}
              subtitle=""
              onClick={() => nav("/admin/users")}
              palette="indigo"
            />
            <Card
              title="Withdrawal Requests"
              value={(withdrawals.totalCount ?? withdrawals.pendingCount ?? 0)}
              subtitle=""
              onClick={() => nav("/admin/withdrawals")}
              palette="red"
            />
            <Card
              title="User KYC"
              value={(users.kycTotal ?? users.kycPending ?? 0)}
              subtitle=""
              onClick={() => nav("/admin/kyc")}
              palette="blue"
            />
            <Card
              title="Wallets"
              value={(wallets.totalCount ?? wallets.count ?? 0)}
              subtitle=""
              onClick={() => nav("/admin/users")}
              palette="green"
            />
            <Card
              title="Transactions"
              value={(wallets.transactionsTotal ?? wallets.transactionsToday ?? 0)}
              subtitle=""
              onClick={() => nav("/admin/users")}
              palette="amber"
            />

            {/* Admin models as cards (flattened) */}
            {(Object.keys(modelsByApp) || [])
              .sort()
              .flatMap((appLabel) =>
                (modelsByApp[appLabel] || [])
                  .slice()
                  .sort((a, b) => (a.verbose_name || a.model).localeCompare(b.verbose_name || b.model))
                  .map((m) => {
                    const palName = choosePaletteForModel(m.app_label, m.model);
                    const pal = paletteStyles(palName);
                    return (
                      <div
                        key={`${m.app_label}.${m.model}`}
                        onClick={() => nav(`/admin/dashboard/models/${m.app_label}/${m.model}`)}
                        role="button"
                        tabIndex={0}
                        style={{
                          cursor: "pointer",
                          background: pal.bg,
                          border: `1px solid ${pal.border}`,
                          color: pal.text,
                          borderRadius: 14,
                          padding: 12,
                          boxShadow: pal.shadow,
                          transition: "transform 120ms ease, box-shadow 120ms ease",
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            nav(`/admin/dashboard/models/${m.app_label}/${m.model}`);
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = pal.hoverShadow || "0 12px 24px rgba(15,23,42,0.16)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = pal.shadow;
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{m.verbose_name || m.model}</div>
                        <div style={{ fontSize: 12, color: pal.sub }}>
                          {m.app_label}.{m.model}
                        </div>
                      </div>
                    );
                  })
              )}
          </div>

          {/* Model meta load error (non-blocking) */}
          {modelsErr ? (
            <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>{modelsErr}</div>
          ) : null}
        </>
      </>
    </div>
  );
}
