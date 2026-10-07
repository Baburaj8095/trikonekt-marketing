import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Box, Pagination, PaginationItem, MenuItem, Select as MuiSelect, Typography } from "@mui/material";

/**
 * Reusable server-side DataGrid wrapper with full sorting and numbered pagination.
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
  extraKey,
}) {
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: "id", sort: "asc" }]);
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
      : "id";
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
        return { ...fieldsObj, ...dataObj, ...r, id: fallbackId };
      });
      if (mySeq === reqSeq.current) {
        const baseIndex = (paginationModel.page || 0) * (paginationModel.pageSize || 0);
        const withIndex = normalized.map((row, i) => ({
          ...row,
          __slno: baseIndex + i + 1,
          __slnoPage: i + 1,
        }));
        setRows(withIndex);
        setRowCount(count || 0);
      }
    } catch (e) {
      // no-op
    } finally {
      if (mySeq === reqSeq.current) {
        setLoading(false);
      }
    }
  }, [fetcher, paginationModel, sortModel, search, extraKey]);

  useEffect(() => {
    // On search change: reset to first page
    setPaginationModel((m) => (m.page !== 0 ? { ...m, page: 0 } : m));
  }, [search]);

  useEffect(() => {
    load();
  }, [load, instanceKey]);

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

  // Field resolver with nested path support and special cases
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
        // Default valueGetter robust to MUI X signatures
        if (!base.valueGetter) {
          const f = String(base.field || "");
          if (f.startsWith("__")) {
            base.valueGetter = () => "";
          } else {
            base.valueGetter = (...args) => {
              try {
                if (args.length >= 2 && args[1] && typeof args[1] === "object" && !("row" in (args[0] || {}))) {
                  const [, row] = args;
                  return getFieldValue(row, base.field);
                }
                const params = args[0] || {};
                const row = params?.row || {};
                return getFieldValue(row, base.field);
              } catch {
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
            if (v == null || v === "") return "";
            return String(v);
          };
        }
        // Default valueFormatter
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
    setPaginationModel((prev) => {
      if (prev.page === model.page && prev.pageSize === model.pageSize) return prev;
      return model;
    });
  }, []);

  const handleSortChange = useCallback((m) => {
    setSortModel(Array.isArray(m) ? m : []);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  const totalPages = Math.max(1, Math.ceil(rowCount / paginationModel.pageSize));
  const currentPage = Math.min(paginationModel.page + 1, totalPages);
  const startEntry = rowCount === 0 ? 0 : paginationModel.page * paginationModel.pageSize + 1;
  const endEntry = Math.min((paginationModel.page + 1) * paginationModel.pageSize, rowCount);

  return (
    <div className="tk-card tk-grid" style={{ width: "100%", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb", overflowX: "auto", overflowY: "hidden", position: "relative", isolation: "isolate" }}>
      <div style={{ padding: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {toolbar}
        <input
          placeholder="Search records..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ padding: "8px 12px", width: "min(280px, 100%)", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "#ffffff", fontSize: 13, outline: "none" }}
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
        sortModel={sortModel}
        onSortModelChange={handleSortChange}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        onRowDoubleClick={(p) => onRowEdit?.(p.row)}
        disableRowSelectionOnClick
        density={density}
        checkboxSelection={checkboxSelection}
        hideFooterPagination={true}
        onRowSelectionModelChange={(m) => {
          setSelection(m);
          onSelectionChange?.(m);
        }}
        // Ensure stable row identity and visible row heights
        getRowId={(row) => row.id ?? row.pk ?? row.uuid ?? row._id ?? row.key}
        rowHeight={52}
        columnHeaderHeight={44}
        disableVirtualization
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={onColumnVisibilityModelChange}
        sx={{
          // Base text color to avoid theme inversion
          "& .MuiDataGrid-cell": {
            outline: "none !important",
            color: "#0f172a !important",
            backgroundColor: "transparent",
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
          },
          "& .MuiDataGrid-cell--textCenter": { justifyContent: "center" },
          "& .MuiDataGrid-cellContent": { color: "#0f172a !important" },
          "& .MuiDataGrid-columnHeaderTitle": { color: "#0f172a !important", fontWeight: 700 },
          "& .MuiDataGrid-columnHeaderTitleContainerContent": { color: "#0f172a !important" },

          // Force solid backgrounds for all grid surfaces
          "&.MuiDataGrid-root": { backgroundColor: "#ffffff", border: "none" },
          "& .MuiDataGrid-main": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f8fafc", borderBottom: "1.5px solid #cbd5e1" },
          "& .MuiDataGrid-virtualScroller": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScrollerContent": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-virtualScrollerRenderZone": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-footerContainer": { display: "none" },

          // Rows hover/striped styling
          "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(79, 70, 229, 0.04) !important" },
          "& .MuiDataGrid-row.Mui-selected": { backgroundColor: "rgba(79, 70, 229, 0.08) !important" },
          "& .MuiDataGrid-overlay": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-filler": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row:nth-of-type(odd)": { backgroundColor: "#ffffff" },
          "& .MuiDataGrid-row:nth-of-type(even)": { backgroundColor: "#f8fafc" },
          "& .MuiDataGrid-row": { borderBottom: "1px solid #e2e8f0" },
          "& .MuiDataGrid-columnHeader": { borderRight: "1px solid #e2e8f0" },
          "& .MuiDataGrid-columnHeader:last-of-type": { borderRight: "none" },
          "& .MuiDataGrid-cell:last-of-type": { borderRight: "none" }
        }}
      />

      {/* ── NUMBERED PAGINATION BAR (Enterprise Standard with Page Buttons) ── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderTop: "1px solid #e2e8f0",
          bgcolor: "#ffffff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 12.5, color: "#64748b", fontWeight: 700 }}>
            Rows per page:
          </Typography>
          <MuiSelect
            size="small"
            value={paginationModel.pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              setPaginationModel({ page: 0, pageSize: newSize });
            }}
            sx={{
              height: 32,
              fontSize: 12.5,
              fontWeight: 800,
              borderRadius: "8px",
              bgcolor: "#f8fafc",
              "& .MuiSelect-select": { py: 0.5, px: 1.25 },
            }}
          >
            {[10, 25, 50, 100].map((size) => (
              <MenuItem key={size} value={size} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                {size}
              </MenuItem>
            ))}
          </MuiSelect>
          <Typography sx={{ fontSize: 12.5, color: "#475569", fontWeight: 700, ml: 1 }}>
            Showing {startEntry}–{endEntry} of {rowCount.toLocaleString("en-IN")} records
          </Typography>
        </Box>

        <Pagination
          color="primary"
          shape="rounded"
          variant="outlined"
          page={currentPage}
          count={totalPages}
          onChange={(_, val) => {
            setPaginationModel((prev) => ({ ...prev, page: val - 1 }));
          }}
          showFirstButton
          showLastButton
          siblingCount={1}
          boundaryCount={1}
          renderItem={(item) => (
            <PaginationItem
              {...item}
              sx={{
                fontWeight: 800,
                fontSize: 12.5,
                minWidth: 32,
                height: 32,
                borderRadius: "8px",
                "&.Mui-selected": {
                  bgcolor: "#4F46E5 !important",
                  color: "#ffffff",
                  borderColor: "#4F46E5",
                },
              }}
            />
          )}
        />
      </Box>
    </div>
  );
}
