import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import API from "../../../api/api";

function EditDialog({ open, onClose, product, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: product?.name || "",
    description: product?.description || "",
    category: product?.category || "",
    price: product?.price || "",
    quantity: product?.quantity || "",
    discount: product?.discount || "",
    image: null,
    country: product?.country || "",
    state: product?.state || "",
    city: product?.city || "",
    pincode: product?.pincode || "",
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || "",
        description: product.description || "",
        category: product.category || "",
        price: product.price || "",
        quantity: product.quantity || "",
        discount: product.discount || "",
        image: null,
        country: product.country || "",
        state: product.state || "",
        city: product.city || "",
        pincode: product.pincode || "",
      });
    }
  }, [product?.id]);

  const onChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") setForm((f) => ({ ...f, image: files?.[0] || null }));
    else setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async () => {
    if (!product?.id) return;
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("description", form.description || "");
      fd.append("category", form.category || "");
      fd.append("price", String(form.price));
      fd.append("quantity", String(form.quantity));
      fd.append("discount", String(form.discount || 0));
      if (form.image) fd.append("image", form.image);
      fd.append("country", form.country || "");
      fd.append("state", form.state || "");
      fd.append("city", form.city || "");
      fd.append("pincode", form.pincode || "");

      await API.put(`/products/${product.id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Product</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2, mt: 1 }}>
          <TextField label="Name" name="name" value={form.name} onChange={onChange} fullWidth />
          <TextField label="Category" name="category" value={form.category} onChange={onChange} fullWidth />
          <TextField label="Description" name="description" value={form.description} onChange={onChange} fullWidth multiline minRows={2} />
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            <TextField label="Price" name="price" value={form.price} onChange={onChange} />
            <TextField label="Quantity" name="quantity" value={form.quantity} onChange={onChange} />
            <TextField label="Discount (%)" name="discount" value={form.discount} onChange={onChange} />
          </Box>
          <Button variant="outlined" component="label">
            {form.image ? "Change Image" : "Upload New Image"}
            <input type="file" name="image" accept="image/*" hidden onChange={onChange} />
          </Button>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            <TextField label="Country" name="country" value={form.country} onChange={onChange} />
            <TextField label="State" name="state" value={form.state} onChange={onChange} />
            <TextField label="City" name="city" value={form.city} onChange={onChange} />
            <TextField label="Pincode" name="pincode" value={form.pincode} onChange={onChange} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={onSubmit} variant="contained" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ProductList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const [editRow, setEditRow] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await API.get("/products", { params: { mine: 1 } });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(arr);
    } catch (e) {
      setRows([]);
      setSnack({ open: true, type: "error", msg: "Failed to load products" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      setBusyId(id);
      await API.delete(`/products/${id}`);
      setSnack({ open: true, type: "success", msg: "Deleted" });
      await load();
    } catch {
      setSnack({ open: true, type: "error", msg: "Failed to delete" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#0C2D48" }}>
        My Products
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} /> <Typography variant="body2">Loading...</Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Image</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Qty</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell>Location</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(rows || []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.image_url ? (
                    <Box component="img" src={p.image_url} alt={p.name} sx={{ width: 64, height: 48, objectFit: "cover", borderRadius: 1 }} />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell>₹{Number(p.price || 0).toFixed(2)}</TableCell>
                <TableCell>{p.quantity}</TableCell>
                <TableCell>{Number(p.discount || 0)}%</TableCell>
                <TableCell>{[p.city, p.state, p.country, p.pincode].filter(Boolean).join(", ")}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setEditRow(p)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" disabled={busyId === p.id} onClick={() => onDelete(p.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {(!rows || rows.length === 0) && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary">No products yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <EditDialog
        open={!!editRow}
        onClose={() => setEditRow(null)}
        product={editRow}
        onSaved={load}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
