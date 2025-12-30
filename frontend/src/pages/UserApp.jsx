import React from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  InputBase,
  Grid,
  Card,
  Chip
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";

import AppIconTile from "../components/AppIconTile";
import SmartImage from "../components/SmartImage";


const categories = [
  { label: "Electronics", image: "https://cdn-icons-png.flaticon.com/512/2784/2784445.png" },
  { label: "Furniture", image: "https://cdn-icons-png.flaticon.com/512/1946/1946436.png" },
  { label: "EV", image: "https://cdn-icons-png.flaticon.com/512/744/744465.png" },
  { label: "Local", image: "https://cdn-icons-png.flaticon.com/512/869/869636.png" },
  { label: "Gifts", image: "https://cdn-icons-png.flaticon.com/512/1047/1047711.png" },
  { label: "Recharge", image: "https://cdn-icons-png.flaticon.com/512/891/891462.png" },
  { label: "Properties", image: "https://cdn-icons-png.flaticon.com/512/69/69524.png" },
  { label: "Holidays", image: "https://cdn-icons-png.flaticon.com/512/201/201623.png" }
];



/* ---------------- USER APP ---------------- */

export default function UserApp() {
  return (
    <Box sx={{ backgroundColor: "#f7f9fb", minHeight: "100vh" }}>

      {/* HEADER */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "#131921" }}>
        <Toolbar sx={{ minHeight: 56, gap: 1 }}>
          <IconButton color="inherit">
            <MenuIcon />
          </IconButton>

          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              backgroundColor: "#ffffff",
              px: 1.25,
              borderRadius: 1
            }}
          >
            <SearchIcon sx={{ color: "#6b7280" }} />
            <InputBase
              placeholder="Search for products, brands…"
              sx={{ ml: 1, flex: 1 }}
            />
          </Box>

          <IconButton color="inherit">
            <NotificationsNoneOutlinedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* CONTENT */}
      <Box sx={{ px: 2, py: 2, display: "flex", flexDirection: "column", gap: 2 }}>

        {/* CATEGORIES */}
        <Box sx={{ backgroundColor: "#ffffff", borderRadius: 2, p: 2 }}>
          <Typography fontWeight={700} mb={1}>
            Bills & Recharge
          </Typography>

          <Grid container spacing={2}>
            {categories.map((c) => (
              <Grid item xs={3} key={c.label}>
                <AppIconTile label={c.label} image={c.image} />
              </Grid>
            ))}
          </Grid>
        </Box>


      </Box>
    </Box>
  );
}
