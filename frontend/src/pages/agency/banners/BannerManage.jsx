import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Divider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
} from "@mui/material";
import API from "../../../api/api";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

function toNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function fmtMoney(x) {
  const n = Number(x || 0);
  return n.toFixed(2);
}
function fmtPct(x) {
  const n = Number(x || 0);
  return n.toFixed(2) + "%";
}

function BannerItemsDialog({ open, onClose, banner }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    price: "",
    quantity: "",
    discount: "",
    coupon_redeem_percent: "",
    commission_pool_percent: "",
    gift: "",
  });
  const [editId, setEditId] = useState(null);

  const resetForm = () =>
    setForm({
      name: "",
      price: "",
      quantity: "",
      discount: "",
      coupon_redeem_percent: "",
      commission_pool_percent: "",
      gift: "",
    });

  const load = async () => {
    if (!banner?.id) return;
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/banners/${banner.id}/items`);
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setItems(arr || []);
    } catch (e) {
      setItems([]);
      setError("Failed to load items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setEditId(null);
      resetForm();
      load();
    }
    // eslint-disable-next-line
  }, [open, banner?.id]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onEdit = (row) => {
    setEditId(row.id);
    setForm({
      name: row.name || "",
      price: String(row.price ?? ""),
      quantity: String(row.quantity ?? ""),
      discount: String(row.discount ?? ""),
      coupon_redeem_percent: String(row.coupon_redeem_percent ?? ""),
      commission_pool_percent: String(row.commission_pool_percent ?? ""),
      gift: row.gift || "",
    });
  };

  const onDelete = async (row) => {
    if (!banner?.id || !row?.id) return;
    if (!window.confirm(`Delete item "${row.name}"? This cannot be undone.`)) return;
    try {
      await API.delete(`/banners/${banner.id}/items/${row.id}`);
      await load();
    } catch (_) {
      alert("Failed to delete item.");
    }
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (!banner?.id) return;
    if (!form.name || !form.price || !form.quantity) {
      alert("Name, Price and Quantity are required.");
      return;
    }
    const payload = {
      name: form.name,
      price: toNumber(form.price),
      quantity: Math.max(0, Math.floor(toNumber(form.quantity))),
      discount: Math.max(0, toNumber(form.discount)),
      coupon_redeem_percent: Math.max(0, toNumber(form.coupon_redeem_percent)),
      commission_pool_percent: Math.max(0, toNumber(form.commission_pool_percent)),
      gift: form.gift || "",
    };
    try {
      setSaving(true);
      if (editId) {
        await API.put(`/banners/${banner.id}/items/${editId}`, payload);
      } else {
        await API.post(`/banners/${banner.id}/items`, payload);
      }
      await load();
      resetForm();
      setEditId(null);
    } catch (e2) {
      alert("Failed to save item. Please check values.");
    } finally {
      setSaving(false);
    }
  };

  const onCancelEdit = () => {
    resetForm();
    setEditId(null);
  };

  const computedSelling = () => {
    const price = toNumber(form.price);
    const disc = Math.max(0, toNumber(form.discount));
    const sell = price * (1 - disc / 100);
    return Number.isFinite(sell) ? sell.toFixed(2) : "0.00";
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="md" fullWidth>
      <DialogTitle>Manage Items — {banner?.title || ""}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <LinearProgress />
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : null}

        <Box component="form" onSubmit={onSubmit} sx={{ mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField label="Name" name="name" value={form.name} onChange={onChange} fullWidth required />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField label="Price" name="price" value={form.price} onChange={onChange} fullWidth required inputProps={{ inputMode: "decimal" }} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField label="Quantity" name="quantity" value={form.quantity} onChange={onChange} fullWidth required inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 0 }} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField label="Discount %%" name="discount" value={form.discount} onChange={onChange} fullWidth inputProps={{ inputMode: "decimal", min: 0, max: 100, step: "0.01" }} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField label="Selling ₹" value={computedSelling()} fullWidth InputProps={{ readOnly: true }} />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField label="Coupon Redeem %%" name="coupon_redeem_percent" value={form.coupon_redeem_percent} onChange={onChange} fullWidth inputProps={{ inputMode: "decimal", min: 0, max: 100, step: "0.01" }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Commission Pool %%" name="commission_pool_percent" value={form.commission_pool_percent} onChange={onChange} fullWidth inputProps={{ inputMode: "decimal", min: 0, max: 100, step: "0.01" }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Gift (optional)" name="gift" value={form.gift} onChange={onChange} fullWidth />
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {editId ? (
                  <Button type="button" onClick={onCancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" variant="contained" disabled={saving}>
                  {saving ? "Saving..." : editId ? "Update Item" : "Add Item"}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>

        <Paper variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Discount %</TableCell>
                <TableCell align="right">Selling Price</TableCell>
                <TableCell align="right">Coupon Redeem %</TableCell>
                <TableCell align="right">Commission Pool %</TableCell>
                <TableCell align="right">Gift</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(items || []).map((it) => {
                const selling = it.selling_price != null ? Number(it.selling_price) : (Number(it.price || 0) * (1 - Number(it.discount || 0) / 100));
                return (
                  <TableRow key={it.id}>
                    <TableCell>{it.name}</TableCell>
                    <TableCell align="right">₹{fmtMoney(it.price)}</TableCell>
                    <TableCell align="right">{Number(it.quantity || 0)}</TableCell>
                    <TableCell align="right">{fmtPct(it.discount)}</TableCell>
                    <TableCell align="right">₹{fmtMoney(selling)}</TableCell>
                    <TableCell align="right">{fmtPct(it.coupon_redeem_percent)}</TableCell>
                    <TableCell align="right">{fmtPct(it.commission_pool_percent)}</TableCell>
                    <TableCell align="right">{it.gift || "-"}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => onEdit(it)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => onDelete(it)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!items || items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Typography variant="body2" color="text.secondary">No items yet. Use the form above to add.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function BannerManage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    country: "",
    state: "",
    city: "",
    pincode: "",
    is_active: true,
    image: null,
  });

  const [itemsBanner, setItemsBanner] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await API.get("/banners", { params: { mine: 1, active: "all", _: Date.now() } });
      const list = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
      setBanners(list || []);
    } catch (e) {
      setBanners([]);
      setSnack({ open: true, type: "error", msg: "Failed to load banners" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onToggleActive = (id, isActive) => async () => {
    try {
      await API.patch(`/banners/${id}`, { is_active: !isActive });
      setSnack({ open: true, type: "success", msg: `Banner ${!isActive ? "activated" : "deactivated"}` });
      await load();
    } catch (e) {
      setSnack({ open: true, type: "error", msg: "Failed to update banner status" });
    }
  };

  const onDelete = (id) => async () => {
    if (!window.confirm("Delete this banner? This cannot be undone.")) return;
    try {
      await API.delete(`/banners/${id}`);
      setSnack({ open: true, type: "success", msg: "Banner deleted" });
      await load();
    } catch (e) {
      setSnack({ open: true, type: "error", msg: "Failed to delete banner" });
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setForm((f) => ({ ...f, image: file }));
  };

  const onSubmit = async () => {
    if (!form.title) {
      setSnack({ open: true, type: "error", msg: "Title is required" });
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("country", form.country);
      fd.append("state", form.state);
      fd.append("city", form.city);
      fd.append("pincode", form.pincode);
      fd.append("is_active", String(!!form.is_active));
      if (form.image) fd.append("image", form.image);
      await API.post("/banners", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setSnack({ open: true, type: "success", msg: "Banner created" });
      setForm({
        title: "",
        description: "",
        country: "",
        state: "",
        city: "",
        pincode: "",
        is_active: true,
        image: null,
      });
      const input = document.getElementById("banner-image-input");
      if (input) input.value = "";
      await load();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create banner";
      setSnack({ open: true, type: "error", msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#0C2D48" }}>
        Manage Banners
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Create New Banner
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Title"
              name="title"
              value={form.title}
              onChange={onChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Description"
              name="description"
              value={form.description}
              onChange={onChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              label="Country"
              name="country"
              value={form.country}
              onChange={onChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="State"
              name="state"
              value={form.state}
              onChange={onChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="City"
              name="city"
              value={form.city}
              onChange={onChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Pincode"
              name="pincode"
              value={form.pincode}
              onChange={onChange}
              fullWidth
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
            />
          </Grid>

        </Grid>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }} alignItems="center">
          <Button variant="outlined" component="label">
            {form.image ? "Change Image" : "Upload Image"}
            <input id="banner-image-input" hidden accept="image/*" type="file" onChange={onFileChange} />
          </Button>
          <FormControlLabel
            control={
              <Switch
                checked={!!form.is_active}
                onChange={(_, checked) => setForm((f) => ({ ...f, is_active: checked }))}
              />
            }
            label={form.is_active ? "Active" : "Inactive"}
          />
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Banner"}
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Your Banners
          </Typography>
          <Button size="small" onClick={load}>Refresh</Button>
        </Stack>
        {loading ? (
          <LinearProgress />
        ) : (banners || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No banners yet.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {(banners || []).map((b) => (
              <Grid key={b.id} item xs={12} md={6} lg={4}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: "100%", display: "flex", flexDirection: "column" }}>
                  {b.image_url ? (
                    <CardMedia component="img" image={b.image_url} alt={b.title} sx={{ aspectRatio: "4 / 2", objectFit: "cover" }} />
                  ) : (
                    <Box sx={{ width: "100%", aspectRatio: "4 / 2", bgcolor: "#f1f5f9" }} />
                  )}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{b.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {b.description || "—"}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      <Chip size="small" label={b.is_active ? "ACTIVE" : "INACTIVE"} color={b.is_active ? "success" : "default"} />
                      {b.pincode ? <Chip size="small" label={b.pincode} /> : null}
                      {b.city ? <Chip size="small" label={b.city} /> : null}
                      {b.state ? <Chip size="small" label={b.state} /> : null}
                      {b.country ? <Chip size="small" label={b.country} /> : null}
                    </Stack>
                    {Array.isArray(b.items) && b.items.length > 0 ? (
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                        Items: {b.items.length}
                      </Typography>
                    ) : null}
                  </CardContent>
                  <Divider />
                  <CardActions sx={{ justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={onToggleActive(b.id, b.is_active)}>
                        {b.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="small" color="error" onClick={onDelete(b.id)}>
                        Delete
                      </Button>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        onClick={() => setItemsBanner(b)}
                      >
                        Manage Items
                      </Button>
                      <Button
                        size="small"
                        href={`/marketplace/banners/${b.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </Button>
                    </Stack>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

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

      <BannerItemsDialog
        open={!!itemsBanner}
        onClose={() => setItemsBanner(null)}
        banner={itemsBanner}
      />
    </Box>
  );
}
