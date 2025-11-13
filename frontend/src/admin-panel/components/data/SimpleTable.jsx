import React from "react";

/**
 * SimpleTable — minimal, dependency-free table for admin listings.
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
 * - search: string
 * - onSearch: (value: string) => void
 * - toolbar?: ReactNode
 */
export default function SimpleTable({
  columns = [],
  rows = [],
  loading = false,
  total = 0,
  page = 1,
  pageSize = 25,
  onPageChange,
  search = "",
  onSearch,
  toolbar,
}) {
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(pageSize) || 25)));

  const handlePrev = () => {
    if (page > 1 && onPageChange) onPageChange(page - 1);
  };
  const handleNext = () => {
    if (page < totalPages && onPageChange) onPageChange(page + 1);
  };

  return (
    <div style={{ width: "100%", background: "#ffffff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <div style={{ padding: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #e5e7eb" }}>
        {toolbar}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <input
            placeholder="Search…"
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
            style={{ padding: 8, width: 280, borderRadius: 8, border: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}
          />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    textAlign: "left",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#0f172a",
                    background: "#ffffff",
                    borderBottom: "1px solid #e5e7eb",
                    padding: "10px 12px",
                    minWidth: typeof c.width === "number" ? c.width : undefined,
                    width: typeof c.width === "string" ? c.width : undefined,
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  {c.header}
                </th>
              ))}
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
                <tr key={row.id ?? row.pk ?? row.uuid ?? idx} style={{ background: "#ffffff" }}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #e5e7eb",
                        color: "#0f172a",
                        fontSize: 14,
                        verticalAlign: "middle",
                        background: "#ffffff",
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

      <div style={{ padding: 8, display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #e5e7eb" }}>
        <button
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
