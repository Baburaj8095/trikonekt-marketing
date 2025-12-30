import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Grid,
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
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy"; // ⭐
import dayjs from "dayjs";
import normalizeMediaUrl from "../utils/media";
import {
  getPromoPackages,
  listMyPromoPurchases,
  getTriApp,
  createPromoPurchase,
  getActivationStatus,
  listCouponSeasons,
  getEcouponStoreBootstrap,
} from "../api/api";
import { useNavigate } from "react-router-dom";

/* ---------------- CONFIG ---------------- */
// Payment config will be loaded dynamically from admin (UPI ID + QR)

/* ---------------- HELPERS ---------------- */
const approx = (a, b, eps = 0.5) => Math.abs(Number(a) - Number(b)) < eps;

const isSeasonPackage = (pkg) => {
  const type = String(pkg?.type || "").toUpperCase();
  // Treat admin-defined MONTHLY packages as season packages.
  if (type === "MONTHLY") return true;
  // If backend sends monthly_meta, consider it season package.
  if (pkg && pkg.monthly_meta) return true;
  // Fallback: legacy detection by price≈759
  return approx(pkg?.price, 759);
};

const isTourPackage = (pkg) => {
  const code = String(pkg?.code || "").toLowerCase();
  const name = String(pkg?.name || "").toLowerCase();
  return code.includes("tour") || name.includes("tour") || name.includes("holiday");
};

const getPlanOptions = (price) => {
  if (approx(price, 150)) return ["E-Book access", "Redeem option"];
  if (approx(price, 750)) return ["Exclusive products", "Redeem", "E-Coupons"];
  if (approx(price, 759))
    return ["Electronics", "Home Appliances", "Furniture", "Travel & Tourism"];
  return [];
};

/* ---------------- TRI HOLIDAYS CARD ---------------- */
function TriAppCard({ app }) {
  const navigate = useNavigate();
  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Typography fontWeight={800}>{app?.name || "TRI Holidays"}</Typography>
      <Typography fontSize={13} color="text.secondary">
        Explore holiday packages and pay inside.
      </Typography>
      <Button
        fullWidth
        variant="contained"
        sx={{ mt: 2, height: 52 }}
        onClick={() =>
          navigate(`/user/tri/${app?.slug || "tri-holidays"}`, {
            state: { source: "promo-packages" },
          })
        }
      >
        Buy Now
      </Button>
    </Paper>
  );
}

/* ---------------- PACKAGE CARD ---------------- */
function PackageCard({ pkg, onProceed, prime150Active, prime150Pending, seasons = [], history = [] }) {
  const seasonLike = isSeasonPackage(pkg);
  const tourLike = isTourPackage(pkg);
  const options = getPlanOptions(pkg.price);
  const navigate = useNavigate();

  const isPrime150 = approx(pkg?.price, 150) && !seasonLike && !tourLike;

  const meta = pkg?.monthly_meta || {};
  const defaultSeason = Number(meta.current_package_number || 1);
  const totalBoxes = Number(meta.total_boxes || 12);
  const [selectedSeason, setSelectedSeason] = useState(defaultSeason);

  // Parse season number from coupon master label/code/title/campaign like "Season 1"
  const parseSeasonNumber = (s) => {
    try {
      const m = String(s || "").match(/(\d+)/);
      return m ? parseInt(m[1], 10) : null;
    } catch {
      return null;
    }
  };

  // Build available season numbers: prefer admin-seeded monthly_meta.available_numbers; else derive from coupons master
  const availableSeasonNumbers = useMemo(() => {
    if (Array.isArray(meta.available_numbers) && meta.available_numbers.length) {
      return meta.available_numbers.map((n) => parseInt(n, 10)).filter((n) => n > 0);
    }
    const nums = new Set();
    (seasons || []).forEach((c) => {
      const cand = parseSeasonNumber(c?.code || c?.title || c?.campaign);
      if (cand) nums.add(cand);
    });
    const arr = Array.from(nums);
    arr.sort((a, b) => a - b);
    return arr.length ? arr : [defaultSeason];
  }, [meta.available_numbers, seasons, defaultSeason]);

  // Purchased boxes for selected season from my history (exclude REJECTED/CANCELLED)
  const purchasedBoxes = useMemo(() => {
    try {
      const boxes = [];
      (history || []).forEach((p) => {
        const pid = p?.package?.id || p?.package_id;
        const stat = String(p?.status || "").toUpperCase();
        if (pid === pkg.id && stat !== "REJECTED" && stat !== "CANCELLED") {
          const pn = Number(p?.package_number || 0);
          if (pn === Number(selectedSeason)) {
            const bx = Array.isArray(p?.boxes_json) ? p.boxes_json : [];
            bx.forEach((b) => {
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
  }, [history, pkg?.id, selectedSeason]);

  const [selectedBoxes, setSelectedBoxes] = useState([]);
  const [prime750Choice, setPrime750Choice] = useState("");
  const [selectedPromoProductId, setSelectedPromoProductId] = useState(null);

  useEffect(() => {
    // Reset box selections when switching season
    setSelectedBoxes([]);
  }, [selectedSeason]);

  const toggleBox = (num) => {
    if (purchasedBoxes.includes(num)) return;
    setSelectedBoxes((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Typography fontWeight={800}>{pkg.name}</Typography>
      <Typography fontSize={22} fontWeight={900}>
        ₹{pkg.price}
      </Typography>

      <Box component="ul" sx={{ pl: 2, mt: 1 }}>
        {options.map((opt, i) => (
          <li key={i}>
            <Typography fontSize={13}>{opt}</Typography>
          </li>
        ))}
      </Box>

      {/* PRIME 750 CHOICE */}
      {approx(pkg?.price, 750) && !seasonLike && !tourLike && (
        <Box mt={2}>
          <Typography fontWeight={700} fontSize={13}>
            Choose one
          </Typography>
          <Stack direction="row" spacing={1} mt={1}>
            <Button
              variant={prime750Choice === "REDEEM" ? "contained" : "outlined"}
              onClick={() => setPrime750Choice("REDEEM")}
            >
              Redeem
            </Button>
            <Button
              variant={prime750Choice === "PRODUCT" ? "contained" : "outlined"}
              onClick={() => setPrime750Choice("PRODUCT")}
            >
              Product
            </Button>
          </Stack>

          {prime750Choice === "PRODUCT" && (
            <TextField
              select
              fullWidth
              label="Select Product"
              sx={{ mt: 2 }}
              value={selectedPromoProductId || ""}
              onChange={(e) => setSelectedPromoProductId(e.target.value)}
            >
              {(pkg?.promo_products || []).map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Box>
      )}

      {/* SEASON BOXES */}
      {seasonLike && (
        <Box sx={{ mt: 1 }}>
          <TextField
            select
            size="small"
            fullWidth
            label="Season"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(parseInt(e.target.value, 10))}
            sx={{ mb: 1.5 }}
          >
            {availableSeasonNumbers.map((n) => (
              <MenuItem key={n} value={n}>
                Season {n}
              </MenuItem>
            ))}
          </TextField>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 1.5,
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
                    borderRadius: 2,
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
                    color: locked
                      ? "text.disabled"
                      : selected
                      ? "#fff"
                      : "text.primary",
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: locked ? "not-allowed" : "pointer",
                    userSelect: "none",
                  }}
                >
                  {locked ? <LockRoundedIcon fontSize="small" /> : n}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      <Button
        fullWidth
        variant="contained"
        sx={{ mt: 3, height: 52 }}
        disabled={
          (approx(pkg?.price, 750) &&
            !seasonLike &&
            !tourLike &&
            (!prime750Choice ||
              (prime750Choice === "PRODUCT" && !selectedPromoProductId))) ||
          (isPrime150 && (prime150Active || prime150Pending))
        }
        onClick={() => {
          if (tourLike) {
            navigate("/user/tri/tri-holidays", {
              state: { packageId: pkg.id },
            });
          } else {
            onProceed({
              pkg,
              amount: pkg.price,
              purchasePayload: {
                package_number: selectedSeason,
                boxes: selectedBoxes,
                prime750_choice: prime750Choice,
                selected_promo_product_id: selectedPromoProductId,
              },
            });
          }
        }}
      >
        {tourLike
          ? "Buy Now"
          : isPrime150
          ? prime150Active
            ? "Activated"
            : "Proceed to Pay"
          : "Proceed to Pay"}
      </Button>
    </Paper>
  );
}

/* ---------------- PAYMENT SHEET ---------------- */
function PaymentSheet({ open, onClose, data, onSuccess }) {
  const [txnId, setTxnId] = useState("");
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false); // ⭐
  const [payment, setPayment] = useState(null); // admin seeded payment config
  const [zoomOpen, setZoomOpen] = useState(false);

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
            height: "90vh",
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
        <Paper sx={{ p: 2, mt: 2, borderRadius: 2, bgcolor: "grey.50" }}>
          <Typography fontWeight={700}>{data.pkg.name}</Typography>
          <Stack direction="row" justifyContent="space-between" mt={1}>
            <Typography color="text.secondary">Total Amount</Typography>
            <Typography fontWeight={900} fontSize={20}>
              ₹{data.amount}
            </Typography>
          </Stack>
        </Paper>

        {/* UPI Section */}
        <Paper sx={{ p: 2, mt: 2, borderRadius: 2 }}>
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
        </Paper>

        <Alert severity="info" sx={{ mt: 2 }}>
          Amount is auto-calculated and locked. Please pay the exact amount.
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
          disabled={!txnId}
          onClick={async () => {
            await createPromoPurchase({
              package_id: data.pkg.id,
              remarks: txnId,
              file,
              ...(data.purchasePayload || {}),
            });
            onClose();
            onSuccess();
          }}
        >
          Submit Payment
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
    </>
  );
}

/* ---------------- MAIN ---------------- */
export default function PromoPackages() {
  const [packages, setPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [triHolidays, setTriHolidays] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setPackages(await getPromoPackages());
      setHistory(await listMyPromoPurchases());
      try {
        setTriHolidays(await getTriApp("tri-holidays"));
      } catch {}
      try {
        const s = await listCouponSeasons();
        setSeasons(Array.isArray(s) ? s : []);
      } catch {}
    })();
  }, []);

  return (
    <Box p={2}>
      <Typography fontWeight={900} mb={2}>
        Consumer Packages
      </Typography>

      <Stack spacing={2}>
        {triHolidays && <TriAppCard app={triHolidays} />}
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            seasons={seasons}
            history={history}
            onProceed={(data) => {
              setPaymentData(data);
              setPaymentOpen(true);
            }}
          />
        ))}
      </Stack>

      <PaymentSheet
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        data={paymentData}
        onSuccess={async () => {
          setHistory(await listMyPromoPurchases());
        }}
      />
    </Box>
  );
}
