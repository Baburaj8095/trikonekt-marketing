import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } };

function getApiError(error) {
  const data = error?.response?.data;
  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  return data.detail || JSON.stringify(data);
}

export default function AdminFranchiseDocuments() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pdfs, setPdfs] = useState([]);
  const [upload, setUpload] = useState({ title: "", description: "", file: null });
  const [agreement, setAgreement] = useState({ title: "Franchise Agreement", content: "" });

  const loadData = async () => {
    try {
      setError("");
      setLoading(true);
      const [pdfRes, agreementRes] = await Promise.all([
        API.get("/accounts/admin/franchise/education-pdfs/", { dedupe: "cancelPrevious" }),
        API.get("/accounts/admin/franchise/agreement-template/", { dedupe: "cancelPrevious" }),
      ]);
      setPdfs(pdfRes?.data?.results || []);
      setAgreement({
        title: agreementRes?.data?.title || "Franchise Agreement",
        content: agreementRes?.data?.content || "",
      });
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const uploadPdf = async () => {
    if (!upload.title || !upload.file) {
      setError("Title and PDF file are required.");
      return;
    }
    try {
      setSaving("pdf");
      setError("");
      setMessage("");
      const fd = new FormData();
      fd.append("title", upload.title);
      fd.append("description", upload.description || "");
      fd.append("file", upload.file);
      await API.post("/accounts/admin/franchise/education-pdfs/", fd);
      setUpload({ title: "", description: "", file: null });
      setMessage("Education PDF uploaded successfully.");
      await loadData();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setSaving("");
    }
  };

  const togglePdf = async (row) => {
    try {
      setSaving(`pdf-${row.id}`);
      await API.patch("/accounts/admin/franchise/education-pdfs/", {
        id: row.id,
        is_active: !row.is_active,
      });
      await loadData();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setSaving("");
    }
  };

  const saveAgreement = async () => {
    try {
      setSaving("agreement");
      setError("");
      setMessage("");
      await API.patch("/accounts/admin/franchise/agreement-template/", agreement);
      setMessage("Franchise agreement template saved.");
      await loadData();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setSaving("");
    }
  };

  return (
    <Box>
      <Stack spacing={2.5}>
        <Box>
          <Typography sx={{ color: "#0f172a", fontWeight: 900, fontSize: { xs: "1.35rem", md: "1.75rem" } }}>
            Franchise Documents
          </Typography>
          <Typography sx={{ color: "#64748b", fontWeight: 600, fontSize: "0.92rem" }}>
            Upload education PDFs and maintain the dynamic franchise agreement template.
          </Typography>
        </Box>

        {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {message ? <Alert severity="success">{message}</Alert> : null}

        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={5}>
            <Card sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, boxShadow: "0 14px 35px rgba(15,23,42,0.06)" }}>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={1.6}>
                  <Typography sx={{ color: "#0f172a", fontWeight: 900 }}>Education PDF Upload</Typography>
                  <TextField label="PDF title" value={upload.title} onChange={(e) => setUpload((p) => ({ ...p, title: e.target.value }))} fullWidth sx={fieldSx} />
                  <TextField label="Description" value={upload.description} onChange={(e) => setUpload((p) => ({ ...p, description: e.target.value }))} fullWidth multiline minRows={2} sx={fieldSx} />
                  <Button component="label" variant="outlined" sx={{ borderRadius: 2, textTransform: "none", fontWeight: 900 }}>
                    {upload.file ? upload.file.name : "Choose PDF"}
                    <input hidden type="file" accept="application/pdf,.pdf" onChange={(e) => setUpload((p) => ({ ...p, file: e.target.files?.[0] || null }))} />
                  </Button>
                  <Button onClick={uploadPdf} disabled={saving === "pdf"} sx={{ borderRadius: 2, py: 1.1, bgcolor: "#2563eb", color: "#fff", fontWeight: 900, textTransform: "none", "&:hover": { bgcolor: "#1d4ed8" } }}>
                    {saving === "pdf" ? "Uploading..." : "Upload PDF"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Card sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, boxShadow: "0 14px 35px rgba(15,23,42,0.06)" }}>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={1.6}>
                  <Typography sx={{ color: "#0f172a", fontWeight: 900 }}>Franchise Agreement Template</Typography>
                  <Alert severity="info">
                    Use placeholders: {"{full_name}"}, {"{phone}"}, {"{category_role}"}, {"{geo_location}"}, {"{date}"}
                  </Alert>
                  <TextField label="Agreement title" value={agreement.title} onChange={(e) => setAgreement((p) => ({ ...p, title: e.target.value }))} fullWidth sx={fieldSx} />
                  <TextField label="Agreement content" value={agreement.content} onChange={(e) => setAgreement((p) => ({ ...p, content: e.target.value }))} fullWidth multiline minRows={10} sx={fieldSx} />
                  <Button onClick={saveAgreement} disabled={saving === "agreement"} sx={{ alignSelf: "flex-start", borderRadius: 2, px: 2.5, py: 1.1, bgcolor: "#0f172a", color: "#fff", fontWeight: 900, textTransform: "none", "&:hover": { bgcolor: "#1e293b" } }}>
                    {saving === "agreement" ? "Saving..." : "Save Agreement"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ border: "1px solid #e2e8f0", borderRadius: 2.5, boxShadow: "0 14px 35px rgba(15,23,42,0.06)" }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.4}>
              <Typography sx={{ color: "#0f172a", fontWeight: 900 }}>Uploaded Education PDFs</Typography>
              {pdfs.length ? (
                pdfs.map((row) => (
                  <Stack key={row.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1} sx={{ p: 1.2, border: "1px solid #e2e8f0", borderRadius: 2, bgcolor: "#f8fafc" }}>
                    <Box>
                      <Typography sx={{ color: "#0f172a", fontWeight: 900 }}>{row.title}</Typography>
                      <Typography sx={{ color: "#64748b", fontSize: "0.82rem", fontWeight: 600 }}>{row.description || "No description"}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={row.is_active ? "Active" : "Hidden"} size="small" sx={{ fontWeight: 900, bgcolor: row.is_active ? "#dcfce7" : "#e2e8f0" }} />
                      <Button size="small" href={row.file_url} target="_blank" rel="noreferrer" sx={{ textTransform: "none", fontWeight: 900 }}>View</Button>
                      <Button size="small" onClick={() => togglePdf(row)} disabled={saving === `pdf-${row.id}`} sx={{ textTransform: "none", fontWeight: 900 }}>
                        {row.is_active ? "Hide" : "Show"}
                      </Button>
                    </Stack>
                  </Stack>
                ))
              ) : (
                <Typography sx={{ color: "#64748b", fontWeight: 700 }}>No PDFs uploaded yet.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
