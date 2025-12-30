import { Box, Typography } from "@mui/material";

export default function ServiceGrid({ items }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1 }}>
      {items.map((s) => (
        <Box key={s.label} sx={{ bgcolor: "#fff", p: 1, borderRadius: 2 }}>
          <Typography fontSize={12}>{s.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
