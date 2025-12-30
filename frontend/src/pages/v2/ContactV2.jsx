import React from "react";
import { Box, Container, Typography } from "@mui/material";
import NavbarV2 from "./components/NavbarV2";
import FooterV2 from "./components/FooterV2";
import "./styles/v2-theme.css";

export default function ContactV2() {
  return (
    <Box className="v2-scope v2-reset" sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--tri-bg)" }}>
      <NavbarV2 />
      <Container maxWidth="md" className="v2-container" sx={{ flex: 1, py: 4 }}>
        <Typography sx={{ color: "var(--tri-text-1)", fontWeight: 800, fontSize: 22, mb: 1 }}>
          Contact Us
        </Typography>
        <Typography sx={{ color: "var(--tri-text-2)", lineHeight: 1.8 }}>
          For support or business inquiries, reach us at:
          <br />
          support@trikonekt.com
        </Typography>
      </Container>
      <FooterV2 />
    </Box>
  );
}
