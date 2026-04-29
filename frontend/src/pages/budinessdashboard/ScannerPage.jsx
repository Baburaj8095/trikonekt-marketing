import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import { Box, Button, Card, CardContent, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";

const UI = {
  bg: "#08111f",
  surface: "#ffffff",
  text: "#1f2937",
  muted: "#94a3b8",
  primary: "#0F52BA",
  onPrimary: "#ffffff",
};

function ScannerPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const timerRef = useRef(null);

  const [status, setStatus] = useState("Opening camera...");
  const [scanResult, setScanResult] = useState("");
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not supported in this browser.");
        }

        if (!("BarcodeDetector" in window)) {
          if (isMounted) {
            setIsSupported(false);
            setStatus("QR scanning is not supported in this browser. Try Chrome on mobile.");
          }
        } else {
          detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (isMounted) {
          setStatus("Align QR code inside the frame");
        }

        if (detectorRef.current) {
          timerRef.current = window.setInterval(async () => {
            try {
              if (!videoRef.current || videoRef.current.readyState < 2) return;
              const barcodes = await detectorRef.current.detect(videoRef.current);
              if (barcodes?.length) {
                const raw = barcodes[0]?.rawValue || "";
                if (raw) {
                  setScanResult(raw);
                  setStatus("QR scanned successfully");
                  if (timerRef.current) {
                    window.clearInterval(timerRef.current);
                    timerRef.current = null;
                  }
                }
              }
            } catch (_) {
              // Keep scanning quietly
            }
          }, 700);
        }
      } catch (error) {
        if (isMounted) {
          setStatus(error?.message || "Unable to start camera.");
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: UI.bg, color: UI.onPrimary }}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          px: 2,
          py: 1.5,
          backdropFilter: "blur(10px)",
          bgcolor: alpha("#08111f", 0.9),
          borderBottom: `1px solid ${alpha("#ffffff", 0.08)}`,
        }}
      >
        <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.2} alignItems="center">
            <IconButton
              onClick={() => navigate("/demo/budiness-dashboard")}
              sx={{
                width: 38,
                height: 38,
                bgcolor: alpha("#ffffff", 0.1),
                color: UI.onPrimary,
              }}
            >
              <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
              Scan QR
            </Typography>
          </Stack>
          <IconButton
            sx={{
              width: 38,
              height: 38,
              bgcolor: alpha("#ffffff", 0.1),
              color: UI.onPrimary,
            }}
          >
            <FlashOnRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ px: 2, py: 2.5, maxWidth: 640, mx: "auto" }}>
        <Stack spacing={2}>
          <Card
            sx={{
              borderRadius: 4,
              bgcolor: "#111c2f",
              color: UI.onPrimary,
              border: `1px solid ${alpha("#ffffff", 0.08)}`,
              overflow: "hidden",
            }}
          >
            <CardContent sx={{ p: 1.5 }}>
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1.25",
                  borderRadius: 3,
                  overflow: "hidden",
                  bgcolor: "#000000",
                }}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />

                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.28))",
                    pointerEvents: "none",
                  }}
                />

                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "68%",
                    aspectRatio: "1 / 1",
                    border: "2px solid rgba(255,255,255,0.95)",
                    borderRadius: 3,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.26)",
                    pointerEvents: "none",
                  }}
                />

                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "68%",
                    aspectRatio: "1 / 1",
                    display: "grid",
                    placeItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <QrCodeScannerRoundedIcon sx={{ fontSize: 42, color: alpha("#ffffff", 0.88) }} />
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card
            sx={{
              borderRadius: 3,
              bgcolor: UI.surface,
              color: UI.text,
              boxShadow: "0 16px 36px rgba(8,17,31,0.14)",
            }}
          >
            <CardContent sx={{ p: 1.8 }}>
              <Stack spacing={1}>
                <Typography sx={{ fontSize: 14, fontWeight: 800 }}>
                  Scanner Status
                </Typography>
                <Typography sx={{ fontSize: 12, color: UI.muted, lineHeight: 1.55 }}>
                  {status}
                </Typography>
                {scanResult ? (
                  <Box
                    sx={{
                      mt: 0.4,
                      p: 1.2,
                      borderRadius: 2,
                      bgcolor: alpha(UI.primary, 0.08),
                      border: `1px solid ${alpha(UI.primary, 0.16)}`,
                    }}
                  >
                    <Typography sx={{ fontSize: 11, color: UI.muted, mb: 0.45 }}>
                      Scanned Result
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: UI.text, wordBreak: "break-word" }}>
                      {scanResult}
                    </Typography>
                  </Box>
                ) : null}
                {!isSupported ? (
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/demo/budiness-dashboard")}
                    sx={{
                      alignSelf: "flex-start",
                      mt: 0.4,
                      borderRadius: 2,
                      textTransform: "none",
                      fontWeight: 700,
                      borderColor: alpha(UI.primary, 0.28),
                      color: UI.primary,
                    }}
                  >
                    Back to Dashboard
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}

export default ScannerPage;
