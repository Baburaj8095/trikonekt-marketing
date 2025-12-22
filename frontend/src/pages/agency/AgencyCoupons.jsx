import React, { useEffect, useState } from "react";
import { Box, Container, Paper, Tabs, Tab, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import AgencyLuckyCoupons from "../AgencyLuckyCoupons";
import ECouponStore from "../ECouponStore";
import Cart from "../Cart";

/**
 * AgencyCoupons
 * Unified coupons screen for Agency role with in-page tabs:
 *  - E‑Coupon (agency operations & summary)
 *  - E‑Coupon Store (browse/buy/assign)
 *  - Cart (centralized checkout cart)
 *
 * Deep link: ?tab=ecoupon|store|cart
 */
export default function AgencyCoupons() {
  const navigate = useNavigate();
  const location = useLocation();

  const TABS = { ECOUPON: "ecoupon", STORE: "store", CART: "cart" };
  const [tab, setTab] = useState(TABS.ECOUPON);

  // Initialize and sync from query
  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search || "");
      const t = (q.get("tab") || "").toLowerCase();
      if (t === TABS.STORE) setTab(TABS.STORE);
      else if (t === TABS.CART) setTab(TABS.CART);
      else setTab(TABS.ECOUPON);
    } catch {
      setTab(TABS.ECOUPON);
    }
  }, [location.search]);

  const onChange = (_e, v) => {
    setTab(v);
    const q = new URLSearchParams(location.search || "");
    q.set("tab", v);
    navigate({ pathname: "/agency/coupons", search: `?${q.toString()}` }, { replace: true });
  };

  return (
    <Container maxWidth="lg" sx={{ px: { xs: 0, md: 0 } }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Coupons
      </Typography>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={onChange}
          variant="scrollable"
          allowScrollButtonsMobile
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab value={TABS.ECOUPON} label="E‑Coupon Store" />
          {/* <Tab value={TABS.STORE} label="E‑Coupon Store" /> */}
          <Tab value={TABS.CART} label="Cart" />
        </Tabs>
      </Paper>

      {tab === TABS.ECOUPON && <ECouponStore />}
      {/* {tab === TABS.STORE && <ECouponStore />} */}
      {tab === TABS.CART && <Cart />}
    </Container>
  );
}
