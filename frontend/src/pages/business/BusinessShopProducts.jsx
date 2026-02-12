import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  Alert,
  Stack,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import {
  listMyShopProducts,
  createMyShopProduct,
  updateMyShopProduct,
  deleteMyShopProduct,
} from "../../api/api";

function ProductCard({ p, onEdit, onToggleActive, onDelete }) {
  return (
    <Paper elevation={1} sx={{ p: 1.25, borderRadius: 2, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ height: 120, borderRadius: 1, overflow: "hidden", bgcolor: "#f8fafc", mb: 1 }}>
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "text.secondary", fontSize: 12 }}>
            No image
          </Box>
        )}
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap title={p.title}>
        {p.title}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
        <Typography variant="body2">₹{Number(p.price).toFixed(2)}</Typography>
        {Number(p.discount_percent) > 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ textDecoration: "line-through" }}>
            ₹{Number(p.mrp).toFixed(2)}
          </Typography>
        ) : null}
        {Number(p.discount_percent) > 0 ? (
          <Chip size="small" color="success" label={`${Number(p.discount_percent).toFixed(0)}% OFF`} />
        ) : null}
      </Box>

      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
        {p.online_delivery ? <Chip size="small" label="Online" /> : null}
        {p.offline_delivery ? <Chip size="small" label="Offline" /> : null}
        <Chip
          size="small"
          label={p.stock_qty > 0 ? `Stock: ${p.stock_qty}` : "Out of stock"}
          color={p.stock_qty > 0 ? "default" : "warning"}
        />
        <Chip
          size="small"
          label={p.is_active ? "Active" : "Hidden"}
          color={p.is_active ? "success" : "default"}
          variant={p.is_active ? "filled" : "outlined"}
        />
      </Box>

      <Box sx={{ mt: "auto", display: "flex", justifyContent: "space-between", pt: 1 }}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(p)} sx={{ bgcolor: "#f1f5f9" }}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={p.is_active ? "Disable (hide from public)" : "Enable (show publicly)"}>
          <IconButton
            size="small"
            onClick={() => onToggleActive(p)}
            sx={{ bgcolor: p.is_active ? "#f0fdf4" : "#f8fafc" }}
          >
            {p.is_active ? <CheckCircleIcon color="success" fontSize="small" /> : <BlockIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(p)} sx={{ bgcolor: "#fef2f2" }}>
            <DeleteOutlineIcon color="error" fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}

function ProductDialog({ open, onClose, onSubmit, initial = null }) {
  const isEdit = !!(initial && initial.id);
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [mrp, setMrp] = useState(initial?.mrp ?? "");
  const [discount, setDiscount] = useState(initial?.discount_percent ?? 0);
  const [price, setPrice] = useState(initial?.price ?? "");
  const [online, setOnline] = useState(initial?.online_delivery ?? false);
  const [offline, setOffline] = useState(initial?.offline_delivery ?? true);
  const [stock, setStock] = useState(initial?.stock_qty ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [image, setImage] = useState(null);
  const [imgUrl, setImgUrl] = useState(initial?.image_url || "");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title || "");
      setDescription(initial?.description || "");
      setMrp(initial?.mrp ?? "");
      setDiscount(initial?.discount_percent ?? 0);
      setPrice(initial?.price ?? "");
      setOnline(initial?.online_delivery ?? false);
      setOffline(initial?.offline_delivery ?? true);
      setStock(initial?.stock_qty ?? 0);
      setIsActive(initial?.is_active ?? true);
      setImage(null);
      setImgUrl(initial?.image_url || "");
    }
  }, [open, initial]);

  useEffect(() => {
    const m = Number(mrp);
    const d = Number(discount);
    if (!Number.isNaN(m) && !Number.isNaN(d)) {
      try {
        const p = (m * (1 - d / 100));
        if (!Number.isNaN(p)) {
          setPrice((Math.round(p * 100) / 100).toFixed(2));
        }
      } catch (_) {}
    }
  }, [mrp, discount]);

  const handlePickImage = (e) => {
    const f = e?.target?.files?.[0] || null;
    setImage(f);
    setImgUrl(f ? URL.createObjectURL(f) : "");
  };

  const handleSubmit = async () => {
    const payload = {
      title,
      description,
      mrp,
      discount_percent: discount,
      price,
      online_delivery: online,
      offline_delivery: offline,
      stock_qty: stock,
      is_active: isActive,
      image,
    };
    await onSubmit(payload, initial?.id || null);
  };

  const disabled = !String(title || "").trim() || mrp === "" || Number.isNaN(Number(mrp));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? "Edit Product" : "Add Product"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="MRP (₹)"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              type="number"
              fullWidth
              required
            />
            <TextField
              label="Discount %"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              type="number"
              fullWidth
            />
          </Stack>
          <TextField
            label="Price (₹)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            fullWidth
            helperText="Auto-calculated from MRP and Discount. You can override."
          />
          <Stack direction="row" spacing={2}>
            <FormControlLabel
              control={<Checkbox checked={online} onChange={(e) => setOnline(e.target.checked)} />}
              label="Online delivery"
            />
            <FormControlLabel
              control={<Checkbox checked={offline} onChange={(e) => setOffline(e.target.checked)} />}
              label="Offline delivery"
            />
          </Stack>
          <TextField
            label="Stock Quantity"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            type="number"
            fullWidth
          />
          <FormControlLabel
            control={<Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label="Active (visible to consumers)"
          />
          <Button
            component="label"
            variant="outlined"
            startIcon={<AddPhotoAlternateIcon />}
            sx={{ alignSelf: "flex-start" }}
          >
            {image ? "Change Image" : "Upload Image"}
            <input hidden type="file" accept="image/*" onChange={handlePickImage} />
          </Button>
          {imgUrl ? (
            <Box sx={{ mt: 1 }}>
              <img src={imgUrl} alt="preview" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 8 }} />
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={disabled} onClick={handleSubmit}>
          {isEdit ? "Save Changes" : "Add Product"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function BusinessShopProducts() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await listMyShopProducts(shopId);
      const arr = Array.isArray(res) ? res : res?.results || [];
      setRows(arr);
    } catch (_) {
      setErr("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (shopId) load();
  }, [shopId]);

  const handleAdd = () => {
    setEditItem(null);
    setDlgOpen(true);
  };
  const handleEdit = (p) => {
    setEditItem(p);
    setDlgOpen(true);
  };
  const handleClose = () => {
    if (!saving) setDlgOpen(false);
  };

  const handleSubmit = async (payload, id = null) => {
    try {
      setSaving(true);
      setErr("");
      setSuccess("");
      if (id) {
        await updateMyShopProduct(id, payload);
        setSuccess("Product updated.");
      } else {
        await createMyShopProduct(shopId, payload);
        setSuccess("Product added.");
      }
      setDlgOpen(false);
      setEditItem(null);
      await load();
    } catch (e) {
      setErr(
        (e?.response?.data && (e.response.data.detail || JSON.stringify(e.response.data))) ||
        "Save failed. Please verify fields."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p) => {
    try {
      await updateMyShopProduct(p.id, { is_active: !p.is_active });
      await load();
    } catch (_) {
      setErr("Failed to toggle visibility.");
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try {
      await deleteMyShopProduct(p.id);
      await load();
    } catch (_) {
      setErr("Delete failed.");
    }
  };

  return (
    <Box sx={{ px: 1.5, pb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Shop Products
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate("/business/shops")}>
            Back to Shops
          </Button>
          <Button variant="contained" startIcon={<Inventory2Icon />} onClick={handleAdd}>
            Add Product
          </Button>
        </Stack>
      </Box>

      {err ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {err}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 1 }}>
          {success}
        </Alert>
      ) : null}

      {/* GRID */}
      <Grid container spacing={1.25}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Grid item key={i} xs={6} sm={4} md={3}>
                <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2, mb: 1 }} />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="60%" />
              </Grid>
            ))
          : (rows || []).map((p) => (
              <Grid item key={p.id} xs={6} sm={4} md={3}>
                <ProductCard
                  p={p}
                  onEdit={handleEdit}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                />
              </Grid>
            ))}
        {!loading && (rows || []).length === 0 ? (
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              No products found. Click "Add Product" to create your first item.
            </Typography>
          </Grid>
        ) : null}
      </Grid>

      <ProductDialog
        open={dlgOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initial={editItem}
      />
    </Box>
  );
}
