import React, { useEffect, useState, useCallback, useMemo } from "react";
import { DataGrid } from "@mui/x-data-grid";

/**
 * Reusable server-side DataGrid wrapper.
 * Props:
 *  - columns: MUI DataGrid columns
 *  - fetcher: ({ page, pageSize, search, ordering }) => Promise<{ results, count }>
 *  - onRowEdit: (row) => void
 *  - density: "compact" | "standard" | "comfortable"
 *  - toolbar: ReactNode (rendered next to search)
 *  - checkboxSelection: boolean (default true to allow bulk actions)
 */
export default function DataTable({
  columns,
  fetcher,
  onRowEdit,
  density = "standard",
  toolbar,
  checkboxSelection = true,
  onSelectionChange,
}) {
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ordering = sortModel[0]
        ? `${sortModel[0].sort === "desc" ? "-" : ""}${sortModel[0].field}`
        : undefined;
      const { results, count } = await fetcher({
        page: paginationModel.page + 1,
        pageSize: paginationModel.pageSize,
        search,
        ordering,
      });
      // Ensure each row has an id field for DataGrid
      const normalized = (results || []).map((r) => {
        const fallbackId = r.id ?? r.pk ?? r.uuid ?? r._id ?? r.key ?? `${Math.random()}`;
        const fieldsObj = r && typeof r === "object" && r.fields && typeof r.fields === "object" ? r.fields : {};
        const dataObj = r && typeof r === "object" && r.data && typeof r.data === "object" ? r.data : {};
        // Flatten common container shapes (fields/data) so column field names map directly
        // Preserve explicit row keys over containers by spreading containers first.
        return { ...fieldsObj, ...dataObj, ...r, id: fallbackId };
      });
      setRows(normalized);
      setRowCount(count || 0);
    } catch (e) {
      // no-op; caller should handle toasts/snacks
    } finally {
      setLoading(false);
    }
  }, [fetcher, paginationModel, sortModel, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Safe deep getter to support nested column fields: "user.username", "item[0].name", etc.
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

  // Field resolver with nested path support and special cases; returns a primitive/string
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

  const safeColumns = useMemo(() => {
    return (columns || []).map((col) => {
      const base = { ...col };
      if (base && typeof base === "object") {
        // Default headerName if missing
        if (!base.headerName) {
          base.headerName = String(base.field || "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
        }
        // Default valueGetter supporting both MUI X signatures (<=v7: params) (v8: value,row)
        if (!base.valueGetter) {
          base.valueGetter = (...args) => {
            // v8+ signature: (value, row)
            if (args.length >= 2 && args[1] && typeof args[1] === "object" && !("row" in (args[0] || {}))) {
              const [, row] = args;
              return getFieldValue(row, base.field);
            }
            // v5-v7 signature: (params)
            const params = args[0];
            const row = params?.row || {};
            return getFieldValue(row, base.field);
          };
        }
        // Default renderCell ensures text renders even if theme colors conflict
        if (!base.renderCell) {
          base.renderCell = (params) => {
            const row = params?.row || {};
            const v = getFieldValue(row, base.field);
            if (v == null || v === "") return "—";
            return String(v);
          };
        }
        // Default valueFormatter to keep exported/sorted text consistent
        if (!base.valueFormatter) {
          base.valueFormatter = (v) => {
            if (v == null) return "";
            return typeof v === "object" ? (v?.username || v?.name || v?.id || JSON.stringify(v)) : String(v);
          };
        }
        // Ensure reasonable width if not specified
        if (base.flex == null && base.width == null && base.minWidth == null) {
          base.minWidth = 140;
          base.flex = 1;
        }
      }
      return base;
    });
  }, [columns]);

  return (
    <div className="tk-grid" style={{ width: "100%", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", position: "relative", isolation: "isolate" }}>
      <div style={{ padding: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {toolbar}
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 8, width: 280, borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}
        />
      </div>
      <DataGrid
        autoHeight
        rows={rows}
        columns={safeColumns}
        rowCount={rowCount}
        loading={loading}
        paginationMode="server"
        sortingMode="server"
        pagination
        pageSizeOptions={[10, 25, 50, 100]}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        onSortModelChange={setSortModel}
        onRowDoubleClick={(p) => onRowEdit?.(p.row)}
        disableRowSelectionOnClick
        density={density}
        checkboxSelection={checkboxSelection}
        onRowSelectionModelChange={(m) => {
          setSelection(m);
          onSelectionChange?.(m);
        }}
        // Ensure stable row identity and visible row heights
        getRowId={(row) => row.id ?? row.pk ?? row.uuid ?? row._id ?? row.key}
        rowHeight={52}
        columnHeaderHeight={44}
        // Workaround for virtualization measurement issues causing "invisible" rows in some layouts
        disableVirtualization
        sx={{
          // Base text color to avoid theme inversion
          "& .MuiDataGrid-cell": { outline: "none !important", color: "#0f172a !important", backgroundColor: "#ffffff" },
          "& .MuiDataGrid-cellContent": { color: "#0f172a !important" },
          "& .MuiDataGrid-columnHeaderTitle": { color: "#0f172a !important", fontWeight: 600 },
          "& .MuiDataGrid-columnHeaderTitleContainerContent": { color: "#0f172a !important" },

          // Force white backgrounds for all grid surfaces to avoid partial/transparent cells
          "&.MuiDataGrid-root": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-main": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-columnHeaders": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScroller": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScrollerContent": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScrollerRenderZone": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-footerContainer": { backgroundColor: "#ffffff" },

          // Remove hover/selection tinting so rows remain solid white
          "& .MuiDataGrid-row:hover": { backgroundColor: "#ffffff !important" },
          "& .MuiDataGrid-row.Mui-hover": { backgroundColor: "#ffffff !important" },
          "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "#ffffff !important" },
          "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: "#ffffff !important" },
          "& .MuiDataGrid-overlay": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-filler": { backgroundColor: "#ffffff" }
        }}
      />
    </div>
  );
}
