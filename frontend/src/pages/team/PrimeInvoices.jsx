import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import API, { listPrimePackageInvoices } from "../../api/api";

function fmtAmount(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function fmtDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "-";
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

async function readBlobError(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      if (!text) return "";
      try {
        const parsed = JSON.parse(text);
        return parsed?.detail || parsed?.message || text;
      } catch {
        return text;
      }
    } catch {
      return "";
    }
  }
  return err?.response?.data?.detail || err?.message || "";
}

export default function PrimeInvoices() {
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await listPrimePackageInvoices();
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load prime invoices.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function downloadInvoice(row) {
    try {
      setDownloadingId(row.id);
      const res = await API.get(`/business/promo/prime-invoices/${row.id}/pdf/`, {
        responseType: "blob",
        timeout: 60000,
      });
      const contentType = String(res?.headers?.["content-type"] || "");
      if (contentType.includes("application/json")) {
        const text = await res.data.text();
        const parsed = JSON.parse(text || "{}");
        throw new Error(parsed?.detail || "Failed to download invoice.");
      }
      const safeNo = String(row.invoice_number || row.id).replace(/[^\w.-]+/g, "_");
      downloadBlob(res.data, `Trikonekt_Invoice_${safeNo}.pdf`);
    } catch (err) {
      const msg = await readBlobError(err);
      setError(msg || "Failed to download invoice.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Box sx={{ maxWidth: 1120, mx: "auto", px: { xs: 1.2, sm: 2 }, py: { xs: 1.5, sm: 2.5 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ReceiptLongRoundedIcon sx={{ color: "#0f172a" }} />
            <Typography variant="h5" sx={{ fontWeight: 900, color: "#0f172a" }}>
              Prime Invoices
            </Typography>
          </Stack>
          <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.5 }}>
            Download GST invoices for approved consumer Prime package purchases.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={load} sx={{ textTransform: "none", fontWeight: 800 }}>
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                <TableCell sx={{ fontWeight: 900 }}>SL No</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Invoice No</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Package</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Quantity</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>GST</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Payment</TableCell>
                <TableCell sx={{ fontWeight: 900, textAlign: "right" }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id || index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>{row.invoice_number}</TableCell>
                  <TableCell>{fmtDate(row.invoice_date)}</TableCell>
                  <TableCell>
                    <Box sx={{ fontWeight: 700 }}>{row.package_name || "-"}</Box>
                    <Typography variant="caption" sx={{ color: "#64748b" }}>
                      {row.package_code || ""}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.quantity || 1}</TableCell>
                  <TableCell>
                    Rs. {fmtAmount(row.gst_amount)}
                    <Typography variant="caption" sx={{ display: "block", color: "#64748b" }}>
                      {fmtAmount(row.gst_percent)}%
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Rs. {fmtAmount(row.total_amount)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={row.payment_mode || "-"} sx={{ fontWeight: 800 }} />
                  </TableCell>
                  <TableCell sx={{ textAlign: "right" }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<DownloadRoundedIcon />}
                      disabled={downloadingId === row.id}
                      onClick={() => downloadInvoice(row)}
                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      {downloadingId === row.id ? "Downloading..." : "Download"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && !loading ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ color: "#94a3b8", py: 4, textAlign: "center" }}>
                    No prime invoices found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
