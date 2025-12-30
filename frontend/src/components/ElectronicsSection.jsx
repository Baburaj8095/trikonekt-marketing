import React from "react";
import { Box, Stack, Card, Typography } from "@mui/material";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import SatelliteAltIcon from "@mui/icons-material/SatelliteAlt";
import WifiIcon from "@mui/icons-material/Wifi";
import BoltIcon from "@mui/icons-material/Bolt";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import imgPlaystoreScreen from "../assets/electronics-img.jpg";


// ElectronicsSection
// Scope: ONLY the "Electronics" section for the Home screen.
// Constraints strictly followed:
// - No changes to global theme/colors/fonts/tokens
// - Rectangular cards only (no rounded/pill/oval)
// - No heavy shadows or gradients
// - No new dependencies/libraries
// - No unrelated refactors
// - No prices/specs/long descriptions
// - No page-level horizontal scrolling
// Image Rules:
// - Use ONLY provided paths; if missing, show neutral placeholder + TODO comment
// - Preserve aspect ratio; object-fit: contain; no stretching/cropping/upscaling
// - Maintain consistent style (icons vs photos)

const ElectronicsSection = () => {
  // Data (isolated within the component). Assets are currently missing under src/assets.
  // Per rules, we DO NOT guess alternatives; we render placeholders and add TODO notes.
  

 const quickNeeds = [
  {
    key: "mobile",
    label: "Mobile Recharge",
    Icon: SmartphoneIcon,
    bg: "#E3F2FD",
    rewardText: "Up to 3% rewards",
  },
  {
    key: "dth",
    label: "DTH",
    Icon: SatelliteAltIcon,
    bg: "#E8F5E9",
    rewardText: "Up to 2% rewards",
  },
  {
    key: "broadband",
    label: "Broadband",
    Icon: WifiIcon,
    bg: "#E1F5FE",
    rewardText: "Up to 4% rewards",
  },
  {
    key: "electricity",
    label: "Electricity",
    Icon: BoltIcon,
    bg: "#FFF8E1",
    rewardText: "Up to 1.5% rewards",
  },
  {
    key: "giftcard",
    label: "Gift Cards",
    Icon: CardGiftcardIcon,
    bg: "#FCE4EC",
    rewardText: "Up to 5% rewards",
  },
];


  const featured = [
    {
      key: "tv",
      name: "Smart 4K TV",
      image: imgPlaystoreScreen, // TODO: add asset at /assets/electronics/tv.png
      rewardText: "Earn up to 6% rewards",
    },
    {
      key: "speaker",
      name: "Wireless Speaker",
      image: null, // TODO: add asset at /assets/electronics/speaker.png
      rewardText: "Earn up to 4% rewards",
    },
    {
      key: "camera",
      name: "Mirrorless Camera",
      image: null, // TODO: add asset at /assets/electronics/camera.png
      rewardText: "Earn up to 5% rewards",
    },
  ];

  // Neutral placeholder to avoid guessing missing assets
  const Placeholder = ({ label, size = 48, ariaLabel }) => (
    <Box
      role="img"
      aria-label={ariaLabel || label}
      sx={{
        width: size,
        height: size,
        border: "1px solid",
        borderColor: "divider",
        backgroundColor: "#f7f7f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "text.secondary",
        fontSize: 10,
        userSelect: "none",
      }}
    >
      {label}
    </Box>
  );

  return (
    <Box component="section" sx={{ width: "100%", bgcolor: "#fff" }}>
      {/* Section Header - match existing header style in HomeScreen ("Welcome to Trikonekt") */}
      <Box
        sx={{
          px: { xs: 2, md: 0 },
          py: { xs: 2, md: 2 },
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: "#0C2D48",
            fontSize: { xs: 20, md: 24 },
            lineHeight: 1.2,
          }}
        >
          Recharge & Bills
        </Typography>
        <Typography
          role="link"
          tabIndex={0}
          sx={{
            color: "primary.main",
            fontWeight: 600,
            fontSize: { xs: 13, md: 14 },
            cursor: "pointer",
            userSelect: "none",
          }}
          aria-label="View All Electronics"
        >
          View All
        </Typography>
      </Box>

      {/* Quick Digital Needs - Horizontal Scroll */}
      <Box sx={{ px: { xs: 2, md: 0 }, mb: { xs: 2.5, md: 3 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            py: 0.5,
            "&::-webkit-scrollbar": { display: "none" },
          }}
          aria-label="Quick Digital Needs"
          role="list"
        >
          {quickNeeds.map((item) => (
            <Card
              key={item.key}
              role="listitem"
              elevation={0}
              sx={{
                minWidth: 96,
                width: 96,
                height: 104,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 0, // rectangular only
                boxShadow: "none", // no heavy shadows
                p: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                flex: "0 0 auto",
                background: "#fff",
              }}
            >
              {/* Icon container with Material icon (48x48, radius 8) */}
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "8px",
                  bgcolor: item.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "8px",
                    bgcolor: item.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <item.Icon sx={{ fontSize: 26, color: "#1C1C1C" }} />
                </Box>

              </Box>

              {/* Label */}
              <Typography
                variant="body2"
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "center",
                  maxWidth: "100%",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
                title={item.label}
              >
                {item.label}
              </Typography>

              {/* Optional small badge */}
              {item.rewardText ? (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 10,
                    px: 0.5,
                    py: 0.25,
                    border: "1px solid",
                    borderColor: "divider",
                    color: "text.secondary",
                    lineHeight: 1,
                    letterSpacing: 0.1,
                    userSelect: "none",
                  }}
                >
                  {item.rewardText}
                </Typography>
              ) : null}
            </Card>
          ))}
        </Stack>
      </Box>

      {/* Featured Electronics - Horizontal Scroll with Snap */}
      <Box sx={{ px: { xs: 2, md: 0 }, mb: { xs: 2, md: 3 } }}>
         <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: "#0C2D48",
            fontSize: { xs: 20, md: 24 },
            lineHeight: 1.2,
          }}
        >
          Electronics
        </Typography>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            py: 0.5,
            "&::-webkit-scrollbar": { display: "none" },
          }}
          aria-label="Featured Electronics"
          role="list"
        >
          
          {featured.map((p) => (
            <Card
              key={p.key}
              role="listitem"
              elevation={0}
              sx={{
                minWidth: "50%", // ~2.2 cards on mobile viewport
                maxWidth: 360,
                height: 250,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 0, // rectangular only
                boxShadow: "none",
                display: "flex",
                flexDirection: "column",
                scrollSnapAlign: "start",
                background: "#fff",
                flex: "0 0 auto",
              }}
            >
              {/* Image area (~70% height) */}
              <Box
                sx={{
                  height: "70%",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 1.5,
                }}
              >
                {p.image ? (
                  <Box
                    component="img"
                    src={p.image}
                    alt={p.name}
                    sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#f7f7f7",
                      color: "text.secondary",
                      border: "1px dashed",
                      borderColor: "divider",
                      fontSize: 12,
                    }}
                    role="img"
                    aria-label={`${p.name} image placeholder`}
                  >
                    {/* TODO: add {p.key} image at /assets/electronics/{p.key}.png */}
                    IMAGE
                  </Box>
                )}
              </Box>

              {/* Text area */}
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", p: 1.25, gap: 0.5 }}>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 600,
                    fontSize: 14,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                  title={p.name}
                >
                  {p.name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", fontSize: 12.5, lineHeight: 1.3 }}
                >
                  {p.rewardText}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: "auto", color: "primary.main", fontWeight: 600, fontSize: 13, userSelect: "none" }}
                  aria-label={`View ${p.name}`}
                >
                  View →
                </Typography>
              </Box>
            </Card>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default ElectronicsSection;
