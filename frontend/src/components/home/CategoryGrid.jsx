import { Box, Typography } from "@mui/material";

export default function CategoryGrid({ items }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1 }}>
      {items.map((c) => (
        <Box
          key={c.label}
          sx={{
            bgcolor: "#fff",
            borderRadius: 2,
            p: 1,
            textAlign: "center",
          }}
        >
          <Typography fontSize={12} fontWeight={700}>
            {c.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
