import React from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import { motion } from "framer-motion";
import PublicNavbar from "../components/PublicNavbar";
import Footer from "../components/Footer";
import {
  fadeUp,
  staggerContainer,
  hoverLift,
  tapScale,
  viewportOnce,
} from "../animations/motion";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <Box bgcolor="#ffffff">
      <PublicNavbar />

      {/* ================= HERO ================= */}
      <Container sx={{ py: { xs: 5, md: 8 } }}>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <Box
            sx={{
              borderRadius: 4,
              p: { xs: 3, md: 5 },
              background:
                "linear-gradient(180deg, #F5F7FB 0%, #FFFFFF 100%)",
            }}
          >
            <Typography
              fontSize={{ xs: 30, md: 40 }}
              fontWeight={800}
              color="#0C2D48"
              lineHeight={1.2}
            >
              One Platform.
              <br />
              Multiple Opportunities.
            </Typography>

            <Typography
              mt={2}
              fontSize={15}
              color="text.secondary"
              maxWidth={480}
            >
              Trikonekt connects shopping, services, and earning opportunities
              into one powerful digital ecosystem.
            </Typography>

            <Box mt={4} display="flex" gap={2} flexWrap="wrap">
              <motion.div {...tapScale}>
                <Button
                  variant="contained"
                  size="large"
                  sx={{
                    bgcolor: "#145DA0",
                    height: 48,
                    px: 4,
                  }}
                  onClick={() => navigate("/auth/register-v2")}
                >
                  Get Started
                </Button>
              </motion.div>

              <motion.div {...tapScale}>
                <Button
                  variant="outlined"
                  size="large"
                  sx={{ height: 48, px: 4 }}
                  onClick={() => navigate("/auth/login")}
                >
                  Login
                </Button>
              </motion.div>
            </Box>
          </Box>
        </motion.div>
      </Container>

      {/* ================= WHAT YOU CAN DO ================= */}
      <Container sx={{ py: { xs: 5, md: 7 } }}>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <Typography fontSize={24} fontWeight={800} mb={4}>
            What You Can Do with Trikonekt
          </Typography>

          <Grid container spacing={3}>
            {[
              "Shop Electronics & Home Appliances",
              "Buy Furniture",
              "Explore EV Solutions",
              "Shop from Local Stores",
              "Gift Cards & Digital Services",
              "Travel & Holiday Packages",
            ].map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item}>
                <motion.div variants={fadeUp} {...hoverLift}>
                  <Card sx={{ borderRadius: 3, height: "100%" }}>
                    <CardContent>
                      <Typography fontWeight={700}>{item}</Typography>
                      <Typography
                        mt={1}
                        fontSize={14}
                        color="text.secondary"
                      >
                        Discover trusted products and services in one platform.
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      </Container>

      {/* ================= ABOUT (HOME VERSION) ================= */}
      <Box bgcolor="#F5F7FB" py={{ xs: 5, md: 7 }}>
        <Container>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            <Typography fontSize={24} fontWeight={800} mb={2}>
              About Trikonekt
            </Typography>

            <Typography color="text.secondary" maxWidth={700}>
              <strong>TRIKONEKT</strong> is a smart digital platform built to
              connect people, businesses, and opportunities into one powerful
              network.
            </Typography>

            <Typography mt={2} color="text.secondary" maxWidth={700}>
              Through our <strong>Connect → Earn → Grow</strong> model, everyday
              spending and interactions are transformed into meaningful income
              and long-term growth.
            </Typography>
          </motion.div>
        </Container>
      </Box>

      {/* ================= WHY TRIKONEKT ================= */}
      <Container sx={{ py: { xs: 5, md: 7 } }}>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <Typography fontSize={24} fontWeight={800} mb={3}>
            Why Trikonekt
          </Typography>

          <Grid container spacing={2}>
            {[
              "Single unified digital platform",
              "Transparent & trustworthy system",
              "Growth opportunities for users & businesses",
              "Designed for long-term value creation",
            ].map((point) => (
              <Grid item xs={12} sm={6} key={point}>
                <Typography fontSize={15}>✔ {point}</Typography>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      </Container>

      {/* ================= FINAL CTA ================= */}
      <Box bgcolor="#0C2D48" py={{ xs: 6, md: 8 }}>
        <Container textAlign="center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            <Typography fontSize={26} fontWeight={800} color="#ffffff">
              Ready to get started?
            </Typography>

            <Typography
              mt={1}
              color="rgba(255,255,255,0.85)"
              maxWidth={520}
              mx="auto"
            >
              Join Trikonekt and turn your everyday spending into opportunities
              for growth.
            </Typography>

            <motion.div {...tapScale}>
              <Button
                variant="contained"
                sx={{
                  mt: 4,
                  bgcolor: "#22C55E",
                  color: "#0C2D48",
                  height: 48,
                  px: 5,
                }}
                onClick={() => navigate("/auth/register-v2")}
              >
                Create Account
              </Button>
            </motion.div>
          </motion.div>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
}
