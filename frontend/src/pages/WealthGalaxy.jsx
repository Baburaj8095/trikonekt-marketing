import React from "react";
import {
  Box,
  Typography,
  Grid,
} from "@mui/material";
import APP_STORE from "../assets/app-store.png";
import GOOGLE_STORE from "../assets/google-play-store.png";
import PLAY_STORE_SCREEN from "../assets/play_store_screen.webp";

export default function WealthGalaxy() {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" sx={{ mb: { xs: 2, sm: 3 }, textAlign: 'center', fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
        Download Our My Wealth Galaxy Customer App Now
      </Typography>
      <Grid container spacing={{ xs: 3, md: 4 }} sx={{ mx: { xs: -2, sm: 0 } }}>
        <Grid item xs={12} md={6}>
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: { xs: 'auto', md: '100%' },
            mb: { xs: 2, md: 0 }
          }}>
            <Box
              component="img"
              src={PLAY_STORE_SCREEN}
              alt="Wealth Galaxy App Screen"
              sx={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 2,
                boxShadow: 2,
                maxHeight: { xs: 300, sm: 400, md: 'none' }
              }}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="body1" sx={{ mb: 2, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
            Download our app for the fastest, most convenient way to send Recharge.
          </Typography>
          <Typography variant="h6" sx={{ mb: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
            Customer App Features:
          </Typography>
          <Box component="ul" sx={{ pl: { xs: 2, sm: 3 }, mb: 3, fontSize: { xs: '0.85rem', sm: '1rem' } }}>
            <li>Recharges</li>
            <li>DTH Bills</li>
            <li>Utility Bills</li>
            <li>Nearest Merchants</li>
            <li>Make payment to the merchants</li>
            <li>Rewards</li>
            <li>Knowledge Galaxy</li>
            <li>Refer & Earn</li>
          </Box>
          <Grid container spacing={{ xs: 2, sm: 2 }} sx={{ mx: { xs: -2, sm: 0 } }}>
            <Grid item xs={12} sm={6}>
              <Box
                component="img"
                src={APP_STORE}
                alt="App Store"
                sx={{
                  width: '100%',
                  cursor: 'pointer',
                  borderRadius: 1,
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: { xs: 'none', sm: 'scale(1.05)' },
                  },
                  '&:active': {
                    transform: { xs: 'scale(0.98)', sm: 'scale(1.05)' },
                  },
                }}
                onClick={() => window.open('https://apps.apple.com/in/app/my-wealth-galaxy/id6473733826', '_blank')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box
                component="img"
                src={GOOGLE_STORE}
                alt="Google Play Store"
                sx={{
                  width: '100%',
                  cursor: 'pointer',
                  borderRadius: 1,
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: { xs: 'none', sm: 'scale(1.05)' },
                  },
                  '&:active': {
                    transform: { xs: 'scale(0.98)', sm: 'scale(1.05)' },
                  },
                }}
                onClick={() => window.open('https://play.google.com/store/apps/details?id=com.mywealth.galaxy', '_blank')}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
