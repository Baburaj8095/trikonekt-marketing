import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import API from "../../api/api";

const copyByKind = {
  PDF: {
    title: "Trikonekt PDF",
    empty: "Trikonekt PDF is not uploaded yet.",
    filename: "trikonekt-pdf.pdf",
  },
  CERTIFICATE: {
    title: "Certificate Download",
    empty: "Certificate is not uploaded yet.",
    filename: "trikonekt-certificate.pdf",
  },
};

function resolveDocumentUrl(raw) {
  if (!raw) return "";
  const s = String(raw);
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;
  const mediaBase = String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");
  return mediaBase ? `${mediaBase}${s.startsWith("/") ? "" : "/"}${s}` : s;
}

export default function TeamDocumentDownload({ kind = "PDF" }) {
  const normalizedKind = String(kind || "PDF").toUpperCase();
  const copy = copyByKind[normalizedKind] || copyByKind.PDF;
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fileUrl = useMemo(() => resolveDocumentUrl(doc?.file_url || doc?.file), [doc]);
  const fileName = useMemo(() => {
    const title = String(doc?.title || copy.filename).trim() || copy.filename;
    const safe = title.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
    return /\.pdf$/i.test(safe) ? safe : `${safe || copy.filename}.pdf`;
  }, [copy.filename, doc?.title]);

  const fetchDocument = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get(`/business/team-consumer/documents/${normalizedKind}/latest/`, {
        retryAttempts: 1,
      });
      setDoc(res?.data || null);
    } catch (e) {
      setDoc(null);
      setErr(e?.response?.data?.detail || copy.empty);
    } finally {
      setLoading(false);
    }
  }, [copy.empty, normalizedKind]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const openDocument = () => {
    if (!fileUrl) return;
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  const downloadDocument = () => {
    if (!fileUrl) return;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = fileName;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 860, mx: "auto", py: { xs: 2, md: 3 }, px: { xs: 1.5, md: 2 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 1000, color: "#111827" }}>
            {copy.title}
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>
            Download the latest document uploaded by admin.
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 2,
            border: "1px solid #e2e8f0",
            bgcolor: "#fff",
          }}
        >
          {loading ? (
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CircularProgress size={20} />
              <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Loading document...</Typography>
            </Stack>
          ) : err ? (
            <Alert severity="info">{err}</Alert>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: 1.5,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(37,99,235,0.1)",
                    color: "#2563eb",
                  }}
                >
                  <PictureAsPdfRoundedIcon />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 17, fontWeight: 1000, color: "#111827" }} noWrap>
                    {doc?.title || copy.title}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                    PDF document
                  </Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<FileDownloadRoundedIcon />}
                  onClick={downloadDocument}
                  disabled={!fileUrl}
                  sx={{ textTransform: "none", fontWeight: 900 }}
                >
                  Download
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<OpenInNewRoundedIcon />}
                  onClick={openDocument}
                  disabled={!fileUrl}
                  sx={{ textTransform: "none", fontWeight: 900 }}
                >
                  Open PDF
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
