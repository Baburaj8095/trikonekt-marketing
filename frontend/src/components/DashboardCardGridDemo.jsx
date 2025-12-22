import React from "react";
import { Grid, Box } from "@mui/material";
import DashboardCard from "./DashboardCard";

// Assets
import imgEcommerce from "../assets/ecommerce.jpg";
import imgSpinWin from "../assets/lucky-draw-img.png";
import imgGiftCards from "../assets/gifts.jpg";
import imgHolidays from "../assets/holidays.jpg";
import imgEV from "../assets/ev-img.jpg";
import bannerWG from "../assets/Wealth_Galaxy.jpg";

export default function DashboardCardGridDemo() {
  return (
    <Box
      sx={{
        width: "100%",
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Grid container spacing={2}>
        <Grid item xs={6} sm={4} md={3}>
          <DashboardCard
            title="E‑commerce"
            subtitle="Exclusive partner deals"
            image={imgEcommerce}
            to="/trikonekt-products"
            badgeText="Prime"
            badgeVariant="prime"
          />
        </Grid>

        <Grid item xs={6} sm={4} md={3}>
          <DashboardCard
            title="Spin & Win"
            subtitle="Try your luck daily"
            image={imgSpinWin}
            to="/user/lucky-draw"
            badgeText="Rewards"
            badgeVariant="rewards"
          />
        </Grid>

        <Grid item xs={6} sm={4} md={3}>
          <DashboardCard
            title="Gift Cards"
            subtitle="Instant digital gifting"
            image={imgGiftCards}
            to="/user/tri/gift-cards"
          />
        </Grid>

        <Grid item xs={6} sm={4} md={3}>
          <DashboardCard
            title="Holidays"
            subtitle="Curated premium stays"
            image={imgHolidays}
            to="/user/tri/tri-holidays"
          />
        </Grid>

        <Grid item xs={6} sm={4} md={3}>
          <DashboardCard
            title="EV Vehicles"
            subtitle="Electric rides & offers"
            image={imgEV}
            to="/user/tri/tri-ev"
          />
        </Grid>

        <Grid item xs={6} sm={4} md={3}>
          <DashboardCard
            title="Wealth Galaxy"
            subtitle="Earn and grow faster"
            image={bannerWG}
            to="/user/wealth-galaxy"
            badgeText="Soon"
            badgeVariant="soon"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
