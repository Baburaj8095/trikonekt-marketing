import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import API from "../../../api/api";

function getApiError(error) {
  const data = error?.response?.data;
  if (!data) return "Failed to load education PDFs.";
  if (typeof data === "string") return data;
  return data.detail || JSON.stringify(data);
}

export default function FranchiseEducationPDFs() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setError("");
        setLoading(true);
        const res = await API.get("/accounts/franchise/education-pdfs/", { dedupe: "cancelPrevious" });
        if (!mounted) return;
        setRows(res?.data?.results || []);
      } catch (e) {
        if (mounted) setError(getApiError(e));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f7f9ff", py: { xs: 1.5, md: 3 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ color: "#0f172a", fontWeight: 950, fontSize: { xs: "1.35rem", md: "1.9rem" } }}>
              Educating PDF Trikonekt
            </Typography>
            <Typography sx={{ color: "#64748b", fontWeight: 600, fontSize: "0.92rem" }}>
              View or download the latest franchise education PDFs uploaded by admin.
            </Typography>
          </Box>
          {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Grid container spacing={2}>
            {rows.map((row) => (
              <Grid item xs={12} sm={6} md={4} key={row.id}>
                <Card sx={{ height: "100%", borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 16px 40px rgba(15,23,42,0.07)" }}>
                  <CardContent sx={{ p: 2.2 }}>
                    <Stack spacing={1.5} sx={{ height: "100%" }}>
                      <Box sx={{ width: 54, height: 54, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#fee2e2", color: "#dc2626" }}>
                        <PictureAsPdfRoundedIcon sx={{ fontSize: 30 }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: "#0f172a", fontWeight: 950, fontSize: "1rem" }}>{row.title}</Typography>
                        <Typography sx={{ mt: 0.5, color: "#64748b", fontWeight: 600, fontSize: "0.84rem" }}>{row.description || "PDF document"}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button href={row.file_url} target="_blank" rel="noreferrer" startIcon={<OpenInNewRoundedIcon />} sx={{ borderRadius: 2, textTransform: "none", fontWeight: 900 }}>
                          View
                        </Button>
                        <Button href={row.file_url} download startIcon={<DownloadRoundedIcon />} sx={{ borderRadius: 2, textTransform: "none", fontWeight: 900 }}>
                          Download
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          {!loading && !rows.length ? (
            <Box sx={{ py: 6, textAlign: "center", border: "1px dashed #cbd5e1", borderRadius: 3, bgcolor: "#fff" }}>
              <Typography sx={{ color: "#0f172a", fontWeight: 900 }}>No education PDFs uploaded yet</Typography>
            </Box>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
