import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import MyLocationOutlinedIcon from "@mui/icons-material/MyLocationOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import AddShoppingCartRoundedIcon from "@mui/icons-material/AddShoppingCartRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import PeopleOutlineRoundedIcon from "@mui/icons-material/PeopleOutlineRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import { useShell } from "../../components/layouts/ShellBase";
import colors from "../v2/theme/colors";

const UI = {
  bg: "#dbe8fb",
  surface: colors.surface,
  card: colors.card,
  border: colors.border,
  text: colors.textPrimary,
  textMuted: colors.textSecondary,
  primary: "#0F52BA",
  secondary: "#2f6fd0",
  onPrimary: colors.textOnPrimary,
};

const LOCATION_TREE = {
  Karnataka: {
    Bangalore: ["Anekal", "Yelahanka", "Nelamangala"],
    Mysore: ["Nanjangud", "Hunsur", "T Narasipura"],
  },
  Maharashtra: {
    Pune: ["Haveli", "Mulshi", "Baramati"],
    Mumbai: ["Andheri", "Borivali", "Kurla"],
  },
  TamilNadu: {
    Chennai: ["Ambattur", "Alandur", "Guindy"],
    Coimbatore: ["Mettupalayam", "Pollachi", "Sulur"],
  },
  AndhraPradesh: {
    Visakhapatnam: ["Bheemunipatnam", "Anakapalle", "Gajuwaka"],
    Tirupati: ["Srikalahasti", "Renigunta", "Puttur"],
  },
};

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
  { id: 2, title: "Banner Ad", caption: "Fashion offers and nearby deals for your selected taluk." },
  { id: 3, title: "Banner Ad", caption: "Furniture and appliance launches from local businesses." },
];

const PRODUCTS = [
  { id: 1, name: "Home Office Chair", price: "Rs. 12,499", discount: "18% OFF" },
  { id: 2, name: "Smart Watch Pro", price: "Rs. 6,799", discount: "12% OFF" },
  { id: 3, name: "Mixer Grinder", price: "Rs. 3,950", discount: "9% OFF" },
  { id: 4, name: "Industrial Tool Kit", price: "Rs. 8,400", discount: "15% OFF" },
];

const METRICS = [
  { title: "Total Consumers", value: "12,492", icon: PeopleOutlineRoundedIcon },
  { title: "Captain Office", value: "148", icon: ApartmentRoundedIcon },
  { title: "Sarathi", value: "426", icon: SupportAgentRoundedIcon },
];

const GROWTH_SERIES = [
  { label: "Mon", value: 42 },
  { label: "Tue", value: 68 },
  { label: "Wed", value: 54 },
  { label: "Thu", value: 76 },
  { label: "Fri", value: 62 },
  { label: "Sat", value: 88 },
];

const FOOTER_ITEMS = [
  { id: "home-top", label: "Home", icon: HomeOutlinedIcon },
  { id: "business-shops", label: "Near By", icon: StorefrontOutlinedIcon },
  { id: "product-section", label: "Online", icon: LanguageOutlinedIcon },
  { id: "scanner-section", label: "Scanner", icon: QrCodeScannerRoundedIcon },
  { id: "tri-zone-section", label: "Tri Zone", icon: GridViewRoundedIcon },
  { id: "tri-gift-section", label: "Tri Gift", icon: CardGiftcardRoundedIcon },
];

function getSelectMenuProps() {
  return {
    PaperProps: {
      sx: {
        borderRadius: 2,
        mt: 1,
      },
    },
  };
}

function sectionCardStyles() {
  return {
    borderRadius: 3,
    bgcolor: UI.surface,
    border: `1px solid ${UI.border}`,
    boxShadow: "none",
  };
}

function SectionShell({ title, subtitle, action, children }) {
  return (
    <Card sx={sectionCardStyles()}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: UI.text }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography sx={{ fontSize: 13, color: UI.textMuted, mt: 0.5 }}>
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

function ScrollRow({ children, gap = 2 }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap,
        overflowX: "auto",
        pb: 0.5,
        scrollBehavior: "smooth",
        scrollSnapType: "x proximity",
        "&::-webkit-scrollbar": { height: 6 },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: alpha(UI.primary, 0.35),
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
        width: 42,
        height: 42,
        borderRadius: 2,
        border: `1px solid ${UI.border}`,
        bgcolor: UI.surface,
        color: UI.text,
        flexShrink: 0,
      }}
    >
      {children}
    </IconButton>
  );
}

function LocationFilterField({ label, value, onChange, options, multiple = false, disabled = false }) {
  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple={multiple}
        value={value}
        onChange={onChange}
        input={<OutlinedInput label={label} />}
        renderValue={
          multiple
            ? (selected) => (selected.length ? selected.join(", ") : `Select ${label}`)
            : undefined
        }
        MenuProps={getSelectMenuProps()}
        sx={{
          borderRadius: 2,
          bgcolor: UI.surface,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: UI.border },
        }}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function PlaceholderImage({ label, minHeight = 120 }) {
  return (
    <Box
      sx={{
        minHeight,
        borderRadius: 2.5,
        border: `1px dashed ${alpha(UI.primary, 0.45)}`,
        bgcolor: alpha(UI.primary, 0.06),
        display: "grid",
        placeItems: "center",
        color: UI.textMuted,
        fontSize: 13,
        fontWeight: 700,
        textAlign: "center",
        px: 2,
      }}
    >
      {label}
    </Box>
  );
}

function ShopCard({ shop }) {
  return (
    <Card
      sx={{
        ...sectionCardStyles(),
        minWidth: { xs: 248, sm: 280 },
        width: { xs: 248, sm: 280 },
        flexShrink: 0,
        scrollSnapAlign: "start",
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <PlaceholderImage label="Shop Image Placeholder" minHeight={142} />
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: UI.text }}>
              {shop.name}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: UI.textMuted, mt: 0.5 }}>
              {shop.place}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant="contained"
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
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
              startIcon={<FlagOutlinedIcon />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
                borderColor: UI.border,
                color: UI.text,
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
        minWidth: 168,
        width: 168,
        flexShrink: 0,
        scrollSnapAlign: "start",
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <PlaceholderImage label="Category Image" minHeight={92} />
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: UI.text }}>
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
        minWidth: { xs: 256, sm: 320 },
        width: { xs: 256, sm: 320 },
        flexShrink: 0,
        scrollSnapAlign: "start",
        bgcolor: alpha(UI.primary, 0.08),
      }}
    >
      <CardContent sx={{ p: 2.25 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                bgcolor: UI.primary,
                color: UI.onPrimary,
              }}
            >
              <PlayCircleOutlineRoundedIcon />
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: UI.text }}>
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: UI.textMuted }}>
                Ads Banner
              </Typography>
            </Box>
          </Stack>
          <PlaceholderImage label="Ads Banner Placeholder" minHeight={118} />
          <Typography sx={{ fontSize: 13, color: UI.textMuted, lineHeight: 1.5 }}>
            {item.caption}
          </Typography>
          <Chip
            label="Watch & Earn"
            size="small"
            sx={{
              alignSelf: "flex-start",
              fontWeight: 700,
              bgcolor: UI.primary,
              color: UI.onPrimary,
            }}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

function ProductCard({ product }) {
  return (
    <Card sx={{ ...sectionCardStyles(), height: "100%" }}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.5} height="100%">
          <PlaceholderImage label="Product Image" minHeight={164} />
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: UI.text }}>
              {product.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: UI.primary }}>
                {product.price}
              </Typography>
              <Chip
                label={product.discount}
                size="small"
                sx={{
                  height: 24,
                  fontWeight: 700,
                  bgcolor: alpha(UI.primary, 0.12),
                  color: UI.primary,
                }}
              />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: "auto" }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddShoppingCartRoundedIcon />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
                bgcolor: UI.primary,
                color: UI.onPrimary,
                boxShadow: "none",
                "&:hover": { bgcolor: UI.secondary, boxShadow: "none" },
              }}
            >
              Add to Cart
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FavoriteBorderRoundedIcon />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
                borderColor: UI.border,
                color: UI.text,
              }}
            >
              Wishlist
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function MetricCard({ item }) {
  const Icon = item.icon;

  return (
    <Card
      sx={{
        ...sectionCardStyles(),
        width: 220,
        minWidth: 220,
        height: 150,
        flexShrink: 0,
        scrollSnapAlign: "start",
      }}
    >
      <CardContent
        sx={{
          p: 2.25,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Avatar
          sx={{
            width: 42,
            height: 42,
            bgcolor: alpha(UI.primary, 0.1),
            color: UI.primary,
          }}
        >
          <Icon />
        </Avatar>
        <Box>
          <Typography sx={{ fontSize: 13, color: UI.textMuted, mb: 0.75 }}>
            {item.title}
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 800, color: UI.text }}>
            {item.value}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function ProfileCard() {
  return (
    <SectionShell title="Profile" subtitle="Profile card with current earnings">
      <Card
        sx={{
          borderRadius: 3,
          bgcolor: alpha(UI.primary, 0.08),
          border: `1px solid ${alpha(UI.primary, 0.18)}`,
          boxShadow: "none",
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              sx={{
                width: 72,
                height: 72,
                bgcolor: UI.primary,
                color: UI.onPrimary,
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              PJ
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: UI.text }}>
                Prakash J
              </Typography>
              <Typography sx={{ fontSize: 13, color: UI.textMuted, mt: 0.5 }}>
                Master Franchise
              </Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: UI.primary, mt: 1.25 }}>
                Rs. 1,24,500
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: UI.textMuted }}>
                Total earnings/value
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </SectionShell>
  );
}

function GrowthCard() {
  const maxValue = useMemo(
    () => Math.max(...GROWTH_SERIES.map((item) => item.value), 1),
    []
  );

  return (
    <SectionShell
      title="Growth Analytics"
      subtitle="Simple growth representation based on dashboard activity"
      action={
        <Chip
          icon={<TrendingUpRoundedIcon />}
          label="Growth"
          sx={{
            fontWeight: 700,
            bgcolor: alpha(UI.primary, 0.12),
            color: UI.primary,
          }}
        />
      }
    >
      <Card
        sx={{
          borderRadius: 3,
          border: `1px solid ${UI.border}`,
          boxShadow: "none",
          bgcolor: UI.card,
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-end" sx={{ minHeight: 220, overflowX: "auto" }}>
            {GROWTH_SERIES.map((item) => (
              <Box
                key={item.label}
                sx={{
                  flex: 1,
                  minWidth: 44,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: 12, color: UI.textMuted, fontWeight: 700 }}>
                  {item.value}
                </Typography>
                <Box
                  sx={{
                    width: "100%",
                    height: `${Math.max(36, (item.value / maxValue) * 148)}px`,
                    borderRadius: "14px 14px 6px 6px",
                    bgcolor: item.value === maxValue ? UI.secondary : UI.primary,
                  }}
                />
                <Typography sx={{ fontSize: 12, color: UI.textMuted, fontWeight: 700 }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </SectionShell>
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
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={1.25}>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: UI.text }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 13, color: UI.textMuted, lineHeight: 1.6 }}>
            {description}
          </Typography>
          <Button
            variant="contained"
            sx={{
              alignSelf: "flex-start",
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
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
        px: 1,
        pb: 1,
      }}
    >
      <Card
        sx={{
          borderRadius: 4,
          border: `1px solid ${alpha(UI.primary, 0.14)}`,
          bgcolor: alpha(UI.surface, 0.96),
          backdropFilter: "blur(10px)",
          boxShadow: "0 -8px 30px rgba(15,82,186,0.12)",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 0.25,
            p: 0.75,
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
                  px: 0.25,
                  py: 0.9,
                  borderRadius: 2.5,
                  textTransform: "none",
                  color: selected ? UI.primary : UI.textMuted,
                  bgcolor: selected ? alpha(UI.primary, 0.1) : "transparent",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.35,
                  lineHeight: 1.05,
                }}
              >
                <Icon sx={{ fontSize: 20 }} />
                <Typography
                  sx={{
                    fontSize: 9.5,
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
  const { toggleSidebar } = useShell();

  const stateOptions = Object.keys(LOCATION_TREE);
  const [selectedState, setSelectedState] = useState("Karnataka");
  const [selectedDistrict, setSelectedDistrict] = useState("Bangalore");
  const [selectedTaluk, setSelectedTaluk] = useState("Anekal");
  const [multiStates, setMultiStates] = useState(["Karnataka", "Maharashtra"]);
  const [nearbyOnly, setNearbyOnly] = useState(true);
  const [activeFooterItem, setActiveFooterItem] = useState("home-top");

  const districtOptions = useMemo(
    () => Object.keys(LOCATION_TREE[selectedState] || {}),
    [selectedState]
  );

  const talukOptions = useMemo(
    () => LOCATION_TREE[selectedState]?.[selectedDistrict] || [],
    [selectedState, selectedDistrict]
  );

  const handleStateChange = (event) => {
    const nextState = event.target.value;
    const nextDistricts = Object.keys(LOCATION_TREE[nextState] || {});
    const nextDistrict = nextDistricts[0] || "";
    const nextTaluks = LOCATION_TREE[nextState]?.[nextDistrict] || [];

    setSelectedState(nextState);
    setSelectedDistrict(nextDistrict);
    setSelectedTaluk(nextTaluks[0] || "");
  };

  const handleDistrictChange = (event) => {
    const nextDistrict = event.target.value;
    const nextTaluks = LOCATION_TREE[selectedState]?.[nextDistrict] || [];

    setSelectedDistrict(nextDistrict);
    setSelectedTaluk(nextTaluks[0] || "");
  };

  const handleFooterNavigate = (targetId) => {
    setActiveFooterItem(targetId);
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: UI.bg }}>
      <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2, md: 3 }, pb: { xs: 12, md: 3 } }}>
        <Stack spacing={2.5}>
          <Box id="home-top">
            <Card
              sx={{
                borderRadius: { xs: 3, md: 4 },
                bgcolor: UI.surface,
                border: `1px solid ${UI.border}`,
                boxShadow: "none",
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
                <Stack spacing={2.5}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                      <IconButton
                        aria-label="Open sidebar"
                        onClick={toggleSidebar}
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          border: `1px solid ${UI.border}`,
                          bgcolor: alpha(UI.primary, 0.06),
                          color: UI.text,
                          flexShrink: 0,
                        }}
                      >
                        <MenuRoundedIcon />
                      </IconButton>
                      <Typography
                        sx={{
                          fontSize: { xs: 24, md: 30 },
                          fontWeight: 900,
                          color: UI.text,
                          lineHeight: 1,
                        }}
                      >
                        Business Dashboard
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <HeaderActionButton ariaLabel="Notifications">
                        <NotificationsNoneRoundedIcon />
                      </HeaderActionButton>
                      <HeaderActionButton
                        ariaLabel="Wallet"
                        onClick={() => navigate("/user/franchise-wallet")}
                      >
                        <AccountBalanceWalletOutlinedIcon />
                      </HeaderActionButton>
                      <HeaderActionButton ariaLabel="Location">
                        <LocationOnOutlinedIcon />
                      </HeaderActionButton>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          <Box id="location-selector">
            <SectionShell
              title="Location Selector"
              subtitle="State, district, taluk, nearby location and multi-state selection"
            >
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
                    gap: 2,
                  }}
                >
                  <LocationFilterField
                    label="State"
                    value={selectedState}
                    onChange={handleStateChange}
                    options={stateOptions}
                  />
                  <LocationFilterField
                    label="District"
                    value={selectedDistrict}
                    onChange={handleDistrictChange}
                    options={districtOptions}
                    disabled={!districtOptions.length}
                  />
                  <LocationFilterField
                    label="Taluk"
                    value={selectedTaluk}
                    onChange={(event) => setSelectedTaluk(event.target.value)}
                    options={talukOptions}
                    disabled={!talukOptions.length}
                  />
                  <LocationFilterField
                    label="Multi-state"
                    value={multiStates}
                    onChange={(event) => setMultiStates(event.target.value)}
                    options={stateOptions}
                    multiple
                  />
                </Box>

                <Card
                  sx={{
                    borderRadius: 3,
                    border: `1px solid ${UI.border}`,
                    boxShadow: "none",
                    bgcolor: alpha(UI.primary, 0.04),
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      justifyContent="space-between"
                      spacing={1.5}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: UI.primary,
                            color: UI.onPrimary,
                          }}
                        >
                          <MyLocationOutlinedIcon />
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 800, color: UI.text }}>
                            Nearby location
                          </Typography>
                          <Typography sx={{ fontSize: 12.5, color: UI.textMuted }}>
                            Focus shops, ads and products around the selected region
                          </Typography>
                        </Box>
                      </Stack>
                      <Switch
                        checked={nearbyOnly}
                        onChange={(event) => setNearbyOnly(event.target.checked)}
                        sx={{
                          "& .MuiSwitch-switchBase.Mui-checked": { color: UI.primary },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                            bgcolor: UI.primary,
                          },
                        }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
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
            <SectionShell
              title="Ads Section"
              subtitle="Scrollable banner-based ads with watch and earn UI"
            >
            <ScrollRow>
              {ADS.map((item) => (
                <AdBannerCard key={item.id} item={item} />
              ))}
            </ScrollRow>
            </SectionShell>
          </Box>

          <Box id="product-section">
            <SectionShell
              title="Product Section"
              subtitle="Grid layout with image, price, discount, cart and wishlist"
            >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  xl: "repeat(4, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {PRODUCTS.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </Box>
            </SectionShell>
          </Box>

          <Box id="metrics-section">
            <SectionShell
              title="Overview / Metrics"
              subtitle="Fixed-size cards in a horizontal scroll container"
            >
            <ScrollRow>
              {METRICS.map((item) => (
                <MetricCard key={item.title} item={item} />
              ))}
            </ScrollRow>
            </SectionShell>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.85fr) minmax(0, 1.15fr)" },
              gap: 2.5,
            }}
          >
            <Box id="profile-section">
              <ProfileCard />
            </Box>
            <Box id="growth-section">
              <GrowthCard />
            </Box>
          </Box>

          <Box id="scanner-section">
            <SectionShell
              title="Scanner"
              subtitle="Quick access area from the mobile footer"
            >
              <QuickAccessCard
                title="Scanner Access"
                description="Use this area as the landing point for scanner-related actions from the footer sketch."
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
                description="This area is now directly accessible from the mobile footer for gift-card related actions."
                buttonLabel="Open Gift Card"
              />
            </SectionShell>
          </Box>
        </Stack>
      </Box>
      <MobileFooterNav activeItem={activeFooterItem} onNavigate={handleFooterNavigate} />
    </Box>
  );
}

export default BusinessDashboard;
