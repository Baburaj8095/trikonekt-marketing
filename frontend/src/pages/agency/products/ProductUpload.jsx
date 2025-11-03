import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Grid,
  Button,
  Snackbar,
  Alert,
  MenuItem,
  CircularProgress,
  Stack,
} from "@mui/material";
import API from "../../../api/api";

export default function ProductUpload() {
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    quantity: "",
    discount: "",
    image: null,
    country: "",
    state: "",
    city: "",
    pincode: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  // Cascading location dropdowns using existing backend endpoints
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const countryObj = useMemo(
    () => countries.find((c) => c.name === form.country) || null,
    [countries, form.country]
  );
  const stateObj = useMemo(
    () => states.find((s) => s.name === form.state) || null,
    [states, form.state]
  );

  useEffect(() => {
    async function loadCountries() {
      setLoadingCountries(true);
      try {
        const res = await API.get("/location/countries/");
        const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setCountries(arr);
      } catch (e) {
        setCountries([]);
      } finally {
        setLoadingCountries(false);
      }
    }
    loadCountries();
  }, []);

  useEffect(() => {
    async function loadStates() {
      if (!countryObj?.id) {
        setStates([]);
        return;
      }
      setLoadingStates(true);
      try {
        const res = await API.get("/location/states/", { params: { country: countryObj.id } });
        const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setStates(arr);
      } catch {
        setStates([]);
      } finally {
        setLoadingStates(false);
      }
    }
    loadStates();
    // reset dependent fields
    setForm((f) => ({ ...f, state: "", city: "" }));
    setCities([]);
  }, [countryObj?.id]);

  useEffect(() => {
    async function loadCities() {
      if (!stateObj?.id) {
        setCities([]);
        return;
      }
      setLoadingCities(true);
      try {
        const res = await API.get("/location/cities/", { params: { state: stateObj.id } });
        const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setCities(arr);
      } catch {
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    }
    loadCities();
    // reset dependent
    setForm((f) => ({ ...f, city: "" }));
  }, [stateObj?.id]);

  const onChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") {
      setForm((f) => ({ ...f, image: files?.[0] || null }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.price || !form.quantity) {
      setSnack({ open: true, type: "error", msg: "Name, category, price and quantity are required." });
      return;
    }
    try {
      setSubmitting(true);

      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("description", form.description || "");
      fd.append("category", form.category);
      fd.append("price", String(form.price));
      fd.append("quantity", String(form.quantity));
      fd.append("discount", String(form.discount || 0));
      if (form.image) fd.append("image", form.image);
      fd.append("country", form.country || "");
      fd.append("state", form.state || "");
      fd.append("city", form.city || "");
      fd.append("pincode", form.pincode || "");

      await API.post("/products", fd);
      setSnack({ open: true, type: "success", msg: "Product uploaded successfully." });
      setForm({
        name: "",
        description: "",
        category: "",
        price: "",
        quantity: "",
        discount: "",
        image: null,
        country: "",
        state: "",
        city: "",
        pincode: "",
      });
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to upload product.";
      setSnack({ open: true, type: "error", msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: { xs: 1.5, md: 2 } }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#0C2D48" }}>
          Upload Product
        </Typography>

        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField label="Name" name="name" value={form.name} onChange={onChange} fullWidth required />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Category" name="category" value={form.category} onChange={onChange} fullWidth required />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                name="description"
                value={form.description}
                onChange={onChange}
                fullWidth
                multiline
                minRows={3}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Price"
                name="price"
                value={form.price}
                onChange={onChange}
                fullWidth
                inputProps={{ inputMode: "decimal" }}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Quantity"
                name="quantity"
                value={form.quantity}
                onChange={onChange}
                fullWidth
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", min: 0 }}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Discount (%)"
                name="discount"
                value={form.discount}
                onChange={onChange}
                fullWidth
                inputProps={{ inputMode: "decimal", min: 0, max: 100, step: "0.01" }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Button variant="outlined" component="label" fullWidth>
                {form.image ? "Change Image" : "Upload Image"}
                <input type="file" name="image" accept="image/*" hidden onChange={onChange} />
              </Button>
              {form.image ? (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {form.image.name}
                  </Typography>
                  <Box
                    component="img"
                    src={URL.createObjectURL(form.image)}
                    alt="preview"
                    sx={{ mt: 1, width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 1 }}
                  />
                </Box>
              ) : null}
            </Grid>

            {/* Location */}
            <Grid item xs={12} md={6}>
              <Stack spacing={2}>
                <TextField
                  select
                  fullWidth
                  label="Country"
                  name="country"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                >
                  {loadingCountries ? (
                    <MenuItem disabled>
                      <CircularProgress size={18} sx={{ mr: 1 }} /> Loading...
                    </MenuItem>
                  ) : (
                    countries.map((c) => (
                      <MenuItem key={c.id} value={c.name}>
                        {c.name}
                      </MenuItem>
                    ))
                  )}
                </TextField>

                <TextField
                  select
                  fullWidth
                  label="State"
                  name="state"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  disabled={!countryObj}
                >
                  {loadingStates ? (
                    <MenuItem disabled>
                      <CircularProgress size={18} sx={{ mr: 1 }} /> Loading...
                    </MenuItem>
                  ) : (
                    states.map((s) => (
                      <MenuItem key={s.id} value={s.name}>
                        {s.name}
                      </MenuItem>
                    ))
                  )}
                </TextField>

                <TextField
                  select
                  fullWidth
                  label="City"
                  name="city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  disabled={!stateObj}
                >
                  {loadingCities ? (
                    <MenuItem disabled>
                      <CircularProgress size={18} sx={{ mr: 1 }} /> Loading...
                    </MenuItem>
                  ) : (
                    cities.map((c) => (
                      <MenuItem key={c.id} value={c.name}>
                        {c.name}
                      </MenuItem>
                    ))
                  )}
                </TextField>

                <TextField
                  label="Pincode"
                  name="pincode"
                  value={form.pincode}
                  onChange={onChange}
                  inputProps={{ maxLength: 10 }}
                  fullWidth
                />
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button type="submit" variant="contained" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.type} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
