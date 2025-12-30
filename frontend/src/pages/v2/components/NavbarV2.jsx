import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Box } from "@mui/material";
import LOGO from "../../../assets/TRIKONEKT.png";
import "../styles/v2-theme.css";

export default function NavbarV2() {
  const location = useLocation();
  const isActive = (to) => (location.pathname || "").toLowerCase().startsWith(to.toLowerCase());

  return (
    <Box component="nav" className="v2-navbar">
      <Box className="v2-nav-inner">
        <Link to="/v2/home" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <img src={LOGO} alt="TRIKONEKT" className="tri-logo" />
        </Link>

        <div className="v2-nav-links">
          <Link className={`v2-nav-link ${isActive("/v2/home") ? "active" : ""}`} to="/v2/home">
            Home
          </Link>
          <Link className={`v2-nav-link ${isActive("/v2/about") ? "active" : ""}`} to="/v2/about">
            About
          </Link>
          <Link className={`v2-nav-link ${isActive("/v2/login") ? "active" : ""}`} to="/v2/login/user">
            Login
          </Link>
          <Link className={`v2-nav-link ${isActive("/v2/register") ? "active" : ""}`} to="/v2/register/user">
            Register
          </Link>
        </div>
      </Box>
    </Box>
  );
}
