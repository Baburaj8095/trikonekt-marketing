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
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

const emptyForm = {
  id: null,
  title: "",
  description: "",
  required_rank: "",
  sort_order: 0,
  is_active: true,
  video: null,
  thumbnail: null,
};

const MEDIA_BASE = String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");

function resolveMedia(raw) {
  if (!raw) return "";
  const s = String(raw);
  if (s.startsWith("data:")) return s;
  if (/^https?:\/\//i.test(s)) {
    if (/^https?:\/\/localhost(?::\d+)?\//i.test(s) && MEDIA_BASE) {
      return `${MEDIA_BASE}${s.replace(/^https?:\/\/localhost(?::\d+)?/i, "")}`;
    }
    return s;
  }
  return MEDIA_BASE ? `${MEDIA_BASE}${s.startsWith("/") ? "" : "/"}${s}` : s;
}

export default function AdminTeamConsumerEducationalVideos() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");
  const [ranks, setRanks] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.title || ""} ${r.description || ""}`.toLowerCase().includes(s));
  }, [rows, q]);

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/business/admin/team-consumer/educational-videos/", { params: { page_size: 500 } });
      setRows(Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load educational videos.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRanks = async () => {
    try {
      const res = await API.get("/ranks/", { cacheTTL: 10000 });
      setRanks(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setRanks([]);
    }
  };

  useEffect(() => {
    fetchRows();
    fetchRanks();
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
      description: row.description || "",
      required_rank: row.required_rank || "",
      sort_order: Number(row.sort_order || 0),
      is_active: !!row.is_active,
      video: null,
      thumbnail: null,
      video_url: row.video_url || row.video || "",
      thumbnail_url: row.thumbnail_url || row.thumbnail || "",
    });
    setOpen(true);
  };

  const onSave = async () => {
    setErr("");
    setNotice("");
    try {
      const fd = new FormData();
      fd.append("title", String(form.title || "").trim());
      fd.append("description", String(form.description || ""));
      if (form.required_rank) fd.append("required_rank", String(form.required_rank));
      fd.append("sort_order", String(Number(form.sort_order || 0)));
      fd.append("is_active", form.is_active ? "true" : "false");
      if (form.video) fd.append("video", form.video);
      if (form.thumbnail) fd.append("thumbnail", form.thumbnail);

      if (form.id) {
        await API.patch(`/business/admin/team-consumer/educational-videos/${form.id}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setNotice("Educational video updated.");
      } else {
        await API.post("/business/admin/team-consumer/educational-videos/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setNotice("Educational video uploaded.");
      }
      setOpen(false);
      await fetchRows();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Save failed.");
    }
  };

  const onDelete = async (row) => {
    if (!row?.id || !window.confirm(`Delete video "${row.title || row.id}"?`)) return;
    setErr("");
    setNotice("");
    try {
      await API.delete(`/business/admin/team-consumer/educational-videos/${row.id}/`);
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
              Team/Consumer - Educational Video Uploads
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload videos shown in the Team Dashboard horizontal education scroller.
            </Typography>
          </Box>
          <Button variant="contained" onClick={openCreate}>
            Upload Video
          </Button>
        </Box>

        {err ? <Alert severity="error">{err}</Alert> : null}
        {notice ? <Alert severity="success">{notice}</Alert> : null}

        <TextField label="Search videos" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
        <Divider />

        <Grid container spacing={2}>
          {filtered.map((r) => (
            <Grid item xs={12} md={6} key={r.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {r.title || `Video #${r.id}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {r.description || "No description"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Prime: {r.required_rank_name || "Not mapped"} - Sort: {r.sort_order} - Active: {r.is_active ? "Yes" : "No"}
                    </Typography>
                    {resolveMedia(r.thumbnail_url || r.thumbnail) ? (
                      <Box component="img" src={resolveMedia(r.thumbnail_url || r.thumbnail)} alt={r.title || "thumbnail"} sx={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 1, border: "1px solid #e5e7eb" }} />
                    ) : null}
                    {resolveMedia(r.video_url || r.video) ? (
                      <Button href={resolveMedia(r.video_url || r.video)} target="_blank" rel="noreferrer" variant="outlined" size="small">
                        Open Video
                      </Button>
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
            No educational videos found.
          </Typography>
        ) : null}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? "Edit Educational Video" : "Upload Educational Video"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} fullWidth />
            <TextField label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth multiline minRows={3} />
            <FormControl fullWidth>
              <InputLabel id="required-rank-label">Digital Education Prime</InputLabel>
              <Select
                labelId="required-rank-label"
                label="Digital Education Prime"
                value={form.required_rank || ""}
                onChange={(e) => setForm((f) => ({ ...f, required_rank: e.target.value }))}
              >
                <MenuItem value="">Not mapped</MenuItem>
                {ranks.map((rank) => (
                  <MenuItem key={rank.id} value={rank.id}>
                    L{rank.level_number} - {rank.rank_name} - Rs.{Number(rank.upgrade_amount || 0).toFixed(2)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Sort Order" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} fullWidth />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Video File</Typography>
              <input type="file" accept="video/*" onChange={(e) => setForm((f) => ({ ...f, video: e.target.files?.[0] || null }))} />
              {form.video_url ? <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>Current: {form.video_url}</Typography> : null}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Thumbnail Image</Typography>
              <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.files?.[0] || null }))} />
              {form.thumbnail_url ? <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>Current: {form.thumbnail_url}</Typography> : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={onSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
