import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputBase,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import HotelRoundedIcon from "@mui/icons-material/HotelRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import PhoneInTalkRoundedIcon from "@mui/icons-material/PhoneInTalkRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import TempleHinduRoundedIcon from "@mui/icons-material/TempleHinduRounded";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import BeachAccessRoundedIcon from "@mui/icons-material/BeachAccessRounded";
import API from "../../api/api";
import imgHolidays from "../../assets/holidays.jpg";
import imgKerala from "../../assets/kerala.jpg";
import imgThailand from "../../assets/thailand.jpg";

// Curated Ixigo-Style Premium Holiday Packages
const CURATED_PACKAGES = [
  {
    id: "pkg-munnar",
    title: "Enchanting Munnar Hills & Tea Trails",
    destination: "Munnar, Kerala",
    duration: "2N / 3D",
    category: "HILLS",
    categoryLabel: "Hills & Nature",
    parentGift: true,
    image: imgKerala,
    price: 9880,
    priceDisplay: "₹9,880 onwards",
    bookingToken: "₹250",
    inclusions: ["AC Cab Transfer", "4★ Valley Resort", "Daily Breakfast & Dinner", "Tea Museum & Dam Sightseeing"],
    inclusionsShort: "Cab • Hotel • Meals • Sightseeing",
    highlights: [
      "Scenic private road transfer from Cochin through Cheeyappara & Valara Waterfalls",
      "Stay in premium tea garden resort with panoramic mountain view balconies",
      "Guided tour to Eravikulam National Park (Home of Nilgiri Tahr) and Mattupetty Dam",
      "Complimentary spice plantation walk and authentic Kerala dinner experience",
    ],
    itinerary: [
      { day: "Day 1", title: "Arrival Cochin to Munnar (130 km / 4 hrs)", desc: "Scenic hill drive past mist-covered tea plantations, check-in at tea resort, leisure evening." },
      { day: "Day 2", title: "Munnar Sightseeing Extravaganza", desc: "Visit Eravikulam National Park, Mattupetty Dam, Echo Point, Kundala Lake, and Tata Tea Museum." },
      { day: "Day 3", title: "Spice Trails & Departure to Cochin", desc: "Morning walk through spice plantation gardens, checkout, and drop at Cochin airport/station." },
    ],
  },
  {
    id: "pkg-vaishnodevi",
    title: "Mata Vaishnodevi Sacred Yatra Ex-Delhi",
    destination: "Katra / Jammu",
    duration: "3N / 4D",
    category: "SACRED",
    categoryLabel: "Sacred Journeys",
    parentGift: true,
    image: "https://images.unsplash.com/photo-1626014303757-6466336e395f?auto=format&fit=crop&w=900&q=80",
    price: 6990,
    priceDisplay: "₹6,990 onwards",
    bookingToken: "₹250",
    inclusions: ["Train / AC Volvo", "Katra Hotel Stay", "All Transfers", "VIP Aarti Assistance"],
    inclusionsShort: "Train • Cab • Hotel • Meals",
    highlights: [
      "Sacred pilgrimage dedicated for parents and families with prioritized battery-car assistance",
      "Well-appointed hotel in Katra with sanitized pure-veg dining and 24/7 hot water",
      "Helicopter & ropeway booking assistance directly from Katra base",
      "Complimentary Bhairon Baba Temple and Ardhkuwari Darshan guidance",
    ],
    itinerary: [
      { day: "Day 1", title: "Delhi / Jammu to Katra Base", desc: "Arrival at Jammu station, private transfer to Katra, hotel check-in, registration and yatra preparation." },
      { day: "Day 2", title: "Trek to Holy Bhawan & Darshan", desc: "Begin the divine ascent to Mata Vaishnodevi Bhawan, attend holy Aarti, seek blessings, visit Bhairon temple." },
      { day: "Day 3", title: "Descent & Katra Leisure", desc: "Return to hotel, rest and rejuvenate, explore Katra's local dry-fruit and souvenir markets." },
      { day: "Day 4", title: "Departure", desc: "Hearty breakfast and departure transfer to Jammu railway station." },
    ],
  },
  {
    id: "pkg-kamakhya",
    title: "Divya Maa Kamakhya Darshan & Brahmaputra Cruise",
    destination: "Guwahati, Assam",
    duration: "1N / 2D",
    category: "SACRED",
    categoryLabel: "Sacred Journeys",
    parentGift: true,
    image: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=900&q=80",
    price: 2550,
    priceDisplay: "₹2,550 onwards",
    bookingToken: "₹200",
    inclusions: ["Private AC Cab", "City Hotel", "VIP Darshan Pass", "River Cruise Ticket"],
    inclusionsShort: "Bus • Cab • Hotel • VIP Pass",
    highlights: [
      "Blessed VIP Darshan pass at Maa Kamakhya Shaktipeeth on Nilachal Hill",
      "Serene sunset dinner cruise over the majestic Brahmaputra River",
      "Visit Umananda Peacock Island temple via country ferry",
    ],
    itinerary: [
      { day: "Day 1", title: "Guwahati Arrival & Kamakhya Puja", desc: "Pick-up from Guwahati, proceed to Nilachal Hill for Maa Kamakhya Darshan, evening Brahmaputra sunset cruise." },
      { day: "Day 2", title: "Umananda & Departure", desc: "Morning visit to Umananda temple on Peacock Island, handicraft emporium, transfer to airport/station." },
    ],
  },
  {
    id: "pkg-rajasthan",
    title: "Royal Rajasthan Heritage Ex-Bengaluru",
    destination: "Jaipur, Jodhpur, Udaipur",
    duration: "5N / 6D",
    category: "HILLS",
    categoryLabel: "Heritage & Royals",
    parentGift: false,
    image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80",
    price: 24900,
    priceDisplay: "₹24,900 onwards",
    bookingToken: "₹500",
    inclusions: ["Flights Ex-BLR", "Heritage Haveli Stay", "Private AC Chauffeur", "Royal Dinners"],
    inclusionsShort: "Flights • Cab • 4★ Haveli • Meals",
    highlights: [
      "Amer Fort elephant ride and sound & light show in the Pink City Jaipur",
      "Explore the majestic Mehrangarh Fort towering above the blue city of Jodhpur",
      "Romantic sunset boat cruise on Lake Pichola in Venice of the East Udaipur",
      "Authentic cultural Rajasthani folk music, kalbeliya dance, and royal thali meals",
    ],
    itinerary: [
      { day: "Day 1", title: "Bengaluru to Jaipur", desc: "Fly into Jaipur, airport welcome, check-in at Heritage Haveli, evening visit to Chokhi Dhani." },
      { day: "Day 2", title: "Jaipur City Highlights", desc: "Amer Fort, Hawa Mahal, City Palace museum, and vibrant Johari Bazaar." },
      { day: "Day 3", title: "Jaipur to Jodhpur", desc: "Scenic highway transfer to Jodhpur, tour Mehrangarh Fort and Jaswant Thada, blue city walk." },
      { day: "Day 4", title: "Jodhpur to Udaipur via Ranakpur", desc: "Marvel at the 1,444 marble pillars of Ranakpur Jain Temple en route to Udaipur." },
      { day: "Day 5", title: "Udaipur Lakes & Palaces", desc: "Udaipur City Palace, Saheliyon Ki Bari, and sunset boat cruise on Lake Pichola." },
      { day: "Day 6", title: "Farewell Rajasthan", desc: "Breakfast, souvenir shopping, and transfer to Udaipur airport for return flight." },
    ],
  },
  {
    id: "pkg-odisha",
    title: "Jewels of Odisha & Konark Dance Festival",
    destination: "Puri, Konark, Bhubaneswar",
    duration: "4N / 5D",
    category: "SACRED",
    categoryLabel: "Sacred Journeys",
    parentGift: true,
    image: "https://images.unsplash.com/photo-1606298855672-3efb63017be8?auto=format&fit=crop&w=900&q=80",
    price: 18500,
    priceDisplay: "₹18,500 onwards",
    bookingToken: "₹500",
    inclusions: ["Flights Included", "Beach Resort", "Sun Temple Pass", "Chilika Boating"],
    inclusionsShort: "Flights • Hotel • Temple Pass • Meals",
    highlights: [
      "Exclusive Darshan assistance at Shree Jagannath Temple in Puri",
      "Witness architectural marvel of the UNESCO World Heritage Konark Sun Temple",
      "Chilika Lake boat ride to spot playful Irrawaddy dolphins and migratory flamingoes",
      "Golden Beach sunset leisure and authentic Odia seafood & cuisine",
    ],
    itinerary: [
      { day: "Day 1", title: "Bhubaneswar to Puri", desc: "Pick-up at Bhubaneswar, transfer to Puri beach resort, evening beach stroll." },
      { day: "Day 2", title: "Puri Jagannath Darshan & Konark", desc: "Morning Jagannath temple visit, afternoon Konark Sun Temple and Chandrabhaga beach." },
      { day: "Day 3", title: "Chilika Lake Dolphin Sanctuary", desc: "Day excursion to Satapada on Chilika Lake, boat cruise to dolphin viewpoints and Sea Mouth." },
      { day: "Day 4", title: "Dhauli Peace Pagoda & Pipili", desc: "Visit Pipili applique village, Dhauli Shanti Stupa, and Lingaraj Temple in Bhubaneswar." },
      { day: "Day 5", title: "Departure", desc: "Breakfast, checkout, and airport transfer from Bhubaneswar." },
    ],
  },
  {
    id: "pkg-goa",
    title: "Goa Coastal Paradise & Watersports",
    destination: "North & South Goa",
    duration: "3N / 4D",
    category: "BEACH",
    categoryLabel: "Beaches & Coastal",
    parentGift: false,
    image: imgHolidays,
    price: 12999,
    priceDisplay: "₹12,999 onwards",
    bookingToken: "₹250",
    inclusions: ["4★ Beach Resort", "Daily Buffet Breakfast", "Scuba & Watersports", "Airport Transfers"],
    inclusionsShort: "Resort • Breakfast • Watersports • Cab",
    highlights: [
      "Beachfront resort stay walking distance from Calangute & Baga beaches",
      "Thrilling watersports combo: Parasailing, Jet Ski, Banana ride & Bumper ride",
      "South Goa heritage tour: Basilica of Bom Jesus, Se Cathedral, and Mangueshi temple",
      "Mandovi River evening luxury cruise with Goan folk dance & music",
    ],
    itinerary: [
      { day: "Day 1", title: "Welcome to Sunny Goa", desc: "Airport transfer to North Goa resort, welcome drink, evening sunset walk on Baga beach." },
      { day: "Day 2", title: "Watersports & North Goa Vibes", desc: "Adrenaline-filled watersports at Calangute, Aguada Fort lighthouse, and Chapora Fort." },
      { day: "Day 3", title: "Old Goa Heritage & River Cruise", desc: "Portuguese churches in Old Goa, Latin Quarter Fontainhas heritage walk, Mandovi river cruise." },
      { day: "Day 4", title: "Farewell Goa", desc: "Relaxing breakfast, flea market souvenir shopping, and airport drop." },
    ],
  },
  {
    id: "pkg-thailand",
    title: "Thailand Tropical Odyssey (Bangkok & Pattaya)",
    destination: "Pattaya & Bangkok",
    duration: "4N / 5D",
    category: "INTERNATIONAL",
    categoryLabel: "International Getaway",
    parentGift: false,
    image: imgThailand,
    price: 28990,
    priceDisplay: "₹28,990 onwards",
    bookingToken: "₹1,000",
    inclusions: ["Flights Ex-India", "4★ Oceanview Stay", "Coral Island Speedboat", "Bangkok Temples Tour"],
    inclusionsShort: "Flights • 4★ Hotel • Speedboat • Meals",
    highlights: [
      "Speedboat adventure to Coral Island (Koh Larn) with parasailing & glass-bottom boat",
      "World-renowned Alcazar Cabaret theatrical show in Pattaya with VIP seats",
      "Bangkok city tour: Wat Traimit (Golden Buddha) and Wat Pho (Reclining Buddha)",
      "Shopping spree at Bangkok's world-famous Platinum Fashion Mall and Pratunam Market",
    ],
    itinerary: [
      { day: "Day 1", title: "Arrival Bangkok to Pattaya", desc: "Suvarnabhumi airport welcome, expressway transfer to Pattaya beachfront hotel, evening Alcazar show." },
      { day: "Day 2", title: "Coral Island Speedboat Tour", desc: "Speedboat ride to Koh Larn, crystal waters, watersports, and beachside lunch buffet." },
      { day: "Day 3", title: "Pattaya to Bangkok & Temple Tour", desc: "Scenic transfer to Bangkok, tour Golden Buddha and Reclining Buddha temples, riverside night market." },
      { day: "Day 4", title: "Bangkok Shopping & Chao Phraya Dinner", desc: "Leisure day for world-class shopping at MBK & CentralWorld, luxury Chao Phraya Princess dinner cruise." },
      { day: "Day 5", title: "Departure", desc: "Breakfast, duty-free shopping at airport, and return flight to India." },
    ],
  },
];

const CATEGORIES = [
  { key: "ALL", label: "All Packages" },
  { key: "SACRED", label: "Sacred Journeys" },
  { key: "PARENTS", label: "Gift for Parents" },
  { key: "HILLS", label: "Hills & Nature" },
  { key: "BEACH", label: "Beaches & Coastal" },
  { key: "INTERNATIONAL", label: "International" },
];

export default function IxigoHolidaySection({
  externalCategory,
  onSelectCategory,
  hideSearchBar = false,
  hideCategoryPills = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [internalCategory, setInternalCategory] = useState("ALL");
  const activeCategory = externalCategory !== undefined ? externalCategory : internalCategory;
  const setActiveCategory = onSelectCategory || setInternalCategory;
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [dynamicPackages, setDynamicPackages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch dynamic packages uploaded by Admin in TriApp (tri-holidays)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await API.get("/business/tri/apps/tri-holidays/");
        if (alive && res?.data?.products && Array.isArray(res.data.products) && res.data.products.length > 0) {
          const MEDIA_BASE = String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");
          const mapped = res.data.products.map((p, idx) => ({
            id: `dyn-${p.id || idx}`,
            title: p.name,
            destination: p.name.split("-")[0]?.trim() || "India",
            duration: p.description?.match(/\d+N\s*\/\s*\d+D/i)?.[0] || "3N / 4D",
            category: "ALL",
            categoryLabel: "Special Tour",
            image: p.image_url || p.image ? (p.image_url || `${MEDIA_BASE}${p.image}`) : imgHolidays,
            price: Number(p.price || 0),
            priceDisplay: `₹${Number(p.price || 0).toLocaleString("en-IN")} onwards`,
            bookingToken: "₹250",
            inclusions: ["AC Transfers", "Hotel Accommodation", "Daily Meals", "Sightseeing"],
            inclusionsShort: "Cab • Hotel • Meals • Sightseeing",
            highlights: [p.description || "Curated holiday tour managed by Asiayapp."],
            itinerary: [
              { day: "Day 1", title: "Arrival & Check-in", desc: "Arrival at destination, private transfer to hotel, leisure evening." },
              { day: "Day 2", title: "Guided Sightseeing", desc: "Full day sightseeing with professional local guide and meal inclusions." },
              { day: "Day 3", title: "Local Exploration & Departure", desc: "Shopping, checkout, and transfer for return journey." },
            ],
          }));
          setDynamicPackages(mapped);
        }
      } catch (_) {
        // Fallback gracefully to curated packages
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Merge dynamic packages with curated Ixigo packages
  const allPackages = useMemo(() => {
    return [...dynamicPackages, ...CURATED_PACKAGES];
  }, [dynamicPackages]);

  // Filter packages by search and category
  const filteredPackages = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allPackages.filter((pkg) => {
      const matchCat =
        activeCategory === "ALL" ||
        (activeCategory === "PARENTS" ? pkg.parentGift : pkg.category === activeCategory);

      const matchSearch =
        !q ||
        pkg.title.toLowerCase().includes(q) ||
        pkg.destination.toLowerCase().includes(q) ||
        pkg.categoryLabel.toLowerCase().includes(q);

      return matchCat && matchSearch;
    });
  }, [allPackages, searchTerm, activeCategory]);

  return (
    <Box id="ixigo-holiday-packages" sx={{ width: "100%", my: 1.5 }}>
      {/* 1. FLOATING DESTINATION SEARCH BAR */}
      {!hideSearchBar && (
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            p: "6px 14px",
            display: "flex",
            alignItems: "center",
            borderRadius: "16px",
            bgcolor: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
            "&:focus-within": {
              borderColor: "#2563eb",
              boxShadow: "0 4px 16px rgba(37, 99, 235, 0.12)",
            },
          }}
        >
          <SearchRoundedIcon sx={{ fontSize: 20, color: "#64748b", mr: 1 }} />
          <InputBase
            placeholder="Search destinations (e.g. Munnar, Vaishno Devi)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              flex: 1,
              fontSize: 13.5,
              fontWeight: 500,
              color: "#0f172a",
              "& input::placeholder": {
                color: "#94a3b8",
                opacity: 1,
              },
            }}
          />
          <IconButton size="small" sx={{ color: "#64748b", p: 0.5 }}>
            <TuneRoundedIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Paper>
      )}

      {/* 2. CATEGORY ACTION CARDS */}
      {!hideCategoryPills && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: { xs: 1, sm: 1.5 },
            mb: 2.5,
          }}
        >
          {[
            {
              key: "ALL",
              label: "All Packages",
              icon: AutoAwesomeRoundedIcon,
              bgColor: "#EFF6FF",
              iconColor: "#1E40AF",
              textColor: "#1E3A8A",
            },
            {
              key: "SACRED",
              label: "Sacred Journeys",
              icon: TempleHinduRoundedIcon,
              bgColor: "#F5F3FF",
              iconColor: "#7C3AED",
              textColor: "#5B21B6",
            },
            {
              key: "PARENTS",
              label: "Gift for Parents",
              icon: CardGiftcardRoundedIcon,
              bgColor: "#FFF1F2",
              iconColor: "#E11D48",
              textColor: "#9F1239",
            },
            {
              key: "HILLS",
              label: "Family Vacations",
              icon: BeachAccessRoundedIcon,
              bgColor: "#ECFDF5",
              iconColor: "#059669",
              textColor: "#065F46",
            },
          ].map((item) => {
            const isSelected = activeCategory === item.key;
            const IconComponent = item.icon;
            return (
              <Paper
                key={item.key}
                elevation={0}
                onClick={() => setActiveCategory(item.key)}
                sx={{
                  p: { xs: 1.25, sm: 1.5 },
                  borderRadius: "18px",
                  bgcolor: isSelected ? "#ffffff" : item.bgColor,
                  border: isSelected ? "2px solid #1E40AF" : "1px solid rgba(0,0,0,0.04)",
                  boxShadow: isSelected
                    ? "0 6px 18px rgba(30, 64, 175, 0.18)"
                    : "0 2px 6px rgba(15, 23, 42, 0.03)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 0.75,
                  cursor: "pointer",
                  transition: "all 180ms ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.08)",
                  },
                  "&:active": {
                    transform: "scale(0.96)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: { xs: 36, sm: 42 },
                    height: { xs: 36, sm: 42 },
                    borderRadius: "12px",
                    bgcolor: isSelected ? item.bgColor : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  }}
                >
                  <IconComponent sx={{ fontSize: { xs: 20, sm: 22 }, color: item.iconColor }} />
                </Box>
                <Typography
                  sx={{
                    fontSize: { xs: 11, sm: 12 },
                    fontWeight: 800,
                    color: isSelected ? "#1E40AF" : item.textColor,
                    lineHeight: 1.2,
                    whiteSpace: "normal",
                  }}
                >
                  {item.label}
                </Typography>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* 3. SECTION HEADER */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75, px: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 4,
              height: 18,
              borderRadius: 2,
              background: "linear-gradient(to bottom, #1E40AF, #06B6D4)",
            }}
          />
          <Typography sx={{ fontSize: { xs: 16, sm: 17 }, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
            Popular Holiday Packages
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            size="small"
            label={`${filteredPackages.length} Packages`}
            sx={{
              height: 22,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: "#f1f5f9",
              color: "#475569",
            }}
          />
          <Typography
            onClick={() => {
              setActiveCategory("ALL");
              setSearchTerm("");
            }}
            sx={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#1E40AF",
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            View all →
          </Typography>
        </Stack>
      </Stack>

      {/* 4. CURATED HOLIDAY PACKAGE CARDS (HORIZONTAL SCROLL ON MOBILE, GRID ON TABLET/DESKTOP) */}
      <Box
        sx={{
          display: { xs: "flex", sm: "grid" },
          gridTemplateColumns: { sm: "repeat(2, 1fr)" },
          gap: { xs: 1.75, sm: 2 },
          width: "100%",
          overflowX: { xs: "auto", sm: "visible" },
          pb: { xs: 1, sm: 0 },
          px: { xs: 0.5, sm: 0 },
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {filteredPackages.map((pkg) => (
          <Paper
            key={pkg.id}
            elevation={0}
            onClick={() => setSelectedPackage(pkg)}
            sx={{
              minWidth: { xs: "270px", sm: "auto" },
              maxWidth: { xs: "285px", sm: "none" },
              flexShrink: 0,
              width: "100%",
              borderRadius: "20px",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              bgcolor: "#ffffff",
              boxShadow: "0 4px 18px rgba(15, 23, 42, 0.05)",
              cursor: "pointer",
              transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
                borderColor: "#cbd5e1",
              },
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Photo & Badges */}
            <Box
              sx={{
                position: "relative",
                width: "100%",
                height: { xs: 150, sm: 190 },
                overflow: "hidden",
                bgcolor: "#0f172a",
              }}
            >
              <Box
                component="img"
                src={pkg.image}
                alt={pkg.title}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "transform 400ms ease",
                  "&:hover": { transform: "scale(1.05)" },
                }}
              />

              {/* Category Pill (Top Left) */}
              <Chip
                size="small"
                label={pkg.parentGift ? "GIFT FOR PARENTS" : pkg.category === "SACRED" ? "SACRED JOURNEY" : pkg.categoryLabel?.toUpperCase() || "FEATURED"}
                sx={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  height: 24,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  color: "#ffffff",
                  background: pkg.parentGift
                    ? "linear-gradient(135deg, #f97316 0%, #ea580c 100%)"
                    : pkg.category === "SACRED"
                    ? "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)"
                    : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  border: "none",
                  zIndex: 2,
                }}
              />

              {/* Top Right: Duration + Favorite Button */}
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ position: "absolute", top: 10, right: 10, zIndex: 2 }}>
                <Box
                  sx={{
                    px: 1,
                    py: 0.35,
                    borderRadius: "8px",
                    bgcolor: "rgba(15, 23, 42, 0.75)",
                    backdropFilter: "blur(6px)",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 800,
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {pkg.duration}
                </Box>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: "#ffffff",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    color: "#1E40AF",
                    "&:hover": { bgcolor: "#f8fafc" },
                  }}
                >
                  <FavoriteBorderIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            </Box>

            {/* Content Section */}
            <Box sx={{ p: { xs: 1.75, sm: 2 }, display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
              <Box>
                {/* Location */}
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                  <LocationOnRoundedIcon sx={{ fontSize: 14, color: "#1E40AF" }} />
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#64748b" }} noWrap>
                    {pkg.destination}
                  </Typography>
                </Stack>

                {/* Title */}
                <Typography
                  sx={{
                    fontSize: { xs: 15, sm: 16 },
                    fontWeight: 800,
                    color: "#0f172a",
                    lineHeight: 1.3,
                    mb: 1.25,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: "42px",
                  }}
                >
                  {pkg.title}
                </Typography>

                {/* Amenities Row */}
                <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
                  <Chip
                    icon={<DirectionsCarRoundedIcon sx={{ fontSize: "13px !important", color: "#1E40AF !important" }} />}
                    label="Cab"
                    size="small"
                    sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 10.5, fontWeight: 700, color: "#475569", height: 24 }}
                  />
                  <Chip
                    icon={<HotelRoundedIcon sx={{ fontSize: "13px !important", color: "#1E40AF !important" }} />}
                    label="Hotel"
                    size="small"
                    sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 10.5, fontWeight: 700, color: "#475569", height: 24 }}
                  />
                  <Chip
                    icon={<RestaurantRoundedIcon sx={{ fontSize: "13px !important", color: "#1E40AF !important" }} />}
                    label="Meals"
                    size="small"
                    sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 10.5, fontWeight: 700, color: "#475569", height: 24 }}
                  />
                  <Chip
                    icon={<FlightTakeoffRoundedIcon sx={{ fontSize: "13px !important", color: "#1E40AF !important" }} />}
                    label="Sightseeing"
                    size="small"
                    sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 10.5, fontWeight: 700, color: "#475569", height: 24 }}
                  />
                </Stack>
              </Box>

              {/* Price & Action Row */}
              <Box sx={{ pt: 1, borderTop: "1px solid #f1f5f9" }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em" }}>
                      {pkg.priceDisplay}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>
                      Per person • All transfers & stays
                    </Typography>
                  </Box>

                  <Box
                    onClick={() => setSelectedPackage(pkg)}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      bgcolor: "#1E40AF",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 3px 10px rgba(30, 64, 175, 0.3)",
                      cursor: "pointer",
                      transition: "transform 140ms ease, background-color 140ms ease",
                      "&:hover": {
                        bgcolor: "#1E3A8A",
                        transform: "scale(1.06)",
                      },
                    }}
                  >
                    <ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* 5. IXIGO HOLIDAY EXPERT SUPPORT BANNER (Bottom) */}
      <Paper
        elevation={0}
        sx={{
          mt: 3,
          p: { xs: 2, sm: 2.5 },
          borderRadius: "18px",
          background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
          border: "1px solid #fed7aa",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: "14px",
              bgcolor: "#ea580c",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(234, 88, 12, 0.35)",
            }}
          >
            <PhoneInTalkRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#9a3412" }}>
              Need help with your holiday booking?
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: "#c2410c", fontWeight: 600 }}>
              Speak with certified travel consultants for customized itineraries & group bookings.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
          <Button
            variant="contained"
            component="a"
            href="tel:08068243903"
            startIcon={<PhoneInTalkRoundedIcon />}
            sx={{
              flex: { xs: 1, sm: "none" },
              bgcolor: "#ea580c",
              "&:hover": { bgcolor: "#c2410c" },
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 13,
              borderRadius: "10px",
              textTransform: "none",
              py: 0.8,
              px: 2,
            }}
          >
            Call 08068243903
          </Button>
          <Button
            variant="outlined"
            component="a"
            href="https://wa.me/918095918103?text=Hi%2C+I+want+to+know+more+about+Asiayapp+Holiday+Packages"
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<ChatBubbleRoundedIcon />}
            sx={{
              flex: { xs: 1, sm: "none" },
              borderColor: "#ea580c",
              color: "#c2410c",
              fontWeight: 800,
              fontSize: 13,
              borderRadius: "10px",
              textTransform: "none",
              py: 0.8,
              px: 2,
              bgcolor: "#ffffff",
              "&:hover": { bgcolor: "#fff7ed", borderColor: "#c2410c" },
            }}
          >
            WhatsApp
          </Button>
        </Stack>
      </Paper>

      {/* 6. IXIGO PACKAGE DETAILS DIALOG */}
      <Dialog
        open={Boolean(selectedPackage)}
        onClose={() => setSelectedPackage(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "24px",
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(15,23,42,0.25)",
            m: { xs: 1, sm: 2 },
          },
        }}
      >
        {selectedPackage && (
          <>
            {/* Modal Header Photo */}
            <Box sx={{ position: "relative", width: "100%", height: 210, bgcolor: "#0f172a" }}>
              <Box
                component="img"
                src={selectedPackage.image}
                alt={selectedPackage.title}
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <IconButton
                onClick={() => setSelectedPackage(null)}
                sx={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  bgcolor: "rgba(0,0,0,0.6)",
                  color: "#ffffff",
                  backdropFilter: "blur(6px)",
                  "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
                }}
              >
                <CloseRoundedIcon />
              </IconButton>

              <Box
                sx={{
                  position: "absolute",
                  bottom: 12,
                  left: 14,
                  bgcolor: "rgba(15, 23, 42, 0.85)",
                  backdropFilter: "blur(6px)",
                  color: "#ffffff",
                  px: 1.25,
                  py: 0.4,
                  borderRadius: "8px",
                  fontSize: 11.5,
                  fontWeight: 800,
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {selectedPackage.duration} • {selectedPackage.destination}
              </Box>
            </Box>

            <DialogContent sx={{ p: { xs: 2.25, sm: 3 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#0f172a", lineHeight: 1.3 }}>
                    {selectedPackage.title}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#64748b", fontWeight: 600, mt: 0.5 }}>
                    Package Code: #{selectedPackage.id} • {selectedPackage.categoryLabel}
                  </Typography>
                </Box>

                <Divider />

                {/* Key Inclusions */}
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", mb: 1 }}>
                    Package Inclusions & Amenities
                  </Typography>
                  <Grid container spacing={1}>
                    {selectedPackage.inclusions.map((inc, i) => (
                      <Grid item xs={12} sm={6} key={i}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CheckCircleRoundedIcon sx={{ fontSize: 16, color: "#16a34a" }} />
                          <Typography sx={{ fontSize: 12.5, color: "#334155", fontWeight: 600 }}>
                            {inc}
                          </Typography>
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                <Divider />

                {/* Day-wise Itinerary */}
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", mb: 1 }}>
                    Day-by-Day Itinerary Highlights
                  </Typography>
                  <Stack spacing={1.25}>
                    {selectedPackage.itinerary.map((it, idx) => (
                      <Paper
                        key={idx}
                        elevation={0}
                        sx={{
                          p: 1.25,
                          borderRadius: "12px",
                          bgcolor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>
                          {it.day}: {it.title}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: "#475569", mt: 0.25 }}>
                          {it.desc}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Box>

                <Divider />

                {/* Pricing & Booking CTA */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: "14px",
                    bgcolor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: 11, color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>
                      All-Inclusive Package Price
                    </Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#15803d" }}>
                      {selectedPackage.priceDisplay}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: "#15803d" }}>
                      Taxes & fees included • Instant booking confirmation
                    </Typography>
                  </Box>

                  <Button
                    variant="contained"
                    component="a"
                    href={`https://wa.me/918095918103?text=Hi%2C+I+want+to+book+the+${encodeURIComponent(selectedPackage.title)}+package`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      bgcolor: "#16a34a",
                      "&:hover": { bgcolor: "#15803d" },
                      fontWeight: 800,
                      fontSize: 12.5,
                      textTransform: "none",
                      borderRadius: "10px",
                      px: 2,
                    }}
                  >
                    Enquire Now
                  </Button>
                </Paper>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
