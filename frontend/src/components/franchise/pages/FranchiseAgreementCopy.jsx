import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import API from "../../../api/api";

async function readBlobError(error) {
  try {
    const data = error?.response?.data;
    if (data instanceof Blob) {
      const text = await data.text();
      try {
        return JSON.parse(text)?.detail || text;
      } catch (_) {
        return text;
      }
    }
    return data?.detail || "Failed to download agreement.";
  } catch (_) {
    return "Failed to download agreement.";
  }
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function FranchiseAgreementCopy() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const downloadAgreement = async () => {
    try {
      setError("");
      setDownloading(true);
      const res = await API.get("/accounts/franchise/agreement/pdf/", {
        responseType: "blob",
        timeout: 60000,
      });
      const blob = res?.data;
      if (!(blob instanceof Blob)) throw new Error("Agreement download did not return a PDF file.");
      downloadBlob(blob, "Trikonekt_Franchise_Agreement.pdf");
    } catch (e) {
      setError(await readBlobError(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f7f9ff", py: { xs: 1.5, md: 3 } }}>
      <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ color: "#0f172a", fontWeight: 950, fontSize: { xs: "1.35rem", md: "1.9rem" } }}>
              Franchise Agreement Copy
            </Typography>
            <Typography sx={{ color: "#64748b", fontWeight: 600, fontSize: "0.92rem" }}>
              Download your dynamically generated agreement with your registered agency details.
            </Typography>
          </Box>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Card sx={{ borderRadius: 3, border: "1px solid #e2e8f0", boxShadow: "0 16px 40px rgba(15,23,42,0.07)" }}>
            <CardContent sx={{ p: { xs: 2.2, md: 3 } }}>
              <Stack spacing={2.2} alignItems="flex-start">
                <Box sx={{ width: 64, height: 64, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "#e0f2fe", color: "#0369a1" }}>
                  <PictureAsPdfRoundedIcon sx={{ fontSize: 36 }} />
                </Box>
                <Box>
                  <Typography sx={{ color: "#0f172a", fontWeight: 950, fontSize: "1.15rem" }}>
                    Trikonekt Franchise Agreement
                  </Typography>
                  <Typography sx={{ mt: 0.5, color: "#64748b", fontWeight: 600, fontSize: "0.9rem" }}>
                    The PDF is generated from the admin agreement template using your name, phone number, category role, and registered geo location.
                  </Typography>
                </Box>
                <Button
                  onClick={downloadAgreement}
                  disabled={downloading}
                  startIcon={<DownloadRoundedIcon />}
                  sx={{ borderRadius: 2, px: 2.5, py: 1.1, bgcolor: "#2563eb", color: "#fff", textTransform: "none", fontWeight: 900, "&:hover": { bgcolor: "#1d4ed8" } }}
                >
                  {downloading ? "Generating..." : "Download Agreement"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
