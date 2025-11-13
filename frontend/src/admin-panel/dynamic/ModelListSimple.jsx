import React from "react";
import { useParams } from "react-router-dom";
import API from "../api/client";
import SimpleTable from "../components/data/SimpleTable";
import ModelFormDialog from "./ModelFormDialog";
import { getAdminMeta } from "../api/adminMeta";

/**
 * ModelListSimple — Dynamic model list using SimpleTable instead of DataGrid.
 *
 * Usage:
 * - As a route component with params :app/:model
 * - Or pass props { app, model } to explicitly choose a model
 *
 * Features:
 * - Server-side pagination and search via admin dynamic route (meta.route)
 * - Columns from meta.list_display (with deep field fallback)
 * - Create/Edit via ModelFormDialog
 */
export default function ModelListSimple(props) {
  const routeParams = useParams();
  const app = props.app || routeParams.app;
  const model = props.model || routeParams.model;

  const [meta, setMeta] = React.useState(null);
  const [error, setError] = React.useState("");
  const [loadingMeta, setLoadingMeta] = React.useState(true);

  const [rows, setRows] = React.useState([]);
  const [count, setCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(25);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [reload, setReload] = React.useState(0);

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

  // Helpers
  const deepGet = (obj, path) => {
    if (!obj || !path) return undefined;
    const parts = String(path).replace(/\[(\d+)\]/g, ".$1").split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  };
  const getFieldValue = (row, field) => {
    if (!row) return "";
    if (field === "__str__") return row.repr ?? row.__str__ ?? row.name ?? "";
    if (field === "id") return row.id ?? row.pk ?? row.uuid ?? row._id ?? row.key ?? "";
    let v = deepGet(row, field);
    if (v == null) v = deepGet(row.fields, field);
    if (v == null) v = deepGet(row.data, field);
    if (v == null) return "";
    if (typeof v === "object") return v.username || v.name || v.id || String(v);
    return v;
  };

  // Load rows
  React.useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = { page, page_size: pageSize };
        if (search) params.search = search;
        const { data } = await API.get(meta.route, { params });
        if (cancelled) return;
        const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
        const norm = (results || []).map((r) => {
          const id = r.id ?? r.pk ?? r.uuid ?? r._id ?? r.key ?? `${Math.random()}`;
          const fieldsObj = r && typeof r === "object" && r.fields && typeof r.fields === "object" ? r.fields : {};
          const dataObj = r && typeof r === "object" && r.data && typeof r.data === "object" ? r.data : {};
          return { ...fieldsObj, ...dataObj, ...r, id };
        });
        setRows(norm);
        setCount(typeof data?.count === "number" ? data.count : norm.length);
      } catch {
        if (!cancelled) {
          setRows([]);
          setCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [meta, page, pageSize, search, reload]);

  function setEditRow(row) {
    setEditing(row);
    setFormOpen(true);
  }

  if (loadingMeta) return <div style={{ color: "#64748b" }}>Loading…</div>;
  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!meta) return null;

  const listDisplay = (meta.list_display && meta.list_display.length)
    ? meta.list_display
    : ["id", "__str__"];

  const columns = [
    ...listDisplay
      .filter((name) => name && name !== "repr")
      .map((name) => ({
        key: name,
        header: name === "__str__"
          ? (meta.verbose_name_singular || "Repr")
          : String(name).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        renderCell: (row) => {
          const v = getFieldValue(row, name);
          return v == null || v === "" ? "—" : String(v);
        },
      })),
    {
      key: "__actions",
      header: "Actions",
      renderCell: (row) => (
        meta?.permissions?.change ? (
          <button
            onClick={() => setEditRow(row)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 12 }}
          >
            Edit
          </button>
        ) : null
      ),
    },
  ];

  // Resolve dialog fields per model and per mode with safe fallbacks.
  // Priority:
  // 1) Explicit form fields (create/edit) from admin-meta when provided
  // 2) Generic fields array from admin-meta
  // 3) Derive from list_display as a last resort (id read-only, other fields editable text)
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

  const toolbar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        onClick={() => { setEditing(null); setFormOpen(true); }}
        disabled={!(meta?.permissions?.add)}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          background: meta?.permissions?.add ? "#0f172a" : "#f1f5f9",
          color: meta?.permissions?.add ? "#fff" : "#94a3b8",
          cursor: meta?.permissions?.add ? "pointer" : "not-allowed",
          fontWeight: 700,
        }}
      >
        Create
      </button>
    </div>
  );

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 800, color: "#0f172a" }}>
          {meta.verbose_name || `${meta.app_label}.${meta.model}`}
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>{meta.route}</div>
      </div>

      <SimpleTable
        columns={columns}
        rows={rows}
        loading={loading}
        total={count}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        search={search}
        onSearch={(s) => { setPage(1); setSearch(s); }}
        toolbar={toolbar}
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
