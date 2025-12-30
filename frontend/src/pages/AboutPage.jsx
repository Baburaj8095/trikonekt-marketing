import React from "react";
import { Box, Container, Typography } from "@mui/material";
import PublicNavbar from "../components/PublicNavbar";
import Footer from "../components/Footer";

export default function AboutPage() {
  return (
    <Box bgcolor="#ffffff" minHeight="100vh" display="flex" flexDirection="column">
      <PublicNavbar />

      <Container sx={{ py: { xs: 5, md: 8 }, flex: 1 }}>
        <Typography fontSize={{ xs: 28, md: 36 }} fontWeight={800} color="#0C2D48" mb={2}>
          About Trikonekt
        </Typography>

        <Typography color="text.secondary" maxWidth={800}>
          Trikonekt is a smart digital platform built to connect people, businesses, and
          opportunities into one powerful network. Through our Connect → Earn → Grow model,
          everyday spending and interactions are transformed into meaningful income and
          long‑term growth.
        </Typography>

        <Typography mt={3} color="text.secondary" maxWidth={800}>
          Explore shopping, services, rewards, and business tools — all in a single unified
          ecosystem designed for transparency and long‑term value creation.
        </Typography>
      </Container>

      <Footer />
    </Box>
  );
}
