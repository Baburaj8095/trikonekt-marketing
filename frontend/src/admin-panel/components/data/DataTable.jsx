import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  columnVisibilityModel,
  onColumnVisibilityModelChange,
  instanceKey,
}) {
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState([]);
  const searchRef = useRef("");
  const reqSeq = useRef(0);
  const inflightKeyRef = useRef(null);
  useEffect(() => { searchRef.current = search; }, [search]);

  // Debounce user typing before applying the search that triggers fetch
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const load = useCallback(async () => {
    const mySeq = (reqSeq.current += 1);
    const ordering = sortModel[0]
      ? `${sortModel[0].sort === "desc" ? "-" : ""}${sortModel[0].field}`
      : undefined;
    const key = JSON.stringify({
      p: paginationModel.page,
      ps: paginationModel.pageSize,
      s: searchRef.current || "",
      o: ordering || "",
    });
    // Prevent starting a duplicate identical in-flight request (avoid axios cancel noise)
    if (inflightKeyRef.current === key) return;
    inflightKeyRef.current = key;
    setLoading(true);
    try {
      const { results, count } = await fetcher({
        page: paginationModel.page + 1,
        pageSize: paginationModel.pageSize,
        search: searchRef.current,
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
      if (mySeq === reqSeq.current) {
        setRows(normalized);
        setRowCount(count || 0);
      }
    } catch (e) {
      // no-op; caller should handle toasts/snacks
    } finally {
      if (mySeq === reqSeq.current) {
        setLoading(false);
        if (inflightKeyRef.current === key) {
          inflightKeyRef.current = null;
        }
      }
    }
  }, [fetcher, paginationModel, sortModel, search]);

  useEffect(() => {
    // On search/filter change: reset to first page; the load effect will run when 'load' changes
    setPaginationModel((m) => (m.page !== 0 ? { ...m, page: 0 } : m));
  }, [search, fetcher]);

  useEffect(() => {
    // Always load data when 'load' changes (pagination/sort/search/filters).
    // In React StrictMode, this may run twice in development which is acceptable.
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
        // Default valueGetter robust to MUI X signatures (v8: (value,row,...), v5-v7: (params))
        if (!base.valueGetter) {
          const f = String(base.field || "");
          if (f.startsWith("__")) {
            // for synthetic columns like "__actions" just return empty value
            base.valueGetter = () => "";
          } else {
            base.valueGetter = (...args) => {
              try {
                // v8+ signature: (value, row, ...rest)
                if (args.length >= 2 && args[1] && typeof args[1] === "object" && !("row" in (args[0] || {}))) {
                  const [, row] = args;
                  return getFieldValue(row, base.field);
                }
                // v5-v7 signature: (params)
                const params = args[0] || {};
                const row = params?.row || {};
                return getFieldValue(row, base.field);
              } catch {
                // Fallback to raw value when anything goes wrong
                return args && args.length ? args[0] : "";
              }
            };
          }
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
        // Default valueFormatter tolerant of both v7 (params) and v8 (value, ctx) shapes
        if (!base.valueFormatter) {
          base.valueFormatter = (...args) => {
            try {
              const v = args && args.length ? args[0] : undefined;
              if (v == null) return "";
              return typeof v === "object" ? (v?.username || v?.name || v?.id || JSON.stringify(v)) : String(v);
            } catch {
              return "";
            }
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

  const handlePaginationChange = useCallback((model) => {
    setPaginationModel((prev) => (
      prev.page === model.page && prev.pageSize === model.pageSize ? prev : model
    ));
  }, []);

  const handleSortChange = useCallback((m) => {
    setSortModel((prev) => {
      const a = Array.isArray(prev) ? prev : [];
      const b = Array.isArray(m) ? m : [];
      const same =
        a.length === b.length &&
        ((a[0] && b[0] && a[0].field === b[0].field && a[0].sort === b[0].sort) || (!a[0] && !b[0]));
      return same ? prev : m;
    });
  }, []);

  return (
    <div className="tk-card tk-grid" style={{ width: "100%", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto", overflowY: "hidden", position: "relative", isolation: "isolate" }}>
      <div style={{ padding: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {toolbar}
        <input
          placeholder="Search…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ padding: 8, width: "min(280px, 100%)", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}
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
        onPaginationModelChange={handlePaginationChange}
        onSortModelChange={handleSortChange}
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
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={onColumnVisibilityModelChange}
        sx={{
          // Base text color to avoid theme inversion
          "& .MuiDataGrid-cell": { outline: "none !important", color: "#0f172a !important", backgroundColor: "transparent", borderRight: "1px solid #e5e7eb" },
          "& .MuiDataGrid-cellContent": { color: "#0f172a !important" },
          "& .MuiDataGrid-columnHeaderTitle": { color: "#0f172a !important", fontWeight: 600 },
          "& .MuiDataGrid-columnHeaderTitleContainerContent": { color: "#0f172a !important" },

          // Force white backgrounds for all grid surfaces to avoid partial/transparent cells
          "&.MuiDataGrid-root": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-main": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-columnHeaders": { backgroundColor: "#eef2ff", borderBottom: "1px solid #e5e7eb" },
          "& .MuiDataGrid-virtualScroller": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScrollerContent": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScrollerRenderZone": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-footerContainer": { backgroundColor: "#ffffff" },

          // Remove hover/selection tinting so rows remain solid white
          "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(99, 102, 241, 0.06) !important" },
          "& .MuiDataGrid-row.Mui-hover": { backgroundColor: "rgba(99, 102, 241, 0.06) !important" },
          "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "rgba(99, 102, 241, 0.12) !important" },
          "& .MuiDataGrid-row.Mui-selected:hover": { backgroundColor: "rgba(99, 102, 241, 0.16) !important" },
          "& .MuiDataGrid-overlay": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-filler": { backgroundColor: "#ffffff" },
          // Add table-like borders
          "& .MuiDataGrid-row:nth-of-type(odd)": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row:nth-of-type(even)": { backgroundColor: "#f8fafc" },
          "& .MuiDataGrid-row": { borderBottom: "1px solid #e5e7eb" },
          "& .MuiDataGrid-columnHeader": { borderRight: "1px solid #e5e7eb" },
          "& .MuiDataGrid-columnHeader:last-of-type": { borderRight: "none" },
          "& .MuiDataGrid-cell:last-of-type": { borderRight: "none" }
        }}
      />
    </div>
  );
}
