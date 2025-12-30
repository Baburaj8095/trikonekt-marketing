import React from "react";
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  InputBase,
  Avatar,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useNavigate } from "react-router-dom";
import LOGO from "../assets/TRIKONEKT.png";

export default function PublicNavbar() {
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "#ffffff",
        color: "#0C2D48",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        {/* LOGO */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
          onClick={() => navigate("/")}
        >
          <img
            src={LOGO}
            alt="Trikonekt"
            style={{ height: 34 }}
          />
        </Box>

        {/* SEARCH */}
        <Box
          sx={{
            flexGrow: 1,
            mx: 1,
            display: "flex",
            alignItems: "center",
            bgcolor: "#f1f5f9",
            borderRadius: 2,
            px: 1,
          }}
          onClick={() => navigate("/search")}
        >
          <SearchIcon sx={{ fontSize: 20, color: "#64748b" }} />
          <InputBase
            placeholder="Search products"
            sx={{
              ml: 1,
              fontSize: 14,
              width: "100%",
            }}
            disabled
          />
        </Box>

        {/* PROFILE */}
        <IconButton
          onClick={() => navigate("/auth/login")}
          sx={{
            bgcolor: "#f1f5f9",
            "&:hover": { bgcolor: "#e2e8f0" },
          }}
        >
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: "transparent",
              color: "#0C2D48",
            }}
          >
            <PersonOutlineIcon />
          </Avatar>
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
