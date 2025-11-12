import React from "react";
import { Button } from "@mui/material";
import API from "../api/client";
import DataTable from "../components/data/DataTable";
import ModelFormDialog from "../dynamic/ModelFormDialog";

/**
 * Example page pinned to accounts.CustomUser using the dynamic admin engine.
 * Route suggestion: /admin/dashboard/examples/users
 */
export default function UsersPage() {
  const APP = "accounts";
  const MODEL = "customuser";

  const [meta, setMeta] = React.useState(null);
  const [error, setError] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [selection, setSelection] = React.useState([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError("");
        const { data } = await API.get("admin/admin-meta/");
        const found =
          (data?.models || []).find(
            (m) => m.app_label === APP && m.model === MODEL
          ) || null;
        if (!mounted) return;
        if (!found) {
          setError(
            `Model metadata not found for ${APP}.${MODEL}. Ensure it is registered in Django Admin.`
          );
          return;
        }
        setMeta(found);
      } catch (e) {
        if (!mounted) return;
        setError("Failed to load model metadata");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetcher = React.useCallback(
    async ({ page, pageSize, search, ordering }) => {
      if (!meta) return { results: [], count: 0 };
      const params = { page, page_size: pageSize };
      if (search) params.search = search;
      if (ordering) params.ordering = ordering;
      const { data } = await API.get(meta.route, { params });
      return { results: data?.results || [], count: data?.count || 0 };
    },
    [meta]
  );

  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!meta) return <div style={{ color: "#64748b" }}>Loading…</div>;

  // Show a useful subset of columns; fall back to meta.list_display
  const baseFields = Array.from(
    new Set(
      (meta.list_display && meta.list_display.length
        ? meta.list_display
        : ["id", "username", "email", "role", "category", "__str__"]
      ).filter((f) => f && f !== "repr")
    )
  );

  // Support nested fields and robust fallbacks for id/__str__
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
  const columns = baseFields.map((name) => ({
    field: name,
    headerName:
      name === "__str__"
        ? meta.verbose_name_singular || "repr"
        : name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    flex: 1,
    minWidth: 140,
    valueGetter: (params) => {
      const row = params?.row || {};
      if (name === "__str__") return row.repr ?? row.__str__ ?? row.name ?? "";
      if (name === "id") return row.id ?? row.pk ?? row.uuid ?? row._id ?? row.key ?? "";
      const v = deepGet(row, name);
      if (v == null) return "";
      return typeof v === "object" ? (v.username || v.name || v.id || String(v)) : v;
    },
    renderCell: (params) => {
      const row = params?.row || {};
      let v = params?.value;
      if (v == null) {
        if (name === "__str__") v = row.repr ?? row.__str__ ?? row.name ?? "";
        else if (name === "id") v = row.id ?? row.pk ?? row.uuid ?? row._id ?? row.key ?? "";
        else v = deepGet(row, name);
      }
      if (v == null) return "";
      if (typeof v === "object") return String(v.username || v.name || v.id || JSON.stringify(v));
      return String(v);
    },
  }));

  // Actions column
  columns.push({
    field: "__actions",
    headerName: "Actions",
    sortable: false,
    filterable: false,
    width: 120,
    renderCell: (p) => (
      <Button size="small" variant="outlined" onClick={() => setEditRow(p.row)}>
        Edit
      </Button>
    ),
  });

  function setEditRow(row) {
    setEditing(row);
    setFormOpen(true);
  }

  async function bulkDelete() {
    if (!selection.length) return;
    try {
      await API.post(`${meta.route}bulk_action/`, {
        action: "bulk_delete",
        ids: selection,
      });
      setSelection([]);
      setRefreshKey((k) => k + 1);
    } catch {
      try {
        await Promise.all(selection.map((id) => API.delete(`${meta.route}${id}/`)));
        setSelection([]);
        setRefreshKey((k) => k + 1);
      } catch {
        // no-op
      }
    }
  }

  const toolbar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button
        variant="contained"
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      >
        Create
      </Button>
      <Button variant="outlined" color="error" disabled={!selection.length} onClick={bulkDelete}>
        Delete Selected ({selection.length})
      </Button>
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

      <DataTable
        key={refreshKey}
        columns={columns}
        fetcher={fetcher}
        onRowEdit={setEditRow}
        toolbar={toolbar}
        density="compact"
        onSelectionChange={setSelection}
      />

      <ModelFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        route={meta.route}
        fields={meta.fields || []}
        record={editing}
        onSaved={() => setRefreshKey((k) => k + 1)}
        title={editing ? "Edit User" : "Create User"}
      />
    </div>
  );
}
