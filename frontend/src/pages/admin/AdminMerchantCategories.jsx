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

function useDebouncedCallback(callback, delay = 400) {
  const [timer, setTimer] = useState(null);
  return (fn) => {
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => {
      try { callback(); } finally { }
    }, delay);
    setTimer(t);
  };
}

export default function AdminMerchantCategories() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // row or null
  const [form, setForm] = useState({ name: "", is_active: true, sort_order: 0, icon_like: "", audience: "CONSUMER" });

  const iconFieldKey = useMemo(() => {
    // Attempt to detect optional icon/image field to support UI hinting if backend provides it
    // Common candidates: icon, icon_url, image, image_url
    const sample = rows && rows.length ? rows[0] : null;
    if (!sample || typeof sample !== "object") return null;
    const keys = Object.keys(sample || {}).map((k) => String(k).toLowerCase());
    if (keys.includes("icon")) return "icon";
    if (keys.includes("icon_url")) return "icon_url";
    if (keys.includes("image")) return "image";
    if (keys.includes("image_url")) return "image_url";
    return null;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(rows) ? [...rows] : [];
    if (q) {
      list = list.filter((r) => String(r?.name || "").toLowerCase().includes(q));
    }
    // sort by sort_order asc, then name
    list.sort((a, b) => {
      const sa = Number(a?.sort_order || 0);
      const sb = Number(b?.sort_order || 0);
      if (sa !== sb) return sa - sb;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
    return list;
  }, [rows, search]);

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/merchant/admin/categories/", { dedupe: "cancelPrevious" });
      const data = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", is_active: true, sort_order: 0, icon_like: "", audience: "CONSUMER" });
    setDialogOpen(true);
  }
  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row?.name || "",
      is_active: !!row?.is_active,
      sort_order: Number(row?.sort_order || 0),
      icon_like: iconFieldKey ? String(row?.[iconFieldKey] || "") : "",
      audience: String(row?.audience || "CONSUMER"),
    });
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
  }

  async function handleSave() {
    const payload = {
      name: String(form.name || "").trim(),
      is_active: !!form.is_active,
      sort_order: Number(form.sort_order || 0),
      audience: String(form.audience || "CONSUMER"),
    };
    if (!payload.name) {
      setError("Name is required");
      return;
    }
    if (iconFieldKey && String(form.icon_like || "").trim() !== "") {
      payload[iconFieldKey] = form.icon_like;
    }
    try {
      if (editing) {
        await API.patch(`/merchant/admin/categories/${encodeURIComponent(editing.id)}/`, payload);
        setOkMsg("Category updated");
      } else {
        await API.post("/merchant/admin/categories/", payload);
        setOkMsg("Category created");
      }
      setDialogOpen(false);
      await loadList();
    } catch (e) {
      setError(editing ? "Update failed" : "Create failed");
    }
  }

  async function handleDelete(row) {
    const yes = window.confirm(`Delete category "${row?.name}"?`);
    if (!yes) return;
    try {
      await API.delete(`/merchant/admin/categories/${encodeURIComponent(row.id)}/`);
      setOkMsg("Category deleted");
      await loadList();
    } catch (e) {
      setError("Delete failed");
    }
  }

  async function patchRow(id, body, okText = "Saved") {
    try {
      await API.patch(`/merchant/admin/categories/${encodeURIComponent(id)}/`, body);
      setOkMsg(okText);
      await loadList();
    } catch (e) {
      setError("Save failed");
    }
  }

  const debounced = useDebouncedCallback(() => {}, 450);

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
    // Optimistic UI
    setRows((prev) => (prev || []).map((r) => (r.id === row.id ? { ...r, is_active: !!checked } : r)));
    patchRow(row.id, { is_active: !!checked }, checked ? "Activated" : "Deactivated");
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Merchant Categories
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search by name”¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={loadList} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Add
          </Button>
        </Box>
      </Box>

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                {iconFieldKey ? <TableCell>Icon</TableCell> : null}
                <TableCell>Active</TableCell>
                <TableCell>Audience</TableCell>
                <TableCell>Sort Order</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(filtered || []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  {iconFieldKey ? (
                    <TableCell>
                      {row?.[iconFieldKey] ? (
                        <a href={row[iconFieldKey]} target="_blank" rel="noreferrer">
                          {String(row[iconFieldKey]).slice(0, 48)}
                        </a>
                      ) : (
                        "””"
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Switch
                      checked={!!row.is_active}
                      onChange={(e) => handleToggleActive(row, e.target.checked)}
                    />
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
                  <TableCell>
                    {row?.created_at ? new Date(row.created_at).toLocaleString() : "””"}
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
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No categories found
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
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
              >
                <MenuItem value="CONSUMER">Consumer</MenuItem>
                <MenuItem value="MERCHANT">Merchant</MenuItem>
              </Select>
            </FormControl>
            {iconFieldKey ? (
              <TextField
                label={iconFieldKey.replaceAll("_", " ").toUpperCase()}
                value={form.icon_like}
                onChange={(e) => setForm((f) => ({ ...f, icon_like: e.target.value }))}
                placeholder="https://example.com/icon.png"
                fullWidth
              />
            ) : null}
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
