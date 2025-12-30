import { Box, Typography } from "@mui/material";

export default function DealsRow({ items }) {
  return (
    <Box>
      <Typography fontWeight={700}>Deals & Promotions</Typography>
      <Box sx={{ display: "flex", gap: 1, overflowX: "auto" }}>
        {items.map((d) => (
          <Box
            key={d.label}
            sx={{ minWidth: 140, bgcolor: "#fff", p: 1, borderRadius: 2 }}
          >
            <img src={d.image} alt={d.label} width="100%" />
            <Typography fontSize={12} fontWeight={700}>
              {d.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
