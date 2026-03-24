import { Box, Paper, Typography } from "@mui/material";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import TvIcon from "@mui/icons-material/Tv";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import WaterDropIcon from "@mui/icons-material/WaterDrop";

const items = [
  { label: "Mobile",      icon: <PhoneAndroidIcon />,    color: "#2563EB", bg: "#EFF6FF" },
  { label: "DTH",         icon: <TvIcon />,              color: "#7C3AED", bg: "#F5F3FF" },
  { label: "Electricity", icon: <BoltIcon />,            color: "#D97706", bg: "#FFFBEB" },
  { label: "Gas",         icon: <LocalGasStationIcon />, color: "#DC2626", bg: "#FEF2F2" },
  { label: "Water",       icon: <WaterDropIcon />,       color: "#0891B2", bg: "#ECFEFF" },
];

export default function BillsAndRecharge({ onItemClick }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: "#fff",
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      }}
    >
      <Typography
        sx={{ fontSize: 16, fontWeight: 800, color: "#1A1D2E", mb: 1.5, letterSpacing: "-0.2px" }}
      >
        Bills &amp; Recharge
      </Typography>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        {items.map((i) => (
          <Box
            key={i.label}
            textAlign="center"
            role="button"
            tabIndex={0}
            onClick={() => onItemClick && onItemClick(i)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && onItemClick) {
                e.preventDefault();
                onItemClick(i);
              }
            }}
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.75,
              cursor: "pointer",
              py: 0.5,
              "&:active": { transform: "scale(0.94)" },
              transition: "transform 0.12s",
            }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 13,
                bgcolor: i.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: i.color,
              }}
            >
              {/* cloneElement so icon inherits color from parent Box color prop */}
              {i.icon}
            </Box>
            <Typography
              sx={{ fontSize: 11, fontWeight: 700, color: "#1A1D2E", lineHeight: 1.2 }}
            >
              {i.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
