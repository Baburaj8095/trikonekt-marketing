import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import MyLocationOutlinedIcon from "@mui/icons-material/MyLocationOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import TempleBuddhistOutlinedIcon from "@mui/icons-material/TempleBuddhistOutlined";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import LandscapeOutlinedIcon from "@mui/icons-material/LandscapeOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import LocationCityRoundedIcon from "@mui/icons-material/LocationCityRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import AddShoppingCartRoundedIcon from "@mui/icons-material/AddShoppingCartRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

const UI = {
  bg: "#dbe8fb",
  surface: "#ffffff",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#1f2937",
  textMuted: "#6b7280",
  primary: "#0F52BA",
  secondary: "#2f6fd0",
  onPrimary: "#ffffff",
  headerGradient: "linear-gradient(180deg, #0F52BA 0%, #2f6fd0 100%)",
};

const QUICK_LOCATIONS = [
  {
    id: "nearby",
    title: "Nearby",
    icon: PlaceOutlinedIcon,
    bg: "linear-gradient(135deg, #e9f1ff 0%, #cfdfff 100%)",
    fg: "#0F52BA",
  },
  {
    id: "karnataka",
    title: "Karnataka",
    icon: TempleBuddhistOutlinedIcon,
    bg: "linear-gradient(135deg, #bad4ff 0%, #8db6f5 100%)",
    fg: "#143f77",
  },
  {
    id: "maharashtra",
    title: "Maharashtra",
    icon: ApartmentRoundedIcon,
    bg: "linear-gradient(135deg, #d6e5ff 0%, #a8c6f7 100%)",
    fg: "#173c76",
  },
  {
    id: "tamilnadu",
    title: "Tamil Nadu",
    icon: LandscapeOutlinedIcon,
    bg: "linear-gradient(135deg, #c8dcff 0%, #8db6f5 100%)",
    fg: "#173c76",
  },
  {
    id: "allstates",
    title: "All States",
    icon: PublicOutlinedIcon,
    bg: "linear-gradient(135deg, #dce9ff 0%, #b7cdf4 100%)",
    fg: "#173c76",
  },
];

const POPULAR_CITIES = [
  "Mumbai",
  "Delhi-NCR",
  "Bengaluru",
  "Hyderabad",
  "Chandigarh",
  "Ahmedabad",
  "Pune",
  "Chennai",
  "Kolkata",
  "Kochi",
];

const SHOPS = [
  { id: 1, name: "Profile Name of the Shop", place: "Bangalore, Karnataka" },
  { id: 2, name: "Near by Fashion Store", place: "Pune, Maharashtra" },
  { id: 3, name: "Prime Appliance House", place: "Chennai, Tamil Nadu" },
  { id: 4, name: "Mechanical Works Yard", place: "Tirupati, Andhra Pradesh" },
];

const CATEGORIES = [
  "Watch & Earn Ads",
  "Fashion",
  "Furniture",
  "Home Appliances",
  "Mechanical",
];

const ADS = [
  { id: 1, title: "Watch & Earn", caption: "Watch short brand ads and unlock reward points." },
  { id: 2, title: "Banner Ad", caption: "Fashion offers and nearby deals for your selected area." },
  { id: 3, title: "Banner Ad", caption: "Furniture and appliance launches from local businesses." },
];

const PRODUCTS = [
  { id: 1, name: "Home Office Chair", mrp: "Rs. 12,499", price: "Rs. 9,999", discount: "20% OFF" },
  { id: 2, name: "Smart Watch Pro", mrp: "Rs. 6,799", price: "Rs. 4,999", discount: "26% OFF" },
  { id: 3, name: "Mixer Grinder", mrp: "Rs. 3,950", price: "Rs. 2,899", discount: "27% OFF" },
  { id: 4, name: "Industrial Tool Kit", mrp: "Rs. 8,400", price: "Rs. 6,299", discount: "25% OFF" },
];

const FOOTER_ITEMS = [
  { id: "home-top", label: "Home", icon: HomeOutlinedIcon },
  { id: "product-section", label: "Online", icon: LanguageOutlinedIcon },
  { id: "scanner-section", label: "Scanner", icon: QrCodeScannerRoundedIcon },
  { id: "tri-zone-section", label: "Tri Zone", icon: GridViewRoundedIcon },
  { id: "tri-gift-section", label: "Tri Gift", icon: CardGiftcardRoundedIcon },
];

const DRAWER_ITEMS = [
  { label: "Wallet", action: "wallet", icon: AccountBalanceWalletOutlinedIcon },
  { label: "Business / Shop", action: "business-shops", icon: ApartmentRoundedIcon },
  { label: "Products", action: "product-section", icon: LanguageOutlinedIcon },
  { label: "Scanner", action: "scanner-section", icon: QrCodeScannerRoundedIcon },
];

function sectionCardStyles() {
  return {
    borderRadius: 3,
    bgcolor: UI.surface,
    border: `1px solid ${UI.border}`,
    boxShadow: "none",
    width: "100%",
    minWidth: 0,
  };
}

function SectionShell({ title, subtitle, action, children }) {
  return (
    <Card sx={sectionCardStyles()}>
      <CardContent sx={{ p: { xs: 1.75, sm: 2.25 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={0.8}
          sx={{ mb: 1.6 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: UI.text }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography sx={{ fontSize: 11.5, color: UI.textMuted, mt: 0.45, lineHeight: 1.45 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {action || null}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function ScrollRow({ children, gap = 1.25, pb = 0.5 }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap,
        overflowX: "auto",
        overflowY: "hidden",
        width: "100%",
        pb,
        scrollBehavior: "smooth",
        scrollSnapType: "x proximity",
        "&::-webkit-scrollbar": { height: 4 },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: alpha(UI.primary, 0.22),
          borderRadius: 999,
        },
      }}
    >
      {children}
    </Box>
  );
}

function HeaderActionButton({ children, onClick, ariaLabel }) {
  return (
    <IconButton
      aria-label={ariaLabel}
      onClick={onClick}
      sx={{
        width: 36,
        height: 36,
        borderRadius: 2,
        border: `1px solid ${alpha("#ffffff", 0.2)}`,
        bgcolor: alpha("#ffffff", 0.14),
        color: "#ffffff",
        flexShrink: 0,
      }}
    >
      {children}
    </IconButton>
  );
}

function PlaceholderImage({ label, minHeight = 104 }) {
  return (
    <Box
      sx={{
        width: "100%",
        minHeight,
        borderRadius: 2,
        border: `1px dashed ${alpha(UI.primary, 0.32)}`,
        bgcolor: alpha(UI.primary, 0.05),
        display: "grid",
        placeItems: "center",
        color: UI.textMuted,
        fontSize: 11.5,
        fontWeight: 700,
        textAlign: "center",
        px: 1,
      }}
    >
      {label}
    </Box>
  );
}

function SearchBarCard({ onSearchClick, onJoinPrimeClick }) {
  return (
    <Card sx={{ ...sectionCardStyles(), borderRadius: 999 }}>
      <CardContent sx={{ p: 0.75 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Button
            fullWidth
            onClick={onSearchClick}
            sx={{
              justifyContent: "flex-start",
              textTransform: "none",
              borderRadius: 999,
              minHeight: 44,
              px: 1.1,
              color: UI.text,
              minWidth: 0,
            }}
          >
            <Stack direction="row" spacing={0.95} alignItems="center" sx={{ minWidth: 0 }}>
              <SearchRoundedIcon sx={{ color: UI.textMuted, fontSize: 20 }} />
              <Typography
                sx={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: UI.textMuted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Search for your city
              </Typography>
            </Stack>
          </Button>
          <Button
            variant="contained"
            onClick={onJoinPrimeClick}
            sx={{
              flexShrink: 0,
              borderRadius: 999,
              px: { xs: 1.3, sm: 1.8 },
              py: 1.05,
              minWidth: { xs: 92, sm: 108 },
              textTransform: "none",
              fontWeight: 800,
              fontSize: 12.5,
              bgcolor: UI.primary,
              color: UI.onPrimary,
              boxShadow: "0 8px 18px rgba(15,82,186,0.22)",
              "&:hover": { bgcolor: UI.secondary, boxShadow: "0 8px 18px rgba(15,82,186,0.22)" },
            }}
          >
            Join Prime
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function QuickLocationCard({ item }) {
  const Icon = item.icon;

  return (
    <Box sx={{ width: 76, minWidth: 76, flexShrink: 0, textAlign: "center", scrollSnapAlign: "start" }}>
      <Box
        sx={{
          width: 60,
          height: 60,
          mx: "auto",
          borderRadius: "50%",
          background: item.bg,
          color: item.fg,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 8px 20px rgba(15,82,186,0.10)",
          border: `1px solid ${alpha(UI.primary, 0.12)}`,
        }}
      >
        <Icon sx={{ fontSize: 26 }} />
      </Box>
      <Typography
        sx={{
          mt: 0.85,
          fontSize: 10.5,
          fontWeight: 700,
          color: UI.text,
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {item.title}
      </Typography>
    </Box>
  );
}

function SearchCityModal({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Box sx={{ minHeight: "100vh", bgcolor: UI.surface, overflowX: "hidden" }}>
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            bgcolor: UI.surface,
            borderBottom: `1px solid ${UI.border}`,
            px: 2,
            py: 1.6,
          }}
        >
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Card sx={{ ...sectionCardStyles(), borderRadius: 999, flex: 1, boxShadow: "0 6px 20px rgba(17,24,39,0.06)" }}>
                <CardContent sx={{ px: 1.25, py: 0.95 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SearchRoundedIcon sx={{ color: UI.textMuted, fontSize: 20 }} />
                    <Typography sx={{ color: UI.textMuted, fontSize: 13, fontWeight: 600 }}>
                      Search for your city
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
              <IconButton onClick={onClose} sx={{ color: UI.text }}>
                <CloseRoundedIcon />
              </IconButton>
            </Stack>

            <Button
              sx={{
                justifyContent: "flex-start",
                textTransform: "none",
                color: UI.primary,
                fontWeight: 800,
                px: 0.5,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <MyLocationOutlinedIcon sx={{ fontSize: 20 }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: UI.primary }}>
                  Detect my location
                </Typography>
              </Stack>
            </Button>
          </Stack>
        </Box>

        <Box sx={{ px: 2, py: 2 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: UI.text, mb: 1.8 }}>
            Popular Cities
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1.5,
              width: "100%",
            }}
          >
            {POPULAR_CITIES.map((city, index) => (
              <Stack key={city} spacing={0.7} alignItems="center" sx={{ minWidth: 0 }}>
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: index % 2 === 0 ? alpha(UI.primary, 0.12) : alpha(UI.secondary, 0.12),
                    color: UI.primary,
                    border: `1px solid ${alpha(UI.primary, 0.1)}`,
                  }}
                >
                  <LocationCityRoundedIcon sx={{ fontSize: 24 }} />
                </Avatar>
                <Typography
                  sx={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: UI.text,
                    textAlign: "center",
                    lineHeight: 1.2,
                    wordBreak: "break-word",
                  }}
                >
                  {city}
                </Typography>
              </Stack>
            ))}
          </Box>

          <Button
            fullWidth
            variant="outlined"
            sx={{
              mt: 2.5,
              borderRadius: 2.5,
              py: 1.2,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 12.5,
              borderColor: alpha(UI.text, 0.22),
              color: UI.text,
            }}
          >
            View All Cities
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

function ShopCard({ shop }) {
  return (
    <Card
      sx={{
        ...sectionCardStyles(),
        minWidth: { xs: "76vw", sm: 250 },
        width: { xs: "76vw", sm: 250 },
        maxWidth: 250,
        flexShrink: 0,
        scrollSnapAlign: "start",
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Stack spacing={1.15}>
          <PlaceholderImage label="Shop Image Placeholder" minHeight={118} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: UI.text, lineHeight: 1.3 }}>
              {shop.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: UI.textMuted, mt: 0.35, lineHeight: 1.35 }}>
              {shop.place}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.9}>
            <Button
              fullWidth
              variant="contained"
              sx={{
                borderRadius: 1.8,
                textTransform: "none",
                fontWeight: 700,
                fontSize: 11.5,
                bgcolor: UI.primary,
                color: UI.onPrimary,
                boxShadow: "none",
                "&:hover": { bgcolor: UI.secondary, boxShadow: "none" },
              }}
            >
              Follow
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FlagOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: 1.8,
                textTransform: "none",
                fontWeight: 700,
                fontSize: 11.5,
                borderColor: UI.border,
                color: UI.text,
                minWidth: 0,
                px: 1,
              }}
            >
              Report
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function CategoryCard({ title }) {
  return (
    <Card
      sx={{
        ...sectionCardStyles(),
        minWidth: 126,
        width: 126,
        flexShrink: 0,
        scrollSnapAlign: "start",
      }}
    >
      <CardContent sx={{ p: 1.5 }}>
        <Stack spacing={1}>
          <PlaceholderImage label="Category Image" minHeight={76} />
          <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: UI.text, lineHeight: 1.25 }}>
            {title}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AdBannerCard({ item }) {
  return (
    <Card
      sx={{
        ...sectionCardStyles(),
        minWidth: { xs: "86vw", sm: 320 },
        width: { xs: "86vw", sm: 320 },
        maxWidth: 320,
        flexShrink: 0,
        scrollSnapAlign: "start",
        bgcolor: alpha(UI.primary, 0.08),
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: 1.6 }}>
        <Stack spacing={1.15}>
          <PlaceholderImage label="Ads Banner Placeholder" minHeight={132} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: UI.text, lineHeight: 1.3 }}>
              {item.title}
            </Typography>
            <Typography sx={{ fontSize: 11, color: UI.textMuted, lineHeight: 1.5, mt: 0.35 }}>
              {item.caption}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PlayCircleOutlineRoundedIcon sx={{ fontSize: 17 }} />}
            sx={{
              alignSelf: "flex-start",
              borderRadius: 1.8,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 11.5,
              bgcolor: UI.primary,
              color: UI.onPrimary,
              boxShadow: "none",
              "&:hover": { bgcolor: UI.secondary, boxShadow: "none" },
            }}
          >
            Watch & Earn Ads
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ProductCard({ product }) {
  return (
    <Card sx={{ ...sectionCardStyles(), height: "100%" }}>
      <CardContent sx={{ p: 1.5 }}>
        <Stack spacing={1.15} height="100%">
          <PlaceholderImage label="Product Image" minHeight={118} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: UI.text, lineHeight: 1.3 }}>
              {product.name}
            </Typography>
            <Typography
              sx={{
                fontSize: 10.5,
                color: UI.textMuted,
                textDecoration: "line-through",
                mt: 0.5,
              }}
            >
              {product.mrp}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.45, flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: UI.primary }}>
                {product.price}
              </Typography>
              <Box
                sx={{
                  height: 20,
                  px: 0.8,
                  borderRadius: 999,
                  bgcolor: alpha(UI.primary, 0.12),
                  color: UI.primary,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {product.discount}
              </Box>
            </Stack>
          </Box>
          <Stack direction="row" spacing={0.8} sx={{ mt: "auto" }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddShoppingCartRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: 1.8,
                textTransform: "none",
                fontWeight: 700,
                fontSize: 11,
                bgcolor: UI.primary,
                color: UI.onPrimary,
                boxShadow: "none",
                minWidth: 0,
                px: 0.8,
                "&:hover": { bgcolor: UI.secondary, boxShadow: "none" },
              }}
            >
              Add
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FavoriteBorderRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: 1.8,
                textTransform: "none",
                fontWeight: 700,
                fontSize: 11,
                borderColor: UI.border,
                color: UI.text,
                minWidth: 0,
                px: 0.8,
              }}
            >
              Wish
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function QuickAccessCard({ title, description, buttonLabel }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${UI.border}`,
        boxShadow: "none",
        bgcolor: alpha(UI.primary, 0.05),
      }}
    >
      <CardContent sx={{ p: 1.8 }}>
        <Stack spacing={1}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: UI.text }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 11, color: UI.textMuted, lineHeight: 1.55 }}>
            {description}
          </Typography>
          <Button
            variant="contained"
            sx={{
              alignSelf: "flex-start",
              textTransform: "none",
              fontWeight: 700,
              fontSize: 11.5,
              borderRadius: 1.8,
              bgcolor: UI.primary,
              color: UI.onPrimary,
              boxShadow: "none",
              "&:hover": { bgcolor: UI.secondary, boxShadow: "none" },
            }}
          >
            {buttonLabel}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AppDrawer({ open, onClose, onAction }) {
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: "78vw",
          maxWidth: 300,
          bgcolor: UI.surface,
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
          overflowX: "hidden",
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", px: 2, py: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 900, color: UI.text }}>
            Menu
          </Typography>
          <IconButton onClick={onClose} sx={{ color: UI.text }}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Card
          sx={{
            borderRadius: 3,
            bgcolor: alpha(UI.primary, 0.08),
            border: `1px solid ${alpha(UI.primary, 0.14)}`,
            boxShadow: "none",
          }}
        >
          <CardContent sx={{ p: 1.6 }}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: UI.primary,
                  color: UI.onPrimary,
                  fontWeight: 800,
                }}
              >
                PJ
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: UI.text }}>
                  Prakash J
                </Typography>
                <Typography sx={{ fontSize: 11, color: UI.textMuted }}>
                  Master Franchise
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ ...sectionCardStyles(), mt: 1.5 }}>
          <CardContent sx={{ p: 1.2 }}>
            <Button
              fullWidth
              onClick={() => onAction("wallet")}
              sx={{
                justifyContent: "space-between",
                textTransform: "none",
                color: UI.text,
                borderRadius: 2,
                px: 1,
                py: 1,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <AccountBalanceWalletOutlinedIcon sx={{ color: UI.primary, fontSize: 20 }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: UI.text }}>
                  Wallet
                </Typography>
              </Stack>
              <ArrowForwardIosRoundedIcon sx={{ fontSize: 14, color: UI.textMuted }} />
            </Button>
          </CardContent>
        </Card>

        <Stack spacing={0.6} sx={{ mt: 1.5 }}>
          {DRAWER_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <Button
                key={item.label}
                onClick={() => onAction(item.action)}
                sx={{
                  justifyContent: "space-between",
                  textTransform: "none",
                  color: UI.text,
                  borderRadius: 2.2,
                  px: 1.2,
                  py: 1,
                  bgcolor: alpha(UI.primary, 0.04),
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Icon sx={{ color: UI.primary, fontSize: 20 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: UI.text }}>
                    {item.label}
                  </Typography>
                </Stack>
                <ArrowForwardIosRoundedIcon sx={{ fontSize: 14, color: UI.textMuted }} />
              </Button>
            );
          })}
        </Stack>

        <Box sx={{ mt: "auto", pt: 2 }}>
          <Divider sx={{ mb: 1.2 }} />
          <Button
            fullWidth
            variant="outlined"
            onClick={onClose}
            sx={{
              borderRadius: 2.2,
              py: 1.1,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 12.5,
              borderColor: alpha(UI.text, 0.18),
              color: UI.text,
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

function MobileFooterNav({ activeItem, onNavigate }) {
  return (
    <Box
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        display: { xs: "block", md: "none" },
        px: 0.8,
        pb: 0.8,
      }}
    >
      <Card
        sx={{
          borderRadius: 4,
          border: `1px solid ${alpha(UI.primary, 0.14)}`,
          bgcolor: alpha(UI.surface, 0.98),
          backdropFilter: "blur(10px)",
          boxShadow: "0 -8px 30px rgba(15,82,186,0.12)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            p: 0.55,
          }}
        >
          {FOOTER_ITEMS.map((item) => {
            const Icon = item.icon;
            const selected = activeItem === item.id;

            return (
              <Button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                sx={{
                  minWidth: 0,
                  px: 0.2,
                  py: 0.75,
                  borderRadius: 2,
                  textTransform: "none",
                  color: selected ? UI.primary : UI.textMuted,
                  bgcolor: selected ? alpha(UI.primary, 0.1) : "transparent",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.25,
                  lineHeight: 1.05,
                }}
              >
                <Icon sx={{ fontSize: 19 }} />
                <Typography
                  sx={{
                    fontSize: 8.8,
                    fontWeight: selected ? 800 : 700,
                    textAlign: "center",
                    color: "inherit",
                  }}
                >
                  {item.label}
                </Typography>
              </Button>
            );
          })}
        </Box>
      </Card>
    </Box>
  );
}

function BusinessDashboard() {
  const navigate = useNavigate();
  const [activeFooterItem, setActiveFooterItem] = useState("home-top");
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const joinPrimePath = "/demo/join-prime";

  const handleScrollTo = (targetId) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleFooterNavigate = (targetId) => {
    if (targetId === "scanner-section") {
      navigate("/demo/scanner");
      return;
    }
    setActiveFooterItem(targetId);
    handleScrollTo(targetId);
  };

  const handleDrawerAction = (action) => {
    setDrawerOpen(false);
    if (action === "wallet") {
      navigate("/user/franchise-wallet");
      return;
    }
    if (action === "scanner-section") {
      navigate("/demo/scanner");
      return;
    }
    handleScrollTo(action);
  };

  return (
    <Box sx={{ minHeight: "100vh", width: "100%", bgcolor: UI.bg, overflowX: "hidden" }}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          background: UI.headerGradient,
          color: "#ffffff",
          boxShadow: "0 10px 28px rgba(15,82,186,0.18)",
        }}
      >
        <Box sx={{ width: "100%", px: { xs: 1.5, sm: 2.25 }, py: 1.3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
              <IconButton
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  color: "#ffffff",
                  bgcolor: alpha("#ffffff", 0.14),
                  flexShrink: 0,
                }}
              >
                <MenuRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
              <Typography
                sx={{
                  fontSize: { xs: 16, sm: 18 },
                  fontWeight: 900,
                  color: "#ffffff",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Business Dashboard
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
              <HeaderActionButton ariaLabel="Notifications">
                <NotificationsNoneRoundedIcon sx={{ fontSize: 18 }} />
              </HeaderActionButton>
              <HeaderActionButton
                ariaLabel="Wallet"
                onClick={() => navigate("/user/franchise-wallet")}
              >
                <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18 }} />
              </HeaderActionButton>
              <HeaderActionButton ariaLabel="Location">
                <LocationOnOutlinedIcon sx={{ fontSize: 18 }} />
              </HeaderActionButton>
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          width: "100%",
          maxWidth: 640,
          mx: "auto",
          px: { xs: 1.5, sm: 2.25 },
          pt: { xs: 9.5, sm: 10 },
          pb: { xs: 11, md: 3 },
          overflowX: "hidden",
        }}
      >
        <Stack spacing={1.8}>
          <Box id="home-top">
            <SectionShell title="Search & Location" subtitle="Search-driven city selection with quick location access">
              <Stack spacing={1.5}>
                <SearchBarCard
                  onSearchClick={() => setSearchModalOpen(true)}
                  onJoinPrimeClick={() => navigate(joinPrimePath)}
                />

                <ScrollRow gap={1.1} pb={0.2}>
                  {QUICK_LOCATIONS.map((item) => (
                    <QuickLocationCard key={item.id} item={item} />
                  ))}
                </ScrollRow>
              </Stack>
            </SectionShell>
          </Box>

          <Box id="business-shops">
            <SectionShell
              title="Business / Shop"
              subtitle="Nearby business listings with follow and report actions"
            >
              <ScrollRow>
                {SHOPS.map((shop) => (
                  <ShopCard key={shop.id} shop={shop} />
                ))}
              </ScrollRow>
            </SectionShell>
          </Box>

          <Box id="categories-section">
            <SectionShell
              title="Categories"
              subtitle="Horizontal category strip from the sketch"
            >
              <ScrollRow>
                {CATEGORIES.map((category) => (
                  <CategoryCard key={category} title={category} />
                ))}
              </ScrollRow>
            </SectionShell>
          </Box>

          <Box id="ads-section">
            <ScrollRow gap={1.2}>
              {ADS.map((item) => (
                <AdBannerCard key={item.id} item={item} />
              ))}
            </ScrollRow>
          </Box>

          <Box id="product-section">
            <SectionShell
              title="Deals for You"
              subtitle="Discounted products picked for your account"
              action={
                <Button
                  variant="outlined"
                  sx={{
                    borderRadius: 999,
                    textTransform: "none",
                    fontWeight: 800,
                    fontSize: 11,
                    px: 1.4,
                    py: 0.6,
                    borderColor: alpha(UI.primary, 0.28),
                    color: UI.primary,
                    flexShrink: 0,
                  }}
                >
                  Tri Sarathi Delivery
                </Button>
              }
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 1.2,
                  width: "100%",
                }}
              >
                {PRODUCTS.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </Box>
            </SectionShell>
          </Box>

          <Box id="scanner-section">
            <SectionShell
              title="Scanner"
              subtitle="Quick access area from the mobile footer"
            >
              <QuickAccessCard
                title="Scanner Access"
                description="Use this area as the landing point for scanner-related actions from the footer."
                buttonLabel="Open Scanner"
              />
            </SectionShell>
          </Box>

          <Box id="tri-zone-section">
            <SectionShell
              title="Tri Zone Product Add Form"
              subtitle="Footer-linked access point for Tri Zone"
            >
              <QuickAccessCard
                title="Tri Zone"
                description="This section is reachable from the footer and can be expanded later into a full product add form."
                buttonLabel="Open Tri Zone"
              />
            </SectionShell>
          </Box>

          <Box id="tri-gift-section">
            <SectionShell
              title="Tri Gift Card"
              subtitle="Footer-linked gift card access section"
            >
              <QuickAccessCard
                title="Tri Gift Card"
                description="This area is directly accessible from the footer for gift-card related actions."
                buttonLabel="Open Gift Card"
              />
            </SectionShell>
          </Box>
        </Stack>
      </Box>

      <SearchCityModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onAction={handleDrawerAction} />
      <MobileFooterNav activeItem={activeFooterItem} onNavigate={handleFooterNavigate} />
    </Box>
  );
}

export default BusinessDashboard;
