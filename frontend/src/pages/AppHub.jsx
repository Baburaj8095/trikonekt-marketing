import React from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
} from "@mui/material";

// ✅ Brand Logos (transparent)
const apps = [
  {
    name: "Amazon",
    appUrl: "amazon://",
    storeUrl:
      "https://play.google.com/store/apps/details?id=in.amazon.mShop.android.shopping",
    iosStoreUrl:
      "https://apps.apple.com/in/app/amazon-shopping/id297606951",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
    description: "Shop millions of products online",
  },
  {
    name: "Flipkart",
    appUrl: "flipkart://",
    storeUrl:
      "https://play.google.com/store/apps/details?id=com.flipkart.android",
    iosStoreUrl:
      "https://apps.apple.com/in/app/flipkart-online-shopping-app/id742044947",
    icon: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Flipkart_logo.png",
    description: "Big Billion Days & more offers",
  },
  {
    name: "Uber",
    appUrl: "uber://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.ubercab",
    iosStoreUrl: "https://apps.apple.com/in/app/uber/id368677368",
    icon: "https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.png",
    description: "Book rides & delivery services",
  },
  {
    name: "Ola",
    appUrl: "ola://",
    storeUrl:
      "https://play.google.com/store/apps/details?id=com.olacabs.customer",
    iosStoreUrl: "https://apps.apple.com/in/app/ola/id539179365",
    icon: "https://upload.wikimedia.org/wikipedia/commons/2/21/Ola_Cabs_logo.png",
    description: "Ride booking & mobility solutions",
  },
  {
    name: "OYO",
    appUrl: "oyo://",
    storeUrl:
      "https://play.google.com/store/apps/details?id=com.oyo.consumer",
    iosStoreUrl:
      "https://apps.apple.com/in/app/oyo-hotels-travel/id1331456899",
    icon: "https://upload.wikimedia.org/wikipedia/commons/5/55/OYO_Rooms_logo.png",
    description: "Book hotels & stays worldwide",
  },
];

export default function AppHub() {
  const handleAppClick = (app) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const appUrl = app.appUrl;
    const storeUrl = isIOS ? app.iosStoreUrl : app.storeUrl;

    const appWindow = window.open(appUrl, "_blank");
    setTimeout(() => {
      if (appWindow) appWindow.location.href = storeUrl;
    }, 1000);
  };

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 4 },
        py: { xs: 2, sm: 5 },
        maxWidth: 1200,
        mx: "auto",
      }}
    >
      <Typography
        variant="h4"
        sx={{
          mb: { xs: 2, sm: 3 },
          textAlign: "center",
          fontWeight: 600,
          fontSize: { xs: "1.8rem", sm: "2rem" },
        }}
      >
        App Hub
      </Typography>

      <Typography
        variant="body1"
        sx={{
          mb: { xs: 3, sm: 5 },
          textAlign: "center",
          color: "text.secondary",
          maxWidth: 600,
          mx: "auto",
          fontSize: { xs: "0.9rem", sm: "1rem" },
        }}
      >
        Access your favorite apps for shopping, travel, and rides — all in one
        place.
      </Typography>

      <Grid container spacing={{ xs: 2, sm: 3 }} justifyContent="center">
        {apps.map((app, index) => (
          <Grid
            item
            xs={12}
            sm={6}
            md={4}
            lg={3}
            key={index}
            sx={{ display: "flex" }}
          >
            <Card
              onClick={() => handleAppClick(app)}
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                p: { xs: 2, sm: 3 },
                borderRadius: 4,
                boxShadow: 3,
                backgroundColor: "background.paper",
                transition: "transform 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: { xs: "none", sm: "translateY(-6px)" },
                  boxShadow: 6,
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
              }}
            >
              {/* ✅ Wrapper for perfectly centered round logo */}
              <Box
                sx={{
                  width: { xs: 90, sm: 110 },
                  height: { xs: 90, sm: 110 },
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 2,
                  boxShadow: 3,
                  overflow: "hidden",
                  p: 1.5,
                }}
              >
                <CardMedia
                  component="img"
                  image={app.icon}
                  alt={app.name}
                  sx={{
                    width: "80%",
                    height: "80%",
                    objectFit: "contain",
                  }}
                />
              </Box>

              <CardContent sx={{ p: 0 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    fontSize: { xs: "1rem", sm: "1.1rem" },
                  }}
                >
                  {app.name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: { xs: "0.8rem", sm: "0.9rem" },
                    lineHeight: 1.4,
                  }}
                >
                  {app.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
