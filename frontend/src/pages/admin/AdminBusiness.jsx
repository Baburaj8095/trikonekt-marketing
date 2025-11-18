import React from "react";
import API from "../../api/api";
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

export default function AdminBusiness() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [models, setModels] = React.useState([]);
  const [selectedKey, setSelectedKey] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    getAdminMeta()
      .then((data) => {
        if (!mounted) return;
        const all = Array.isArray(data?.models) ? data.models : [];

        const tokens = ["business", "registration", "company"];
        const isMatch = (m) => {
          const hay = [
            m?.app_label || "",
            m?.model || "",
            m?.verbose_name || "",
            m?.verbose_name_plural || "",
          ]
            .join(" ")
            .toLowerCase();
          return tokens.some((t) => hay.includes(t));
        };

        const candidates = all.filter(isMatch);
        const usable = candidates.length ? candidates : all;

        setModels(usable);
        if (usable.length) {
          setSelectedKey(`${usable[0].app_label}.${usable[0].model}`);
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
    return models.find((m) => `${m.app_label}.${m.model}` === selectedKey);
  }, [models, selectedKey]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Business Registration</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Review and approve business registrations. This view uses the new SimpleTable (no DataGrid).
        </div>
      </div>

      <Section
        title="Select Model"
        extraRight={
          loading ? (
            <div style={{ color: "#64748b", fontSize: 12 }}>Loading…</div>
          ) : error ? (
            <div style={{ color: "#dc2626", fontSize: 12 }}>{error}</div>
          ) : null
        }
      >
        {models.length ? (
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
              {models.map((m) => {
                const key = `${m.app_label}.${m.model}`;
                const label = m.verbose_name || m.model;
                return (
                  <option key={key} value={key}>
                    {label} ({key})
                  </option>
                );
              })}
            </select>
          </div>
        ) : loading ? null : (
          <div style={{ color: "#64748b" }}>No admin models available.</div>
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
            {loading ? "Loading…" : error || "Select a model to view registrations."}
          </div>
        ) : (
          <div style={{ padding: 12 }}>
            <div style={{ marginBottom: 8, color: "#64748b", fontSize: 12 }}>
              Showing: {selected.verbose_name || selected.model} ({selected.app_label}.{selected.model})
            </div>
            <ModelListSimple app={selected.app_label} model={selected.model} />
          </div>
        )}
      </div>
    </div>
  );
}
