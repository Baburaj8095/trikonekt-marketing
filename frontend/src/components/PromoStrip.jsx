import { Box, Typography } from "@mui/material";
import SmartPromoImage from "./SmartPromoImage";

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
              maxWidth: 280,
              borderRadius: 3,
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
              background: "#fff",
              overflow: "hidden",
              p: 1,
            }}
          >
            <SmartPromoImage src={p.image} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

