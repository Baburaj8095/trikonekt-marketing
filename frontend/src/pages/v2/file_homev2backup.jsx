import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Container,
  Button,
  Card,
  CardContent,
  Stack,
  BottomNavigation,
  BottomNavigationAction,
  Divider
} from "@mui/material";

import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import HomeIcon from "@mui/icons-material/Home";
import StoreIcon from "@mui/icons-material/Store";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PersonIcon from "@mui/icons-material/Person";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import ShareIcon from "@mui/icons-material/Share";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import LocalMallIcon from "@mui/icons-material/LocalMall";
import PaymentsIcon from "@mui/icons-material/Payments";
import WorkIcon from "@mui/icons-material/Work";

export default function HomeV2() {
  return (
    <Box sx={{ backgroundColor: "#FFF5E9", minHeight: "100vh", pb: "96px" }}>
      {/* ================= HEADER ================= */}
      <AppBar
        position="fixed"
        elevation={1}
        sx={{ backgroundColor: "#ffffff", color: "#111" }}
      >
        <Toolbar>
          <Typography sx={{ fontWeight: 700, flexGrow: 1 }}>
            TRIKONEKT
          </Typography>
          <IconButton>
            <AccountCircleIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Toolbar />

      {/* ================= HERO ================= */}
      <Container sx={{ mt: 2 }}>
        <Box
          sx={{
            backgroundColor: "#FFE8CF",
            borderRadius: "14px",
            p: 3,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)"
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            Turn Everyday Spending Into Earnings
          </Typography>
          <Typography sx={{ color: "#666", mt: 1 }}>
            Shop · Connect · Earn · Grow
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button
              variant="contained"
              sx={{
                background:
                  "linear-gradient(90deg,#18B0C9,#2ECC71)",
                borderRadius: "8px",
                px: 3
              }}
            >
              Get Started
            </Button>
            <Button
              variant="outlined"
              sx={{
                borderRadius: "8px",
                borderColor: "#FFA726",
                color: "#FF7A00"
              }}
            >
              How it Works
            </Button>
          </Stack>
        </Box>
      </Container>

      {/* ================= HOW IT WORKS ================= */}
      <Container sx={{ mt: 4 }}>
        <Typography fontWeight={700} mb={2}>
          How It Works
        </Typography>

        <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 1 }}>
          {[
            {
              icon: <ShoppingCartIcon />,
              title: "Spend",
              desc: "Shop products and services you already need"
            },
            {
              icon: <ShareIcon />,
              title: "Connect",
              desc: "Join a trusted business network"
            },
            {
              icon: <CurrencyRupeeIcon />,
              title: "Earn",
              desc: "Get rewards & income"
            }
          ].map((item, i) => (
            <Card
              key={i}
              sx={{
                minWidth: 220,
                borderRadius: "12px",
                boxShadow: "0 6px 16px rgba(0,0,0,0.08)"
              }}
            >
              <CardContent>
                {item.icon}
                <Typography fontWeight={600} mt={1}>
                  {item.title}
                </Typography>
                <Typography color="text.secondary" fontSize={14}>
                  {item.desc}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      {/* ================= WHAT YOU CAN DO ================= */}
      <Container sx={{ mt: 4 }}>
        <Typography fontWeight={700} mb={2}>
          What You Can Do
        </Typography>

        <Stack spacing={2}>
          {[
            {
              icon: <LocalMallIcon />,
              title: "Shopping",
              desc: "Deals & rewards"
            },
            {
              icon: <PaymentsIcon />,
              title: "Payments",
              desc: "Tri Pay & Wallet"
            },
            {
              icon: <WorkIcon />,
              title: "Business",
              desc: "Agencies & jobs"
            }
          ].map((item, i) => (
            <Card
              key={i}
              sx={{
                borderRadius: "10px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)"
              }}
            >
              <CardContent sx={{ display: "flex", gap: 2 }}>
                {item.icon}
                <Box>
                  <Typography fontWeight={600}>{item.title}</Typography>
                  <Typography color="text.secondary" fontSize={14}>
                    {item.desc}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Container>

      {/* ================= PACKAGES ================= */}
      <Container sx={{ mt: 5 }}>
        <Typography fontWeight={700} mb={2}>
          Popular Packages
        </Typography>

        <Box sx={{ display: "flex", gap: 2, overflowX: "auto" }}>
          {[
            { title: "PRIME", price: "₹150", cta: "Join Prime" },
            { title: "PROMO", price: "₹750", cta: "Join Promo" },
            { title: "MONTHLY", price: "₹759", cta: "Subscribe" }
          ].map((pkg, i) => (
            <Card
              key={i}
              sx={{
                minWidth: 220,
                borderRadius: "12px",
                backgroundColor: i === 1 ? "#E3F2FD" : "#FFF",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)"
              }}
            >
              <CardContent>
                <Typography fontWeight={700}>{pkg.title}</Typography>
                <Typography mb={2}>{pkg.price}</Typography>
                <Button
                  fullWidth
                  variant="contained"
                  sx={{
                    background:
                      "linear-gradient(90deg,#18B0C9,#2ECC71)",
                    borderRadius: "8px"
                  }}
                >
                  {pkg.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      {/* ================= FOOTER ================= */}
      <Container sx={{ mt: 6, textAlign: "center" }}>
        <Divider sx={{ mb: 2 }} />
        <Typography fontWeight={700}>TRIKONEKT</Typography>
        <Typography fontSize={14} color="text.secondary">
          About · Support · Terms · Privacy
        </Typography>
        <Typography fontSize={12} color="text.secondary" mt={1}>
          © 2025 TRIKONEKT
        </Typography>
      </Container>

      {/* ================= BOTTOM NAV ================= */}
      <BottomNavigation
        showLabels
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: "1px solid #eee"
        }}
      >
        <BottomNavigationAction label="Home" icon={<HomeIcon />} />
        <BottomNavigationAction label="Store" icon={<StoreIcon />} />
        <BottomNavigationAction label="Wallet" icon={<AccountBalanceWalletIcon />} />
        <BottomNavigationAction label="Profile" icon={<PersonIcon />} />
      </BottomNavigation>
    </Box>
  );
}
