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
    <Box sx={{ backgroundColor: "#FAFAFA", minHeight: "100vh", pb: "calc(96px + env(safe-area-inset-bottom))" }}>
      {/* ================= HEADER ================= */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ backgroundColor: "#ffffff", color: "#111", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        <Toolbar sx={{ minHeight: 56, px: 1.5 }}>
          <Typography sx={{ fontWeight: 700, flexGrow: 1 }}>
            TRIKONEKT
          </Typography>
          <IconButton>
            <AccountCircleIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Toolbar sx={{ minHeight: 56 }} />

      {/* ================= HERO ================= */}
      <Container sx={{ mt: 2 }}>
        <Box
          sx={{
            background: "linear-gradient(180deg, #FFE8D6 0%, #FFF3E6 100%)",
            borderRadius: "12px",
            p: 2,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
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

        <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 1, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
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
                width: 240,
                height: 180,
                borderRadius: "12px",
                backgroundColor: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                scrollSnapAlign: "start"
              }}
            >
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 0.5, minHeight: 140, pb: "16px !important" }}>
                <Box sx={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: i === 0 ? "#FF8A00" : i === 1 ? "#2F80ED" : "#27AE60", color: "#fff", mb: 1 }}>
                  {item.icon}
                </Box>
                <Typography fontWeight={600} mt={0.5}>
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
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
              }}
            >
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Box sx={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: i === 0 ? "#FF8A00" : i === 1 ? "#2F80ED" : "#27AE60", color: "#fff" }}>
                  {item.icon}
                </Box>
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

        <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 1, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
          {[
            { title: "PRIME", price: "₹150", cta: "Join Prime" },
            { title: "PROMO", price: "₹750", cta: "Join Promo" },
            { title: "MONTHLY", price: "₹759", cta: "Subscribe" }
          ].map((pkg, i) => (
            <Card
              key={i}
              sx={{
                width: 240,
                height: 200,
                borderRadius: "12px",
                position: "relative",
                backgroundColor: i === 0 ? "#FFE8D6" : i === 1 ? "#E6F2FF" : "#E9F7EF",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                scrollSnapAlign: "start",
                display: "flex"
              }}
            >
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
                {i === 1 && (
                  <Box sx={{ position: "absolute", top: 8, right: 8, backgroundColor: "#2F80ED", color: "#fff", fontSize: 12, px: 1, py: 0.5, borderRadius: "12px" }}>
                    Most Popular
                  </Box>
                )}
                <Typography fontWeight={700}>{pkg.title}</Typography>
                <Typography mb={2}>{pkg.price}</Typography>
                <Button
                  fullWidth
                  variant="contained"
                  sx={{
                    background:
                      "linear-gradient(90deg,#18B0C9,#2ECC71)",
                    borderRadius: "8px",
                    mt: "auto"
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
          About | Support | Terms | Privacy
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
          backgroundColor: "#ffffff",
          borderTop: "1px solid #eee",
          zIndex: 1100
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
