
import React from "react";
import { Box, Typography, Button } from "@mui/material";

export default function PrimeStrip({ isPrime, onJoinClick }) {
  return (
    <Box sx={{ p:2, borderRadius:3, bgcolor:"#eef2ff", display:"flex", justifyContent:"space-between" }}>
      <Typography fontWeight={800}>
        {isPrime ? "Prime Active" : "Get Prime - Free delivery & deals"}
      </Typography>
      <Button onClick={onJoinClick} variant="contained">
        {isPrime ? "Active" : "Join ₹750"}
      </Button>
    </Box>
  );
}
