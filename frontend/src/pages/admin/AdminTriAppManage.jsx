import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
  Divider,
} from "@mui/material";
import API from "../../api/api";

/**
 * AdminTriAppManage
 * Dedicated admin screen for a single TRI App (e.g., tri-holidays, tri-ev, etc.)
 * - Manage app flags (allow_price, allow_add_to_cart, allow_payment), is_active and banner_image
 * - Create one-by-one products with image
 * - Bulk upload multiple product images with common name/price
 * - View, toggle active, delete products under this app
 *
 * Route: /admin/tri/:slug
 */
export default function AdminTriAppManage() {
  const { slug: routeSlug } = useParams();
  const slug = String(routeSlug || "").toLowerCase();

  // App
  const [appLoading, setAppLoading] = useState(false);
  const [appErr, setAppErr] = useState("");
  const [app, setApp] = useState(null);

  // Create app (when missing)
  const [createName, setCreateName] = useState("");
  const [creatingApp, setCreatingApp] = useState(false);

  // Edit flags
  const [savingFlags, setSavingFlags] = useState(false);
  const [flag_is_active, setFlagIsActive] = useState(true);
  const [flag_price, setFlagPrice] = useState(false);
  const [flag_cart, setFlagCart] = useState(false);
  const [flag_payment, setFlagPayment] = useState(false);

  // Banner upload
  const [bannerFile, setBannerFile] = useState(null);
  const [savingBanner, setSavingBanner] = useState(false);

  // Products
  const [products, setProducts] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);

  // New product form
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCurrency, setPCurrency] = useState("INR");
  const [pDesc, setPDesc] = useState("");
  const [pImage, setPImage] = useState(null);
  const [pActive, setPActive] = useState(true);
  const [pOrder, setPOrder] = useState(0);
  const [pRewardPct, setPRewardPct] = useState("");
  const [submittingProduct, setSubmittingProduct] = useState(false);

  // Bulk upload
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkNamePrefix, setBulkNamePrefix] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkCurrency, setBulkCurrency] = useState("INR");
  const [bulkActive, setBulkActive] = useState(true);
  const [bulkStartOrder, setBulkStartOrder] = useState(1);
  const [bulkRewardPct, setBulkRewardPct] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Merchant Shops moderation (for 'tri-local-store')
  const isLocalStore = slug === "tri-local-store";
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopStatus, setShopStatus] = useState("PENDING"); // PENDING | ACTIVE | REJECTED | ALL
  const [shopQ, setShopQ] = useState("");

  // UI
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const appRoute = "admin/dynamic/business/triapp/";
  const productRoute = "admin/dynamic/business/triappproduct/";
  const shopRoute = "admin/dynamic/market/shop/";

  const showSnack = (type, msg) => setSnack({ open: true, type, msg });

  const currencyOptions = useMemo(() => ["INR", "₹", "USD", "EUR"], []);

  const loadApp = useCallback(async () => {
    if (!slug) return;
    setAppLoading(true);
    setAppErr("");
    try {
      // Search by slug; backend supports search_fields on slug/name/description
      const { data } = await API.get(appRoute, {
        params: { page: 1, page_size: 50, search: slug },
        dedupe: "cancelPrevious",
      });
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const found = list.find((x) => String(x.slug).toLowerCase() === slug) || null;
      if (!found) {
        setApp(null);
        setFlagIsActive(true);
        setFlagPrice(false);
        setFlagCart(false);
        setFlagPayment(false);
      } else {
        setApp(found);
        setFlagIsActive(!!found.is_active);
        setFlagPrice(!!found.allow_price);
        setFlagCart(!!found.allow_add_to_cart);
        setFlagPayment(!!found.allow_payment);
      }
    } catch (e) {
      setAppErr("Failed to load app");
    } finally {
      setAppLoading(false);
    }
  }, [slug]);

  const loadProducts = useCallback(async () => {
    if (!app?.id) {
      setProducts([]);
      return;
    }
    setProdLoading(true);
    try {
      const { data } = await API.get(productRoute, {
        params: { page: 1, page_size: 500, app: app.id },
        dedupe: "cancelPrevious",
      });
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setProducts(list);
    } catch (e) {
      setProducts([]);
      showSnack("error", "Failed to load products");
    } finally {
      setProdLoading(false);
    }
  }, [app?.id]);

  useEffect(() => {
    loadApp();
  }, [loadApp]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Merchant shops moderation helpers
  const loadShops = useCallback(async () => {
    if (!isLocalStore) return;
    setShopsLoading(true);
    try {
      const params = { page: 1, page_size: 200 };
      if (shopQ && String(shopQ).trim()) params.search = String(shopQ).trim();
      if (shopStatus && shopStatus !== "ALL") params.status = shopStatus;
      const { data } = await API.get(shopRoute, { params, dedupe: "cancelPrevious" });
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setShops(list);
    } catch (e) {
      setShops([]);
    } finally {
      setShopsLoading(false);
    }
  }, [isLocalStore, shopQ, shopStatus]);

  useEffect(() => {
    if (isLocalStore) loadShops();
  }, [isLocalStore, loadShops]);

  async function setShopStatusTo(id, status) {
    if (!id) return;
    try {
      await API.patch(`${shopRoute}${id}/`, { status });
      setShops((arr) => arr.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch {
      showSnack("error", "Failed to update shop status");
    }
  }
  const approveShop = (id) => setShopStatusTo(id, "ACTIVE");
  const rejectShop = (id) => setShopStatusTo(id, "REJECTED");
  const pendShop = (id) => setShopStatusTo(id, "PENDING");

  async function createTriApp() {
    if (!slug) return;
    const name = (createName || "").trim() || slug.replace(/^tri-?/i, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    setCreatingApp(true);
    try {
      await API.post(appRoute, {
        slug,
        name,
        description: "",
        is_active: true,
        allow_price: false,
        allow_add_to_cart: false,
        allow_payment: false,
      });
      showSnack("success", "TRI App created");
      setCreateName("");
      await loadApp();
    } catch (e) {
      let msg = "Failed to create app";
      try {
        const d = e?.response?.data;
        msg =
          d?.detail ||
          d?.slug?.join?.(", ") ||
          d?.name?.join?.(", ") ||
          msg;
      } catch {}
      showSnack("error", msg);
    } finally {
      setCreatingApp(false);
    }
  }

  async function saveFlags() {
    if (!app?.id) return;
    setSavingFlags(true);
    try {
      await API.patch(`${appRoute}${app.id}/`, {
        is_active: !!flag_is_active,
        allow_price: !!flag_price,
        allow_add_to_cart: !!flag_cart,
        allow_payment: !!flag_payment,
      });
      showSnack("success", "Settings saved");
      await loadApp();
    } catch {
      showSnack("error", "Failed to save settings");
    } finally {
      setSavingFlags(false);
    }
  }

  async function uploadBanner() {
    if (!app?.id || !bannerFile) return;
    setSavingBanner(true);
    try {
      const fd = new FormData();
      fd.append("banner_image", bannerFile);
      await API.patch(`${appRoute}${app.id}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showSnack("success", "Banner updated");
      setBannerFile(null);
      await loadApp();
    } catch {
      showSnack("error", "Failed to update banner");
    } finally {
      setSavingBanner(false);
    }
  }

  async function createOneProduct() {
    if (!app?.id) {
      showSnack("warning", "Create the TRI App first");
      return;
    }
    const nm = (pName || "").trim();
    const priceNum = Number(pPrice);
    if (!nm) {
      showSnack("warning", "Enter product name");
      return;
    }
    if (!(Number.isFinite(priceNum) && priceNum >= 0)) {
      showSnack("warning", "Enter valid price (>= 0)");
      return;
    }
    setSubmittingProduct(true);
    try {
      const fd = new FormData();
      fd.append("app", String(app.id));
      fd.append("name", nm);
      fd.append("price", String(priceNum));
      fd.append("currency", (pCurrency || "INR").toUpperCase());
      if (pDesc) fd.append("description", String(pDesc));
      fd.append("is_active", pActive ? "true" : "false");
      fd.append("display_order", String(Number.isFinite(Number(pOrder)) ? Number(pOrder) : 0));
      if (pImage) fd.append("image", pImage);
      // Max reward percent (0..100)
      {
        const rpct = Number(pRewardPct);
        const pct = Number.isFinite(rpct) && rpct >= 0 ? Math.min(100, rpct) : 0;
        fd.append("max_reward_points_percent", String(pct));
      }

      await API.post(productRoute, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      showSnack("success", "Product created");
      setPName("");
      setPPrice("");
      setPCurrency("INR");
      setPDesc("");
      setPImage(null);
      setPActive(true);
      setPOrder(0);
      setPRewardPct("");
      await loadProducts();
    } catch (e) {
      let msg = "Failed to create product";
      try {
        const d = e?.response?.data || {};
        msg =
          d?.detail ||
          d?.name?.join?.(", ") ||
          d?.price?.join?.(", ") ||
          d?.image?.join?.(", ") ||
          msg;
      } catch {}
      showSnack("error", msg);
    } finally {
      setSubmittingProduct(false);
    }
  }

  async function bulkUploadProducts() {
    if (!app?.id) {
      showSnack("warning", "Create the TRI App first");
      return;
    }
    const files = Array.from(bulkFiles || []);
    if (!files.length) {
      showSnack("warning", "Select images");
      return;
    }
    const priceNum = Number(bulkPrice);
    if (!(Number.isFinite(priceNum) && priceNum >= 0)) {
      showSnack("warning", "Enter valid price (>= 0)");
      return;
    }
    setBulkSubmitting(true);
    try {
      let idx = 0;
      for (const file of files) {
        idx += 1;
        const base = (bulkNamePrefix || "Product").trim() || "Product";
        const nameFromFile = file?.name ? file.name.replace(/\.[^.]+$/, "") : `Item ${idx}`;
        const nm = base.includes("{n}") ? base.replaceAll("{n}", String(idx)) : `${base} ${idx}`;
        const finalName = base ? nm : nameFromFile;

        const fd = new FormData();
        fd.append("app", String(app.id));
        fd.append("name", finalName);
        fd.append("price", String(priceNum));
        fd.append("currency", (bulkCurrency || "INR").toUpperCase());
        fd.append("is_active", bulkActive ? "true" : "false");
        const order = Number(bulkStartOrder) + (idx - 1);
        fd.append("display_order", String(Number.isFinite(order) ? order : 0));
        // Max reward percent (0..100)
        {
          const rpct = Number(bulkRewardPct);
          const pct = Number.isFinite(rpct) && rpct >= 0 ? Math.min(100, rpct) : 0;
          fd.append("max_reward_points_percent", String(pct));
        }
        fd.append("image", file);

        await API.post(productRoute, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      showSnack("success", `Uploaded ${files.length} products`);
      setBulkFiles([]);
      setBulkNamePrefix("");
      setBulkPrice("");
      setBulkCurrency("INR");
      setBulkActive(true);
      setBulkStartOrder(1);
      await loadProducts();
    } catch (e) {
      showSnack("error", "Bulk upload failed");
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function toggleProductActive(row) {
    const id = row?.id;
    if (!id) return;
    try {
      const next = !row?.is_active;
      await API.patch(`${productRoute}${id}/`, { is_active: next });
      setProducts((arr) => arr.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
    } catch {
      showSnack("error", "Failed to update status");
    }
  }

  async function deleteProduct(row) {
    const id = row?.id;
    if (!id) return;
    if (!window.confirm(`Delete product #${id}?`)) return;
    try {
      await API.delete(`${productRoute}${id}/`);
      setProducts((arr) => arr.filter((r) => r.id !== id));
      showSnack("success", "Deleted");
    } catch {
      showSnack("error", "Delete failed");
    }
  }

  const appTitle = useMemo(() => {
    if (!slug) return "TRI App";
    const bare = slug.replace(/^tri-?/i, "").replace(/-/g, " ");
    return `TRI ${bare.replace(/\b\w/g, (c) => c.toUpperCase())}`;
  }, [slug]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: "#0C2D48" }}>
        {appTitle} — Admin
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Manage the catalog for this TRI app. Admin can control price visibility, add-to-cart and payment.
      </Typography>

      {/* App loader / create */}
      {appLoading ? (
        <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} /> <Typography variant="body2">Loading app…</Typography>
        </Box>
      ) : null}

      {appErr ? (
        <Alert severity="error" sx={{ mb: 2 }}>{appErr}</Alert>
      ) : null}

      {!app && !appLoading ? (
        <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Create TRI App “{slug}”
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Display Name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="TRI Holidays"
              />
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Button variant="contained" onClick={createTriApp} disabled={creatingApp}>
                {creatingApp ? "Creating..." : "Create App"}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      ) : null}

      {app ? (
        <>
          {/* App settings */}
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                App Settings
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small" onClick={saveFlags} disabled={savingFlags}>
                  {savingFlags ? "Saving..." : "Save Settings"}
                </Button>
              </Stack>
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
                  <FormControlLabel
                    control={<Checkbox checked={flag_is_active} onChange={(e) => setFlagIsActive(e.target.checked)} />}
                    label="Active"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={flag_price} onChange={(e) => setFlagPrice(e.target.checked)} />}
                    label="Show Price"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={flag_cart} onChange={(e) => setFlagCart(e.target.checked)} />}
                    label="Enable Add to Cart"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={flag_payment} onChange={(e) => setFlagPayment(e.target.checked)} />}
                    label="Enable Payment"
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                  <Button variant="outlined" size="small" component="label">
                    {bannerFile ? "Change Banner" : "Upload Banner"}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => setBannerFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                    />
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={uploadBanner}
                    disabled={!bannerFile || savingBanner}
                  >
                    {savingBanner ? "Saving…" : "Save Banner"}
                  </Button>
                </Stack>
                {app?.banner_image ? (
                  <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
                    Current banner: {String(app.banner_image)}
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ display: "block", mt: 1, color: "text.secondary" }}>
                    No banner uploaded
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Paper>

          {/* Create single product */}
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Add Product
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Name"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Price"
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  inputProps={{ min: 0, step: "0.01" }}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Currency"
                  value={pCurrency}
                  onChange={(e) => setPCurrency(e.target.value)}
                >
                  {currencyOptions.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} md={1}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Order"
                  value={pOrder}
                  onChange={(e) => setPOrder(e.target.value)}
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Max Reward %"
                  value={pRewardPct}
                  onChange={(e) => setPRewardPct(e.target.value)}
                  inputProps={{ min: 0, max: 100, step: "0.01" }}
                  helperText="Max % redeemable via reward points"
                />
              </Grid>
              <Grid item xs={6} md={2} sx={{ display: "flex", alignItems: "center" }}>
                <FormControlLabel
                  control={<Checkbox checked={pActive} onChange={(e) => setPActive(e.target.checked)} />}
                  label="Active"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Description (optional)"
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  multiline
                  minRows={2}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Button variant="outlined" size="small" component="label">
                  {pImage ? "Change Image" : "Upload Image"}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) =>
                      setPImage(e.target.files && e.target.files[0] ? e.target.files[0] : null)
                    }
                  />
                </Button>
                {pImage ? (
                  <Typography variant="caption" sx={{ ml: 1 }}>
                    {pImage.name}
                  </Typography>
                ) : null}
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      setPName("");
                      setPPrice("");
                      setPCurrency("INR");
                      setPDesc("");
                      setPImage(null);
                      setPActive(true);
                      setPOrder(0);
                      setPRewardPct("");
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={createOneProduct}
                    disabled={submittingProduct}
                  >
                    {submittingProduct ? "Saving..." : "Create Product"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Bulk upload */}
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Bulk Upload Products (multiple images)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Button variant="outlined" size="small" component="label">
                  {bulkFiles?.length ? `Change (${bulkFiles.length})` : "Select Images"}
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={(e) => setBulkFiles(e.target.files ? Array.from(e.target.files) : [])}
                  />
                </Button>
                {bulkFiles?.length ? (
                  <Typography variant="caption" sx={{ ml: 1 }}>
                    {bulkFiles.length} file(s) selected
                  </Typography>
                ) : null}
              </Grid>
              <Grid item xs={12} md={6} />
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Name Prefix"
                  value={bulkNamePrefix}
                  onChange={(e) => setBulkNamePrefix(e.target.value)}
                  placeholder="Holiday {n}"
                  helperText="Use {n} where you want a sequence number (e.g., 'Holiday {n}')"
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Price"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  inputProps={{ min: 0, step: "0.01" }}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Currency"
                  value={bulkCurrency}
                  onChange={(e) => setBulkCurrency(e.target.value)}
                >
                  {currencyOptions.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} md={1}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Start Order"
                  value={bulkStartOrder}
                  onChange={(e) => setBulkStartOrder(e.target.value)}
                  inputProps={{ min: 0, step: 1 }}
                />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Max Reward %"
                  value={bulkRewardPct}
                  onChange={(e) => setBulkRewardPct(e.target.value)}
                  inputProps={{ min: 0, max: 100, step: "0.01" }}
                />
              </Grid>
              <Grid item xs={6} md={2} sx={{ display: "flex", alignItems: "center" }}>
                <FormControlLabel
                  control={<Checkbox checked={bulkActive} onChange={(e) => setBulkActive(e.target.checked)} />}
                  label="Active"
                />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={bulkUploadProducts}
                    disabled={bulkSubmitting || !bulkFiles?.length}
                  >
                    {bulkSubmitting ? "Uploading..." : "Upload"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Merchant Shops moderation (only for tri-local-store) */}
          {isLocalStore ? (
            <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Merchant Shops Moderation
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Search"
                    value={shopQ}
                    onChange={(e) => setShopQ(e.target.value)}
                  />
                  <TextField
                    size="small"
                    select
                    label="Status"
                    value={shopStatus}
                    onChange={(e) => setShopStatus(e.target.value)}
                    sx={{ minWidth: 160 }}
                  >
                    <MenuItem value="PENDING">Pending</MenuItem>
                    <MenuItem value="ACTIVE">Active</MenuItem>
                    <MenuItem value="REJECTED">Rejected</MenuItem>
                    <MenuItem value="ALL">All</MenuItem>
                  </TextField>
                  <Button size="small" onClick={loadShops} disabled={shopsLoading}>
                    {shopsLoading ? "Loading..." : "Refresh"}
                  </Button>
                </Stack>
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>City</TableCell>
                    <TableCell>Merchant (ID)</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(shops || []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.id}</TableCell>
                      <TableCell>{s.shop_name}</TableCell>
                      <TableCell>{s.city}</TableCell>
                      <TableCell>{s.merchant}</TableCell>
                      <TableCell>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            color:
                              s.status === "ACTIVE"
                                ? "#065f46"
                                : s.status === "REJECTED"
                                ? "#991b1b"
                                : "#92400e",
                            background:
                              s.status === "ACTIVE"
                                ? "#d1fae5"
                                : s.status === "REJECTED"
                                ? "#fee2e2"
                                : "#fef3c7",
                            border: "1px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          {s.status}
                        </span>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="outlined" onClick={() => pendShop(s.id)}>
                            Set Pending
                          </Button>
                          <Button size="small" variant="contained" onClick={() => approveShop(s.id)}>
                            Approve
                          </Button>
                          <Button size="small" color="error" variant="text" onClick={() => rejectShop(s.id)}>
                            Reject
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!shops || shops.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No shops found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          ) : null}

          {/* Products list */}
          <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Products {products?.length ? `(${products.length})` : ""}
              </Typography>
              <Button size="small" onClick={loadProducts} disabled={prodLoading}>
                {prodLoading ? "Loading..." : "Refresh"}
              </Button>
            </Stack>
            {prodLoading ? (
              <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={20} /> <Typography variant="body2">Loading products...</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Currency</TableCell>
                    <TableCell>Max Reward %</TableCell>
                    <TableCell align="right">Order</TableCell>
                    <TableCell align="center">Active</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(products || [])
                    .sort((a, b) => {
                      const ao = Number(a.display_order || 0);
                      const bo = Number(b.display_order || 0);
                      if (ao !== bo) return ao - bo;
                      return (a.id || 0) - (b.id || 0);
                    })
                    .map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.id}</TableCell>
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.price}</TableCell>
                        <TableCell>{m.currency || "INR"}</TableCell>
                        <TableCell>{m.max_reward_points_percent ?? 0}%</TableCell>
                        <TableCell align="right">{m.display_order ?? 0}</TableCell>
                        <TableCell align="center">
                          <Checkbox size="small" checked={!!m.is_active} onChange={() => toggleProductActive(m)} />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" color="error" variant="text" onClick={() => deleteProduct(m)}>
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {(!products || products.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No products found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      ) : null}

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
