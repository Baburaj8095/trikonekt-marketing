import { Box, Typography } from "@mui/material";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import TvIcon from "@mui/icons-material/Tv";
import BoltIcon from "@mui/icons-material/Bolt";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import WaterDropIcon from "@mui/icons-material/WaterDrop";

const items = [
  { label: "Mobile", icon: <PhoneAndroidIcon /> },
  { label: "DTH", icon: <TvIcon /> },
  { label: "Electricity", icon: <BoltIcon /> },
  { label: "Gas", icon: <LocalGasStationIcon /> },
  { label: "Water", icon: <WaterDropIcon /> },
];

export default function BillsAndRecharge() {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography fontSize={16} fontWeight={700} mb={1}>
        Bills & Recharge
      </Typography>

      <Box sx={{ display: "flex", gap: 2 }}>
        {items.map((i) => (
          <Box key={i.label} textAlign="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                bgcolor: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2563eb"
              }}
            >
              {i.icon}
            </Box>

            <Typography fontSize={12} mt={0.5}>
              {i.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
