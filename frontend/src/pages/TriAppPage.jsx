import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Stack,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { getTriApp, getEcouponStoreBootstrap, createPromoPurchase, createPromoPurchaseFromWallet, getWalletMe, getWalletMeHistory } from "../api/api";
import normalizeMediaUrl from "../utils/media";
import { addProduct as addCartProduct } from "../store/cart";
import {
  getAddMoneyPocketBalance,
  getPackagePurchaseCouponBalance,
  getSelfPackageWalletBalance,
} from "../utils/walletBalances";

function Price({ value, currency = "₹" }) {
  const n = Number(value || 0);
  if (!isFinite(n) || n < 0) return null;
  const sign = currency === "INR" ? "₹" : currency || "₹";
  return (
    <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0C2D48" }}>
      {sign}
      {n.toLocaleString("en-IN")}
    </Typography>
  );
}

/* ======================================================================== */
/* Payment Sheet (shared-style for Tri Holidays) */
/* ======================================================================== */
function PaymentSheet({ open, onClose, data, onSuccess }) {
  const [txnId, setTxnId] = useState("");
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [payment, setPayment] = useState(null); // admin seeded payment config
  const [zoomOpen, setZoomOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let alive = true;
    if (open) {
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
  }, [open]);

  if (!data) return null;
  const amount = Number(data.amount || 0);

  const summaryLines = (() => {
    try {
      const ui = data.uiMeta || {};
      const lines = [];
      if (ui.bonus150) lines.push("+ Bonus Wallet ₹150");
      if (ui.primeChoice) lines.push(`Prime Choice: ${ui.primeChoice}`);
      if (ui.selectedProductName) lines.push(`Product: ${ui.selectedProductName}`);
      if (ui.plan) lines.push(`Plan: ${ui.plan}`);
      if (ui.selectedSeason != null) lines.push(`Season: ${ui.selectedSeason}`);
      if (Array.isArray(ui.selectedBoxes) && ui.selectedBoxes.length) {
        lines.push(`Boxes: ${ui.selectedBoxes.sort((a, b) => a - b).join(", ")}`);
      }
      if (ui.destination) lines.push(`Destination: ${ui.destination}`);
      if (ui.triApp) lines.push(`App: ${ui.triApp}`);
      return lines;
    } catch {
      return [];
    }
  })();

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            height: "88vh",
            maxHeight: "calc(100dvh - 24px)",
            p: 2,
            pb: 3,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
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
          <Typography fontWeight={700}>{data.pkg?.name || "Package"}</Typography>
          {summaryLines.length > 0 ? (
            <Box sx={{ mt: 0.5 }}>
              {summaryLines.map((s, i) => (
                <Typography key={i} fontSize={12} color="text.secondary">
                  • {s}
                </Typography>
              ))}
            </Box>
          ) : null}
          <Stack direction="row" justifyContent="space-between" mt={1}>
            <Typography color="text.secondary">Total Amount</Typography>
            <Typography fontWeight={900} fontSize={20}>
              ₹{Number(amount || 0)}
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
              sx={{
                width: 180,
                mx: "auto",
                display: "block",
                mb: 2,
                cursor: "pointer",
                borderRadius: 1,
              }}
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
          Amount is auto‑calculated and locked. Pay the exact amount.
        </Alert>

        <TextField
          label="Transaction / UTR ID (Optional)"
          fullWidth
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
          disabled={!file || submitting}
          onClick={async () => {
            setSubmitting(true);
            setErrorMsg("");
            try {
              await createPromoPurchase({
                package_id: data.pkg.id,
                remarks: txnId,
                file,
                ...(data.purchasePayload || {}),
              });
              onClose();
              onSuccess();
              setTxnId("");
              setFile(null);
            } catch (e) {
              const msg =
                e?.response?.data?.detail ||
                e?.message ||
                "Failed to submit payment. Please try again.";
              setErrorMsg(msg);
              setErrorOpen(true);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? "Submitting..." : "Submit Payment"}
        </Button>

        <Button fullWidth variant="text" sx={{ mt: 1 }} onClick={onClose}>
          Cancel
        </Button>
      </Drawer>

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

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="UPI ID copied"
      />
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
    </>
  );
}

function PaymentMethodDialog({ open, onClose, intent, walletMe, walletHistory, busy, onPickManual, onPickWallet }) {
  if (!open || !intent) return null;
  const amount = Number(intent?.amount || 0);
  const internalBal = getSelfPackageWalletBalance(walletMe);
  const packageCouponBal = getPackagePurchaseCouponBalance(walletMe);
  const addMoneyBal = getAddMoneyPocketBalance(walletMe, walletHistory);
  const canWallet = internalBal >= amount && amount > 0;
  const canPackageCoupon = packageCouponBal >= amount && amount > 0;
  const canAddMoney = addMoneyBal >= amount && amount > 0;
  const money = (value) => Number(value || 0).toFixed(2);

  const WalletButtonLabel = ({ title, balance }) => (
    <Stack component="span" spacing={0.25} alignItems="center" sx={{ lineHeight: 1.15 }}>
      <span>{title}</span>
      <Typography component="span" sx={{ fontSize: 11, fontWeight: 800, color: "inherit", opacity: 0.86 }}>
        Available Rs. {money(balance)}
      </Typography>
    </Stack>
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>
      <DialogTitle sx={{ fontWeight: 900, color: "#0f172a", pb: 1 }}>Select Payment Method</DialogTitle>
      <DialogContent dividers sx={{ pt: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          Amount: <b>₹{money(amount)}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
          Self Package Wallet Balance: <b>₹{money(internalBal)}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
          Package Purchase Coupon Received (Buy Package) Balance: <b>₹{money(packageCouponBal)}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
          Add Money Pocket Balance: <b>₹{money(addMoneyBal)}</b>
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 1.5, gap: 1, flexWrap: "wrap" }}>
        <Button onClick={onClose} disabled={busy} sx={{ borderRadius: 3 }}>Cancel</Button>
        <Button variant="outlined" onClick={onPickManual} disabled={busy} sx={{ borderRadius: 3, fontWeight: 900 }}>
          Manual Payment
        </Button>
        <Button variant="contained" disabled={!canWallet || busy} onClick={() => onPickWallet("internal")} sx={{ borderRadius: 3, fontWeight: 900, minHeight: 48 }}>
          <WalletButtonLabel title="Pay from Self Package" balance={internalBal} />
        </Button>
        <Button variant="contained" disabled={!canPackageCoupon || busy} onClick={() => onPickWallet("package_coupon")} sx={{ borderRadius: 3, fontWeight: 900, minHeight: 48 }}>
          <WalletButtonLabel title="Pay from Package Purchase Coupon Received" balance={packageCouponBal} />
        </Button>
        <Button variant="contained" disabled={!canAddMoney || busy} onClick={() => onPickWallet("package_upload")} sx={{ borderRadius: 3, fontWeight: 900, minHeight: 48 }}>
          <WalletButtonLabel title="Pay from Add Money Pocket" balance={addMoneyBal} />
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ======================================================================== */
/* MAIN PAGE */
/* ======================================================================== */
export default function TriAppPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState(null);
  const [error, setError] = useState("");

  // Payment drawer state (Tri Holidays)
  const [methodOpen, setMethodOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [walletMe, setWalletMe] = useState(null);
  const [walletHistory, setWalletHistory] = useState(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletErr, setWalletErr] = useState("");
  const [paymentSuccessOpen, setPaymentSuccessOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getTriApp(slug);
        if (alive) setApp(data || null);
      } catch {
        if (alive) setError("Unable to load products.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, [slug]);

  const products = Array.isArray(app?.products) ? app.products : [];

  const bannerUrl = useMemo(() => {
    return app?.banner_url ? normalizeMediaUrl(app.banner_url) : "";
  }, [app]);

  return (
    <Box sx={{ px: 1, py: 2, width: "100%" }}>
      {/* ===== HEADER ===== */}
      <Box
        sx={{
          mb: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>
            {app?.name || "TRI"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            {products.length} products
          </Typography>
        </Box>

        <Button
          size="small"
          variant="contained"
          onClick={() => navigate("/user/cart")}
          sx={{
            textTransform: "none",
            fontSize: 12,
            fontWeight: 700,
            px: 1.5,
          }}
        >
          Cart
        </Button>
      </Box>

      {/* ===== LOADING / ERROR ===== */}
      {loading && (
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Loading”¦</Typography>
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {/* ===== BANNER ===== */}
      {bannerUrl && (
        <Box
          component="img"
          src={bannerUrl}
          alt={app?.name}
          sx={{
            width: "100%",
            height: 110,
            objectFit: "cover",
            borderRadius: 2,
            mb: 2,
          }}
        />
      )}

      {/* ===== PRODUCT GRID (PURE CSS GRID) ===== */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1,
          width: "100%",
        }}
      >
        {products.map((p) => {
          const img = p?.image_url ? normalizeMediaUrl(p.image_url) : "";

          return (
            <Paper
              key={p.id}
              elevation={0}
              onClick={() => {
                if (String(slug) !== "tri-holidays") navigate(`/trikonekt-products/products/${p.id}`);
              }}
              sx={{
                height: 240,
                display: "flex",
                flexDirection: "column",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "#fff",
                cursor: "pointer",
                overflow: "hidden",
              }}
            >
              {/* Image */}
              <Box
                sx={{
                  height: 110,
                  bgcolor: "#f8fafc",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {img && (
                  <Box
                    component="img"
                    src={img}
                    alt={p.name}
                    sx={{
                      maxWidth: "90%",
                      maxHeight: "90%",
                      objectFit: "contain",
                    }}
                  />
                )}
              </Box>

              {/* Content */}
              <Box
                sx={{
                  p: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  flexGrow: 1,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {p.name}
                </Typography>

                  <Price value={p.price} currency={p.currency} />

                {p.description ? (
                  <Typography variant="caption" color="text.secondary">
                    {p.description}
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Earn up to {p?.max_reward_points_percent || 0}% rewards
                  </Typography>
                )}

                {/* Conditional action: Tri Holidays = Buy Now (payment drawer); else Add to Cart */}
                {String(slug) === "tri-holidays" ? (
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    onClick={async (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      try {
                        const intent = {
                          pkg: { id: null, name: p.name },
                          amount: Number(p.price || 0),
                          uiMeta: { triApp: slug || "tri-holidays", selectedProductName: p.name },
                          purchasePayload: {
                            tri_app_slug: slug || "",
                            product_id: p.id,
                            tri: true,
                            prime750_choice: "REDEEM",
                          },
                        };
                        setPaymentData(intent);
                        try {
                          const [wallet, history] = await Promise.all([
                            getWalletMe(),
                            getWalletMeHistory().catch(() => null),
                          ]);
                          setWalletMe(wallet || null);
                          setWalletHistory(history || null);
                        } catch {
                          setWalletMe(null);
                          setWalletHistory(null);
                        }
                        setMethodOpen(true);
                      } catch {}
                    }}
                    sx={{ mt: 0.5, textTransform: "none", fontWeight: 800 }}
                  >
                    Buy Now
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      try {
                        addCartProduct({
                          productId: p.id,
                          name: p.name,
                          unitPrice: Number(p.price || 0),
                          qty: 1,
                          shipping_address: "",
                          image_url: p?.image_url || "",
                          tri: true,
                          max_reward_pct: Number(p?.max_reward_points_percent || 0),
                          tri_app_slug: slug || "",
                        });
                      } catch {}
                    }}
                    sx={{ mt: 0.5, textTransform: "none", fontWeight: 800 }}
                  >
                    Add to Cart
                  </Button>
                )}

                <Box sx={{ flexGrow: 1 }} />
              </Box>
            </Paper>
          );
        })}
      </Box>

      {!loading && products.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          No products available.
        </Alert>
      )}

      <PaymentMethodDialog
        open={methodOpen}
        onClose={() => !walletBusy && setMethodOpen(false)}
        intent={paymentData}
        walletMe={walletMe}
        walletHistory={walletHistory}
        busy={walletBusy}
        onPickManual={() => {
          setMethodOpen(false);
          setPaymentOpen(true);
        }}
        onPickWallet={async (walletSource = "internal") => {
          setWalletBusy(true);
          setWalletErr("");
          try {
            const payload = {
              wallet_source: walletSource,
              ...(paymentData.purchasePayload || {}),
            };
            if (paymentData?.pkg?.id) payload.package_id = paymentData.pkg.id;
            await createPromoPurchaseFromWallet({
              ...payload,
            });
            setMethodOpen(false);
            setPaymentSuccessOpen(true);
          } catch (e) {
            setWalletErr(e?.response?.data?.detail || e?.message || "Wallet payment failed");
          } finally {
            setWalletBusy(false);
          }
        }}
      />

      {/* Manual Payment Drawer for Tri Holidays */}
      <PaymentSheet
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        data={paymentData}
        onSuccess={() => {
          setPaymentSuccessOpen(true);
        }}
      />

      {/* Payment success dialog */}
      <Dialog open={paymentSuccessOpen} onClose={() => setPaymentSuccessOpen(false)}>
        <Box sx={{ p: 3, textAlign: "center", minWidth: 280 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Payment is successful
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We will review it shortly.
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => setPaymentSuccessOpen(false)}>
            OK
          </Button>
        </Box>
      </Dialog>
      {walletErr ? (
        <Snackbar
          open={!!walletErr}
          autoHideDuration={4000}
          onClose={() => setWalletErr("")}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert onClose={() => setWalletErr("")} severity="error" sx={{ width: "100%" }}>
            {walletErr}
          </Alert>
        </Snackbar>
      ) : null}
    </Box>
  );
}


