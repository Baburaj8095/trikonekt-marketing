import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const emptyForm = {
  id: null,
  title: "",
  is_active: true,
  image: null,
};

export default function AdminTeamConsumerWishingBanners() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => String(r.title || "").toLowerCase().includes(s));
  }, [rows, q]);

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/business/admin/team-consumer/wishing-banners/", { params: { page_size: 500 } });
      const items = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
      setRows(items);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load banners.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const openCreate = () => {
    setNotice("");
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (row) => {
    setNotice("");
    setForm({
      id: row.id,
      title: row.title || "",
      is_active: !!row.is_active,
      image: null,
      image_url: row.image_url || null,
    });
    setOpen(true);
  };

  const onSave = async () => {
    setErr("");
    setNotice("");
    try {
      const fd = new FormData();
      fd.append("title", String(form.title || ""));
      fd.append("is_active", form.is_active ? "true" : "false");
      if (form.image) fd.append("image", form.image);

      if (form.id) {
        await API.patch(`/business/admin/team-consumer/wishing-banners/${form.id}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setNotice("Banner updated.");
      } else {
        await API.post("/business/admin/team-consumer/wishing-banners/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setNotice("Banner created.");
      }
      setOpen(false);
      await fetchRows();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Save failed.");
    }
  };

  const onDelete = async (row) => {
    if (!row?.id) return;
    const ok = window.confirm(`Delete wishing banner "${row.title || row.id}"?`);
    if (!ok) return;
    setErr("");
    setNotice("");
    try {
      await API.delete(`/business/admin/team-consumer/wishing-banners/${row.id}/`);
      setNotice("Deleted.");
      await fetchRows();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Delete failed.");
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2.5}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Team/Consumer • Wishing Banners
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Admin uploads banner images; Team Dashboard displays active banners as a carousel.
            </Typography>
          </Box>
          <Button variant="contained" onClick={openCreate}>
            Upload Banner
          </Button>
        </Box>

        {err ? <Alert severity="error">{err}</Alert> : null}
        {notice ? <Alert severity="success">{notice}</Alert> : null}

        <TextField label="Search (title)" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
        <Divider />

        <Grid container spacing={2}>
          {(filtered || []).map((r) => (
            <Grid item xs={12} md={6} key={r.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {r.title || `Banner #${r.id}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Active: {r.is_active ? "Yes" : "No"}
                    </Typography>
                    {r.image_url ? (
                      <Box
                        component="img"
                        src={r.image_url}
                        alt={r.title || "banner"}
                        sx={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 1, border: "1px solid #e5e7eb" }}
                      />
                    ) : null}
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => onDelete(r)}>
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {!loading && !filtered.length ? (
          <Typography variant="body2" color="text.secondary">
            No banners found.
          </Typography>
        ) : null}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? "Edit Wishing Banner" : "Upload Wishing Banner"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              fullWidth
            />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Banner Image
              </Typography>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.files?.[0] || null }))}
              />
              {form.image_url ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Current: {form.image_url}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={onSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
