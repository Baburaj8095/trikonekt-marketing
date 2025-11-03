import React from "react";
import { AppBar, Toolbar, Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LOGO from "../assets/TRIKONEKT.png";

export default function PublicNavbar() {
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: "#0C2D48",
        color: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      }}
    >
      <Toolbar>
        <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
          <img src={LOGO} alt="Trikonekt" style={{ height: 40, marginRight: 10 }} />
        </Box>
        <Button
          color="inherit"
          sx={{ fontWeight: 500, textTransform: "none" }}
          onClick={() => navigate("/login")}
        >
          Login
        </Button>
      </Toolbar>
    </AppBar>
  );
}
