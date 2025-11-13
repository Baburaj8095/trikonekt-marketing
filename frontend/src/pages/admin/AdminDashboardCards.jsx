import React from "react";
import { getAdminMeta } from "../../admin-panel/api/adminMeta";
import ModelListSimple from "../../admin-panel/dynamic/ModelListSimple";

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

/**
 * AdminDashboardCards
 * - Fully manages the "Dashboard Cards" upload model using the dynamic admin engine.
 * - Auto-discovers the correct model from admin-meta (uploads app).
 * - Create/Edit supports file/image fields via ModelFormDialog (FormData).
 *
 * If multiple candidate models exist under uploads.*, a dropdown is shown to select one.
 */
export default function AdminDashboardCards() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [uploadsModels, setUploadsModels] = React.useState([]);
  const [selectedKey, setSelectedKey] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    getAdminMeta()
      .then((data) => {
        if (!mounted) return;
        const all = Array.isArray(data?.models) ? data.models : [];
        const uploads = all.filter((m) => m.app_label === "uploads");

        // Try to find a model that looks like "dashboard cards"
        const tokens = ["dashboard", "card"];
        const matches = uploads.filter((m) => {
          const hay = [
            m.app_label || "",
            m.model || "",
            m.verbose_name || "",
            m.verbose_name_plural || "",
          ]
            .join(" ")
            .toLowerCase()
            .replace(/[_-]+/g, " ");
          return tokens.every((t) => hay.includes(t));
        });

        const list = uploads;
        setUploadsModels(list);

        const pick = (matches[0] || list[0]) || null;
        if (pick) {
          setSelectedKey(`${pick.app_label}.${pick.model}`);
        } else {
          setSelectedKey("");
        }
      })
      .catch(() => setError("Failed to load admin metadata"))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const selected = React.useMemo(() => {
    if (!selectedKey) return null;
    return uploadsModels.find((m) => `${m.app_label}.${m.model}` === selectedKey) || null;
  }, [uploadsModels, selectedKey]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Dashboard Cards (Uploads)</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Manage dashboard tiles via the dynamic admin engine. File/image fields are supported.
        </div>
      </div>

      <Section
        title="Select Upload Model"
        extraRight={
          loading ? (
            <div style={{ color: "#64748b", fontSize: 12 }}>Loading…</div>
          ) : error ? (
            <div style={{ color: "#dc2626", fontSize: 12 }}>{error}</div>
          ) : null
        }
      >
        {uploadsModels.length ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>Model:</label>
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            >
              {uploadsModels.map((m) => {
                const key = `${m.app_label}.${m.model}`;
                const label = m.verbose_name || m.model;
                return (
                  <option key={key} value={key}>
                    {label} ({key})
                  </option>
                );
              })}
            </select>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Tip: We auto-select models containing “dashboard” and “card”.
            </div>
          </div>
        ) : loading ? null : (
          <div style={{ color: "#64748b" }}>No uploads models discovered via admin-meta.</div>
        )}
      </Section>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {!selected ? (
          <div style={{ padding: 12, color: "#64748b" }}>
            {loading ? "Loading…" : error || "Select a model to manage dashboard cards."}
          </div>
        ) : (
          <div style={{ padding: 12 }}>
            <div style={{ marginBottom: 8, color: "#64748b", fontSize: 12 }}>
              Managing: {selected.verbose_name || selected.model} ({selected.app_label}.{selected.model})
            </div>
            <ModelListSimple app={selected.app_label} model={selected.model} />
          </div>
        )}
      </div>
    </div>
  );
}
