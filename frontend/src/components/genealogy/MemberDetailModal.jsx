/**
 * MemberDetailModal.jsx
 * Full-screen slide-up modal showing detailed info for a direct sponsor member.
 * Displays:
 *  • Consumer info (ID, name, registration date, package activation date)
 *  • Entry Package (Join Subscription / 750)
 *  • Smart (BFP) – Season selector with 12-month purchase boxes
 *  • Prime Subscription – rank ladder with Active/Inactive status
 */

import React, { useEffect, useState } from "react";
import API from "../../api/api";

// ─── Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg: "#f0f4ff",
  surface: "#ffffff",
  primary: "#4f46e5",
  primaryL: "#ede9fe",
  green: "#16a34a",
  greenL: "#dcfce7",
  red: "#dc2626",
  redL: "#fef2f2",
  amber: "#d97706",
  amberL: "#fef3c7",
  text: "#111827",
  textSec: "#6b7280",
  border: "#e5e7eb",
  radius: 14,
  shadow: "0 4px 24px rgba(79,70,229,0.10)",
};

function fmt(isoStr) {
  if (!isoStr) return "–";
  try {
    return new Date(isoStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

// ─── Section card ──────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: C.radius,
        padding: "16px",
        marginBottom: 14,
        boxShadow: C.shadow,
      }}
    >
      <h3
        style={{
          margin: "0 0 12px",
          fontSize: 14,
          fontWeight: 800,
          color: C.primary,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Info row ──────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "6px 0",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 13, color: C.textSec, fontWeight: 500 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: C.text,
          fontWeight: 700,
          textAlign: "right",
          maxWidth: "60%",
          wordBreak: "break-word",
        }}
      >
        {value || "–"}
      </span>
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const isActive = String(status).toLowerCase() === "active";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        background: isActive ? C.greenL : "#f1f5f9",
        color: isActive ? C.green : C.textSec,
        letterSpacing: "0.02em",
      }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

// ─── 12-month grid ─────────────────────────────────────────────────────────
function MonthGrid({ monthsPurchased = [] }) {
  const purchased = new Set(monthsPurchased);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 6,
        marginTop: 8,
      }}
    >
      {Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const done = purchased.has(m);
        return (
          <div
            key={m}
            title={`Month ${m}`}
            style={{
              height: 38,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              background: done ? C.greenL : "#f8fafc",
              color: done ? C.green : "#cbd5e1",
              border: `1.5px solid ${done ? "#86efac" : C.border}`,
              transition: "all 0.15s",
            }}
          >
            {m}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Modal ─────────────────────────────────────────────────────────────
export default function MemberDetailModal({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError("");
    setData(null);
    API.get(`/accounts/direct/member-detail/?user_id=${encodeURIComponent(userId)}`)
      .then((res) => {
        setData(res?.data || null);
        // Auto-select the first active season if exists
        const seasons = res?.data?.smart_seasons || [];
        const activeIdx = seasons.findIndex((s) => s.is_active);
        setSelectedSeasonIdx(activeIdx >= 0 ? activeIdx : 0);
      })
      .catch(() => setError("Unable to load member details."))
      .finally(() => setLoading(false));
  }, [userId]);

  const selectedSeason = data?.smart_seasons?.[selectedSeasonIdx] || null;

  // ── prevent body scroll while modal open ──
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    // ── Overlay ──
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* ── Sheet ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "92dvh",
          background: C.bg,
          borderRadius: "20px 20px 0 0",
          overflowY: "auto",
          paddingBottom: 32,
          animation: "slideUp 0.25s ease",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: C.surface,
            borderBottom: `1.5px solid ${C.border}`,
            padding: "14px 16px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: C.text,
                letterSpacing: "-0.3px",
              }}
            >
              {loading ? "Loading…" : data?.full_name || data?.consumer_id || "Member Details"}
            </div>
            {data?.consumer_id && (
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 1 }}>
                🪪 {data.consumer_id}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 99,
              border: `1.5px solid ${C.border}`,
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              color: C.textSec,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "16px 16px 0" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.textSec }}>
              Loading…
            </div>
          )}
          {!loading && error && (
            <div
              style={{
                background: C.redL,
                color: C.red,
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
          {!loading && data && (
            <>
              {/* ── Section 1: Consumer Details ── */}
              <Section title="① Consumer Details">
                <InfoRow label="Consumer ID" value={data.consumer_id} />
                <InfoRow label="Name" value={data.full_name} />
                <InfoRow label="Phone" value={data.phone} />
                <InfoRow label="Registration Date" value={fmt(data.registration_date)} />
                <InfoRow
                  label="Package Activation Date"
                  value={fmt(data.package_activation_date)}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 8,
                  }}
                >
                  <span style={{ fontSize: 13, color: C.textSec, fontWeight: 500 }}>
                    Account Status
                  </span>
                  <StatusBadge status={data.account_active ? "Active" : "Inactive"} />
                </div>
              </Section>

              {/* ── Section 2: Entry Package ── */}
              <Section title="② Entry Package">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {data.entry_package?.name || "Join Subscription"}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                      ₹{data.entry_package?.amount ?? 750} one-time package
                    </div>
                  </div>
                  <StatusBadge status={data.entry_package?.status || "Inactive"} />
                </div>
              </Section>

              {/* ── Section 3: Smart (BFP) – Seasons ── */}
              <Section title="③ Smart SPP">
                {(!data.smart_seasons || data.smart_seasons.length === 0) ? (
                  <div style={{ fontSize: 13, color: C.textSec, textAlign: "center", padding: "8px 0" }}>
                    No seasons available yet.
                  </div>
                ) : (
                  <>
                    {/* Season selector */}
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginBottom: 12,
                      }}
                    >
                      {data.smart_seasons.map((s, idx) => {
                        const isSelected = idx === selectedSeasonIdx;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSeasonIdx(idx)}
                            style={{
                              padding: "5px 12px",
                              borderRadius: 99,
                              border: `1.5px solid ${isSelected ? C.primary : C.border}`,
                              background: isSelected ? C.primaryL : "transparent",
                              color: isSelected ? C.primary : C.textSec,
                              fontSize: 12,
                              fontWeight: isSelected ? 700 : 500,
                              cursor: "pointer",
                              outline: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            {s.name}
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: s.is_active ? C.green : "#9ca3af",
                                display: "inline-block",
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Season details */}
                    {selectedSeason && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                            {selectedSeason.name}
                          </span>
                          <StatusBadge status={selectedSeason.is_active ? "Active" : "Inactive"} />
                        </div>
                        <div style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>
                          Monthly purchases (green = purchased)
                        </div>
                        <MonthGrid monthsPurchased={selectedSeason.months_purchased} />
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: C.textSec,
                            textAlign: "right",
                          }}
                        >
                          {selectedSeason.months_purchased?.length || 0} / 12 months purchased
                        </div>
                      </>
                    )}
                  </>
                )}
              </Section>

              {/* ── Section 4: Prime Subscription (Rank Upgrades) ── */}
              <Section title="④ Prime Subscription">
                {(!data.prime_ranks || data.prime_ranks.length === 0) ? (
                  <div style={{ fontSize: 13, color: C.textSec, textAlign: "center", padding: "8px 0" }}>
                    No rank data available.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {data.prime_ranks.map((rank) => {
                      const isActive = rank.status === "Active";
                      return (
                        <div
                          key={rank.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: isActive ? C.greenL : "#f8fafc",
                            border: `1.5px solid ${isActive ? "#86efac" : C.border}`,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: C.text,
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            ★ L{rank.level} {rank.name}
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: isActive ? C.green : C.textSec,
                              marginLeft: 12,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {rank.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>

      {/* Slide-up animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
