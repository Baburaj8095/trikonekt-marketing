import React from "react";

/**
 * SimpleTable — minimal, dependency-free table for admin listings with enhanced admin UX.
 *
 * Props:
 * - columns: Array<{
 *     key: string;                  // field key (used for default accessor)
 *     header: string;               // column header
 *     width?: number | string;      // optional width
 *     renderCell?: (row) => ReactNode; // optional custom renderer
 *   }>
 * - rows: any[]
 * - loading: boolean
 * - total: number                   // total count across all pages
 * - page: number                    // 1-based page index
 * - pageSize: number
 * - onPageChange: (nextPage: number) => void
 * - pageSizeOptions?: number[]      // default [10,25,50,100]
 * - onPageSizeChange?: (nextSize: number) => void
 * - search: string
 * - onSearch: (value: string) => void
 * - toolbar?: ReactNode
 * - density?: "comfortable" | "compact"   // default "comfortable"
 * - onDensityChange?: (d: "comfortable" | "compact") => void
 * - exportable?: boolean             // default true (CSV export of current rows)
 * - onExportCsv?: () => void        // custom CSV export handler; defaults to internal exporter
 * - sortField?: string               // current sort field
 * - sortDir?: "asc" | "desc" | null  // current sort direction
 * - onSortChange?: (field: string, dir: "asc" | "desc" | null) => void
 * - sortable?: boolean               // enable clickable sortable headers (default true when onSortChange provided)
 */
export default function SimpleTable({
  columns = [],
  rows = [],
  loading = false,
  total = 0,
  page = 1,
  pageSize = 25,
  onPageChange,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
  search = "",
  onSearch,
  toolbar,
  density = "comfortable",
  onDensityChange,
  exportable = true,
  onExportCsv,
  sortField = null,
  sortDir = null,
  onSortChange,
  sortable,
}) {
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(pageSize) || 25)));
  const isSortable = typeof sortable === "boolean" ? sortable : !!onSortChange;

  const handlePrev = () => {
    if (page > 1 && onPageChange) onPageChange(page - 1);
  };
  const handleNext = () => {
    if (page < totalPages && onPageChange) onPageChange(page + 1);
  };

  const cellPad = density === "compact" ? "6px 8px" : "10px 12px";
  const headerPad = density === "compact" ? "8px 8px" : "10px 12px";

  function defaultExportCsv() {
    try {
      const visibleCols = (columns || []).filter((c) => !!c && !!c.key);
      const headers = visibleCols.map((c) => c.header ?? c.key);
      const escape = (v) => {
        if (v == null) return "";
        const s = String(v);
        if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const lines = [];
      lines.push(headers.map(escape).join(","));
      for (const row of rows || []) {
        const line = visibleCols.map((c) => {
          // Prefer raw row data for exports to avoid React nodes from renderers
          const raw = row?.[c.key];
          if (raw == null) return "";
          if (typeof raw === "object") {
            // Common primitives within objects
            return raw.username || raw.name || raw.id || JSON.stringify(raw);
          }
          return String(raw);
        });
        lines.push(line.map(escape).join(","));
      }
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `export-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      // no-op; upstream can toast errors
      console.error("CSV export failed", e);
    }
  }

  function handleHeaderClick(colKey) {
    if (!isSortable || !onSortChange) return;
    let nextDir = "asc";
    if (sortField === colKey) {
      if (sortDir === "asc") nextDir = "desc";
      else if (sortDir === "desc") nextDir = null;
      else nextDir = "asc";
    }
    onSortChange(colKey, nextDir);
  }

  function SortIndicator({ active, dir }) {
    if (!active || !dir) return null;
    return (
      <span style={{ fontSize: 10, color: "#64748b", marginLeft: 6 }}>
        {dir === "asc" ? "▲" : "▼"}
      </span>
    );
  }

  return (
    <div className="tk-card" style={{ width: "100%", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div style={{ padding: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb" }}>
        {toolbar}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>Density</label>
            <div style={{ display: "inline-flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <button
                onClick={() => onDensityChange?.("comfortable")}
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
                onClick={() => onDensityChange?.("compact")}
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

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>Rows</label>
            <select
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              {(pageSizeOptions || [10, 25, 50, 100]).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {exportable ? (
            <button
              className="tk-btn"
              onClick={() => (onExportCsv ? onExportCsv() : defaultExportCsv())}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Export CSV (page)
            </button>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              placeholder="Search…"
              value={search}
              onChange={(e) => onSearch?.(e.target.value)}
              style={{ padding: 8, width: "min(280px, 100%)", borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}
            />
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              {(columns || []).map((c, idx) => {
                const isActive = sortField === c.key;
                const clickable = isSortable;
                return (
                  <th
                    key={c.key}
                    onClick={() => clickable && handleHeaderClick(c.key)}
                    style={{
                      textAlign: "left",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#0f172a",
                      background: "#ffffff",
                      borderBottom: "1px solid #e5e7eb",
                      borderRight: idx === ((columns?.length || 1) - 1) ? "none" : "1px solid #e5e7eb",
                      borderLeft: idx === 0 ? "1px solid #e5e7eb" : undefined,
                      padding: headerPad,
                      minWidth: typeof c.width === "number" ? c.width : undefined,
                      width: typeof c.width === "string" ? c.width : undefined,
                      position: "sticky",
                      top: 0,
                      left: idx === 0 ? 0 : undefined,
                      zIndex: idx === 0 ? 3 : 1,
                      cursor: clickable ? "pointer" : "default",
                      userSelect: "none",
                    }}
                    title={clickable ? "Click to sort" : undefined}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center" }}>
                      {c.header}
                      <SortIndicator active={isActive} dir={sortDir} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 16, color: "#64748b" }}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 16, color: "#64748b" }}>
                  No data
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.id ?? row.pk ?? row.uuid ?? idx}
                  style={{
                    background: idx % 2 === 0 ? "#ffffff" : "#f9fafb",
                  }}
                >
                  {columns.map((c, cIdx) => (
                    <td
                      key={c.key}
                      style={{
                        padding: cellPad,
                        borderBottom: "1px solid #e5e7eb",
                        borderRight: cIdx === ((columns?.length || 1) - 1) ? "none" : "1px solid #e5e7eb",
                        borderLeft: cIdx === 0 ? "1px solid #e5e7eb" : undefined,
                        color: "#0f172a",
                        fontSize: 14,
                        verticalAlign: "middle",
                        background: "inherit",
                        position: cIdx === 0 ? "sticky" : undefined,
                        left: cIdx === 0 ? 0 : undefined,
                        zIndex: cIdx === 0 ? 2 : 1,
                        backgroundColor: cIdx === 0 ? (idx % 2 === 0 ? "#ffffff" : "#f9fafb") : "inherit",
                      }}
                    >
                      {c.renderCell ? c.renderCell(row) : String(row?.[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: 8, display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        <button
          className="tk-btn"
          onClick={handlePrev}
          disabled={page <= 1}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: page <= 1 ? "not-allowed" : "pointer",
          }}
        >
          Prev
        </button>
        <button
          className="tk-btn"
          onClick={handleNext}
          disabled={page >= totalPages}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
        >
          Next
        </button>
        <div style={{ color: "#64748b", marginLeft: 8 }}>
          Page {page} of {totalPages} • Total {total}
        </div>
      </div>
    </div>
  );
}
