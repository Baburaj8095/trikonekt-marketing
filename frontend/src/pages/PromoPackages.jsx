import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Alert,
  TextField,
  MenuItem,
  Drawer,
  IconButton,
  InputAdornment,
  Snackbar,
  Dialog,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  Chip,
  Divider,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import dayjs from "dayjs";
import normalizeMediaUrl from "../utils/media";
import imgKerala from "../assets/kerala.jpg";
import imgThailand from "../assets/thailand.jpg";
import {
  getPromoPackages,
  listMyPromoPurchases,
  getTriApp,
  createPromoPurchase,
  listCouponSeasons,
  getEcouponStoreBootstrap,
} from "../api/api";
import { useNavigate } from "react-router-dom";

/**
 * UI REFACTOR ONLY
 * - Preserve all backend APIs and payloads
 * - Reorganize UI into four sections (Tabs): Prime | Promo | Season | Tour
 * - Single shared payment sheet
 */

/* ---------------- HELPERS ---------------- */
const approx = (a, b, eps = 0.75) => Math.abs(Number(a) - Number(b)) < eps;

const isTourPackage = (pkg) => {
  const code = String(pkg?.code || "").toLowerCase();
  const name = String(pkg?.name || "").toLowerCase();
  return code.includes("tour") || name.includes("tour") || name.includes("holiday");
};

const getPlanOptions = (price) => {
  if (approx(price, 150)) return ["Redeem points", "E‑book access"];
  if (approx(price, 750)) return ["Redeem", "Exclusive products", "E‑Coupons"];
  if (approx(price, 759))
    return ["Electronics", "Home Appliances", "Furniture", "Travel & Tourism"];
  return [];
};

const monthShort = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];

/* ======================================================================== */
/* Payment Sheet (shared) — unchanged logic; UI summary added */
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
        lines.push(`Boxes: ${ui.selectedBoxes.sort((a,b)=>a-b).join(", ")}`);
      }
      if (ui.destination) lines.push(`Destination: ${ui.destination}`);
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
        <Box sx={{ p: 2, mt: 2, bgcolor: "grey.50", borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
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
              ₹{Number(data.amount || 0)}
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
          Amount is auto‑calculated and locked. Pay the exact amount.
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
          <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0])} />
        </Button>

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 3, height: 52 }}
          disabled={!txnId || submitting}
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

/* ======================================================================== */
/* Sections */
/* ======================================================================== */

/**
 * PrimeSection — membership-style UI
 * - Requires choice: Redeem | Product
 * - Bonus ₹150 info is UI-only (no backend flag; reflected in uiMeta for summary)
 */
function Prime750Section({ pkg, prime150Active, prime750Active, onBuy }) {
  const [choice, setChoice] = useState("");
  const [selProd, setSelProd] = useState("");

  const options = getPlanOptions(pkg?.price || 0);

  const canBuy =
    !!pkg &&
    !!choice &&
    (!(choice === "PRODUCT") || (choice === "PRODUCT" && String(selProd).trim() !== ""));

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Prime 750 {prime750Active ? <Chip size="small" color="success" sx={{ ml: 1 }} label="Active" /> : null}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Includes wallet bonus ₹150
      </Typography>
      <Box component="ul" sx={{ pl: 2, mt: 0 }}>
        {options.map((opt, i) => (
          <li key={i}>
            <Typography fontSize={13}>{opt}</Typography>
          </li>
        ))}
      </Box>
      <Divider sx={{ my: 1.5 }} />

      <FormControlLabel
        sx={{ mt: 0.5 }}
        control={<Checkbox size="small" checked disabled />}
        label={
          <Typography fontSize={14}>
            {prime150Active ? "Prime 150 active" : "Prime 150 will be included"}
          </Typography>
        }
      />

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        Choose how you want to use Prime
      </Typography>

      <Box sx={{ mt: 0.5 }}>
        <RadioGroup
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <FormControlLabel value="REDEEM" control={<Radio size="small" />} label="Redeem" />
          <FormControlLabel value="PRODUCT" control={<Radio size="small" />} label="Product" />
        </RadioGroup>

        {choice === "PRODUCT" ? (
          <TextField
            select
            fullWidth
            size="small"
            label="Select Product"
            sx={{ mt: 1 }}
            value={selProd}
            onChange={(e) => setSelProd(e.target.value)}
          >
            {(pkg?.promo_products || []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Box>

      <Button
        fullWidth
        variant="contained"
        sx={{ mt: 2, height: 48, textTransform: "none", fontWeight: 800 }}
        disabled={!canBuy}
        onClick={() =>
          onBuy({
            pkg,
            amount: 750,
            uiMeta: {
              bonus150: true,
              primeChoice: choice,
              selectedProductName:
                (pkg?.promo_products || []).find((p) => String(p.id) === String(selProd))?.name || "",
            },
            purchasePayload: {
              prime750_choice: choice,
              selected_promo_product_id: choice === "PRODUCT" && selProd ? selProd : null,
            },
          })
        }
      >
        BUY PRIME
      </Button>
    </Box>
  );
}

function Prime150Section({ reg150Pkg, prime150Active, onBuy }) {
  if (!reg150Pkg) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">Prime 150 package not available.</Alert>
      </Box>
    );
  }
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Prime 150
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        {prime150Active ? <Chip size="small" color="success" label="Active" /> : null}
        <Typography variant="body2" color="text.secondary">
          {prime150Active ? "You have already activated Prime 150." : "Activate Prime 150 to unlock starter benefits."}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography>
          Price: <b>₹150</b>
        </Typography>
        <Button
          variant="contained"
          disabled={!!prime150Active}
          onClick={() =>
            onBuy({
              pkg: reg150Pkg,
              amount: 150,
              uiMeta: { plan: "Prime 150" },
              purchasePayload: {},
            })
          }
        >
          {prime150Active ? "Already Active" : "BUY NOW"}
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * SeasonSection — Season-first flow
 * - Season selector (Season 1 active; others locked unless admin exposes)
 * - Plan selector under Season 1: Registration ₹150 | Season Prime ₹759
 * - Box grid (4x3) visible only for Season Prime
 */
function SeasonSection({ seasonPkg, reg150Pkg, prime150Active, history, onBuy, seasonsHints = [], seasonActive }) {
  const meta = seasonPkg?.monthly_meta || {};
  const totalBoxes = Math.max(1, Number(meta?.total_boxes || 12));
  const defaultSeason = Number(meta?.current_package_number || 1);

  // Choose which seasons to show. Show 1..5 in UI, enable those listed by admin seeds if present; otherwise only 1.
  const hintNumbers = useMemo(() => {
    try {
      if (!Array.isArray(seasonsHints) || seasonsHints.length === 0) return [];
      const nums = new Set();
      seasonsHints.forEach((s) => {
        const fields = [s?.campaign, s?.title, s?.code];
        fields.forEach((f) => {
          const m = String(f || "").match(/(\d+)/);
          if (m && m[1]) {
            const v = parseInt(m[1], 10);
            if (v > 0) nums.add(v);
          }
        });
      });
      return Array.from(nums).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }, [seasonsHints]);

  const enabledNumbers = useMemo(() => {
    if (Array.isArray(meta?.available_numbers) && meta.available_numbers.length) {
      return meta.available_numbers.map((n) => parseInt(n, 10)).filter((n) => n > 0);
    }
    if (hintNumbers.length) return hintNumbers;
    return [1];
  }, [meta?.available_numbers, hintNumbers]);

  const seasonsToShow = enabledNumbers;
  const [selectedSeason, setSelectedSeason] = useState(defaultSeason);
  useEffect(() => {
    // Ensure selected season is in the list. Default to first enabled (fallback to 1) if disabled.
    if (!enabledNumbers.includes(selectedSeason)) {
      setSelectedSeason(enabledNumbers[0] || 1);
    }
  }, [enabledNumbers, selectedSeason]);

  // Plans (only for Season 1 per sketch)
  const [plan, setPlan] = useState("SEASON759"); // "REG150" | "SEASON759"
  useEffect(() => {
    if (selectedSeason !== 1) setPlan("SEASON759");
  }, [selectedSeason]);

  // Locked boxes from history for current season
  const purchasedBoxes = useMemo(() => {
    try {
      // Prefer backend-computed monthly_meta for the current package number
      const currentNum = Number(meta?.current_package_number || 0);
      if (
        Number(selectedSeason) === currentNum &&
        Array.isArray(meta?.purchased_boxes) &&
        meta.purchased_boxes.length > 0
      ) {
        const fromMeta = meta.purchased_boxes
          .map((b) => parseInt(b, 10))
          .filter((bn) => Number.isFinite(bn) && bn > 0);
        return Array.from(new Set(fromMeta)).sort((a, b) => a - b);
      }

      // Fallback to purchase history
      const boxes = [];
      (history || []).forEach((p) => {
        const pid = p?.package?.id || p?.package_id;
        const ptype = String(p?.package?.type || "").toUpperCase();
        const pkgMatch = (pid === seasonPkg?.id) || (ptype === "MONTHLY");
        const stat = String(p?.status || "").toUpperCase();
        if (pkgMatch && stat !== "REJECTED" && stat !== "CANCELLED") {
          const pn = Number(p?.package_number || 0);
          if (pn === Number(selectedSeason)) {
            const bxRaw = Array.isArray(p?.boxes_json)
              ? p.boxes_json
              : Array.isArray(p?.boxes)
              ? p.boxes
              : [];
            bxRaw.forEach((b) => {
              const bn = parseInt(b, 10);
              if (bn > 0) boxes.push(bn);
            });
          }
        }
      });
      return Array.from(new Set(boxes)).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }, [history, seasonPkg?.id, selectedSeason, meta?.purchased_boxes, meta?.current_package_number]);

  const [selectedBoxes, setSelectedBoxes] = useState([]);
  useEffect(() => {
    setSelectedBoxes([]);
  }, [selectedSeason, plan]);

  const toggleBox = (n) => {
    if (purchasedBoxes.includes(n)) return;
    setSelectedBoxes((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const canBuy = !!seasonPkg && selectedBoxes.length > 0;

  const amount = 759 * Math.max(0, selectedBoxes.length);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Season {seasonActive ? <Chip size="small" color="success" sx={{ ml: 1 }} label="Active" /> : null}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Choose a season and plan to get started.
      </Typography>

      {/* ① Season selector */}
      <Typography variant="subtitle2" sx={{ mt: 1 }}>
        ① Choose Season 
      </Typography>
      <Box sx={{ display: "grid", gap: 1 }}>
        {seasonsToShow.map((n) => {
          const enabled = enabledNumbers.includes(n);
          const active = n === defaultSeason;
          const locked = !enabled;
          return (
            <Box
              key={n}
              onClick={() => enabled && setSelectedSeason(n)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: selectedSeason === n ? "primary.main" : "divider",
                bgcolor: selectedSeason === n ? "primary.50" : "background.paper",
                cursor: enabled ? "pointer" : "not-allowed",
                opacity: enabled ? 1 : 0.6,
              }}
            >
              <Radio size="small" checked={selectedSeason === n} disabled={!enabled} />
              <Typography sx={{ flex: 1 }}>Season {n}</Typography>
              {active ? (
                <Chip size="small" label="Available" color="success" />
              ) : locked ? (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <LockRoundedIcon fontSize="small" />
                  <Typography variant="caption" color="text.secondary">
                    locked
                  </Typography>
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* ② Plan selector (Season 1 only) */}
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        ② Choose Plan
      </Typography>
      {selectedSeason === 1 ? (
        <Box sx={{ mt: 1 }}>
          <FormControlLabel
            sx={{ mt: 0.5 }}
            control={<Checkbox size="small" checked disabled />}
            label={
              <Typography fontSize={14}>
                {prime150Active ? "Registration ₹150 active" : "Registration ₹150 will be included"}
              </Typography>
            }
          />
          <RadioGroup value={plan} onChange={(e) => setPlan(e.target.value)}>
            <FormControlLabel
              value="SEASON759"
              control={<Radio size="small" />}
              label="Season Prime ₹759"
            />
          </RadioGroup>
        </Box>
      ) : (
        <Alert sx={{ mt: 1 }} severity="info">
          Plans are available in Season 1. Complete Season 1 to unlock next seasons.
        </Alert>
      )}

      <Divider sx={{ my: 1.5 }} />

      {/* ③ Month grid (only for Season Prime) */}
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        ③ Select Months
      </Typography>
      {plan === "SEASON759" ? (
        <>
          <Box
            sx={{
              mt: 1,
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 1,
            }}
          >
            {Array.from({ length: totalBoxes }).map((_, i) => {
              const n = i + 1;
              const locked = purchasedBoxes.includes(n);
              const selected = selectedBoxes.includes(n);
              return (
                <Box
                  key={n}
                  onClick={() => !locked && toggleBox(n)}
                  sx={{
                    aspectRatio: "1 / 1",
                    borderRadius: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid",
                    borderColor: selected ? "primary.main" : "divider",
                    bgcolor: locked
                      ? "success.light"
                      : selected
                      ? "primary.main"
                      : "background.paper",
                    color: locked ? "success.main" : selected ? "#fff" : "text.primary",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: locked ? "not-allowed" : "pointer",
                    userSelect: "none",
                  }}
                >
                  {locked ? (
                    <Typography fontSize={12} fontWeight={800} color="success.main">
                      PAID
                    </Typography>
                  ) : (monthShort[i] || n)}
                </Box>
              );
            })}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Selected: <b>{selectedBoxes.length}</b> / {totalBoxes}
          </Typography>
        </>
      ) : null}

      <Button
        fullWidth
        variant="contained"
        sx={{ mt: 2, height: 48, textTransform: "none", fontWeight: 800 }}
        disabled={!canBuy}
        onClick={() => {
          onBuy({
            pkg: seasonPkg,
            amount,
            uiMeta: { plan: "Season Prime ₹759", selectedSeason, selectedBoxes },
            purchasePayload: { package_number: selectedSeason, boxes: selectedBoxes },
          });
        }}
      >
        BUY SEASON
      </Button>
    </Box>
  );
}

/**
 * PromoSection — Monthly promotions & offers (grid 3 x 4 on mobile)
 * - No season chooser, no membership info
 * - Uses current package_number from monthly_meta
 */
function PromoSection({ seasonPkg, history, onBuy, seasonActive }) {
  const meta = seasonPkg?.monthly_meta || {};
  const totalBoxes = Math.max(1, Number(meta?.total_boxes || 12));
  const packageNumber = Number(meta?.current_package_number || 1);

  const purchasedBoxes = useMemo(() => {
    try {
      // Prefer backend-computed monthly_meta for current package number
      if (
        Array.isArray(meta?.purchased_boxes) &&
        meta.purchased_boxes.length > 0
      ) {
        const fromMeta = meta.purchased_boxes
          .map((b) => parseInt(b, 10))
          .filter((bn) => Number.isFinite(bn) && bn > 0);
        return Array.from(new Set(fromMeta)).sort((a, b) => a - b);
      }

      // Fallback to purchase history
      const boxes = [];
      (history || []).forEach((p) => {
        const pid = p?.package?.id || p?.package_id;
        const ptype = String(p?.package?.type || "").toUpperCase();
        const pkgMatch = (pid === seasonPkg?.id) || (ptype === "MONTHLY");
        const stat = String(p?.status || "").toUpperCase();
        if (pkgMatch && stat !== "REJECTED" && stat !== "CANCELLED") {
          const pn = Number(p?.package_number || 0);
          if (pn === packageNumber) {
            const bxRaw = Array.isArray(p?.boxes_json)
              ? p.boxes_json
              : Array.isArray(p?.boxes)
              ? p.boxes
              : [];
            bxRaw.forEach((b) => {
              const bn = parseInt(b, 10);
              if (bn > 0) boxes.push(bn);
            });
          }
        }
      });
      return Array.from(new Set(boxes)).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }, [history, seasonPkg?.id, packageNumber, meta?.purchased_boxes]);

  const [selectedBoxes, setSelectedBoxes] = useState([]);
  const toggleBox = (n) => {
    if (purchasedBoxes.includes(n)) return;
    setSelectedBoxes((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const canBuy = !!seasonPkg && selectedBoxes.length > 0;
  const amount = 759 * Math.max(0, selectedBoxes.length);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Monthly Promo 759 {seasonActive ? <Chip size="small" color="success" sx={{ ml: 1 }} label="Active" /> : null}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Pick months to include in this promotion.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
        }}
      >
        {Array.from({ length: totalBoxes }).map((_, i) => {
          const n = i + 1;
          const locked = purchasedBoxes.includes(n);
          const selected = selectedBoxes.includes(n);
          return (
            <Box
              key={n}
              onClick={() => !locked && toggleBox(n)}
              sx={{
                aspectRatio: "1 / 1",
                borderRadius: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid",
                borderColor: selected ? "primary.main" : "divider",
                bgcolor: locked
                  ? "action.disabledBackground"
                  : selected
                  ? "primary.main"
                  : "background.paper",
                color: locked ? "text.disabled" : selected ? "#fff" : "text.primary",
                fontWeight: 700,
                fontSize: 14,
                cursor: locked ? "not-allowed" : "pointer",
                userSelect: "none",
              }}
            >
              {locked ? <LockRoundedIcon fontSize="small" /> : (monthShort[i] || n)}
            </Box>
          );
        })}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Selected: <b>{selectedBoxes.length}</b> / {totalBoxes}
      </Typography>

      <Button
        fullWidth
        variant="contained"
        sx={{ mt: 2, height: 48, textTransform: "none", fontWeight: 800 }}
        disabled={!canBuy}
        onClick={() =>
          onBuy({
            pkg: seasonPkg,
            amount,
            uiMeta: { selectedBoxes },
            purchasePayload: { package_number: packageNumber, boxes: selectedBoxes },
          })
        }
      >
        PROCEED TO PAY
      </Button>
    </Box>
  );
}

/**
 * TourSection — sketch-compliant
 * - Static destinations with placeholders
 * - EXPLORE & BOOK -> Tri module (no duplication of booking logic)
 */
function TourSection({ triHolidays }) {
  const navigate = useNavigate();
  const [dest, setDest] = useState("Goa");

  const destinations = [
    { key: "Goa", img: "https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=800&auto=format&fit=crop" },
    { key: "Kerala", img: imgKerala },
    { key: "Thailand", img: imgThailand },
    { key: "Malaysia", img: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=800&auto=format&fit=crop" },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Travel Experiences
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Pick a destination and explore unforgettable holidays.
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 1,
        }}
      >
        {destinations.map((d) => (
          <Box
            key={d.key}
            onClick={() => setDest(d.key)}
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              border: "2px solid",
              borderColor: dest === d.key ? "primary.main" : "divider",
              cursor: "pointer",
            }}
          >
            <Box
              component="img"
              src={d.img}
              alt={d.key}
              sx={{ width: "100%", height: 100, objectFit: "cover" }}
            />
            <Box sx={{ p: 1 }}>
              <Typography fontSize={13} sx={{ textAlign: "center" }}>
                {d.key}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Button
        fullWidth
        variant="contained"
        sx={{ mt: 2, height: 48, textTransform: "none", fontWeight: 800 }}
        onClick={() =>
          navigate("/user/tri/tri-holidays", {
            state: { source: "promo-packages", destination: dest },
          })
        }
      >
        EXPLORE & BOOK
      </Button>
    </Box>
  );
}

/* ======================================================================== */
/* MAIN */
/* ======================================================================== */
export default function PromoPackages() {
  const [packages, setPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [triHolidays, setTriHolidays] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [seasonsHints, setSeasonsHints] = useState([]);
  const [tab, setTab] = useState(0);
  const mappedTab = tab >= 1 ? tab + 1 : tab;
  const [paymentSuccessOpen, setPaymentSuccessOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setPackages(await getPromoPackages());
      setHistory(await listMyPromoPurchases());
      try {
        setTriHolidays(await getTriApp("tri-holidays"));
      } catch {}
      try {
        const s = await listCouponSeasons();
        setSeasonsHints(Array.isArray(s) ? s : []);
      } catch {}
    })();
  }, []);

  // Identify packages without changing contracts
  const primePkg = useMemo(() => {
    return (packages || []).find(
      (p) => approx(p?.price, 750) && String(p?.type || "").toUpperCase() !== "MONTHLY" && !isTourPackage(p)
    );
  }, [packages]);

  const seasonPkg = useMemo(() => {
    const pkgs = packages || [];
    // Prefer explicit MONTHLY type or presence of monthly_meta
    const monthlyCandidates = pkgs.filter(
      (p) => String(p?.type || "").toUpperCase() === "MONTHLY" || !!p?.monthly_meta
    );
    if (monthlyCandidates.length > 0) {
      // If any has monthly_meta (per-user computed), pick that first
      const withMeta = monthlyCandidates.find((p) => !!p?.monthly_meta);
      return withMeta || monthlyCandidates[0];
    }
    // Fallback (legacy heuristic): closest price ~759
    return pkgs.find((p) => approx(p?.price, 759)) || null;
  }, [packages]);

  const reg150Pkg = useMemo(() => {
    return (packages || []).find(
      (p) => approx(p?.price, 150) && String(p?.type || "").toUpperCase() !== "MONTHLY" && !isTourPackage(p)
    );
  }, [packages]);

  const prime150Active = useMemo(() => {
    try {
      const regId = reg150Pkg?.id;
      if (!regId) return false;
      return (history || []).some(
        (h) =>
          (h?.package?.id || h?.package_id) === regId &&
          String(h?.status || "").toUpperCase() === "APPROVED"
      );
    } catch {
      return false;
    }
  }, [history, reg150Pkg?.id]);

  const activePackageIds = useMemo(() => {
    try {
      const ids = new Set();
      (history || []).forEach((h) => {
        const status = String(h?.status || "").toUpperCase();
        if (status === "APPROVED") {
          const pid = h?.package?.id || h?.package_id;
          if (pid) ids.add(pid);
        }
      });
      return ids;
    } catch {
      return new Set();
    }
  }, [history]);

  const prime750Active = useMemo(() => {
    const id = primePkg?.id;
    return !!id && activePackageIds.has(id);
  }, [activePackageIds, primePkg?.id]);

  const seasonActive = useMemo(() => {
    const id = seasonPkg?.id;
    return !!id && activePackageIds.has(id);
  }, [activePackageIds, seasonPkg?.id]);

  const onBuy = (data) => {
    // Open shared payment sheet
    setPaymentData(data);
    setPaymentOpen(true);
  };

  const PurchaseHistory = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Purchase History
      </Typography>
      {history.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No purchases yet.
        </Typography>
      ) : (
        <Box>
          {history.map((h) => {
            const status = String(h?.status || "").toUpperCase();
            const badgeColor =
              status === "APPROVED" ? "success.main" : status === "PENDING" ? "warning.main" : "text.secondary";
            const badgeBorder =
              status === "APPROVED" ? "success.main" : status === "PENDING" ? "warning.main" : "divider";
            return (
              <Box
                key={h.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  alignItems: "center",
                  columnGap: 1.5,
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-of-type": { borderBottom: "none" },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap title={h?.package?.name || ""}>
                    {h?.package?.name || "-"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {h?.requested_at ? dayjs(h.requested_at).format("DD MMM YYYY") : ""}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, textAlign: "right", minWidth: 90 }}>
                  ₹{Number(h?.amount || h?.package?.price || 0).toLocaleString("en-IN")}
                </Typography>
                <Box sx={{ justifySelf: "end" }}>
                  <Box
                    sx={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      px: 1,
                      py: 0.25,
                      border: "1px solid",
                      borderRadius: 9999,
                      color: badgeColor,
                      borderColor: badgeBorder,
                      lineHeight: 1.6,
                    }}
                  >
                    {status}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );

  return (
    <Box p={2}>
      <Typography fontWeight={900} mb={1.5}>
        Consumer Packages
      </Typography>

      {/* {(prime150Active || prime750Active || seasonActive) ? (
        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
          {prime150Active && <Chip size="small" color="success" label="Prime 150 Active" />}
          {prime750Active && <Chip size="small" color="success" label="Prime 750 Active" />}
          {seasonActive && <Chip size="small" color="success" label="Monthly Promo Active" />}
        </Stack>
      ) : null} */}

      {/* Tabs: one section active at a time */}
      <Paper elevation={0} sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          sx={{ borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab label="Prime" />
          <Tab label="Season" />
          <Tab label="Tour" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* PRIME: Prime 150 + Prime 750 as two clean sections */}
          {mappedTab === 0 ? (
            <>
              <Prime150Section reg150Pkg={reg150Pkg} prime150Active={prime150Active} onBuy={onBuy} />
              <Divider sx={{ my: 1.5 }} />
              {primePkg ? (
                <Prime750Section pkg={primePkg} prime150Active={prime150Active} prime750Active={prime750Active} onBuy={onBuy} />
              ) : (
                <Alert severity="warning">Prime 750 package not available.</Alert>
              )}
            </>
          ) : null}

          {/* PROMO: Monthly Promo 759, 3x4 grid, selected count, Proceed to Pay */}
          {mappedTab === 1 ? (
            seasonPkg ? (
              <PromoSection seasonPkg={seasonPkg} history={history} onBuy={onBuy} seasonActive={seasonActive} />
            ) : (
              <Alert severity="warning">Monthly promo package not available.</Alert>
            )
          ) : null}

          {/* SEASON: Guided steps ① ② ③ */}
          {mappedTab === 2 ? (
            seasonPkg ? (
              <SeasonSection
                seasonPkg={seasonPkg}
                reg150Pkg={reg150Pkg}
                prime150Active={prime150Active}
                history={history}
                onBuy={onBuy}
                seasonsHints={seasonsHints}
                seasonActive={seasonActive}
              />
            ) : (
              <Alert severity="warning">Season package not available.</Alert>
            )
          ) : null}

          {/* TOUR: Destinations only, Explore & Book CTA */}
          {mappedTab === 3 ? <TourSection triHolidays={triHolidays} /> : null}
        </Box>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Compact history below sections */}
      <PurchaseHistory />

      {/* Shared Payment Sheet */}
      <PaymentSheet
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        data={paymentData}
        onSuccess={async () => {
          setHistory(await listMyPromoPurchases());
          setPaymentSuccessOpen(true);
        }}
      />
      <Dialog open={paymentSuccessOpen} onClose={() => setPaymentSuccessOpen(false)}>
        <Box sx={{ p: 3, textAlign: "center", minWidth: 280 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Payment Request Submitted
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We will review it shortly.
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => setPaymentSuccessOpen(false)}>
            OK
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}
