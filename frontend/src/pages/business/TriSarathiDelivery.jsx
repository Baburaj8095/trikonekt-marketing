import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import {
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeliveryHeader from "../../components/business/DeliveryHeader";
import SearchBar from "../../components/business/SearchBar";
import StoreCard from "../../components/business/StoreCard";
import ecommerceImage from "../../assets/ecommerce.jpg";
import giftsImage from "../../assets/gifts.jpg";
import furnitureImage from "../../assets/furniture.jpeg";
import electronicsImage from "../../assets/electronics-img.jpg";

const UI = {
  bg: "#f1f5f9",
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#1f2937",
  textMuted: "#6b7280",
  primary: "#0F52BA",
  secondary: "#2f6fd0",
  onPrimary: "#ffffff",
};

const CATEGORIES = ["All", "Grocery", "Food", "Essentials"];

const STORES = [
  {
    id: "fresh-mart",
    name: "Tri Fresh Mart",
    category: "Grocery",
    description: "Daily groceries, fruits and kitchen staples",
    rating: "4.6",
    deliveryTime: "18-24 min",
    distance: "1.2 km",
    tags: ["Fast Delivery", "Popular"],
    image: ecommerceImage,
    menu: [
      { id: "apple", name: "Farm Fresh Apples", price: "Rs. 149" },
      { id: "atta", name: "Whole Wheat Atta 5kg", price: "Rs. 289" },
      { id: "milk", name: "Daily Milk Pack", price: "Rs. 64" },
    ],
  },
  {
    id: "quick-bites",
    name: "Sarathi Quick Bites",
    category: "Food",
    description: "Meals, snacks and hot beverages",
    rating: "4.4",
    deliveryTime: "22-30 min",
    distance: "2.0 km",
    tags: ["Trending", "Best Seller"],
    image: giftsImage,
    menu: [
      { id: "combo", name: "Mini Meals Combo", price: "Rs. 159" },
      { id: "tea", name: "Masala Tea Flask", price: "Rs. 89" },
      { id: "snack", name: "Evening Snack Box", price: "Rs. 119" },
    ],
  },
  {
    id: "home-essentials",
    name: "Home Essentials Hub",
    category: "Essentials",
    description: "Cleaning, home care and daily essentials",
    rating: "4.5",
    deliveryTime: "25-35 min",
    distance: "2.8 km",
    tags: ["Essentials", "Value Picks"],
    image: furnitureImage,
    menu: [
      { id: "cleaner", name: "Floor Cleaner 1L", price: "Rs. 135" },
      { id: "tissues", name: "Soft Tissue Pack", price: "Rs. 99" },
      { id: "soap", name: "Bath Soap Combo", price: "Rs. 149" },
    ],
  },
  {
    id: "gadget-stop",
    name: "Gadget Stop Express",
    category: "Essentials",
    description: "Chargers, cables and compact accessories",
    rating: "4.3",
    deliveryTime: "30-40 min",
    distance: "3.5 km",
    tags: ["New", "Quick Pickup"],
    image: electronicsImage,
    menu: [
      { id: "cable", name: "Type-C Cable", price: "Rs. 199" },
      { id: "adapter", name: "Fast Charging Adapter", price: "Rs. 499" },
      { id: "buds", name: "Wired Earphones", price: "Rs. 349" },
    ],
  },
];

function CategoryStrip({ active, onChange }) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        overflowX: "auto",
        overflowY: "hidden",
        pb: 0.4,
        scrollBehavior: "smooth",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {CATEGORIES.map((category) => {
        const selected = active === category;
        return (
          <Button
            key={category}
            onClick={() => onChange(category)}
            sx={{
              flexShrink: 0,
              minHeight: 36,
              px: 1.6,
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 900,
              fontSize: 12,
              color: selected ? UI.onPrimary : UI.text,
              bgcolor: selected ? UI.primary : UI.surface,
              border: `1px solid ${selected ? UI.primary : UI.border}`,
              boxShadow: selected ? "0 8px 18px rgba(15,82,186,0.16)" : "none",
              "&:hover": {
                bgcolor: selected ? UI.secondary : alpha(UI.primary, 0.06),
              },
            }}
          >
            {category}
          </Button>
        );
      })}
    </Box>
  );
}

function MenuDrawer({ store, onAdd }) {
  if (!store) return null;

  return (
    <Box
      sx={{
        mt: 1,
        borderRadius: 3,
        bgcolor: UI.surface,
        border: `1px solid ${UI.border}`,
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 900, color: UI.text }}>
          {store.name}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: UI.textMuted, mt: 0.3 }}>
          Menu items
        </Typography>
      </Box>
      <Divider />
      <Stack divider={<Divider flexItem />}>
        {store.menu.map((item) => (
          <Stack
            key={item.id}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1.25}
            sx={{ p: 1.5, minWidth: 0 }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: UI.text }}>
                {item.name}
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 900, color: UI.primary, mt: 0.4 }}>
                {item.price}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => onAdd(item)}
              sx={{
                flexShrink: 0,
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 900,
                borderColor: alpha(UI.primary, 0.32),
                color: UI.primary,
                minWidth: 82,
              }}
            >
              Add
            </Button>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export default function TriSarathiDelivery() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  const filteredStores = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return STORES.filter((store) => {
      const matchesCategory = category === "All" || store.category === category;
      const matchesQuery =
        !normalizedQuery ||
        store.name.toLowerCase().includes(normalizedQuery) ||
        store.description.toLowerCase().includes(normalizedQuery) ||
        store.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const selectedStore = useMemo(
    () => STORES.find((store) => store.id === selectedStoreId),
    [selectedStoreId]
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: UI.bg, overflowX: "hidden" }}>
      <DeliveryHeader
        onBack={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate("/business/dashboard", { replace: true });
        }}
      >
        <SearchBar
          value={query}
          onChange={setQuery}
          location="Delivering to current business location"
        />
      </DeliveryHeader>

      <Box
        component="main"
        sx={{
          maxWidth: 720,
          mx: "auto",
          px: { xs: 1.25, sm: 2 },
          pt: { xs: 15.5, sm: 16 },
          pb: { xs: 9, sm: 4 },
        }}
      >
        <Stack spacing={1.4}>
          <Box
            sx={{
              position: "sticky",
              top: { xs: 136, sm: 142 },
              zIndex: 10,
              bgcolor: UI.bg,
              py: 0.8,
            }}
          >
            <CategoryStrip active={category} onChange={setCategory} />
          </Box>

          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: UI.text }}>
                Stores near you
              </Typography>
              <Typography sx={{ fontSize: 12, color: UI.textMuted, mt: 0.35 }}>
                Fast local delivery by Tri Sarathi partners
              </Typography>
            </Box>
            <Chip
              label={`${cartCount} in cart`}
              sx={{
                flexShrink: 0,
                height: 30,
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 900,
                bgcolor: alpha(UI.primary, 0.1),
                color: UI.primary,
              }}
            />
          </Stack>

          {filteredStores.map((store) => (
            <Box key={store.id} sx={{ minWidth: 0 }}>
              <StoreCard
                store={store}
                onClick={() =>
                  setSelectedStoreId((current) => (current === store.id ? null : store.id))
                }
              />
              {selectedStoreId === store.id ? (
                <MenuDrawer store={store} onAdd={() => setCartCount((count) => count + 1)} />
              ) : null}
            </Box>
          ))}

          {!filteredStores.length ? (
            <Box
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: UI.surface,
                border: `1px solid ${UI.border}`,
                textAlign: "center",
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 900, color: UI.text }}>
                No stores found
              </Typography>
              <Typography sx={{ fontSize: 12, color: UI.textMuted, mt: 0.5 }}>
                Try a different item, store, or category.
              </Typography>
            </Box>
          ) : null}
        </Stack>
      </Box>

      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1200,
          px: 1.25,
          py: 1,
          bgcolor: alpha(UI.surface, 0.96),
          borderTop: `1px solid ${UI.border}`,
          backdropFilter: "blur(10px)",
          display: { xs: cartCount ? "block" : "none", sm: cartCount ? "block" : "none" },
        }}
      >
        <Button
          fullWidth
          variant="contained"
          sx={{
            maxWidth: 720,
            mx: "auto",
            display: "flex",
            minHeight: 46,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 900,
            bgcolor: UI.primary,
            color: UI.onPrimary,
            boxShadow: "none",
            "&:hover": { bgcolor: UI.secondary, boxShadow: "none" },
          }}
        >
          View Cart • {cartCount} item{cartCount === 1 ? "" : "s"}
        </Button>
      </Box>
    </Box>
  );
}
