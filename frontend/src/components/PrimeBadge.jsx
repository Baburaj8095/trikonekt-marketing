import React from "react";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { Box, Typography, Button } from "@mui/material";

const PrimeStrip = ({ isPrime, onJoinClick }) => {
  return (
    <Box
      sx={{
        mx: 2,
        mt: 2,
        p: 1.5,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: isPrime
          ? "linear-gradient(90deg,#7b61ff,#5a4bff)"
          : "#fff",
        color: isPrime ? "#fff" : "#333",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Left */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <WorkspacePremiumIcon
          sx={{
            color: "#FFD700",
          }}
        />

        <Box>
          <Typography fontSize={14} fontWeight={600}>
            {isPrime ? "Prime Member" : "Unlock Prime Benefits"}
          </Typography>

          <Typography fontSize={11} opacity={0.9}>
            {isPrime
              ? "Trikonekt"
              : ""}
          </Typography>
        </Box>
      </Box>

      {/* CTA */}
      <Button
        onClick={() => {
          if (!isPrime && typeof onJoinClick === "function") onJoinClick();
        }}
        variant={isPrime ? "contained" : "outlined"}
        sx={{
          background: isPrime ? "#fff" : "transparent",
          color: isPrime ? "#5a4bff" : "#5a4bff",
          fontWeight: 600,
          textTransform: "none",
          borderRadius: 2,
          pointerEvents: isPrime ? "none" : "auto",
        }}
      >
        {isPrime ? "Prime Active" : "Join @ ₹750"}
      </Button>
    </Box>
  );
};

export default PrimeStrip;
