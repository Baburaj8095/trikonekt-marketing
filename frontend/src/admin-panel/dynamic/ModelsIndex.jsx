import React from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/client";

export default function ModelsIndex() {
  const [models, setModels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const nav = useNavigate();

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    API.get("/admin/admin-meta/")
      .then(({ data }) => {
        if (!mounted) return;
        setModels(data?.models || []);
        setErr("");
      })
      .catch(() => setErr("Failed to load models"))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div style={{ color: "#64748b" }}>Loading models…</div>;
  if (err) return <div style={{ color: "#dc2626" }}>{err}</div>;
  if (!models.length) return <div>No admin models available.</div>;

  // Group by app_label
  const grouped = models.reduce((acc, m) => {
    acc[m.app_label] = acc[m.app_label] || [];
    acc[m.app_label].push(m);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, color: "#0f172a", fontSize: 20, fontWeight: 900 }}>Manage Models</h2>
        <span style={{ color: "#64748b", fontSize: 12 }}>Auto-discovered from Django Admin</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Object.keys(grouped).sort().map((app) => (
          <div key={app} style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", padding: 12 }}>
            <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{app}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {grouped[app].sort((a, b) => (a.verbose_name || a.model).localeCompare(b.verbose_name || b.model)).map((m) => (
                <button
                  key={`${m.app_label}.${m.model}`}
                  onClick={() => nav(`/admin/dashboard/models/${m.app_label}/${m.model}`)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{m.verbose_name || m.model}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{m.app_label}.{m.model}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
