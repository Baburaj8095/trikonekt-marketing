import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Tooltip,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import API from "../../api/api";

function useDebounced(delay = 450) {
  const [t, setT] = useState(null);
  return (fn) => {
    if (t) clearTimeout(t);
    const nt = setTimeout(() => {
      try { fn(); } catch {}
    }, delay);
    setT(nt);
  };
}

export default function AdminMerchantSubcategories() {
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Filters
  const [filterCat, setFilterCat] = useState("");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category_id: "", is_active: true, sort_order: 0, audience: "CONSUMER" });

  // Infer if list returns category object or id
  function getRowCategoryId(row) {
    if (!row) return "";
    if (row.category && typeof row.category === "object") {
      const cid = row.category.id ?? row.category.category_id ?? row.category.pk;
      return cid != null ? String(cid) : "";
    }
    if (row.category_id != null) return String(row.category_id);
    if (row.category != null) return String(row.category);
    return "";
  }
  function getRowCategoryName(row) {
    if (!row) return "";
    if (row.category && typeof row.category === "object") {
      return row.category.name || "";
    }
    const cid = getRowCategoryId(row);
    if (!cid) return "";
    const m = (cats || []).find((c) => String(c.id) === String(cid));
    return m ? (m.name || `#${cid}`) : `#${cid}`;
  }

  const filtered = useMemo(() => {
    let list = Array.isArray(rows) ? [...rows] : [];
    const q = String(search || "").trim().toLowerCase();
    if (filterCat) {
      list = list.filter((r) => String(getRowCategoryId(r)) === String(filterCat));
    }
    if (q) {
      list = list.filter((r) => String(r?.name || "").toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const sa = Number(a?.sort_order || 0), sb = Number(b?.sort_order || 0);
      if (sa !== sb) return sa - sb;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
    return list;
  }, [rows, search, filterCat, cats]);

  async function loadCats() {
    try {
      const res = await API.get("/merchant/admin/categories/", { dedupe: "cancelPrevious" });
      const arr = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setCats(Array.isArray(arr) ? arr : []);
    } catch (e) {
      // soft
    }
  }
  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/merchant/admin/subcategories/", { dedupe: "cancelPrevious" });
      const arr = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setRows(Array.isArray(arr) ? arr : []);
    } catch (e) {
      setError("Failed to load subcategories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCats();
    loadList();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", category_id: filterCat || "", is_active: true, sort_order: 0, audience: "CONSUMER" });
    setDialogOpen(true);
  }
  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row?.name || "",
      category_id: getRowCategoryId(row) || "",
      is_active: !!row?.is_active,
      sort_order: Number(row?.sort_order || 0),
      audience: String(row?.audience || "CONSUMER"),
    });
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
  }

  async function createOrUpdateSubcategory(payload, id = null) {
    try {
      if (id) {
        await API.patch(`/merchant/admin/subcategories/${encodeURIComponent(id)}/`, payload);
        return true;
      } else {
        await API.post("/merchant/admin/subcategories/", payload);
        return true;
      }
    } catch (e) {
      // Retry with alternate field name for category
      const cid = form.category_id;
      if (!cid) throw e;
      const alt = { ...payload };
      if ("category" in alt) delete alt.category;
      if ("category_id" in alt) delete alt.category_id;
      // If first attempt used category, switch to category_id, else vice versa
      if (payload.category != null) {
        alt.category_id = cid;
      } else {
        alt.category = cid;
      }
      if (id) {
        await API.patch(`/merchant/admin/subcategories/${encodeURIComponent(id)}/`, alt);
      } else {
        await API.post("/merchant/admin/subcategories/", alt);
      }
      return true;
    }
  }

  async function handleSave() {
    const name = String(form.name || "").trim();
    const categoryId = String(form.category_id || "");
    if (!name) {
      setError("Name is required");
      return;
    }
    if (!categoryId) {
      setError("Category is required");
      return;
    }
    // Try sending with "category" field first
    const payload = {
      name,
      is_active: !!form.is_active,
      sort_order: Number(form.sort_order || 0),
      category: categoryId,
      audience: String(form.audience || "CONSUMER"),
    };
    try {
      await createOrUpdateSubcategory(payload, editing ? editing.id : null);
      setOkMsg(editing ? "Subcategory updated" : "Subcategory created");
      setDialogOpen(false);
      await loadList();
    } catch (e) {
      setError(editing ? "Update failed" : "Create failed");
    }
  }

  async function handleDelete(row) {
    const yes = window.confirm(`Delete subcategory "${row?.name}"?`);
    if (!yes) return;
    try {
      await API.delete(`/merchant/admin/subcategories/${encodeURIComponent(row.id)}/`);
      setOkMsg("Subcategory deleted");
      await loadList();
    } catch (e) {
      setError("Delete failed");
    }
  }

  async function patchRow(id, body, okText = "Saved") {
    try {
      await API.patch(`/merchant/admin/subcategories/${encodeURIComponent(id)}/`, body);
      setOkMsg(okText);
      await loadList();
    } catch (e) {
      setError("Save failed");
    }
  }

  const debounced = useDebounced(450);

  function handleInlineSortChange(row, value) {
    const val = String(value || "").replace(/[^\d-]/g, "");
    setRows((prev) =>
      (prev || []).map((r) => (r.id === row.id ? { ...r, sort_order: val === "" ? "" : Number(val) } : r))
    );
    debounced(async () => {
      const num = val === "" ? 0 : Number(val);
      await patchRow(row.id, { sort_order: num }, "Sort order updated");
    });
  }

  function handleToggleActive(row, checked) {
    setRows((prev) => (prev || []).map((r) => (r.id === row.id ? { ...r, is_active: !!checked } : r)));
    patchRow(row.id, { is_active: !!checked }, checked ? "Activated" : "Deactivated");
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Merchant Subcategories
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Category</InputLabel>
            <Select
              label="Category"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              displayEmpty
            >
              <MenuItem value=""><em>All</em></MenuItem>
              {(cats || []).map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Search by name”¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={() => { loadCats(); loadList(); }} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Add Subcategory
          </Button>
        </Box>
      </Box>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Audience</TableCell>
                <TableCell>Sort Order</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(filtered || []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{getRowCategoryName(row)}</TableCell>
                  <TableCell>
                    <Switch checked={!!row.is_active} onChange={(e) => handleToggleActive(row, e.target.checked)} />
                  </TableCell>
                  <TableCell>{row?.audience || "CONSUMER"}</TableCell>
                  <TableCell sx={{ width: 140 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={row.sort_order ?? 0}
                      onChange={(e) => handleInlineSortChange(row, e.target.value)}
                      onBlur={(e) => handleInlineSortChange(row, e.target.value)}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton onClick={() => openEdit(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton color="error" onClick={() => handleDelete(row)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && (filtered || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No subcategories found
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Subcategory" : "Add Subcategory"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                required
              >
                {(cats || []).map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
              fullWidth
            />
            <TextField
              label="Sort Order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value || 0) }))}
              fullWidth
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Switch
                checked={!!form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <Typography>Active</Typography>
            </Box>
            <FormControl fullWidth>
              <InputLabel>Audience</InputLabel>
              <Select
                label="Audience"
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                required
              >
                <MenuItem value="CONSUMER">Consumer</MenuItem>
                <MenuItem value="MERCHANT">Merchant</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editing ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError("")}>
        <Alert severity="error" onClose={() => setError("")} sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!okMsg} autoHideDuration={2500} onClose={() => setOkMsg("")}>
        <Alert severity="success" onClose={() => setOkMsg("")} sx={{ width: "100%" }}>
          {okMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
