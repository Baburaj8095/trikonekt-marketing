import React from "react";
import { Box, Container, Typography } from "@mui/material";
import NavbarV2 from "./components/NavbarV2";
import FooterV2 from "./components/FooterV2";
import "./styles/v2-theme.css";

export default function PrivacyV2() {
  return (
    <Box className="v2-scope v2-reset" sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--tri-bg)" }}>
      <NavbarV2 />
      <Container maxWidth="md" className="v2-container" sx={{ flex: 1, py: 4 }}>
        <Typography sx={{ color: "var(--tri-text-1)", fontWeight: 800, fontSize: 22, mb: 1 }}>
          Privacy Policy
        </Typography>
        <Typography sx={{ color: "var(--tri-text-2)", lineHeight: 1.8, mb: 2 }}>
          We value your privacy. Trikonekt collects and processes only the data necessary to deliver our services.
          Your information is protected and used in accordance with applicable laws and our internal policies.
        </Typography>
        <Typography sx={{ color: "var(--tri-text-2)", lineHeight: 1.8 }}>
          - We do not sell your personal information.
          <br />
          - Data is stored securely and accessed only by authorized systems.
          <br />
          - You may request corrections or deletion where legally permitted.
        </Typography>
      </Container>
      <FooterV2 />
    </Box>
  );
}
