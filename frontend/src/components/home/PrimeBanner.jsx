import { Box, Typography, Button } from "@mui/material";

export default function PrimeBanner({ active }) {
  return (
    <Box sx={{ bgcolor: "#0C2D48", color: "#fff", p: 2, borderRadius: 2 }}>
      <Typography fontWeight={700}>
        {active ? "Prime Active" : "Upgrade to Prime"}
      </Typography>
      {!active && (
        <Button variant="contained" sx={{ mt: 1 }}>
          Upgrade
        </Button>
      )}
    </Box>
  );
}
