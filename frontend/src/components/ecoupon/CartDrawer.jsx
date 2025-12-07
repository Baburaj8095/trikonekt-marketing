import React, { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Stack,
  Divider,
  Button,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import normalizeMediaUrl from "../../utils/media";
import {
  subscribe as cartSubscribe,
  getItems as cartGetItems,
  getCartTotal as cartGetTotal,
  updateQty as cartUpdateQty,
  removeItem as cartRemoveItem,
} from "../../store/cart";

/**
 * CartDrawer (Slide-over)
 * - Anchored on right
 * - Shows items, quantity stepper, subtotal and total
 * - Checkout button
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - onCheckout?: () => void   // optional handler; if not provided, no-op
 */
export default function CartDrawer({ open, onClose, onCheckout }) {
  const [cart, setCart] = useState({ items: [], total: 0 });

  useEffect(() => {
    const pushState = () => {
      try {
        setCart({ items: cartGetItems(), total: cartGetTotal() });
      } catch {
        setCart({ items: [], total: 0 });
      }
    };
    const unsub = cartSubscribe(() => pushState());
    pushState();
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, []);

  const items = cart.items || [];
  const total = Number(cart.total || 0);

  const ecouponItems = useMemo(
    () => items.filter((it) => String(it.type || "").toUpperCase() === "ECOUPON"),
    [items]
  );

  const handleInc = (key, currentQty) => {
    const q = Math.max(1, parseInt(currentQty || 1, 10)) + 1;
    try {
      cartUpdateQty(key, q);
    } catch {}
  };

  const handleDec = (key, currentQty) => {
    const q = Math.max(1, parseInt(currentQty || 1, 10)) - 1;
    try {
      cartUpdateQty(key, q);
    } catch {}
  };

  const handleRemove = (key) => {
    try {
      cartRemoveItem(key);
    } catch {}
  };

  return (
    <Drawer anchor="right" open={!!open} onClose={onClose} PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Badge badgeContent={items.length} color="primary">
              <ShoppingCartIcon />
            </Badge>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Cart
            </Typography>
          </Stack>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>
      <Divider />

      {items.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Your cart is empty. Add items from the store.
          </Typography>
        </Box>
      ) : (
        <>
          <List sx={{ px: 1 }}>
            {items.map((it) => {
              const unit = Number(it.unitPrice || 0);
              const qty = Math.max(1, parseInt(it.qty || 1, 10));
              const subtotal = unit * qty;
              const t = String(it.type || "").toUpperCase();
              const details =
                t === "ECOUPON"
                  ? it?.meta?.denomination != null
                    ? `Denomination: ₹${it.meta.denomination}`
                    : "E‑Coupon"
                  : t === "PROMO_PACKAGE"
                  ? `Promo Package • ${String(it?.meta?.kind || "")}`
                  : t;

              return (
                <ListItem
                  key={it.key}
                  alignItems="flex-start"
                  secondaryAction={
                    <IconButton edge="end" aria-label="delete" onClick={() => handleRemove(it.key)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  }
                >
                  <ListItemAvatar>
                    {t === "PRODUCT" && it?.meta?.image_url ? (
                      <Avatar
                        variant="rounded"
                        src={normalizeMediaUrl(it.meta.image_url)}
                        sx={{ width: 48, height: 48 }}
                      />
                    ) : (
                      <Avatar
                        variant="rounded"
                        sx={{
                          width: 48,
                          height: 48,
                          bgcolor: "grey.100",
                          color: "text.secondary",
                          fontWeight: 700,
                        }}
                      >
                        ₹
                      </Avatar>
                    )}
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ pr: 6 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {it.name}
                        </Typography>
                        <Chip size="small" label={t} variant="outlined" />
                      </Stack>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {details}
                        </Typography>
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ mt: 1 }}
                          spacing={1.5}
                        >
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => handleDec(it.key, qty)}
                              sx={{ border: "1px solid #e5e7eb" }}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <TextField
                              size="small"
                              type="number"
                              value={qty}
                              inputProps={{ min: 1, style: { textAlign: "center", width: 48 } }}
                              onChange={(e) => {
                                let q = parseInt(e.target.value, 10);
                                if (!Number.isFinite(q) || q < 1) q = 1;
                                cartUpdateQty(it.key, q);
                              }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => handleInc(it.key, qty)}
                              sx={{ border: "1px solid #e5e7eb" }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="baseline">
                            <Typography variant="caption" color="text.secondary">
                              Unit:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              ₹{unit.toLocaleString("en-IN")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              • Subtotal:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              ₹{Number(subtotal).toLocaleString("en-IN")}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>

          <Divider />

          <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Total
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                ₹{Number(total).toLocaleString("en-IN")}
              </Typography>
            </Stack>

            {/* Hint - payment is manual for ecoupons today */}
            {ecouponItems.length > 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                E‑Coupons checkout is manual. You can review the QR and submit at Checkout.
              </Typography>
            ) : null}

            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<ReceiptLongIcon />}
                onClick={() => {
                  if (typeof onCheckout === "function") onCheckout();
                }}
                disabled={items.length === 0}
                sx={{
                  fontWeight: 800,
                  background: "linear-gradient(90deg, #00C6FF, #0072FF)",
                  boxShadow: "0 8px 20px rgba(0,114,255,0.25)",
                  ":hover": {
                    background: "linear-gradient(90deg, #0bb6f0, #0062e6)",
                    boxShadow: "0 8px 24px rgba(0,114,255,0.35)",
                  },
                }}
              >
                Checkout
              </Button>
              <Button fullWidth variant="outlined" onClick={onClose}>
                Continue Shopping
              </Button>
            </Stack>
          </Box>
        </>
      )}
    </Drawer>
  );
}
