import React from "react";
import { Box, Container, Typography, Grid, Card, CardContent } from "@mui/material";
import PublicNavbar from "../components/PublicNavbar";
import Footer from "../components/Footer";

export default function BusinessPage() {
  return (
    <Box bgcolor="#ffffff" minHeight="100vh" display="flex" flexDirection="column">
      <PublicNavbar />

      <Container sx={{ py: { xs: 5, md: 8 }, flex: 1 }}>
        <Typography fontSize={{ xs: 28, md: 36 }} fontWeight={800} color="#0C2D48" mb={2}>
          Trikonekt for Business
        </Typography>

        <Typography color="text.secondary" maxWidth={800} mb={3}>
          Grow your business with Trikonekt — acquire customers, accept e‑payments, list your shop,
          and run targeted promotions across our network.
        </Typography>

        <Grid container spacing={2}>
          {[
            { title: "List Your Shop", desc: "Get discovered by nearby customers in the Trikonekt marketplace." },
            { title: "Promotions", desc: "Run offers and campaigns to boost footfall and sales." },
            { title: "Insights", desc: "Track engagement and performance with simple dashboards." },
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
