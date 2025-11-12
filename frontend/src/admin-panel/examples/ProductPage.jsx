import React from "react";
import { Button } from "@mui/material";
import API from "../api/client";
import DataTable from "../components/data/DataTable";
import ModelFormDialog from "../dynamic/ModelFormDialog";

/**
 * Example page pinned to market.Product using the dynamic admin engine.
 * Route suggestion: /admin/dashboard/examples/products
 */
export default function ProductPage() {
  const APP = "market";
  const MODEL = "product";

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
  if (meta?.permissions && !meta.permissions.view)
    return (
      <div style={{ color: "#dc2626" }}>
        You do not have permission to view this model.
      </div>
    );

  // Use list_display if available, else fall back to a curated set for Product
  const baseFields = Array.from(
    new Set(
      (meta.list_display && meta.list_display.length
        ? meta.list_display
        : [
            "id",
            "name",
            "category",
            "price",
            "quantity",
            "discount",
            "country",
            "state",
            "city",
            "pincode",
            "__str__",
          ]
      ).filter((f) => f && f !== "repr")
    )
  );

  const columns = baseFields.map((name) => ({
    field: name,
    headerName:
      name === "__str__"
        ? meta.verbose_name_singular || "repr"
        : name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    flex: 1,
    minWidth: 140,
    valueGetter: (params) => {
      const row = (params && params.row) ? params.row : {};
      if (name === "__str__") return row.repr ?? row[name] ?? "";
      const v = row[name];
      if (v == null) return "";
      return typeof v === "object" ? (v.username || v.name || v.id || String(v)) : v;
    },
  }));

  // Actions column (permission-aware)
  columns.push({
    field: "__actions",
    headerName: "Actions",
    sortable: false,
    filterable: false,
    width: 120,
    renderCell: (p) =>
      meta?.permissions?.change ? (
        <Button
          size="small"
          variant="outlined"
          onClick={() => setEditRow(p.row)}
        >
          Edit
        </Button>
      ) : null,
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
        await Promise.all(
          selection.map((id) => API.delete(`${meta.route}${id}/`))
        );
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
        disabled={!(meta?.permissions?.add)}
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      >
        Create
      </Button>
      <Button
        variant="outlined"
        color="error"
        disabled={!selection.length || !(meta?.permissions?.delete)}
        onClick={bulkDelete}
      >
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
        title={editing ? "Edit Product" : "Create Product"}
      />
    </div>
  );
}
