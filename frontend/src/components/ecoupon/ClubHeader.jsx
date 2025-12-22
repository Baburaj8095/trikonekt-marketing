import React from "react";
import { Box, Paper, Tabs, Tab, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * ClubHeader
 * Consistent header + tabbed navigation for "My E‑Coupon Club"
 * Tabs:
 *  - E‑Coupon (redeem / activate)
 *  - E‑Coupon Store
 *  - Manual Lucky Coupon
 *
 * Intended for consumer routes only (/user/...).
 */
export default function ClubHeader() {
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = String(location.pathname || "");

  let value = "coupon";
  if (pathname.startsWith("/user/e-coupon-store")) value = "store";
  else if (pathname.startsWith("/user/lucky-draw")) value = "lucky";
  else value = "coupon";

  const handleChange = (_e, v) => {
    if (v === "coupon") navigate("/user/redeem-coupon");
    else if (v === "store") navigate("/user/e-coupon-store");
    else if (v === "lucky") navigate("/user/lucky-draw");
  };

  return (
    <>
    </>
    // <Box sx={{ mb: 1.5 }}>
    //   <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a", mb: 0.5 }}>
    //     My E‑Coupon Club
    //   </Typography>
    //   <Paper
    //     elevation={0}
    //     sx={{
    //       border: "1px solid",
    //       borderColor: "divider",
    //       borderRadius: 2,
    //       bgcolor: "#fff",
    //     }}
    //   >
    //     <Tabs
    //       value={value}
    //       onChange={handleChange}
    //       variant="scrollable"
    //       allowScrollButtonsMobile
    //       textColor="primary"
    //       indicatorColor="primary"
    //     >
    //       {/* <Tab label="E‑Coupon" value="coupon" /> */}
    //       {/* <Tab label="E‑Coupon Store" value="store" />
    //       <Tab label="Manual Lucky Coupon" value="lucky" /> */}
    //     </Tabs>
    //   </Paper>
    // </Box>
  );
}
