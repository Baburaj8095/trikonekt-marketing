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
} from "@mui/material";
import API, { agencyAssignPackage } from "../api/api";
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
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                          <Button
                            variant="contained"
                            onClick={() => addToCartInternal(pkg, false)}
                            disabled={buyingId === pkg.id}
                            fullWidth
                            sx={{
                              py: 1,
                              fontWeight: 800,
                              borderRadius: 2,
                              backgroundColor: "#2563eb",
                              "&:hover": { backgroundColor: "#1e40af" },
                            }}
                          >
                            {buyingId === pkg.id ? "ADDING..." : "Add to Cart"}
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => addToCartInternal(pkg, true)}
                            disabled={buyingId === pkg.id}
                            fullWidth
                            sx={{
                              py: 1,
                              fontWeight: 800,
                              borderRadius: 2,
                            }}
                          >
                            {buyingId === pkg.id ? "..." : "Checkout Now"}
                          </Button>
                        </Stack>
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
    </Box>
  );
}
