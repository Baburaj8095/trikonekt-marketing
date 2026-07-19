import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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

function apiErrorMessage(e, fallback) {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  const firstValue = firstKey ? data[firstKey] : "";
  if (Array.isArray(firstValue)) return firstValue.join(" ");
  if (typeof firstValue === "string") return firstValue;
  return fallback;
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

  const videoByRank = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      if (row.required_rank && !map.has(String(row.required_rank))) {
        map.set(String(row.required_rank), row);
      }
    });
    return map;
  }, [rows]);

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

  const openCreate = (rankId = "") => {
    setNotice("");
    setErr("");
    setForm({ ...emptyForm, required_rank: rankId, sort_order: rankId ? Number(ranks.find((r) => String(r.id) === String(rankId))?.level_number || 0) : 0 });
    setOpen(true);
  };

  const openEdit = (row) => {
    setNotice("");
    setErr("");
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
    if (!form.required_rank) {
      setErr("Select Digital Education Prime rank.");
      return;
    }
    if (!form.id && !form.video && !form.youtube_url) {
      setErr("Provide a YouTube Video Link or select a video file before saving.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("title", String(form.title || "").trim());
      fd.append("description", String(form.description || ""));
      fd.append("required_rank", String(form.required_rank));
      fd.append("sort_order", String(Number(form.sort_order || 0)));
      fd.append("is_active", form.is_active ? "true" : "false");
      if (form.youtube_url) fd.append("youtube_url", String(form.youtube_url || "").trim());
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
      setErr(apiErrorMessage(e, "Save failed."));
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
              Map one educational video to each Digital Education Prime rank.
            </Typography>
          </Box>
          <Button variant="contained" onClick={() => openCreate()}>
            Add Rank Video
          </Button>
        </Box>

        {err ? <Alert severity="error">{err}</Alert> : null}
        {notice ? <Alert severity="success">{notice}</Alert> : null}

        <TextField label="Search videos" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
        <Divider />

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
            Prime Rank Video Map
          </Typography>
          <Grid container spacing={1.5}>
            {ranks.map((rank) => {
              const mapped = videoByRank.get(String(rank.id));
              return (
                <Grid item xs={12} sm={6} md={4} key={rank.id}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography sx={{ fontWeight: 900 }}>
                            L{rank.level_number} - {rank.rank_name}
                          </Typography>
                          <Chip size="small" color={mapped ? "success" : "default"} label={mapped ? "Mapped" : "Empty"} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Prime amount Rs.{Number(rank.upgrade_amount || 0).toFixed(2)}
                        </Typography>
                        {mapped ? (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {mapped.title || `Video #${mapped.id}`}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No video uploaded for this rank.
                          </Typography>
                        )}
                        <Button size="small" variant={mapped ? "outlined" : "contained"} onClick={() => (mapped ? openEdit(mapped) : openCreate(rank.id))}>
                          {mapped ? "Edit Video" : "Upload Video"}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

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
                {ranks.map((rank) => (
                  <MenuItem
                    key={rank.id}
                    value={rank.id}
                    disabled={videoByRank.has(String(rank.id)) && String(form.required_rank) !== String(rank.id)}
                  >
                    L{rank.level_number} - {rank.rank_name} - Rs.{Number(rank.upgrade_amount || 0).toFixed(2)}
                    {videoByRank.has(String(rank.id)) && String(form.required_rank) !== String(rank.id) ? " - already mapped" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Sort Order" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} fullWidth />
            <TextField 
              label="YouTube Video Link (Recommended)" 
              value={form.youtube_url || ""} 
              onChange={(e) => setForm((f) => ({ ...f, youtube_url: e.target.value }))} 
              fullWidth 
              placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/..." 
              helperText="Paste an Unlisted or Public YouTube video link for ultra-fast zero-buffering playback."
            />
            {form.youtube_url && (
              <Box sx={{ mt: 1, p: 1, border: "1px solid #e2e8f0", borderRadius: 2, bgcolor: "#f8fafc" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 700 }}>
                  YouTube Thumbnail Preview:
                </Typography>
                <Box 
                  component="img" 
                  src={`https://img.youtube.com/vi/${(String(form.youtube_url).match(/(?:v=|\/embed\/|\/v\/|https:\/\/youtu\.be\/|\/watch\?v=|\&v=)([^#\&\?]{11})/) || [])[1] || ""}/hqdefault.jpg`} 
                  alt="YouTube Preview" 
                  onError={(e) => { e.target.style.display = 'none'; }}
                  sx={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 1.5 }} 
                />
              </Box>
            )}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Or Upload MP4 File (Optional)</Typography>
              <input type="file" accept="video/*" onChange={(e) => setForm((f) => ({ ...f, video: e.target.files?.[0] || null }))} />
              {form.video_url ? <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>Current File: {form.video_url}</Typography> : null}
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
