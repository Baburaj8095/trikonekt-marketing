import React from "react";
import { useNavigate } from "react-router-dom";
import ModelListSimple from "../../admin-panel/dynamic/ModelListSimple";

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        border: active ? "1px solid #93c5fd" : "1px solid #e5e7eb",
        background: active ? "#eff6ff" : "#fff",
        color: active ? "#1d4ed8" : "#0f172a",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/**
 * AdminNotifications — Unified Notifications console
 * - Templates: create/edit Notification Event Templates
 * - Dispatch: guidance + quick links to dispatch via Templates ("Dispatch now" action)
 * - Activity: monitor Batches and the Notifications Log
 */
export default function AdminNotifications() {
  const [tab, setTab] = React.useState("templates"); // templates | dispatch | activity
  const nav = useNavigate();

  return (
    <div>
      {/* Heading */}
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
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 900 }}>
            Notifications
          </h2>
          <span style={{ color: "#64748b", fontSize: 12 }}>
            Create templates, dispatch broadcasts, and monitor activity
          </span>
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <TabButton active={tab === "templates"} onClick={() => setTab("templates")}>
          Templates
        </TabButton>
        <TabButton active={tab === "dispatch"} onClick={() => setTab("dispatch")}>
          Dispatch
        </TabButton>
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
          Activity
        </TabButton>
      </div>

      {/* Content */}
      {tab === "templates" ? (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", padding: 12 }}>
          <ModelListSimple app="notifications" model="notificationeventtemplate" />
        </div>
      ) : null}

      {tab === "dispatch" ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#fff",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              color: "#0f172a",
              fontWeight: 800,
            }}
          >
            Quick Dispatch
          </div>
          <div style={{ color: "#334155", lineHeight: 1.5 }}>
            Use your configured Event Templates to broadcast to Consumers, Agencies, Employees, and Merchants.
            Select the template(s) and run the “Dispatch now” action. Dedupe, pinning and channels are respected.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => nav("/admin/dashboard/models/notifications/notificationeventtemplate")}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #93c5fd",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Open Templates (Dispatch)
            </button>
            <button
              onClick={() => setTab("activity")}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              View Activity
            </button>
          </div>
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 10,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              fontSize: 12,
            }}
          >
            Tip: Audience roles support "consumer", "agency", "employee", "merchant" (business), "company", or "all".
            Set pinned_until to surface important announcements. Enable channels.in_app=true for in‑app delivery.
          </div>
        </div>
      ) : null}

      {tab === "activity" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", padding: 12, minWidth: 0 }}>
            <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Batches</div>
            <ModelListSimple app="notifications" model="notificationbatch" />
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", padding: 12, minWidth: 0 }}>
            <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Notifications Log</div>
            <ModelListSimple app="notifications" model="notification" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
