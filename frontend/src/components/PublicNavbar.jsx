import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate, useLocation } from "react-router-dom";
import LOGO from "../assets/TRIKONEKT.png";

export default function PublicNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = [
    { label: "Home", path: "/" },
    { label: "About", path: "/about" },
    { label: "Prime", path: "/prime" },
    { label: "Business", path: "/business" },
  ];

  const isActive = (path) => location.pathname === path;

  const handleNav = (path) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "#ffffff",
          color: "#0C2D48",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <Toolbar
          sx={{
            maxWidth: 1200,
            width: "100%",
            mx: "auto",
            px: { xs: 2, md: 0 },
          }}
        >
          {/* LOGO */}
          <Box
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            <img src={LOGO} alt="Trikonekt" style={{ height: 34 }} />
          </Box>

          {/* DESKTOP NAV */}
          <Box
            sx={{
              flexGrow: 1,
              display: { xs: "none", md: "flex" },
              justifyContent: "center",
              gap: 3,
            }}
          >
            {navItems.map((item) => (
              <Button
                key={item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  color: isActive(item.path)
                    ? "#145DA0"
                    : "#0C2D48",
                  borderBottom: isActive(item.path)
                    ? "2px solid #145DA0"
                    : "2px solid transparent",
                  borderRadius: 0,
                  px: 1,
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          {/* DESKTOP ACTIONS */}
          <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
            <Button
              variant="text"
              sx={{ fontWeight: 600, textTransform: "none" }}
              onClick={() => navigate("/auth/login")}
            >
              Login
            </Button>
            <Button
              variant="contained"
              sx={{
                fontWeight: 600,
                textTransform: "none",
                bgcolor: "#145DA0",
                px: 2.5,
              }}
              onClick={() => navigate("/auth/register-v2")}
            >
              Get Started
            </Button>
          </Box>

          {/* MOBILE MENU ICON */}
          <IconButton
            sx={{ display: { xs: "flex", md: "none" }, ml: "auto" }}
            onClick={() => setOpen(true)}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* MOBILE DRAWER */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 260 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              p: 2,
            }}
          >
            <img src={LOGO} alt="Trikonekt" style={{ height: 30 }} />
            <IconButton onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          <List>
            {navItems.map((item) => (
              <ListItem
                button
                key={item.path}
                onClick={() => handleNav(item.path)}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive(item.path) ? 700 : 500,
                    color: isActive(item.path)
                      ? "#145DA0"
                      : "#0C2D48",
                  }}
                />
              </ListItem>
            ))}
          </List>

          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="contained"
              sx={{ mb: 1, bgcolor: "#145DA0" }}
              onClick={() => handleNav("/auth/register-v2")}
            >
              Get Started
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleNav("/auth/login")}
            >
              Login
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
