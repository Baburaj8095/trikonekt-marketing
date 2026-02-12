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
} from "@mui/material";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";

import {
  listMyShops,
  createShop,
  updateShop,
  deleteShop,
} from "../../api/api";

/* ---------------- STATUS CHIP ---------------- */

function StatusChip({ status }) {
  const s = String(status || "").toUpperCase();

  let color = "default";
  if (s === "ACTIVE") color = "success";
  if (s === "PENDING") color = "warning";
  if (s === "REJECTED") color = "error";

  return (
    <Chip
      size="small"
      label={s}
      color={color}
      variant={s === "ACTIVE" ? "filled" : "outlined"}
      sx={{ fontWeight: 600 }}
    />
  );
}

/* ---------------- MAIN ---------------- */

export default function BusinessShops() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ---------------- FORM ---------------- */

  const emptyForm = useMemo(
    () => ({
      id: null,
      shop_name: "",
      address: "",
      city: "",
      latitude: "",
      longitude: "",
      contact_number: "",
      shop_image: null,
      shop_image_url: "",
    }),
    []
  );

  const [form, setForm] = useState(emptyForm);

  /* ---------------- FETCH ---------------- */

  async function fetchShops() {
    setLoading(true);
    try {
      const res = await listMyShops();
      const data = Array.isArray(res) ? res : res?.results || [];
      setShops(data);
    } catch {
      setError("Failed to fetch shops.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShops();
  }, []);

  /* ---------------- FORM HELPERS ---------------- */

  const resetForm = () => setForm(emptyForm);

  const handlePickImage = (e) => {
    const f = e?.target?.files?.[0] || null;
    setForm((p) => ({
      ...p,
      shop_image: f,
      shop_image_url: f ? URL.createObjectURL(f) : "",
    }));
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setForm((p) => ({
        ...p,
        latitude: String(latitude),
        longitude: String(longitude),
      }));
    });
  };

  const startEdit = (shop) => {
    setForm({
      id: shop.id,
      shop_name: shop.shop_name || "",
      address: shop.address || "",
      city: shop.city || "",
      latitude: shop.latitude || "",
      longitude: shop.longitude || "",
      contact_number: shop.contact_number || "",
      shop_image: null,
      shop_image_url: shop.shop_image || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---------------- DELETE ---------------- */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this shop?")) return;

    try {
      await deleteShop(id);
      fetchShops();
    } catch {
      setError("Delete failed.");
    }
  };

  /* ---------------- SUBMIT ---------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      shop_name: form.shop_name,
      address: form.address,
      city: form.city,
      latitude: form.latitude,
      longitude: form.longitude,
      contact_number: form.contact_number,
      shop_image: form.shop_image,
    };

    try {
      if (form.id) {
        await updateShop(form.id, payload);
        setSuccess("Shop updated.");
      } else {
        await createShop(payload);
        setSuccess("Shop created.");
      }

      resetForm();
      fetchShops();
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- UI ---------------- */

 return (
  <Box
    sx={{
      px: 1.5,
      pb: 4,
      maxWidth: 520,   // Mobile-first container
      mx: "auto",
    }}
  >
    {/* TITLE */}
    <Typography
      variant="h5"
      sx={{ fontWeight: 800, mb: 2 }}
    >
      My Shops
    </Typography>

    {/* ---------------- FORM CARD ---------------- */}
    <Paper
      component="form"
      onSubmit={handleSubmit}
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 4,
        background: "#fff",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
      }}
    >
      <Typography fontWeight={700} mb={2}>
        {form.id ? "Edit Shop" : "Create a New Shop"}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField label="Shop Name" fullWidth />
        </Grid>

        <Grid item xs={12}>
          <TextField label="Contact Number" fullWidth />
        </Grid>

        <Grid item xs={12}>
          <TextField
            label="Address"
            fullWidth
            multiline
            minRows={3}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField label="City" fullWidth />
        </Grid>

        <Grid item xs={6}>
          <TextField label="Latitude" fullWidth />
        </Grid>

        <Grid item xs={6}>
          <TextField label="Longitude" fullWidth />
        </Grid>

        {/* LOCATION BUTTON */}
        <Grid item xs={12}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddLocationAltOutlinedIcon />}
            sx={{
              py: 1.2,
              borderRadius: 3,
              textTransform: "none",
              fontWeight: 600,
            }}
            onClick={handleUseMyLocation}
          >
            Use my location
          </Button>
        </Grid>

        {/* IMAGE */}
        <Grid item xs={12}>
          <Button
            fullWidth
            component="label"
            variant="outlined"
            sx={{
              py: 1.2,
              borderRadius: 3,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Upload Image
            <input hidden type="file" onChange={handlePickImage} />
          </Button>
        </Grid>

        {/* CTA */}
        <Grid item xs={12}>
          <Button
            type="submit"
            fullWidth
            sx={{
              py: 1.3,
              borderRadius: 3,
              fontWeight: 700,
              textTransform: "none",
              background:
                "linear-gradient(135deg,#0ea5e9,#22c55e)",
              color: "#fff",
            }}
          >
            Create Shop
          </Button>
        </Grid>
      </Grid>
    </Paper>

    {/* ---------------- SHOPS ---------------- */}

    <Typography fontWeight={700} mb={1.5}>
      Your Shops
    </Typography>

   <Grid container spacing={1.5}>
      {shops.map((s) => (
        <Grid
          item
          key={s.id}
          xs={6}   // 🔥 2 per row on mobile
          sm={6}   // 2 per row tablet
          md={4}   // 3 per row desktop
          lg={3}   // 4 per row large
        >

        <Card
          sx={{
            borderRadius: 3,
            overflow: "hidden",
            background: "#fff",
            boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* IMAGE */}
          {s.shop_image && (
            <Box
              sx={{
                width: "100%",
                height: 110,        // reduced for 2-col
                overflow: "hidden",
              }}
            >
              <img
                src={s.image_url || s.shop_image}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </Box>
          )}

          {/* CONTENT */}
          <CardContent
            sx={{
              p: 1.2,
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
            }}
          >
            {/* TITLE + STATUS */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={0.5}
            >
              <Typography
                fontWeight={700}
                fontSize={13}
                noWrap
              >
                {s.shop_name}
              </Typography>

              <Chip
                label={s.status}
                size="small"
                color={
                  s.status === "ACTIVE"
                    ? "success"
                    : "warning"
                }
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            </Box>

            {/* CITY */}
            <Typography
              fontSize={12}
              color="text.secondary"
              noWrap
            >
              {s.city}
            </Typography>

            {/* CONTACT */}
            <Typography
              fontSize={12}
              fontWeight={600}
              noWrap
            >
              {s.contact_number}
            </Typography>

            {/* ACTIONS — anchored bottom */}
            <Box
              mt="auto"
              display="flex"
              justifyContent="space-between"
              pt={1}
            >
              <IconButton
                size="small"
                onClick={() => startEdit(s)}
                sx={{
                  background: "#f1f5f9",
                  width: 32,
                  height: 32,
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>

              <IconButton
                size="small"
                onClick={() => handleDelete(s.id)}
                sx={{
                  background: "#f1f5f9",
                  width: 32,
                  height: 32,
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      ))}
    </Grid>
  </Box>
);
}
