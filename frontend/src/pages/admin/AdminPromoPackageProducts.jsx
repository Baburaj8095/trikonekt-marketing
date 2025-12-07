import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Snackbar,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Box,
} from "@mui/material";
import API, { getPromoPackages } from "../../api/api";

/**
 * AdminPromoPackageProducts
 * - Create mappings between PromoPackage and Product for PRIME/PRIME750 flows
 * - Only capture: package, product, is_active, display_order
 * - Quantity/availability not shown
 * - Uses existing admin approval flow for purchases; this is just seeding
 *
 * Data sources:
 * - Packages: GET /business/promo/packages/
 * - Products: GET /products?name=...
 * - Mappings: /admin/dynamic/business/promopackageproduct/ (list/create)
 */
export default function AdminPromoPackageProducts() {
  // Packages
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState("");

  // New PromoProduct upload form state
  const [ppName, setPpName] = useState("");
  const [ppPrice, setPpPrice] = useState("");
  const [ppDescription, setPpDescription] = useState("");
  const [ppImage, setPpImage] = useState(null);
  const [ppActive, setPpActive] = useState(true);

  // Form: extra fields
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  // Existing mappings
  const [mappings, setMappings] = useState([]);
  const [loadingMappings, setLoadingMappings] = useState(false);

  // UI
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const selectedPackage = useMemo(
    () => packages.find((p) => String(p.id) === String(selectedPackageId)) || null,
    [packages, selectedPackageId]
  );
  const selectedProduct = null;

  // Load packages
  const loadPackages = async () => {
    setLoadingPackages(true);
    try {
      const data = await getPromoPackages();
      const list = Array.isArray(data) ? data : data?.results || [];
      setPackages(list);
      if (!selectedPackageId && list.length > 0) {
        setSelectedPackageId(String(list[0].id));
      }
    } catch (e) {
      setPackages([]);
      setSnack({ open: true, type: "error", msg: "Failed to load promo packages" });
    } finally {
      setLoadingPackages(false);
    }
  };

  // Load mappings from dynamic admin API
  const loadMappings = async () => {
    setLoadingMappings(true);
    try {
      const res = await API.get("/admin/dynamic/business/promopackageproduct/", {
        params: { page: 1, page_size: 200 },
        dedupe: "cancelPrevious",
      });
      const arr = res?.data?.results || res?.data || [];
      setMappings(Array.isArray(arr) ? arr : []);
    } catch (e) {
      setMappings([]);
      setSnack({ open: true, type: "error", msg: "Failed to load existing mappings" });
    } finally {
      setLoadingMappings(false);
    }
  };

  // Upload a new PromoProduct and map it to the selected PromoPackage
  const handleUploadAndMap = async () => {
    if (!selectedPackageId) {
      setSnack({ open: true, type: "warning", msg: "Select a promo package" });
      return;
    }
    const name = String(ppName || "").trim();
    if (!name) {
      setSnack({ open: true, type: "warning", msg: "Enter promo product name" });
      return;
    }
    const priceNum = Number(ppPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setSnack({ open: true, type: "warning", msg: "Enter valid price (> 0)" });
      return;
    }
    setSubmitting(true);
    try {
      // 1) Create PromoProduct (multipart)
      const fd = new FormData();
      fd.append("name", name);
      fd.append("price", String(priceNum));
      if (ppDescription) fd.append("description", String(ppDescription));
      fd.append("is_active", ppActive ? "true" : "false");
      if (ppImage) fd.append("image", ppImage);

      const res = await API.post("/admin/dynamic/business/promoproduct/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const prodId = res?.data?.id || res?.data?.pk;
      if (!prodId) {
        throw new Error("Upload succeeded but product id missing");
      }

      // 2) Create mapping PromoPackageProduct
      const payload = {
        package: Number(selectedPackageId),
        product: Number(prodId),
        is_active: Boolean(isActive),
        display_order: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : 0,
      };
      await API.post("/admin/dynamic/business/promopackageproduct/", payload);

      setSnack({ open: true, type: "success", msg: "Uploaded and mapped promo product" });

      // Reset form and refresh mappings
      setPpName("");
      setPpPrice("");
      setPpDescription("");
      setPpImage(null);
      setPpActive(true);
      await loadMappings();
    } catch (e) {
      let msg = "Failed to upload/map promo product";
      try {
        const data = e?.response?.data;
        if (typeof data === "object") {
          if (data?.non_field_errors?.length) msg = data.non_field_errors.join(", ");
          else if (data?.detail) msg = data.detail;
          else if (data?.name?.length) msg = `Name: ${data.name.join(", ")}`;
          else if (data?.price?.length) msg = `Price: ${data.price.join(", ")}`;
        }
      } catch {}
      setSnack({ open: true, type: "error", msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedPackageId) {
      setSnack({ open: true, type: "warning", msg: "Select a promo package" });
      return;
    }
    if (!selectedProductId) {
      setSnack({ open: true, type: "warning", msg: "Select a product" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        package: Number(selectedPackageId),
        product: Number(selectedProductId),
        is_active: Boolean(isActive),
        display_order: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : 0,
      };
      await API.post("/admin/dynamic/business/promopackageproduct/", payload);
      setSnack({ open: true, type: "success", msg: "Mapping added" });
      await loadMappings();
    } catch (e) {
      let msg = "Failed to add mapping";
      try {
        const data = e?.response?.data;
        if (typeof data === "object") {
          if (data?.non_field_errors?.length) msg = data.non_field_errors.join(", ");
          else if (data?.detail) msg = data.detail;
        }
      } catch {}
      setSnack({ open: true, type: "error", msg });
    } finally {
      setSubmitting(false);
    }
  };

  // Optional: activate/deactivate mapping
  const toggleActive = async (row) => {
    const id = row?.id;
    if (!id) return;
    const next = !row?.is_active;
    try {
      // Partial update; dynamic serializer accepts all model fields, PATCH should work
      await API.patch(`/admin/dynamic/business/promopackageproduct/${id}/`, { is_active: next });
      setMappings((arr) =>
        arr.map((r) => (r.id === id ? { ...r, is_active: next } : r))
      );
    } catch {
      setSnack({ open: true, type: "error", msg: "Failed to update status" });
    }
  };

  useEffect(() => {
    loadPackages();
    loadMappings();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: "#0C2D48" }}>
        Promo Package Products
      </Typography>

      <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Add Mapping
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              size="small"
              label="Promo Package"
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
            >
              {loadingPackages ? (
                <MenuItem disabled>
                  <CircularProgress size={18} sx={{ mr: 1 }} /> Loading...
                </MenuItem>
              ) : (
                packages.map((pkg) => (
                  <MenuItem key={pkg.id} value={String(pkg.id)}>
                    {pkg.code} — {pkg.name} (₹{pkg.price})
                  </MenuItem>
                ))
              )}
            </TextField>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Promo Product Name"
              value={ppName}
              onChange={(e) => setPpName(e.target.value)}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Price (₹)"
              value={ppPrice}
              onChange={(e) => setPpPrice(e.target.value)}
              inputProps={{ min: 0, step: "0.01" }}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={ppActive}
                  onChange={(e) => setPpActive(e.target.checked)}
                  size="small"
                />
              }
              label="Product Active"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Description (optional)"
              value={ppDescription}
              onChange={(e) => setPpDescription(e.target.value)}
              multiline
              minRows={2}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Button variant="outlined" size="small" component="label">
              {ppImage ? "Change Image" : "Upload Image"}
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) =>
                  setPpImage(
                    e.target.files && e.target.files[0] ? e.target.files[0] : null
                  )
                }
              />
            </Button>
            {ppImage ? (
              <Typography variant="caption" sx={{ ml: 1 }}>
                {ppImage.name}
              </Typography>
            ) : null}
          </Grid>

          <Grid item xs={6} md={3}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  size="small"
                />
              }
              label="Active"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Display Order"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              inputProps={{ min: 0, step: 1 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setPpName("");
                  setPpPrice("");
                  setPpDescription("");
                  setPpImage(null);
                  setPpActive(true);
                  setIsActive(true);
                  setDisplayOrder(0);
                }}
              >
                Clear
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleUploadAndMap}
                disabled={submitting}
              >
                {submitting ? "Uploading..." : "Upload & Map"}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Existing Mappings {mappings?.length ? `(${mappings.length})` : ""}
          </Typography>
          <Button size="small" onClick={loadMappings} disabled={loadingMappings}>
            {loadingMappings ? "Loading..." : "Refresh"}
          </Button>
        </Stack>

        {loadingMappings ? (
          <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={20} /> <Typography variant="body2">Loading mappings...</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Package</TableCell>
                <TableCell>Product</TableCell>
                <TableCell align="right">Display Order</TableCell>
                <TableCell align="center">Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(mappings || [])
                .filter((m) =>
                  selectedPackageId ? String(m.package) === String(selectedPackageId) : true
                )
                .map((m) => {
                  // m.repr is available from dynamic serializer; format: "PKG -> Product"
                  const repr = m?.repr || "";
                  let pkgLabel = String(m?.package);
                  let prodLabel = String(m?.product);
                  if (repr.includes("->")) {
                    const parts = repr.split("->");
                    pkgLabel = parts[0]?.trim() || pkgLabel;
                    prodLabel = parts[1]?.trim() || prodLabel;
                  }
                  return (
                    <TableRow key={m.id}>
                      <TableCell>{m.id}</TableCell>
                      <TableCell>{pkgLabel}</TableCell>
                      <TableCell>{prodLabel}</TableCell>
                      <TableCell align="right">{m.display_order ?? 0}</TableCell>
                      <TableCell align="center">
                        <Checkbox
                          size="small"
                          checked={!!m.is_active}
                          onChange={() => toggleActive(m)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {/* Future: add delete/edit if needed */}
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          onClick={async () => {
                            try {
                              await API.delete(`/admin/dynamic/business/promopackageproduct/${m.id}/`);
                              setMappings((arr) => arr.filter((x) => x.id !== m.id));
                              setSnack({ open: true, type: "success", msg: "Deleted" });
                            } catch {
                              setSnack({ open: true, type: "error", msg: "Delete failed" });
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {(!mappings || mappings.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No mappings found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.type}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
