import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Alert,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Divider,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import { listMyShops, createShop, updateShop, deleteShop } from "../../api/api";

function StatusChip({ status }) {
  const s = String(status || "").toUpperCase();
  let color = "default";
  if (s === "ACTIVE") color = "success";
  if (s === "PENDING") color = "warning";
  if (s === "REJECTED") color = "error";
  return <Chip size="small" label={s || "—"} color={color} variant={s === "ACTIVE" ? "filled" : "outlined"} />;
}

export default function BusinessShops() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state (create or edit)
  const emptyForm = useMemo(
    () => ({
      id: null,
      shop_name: "",
      address: "",
      city: "",
      latitude: "",
      longitude: "",
      contact_number: "",
      shop_image: null, // File
      shop_image_url: "", // Preview URL
    }),
    []
  );
  const [form, setForm] = useState(emptyForm);

  async function fetchShops() {
    setError("");
    setLoading(true);
    try {
      const res = await listMyShops();
      const data = Array.isArray(res) ? res : (res?.results || []);
      setShops(data);
    } catch (e) {
      setError("Failed to fetch your shops.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShops();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handlePickImage = (e) => {
    const f = e?.target?.files?.[0] || null;
    setForm((prev) => ({
      ...prev,
      shop_image: f,
      shop_image_url: f ? URL.createObjectURL(f) : prev.shop_image_url,
    }));
  };

  const handleUseMyLocation = () => {
    setError("");
    if (!navigator?.geolocation) {
      setError("Geolocation not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords || {};
        setForm((prev) => ({
          ...prev,
          latitude: latitude != null ? String(latitude) : prev.latitude,
          longitude: longitude != null ? String(longitude) : prev.longitude,
        }));
      },
      () => setError("Unable to fetch your location. Please enter manually.")
    );
  };

  const startEdit = (shop) => {
    setError("");
    setSuccess("");
    setForm({
      id: shop?.id ?? null,
      shop_name: shop?.shop_name || "",
      address: shop?.address || "",
      city: shop?.city || "",
      latitude: shop?.latitude != null ? String(shop.latitude) : "",
      longitude: shop?.longitude != null ? String(shop.longitude) : "",
      contact_number: shop?.contact_number || "",
      shop_image: null,
      shop_image_url: shop?.shop_image || "",
    });
    window?.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!id) return;
    const ok = window.confirm("Delete this shop? This cannot be undone.");
    if (!ok) return;
    setError("");
    setSuccess("");
    try {
      await deleteShop(id);
      setSuccess("Shop deleted.");
      await fetchShops();
      // If editing this shop, reset form
      if (form.id === id) resetForm();
    } catch (e) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : "Failed to delete shop.";
      setError(typeof msg === "string" ? msg : String(msg));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const payload = {
        shop_name: (form.shop_name || "").trim(),
        address: (form.address || "").trim(),
        city: (form.city || "").trim(),
        latitude: form.latitude !== "" ? form.latitude : undefined,
        longitude: form.longitude !== "" ? form.longitude : undefined,
        contact_number: (form.contact_number || "").trim(),
        shop_image: form.shop_image || undefined,
      };

      if (form.id) {
        const updated = await updateShop(form.id, payload);
        setSuccess("Shop updated successfully.");
        // Replace in list
        setShops((prev) =>
          Array.isArray(prev)
            ? prev.map((s) => (s.id === updated?.id ? updated : s))
            : prev
        );
      } else {
        const created = await createShop(payload);
        setSuccess("Shop created. It will be visible publicly once approved.");
        setShops((prev) => (Array.isArray(prev) ? [created, ...prev] : [created]));
      }

      resetForm();
    } catch (e2) {
      const msg = e2?.response?.data ? JSON.stringify(e2.response.data) : "Failed to save shop.";
      setError(typeof msg === "string" ? msg : String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        My Shops
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      ) : null}

      <Paper component="form" onSubmit={handleSubmit} elevation={2} sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          {form.id ? "Edit Shop" : "Create a New Shop"}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Shop Name"
              fullWidth
              required
              value={form.shop_name}
              onChange={(e) => setForm((p) => ({ ...p, shop_name: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Contact Number"
              fullWidth
              value={form.contact_number}
              onChange={(e) => setForm((p) => ({ ...p, contact_number: e.target.value }))}
              inputProps={{ inputMode: "tel" }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address"
              fullWidth
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="City"
              fullWidth
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Latitude"
              fullWidth
              value={form.latitude}
              onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
              placeholder="e.g., 12.9716"
              inputProps={{ inputMode: "decimal" }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Longitude"
              fullWidth
              value={form.longitude}
              onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
              placeholder="e.g., 77.5946"
              inputProps={{ inputMode: "decimal" }}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                type="button"
                size="small"
                startIcon={<AddLocationAltOutlinedIcon />}
                onClick={handleUseMyLocation}
              >
                Use my location
              </Button>
              <Button component="label" variant="outlined" size="small">
                {form.shop_image ? "Change Image" : "Upload Image"}
                <input type="file" hidden accept="image/*" onChange={handlePickImage} />
              </Button>
              {form.shop_image_url ? (
                <img
                  src={form.shop_image_url}
                  alt="Preview"
                  style={{ height: 48, borderRadius: 6, border: "1px solid #e5e7eb" }}
                />
              ) : null}
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? "Saving…" : form.id ? "Update Shop" : "Create Shop"}
              </Button>
              {form.id ? (
                <Button type="button" variant="text" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Your Shops
      </Typography>

      {loading ? (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      ) : shops.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No shops yet. Create your first shop above.</Typography>
      ) : (
        <Grid container spacing={2}>
          {shops.map((s) => (
            <Grid key={s.id} item xs={12} md={6} lg={4}>
              <Card elevation={1} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {s.shop_name}
                    </Typography>
                    <StatusChip status={s.status} />
                  </Box>
                  {s.shop_image ? (
                    <Box sx={{ mb: 1 }}>
                      <img
                        src={s.image_url || s.shop_image}
                        alt={s.shop_name}
                        style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 6 }}
                      />
                    </Box>
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    {s.address || "—"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {s.city || "—"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.latitude != null && s.longitude != null
                      ? `(${s.latitude}, ${s.longitude})`
                      : null}
                  </Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <Typography variant="body2"><b>Contact:</b> {s.contact_number || "—"}</Typography>
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: "space-between" }}>
                  <Box>
                    <IconButton size="small" onClick={() => startEdit(s)} title="Edit">
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(s.id)} title="Delete">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
