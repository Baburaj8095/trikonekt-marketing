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

const labels = {
  PDF: {
    title: "Team/Consumer - Trikonekt PDF Uploads",
    helper: "Upload the PDF opened from the Team Dashboard Trikonekt PDF action.",
    button: "Upload PDF",
  },
  BUSINESS_PDF: {
    title: "Team/Consumer - Trikonekt Business PDF",
    helper: "Upload the business PDF used by Trikonekt Business front-page/content actions.",
    button: "Upload Business PDF",
  },
  CERTIFICATE: {
    title: "Team/Consumer - Certificate Uploads",
    helper: "Upload the certificate PDF downloaded from the Team Dashboard certificate action.",
    button: "Upload Certificate",
  },
};

export default function AdminTeamConsumerDocuments({ kind = "PDF" }) {
  const normalizedKind = String(kind || "PDF").toUpperCase();
  const copy = labels[normalizedKind] || labels.PDF;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: null, title: "", sort_order: 0, is_active: true, file: null });

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => String(r.title || "").toLowerCase().includes(s));
  }, [rows, q]);

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/business/admin/team-consumer/documents/", { params: { kind: normalizedKind, page_size: 500 } });
      setRows(Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [normalizedKind]);

  const openCreate = () => {
    setNotice("");
    setForm({ id: null, title: "", sort_order: 0, is_active: true, file: null });
    setOpen(true);
  };

  const openEdit = (row) => {
    setNotice("");
    setForm({
      id: row.id,
      title: row.title || "",
      sort_order: Number(row.sort_order || 0),
      is_active: !!row.is_active,
      file: null,
      file_url: row.file_url || row.file || "",
    });
    setOpen(true);
  };

  const onSave = async () => {
    setErr("");
    setNotice("");
    try {
      const fd = new FormData();
      fd.append("kind", normalizedKind);
      fd.append("title", String(form.title || "").trim());
      fd.append("sort_order", String(Number(form.sort_order || 0)));
      fd.append("is_active", form.is_active ? "true" : "false");
      if (form.file) fd.append("file", form.file);

      if (form.id) {
        await API.patch(`/business/admin/team-consumer/documents/${form.id}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setNotice("Document updated.");
      } else {
        await API.post("/business/admin/team-consumer/documents/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setNotice("Document uploaded.");
      }
      setOpen(false);
      await fetchRows();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Save failed.");
    }
  };

  const onDelete = async (row) => {
    if (!row?.id || !window.confirm(`Delete document "${row.title || row.id}"?`)) return;
    setErr("");
    setNotice("");
    try {
      await API.delete(`/business/admin/team-consumer/documents/${row.id}/`);
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
            <Typography variant="h5" sx={{ fontWeight: 900 }}>{copy.title}</Typography>
            <Typography variant="body2" color="text.secondary">{copy.helper}</Typography>
          </Box>
          <Button variant="contained" onClick={openCreate}>{copy.button}</Button>
        </Box>

        {err ? <Alert severity="error">{err}</Alert> : null}
        {notice ? <Alert severity="success">{notice}</Alert> : null}

        <TextField label="Search documents" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
        <Divider />

        <Grid container spacing={2}>
          {filtered.map((r) => (
            <Grid item xs={12} md={6} key={r.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{r.title || `Document #${r.id}`}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Sort: {r.sort_order} - Active: {r.is_active ? "Yes" : "No"}
                    </Typography>
                    {resolveMedia(r.file_url || r.file) ? (
                      <Button href={resolveMedia(r.file_url || r.file)} target="_blank" rel="noreferrer" variant="outlined" size="small">
                        Open PDF
                      </Button>
                    ) : null}
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(r)}>Edit</Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => onDelete(r)}>Delete</Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {!loading && !filtered.length ? (
          <Typography variant="body2" color="text.secondary">No documents found.</Typography>
        ) : null}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? "Edit Document" : copy.button}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} fullWidth />
            <TextField label="Sort Order" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} fullWidth />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>PDF File</Typography>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
              {form.file_url ? <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>Current: {form.file_url}</Typography> : null}
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
