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
  name: "",
  achieved: "",
  sort_order: 0,
  is_active: true,
  photo: null,
};

export default function AdminTeamConsumerTopAchievers() {
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
    return rows.filter((r) => {
      return (
        String(r.name || "").toLowerCase().includes(s) ||
        String(r.achieved || "").toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/business/admin/team-consumer/top-achievers/", { params: { page_size: 500 } });
      const items = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
      setRows(items);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load top achievers.");
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
      name: row.name || "",
      achieved: row.achieved || "",
      sort_order: Number(row.sort_order || 0),
      is_active: !!row.is_active,
      photo: null,
      photo_url: row.photo_url || null,
    });
    setOpen(true);
  };

  const onSave = async () => {
    setErr("");
    setNotice("");
    try {
      const fd = new FormData();
      fd.append("name", String(form.name || "").trim());
      fd.append("achieved", String(form.achieved || ""));
      fd.append("sort_order", String(Number(form.sort_order || 0)));
      fd.append("is_active", form.is_active ? "true" : "false");
      if (form.photo) fd.append("photo", form.photo);

      if (form.id) {
        await API.patch(`/business/admin/team-consumer/top-achievers/${form.id}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setNotice("Top achiever updated.");
      } else {
        await API.post("/business/admin/team-consumer/top-achievers/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setNotice("Top achiever created.");
      }
      setOpen(false);
      await fetchRows();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Save failed.");
    }
  };

  const onDelete = async (row) => {
    if (!row?.id) return;
    const ok = window.confirm(`Delete achiever "${row.name || row.id}"?`);
    if (!ok) return;
    setErr("");
    setNotice("");
    try {
      await API.delete(`/business/admin/team-consumer/top-achievers/${row.id}/`);
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
              Team/Consumer • Top Achievers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Admin adds top performers (name, photo, achieved). Team Dashboard shows them in a horizontal scroller.
            </Typography>
          </Box>
          <Button variant="contained" onClick={openCreate}>
            Add Achiever
          </Button>
        </Box>

        {err ? <Alert severity="error">{err}</Alert> : null}
        {notice ? <Alert severity="success">{notice}</Alert> : null}

        <TextField
          label="Search (name / achieved)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fullWidth
        />

        <Divider />

        <Grid container spacing={2}>
          {(filtered || []).map((r) => (
            <Grid item xs={12} md={6} key={r.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {r.name || `Achiever #${r.id}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Achieved: {r.achieved || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Sort: {r.sort_order} • Active: {r.is_active ? "Yes" : "No"}
                    </Typography>
                    {r.photo_url ? (
                      <Box
                        component="img"
                        src={r.photo_url}
                        alt={r.name || "achiever"}
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
            No achievers found.
          </Typography>
        ) : null}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? "Edit Achiever" : "Add Achiever"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Achieved"
              value={form.achieved}
              onChange={(e) => setForm((f) => ({ ...f, achieved: e.target.value }))}
              placeholder="Top Performer"
              fullWidth
            />
            <TextField
              label="Sort Order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              fullWidth
            />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Photo
              </Typography>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setForm((f) => ({ ...f, photo: e.target.files?.[0] || null }))}
              />
              {form.photo_url ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Current: {form.photo_url}
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
