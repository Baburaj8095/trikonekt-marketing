import React from "react";
import {
  Box,
  Typography,
  Card,
  Chip,
} from "@mui/material";
import DevicesIcon from "@mui/icons-material/Devices";
import WeekendIcon from "@mui/icons-material/Weekend";
import ElectricCarIcon from "@mui/icons-material/ElectricCar";
import StoreIcon from "@mui/icons-material/Store";
import WifiIcon from "@mui/icons-material/Wifi";
import BoltIcon from "@mui/icons-material/Bolt";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import TvIcon from "@mui/icons-material/Tv";

export default function UserHomePage() {
  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>

      {/* ================= HERO BANNER ================= */}
      <Box
        sx={{
          height: 170,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <img
          src="/assets/hero-banner.jpg" // 🔴 replace with real image
          alt="banner"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </Box>

      {/* ================= CATEGORIES ================= */}
      <Typography fontWeight={800} fontSize={18}>
        Shop by Tri Categories
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1.5,
        }}
      >
        {[
          { label: "Electronics", icon: DevicesIcon, bg: "#E3F2FD", color: "#1565C0" },
          { label: "Furniture", icon: WeekendIcon, bg: "#FFF3E0", color: "#EF6C00" },
          { label: "EV", icon: ElectricCarIcon, bg: "#E8F5E9", color: "#2E7D32" },
          { label: "Local", icon: StoreIcon, bg: "#F3E5F5", color: "#6A1B9A" },
        ].map((c) => (
          <Box
            key={c.label}
            sx={{
              bgcolor: "#fff",
              borderRadius: 3,
              p: 1.5,
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}
          >
            <Box
              sx={{
                width: 46,
                height: 46,
                mx: "auto",
                mb: 1,
                borderRadius: "50%",
                bgcolor: c.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <c.icon sx={{ fontSize: 22, color: c.color }} />
            </Box>
            <Typography fontSize={12} fontWeight={700}>
              {c.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ================= DEALS ================= */}
      <Typography fontWeight={800} fontSize={18}>
        Deals & Promotions
      </Typography>

      <Card sx={{ p: 1.5, borderRadius: 3 }}>
        <Chip
          label="LIMITED TIME"
          size="small"
          sx={{
            bgcolor: "#EF4444",
            color: "#fff",
            mb: 1,
          }}
        />

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Box
            sx={{
              width: 110,
              height: 110,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <img
              src="/assets/spin-win.jpg" // 🔴 replace
              alt="spin"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1 }}>
            <UtilityIcon icon={PhoneIphoneIcon} label="Mobile" />
            <UtilityIcon icon={TvIcon} label="DTH" />
            <UtilityIcon icon={WifiIcon} label="Broadband" />
            <UtilityIcon icon={BoltIcon} label="Electricity" />
          </Box>
        </Box>
      </Card>

      {/* ================= PRIME ================= */}
      <Card sx={{ p: 1.5, borderRadius: 3 }}>
        <Chip
          label="Prime Active"
          sx={{
            bgcolor: "#22C55E",
            color: "#065F46",
            fontWeight: 700,
            mb: 1,
          }}
        />
        <Typography fontSize={14}>
          You're enjoying Prime benefits.
        </Typography>
      </Card>

      {/* ================= ELECTRONICS ================= */}
      <Typography fontWeight={800} fontSize={18}>
        Electronics
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, overflowX: "auto", pb: 1 }}>
        {[1, 2].map((i) => (
          <Card
            key={i}
            sx={{
              minWidth: 180,
              borderRadius: 3,
              p: 1,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <Box
              sx={{
                height: 110,
                borderRadius: 2,
                overflow: "hidden",
                mb: 1,
              }}
            >
              <img
                src="/assets/product.jpg" // 🔴 replace
                alt="product"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </Box>

            <Typography fontWeight={700} fontSize={14}>
              Smart 4K TV
            </Typography>
            <Typography fontSize={12} color="text.secondary">
              Earn up to 6% rewards
            </Typography>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

function UtilityIcon({ icon: Icon, label }) {
  return (
    <Box
      sx={{
        bgcolor: "#F8FAFC",
        borderRadius: 2,
        p: 1,
        textAlign: "center",
      }}
    >
      <Icon sx={{ fontSize: 22, color: "#0C2D48", mb: 0.5 }} />
      <Typography fontSize={11} fontWeight={600}>
        {label}
      </Typography>
    </Box>
  );
}
