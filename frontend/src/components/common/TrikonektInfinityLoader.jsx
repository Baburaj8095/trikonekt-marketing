import React from "react";
import { Box, Typography } from "@mui/material";

/**
 * Trikonekt Signature Infinity Symbol Brand Loader
 * Features a glowing animated SVG infinity loop in Trikonekt brand colors:
 * Electric Cobalt (#1E40AF) to Vibrant Cyan (#06B6D4) and Violet (#7C3AED)
 */
export default function TrikonektInfinityLoader({
  size = 64,
  text = "Loading...",
  showText = true,
}) {
  const width = size * 1.6;
  const height = size;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
      }}
    >
      <style>{`
        @keyframes triInfinityStroke {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -300;
          }
        }
        @keyframes triInfinityPulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 4px rgba(30, 64, 175, 0.4));
          }
          50% {
            transform: scale(1.05);
            filter: drop-shadow(0 0 12px rgba(6, 182, 212, 0.6));
          }
        }
      `}</style>

      <Box
        sx={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "triInfinityPulse 2.2s ease-in-out infinite",
        }}
      >
        <svg
          viewBox="0 0 120 70"
          width={width}
          height={height}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="triInfinityGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="35%" stopColor="#2563EB" />
              <stop offset="70%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track */}
          <path
            d="M35,35 C15,35 12,18 25,18 C38,18 50,35 60,35 C70,35 82,18 95,18 C108,18 105,35 85,35 C65,35 60,35 60,35 C60,35 55,35 35,35 Z"
            stroke="rgba(226, 232, 240, 0.6)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* True Mathematical Lemniscate Infinity Path */}
          <path
            d="M32 20 C18 20 10 28 10 35 C10 42 18 50 32 50 C48 50 56 35 60 35 C64 35 72 50 88 50 C102 50 110 42 110 35 C110 28 102 20 88 20 C72 20 64 35 60 35 C56 35 48 20 32 20 Z"
            stroke="rgba(203, 213, 225, 0.35)"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Animated Glowing Stroke */}
          <path
            d="M32 20 C18 20 10 28 10 35 C10 42 18 50 32 50 C48 50 56 35 60 35 C64 35 72 50 88 50 C102 50 110 42 110 35 C110 28 102 20 88 20 C72 20 64 35 60 35 C56 35 48 20 32 20 Z"
            stroke="url(#triInfinityGrad)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="90 210"
            style={{
              animation: "triInfinityStroke 1.8s linear infinite",
            }}
          />

          {/* Center brand dot accent */}
          <circle cx="60" cy="35" r="3.5" fill="#06B6D4" />
        </svg>
      </Box>

      {showText && (
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: "#475569",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {text}
        </Typography>
      )}
    </Box>
  );
}
