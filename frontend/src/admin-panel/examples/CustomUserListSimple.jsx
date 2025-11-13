import React from "react";
import API from "../api/client";
import SimpleTable from "../components/data/SimpleTable";
import { getAdminMeta, findModel } from "../api/adminMeta";

/**
 * CustomUserListSimple
 * - Replaces DataGrid for accounts.customuser listing
 * - Pure HTML table with server-side pagination and search
 * - Inline Sponsor ID edit (PATCH on detail endpoint)
 *
 * Assumptions:
 * - admin-meta includes a model with app_label="accounts", model="customuser"
 * - Use meta.route for list/detail (GET list with page,page_size,search; PATCH detail at :id/)
 * - Sponsor field preference order: sponsor_id, sponsor, referrer, upline_id, upline
 */
export default function CustomUserListSimple() {
  const [meta, setMeta] = React.useState(null);
  const [loadingMeta, setLoadingMeta] = React.useState(true);
  const [error, setError] = React.useState("");

  const [rows, setRows] = React.useState([]);
  const [count, setCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(25);

  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [editingId, setEditingId] = React.useState(null);
  const [editingSponsor, setEditingSponsor] = React.useState("");
  // Filters
  const [filters, setFilters] = React.useState({ role: "", category: "", pincode: "" });

  // Fetch admin meta and locate accounts.customuser (cached)
  React.useEffect(() => {
    let mounted = true;
    setLoadingMeta(true);
    setError("");
    getAdminMeta()
      .then((data) => {
        if (!mounted) return;
        const found = findModel(data, "accounts", "customuser");
        if (!found) {
          setError("accounts.customuser metadata not found");
          return;
        }
        setMeta(found);
      })
      .catch(() => setError("Failed to load admin metadata"))
      .finally(() => setLoadingMeta(false));
    return () => {
      mounted = false;
    };
  }, []);

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

  // Detect sponsor field name
  const sponsorField = React.useMemo(() => {
    if (!meta) return "sponsor_id";
    const candidates = ["sponsor_id", "sponsor", "referrer", "upline_id", "upline"];
    const fieldList = Array.isArray(meta.fields)
      ? meta.fields.map((f) => (typeof f === "string" ? f : f?.name)).filter(Boolean)
      : [];
    for (const c of candidates) {
      if (fieldList.includes(c)) return c;
    }
    // Fallback by heuristics once data is loaded
    const sample = rows[0] || {};
    const keys = Object.keys(sample);
    for (const c of candidates) {
      if (keys.includes(c)) return c;
      if (sample.fields && typeof sample.fields === "object" && c in sample.fields) return c;
      if (sample.data && typeof sample.data === "object" && c in sample.data) return c;
    }
    return "sponsor_id";
  }, [meta, rows]);

  const normalizeRows = (results) =>
    (results || []).map((r) => {
      const id = r.id ?? r.pk ?? r.uuid ?? r._id ?? r.key ?? `${Math.random()}`;
      const fieldsObj = r && typeof r === "object" && r.fields && typeof r.fields === "object" ? r.fields : {};
      const dataObj = r && typeof r === "object" && r.data && typeof r.data === "object" ? r.data : {};
      return { ...fieldsObj, ...dataObj, ...r, id };
    });

  // Debounced fetch on page/search/meta/filters changes
  React.useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = { page, page_size: pageSize };
        if (search) params.search = search;
        if (filters.role) params.role = filters.role;
        if (filters.category) params.category = filters.category;
        if (filters.pincode) params.pincode = filters.pincode;
        const { data } = await API.get(meta.route, { params });
        if (cancelled) return;
        setRows(normalizeRows(data?.results));
        setCount(data?.count || 0);
      } catch {
        if (!cancelled) {
          setRows([]);
          setCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [meta, page, pageSize, search, filters.role, filters.category, filters.pincode]);

  const startEdit = (row) => {
    setEditingId(row.id);
    const current = getFieldValue(row, sponsorField);
    setEditingSponsor(current || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingSponsor("");
  };

  const saveSponsor = async (row) => {
    if (!meta) return;
    const id = row.id ?? row.pk ?? row.uuid ?? row._id ?? row.key;
    if (!id) return;
    try {
      // PATCH to detail endpoint
      const payload = { [sponsorField]: editingSponsor };
      await API.patch(`${meta.route}${id}/`, payload);
      // Update in local rows
      setRows((prev) =>
        prev.map((r) => {
          if ((r.id ?? r.pk ?? r.uuid ?? r._id ?? r.key) === id) {
            // Attempt to set on multiple shapes
            const next = { ...r, [sponsorField]: editingSponsor };
            if (next.fields && typeof next.fields === "object") next.fields[sponsorField] = editingSponsor;
            if (next.data && typeof next.data === "object") next.data[sponsorField] = editingSponsor;
            return next;
          }
          return r;
        })
      );
      setEditingId(null);
      setEditingSponsor("");
    } catch (e) {
      alert(
        e?.response?.data?.detail
          || (e?.response?.data ? JSON.stringify(e.response.data) : "Failed to update Sponsor ID")
      );
    }
  };

  if (loadingMeta) return <div style={{ color: "#64748b" }}>Loading…</div>;
  if (error) return <div style={{ color: "#dc2626" }}>{error}</div>;
  if (!meta) return null;

  // Derive display columns
  const listDisplay = (meta.list_display && meta.list_display.length)
    ? meta.list_display
    : ["id", "username", "full_name", "email", sponsorField, "__str__"];

  // Build columns for SimpleTable (mostly rendered via getFieldValue)
  const columns = listDisplay
    .filter((name) => name && name !== "repr")
    .map((name) => {
      if (name === sponsorField) {
        return {
          key: name,
          header: "Sponsor ID",
          renderCell: (row) => {
            const val = getFieldValue(row, sponsorField);
            const isEditing = editingId === row.id;
            const canEdit = meta?.permissions?.change !== false; // default true if not specified
            if (isEditing) {
              return (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={editingSponsor}
                    onChange={(e) => setEditingSponsor(e.target.value)}
                    style={{ padding: 6, borderRadius: 6, border: "1px solid #e5e7eb", width: 160 }}
                  />
                  <button
                    onClick={() => saveSponsor(row)}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #16a34a", background: "#16a34a", color: "#fff", cursor: "pointer" }}
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              );
            }
            return (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span>{String(val || "")}</span>
                {canEdit ? (
                  <button
                    onClick={() => startEdit(row)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 12 }}
                    title="Edit Sponsor ID"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            );
          },
        };
      }
      return {
        key: name,
        header: name === "__str__" ? (meta.verbose_name_singular || "Repr") : name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        renderCell: (row) => {
          const v = getFieldValue(row, name);
          return v == null || v === "" ? "—" : String(v);
        },
      };
    });

  // Add Actions column placeholder if needed (currently not used)
  // columns.push({
  //   key: "__actions",
  //   header: "Actions",
  //   renderCell: (row) => null,
  // });

  const toolbar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "#64748b" }}>Role</label>
        <select
          value={filters.role}
          onChange={(e) => { setFilters((f) => ({ ...f, role: e.target.value })); setPage(1); }}
          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff" }}
        >
          <option value="">All</option>
          <option value="user">user</option>
          <option value="agency">agency</option>
          <option value="employee">employee</option>
          <option value="admin">admin</option>
        </select>

        <label style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>Category</label>
        <input
          value={filters.category}
          onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(1); }}
          placeholder="e.g., gold"
          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", width: 140 }}
        />

        <label style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>Pincode</label>
        <input
          value={filters.pincode}
          onChange={(e) => { setFilters((f) => ({ ...f, pincode: e.target.value })); setPage(1); }}
          placeholder="e.g., 560001"
          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", width: 120 }}
        />

        <button
          onClick={() => { setFilters({ role: "", category: "", pincode: "" }); setPage(1); }}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}
          title="Clear filters"
        >
          Clear
        </button>
      </div>
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
        onSearch={(s) => {
          setPage(1);
          setSearch(s);
        }}
        toolbar={toolbar}
      />
    </div>
  );
}
