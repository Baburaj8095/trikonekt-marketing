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
  useMediaQuery,
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
  if (!(blob instanceof Blob)) {
    throw new Error("Invoice download did not return a PDF file.");
  }
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

function EmptyState() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: "1px dashed #cbd5e1",
        bgcolor: "#f8fafc",
        textAlign: "center",
        color: "#64748b",
        fontWeight: 750,
      }}
    >
      No prime invoices found.
    </Paper>
  );
}

function DetailRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.45 }}>
      <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 750 }}>{label}</Typography>
      <Typography component="div" sx={{ fontSize: 12.5, color: "#0f172a", fontWeight: 850, textAlign: "right", overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function InvoiceCard({ row, index, downloadingId, onDownload }) {
  return (
    <Paper elevation={0} className="consumer-fintech-card" sx={{ p: 1.5, borderRadius: 3 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.5} sx={{ mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>{row.invoice_number}</Typography>
          <Typography sx={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>{fmtDate(row.invoice_date)}</Typography>
        </Box>
        <Chip size="small" label={row.payment_mode || "-"} sx={{ height: 24 }} />
      </Stack>

      <DetailRow label="SL No" value={index + 1} />
      <DetailRow label="Invoice No" value={row.invoice_number} />
      <DetailRow label="Date" value={fmtDate(row.invoice_date)} />
      <DetailRow
        label="Package"
        value={
          <Box>
            <Box>{row.package_name || "-"}</Box>
            <Typography component="div" sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
              {row.package_code || ""}
            </Typography>
          </Box>
        }
      />
      <DetailRow label="Quantity" value={row.quantity || 1} />
      <DetailRow
        label="GST"
        value={
          <Box>
            <Box>Rs. {fmtAmount(row.gst_amount)}</Box>
            <Typography component="div" sx={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
              {fmtAmount(row.gst_percent)}%
            </Typography>
          </Box>
        }
      />
      <DetailRow label="Total" value={`Rs. ${fmtAmount(row.total_amount)}`} />
      <DetailRow label="Payment" value={row.payment_mode || "-"} />
      <Box sx={{ pt: 1 }}>
        <Button
          size="small"
          variant="contained"
          fullWidth
          startIcon={<DownloadRoundedIcon />}
          disabled={downloadingId === row.id}
          onClick={() => onDownload(row)}
          sx={{ fontWeight: 850 }}
        >
          {downloadingId === row.id ? "Downloading..." : "Download"}
        </Button>
      </Box>
    </Paper>
  );
}

export default function PrimeInvoices() {
  const isMobile = useMediaQuery("(max-width:700px)");
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
      const blob = res?.data instanceof Blob ? res.data : res instanceof Blob ? res : null;
      const contentType = String(res?.headers?.["content-type"] || blob?.type || "");
      if (blob && contentType.includes("application/json")) {
        const text = await blob.text();
        const parsed = JSON.parse(text || "{}");
        throw new Error(parsed?.detail || "Failed to download invoice.");
      }
      const safeNo = String(row.invoice_number || row.id).replace(/[^\w.-]+/g, "_");
      downloadBlob(blob, `Trikonekt_Invoice_${safeNo}.pdf`);
    } catch (err) {
      const msg = await readBlobError(err);
      setError(msg || "Failed to download invoice.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Box className="consumer-fintech-page" sx={{ maxWidth: 1120, mx: "auto", px: { xs: 0.5, sm: 2 }, py: { xs: 1, sm: 2.5 } }}>
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
        <Button variant="outlined" onClick={load} sx={{ fontWeight: 850, width: { xs: "100%", sm: "auto" } }}>
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}

      {isMobile ? (
        <Stack spacing={1.2}>
          {rows.map((row, index) => (
            <InvoiceCard
              key={row.id || index}
              row={row}
              index={index}
              downloadingId={downloadingId}
              onDownload={downloadInvoice}
            />
          ))}
          {!rows.length && !loading ? <EmptyState /> : null}
        </Stack>
      ) : (
      <Paper elevation={0} className="consumer-fintech-card" sx={{ borderRadius: 3, overflow: "hidden", bgcolor: "#fff" }}>
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
      )}
    </Box>
  );
}
