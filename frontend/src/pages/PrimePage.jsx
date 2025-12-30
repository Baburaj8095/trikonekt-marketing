import React from "react";
import { Box, Container, Typography, Card, CardContent, Grid } from "@mui/material";
import PublicNavbar from "../components/PublicNavbar";
import Footer from "../components/Footer";

export default function PrimePage() {
  return (
    <Box bgcolor="#ffffff" minHeight="100vh" display="flex" flexDirection="column">
      <PublicNavbar />

      <Container sx={{ py: { xs: 5, md: 8 }, flex: 1 }}>
        <Typography fontSize={{ xs: 28, md: 36 }} fontWeight={800} color="#0C2D48" mb={2}>
          Trikonekt Prime
        </Typography>

        <Typography color="text.secondary" maxWidth={800} mb={3}>
          Unlock premium benefits with Trikonekt Prime — enhanced rewards, exclusive offers, and tools
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
