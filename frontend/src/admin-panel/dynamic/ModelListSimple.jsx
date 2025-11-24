import React from "react";
import { useParams } from "react-router-dom";
import API from "../api/client";
import DataTable from "../components/data/DataTable";
import ModelFormDialog from "./ModelFormDialog";
import { getAdminMeta } from "../api/adminMeta";

/**
 * ModelListSimple — Upgraded to use MUI DataGrid (via DataTable wrapper)
 * - Server-side pagination, sorting, and debounced search
 * - Clean UI with toolbar (Create) + density toggle
 * - Mobile friendly (flex columns with sensible minWidth, horizontal scroll when needed)
 *
 * Route usage:
 *   /admin/dashboard/models/:app/:model
 */
export default function ModelListSimple(props) {
  const routeParams = useParams();
  const app = props.app || routeParams.app;
  const model = props.model || routeParams.model;

  const storageKeyBase = `admin.table.${app}.${model}`;

  const readInitialString = (key, def) => {
    try {
      const fromLS = localStorage.getItem(`${storageKeyBase}.${key}`);
      if (fromLS != null) return fromLS;
    } catch (_) {}
    return def;
  };

  const [meta, setMeta] = React.useState(null);
  const [error, setError] = React.useState("");
  const [loadingMeta, setLoadingMeta] = React.useState(true);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [reload, setReload] = React.useState(0);

  const [density, setDensity] = React.useState(readInitialString("density", "standard"));

  React.useEffect(() => {
    try { localStorage.setItem(`${storageKeyBase}.density`, String(density)); } catch (_) {}
  }, [storageKeyBase, density]);

  // Load model meta
  React.useEffect(() => {
    let mounted = true;
    setError("");
    setMeta(null);
    setLoadingMeta(true);
    getAdminMeta()
      .then((data) => {
        if (!mounted) return;
        const found = (data?.models || []).find(
          (m) => m.app_label === app && m.model === model
        );
        if (!found) {
          setError("Model metadata not found.");
          return;
        }
        setMeta(found);
      })
      .catch(() => setError("Failed to load model metadata"))
      .finally(() => setLoadingMeta(false));
    return () => { mounted = false; };
  }, [app, model]);

  function setEditRow(row) {
    setEditing(row);
    setFormOpen(true);
  }

  // Resolve dialog fields per model and per mode with safe fallbacks.
  function resolveFields(metaObj, isEdit) {
    if (!metaObj) return [];
    const pick = (...cands) => cands.find((x) => Array.isArray(x) && x.length) || null;

    const explicit = isEdit
      ? pick(metaObj.fields_edit, metaObj.form_fields_edit)
      : pick(metaObj.fields_create, metaObj.form_fields_create);
    if (explicit) return explicit;

    if (Array.isArray(metaObj.fields) && metaObj.fields.length) return metaObj.fields;

    const ld = Array.isArray(metaObj.list_display) && metaObj.list_display.length
      ? metaObj.list_display.filter((n) => n && n !== "repr" && n !== "__actions")
      : ["id", "__str__"];

    return ld.map((name) => {
      const isId = name === "id";
      return {
        name,
        label:
          name === "__str__"
            ? (metaObj.verbose_name_singular || "Repr")
            : String(name).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        type: isId ? "AutoField" : "CharField",
        required: false,
        read_only: isId,
      };
    });
  }

  const listDisplay = (meta?.list_display && meta.list_display.length)
    ? meta.list_display
    : ["id", "__str__"];

  // Build MUI DataGrid column definitions; value/resolution handled by DataTable's default getters.
  const columns = React.useMemo(() => {
    const cols = (listDisplay || [])
      .filter((name) => name && name !== "repr")
      .map((name) => ({
        field: name,
        headerName:
          name === "__str__"
            ? (meta?.verbose_name_singular || "Repr")
            : String(name).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        // Defaults for responsiveness; DataTable will ensure minWidth/flex if unspecified
        // minWidth: 140, flex: 1
      }));

    // Actions column (edit)
    cols.push({
      field: "__actions",
      headerName: "Actions",
      sortable: false,
      filterable: false,
      minWidth: 120,
      renderCell: (params) => {
        const row = params?.row || {};
        if (!meta?.permissions?.change) return null;
        return (
          <button
            className="tk-btn"
            onClick={() => setEditRow(row)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer", fontSize: 12 }}
          >
            Edit
          </button>
        );
      },
    });

    return cols;
  }, [listDisplay, meta]);

  // Server-side fetcher for DataTable
  const fetcher = React.useCallback(async ({ page, pageSize, search, ordering }) => {
    if (!meta?.route) return { results: [], count: 0 };
    const params = { page, page_size: pageSize };
    if (search && String(search).trim()) params.search = String(search).trim();
    if (ordering) params.ordering = ordering;
    const { data } = await API.get(meta.route, { params });
    const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
    const count = typeof data?.count === "number" ? data.count : results.length;
    return { results, count };
  }, [meta, reload]);

  const toolbar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button
        className="tk-btn"
        onClick={() => { setEditing(null); setFormOpen(true); }}
        disabled={!(meta?.permissions?.add)}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          fontWeight: 700,
        }}
      >
        Create
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label style={{ fontSize: 12, color: "#64748b" }}>Density</label>
        <div style={{ display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => setDensity("comfortable")}
            aria-pressed={density === "comfortable"}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: density === "comfortable" ? "#0f172a" : "#fff",
              color: density === "comfortable" ? "#fff" : "#0f172a",
              border: 0,
              cursor: "pointer",
            }}
          >
            Comfortable
          </button>
          <button
            onClick={() => setDensity("standard")}
            aria-pressed={density === "standard"}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: density === "standard" ? "#0f172a" : "#fff",
              color: density === "standard" ? "#fff" : "#0f172a",
              border: 0,
              borderLeft: "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            Standard
          </button>
          <button
            onClick={() => setDensity("compact")}
            aria-pressed={density === "compact"}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: density === "compact" ? "#0f172a" : "#fff",
              color: density === "compact" ? "#fff" : "#0f172a",
              border: 0,
              borderLeft: "1px solid #e5e7eb",
              cursor: "pointer",
            }}
          >
            Compact
          </button>
        </div>
      </div>
    </div>
  );

  if (loadingMeta) return <div style={{ color: "#64748b" }}>Loading…</div>;
  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!meta) return null;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 800, color: "#0f172a" }}>
          {meta.verbose_name || `${meta.app_label}.${meta.model}`}
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>{meta.route}</div>
      </div>

      <DataTable
        columns={columns}
        fetcher={fetcher}
        onRowEdit={(row) => setEditRow(row)}
        density={density}
        toolbar={toolbar}
        checkboxSelection={true}
        onSelectionChange={() => {}}
      />

      <ModelFormDialog
        key={`${meta.app_label}.${meta.model}:${editing ? "edit" : "create"}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        route={meta.route}
        fields={resolveFields(meta, !!editing)}
        record={editing}
        onSaved={() => {
          setReload((k) => k + 1);
        }}
        title={
          editing
            ? `Edit ${(meta.verbose_name_singular || meta.model)}`
            : `Create ${(meta.verbose_name_singular || meta.model)}`
        }
      />
    </div>
  );
}
