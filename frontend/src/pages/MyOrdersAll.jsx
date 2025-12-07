import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  Stack,
} from "@mui/material";
import { getMyEcouponOrders, listMyPromoPurchases } from "../api/api";
import normalizeMediaUrl from "../utils/media";
function dateToStr(d) {
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return "-";
    return dt.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function Section({ title, children, actions = null }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        mb: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#fff",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
          {title}
        </Typography>
        {actions}
      </Stack>
      {children}
    </Paper>
  );
}

function StatusChip({ status }) {
  const s = String(status || "").toUpperCase();
  const map = {
    PENDING: { color: "warning", label: "Pending" },
    APPROVED: { color: "success", label: "Approved" },
    REJECTED: { color: "error", label: "Rejected" },
    CREATED: { color: "info", label: "Created" },
    PAID: { color: "success", label: "Paid" },
  };
  const cfg = map[s] || { color: "default", label: s || "-" };
  return <Chip size="small" color={cfg.color} label={cfg.label} />;
}

export default function MyOrdersAll() {
  const [tab, setTab] = useState("ecoupons");

  // E‑Coupon orders
  const [ecOrders, setEcOrders] = useState([]);
  const [ecLoading, setEcLoading] = useState(false);

  // Promo purchases
  const [promo, setPromo] = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);

  async function loadEcOrders() {
    setEcLoading(true);
    try {
      const res = await getMyEcouponOrders({ page_size: 100 });
      const list = Array.isArray(res) ? res : res?.results || [];
      setEcOrders(list || []);
    } catch (e) {
      setEcOrders([]);
    } finally {
      setEcLoading(false);
    }
  }

  async function loadPromo() {
    setPromoLoading(true);
    try {
      const res = await listMyPromoPurchases({ page_size: 100 });
      const list = Array.isArray(res) ? res : res?.results || [];
      setPromo(list || []);
    } catch (e) {
      setPromo([]);
    } finally {
      setPromoLoading(false);
    }
  }

  useEffect(() => {
    loadEcOrders();
    loadPromo();
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0C2D48" }}>
          My Orders
        </Typography>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          textColor="primary"
          indicatorColor="primary"
          allowScrollButtonsMobile
          variant="scrollable"
        >
          <Tab label="E‑Coupons" value="ecoupons" />
          <Tab label="Promo Purchases" value="promo" />
          <Tab label="Marketplace" value="market" />
        </Tabs>
      </Stack>

      {tab === "ecoupons" ? (
        <Section
          title="E‑Coupon Orders"
          actions={
            <Button size="small" variant="outlined" onClick={loadEcOrders} disabled={ecLoading}>
              {ecLoading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        >
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Placed</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>UTR</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(ecOrders || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary">
                        No E‑Coupon orders yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (ecOrders || []).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        {dateToStr(o.created_at)}
                      </TableCell>
                      <TableCell>{o.product_name || o.product || "-"}</TableCell>
                      <TableCell>{o.quantity || "-"}</TableCell>
                      <TableCell>{o.utr || "-"}</TableCell>
                      <TableCell>
                        <StatusChip status={o.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
      ) : null}

      {tab === "promo" ? (
        <Section
          title="Promo Purchases"
          actions={
            <Button size="small" variant="outlined" onClick={loadPromo} disabled={promoLoading}>
              {promoLoading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        >
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Placed</TableCell>
                  <TableCell>Package</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(promo || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        No Promo purchases yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  (promo || []).map((p) => {
                    const pkg = p.package || {};
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          {dateToStr(p.created_at)}
                        </TableCell>
                        <TableCell>{pkg.name || `#${pkg.id || "-"}`}</TableCell>
                        <TableCell>{pkg.type || "-"}</TableCell>
                        <TableCell>{p.quantity || "-"}</TableCell>
                        <TableCell>
                          {pkg.price != null ? `₹${Number(pkg.price).toLocaleString("en-IN")}` : "-"}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={p.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
      ) : null}

      {tab === "market" ? (
        <Section
          title="Marketplace Orders"
          actions={
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                try {
                  const p = window.location.pathname;
                  // Route to the existing page dedicated for marketplace orders
                  window.location.href = "/marketplace/my-orders";
                } catch (_) {}
              }}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              Open Marketplace Orders
            </Button>
          }
        >
          <Typography variant="body2" color="text.secondary">
            Use the button above to view and track your marketplace product orders.
          </Typography>
        </Section>
      ) : null}
    </Box>
  );
}
