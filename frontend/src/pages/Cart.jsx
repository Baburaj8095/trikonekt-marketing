import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Alert,
  Divider,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import normalizeMediaUrl from "../utils/media";
import {
  subscribe as subscribeCart,
  getItems as getCartItems,
  getCartTotal as getCartTotalPrice,
  updateQty as cartUpdateQty,
  removeItem as cartRemoveItem,
} from "../store/cart";

export default function Cart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], total: 0 });

  useEffect(() => {
    const pushState = () => {
      try {
        const items = getCartItems();
        const total = getCartTotalPrice();
        setCart({ items, total });
      } catch {
        setCart({ items: [], total: 0 });
      }
    };
    const unsub = subscribeCart(() => pushState());
    pushState();
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, []);

  const items = cart.items || [];
  const total = Number(cart.total || 0);

  const inc = (it) => {
    const qty = Math.max(1, parseInt(it.qty || 1, 10));
    try {
      cartUpdateQty(it.key, qty + 1);
    } catch {}
  };
  const dec = (it) => {
    const qty = Math.max(1, parseInt(it.qty || 1, 10));
    try {
      cartUpdateQty(it.key, Math.max(1, qty - 1));
    } catch {}
  };

  const goCheckout = () => {
    try {
      const p = window.location.pathname;
      if (p.startsWith("/agency")) navigate("/agency/checkout");
      else if (p.startsWith("/employee")) navigate("/employee/checkout");
      else navigate("/user/checkout");
    } catch {}
  };

  return (
    <Box sx={{ p: 2, pb: { xs: 12, sm: 12 } }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Shopping Cart
      </Typography>

      {items.length === 0 ? (
        <Alert severity="info">Your cart is empty. Add items from store pages.</Alert>
      ) : (
        <Stack spacing={1.5}>
          {items.map((it) => {
            const unit = Number(it.unitPrice || 0);
            const qty = Math.max(1, parseInt(it.qty || 1, 10));
            const subtotal = unit * qty;
            const img =
              (it?.meta?.image_url && normalizeMediaUrl(it.meta.image_url)) || null;

            return (
              <Paper
                key={it.key}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "#fff",
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 1.5,
                      overflow: "hidden",
                      bgcolor: img ? "#f8fafc" : "#f1f5f9",
                      flexShrink: 0,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {img ? (
                      <Box
                        component="img"
                        alt={it.name}
                        src={img}
                        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Stack
                        sx={{ width: "100%", height: "100%" }}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Typography variant="caption" color="text.secondary">
                          {String(it.type || "").toUpperCase().slice(0, 1) || "P"}
                        </Typography>
                      </Stack>
                    )}
                  </Box>

                  <Stack sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, lineHeight: 1.2 }}
                      noWrap
                    >
                      {it.name}
                    </Typography>

                    <Typography variant="body2" sx={{ color: "text.primary" }}>
                      ₹{unit.toLocaleString("en-IN")}
                    </Typography>

                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ mt: 0.25 }}
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => dec(it)}
                        sx={{
                          minWidth: 36,
                          p: "2px 6px",
                          lineHeight: 1,
                          fontWeight: 700,
                        }}
                        aria-label="decrease quantity"
                      >
                        −
                      </Button>
                      <Typography
                        variant="body2"
                        sx={{ minWidth: 28, textAlign: "center" }}
                      >
                        {qty}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => inc(it)}
                        sx={{
                          minWidth: 36,
                          p: "2px 6px",
                          lineHeight: 1,
                          fontWeight: 700,
                        }}
                        aria-label="increase quantity"
                      >
                        +
                      </Button>

                      <Box sx={{ flex: 1 }} />

                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        ₹{Number(subtotal).toLocaleString("en-IN")}
                      </Typography>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          try {
                            cartRemoveItem(it.key);
                          } catch {}
                        }}
                        sx={{ textTransform: "none", p: 0, minWidth: 0, fontWeight: 600 }}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Paper
        elevation={3}
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          p: 2,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "#fff",
          zIndex: 1000,
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              Items
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {items.length}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Subtotal
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              ₹{Number(total || 0).toLocaleString("en-IN")}
            </Typography>
          </Stack>
          <Divider />
          <Button
            variant="contained"
            size="large"
            onClick={goCheckout}
            disabled={items.length === 0}
            sx={{ textTransform: "none", fontWeight: 800 }}
            fullWidth
          >
            Proceed to Checkout
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
