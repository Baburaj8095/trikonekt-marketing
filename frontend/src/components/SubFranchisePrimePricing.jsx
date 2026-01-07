import React from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Drawer,
  IconButton,
  InputAdornment,
  Snackbar,
  Divider,
  Dialog,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import API, { agencyAssignPackage, getEcouponStoreBootstrap } from "../api/api";
import normalizeMediaUrl from "../utils/media";
import { useNavigate } from "react-router-dom";
import { addAgencyPackage } from "../store/cart";

/**
 * Sub‑franchise Packages + Rewards UI
 *
 * Enhancements:
 * - Dynamically lists all active Sub‑franchise (AG_SF*) packages returned by:
 *     GET /business/agency-packages/catalog/
 *   Each card shows name, amount, description and a Buy/Requested button.
 * - Buy posts to:
 *     POST /business/agency-packages/assign/ { package_id }
 * - Refreshes the catalog and calls onPurchased() after a successful request.
 *
 * Backward compatible:
 * - Accepts `packages` prop (assigned list) from parent to detect legacy AG_SF assignment
 *   if the server catalog is unavailable.
 */
export default function SubFranchisePrimePricing({
  packages = [],
  onPurchased,
  showHeader = true,
}) {
  const navigate = useNavigate();
  // Dynamic catalog from server (allowed for current category)
  const [catalog, setCatalog] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [buyingId, setBuyingId] = React.useState(null);
  // Per‑package custom amount input (₹)
  const [customAmounts, setCustomAmounts] = React.useState({});

  // Payment drawer (UI only) — mirror consumer UX without changing backend flow
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedPkg, setSelectedPkg] = React.useState(null);
  const [txnId, setTxnId] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [payment, setPayment] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorOpen, setErrorOpen] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [zoomOpen, setZoomOpen] = React.useState(false);

  // Legacy detection: consider AG_SF already assigned if present in `packages` prop
  const legacyHasAgSf = React.useMemo(() => {
    try {
      return (packages || []).some(
        (p) => String(p?.package?.code || "").toUpperCase() === "AG_SF"
      );
    } catch {
      return false;
    }
  }, [packages]);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/business/agency-packages/catalog/", {
        cacheTTL: 5000,
        dedupe: "cancelPrevious",
      });
      const arr = Array.isArray(res?.data) ? res.data : [];
      setCatalog(arr);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load packages.";
      setError(String(msg));
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadCatalog();
  }, []);

  // Load UPI payment config when drawer opens (UI only; no API/contract change)
  React.useEffect(() => {
    let alive = true;
    if (drawerOpen) {
      (async () => {
        try {
          const boot = await getEcouponStoreBootstrap();
          if (alive) setPayment(boot?.payment_config || null);
        } catch {
          if (alive) setPayment(null);
        }
      })();
    }
    return () => {
      alive = false;
    };
  }, [drawerOpen]);

  const formatAmount = (amt) => {
    try {
      const n = Number(amt);
      if (!isFinite(n)) return `₹${String(amt)}`;
      return `₹${n.toLocaleString("en-IN")}`;
    } catch {
      return `₹${String(amt)}`;
    }
  };

  const addToCartInternal = async (pkg, goCheckout = false) => {
    if (!pkg || buyingId) return;
    try {
      setBuyingId(pkg.id);
      // Ensure assignment exists (idempotent)
      const assn = await agencyAssignPackage({ package_id: pkg.id });

      // Prefer remaining amount so one line clears dues; fallback to total or catalog amount
      let amountRaw =
        assn?.remaining_amount ?? assn?.total_amount ?? pkg?.amount ?? 0;
      let amount = Number(amountRaw);
      if (!isFinite(amount) || amount <= 0) {
        try {
          amount = parseFloat(String(amountRaw).replace(/[,₹\s]/g, ""));
        } catch (_) {}
      }
      if (!isFinite(amount) || amount <= 0) amount = 0;

      // If user typed a custom amount, prefer it (min ₹1). Server will clamp if needed.
      let desired = customAmounts?.[pkg.id];
      let desiredNum = Number(desired);
      if (!isFinite(desiredNum) || desiredNum <= 0) {
        try {
          desiredNum = parseFloat(String(desired).replace(/[,₹\s]/g, ""));
        } catch (_) {}
      }
      if (!isFinite(desiredNum) || desiredNum < 1) desiredNum = amount > 0 ? amount : 1;
      // Round to 2 decimals
      desiredNum = Math.round(Number(desiredNum) * 100) / 100;

      // Add to centralized cart as AGENCY_PACKAGE (assignment scoped)
      addAgencyPackage({
        pkgId: assn?.id ?? pkg.id,
        name: pkg?.name || pkg?.code || "Prime Package",
        unitPrice: desiredNum,
        qty: 1,
      });

      // Refresh UI (catalog + parent cards) and route
      try {
        await loadCatalog();
      } catch (_) {}
      if (typeof onPurchased === "function") {
        try {
          await onPurchased();
        } catch (_) {}
      }
      if (goCheckout) {
        navigate("/agency/checkout");
      } else {
        navigate("/agency/cart");
      }
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to add to cart.";
      window.alert(String(msg));
    } finally {
      setBuyingId(null);
    }
  };

  // Marketing reward milestones (kept as-is)
  const rewards = React.useMemo(
    () => [
      { amount: 6000, title: "Biomagnetic Bed" },
      { amount: 8000, title: "Water Purifier" },
      { amount: 9000, title: "Car Pressure Washer" },
      { amount: 10000, title: "Goa Trip" },
      { amount: 12000, title: "Pondicherry Trip" },
      { amount: 15000, title: 'TV (32")' },
    ],
    []
  );

  return (
    <Box sx={{ width: "100%" }}>
      {showHeader && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Agency Prime Package
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose your Sub‑franchise Prime package. Click BUY to send a request; admin will verify and complete payment.
          </Typography>
        </>
      )}

      {/* Dynamic catalog section */}
      <Box sx={{ mb: 3 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        {loading ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : (catalog || []).length > 0 ? (
          <Grid container spacing={2}>
            {(catalog || []).map((pkg) => {
              const disabled = !!pkg.assigned || buyingId === pkg.id;
              return (
                <Grid item xs={12} sm={6} md={4} key={pkg.id}>
                  <Card
                    elevation={0}
                    sx={{
                      height: "100%",
                      borderRadius: 4,
                      border: "1px solid #e5e7eb",
                      background: "linear-gradient(180deg,#ffffff 0%, #f8fafc 100%)",
                      boxShadow: "0 10px 24px rgba(2,6,23,0.06)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <CardContent sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: 1 }}>
                      <Typography variant="overline" sx={{ letterSpacing: 1.5 }} color="text.secondary">
                        SUB‑FRANCHISE PACKAGE
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>{pkg.name}</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                        {formatAmount(pkg.amount)}
                      </Typography>
                      {pkg.description ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {pkg.description}
                        </Typography>
                      ) : null}
                      <TextField
                        size="small"
                        type="number"
                        label="Amount to Pay (₹)"
                        value={customAmounts[pkg.id] ?? ""}
                        onChange={(e) =>
                          setCustomAmounts((s) => ({ ...s, [pkg.id]: e.target.value }))
                        }
                        inputProps={{ min: 1, step: "1" }}
                        fullWidth
                        sx={{ mt: 1 }}
                      />
                      <Box sx={{ mt: "auto" }}>
                        <Button
                          variant="contained"
                          onClick={() => {
                            setSelectedPkg(pkg);
                            setDrawerOpen(true);
                          }}
                          fullWidth
                          sx={{
                            py: 1,
                            fontWeight: 800,
                            borderRadius: 2,
                            backgroundColor: "#2563eb",
                            "&:hover": { backgroundColor: "#1e40af" },
                          }}
                        >
                          Buy Now
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Alert severity="info">No packages available for your category right now.</Alert>
        )}
      </Box>

      {/* Rewards milestones (visual only) */}
      {/* <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
        Rewards Milestones
      </Typography>
      <Grid container spacing={2}>
        {rewards.map((r, idx) => (
          <Grid item xs={12} sm={6} md={4} key={idx}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                borderRadius: 4,
                border: "1px solid #e5e7eb",
                background: "linear-gradient(180deg,#ffffff 0%, #f8fafc 100%)",
                boxShadow: "0 10px 24px rgba(2,6,23,0.06)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Box
                  aria-hidden
                  sx={{
                    height: 120,
                    borderRadius: 3,
                    background:
                      "radial-gradient(100px 60px at 20% 30%, #fde68a 0%, transparent 60%), radial-gradient(120px 80px at 80% 20%, #bae6fd 0%, transparent 60%), linear-gradient(180deg, #f1f5f9 0%, #ffffff 100%)",
                    mb: 1.5,
                  }}
                />
                <Typography variant="overline" sx={{ letterSpacing: 2 }} color="text.secondary">
                  SUB‑FRANCHISE
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 900, mt: 0.5 }}>
                  {r.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Milestone
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.1, mt: 0.5 }}>
                  ₹{r.amount.toLocaleString("en-IN")}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid> */}
      {/* Payment Drawer (UI/UX only) */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            height: "88vh",
            p: 2,
          },
        }}
      >
        {/* Handle bar */}
        <Box sx={{ width: 40, height: 4, bgcolor: "divider", mx: "auto", mb: 1 }} />

        <Typography fontWeight={900} fontSize={18} textAlign="center">
          Complete Payment
        </Typography>

        {/* Summary */}
        <Box
          sx={{
            p: 2,
            mt: 2,
            bgcolor: "grey.50",
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography fontWeight={700}>{selectedPkg?.name || "Package"}</Typography>

          <Stack direction="row" justifyContent="space-between" mt={1}>
            <Typography color="text.secondary">Total Amount</Typography>
            <Typography fontWeight={900} fontSize={20}>
              ₹
              {(() => {
                try {
                  const v = customAmounts?.[selectedPkg?.id];
                  const parsed = parseFloat(String(v ?? "").replace(/[,₹\s]/g, ""));
                  if (Number.isFinite(parsed) && parsed > 0) return parsed;
                  const n = Number(selectedPkg?.amount || 0);
                  return Number.isFinite(n) ? n : 0;
                } catch {
                  return 0;
                }
              })()}
            </Typography>
          </Stack>
        </Box>
        <Divider sx={{ my: 1.5 }} />

        {/* UPI Section */}
        <Box sx={{ p: 2, mt: 2 }}>
          <Typography fontWeight={700} mb={1}>
            UPI Payment
          </Typography>

          {payment?.upi_qr_image_url ? (
            <Box
              component="img"
              src={normalizeMediaUrl(payment.upi_qr_image_url)}
              alt="UPI QR"
              sx={{ width: 180, mx: "auto", display: "block", mb: 2, cursor: "pointer", borderRadius: 1 }}
              onClick={() => setZoomOpen(true)}
            />
          ) : null}

          <TextField
            label="UPI ID"
            value={payment?.upi_id || ""}
            fullWidth
            onClick={() => {
              const v = payment?.upi_id || "";
              if (v) navigator.clipboard.writeText(v);
              setCopied(true);
            }}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => {
                      const v = payment?.upi_id || "";
                      if (v) navigator.clipboard.writeText(v);
                      setCopied(true);
                    }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          Amount is auto‑calculated/entered above. Pay the exact amount and enter the UTR below.
        </Alert>

        <TextField
          label="Transaction / UTR ID"
          fullWidth
          required
          sx={{ mt: 2 }}
          value={txnId}
          onChange={(e) => setTxnId(e.target.value)}
        />

        <Button component="label" sx={{ mt: 2 }}>
          Upload Payment Screenshot
          <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Button>

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 3, height: 52 }}
          disabled={!txnId || submitting || !selectedPkg}
          onClick={async () => {
            // UI-only flow: create/ensure assignment and refresh; do not alter API contracts
            setSubmitting(true);
            setErrorMsg("");
            try {
              await agencyAssignPackage({ package_id: selectedPkg.id });
              try {
                await loadCatalog();
              } catch {}
              if (typeof onPurchased === "function") {
                try {
                  await onPurchased();
                } catch {}
              }
              setDrawerOpen(false);
              setTxnId("");
              setFile(null);
            } catch (e) {
              const msg =
                e?.response?.data?.detail ||
                (typeof e?.response?.data === "string" ? e.response.data : "") ||
                e?.message ||
                "Failed to submit request.";
              setErrorMsg(String(msg));
              setErrorOpen(true);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Submitting..." : "Submit Payment"}
        </Button>

        <Button fullWidth variant="text" sx={{ mt: 1 }} onClick={() => setDrawerOpen(false)}>
          Cancel
        </Button>
      </Drawer>

      {/* QR Zoom Dialog */}
      <Dialog open={zoomOpen} onClose={() => setZoomOpen(false)}>
        <Box sx={{ p: 2 }}>
          {payment?.upi_qr_image_url ? (
            <Box
              component="img"
              src={normalizeMediaUrl(payment.upi_qr_image_url)}
              alt="UPI QR Large"
              sx={{ width: { xs: 300, sm: 400 }, height: "auto" }}
            />
          ) : null}
        </Box>
      </Dialog>

      {/* Snackbars */}
      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message="UPI ID copied" />
      <Snackbar
        open={errorOpen}
        autoHideDuration={4000}
        onClose={() => setErrorOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setErrorOpen(false)} severity="error" sx={{ width: "100%" }}>
          {errorMsg || "Something went wrong. Please try again."}
        </Alert>
      </Snackbar>
    </Box>
  );
}
