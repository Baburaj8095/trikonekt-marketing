import React from "react";
import {
  Box,
  Typography,
  Grid,
  IconButton,
  Tooltip,
} from "@mui/material";

const apps = [
  // 🛍️ Shopping
  {
    name: "Amazon",
    appUrl: "amazon://",
    storeUrl: "https://play.google.com/store/apps/details?id=in.amazon.mShop.android.shopping",
    iosStoreUrl: "https://apps.apple.com/in/app/amazon-shopping/id297606951",
    icon: "https://cdn.brandfetch.io/amazon.com/logo/icon.svg",
  },
  {
    name: "Flipkart",
    appUrl: "flipkart://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.flipkart.android",
    iosStoreUrl: "https://apps.apple.com/in/app/flipkart-online-shopping-app/id742044947",
    icon: "https://cdn.brandfetch.io/flipkart.com/logo/icon.svg",
  },
  {
    name: "Myntra",
    appUrl: "myntra://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.myntra.android",
    iosStoreUrl: "https://apps.apple.com/in/app/myntra-fashion-shopping-app/id907394059",
    icon: "https://cdn.brandfetch.io/myntra.com/logo/icon.svg",
  },
  {
    name: "Meesho",
    appUrl: "meesho://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.meesho.supply",
    iosStoreUrl: "https://apps.apple.com/in/app/meesho/id1457958492",
    icon: "https://cdn.brandfetch.io/meesho.com/logo/icon.svg",
  },
  {
    name: "OLX",
    appUrl: "olx://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.olx.southasia",
    iosStoreUrl: "https://apps.apple.com/in/app/olx-buy-sell-near-you/id913492792",
    icon: "https://cdn.brandfetch.io/olx.in/logo/icon.svg",
  },

  // 🚗 Travel & Mobility
  {
    name: "Ola",
    appUrl: "ola://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.olacabs.customer",
    iosStoreUrl: "https://apps.apple.com/in/app/ola/id539179365",
    icon: "https://cdn.brandfetch.io/olacabs.com/logo/icon.svg",
  },
  {
    name: "OYO",
    appUrl: "oyo://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.oyo.consumer",
    iosStoreUrl: "https://apps.apple.com/in/app/oyo-hotels-travel/id1331456899",
    icon: "https://cdn.brandfetch.io/oyorooms.com/logo/icon.svg",
  },
  {
    name: "MakeMyTrip",
    appUrl: "makemytrip://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.makemytrip",
    iosStoreUrl: "https://apps.apple.com/in/app/makemytrip/id530488389",
    icon: "https://cdn.brandfetch.io/makemytrip.com/logo/icon.svg",
  },

  // 💰 Finance
  {
    name: "PhonePe",
    appUrl: "phonepe://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.phonepe.app",
    iosStoreUrl: "https://apps.apple.com/in/app/phonepe/id1170055821",
    icon: "https://cdn.brandfetch.io/phonepe.com/logo/icon.svg",
  },
  {
    name: "Paytm",
    appUrl: "paytm://",
    storeUrl: "https://play.google.com/store/apps/details?id=net.one97.paytm",
    iosStoreUrl: "https://apps.apple.com/in/app/paytm-payments-bank-payments/id473941634",
    icon: "https://cdn.brandfetch.io/paytm.com/logo/icon.svg",
  },
  {
    name: "Google Pay",
    appUrl: "tez://",
    storeUrl: "https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user",
    iosStoreUrl: "https://apps.apple.com/in/app/google-pay-for-india-tez/id1193357041",
    icon: "https://cdn.brandfetch.io/google.com/pay/logo/icon.svg",
  },
];

export default function AppHub() {
  const handleAppClick = (app) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const storeUrl = isIOS ? app.iosStoreUrl : app.storeUrl;

    const appWindow = window.open(app.appUrl, "_blank");
    setTimeout(() => {
      if (appWindow) appWindow.location.href = storeUrl;
    }, 1000);
  };

  return (
    <Box sx={{ px: 2, py: 3, maxWidth: 700, mx: "auto" }}>
      <Typography
        variant="h5"
        sx={{
          mb: 2,
          textAlign: "center",
          fontWeight: 600,
          fontSize: { xs: "1.4rem", sm: "1.6rem" },
        }}
      >
        App Hub
      </Typography>

      <Typography
        variant="body2"
        sx={{
          mb: 3,
          textAlign: "center",
          color: "text.secondary",
          fontSize: { xs: "0.9rem", sm: "1rem" },
        }}
      >
        Access your favorite apps for shopping, travel, and payments.
      </Typography>

      <Grid container spacing={2} justifyContent="center">
        {apps.map((app, index) => (
          <Grid
            item
            xs={3.5}
            sm={2.4}
            key={index}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <Tooltip title={app.name} arrow>
              <IconButton
                onClick={() => handleAppClick(app)}
                sx={{
                  width: 65,
                  height: 65,
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  boxShadow: 3,
                  p: 1.5,
                  transition: "transform 0.2s",
                  "&:hover": { transform: "scale(1.05)" },
                }}
              >
                <Box
                  component="img"
                  src={app.icon}
                  alt={app.name}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                  onError={(e) => {
                    e.target.src = "https://cdn-icons-png.flaticon.com/512/5968/5968705.png"; // fallback icon
                  }}
                />
              </IconButton>
            </Tooltip>
            <Typography
              variant="caption"
              sx={{
                mt: 1,
                color: "text.primary",
                fontWeight: 500,
                fontSize: { xs: "0.75rem", sm: "0.8rem" },
              }}
            >
              {app.name}
            </Typography>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
