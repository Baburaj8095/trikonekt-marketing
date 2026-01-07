import { Box, Typography } from "@mui/material";
import SmartImage from "./SmartImage";

export default function PromoStrip({ promos }) {
  return (
    <Box mt={2}>
      <Typography fontSize={16} fontWeight={700} mb={1}>
        Offers & Promotions
      </Typography>

      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          pb: 1,
          WebkitOverflowScrolling: "touch",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {promos.map((p, i) => (
          <Box
            key={i}
            sx={{
              minWidth: 280,
              bgcolor: "#fff",
              borderRadius: 2,
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
              p: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* 🔥 NO HEIGHT CONSTRAINT */}
            <SmartImage
              type="promo"
              src={p.image}
              sx={{
                width: "100%",
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
