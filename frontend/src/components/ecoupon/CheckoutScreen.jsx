import React from "react";
import { Box, Paper, Typography, Stack, Button } from "@mui/material";
import normalizeMediaUrl from "../../utils/media";

/**
 * CheckoutScreen (QR payment screen)
 * - Shows static/dynamic QR and instructions
 *
 * Props:
 * - paymentConfig?: {
 *     upi_qr_image_url?: string,
 *     payee_name?: string,
 *     upi_id?: string,
 *     instructions?: string
 *   }
 * - onUploadProof?: () => void
 * - onProceed?: () => void
 */
export default function CheckoutScreen({ paymentConfig, onUploadProof, onProceed }) {
  const payment = paymentConfig || {};

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#fff",
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Scan QR to Pay
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Box
          sx={{
            width: 220,
            height: 220,
            borderRadius: 2,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {payment.upi_qr_image_url ? (
            <img
              alt="UPI QR Code"
              src={normalizeMediaUrl(payment.upi_qr_image_url)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <img
              alt="QR Placeholder"
              src={
                "data:image/svg+xml;utf8," +
                encodeURIComponent(`
                <svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>
                  <rect width='100%' height='100%' fill='#f8fafc'/>
                  <rect x='40' y='40' width='320' height='320' fill='#e2e8f0'/>
                  <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Montserrat,Arial' font-size='18' fill='#64748b'>QR Not Configured</text>
                </svg>`)
              }
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary">
              Payee
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {payment.payee_name || "—"}
            </Typography>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              UPI ID
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {payment.upi_id || "—"}
            </Typography>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Instructions
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {payment.instructions ||
                "Scan the QR or pay to the UPI ID. Upload payment proof or wait for admin confirmation."}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={onUploadProof}>
              Upload Payment Proof
            </Button>
            <Button variant="contained" onClick={onProceed}>
              Proceed
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
