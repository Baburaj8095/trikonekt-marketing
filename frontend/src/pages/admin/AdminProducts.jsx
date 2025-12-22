import React, { useCallback, useMemo, useState } from "react";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  Snackbar,
  Alert,
  Box,
} from "@mui/material";

function TextInput({ label, value, onChange, placeholder, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          outline: "none",
          background: "#fff",
          ...style,
        }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          outline: "none",
          background: "#fff",
          ...style,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CreateProductDialog({ open, onClose, onCreated }) {
    const [form, setForm] = useState({
      name: "",
      description: "",
      category: "",
      price: "",
      quantity: "",
      discount: "",
      max_reward_redeem_percent: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
      image: null,
    });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const onChange = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const reset = () => {
    setForm({
      name: "",
      description: "",
      category: "",
      price: "",
      quantity: "",
      discount: "",
      max_reward_redeem_percent: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
      image: null,
    });
    setErrors({});
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose && onClose();
  };

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("description", form.description);
      fd.append("category", form.category);
      if (form.price !== "") fd.append("price", String(Number(form.price)));
      if (form.quantity !== "") fd.append("quantity", String(parseInt(form.quantity || "0", 10)));
      if (form.discount !== "") fd.append("discount", String(Number(form.discount)));
      if (form.max_reward_redeem_percent !== "") fd.append("max_reward_redeem_percent", String(Number(form.max_reward_redeem_percent)));
      fd.append("country", form.country);
      fd.append("state", form.state);
      fd.append("city", form.city);
      fd.append("pincode", form.pincode);
      if (form.image instanceof File) {
        fd.append("image", form.image);
      }

      await API.post("/products", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSnack({ open: true, type: "success", msg: "Product created." });
      onCreated && onCreated();
      reset();
      onClose && onClose();
    } catch (e) {
      const data = e?.response?.data || {};
      const mapped = {};
      for (const [k, v] of Object.entries(data)) {
        mapped[k] = Array.isArray(v) ? v.join(", ") : String(v);
      }
      setErrors(mapped);
      setSnack({
        open: true,
        type: "error",
        msg: mapped.detail || "Failed to create product.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Create Product</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 2 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              size="small"
              required
              error={!!errors.name}
              helperText={errors.name || " "}
            />
            <TextField
              label="Category"
              value={form.category}
              onChange={(e) => onChange("category", e.target.value)}
              size="small"
              required
              error={!!errors.category}
              helperText={errors.category || " "}
            />
            <TextField
              label="Price"
              value={form.price}
              onChange={(e) => onChange("price", e.target.value)}
              size="small"
              required
              type="number"
              inputProps={{ step: "0.01", min: "0" }}
              error={!!errors.price}
              helperText={errors.price || " "}
            />
            <TextField
              label="Quantity"
              value={form.quantity}
              onChange={(e) => onChange("quantity", e.target.value)}
              size="small"
              required
              type="number"
              inputProps={{ step: "1", min: "0" }}
              error={!!errors.quantity}
              helperText={errors.quantity || " "}
            />
            <TextField
              label="Discount (%)"
              value={form.discount}
              onChange={(e) => onChange("discount", e.target.value)}
              size="small"
              type="number"
              inputProps={{ step: "0.01", min: "0", max: "100" }}
              error={!!errors.discount}
              helperText={errors.discount || " "}
            />
            <TextField
              label="Max Reward Redeem %"
              value={form.max_reward_redeem_percent}
              onChange={(e) => onChange("max_reward_redeem_percent", e.target.value)}
              size="small"
              type="number"
              inputProps={{ step: "0.01", min: "0", max: "100" }}
              error={!!errors.max_reward_redeem_percent}
              helperText={errors.max_reward_redeem_percent || " "}
            />
            <TextField
              label="Country"
              value={form.country}
              onChange={(e) => onChange("country", e.target.value)}
              size="small"
              required
              error={!!errors.country}
              helperText={errors.country || " "}
            />
            <TextField
              label="State"
              value={form.state}
              onChange={(e) => onChange("state", e.target.value)}
              size="small"
              required
              error={!!errors.state}
              helperText={errors.state || " "}
            />
            <TextField
              label="City"
              value={form.city}
              onChange={(e) => onChange("city", e.target.value)}
              size="small"
              required
              error={!!errors.city}
              helperText={errors.city || " "}
            />
            <TextField
              label="Pincode"
              value={form.pincode}
              onChange={(e) => onChange("pincode", e.target.value)}
              size="small"
              required
              error={!!errors.pincode}
              helperText={errors.pincode || " "}
            />
            <Grid item xs={12} style={{ gridColumn: "1 / -1" }}>
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => onChange("description", e.target.value)}
                size="small"
                multiline
                minRows={3}
                fullWidth
                error={!!errors.description}
                helperText={errors.description || " "}
              />
            </Grid>
            <Grid item xs={12} style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onChange("image", e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                />
                <span
                  style={{
                    color: errors.image ? "#dc2626" : "transparent",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {errors.image || "placeholder"}
                </span>
              </div>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} variant="contained" disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}

export default function AdminProducts() {
  const [density, setDensity] = useState("standard");
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  // Client/server filters (API in market app usually supports pagination)
  const [filters, setFilters] = useState({
    q: "",
    active: "",
  });

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  const activeOptions = useMemo(
    () => [
      { value: "", label: "Any status" },
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
    []
  );

  const columns = useMemo(
    () => [
      { field: "id", headerName: "ID", minWidth: 90 },
      { field: "name", headerName: "Name", minWidth: 220, flex: 1 },
      { field: "category", headerName: "Category", minWidth: 140 },
      {
        field: "price",
        headerName: "Price",
        minWidth: 120,
        renderCell: (params) => {
          const v = Number(params?.row?.price || 0);
          return `₹${v.toFixed(2)}`;
        }
      },
      { field: "quantity", headerName: "Quantity", minWidth: 100 },
      {
        field: "max_reward_redeem_percent",
        headerName: "Max Redeem %",
        minWidth: 140,
        renderCell: (params) => {
          const v = Number(params?.row?.max_reward_redeem_percent || 0);
          return `${v.toFixed(2)}%`;
        }
      },
      {
        field: "active",
        headerName: "Status",
        minWidth: 120,
        renderCell: (params) => {
          const active = Number(params?.row?.quantity || 0) > 0;
          return (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 12,
                color: active ? "#065f46" : "#991b1b",
                background: active ? "#d1fae5" : "#fee2e2",
                border: `1px solid ${active ? "#10b981" : "#ef4444"}30`,
              }}
            >
              {active ? "Active" : "Inactive"}
            </span>
          );
        }
      },
    ],
    []
  );

  // Server-side fetcher mapped to market app endpoint
  const fetcher = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const params = { page, page_size: pageSize };

      // Merge filters
      if (filters.q && filters.q.trim()) params.q = filters.q.trim();
      if (filters.active) params.active = filters.active;

      // Quick search from table search
      if (search && String(search).trim()) {
        // Use same query param as filter-search to maximize compatibility
        params.q = String(search).trim();
      }
      if (ordering) params.ordering = ordering; // if backend supports ?ordering

      // Products endpoint is mounted at /api/products (see core/urls.py)
      const res = await API.get("/products", { params });
      const data = res?.data;
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const count = typeof data?.count === "number" ? data.count : results.length;
      return { results, count };
    },
    [filters, reloadKey]
  );

  const toolbar = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
      <button
        onClick={() => setReloadKey((k) => k + 1)}
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
        Refresh
      </button>
      <button
        onClick={() => setCreateOpen(true)}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #0f172a",
          background: "#0f172a",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Create Product
      </button>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Products</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Manage marketplace products. Use Create Product to add a new item. Products with quantity {'>'} 0 are purchasable; quantity = 0 appear as Sold Out to users.
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <TextInput
          label="Search"
          value={filters.q}
          onChange={(v) => setF("q", v)}
          placeholder="id / name / description / category"
        />
        <Select
          label="Status"
          value={filters.active}
          onChange={(v) => setF("active", v)}
          options={activeOptions}
        />
      </div>

      <DataTable
        key={reloadKey}
        columns={columns}
        fetcher={fetcher}
        density={density}
        toolbar={toolbar}
        checkboxSelection={true}
        onSelectionChange={() => {}}
      />

      <CreateProductDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
