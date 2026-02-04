import React, { useEffect, useState } from "react";
import { Box, Container, Typography, Card, CardContent, Grid } from "@mui/material";
import PublicNavbar from "../components/PublicNavbar";
import Footer from "../components/Footer";
import { useNavigate } from "react-router-dom";
import PrimeStrip from "../components/PrimeBadge";
import { listMyPromoPurchases } from "../api/api";

export default function PrimePage() {
  const navigate = useNavigate();
  const [purchasedPrime750, setPurchasedPrime750] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listMyPromoPurchases();
        const list = Array.isArray(res) ? res : res?.results || [];
        const valid = (list || []).filter((pp) => String(pp?.status || "").toUpperCase() === "APPROVED");
        let has750 = false;
        for (const pp of valid) {
          const pkg = pp?.package || {};
          const type = String(pkg?.type || "");
          const name = String(pkg?.name || "").toLowerCase();
          const code = String(pkg?.code || "").toLowerCase();
          const price = Number(pkg?.price || 0);
          if (type === "PRIME" && (Math.abs(price - 750) < 0.5 || name.includes("750") || code.includes("750"))) {
            has750 = true;
          }
        }
        if (!alive) return;
        setPurchasedPrime750(has750);
      } catch (_) {
        if (!alive) return;
        setPurchasedPrime750(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Box bgcolor="#ffffff" minHeight="100vh" display="flex" flexDirection="column">
      <PublicNavbar />
      <PrimeStrip
        isPrime={purchasedPrime750}
        onJoinClick={() => navigate("/user/promo-packages")}
      />

      <Container sx={{ py: { xs: 5, md: 8 }, flex: 1 }}>
        <Typography fontSize={{ xs: 28, md: 36 }} fontWeight={800} color="#0C2D48" mb={2}>
          Trikonekt Prime
        </Typography>

        <Typography color="text.secondary" maxWidth={800} mb={3}>
          Unlock premium benefits with Trikonekt Prime  enhanced rewards, exclusive offers, and tools
          designed to help you earn and grow faster.
        </Typography>

        <Grid container spacing={2}>
          {[
            { title: "Higher Rewards", desc: "Earn more points and benefits on your spends and referrals." },
            { title: "Exclusive Offers", desc: "Access Prime-only deals from top brands and services." },
            { title: "Priority Support", desc: "Get faster help and dedicated support when you need it." },
          ].map((p) => (
            <Grid key={p.title} item xs={12} md={4}>
              <Card sx={{ borderRadius: 3, height: "100%" }}>
                <CardContent>
                  <Typography fontWeight={700}>{p.title}</Typography>
                  <Typography mt={1} color="text.secondary">{p.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Footer />
    </Box>
  );
}
