import React from "react";
import { Box, Container, Typography } from "@mui/material";
import NavbarV2 from "./components/NavbarV2";
import FooterV2 from "./components/FooterV2";
import "./styles/v2-theme.css";

export default function TermsV2() {
  return (
    <Box className="v2-scope v2-reset" sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--tri-bg)" }}>
      <NavbarV2 />
      <Container maxWidth="md" className="v2-container" sx={{ flex: 1, py: 4 }}>
        <Typography sx={{ color: "var(--tri-text-1)", fontWeight: 800, fontSize: 22, mb: 1 }}>
          Terms & Conditions
        </Typography>
        <Typography sx={{ color: "var(--tri-text-2)", lineHeight: 1.8, mb: 2 }}>
          By accessing or using Trikonekt, you agree to comply with these terms. Usage must be lawful and
          in accordance with our policies. We may update these terms periodically; continued use signifies
          acceptance of the latest terms.
        </Typography>
        <Typography sx={{ color: "var(--tri-text-2)", lineHeight: 1.8 }}>
          - Use the platform responsibly and do not misuse services.<br />
          - Respect intellectual property and privacy of others.<br />
          - Violations may result in access restrictions as per policy.
        </Typography>
      </Container>
      <FooterV2 />
    </Box>
  );
}
