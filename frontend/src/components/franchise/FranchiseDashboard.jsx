import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../api/api";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

// Icons
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AgricultureRoundedIcon from "@mui/icons-material/AgricultureRounded";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import ConfirmationNumberRoundedIcon from "@mui/icons-material/ConfirmationNumberRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/CurrencyRupeeRounded";
import DirectionsBusRoundedIcon from "@mui/icons-material/DirectionsBusRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ExploreRoundedIcon from "@mui/icons-material/ExploreRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HomeWorkRoundedIcon from "@mui/icons-material/HomeWorkRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LocalGroceryStoreRoundedIcon from "@mui/icons-material/LocalGroceryStoreRounded";
import LocalHospitalRoundedIcon from "@mui/icons-material/LocalHospitalRounded";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import PhoneAndroidRoundedIcon from "@mui/icons-material/PhoneAndroidRounded";
import PolicyRoundedIcon from "@mui/icons-material/PolicyRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SetMealRoundedIcon from "@mui/icons-material/SetMealRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import SouthEastRoundedIcon from "@mui/icons-material/SouthEastRounded";
import SpaRoundedIcon from "@mui/icons-material/SpaRounded";
import StoreOutlinedIcon from "@mui/icons-material/StoreOutlined";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";

const COLORS = {
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  primaryLight: "#EEF2FF",
  secondary: "#0284C7",
  success: "#10B981",
  successLight: "#ECFDF5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  danger: "#EF4444",
  dangerLight: "#FEF2F2",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
};

// 18 Master TriZone Categories
const TRIZONE_CATEGORIES = [
  { id: "all", name: "All Categories", icon: <StoreRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_basket", name: "Grocery (Tri Basket)", icon: <LocalGroceryStoreRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_eat", name: "Food & Dining (Tri Eat)", icon: <RestaurantRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_rides", name: "Rides (Tri Rides)", icon: <DirectionsCarRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_bills", name: "Bills & Recharge", icon: <PhoneAndroidRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_hotels", name: "Hotels & Stays", icon: <ApartmentOutlinedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_travel", name: "Travel & Tours", icon: <FlightTakeoffRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_entertainment", name: "Entertainment", icon: <ConfirmationNumberRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_health", name: "Health & Pharma", icon: <LocalHospitalRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_electronics", name: "Electronics & Gadgets", icon: <ComputerRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_fashion", name: "Fashion & Lifestyle", icon: <ShoppingBagOutlinedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_beauty", name: "Beauty & Spa", icon: <SpaRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_home", name: "Home & Kitchen", icon: <HomeWorkRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_meat", name: "Meat & Fish", icon: <SetMealRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_services", name: "Home Services", icon: <CleaningServicesRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_education", name: "e-Edu & Courses", icon: <SchoolRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_realestate", name: "Real Estate", icon: <HomeRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_automobile", name: "Automobiles", icon: <DirectionsBusRoundedIcon sx={{ fontSize: 18 }} /> },
  { id: "tri_agriculture", name: "Agriculture", icon: <AgricultureRoundedIcon sx={{ fontSize: 18 }} /> },
];

function fmtCurrency(v) {
  try {
    const n = Number(v || 0);
    return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  } catch {
    return `₹${v || 0}`;
  }
}

export default function FranchiseDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Navigation Sub-tab: 'dashboard' | 'merchants' | 'packages' | 'wallet' | 'ledger' | 'hierarchy'
  const [activeTab, setActiveTab] = useState("dashboard");

  // Read Agency Session
  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_agency") || sessionStorage.getItem("user_agency");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const agencyCategory = (storedUser?.category || "agency_pincode").toLowerCase();
  const userPincode = storedUser?.pincode || "586101";
  const userName = storedUser?.full_name || storedUser?.name || "SAVITRI BIRADAR";
  const userCode = storedUser?.username || "TRPN9611443183";
  const userInitials = useMemo(() => {
    const p = String(userName || "SB").trim().split(" ");
    return `${p[0]?.[0] || "S"}${p[1]?.[0] || "B"}`.toUpperCase();
  }, [userName]);

  // Role Scope Flags
  const isCoordinator = agencyCategory.includes("coordinator");
  const isDistrictAgency = agencyCategory.includes("district");
  const isStateAgency = agencyCategory.includes("state");

  // Multi-Pincode Cluster for Coordinators / District Franchisees
  const assignedPincodesList = useMemo(() => [
    { pincode: userPincode, name: `${userPincode} (Primary Hub)`, merchants: 142, potential: 350, gtv: "₹34.8L", earnings: "₹69,600", activeCaptains: 12 },
    { pincode: "560073", name: "560073 (Bangalore North)", merchants: 98, potential: 280, gtv: "₹24.2L", earnings: "₹48,400", activeCaptains: 8 },
    { pincode: "560074", name: "560074 (Kumbalgodu Hub)", merchants: 76, potential: 210, gtv: "₹18.5L", earnings: "₹37,000", activeCaptains: 6 },
    { pincode: "560057", name: "560057 (Peenya Industrial)", merchants: 114, potential: 400, gtv: "₹42.1L", earnings: "₹84,200", activeCaptains: 10 },
  ], [userPincode]);

  // Territory Selection State (Drill-Down)
  const [selectedState, setSelectedState] = useState("Karnataka");
  const [selectedDistrict, setSelectedDistrict] = useState("Vijayapura");
  const [selectedPincode, setSelectedPincode] = useState("all"); // 'all' or specific pincode
  const [opportunityViewMode, setOpportunityViewMode] = useState("live"); // 'live' | 'pre_ownership'

  // Search & Filter state
  const [merchantSearch, setMerchantSearch] = useState("");
  const [merchantTypeFilter, setMerchantTypeFilter] = useState("all"); // 'all', 'b2c', 'b2b', 'trizone'
  const [merchantStatusFilter, setMerchantStatusFilter] = useState("all"); // 'all', 'active', 'inactive'
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Selected Merchant for Details
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [merchantDetailTab, setMerchantDetailTab] = useState("overview");

  // Balance visibility toggle
  const [showBalance, setShowBalance] = useState(true);

  // Add Merchant & Register Captain Modals
  const [openAddMerchantModal, setOpenAddMerchantModal] = useState(false);
  const [merchantStep, setMerchantStep] = useState(1);
  const [newMerchantData, setNewMerchantData] = useState({
    storeName: "",
    ownerName: "",
    mobile: "",
    address: "",
    category: "tri_basket",
    type: "B2C",
    pincode: userPincode,
  });

  const [openAddCaptainModal, setOpenAddCaptainModal] = useState(false);
  const [captainStep, setCaptainStep] = useState(1);
  const [newCaptainData, setNewCaptainData] = useState({
    name: "",
    mobile: "",
    gender: "Male",
    pincode: userPincode,
    locality: "",
  });

  // Wallet and Metrics
  const [metrics, setMetrics] = useState({
    total_pincodes: assignedPincodesList.length,
    total_captains: 36,
    active_captains: 31,
    inactive_captains: 5,
    total_merchants: 430,
    total_addressable_merchants: 1240,
    trizone_stores: 14,
    b2c_merchants: 348,
    b2b_merchants: 68,
    market_penetration_pct: 34.6,
    monthly_gtv: "₹1,19,60,000",
    monthly_earnings: "₹2,39,200",
    new_leads_pipeline: 84,
  });

  const [wallet, setWallet] = useState({
    balance: "14850.75",
    main_wallet: "11138.06", // 75%
    self_account_pocket: "3712.69", // 25% for Rebirth
    rebirth_nodes_spawned: 14,
    total_received: "125430.00",
    total_spent: "102979.00",
    today: "3450.00",
  });

  // Digital Education Packages (`tri-academy` / trieducation.in)
  const [eduPackageStats, setEduPackageStats] = useState({
    totalStarterSold: 248, // Track 1 (₹2,000)
    totalSuperAgentSold: 42, // Track 2 (₹8,000)
    totalPromotersSold: 12, // Track 3 (₹40,000)
    royaltyPromotersCount: 14, // ≥ ₹50k Volume Qualifiers
    midnightRoyaltyPool: "₹48,250.00",
    rebirthPoolVelocity: "28 Rebirths/Day",
    layerBreakdown: [
      { layer: "Layer 1 (Rank 1)", count: 248, track: "Track 1 Foundation (₹2k)", pct: 100, color: "#4F46E5" },
      { layer: "Layer 2 (Rank 2)", count: 184, track: "Part 1 Leadership (₹4.75k)", pct: 74, color: "#6366F1" },
      { layer: "Layer 3 (Rank 3)", count: 122, track: "Part 1 Leadership (₹4.75k)", pct: 49, color: "#818CF8" },
      { layer: "Layer 4 (Rank 4)", count: 86, track: "Part 1 Leadership (₹4.75k)", pct: 34, color: "#0284C7" },
      { layer: "Layer 5 (Rank 5)", count: 54, track: "Part 1 Leadership (₹4.75k)", pct: 21, color: "#0EA5E9" },
      { layer: "Layer 6 (Rank 6)", count: 32, track: "Part 2 Leadership (₹3.25k)", pct: 13, color: "#059669" },
      { layer: "Layer 7 (Rank 7)", count: 21, track: "Part 2 Leadership (₹3.25k)", pct: 8.5, color: "#10B981" },
      { layer: "Layer 8 (Rank 8)", count: 14, track: "Tranche 1 DAP (₹5k)", pct: 5.6, color: "#D97706" },
      { layer: "Layer 9 (Rank 9)", count: 8, track: "Tranche 2 DAP (₹10k)", pct: 3.2, color: "#F59E0B" },
      { layer: "Layer 10 (Rank 10)", count: 4, track: "Tranche 3 DAP (₹25k)", pct: 1.6, color: "#EA580C" },
    ],
    promoterQualifiers: [
      { id: "U-9901", name: "Ramesh Patil", mobile: "9845012345", pincode: "560073", rank: "Rank 10 DAP", volume: "₹50,000", dailyRoyalty: "₹1,450.00" },
      { id: "U-9902", name: "Anand Biradar", mobile: "9880098765", pincode: "586101", rank: "Rank 9 Promoter", volume: "₹50,000", dailyRoyalty: "₹1,450.00" },
      { id: "U-9903", name: "Suresh Hegde", mobile: "9448123456", pincode: "560057", rank: "Rank 8 Promoter", volume: "₹50,000", dailyRoyalty: "₹1,450.00" },
      { id: "U-9904", name: "Vijay Kumar", mobile: "9900112233", pincode: "560074", rank: "Rank 8 Promoter", volume: "₹50,000", dailyRoyalty: "₹1,450.00" },
    ],
  });

  // Category Distribution & Market Opportunities
  const categoryMarketData = useMemo(() => [
    { id: "tri_basket", name: "Grocery (Tri Basket)", count: 146, addressable: 420, pct: 34.7, gtv: "₹48.5L", color: "#10B981", icon: "🛒" },
    { id: "tri_eat", name: "Food & Dining (Tri Eat)", count: 98, addressable: 260, pct: 37.6, gtv: "₹28.4L", color: "#F97316", icon: "🍔" },
    { id: "tri_electronics", name: "Electronics & Gadgets", count: 42, addressable: 110, pct: 38.1, gtv: "₹19.2L", color: "#3B82F6", icon: "💻" },
    { id: "tri_fashion", name: "Fashion & Lifestyle", count: 56, addressable: 180, pct: 31.1, gtv: "₹14.8L", color: "#EC4899", icon: "👗" },
    { id: "tri_health", name: "Health & Pharma", count: 32, addressable: 95, pct: 33.6, gtv: "₹8.9L", color: "#059669", icon: "💊" },
    { id: "tri_automobile", name: "Automobile & Services", count: 28, addressable: 85, pct: 32.9, gtv: "₹5.6L", color: "#8B5CF6", icon: "🚗" },
    { id: "tri_services", name: "Home & Local Services", count: 28, addressable: 90, pct: 31.1, gtv: "₹4.2L", color: "#64748B", icon: "🔧" },
  ], []);

  // Merchants Data
  const [merchantsList, setMerchantsList] = useState([
    {
      id: "M-101",
      name: "Blink Quick Store",
      owner: "Suresh Kumar",
      mobile: "9876543210",
      category: "tri_basket",
      categoryName: "Grocery (Tri Basket)",
      type: "B2C",
      pincode: "560073",
      status: "Active",
      totalTransactions: 1248,
      totalSpend: "₹4,28,950",
      joinedOn: "12 May 2026",
      address: "Shop 14, Main Cross, Peenya North, 560073",
      image: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80",
      lastTx: { date: "Today, 10:24 AM", amount: "₹840.00" },
    },
    {
      id: "M-102",
      name: "Fresh Veggies Express",
      owner: "Rajesh Patil",
      mobile: "9845012345",
      category: "tri_basket",
      categoryName: "Grocery (Tri Basket)",
      type: "B2C",
      pincode: userPincode,
      status: "Active",
      totalTransactions: 890,
      totalSpend: "₹2,10,400",
      joinedOn: "01 Jun 2026",
      address: "Station Road, Near Bus Stand, Vijayapura, 586101",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80",
      lastTx: { date: "Today, 09:15 AM", amount: "₹320.00" },
    },
    {
      id: "M-103",
      name: "Royal Kitchen Restaurant",
      owner: "Mohammed Irfan",
      mobile: "9741234567",
      category: "tri_eat",
      categoryName: "Food & Dining (Tri Eat)",
      type: "B2C",
      pincode: "560073",
      status: "Active",
      totalTransactions: 1560,
      totalSpend: "₹6,80,000",
      joinedOn: "18 Apr 2026",
      address: "Opp. City Central Mall, 560073",
      image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&auto=format&fit=crop&q=80",
      lastTx: { date: "Yesterday, 08:30 PM", amount: "₹1,450.00" },
    },
    {
      id: "M-104",
      name: "Sri Lakshmi Wholesale Traders",
      owner: "Basavaraj Gowda",
      mobile: "9880011223",
      category: "tri_basket",
      categoryName: "B2B Wholesaler (FMCG)",
      type: "B2B",
      pincode: "560057",
      status: "Active",
      totalTransactions: 340,
      totalSpend: "₹18,40,000",
      joinedOn: "10 Feb 2026",
      address: "APMC Yard, Warehouse Block B, 560057",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200&auto=format&fit=crop&q=80",
      lastTx: { date: "06 Oct 2026, 04:12 PM", amount: "₹45,000.00" },
    },
    {
      id: "M-105",
      name: "TriZone Experience Center Hub",
      owner: "Trikonekt Flagship Partner",
      mobile: "9611443183",
      category: "tri_electronics",
      categoryName: "TriZone Store (Electronics)",
      type: "TriZone",
      pincode: userPincode,
      status: "Active",
      totalTransactions: 2100,
      totalSpend: "₹12,65,000",
      joinedOn: "15 Jan 2026",
      address: "Ground Floor, Commercial Plaza, Vijayapura, 586101",
      image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&auto=format&fit=crop&q=80",
      lastTx: { date: "Today, 11:05 AM", amount: "₹3,999.00" },
    },
  ]);

  // Transactions Ledger Data
  const [transactionsList, setTransactionsList] = useState([
    {
      id: "tx-101",
      amount: 420.0,
      type: "Credit",
      category: "Geo-Pool Share",
      title: "Pincode 560073 Prime Joining Pool Share",
      date: "07 Oct 2026 • 10:28 AM",
      badgeColor: "#10B981",
      badgeBg: "#ECFDF5",
      icon: <ShoppingCartRoundedIcon sx={{ fontSize: 18, color: "#10B981" }} />,
    },
    {
      id: "tx-102",
      amount: 1200.0,
      type: "Credit",
      category: "e-Edu Track",
      title: "Track 1 Starter Bundle Sales Commission (LMS)",
      date: "07 Oct 2026 • 09:15 AM",
      badgeColor: "#4F46E5",
      badgeBg: "#EEF2FF",
      icon: <SchoolRoundedIcon sx={{ fontSize: 18, color: "#4F46E5" }} />,
    },
    {
      id: "tx-103",
      amount: 850.0,
      type: "Credit",
      category: "Merchant QR",
      title: "Blink Quick Store QR Scan Override",
      date: "06 Oct 2026 • 07:42 PM",
      badgeColor: "#10B981",
      badgeBg: "#ECFDF5",
      icon: <QrCode2RoundedIcon sx={{ fontSize: 18, color: "#10B981" }} />,
    },
    {
      id: "tx-104",
      amount: 2500.0,
      type: "Credit",
      category: "B2B Spread",
      title: "Sri Lakshmi Wholesale FMCG Order #TR8832",
      date: "05 Oct 2026 • 06:10 PM",
      badgeColor: "#0284C7",
      badgeBg: "#F0F9FF",
      icon: <BusinessCenterRoundedIcon sx={{ fontSize: 18, color: "#0284C7" }} />,
    },
    {
      id: "tx-105",
      amount: -5000.0,
      type: "Debit",
      category: "Withdrawal",
      title: "Instant Bank Payout to HDFC A/C ••4102",
      date: "04 Oct 2026 • 11:22 AM",
      badgeColor: "#EF4444",
      badgeBg: "#FEF2F2",
      icon: <SouthEastRoundedIcon sx={{ fontSize: 18, color: "#EF4444" }} />,
    },
  ]);

  // Filtered Merchants
  const filteredMerchants = useMemo(() => {
    return merchantsList.filter((m) => {
      const matchPincode = selectedPincode === "all" || m.pincode === selectedPincode;
      const matchStatus =
        merchantStatusFilter === "all" ||
        m.status.toLowerCase() === merchantStatusFilter.toLowerCase();
      const matchType =
        merchantTypeFilter === "all" ||
        m.type.toLowerCase().includes(merchantTypeFilter.toLowerCase());
      const matchCat =
        selectedCategory === "all" || m.category === selectedCategory;
      const matchSearch =
        !merchantSearch ||
        m.name.toLowerCase().includes(merchantSearch.toLowerCase()) ||
        m.owner.toLowerCase().includes(merchantSearch.toLowerCase()) ||
        m.mobile.includes(merchantSearch) ||
        m.id.toLowerCase().includes(merchantSearch.toLowerCase()) ||
        m.pincode.includes(merchantSearch);
      return matchPincode && matchStatus && matchType && matchCat && matchSearch;
    });
  }, [merchantsList, selectedPincode, merchantStatusFilter, merchantTypeFilter, selectedCategory, merchantSearch]);

  const activeFilterCount = useMemo(() => {
    let cnt = 0;
    if (merchantTypeFilter !== "all") cnt++;
    if (merchantStatusFilter !== "all") cnt++;
    if (selectedCategory !== "all") cnt++;
    if (selectedPincode !== "all") cnt++;
    return cnt;
  }, [merchantTypeFilter, merchantStatusFilter, selectedCategory, selectedPincode]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, pb: { xs: 11, md: 5 } }}>
      {/* ── DESKTOP TABS (Enterprise 6-Module Hub) ── */}
      <Box sx={{ display: { xs: "none", md: "block" }, bgcolor: "#FFFFFF", borderBottom: "1px solid #E2E8F0", px: 3, position: "sticky", top: 0, zIndex: 100 }}>
        <Container maxWidth="xl" disableGutters>
          <Tabs
            value={activeTab}
            onChange={(_, v) => {
              setActiveTab(v);
              setSelectedMerchant(null);
            }}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              "& .MuiTab-root": {
                fontWeight: 800,
                fontSize: 13.5,
                textTransform: "none",
                minHeight: 52,
                px: 2.2,
              },
            }}
          >
            <Tab value="dashboard" label="Territory Intelligence" icon={<InsightsRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab value="merchants" label="Merchants & Captains" icon={<StoreRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab value="packages" label="e-Edu & Layer Engine" icon={<SchoolRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab value="wallet" label="Master Wallet & Earnings" icon={<AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab value="ledger" label="Transaction Ledger" icon={<HistoryRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab value="hierarchy" label="Territory Command" icon={<LocationOnRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
        {/* =========================================================================
            TERRITORY JURISDICTION SELECTOR & DRILL-DOWN BAR (Global)
        ========================================================================= */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.75, sm: 2 },
            borderRadius: "18px",
            bgcolor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
            mb: 2.5,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={1.5}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "12px",
                  bgcolor: "#EEF2FF",
                  color: "#4F46E5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ExploreRoundedIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ fontSize: 15, fontWeight: 950, color: "#0F172A" }}>
                    {isCoordinator ? "Multi-Pincode Zone Command" : "Assigned Pincode Hub"}
                  </Typography>
                  <Chip
                    label={isCoordinator ? "Coordinator Scope" : `${userPincode}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 10.5,
                      fontWeight: 900,
                      bgcolor: "#EEF2FF",
                      color: "#4F46E5",
                    }}
                  />
                </Stack>
                <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                  {selectedState} • {selectedDistrict} {selectedPincode !== "all" ? `• Pincode ${selectedPincode}` : "• Aggregated Zone"}
                </Typography>
              </Box>
            </Stack>

            {/* Pincode Drill-down Selector */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
              <FormControl size="small" sx={{ minWidth: 190, width: { xs: "100%", sm: "auto" } }}>
                <Select
                  value={selectedPincode}
                  onChange={(e) => setSelectedPincode(e.target.value)}
                  sx={{
                    borderRadius: "12px",
                    fontWeight: 800,
                    fontSize: 12.5,
                    bgcolor: "#F8FAFC",
                    "& .MuiSelect-select": { py: 0.8 },
                  }}
                >
                  <MenuItem value="all" sx={{ fontWeight: 800, fontSize: 12.5 }}>
                    🌐 All Assigned Pincodes ({assignedPincodesList.length})
                  </MenuItem>
                  {assignedPincodesList.map((pin) => (
                    <MenuItem key={pin.pincode} value={pin.pincode} sx={{ fontWeight: 700, fontSize: 12.5 }}>
                      📍 {pin.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Paper>

        <AnimatePresence mode="wait">
          {/* =========================================================================
              SCREEN 3: MERCHANT DETAILS VIEW (Drill-Down Modal/View)
          ========================================================================= */}
          {selectedMerchant ? (
            <motion.div
              key="merchant-detail"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
            >
              <Box sx={{ maxWidth: 640, mx: "auto" }}>
                <Button
                  startIcon={<ArrowBackRoundedIcon />}
                  onClick={() => setSelectedMerchant(null)}
                  sx={{ mb: 2, textTransform: "none", fontWeight: 800, color: "#4F46E5" }}
                >
                  Back to Merchants List
                </Button>

                <Paper elevation={0} sx={{ borderRadius: "24px", overflow: "hidden", border: "1px solid #E2E8F0", bgcolor: "#FFFFFF" }}>
                  <Box
                    sx={{
                      height: 140,
                      backgroundImage: `url(${selectedMerchant.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative",
                    }}
                  >
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)",
                      }}
                    />
                  </Box>

                  <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: -6, mb: 2, position: "relative" }}>
                      <Avatar
                        src={selectedMerchant.image}
                        sx={{
                          width: 72,
                          height: 72,
                          border: "3.5px solid #FFFFFF",
                          boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                        }}
                      />
                      <Box sx={{ pt: 3.5, flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                          <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
                            {selectedMerchant.name}
                          </Typography>
                          <Chip
                            label={selectedMerchant.status}
                            size="small"
                            sx={{
                              bgcolor: selectedMerchant.status === "Active" ? "#ECFDF5" : "#FEF2F2",
                              color: selectedMerchant.status === "Active" ? "#059669" : "#DC2626",
                              fontWeight: 900,
                              fontSize: 10.5,
                            }}
                          />
                        </Stack>
                        <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                          {selectedMerchant.id} • {selectedMerchant.categoryName} • Pincode {selectedMerchant.pincode}
                        </Typography>
                      </Box>
                    </Stack>

                    <Tabs
                      value={merchantDetailTab}
                      onChange={(_, v) => setMerchantDetailTab(v)}
                      sx={{
                        borderBottom: "1px solid #E2E8F0",
                        mb: 2.5,
                        "& .MuiTab-root": { textTransform: "none", fontWeight: 800, fontSize: 13 },
                      }}
                    >
                      <Tab value="overview" label="Overview" />
                      <Tab value="transactions" label="Transactions" />
                      <Tab value="documents" label="Documents" />
                    </Tabs>

                    {merchantDetailTab === "overview" && (
                      <Stack spacing={2}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px" }}>
                          <Stack spacing={1.5}>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography sx={{ fontSize: 12.5, color: "#64748B", fontWeight: 700 }}>
                                👤 Owner Name
                              </Typography>
                              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                                {selectedMerchant.owner}
                              </Typography>
                            </Stack>
                            <Divider />
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography sx={{ fontSize: 12.5, color: "#64748B", fontWeight: 700 }}>
                                📞 Phone Number
                              </Typography>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                                  {selectedMerchant.mobile}
                                </Typography>
                                <IconButton
                                  size="small"
                                  component="a"
                                  href={`tel:${selectedMerchant.mobile}`}
                                  sx={{ bgcolor: "#EEF2FF", color: "#4F46E5", p: 0.5 }}
                                >
                                  <CallRoundedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Stack>
                            </Stack>
                            <Divider />
                            <Stack direction="row" justifyContent="space-between">
                              <Typography sx={{ fontSize: 12.5, color: "#64748B", fontWeight: 700 }}>
                                🏷 Category & Type
                              </Typography>
                              <Chip
                                label={`${selectedMerchant.categoryName} (${selectedMerchant.type})`}
                                size="small"
                                sx={{ bgcolor: "#EEF2FF", color: "#4F46E5", fontWeight: 800, fontSize: 11 }}
                              />
                            </Stack>
                            <Divider />
                            <Stack direction="row" justifyContent="space-between">
                              <Typography sx={{ fontSize: 12.5, color: "#64748B", fontWeight: 700 }}>
                                📍 Address
                              </Typography>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", maxWidth: 260, textAlign: "right" }}>
                                {selectedMerchant.address}
                              </Typography>
                            </Stack>
                          </Stack>
                        </Paper>

                        <Grid container spacing={1.5}>
                          <Grid item xs={6}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px", bgcolor: "#F8FAFC" }}>
                              <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>
                                Total Transactions
                              </Typography>
                              <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0F172A", mt: 0.5 }}>
                                {selectedMerchant.totalTransactions}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: "#10B981", fontWeight: 800 }}>
                                ↑ 12% vs last month
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px", bgcolor: "#F8FAFC" }}>
                              <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>
                                Total Spend
                              </Typography>
                              <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0F172A", mt: 0.5 }}>
                                {selectedMerchant.totalSpend}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: "#10B981", fontWeight: 800 }}>
                                ↑ 18% vs last month
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>

                        <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                          <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<CallRoundedIcon />}
                            component="a"
                            href={`tel:${selectedMerchant.mobile}`}
                            sx={{
                              py: 1.2,
                              borderRadius: "14px",
                              fontWeight: 800,
                              textTransform: "none",
                              color: "#4F46E5",
                              borderColor: "#C7D2FE",
                            }}
                          >
                            Call Owner
                          </Button>
                          <Button
                            variant="contained"
                            fullWidth
                            startIcon={<EditRoundedIcon />}
                            onClick={() => alert(`Editing Merchant ${selectedMerchant.name}`)}
                            sx={{
                              py: 1.2,
                              borderRadius: "14px",
                              fontWeight: 800,
                              textTransform: "none",
                              bgcolor: "#4F46E5",
                            }}
                          >
                            Edit Merchant
                          </Button>
                        </Stack>
                      </Stack>
                    )}
                  </Box>
                </Paper>
              </Box>
            </motion.div>
          ) : (
            <>
              {/* =========================================================================
                  TAB 1: TERRITORY BUSINESS INTELLIGENCE & COMMAND DASHBOARD
              ========================================================================= */}
              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <Box sx={{ maxWidth: { xs: 680, md: "100%" }, mx: "auto" }}>
                    {/* Master Wallet Card (75% Main / 25% Self Rebirth Split) */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: { xs: 2.5, sm: 3 },
                        borderRadius: "24px",
                        background: "linear-gradient(135deg, #312E81 0%, #4338CA 40%, #7C3AED 100%)",
                        color: "#FFFFFF",
                        boxShadow: "0 14px 34px -8px rgba(79, 70, 229, 0.45)",
                        mb: 2.5,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.8)", letterSpacing: "0.4px", textTransform: "uppercase" }}>
                            Franchise Master Wallet & Geo-Pool
                          </Typography>
                          <Typography sx={{ fontSize: { xs: 28, sm: 36 }, fontWeight: 950, my: 0.5, letterSpacing: "-0.5px" }}>
                            {showBalance ? `₹${wallet.balance}` : "₹ ••••••••"}
                          </Typography>
                          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                            <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
                              💵 Main (75%): ₹{wallet.main_wallet}
                            </Typography>
                            <Typography sx={{ fontSize: 11.5, color: "#FDE68A", fontWeight: 800 }}>
                              🔄 Self Rebirth (25%): ₹{wallet.self_account_pocket}
                            </Typography>
                          </Stack>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => setShowBalance(!showBalance)}
                          sx={{ color: "rgba(255,255,255,0.85)", bgcolor: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)" }}
                        >
                          {showBalance ? <VisibilityRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </Stack>

                      {/* Action Buttons */}
                      <Stack direction="row" spacing={1.2} sx={{ mt: 2.5 }}>
                        <Button
                          variant="contained"
                          startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                          onClick={() => navigate("/agency/franchise-wallet")}
                          sx={{
                            flex: 1,
                            py: 0.8,
                            borderRadius: "12px",
                            fontWeight: 800,
                            fontSize: 11.5,
                            textTransform: "none",
                            background: "linear-gradient(135deg, #EA580C 0%, #F97316 100%)",
                            boxShadow: "0 4px 12px rgba(234, 88, 12, 0.35)",
                            color: "#FFFFFF",
                          }}
                        >
                          Add Money
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<SendRoundedIcon sx={{ fontSize: 15 }} />}
                          onClick={() => navigate("/agency/franchise-wallet")}
                          sx={{
                            flex: 1,
                            py: 0.8,
                            borderRadius: "12px",
                            fontWeight: 800,
                            fontSize: 11.5,
                            textTransform: "none",
                            bgcolor: "rgba(255,255,255,0.2)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            color: "#FFFFFF",
                          }}
                        >
                          Send
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<SouthEastRoundedIcon sx={{ fontSize: 15 }} />}
                          onClick={() => navigate("/agency/withdrawals")}
                          sx={{
                            flex: 1,
                            py: 0.8,
                            borderRadius: "12px",
                            fontWeight: 800,
                            fontSize: 11.5,
                            textTransform: "none",
                            bgcolor: "rgba(255,255,255,0.2)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            color: "#FFFFFF",
                          }}
                        >
                          Withdraw (0 Hold)
                        </Button>
                      </Stack>
                    </Paper>

                    {/* TERRITORY POTENTIAL & PENETRATION INDEX (Pre/Post Ownership) */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: { xs: 2, sm: 2.5 },
                        borderRadius: "20px",
                        bgcolor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        mb: 2.5,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                        <Box>
                          <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A" }}>
                            Territory Market Strength & Penetration
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                            {selectedPincode === "all" ? "Zone Aggregated Potential" : `Pincode ${selectedPincode} Potential`}
                          </Typography>
                        </Box>
                        <Chip
                          label={`Market Capture: ${metrics.market_penetration_pct}%`}
                          size="small"
                          sx={{
                            fontWeight: 900,
                            fontSize: 11,
                            bgcolor: "#ECFDF5",
                            color: "#059669",
                            border: "1px solid #A7F3D0",
                          }}
                        />
                      </Stack>

                      <Box sx={{ mb: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>
                            Onboarded Merchants vs Total Addressable Shops ({metrics.total_merchants} / {metrics.total_addressable_merchants})
                          </Typography>
                          <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#4F46E5" }}>
                            {metrics.new_leads_pipeline} Leads Ready in Pipeline
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={metrics.market_penetration_pct}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: "#F1F5F9",
                            "& .MuiLinearProgress-bar": {
                              borderRadius: 4,
                              background: "linear-gradient(90deg, #4F46E5 0%, #10B981 100%)",
                            },
                          }}
                        />
                      </Box>

                      {/* 4 Micro KPI Pillars */}
                      <Grid container spacing={1.5}>
                        <Grid item xs={6} sm={3}>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC" }}>
                            <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                              🏪 B2C Retail Outlets
                            </Typography>
                            <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#0F172A", mt: 0.25 }}>
                              {metrics.b2c_merchants}
                            </Typography>
                            <Typography sx={{ fontSize: 10.5, color: "#10B981", fontWeight: 800 }}>
                              Retail Kiranas & Dining
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC" }}>
                            <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                              📦 B2B Wholesalers
                            </Typography>
                            <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#0F172A", mt: 0.25 }}>
                              {metrics.b2b_merchants}
                            </Typography>
                            <Typography sx={{ fontSize: 10.5, color: "#0284C7", fontWeight: 800 }}>
                              Master Distributors
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC" }}>
                            <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                              🛍 TriZone Flagships
                            </Typography>
                            <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#0F172A", mt: 0.25 }}>
                              {metrics.trizone_stores}
                            </Typography>
                            <Typography sx={{ fontSize: 10.5, color: "#D97706", fontWeight: 800 }}>
                              Experience Hubs
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC" }}>
                            <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                              👥 Field Captains
                            </Typography>
                            <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#0F172A", mt: 0.25 }}>
                              {metrics.active_captains} <span style={{ fontSize: 11, color: "#64748B" }}>/ {metrics.total_captains}</span>
                            </Typography>
                            <Typography sx={{ fontSize: 10.5, color: "#10B981", fontWeight: 800 }}>
                              86% Active Force
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Paper>

                    {/* CATEGORY DISTRIBUTION & VOLUME SHARES */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: "20px",
                        bgcolor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        mb: 2.5,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                          <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A" }}>
                            Category-Wise Market Distribution & Gross Volume
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                            Monthly Turnover Run-Rate: {metrics.monthly_gtv}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={() => setActiveTab("merchants")}
                          sx={{ textTransform: "none", fontWeight: 800, fontSize: 12, color: "#4F46E5" }}
                        >
                          View Merchants &gt;
                        </Button>
                      </Stack>

                      <Stack spacing={1.75}>
                        {categoryMarketData.map((cat, idx) => (
                          <Box key={idx}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography sx={{ fontSize: 15 }}>{cat.icon}</Typography>
                                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                                  {cat.name}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                                  ({cat.count} shops)
                                </Typography>
                              </Stack>
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#64748B" }}>
                                  {cat.pct}% share
                                </Typography>
                                <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A" }}>
                                  {cat.gtv}
                                </Typography>
                              </Stack>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={cat.pct * 2.5}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                bgcolor: "#F1F5F9",
                                "& .MuiLinearProgress-bar": { bgcolor: cat.color, borderRadius: 3 },
                              }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Paper>

                    {/* Quick Register Actions */}
                    <Grid container spacing={1.5}>
                      <Grid item xs={6}>
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<AddCircleOutlineRoundedIcon />}
                          onClick={() => {
                            setMerchantStep(1);
                            setOpenAddMerchantModal(true);
                          }}
                          sx={{
                            py: 1.2,
                            borderRadius: "14px",
                            fontWeight: 800,
                            fontSize: 12,
                            textTransform: "none",
                            bgcolor: "#FFFFFF",
                            borderColor: "#C7D2FE",
                            color: "#4F46E5",
                          }}
                        >
                          + Add New Merchant
                        </Button>
                      </Grid>
                      <Grid item xs={6}>
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<PersonAddRoundedIcon />}
                          onClick={() => {
                            setCaptainStep(1);
                            setOpenAddCaptainModal(true);
                          }}
                          sx={{
                            py: 1.2,
                            borderRadius: "14px",
                            fontWeight: 800,
                            fontSize: 12,
                            textTransform: "none",
                            bgcolor: "#FFFFFF",
                            borderColor: "#BAE6FD",
                            color: "#0284C7",
                          }}
                        >
                          + Register Captain
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </motion.div>
              )}

              {/* =========================================================================
                  TAB 2: MERCHANTS & CAPTAINS DIRECTORY (tri-business)
              ========================================================================= */}
              {activeTab === "merchants" && (
                <motion.div
                  key="merchants"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <Box sx={{ maxWidth: { xs: 680, md: "100%" }, mx: "auto" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontSize: 18, fontWeight: 950, color: "#0F172A" }}>
                          Merchants Directory
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                          Showing {filteredMerchants.length} merchants in {selectedPincode === "all" ? "all assigned pincodes" : `Pincode ${selectedPincode}`}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddRoundedIcon />}
                        onClick={() => {
                          setMerchantStep(1);
                          setOpenAddMerchantModal(true);
                        }}
                        sx={{
                          borderRadius: "12px",
                          fontWeight: 800,
                          textTransform: "none",
                          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                          color: "#FFFFFF",
                        }}
                      >
                        Add Merchant
                      </Button>
                    </Stack>

                    {/* Search Bar */}
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search by store name, owner, phone, pincode..."
                      value={merchantSearch}
                      onChange={(e) => setMerchantSearch(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRoundedIcon sx={{ color: "#94A3B8" }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: 1.5,
                        bgcolor: "#FFFFFF",
                        borderRadius: "14px",
                        "& .MuiOutlinedInput-root": { borderRadius: "14px" },
                      }}
                    />

                    {/* Filter Pills Row */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, overflowX: "auto", pb: 0.5 }}>
                      <Chip
                        label={`All Types: ${merchantTypeFilter.toUpperCase()} ▼`}
                        onClick={() => setFilterDrawerOpen(true)}
                        size="small"
                        sx={{ fontWeight: 800, fontSize: 11.5, bgcolor: "#FFFFFF", border: "1px solid #E2E8F0" }}
                      />
                      <Chip
                        label={`Status: ${merchantStatusFilter.toUpperCase()} ▼`}
                        onClick={() => setFilterDrawerOpen(true)}
                        size="small"
                        sx={{ fontWeight: 800, fontSize: 11.5, bgcolor: "#FFFFFF", border: "1px solid #E2E8F0" }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => setFilterDrawerOpen(true)}
                        sx={{
                          bgcolor: activeFilterCount > 0 ? "#EEF2FF" : "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          color: activeFilterCount > 0 ? "#4F46E5" : "#64748B",
                        }}
                      >
                        <TuneRoundedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Stack>

                    {/* Category Horizontal Pills */}
                    <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: "auto", pb: 0.5 }}>
                      {TRIZONE_CATEGORIES.map((cat) => (
                        <Chip
                          key={cat.id}
                          label={cat.name}
                          onClick={() => setSelectedCategory(cat.id)}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: 11.5,
                            bgcolor: selectedCategory === cat.id ? "#0F172A" : "#FFFFFF",
                            color: selectedCategory === cat.id ? "#FFFFFF" : "#475569",
                            border: "1px solid #E2E8F0",
                            cursor: "pointer",
                          }}
                        />
                      ))}
                    </Stack>

                    {/* Merchant Cards List */}
                    <Stack spacing={1.5}>
                      {filteredMerchants.map((m) => (
                        <Paper
                          key={m.id}
                          elevation={0}
                          onClick={() => setSelectedMerchant(m)}
                          sx={{
                            p: 1.5,
                            borderRadius: "18px",
                            bgcolor: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            transition: "all 140ms ease",
                            "&:hover": {
                              borderColor: "#4F46E5",
                              transform: "translateY(-1px)",
                              boxShadow: "0 6px 16px rgba(79,70,229,0.08)",
                            },
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Avatar
                              src={m.image}
                              variant="rounded"
                              sx={{ width: 56, height: 56, borderRadius: "12px" }}
                            />
                            <Box>
                              <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>
                                {m.name}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                                {m.id} • Owner: {m.owner} • Pincode: {m.pincode}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: "#94A3B8" }}>
                                {m.mobile}
                              </Typography>
                            </Box>
                          </Stack>

                          <Stack alignItems="flex-end" spacing={0.5}>
                            <Chip
                              label={m.status}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 10,
                                fontWeight: 900,
                                bgcolor: m.status === "Active" ? "#ECFDF5" : "#FEF2F2",
                                color: m.status === "Active" ? "#059669" : "#DC2626",
                              }}
                            />
                            <Chip
                              label={m.type}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 10,
                                fontWeight: 800,
                                bgcolor: m.type === "TriZone" ? "#FFFBEB" : "#EEF2FF",
                                color: m.type === "TriZone" ? "#D97706" : "#4F46E5",
                              }}
                            />
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                </motion.div>
              )}

              {/* =========================================================================
                  TAB 3: DIGITAL EDUCATION & LAYER PROGRESSION ENGINE (tri-academy)
              ========================================================================= */}
              {activeTab === "packages" && (
                <motion.div
                  key="packages"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <Box sx={{ maxWidth: { xs: 680, md: "100%" }, mx: "auto" }}>
                    <Box sx={{ mb: 2.5 }}>
                      <Typography sx={{ fontSize: 18, fontWeight: 950, color: "#0F172A" }}>
                        Digital Education Packages & 10-Layer Engine
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                        Live package sales, rank upgrades, and Midnight 11:59 PM Royalty Qualifiers on trieducation.in
                      </Typography>
                    </Box>

                    {/* 3 Executive Programme Tracks */}
                    <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                      <Grid item xs={12} sm={4}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: "18px",
                            bgcolor: "#FFFFFF",
                            border: "1.5px solid #C7D2FE",
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Chip label="Track 1 • ₹2,000" size="small" sx={{ fontWeight: 900, bgcolor: "#EEF2FF", color: "#4F46E5" }} />
                            <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#10B981" }}>
                              0 Hold Payout
                            </Typography>
                          </Stack>
                          <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#0F172A", mt: 1.5 }}>
                            Foundation: e-Edu Agent
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 700, mb: 1.5 }}>
                            ₹750 Prime + ₹1,000 SPP Box + ₹250 LMS Rank 1
                          </Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                              Total Sold in Territory:
                            </Typography>
                            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#4F46E5" }}>
                              {eduPackageStats.totalStarterSold}
                            </Typography>
                          </Stack>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: "18px",
                            bgcolor: "#FFFFFF",
                            border: "1.5px solid #BAE6FD",
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Chip label="Track 2 • ₹8,000" size="small" sx={{ fontWeight: 900, bgcolor: "#F0F9FF", color: "#0284C7" }} />
                            <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#10B981" }}>
                              0 Hold Payout
                            </Typography>
                          </Stack>
                          <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#0F172A", mt: 1.5 }}>
                            Super Agent Leadership
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 700, mb: 1.5 }}>
                            Part 1 (₹4.75k: Ranks 2–5) + Part 2 (₹3.25k: Ranks 6–7)
                          </Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                              Total Sold in Territory:
                            </Typography>
                            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0284C7" }}>
                              {eduPackageStats.totalSuperAgentSold}
                            </Typography>
                          </Stack>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: "18px",
                            bgcolor: "#FFFFFF",
                            border: "1.5px solid #FED7AA",
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Chip label="Track 3 • ₹40,000" size="small" sx={{ fontWeight: 900, bgcolor: "#FFF7ED", color: "#EA580C" }} />
                            <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#D97706" }}>
                              11:59 PM Royalty
                            </Typography>
                          </Stack>
                          <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#0F172A", mt: 1.5 }}>
                            Promoter & DAP Leadership
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 700, mb: 1.5 }}>
                            Tranche 1 (₹5k: L8) + Tranche 2 (₹10k: L9) + Tranche 3 (₹25k: L10)
                          </Typography>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                              Total Sold in Territory:
                            </Typography>
                            <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#EA580C" }}>
                              {eduPackageStats.totalPromotersSold}
                            </Typography>
                          </Stack>
                        </Paper>
                      </Grid>
                    </Grid>

                    {/* 10-LAYER PROGRESSION MATRIX */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: "20px",
                        bgcolor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        mb: 2.5,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                          <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A" }}>
                            10-Layer Network Progression Funnel
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                            Active members upgraded and certified per layer
                          </Typography>
                        </Box>
                        <Chip
                          label="Dynamic Admin Distributed"
                          size="small"
                          sx={{ fontSize: 11, fontWeight: 900, bgcolor: "#EEF2FF", color: "#4F46E5" }}
                        />
                      </Stack>

                      <Stack spacing={1.5}>
                        {eduPackageStats.layerBreakdown.map((layer, idx) => (
                          <Box key={idx}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                              <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                                {layer.layer} • <span style={{ fontSize: 11.5, color: "#64748B", fontWeight: 700 }}>{layer.track}</span>
                              </Typography>
                              <Typography sx={{ fontSize: 13.5, fontWeight: 950, color: "#0F172A" }}>
                                {layer.count} members
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={layer.pct}
                              sx={{
                                height: 7,
                                borderRadius: 3.5,
                                bgcolor: "#F1F5F9",
                                "& .MuiLinearProgress-bar": { bgcolor: layer.color, borderRadius: 3.5 },
                              }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Paper>

                    {/* MIDNIGHT 11:59 PM ROYALTY QUALIFIERS (≥₹50,000 Volume) */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: "20px",
                        bgcolor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                        <Box>
                          <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A" }}>
                            District Royalty Qualifiers (≥₹50,000 Volume)
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                            Receiving Daily 11:59 PM District Royalty Turnover Distributions
                          </Typography>
                        </Box>
                        <Chip
                          label={`${eduPackageStats.royaltyPromotersCount} Qualified Promoters`}
                          size="small"
                          sx={{ fontWeight: 900, bgcolor: "#FEF3C7", color: "#B45309" }}
                        />
                      </Stack>

                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 800, color: "#64748B" }}>Promoter Name</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: "#64748B" }}>Pincode</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: "#64748B" }}>Rank Tier</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: "#64748B" }}>Package Volume</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: "#64748B" }} align="right">Daily Royalty</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {eduPackageStats.promoterQualifiers.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell sx={{ fontWeight: 800, color: "#0F172A" }}>
                                  {p.name} <Typography component="span" sx={{ fontSize: 11, color: "#94A3B8" }}>({p.mobile})</Typography>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>{p.pincode}</TableCell>
                                <TableCell>
                                  <Chip label={p.rank} size="small" sx={{ fontWeight: 900, fontSize: 10.5, bgcolor: "#EEF2FF", color: "#4F46E5" }} />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 800, color: "#059669" }}>{p.volume}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 950, color: "#D97706" }}>{p.dailyRoyalty}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Box>
                </motion.div>
              )}

              {/* =========================================================================
                  TAB 4: MASTER WALLET & EARNINGS
              ========================================================================= */}
              {activeTab === "wallet" && (
                <motion.div
                  key="wallet"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <Box sx={{ maxWidth: 680, mx: "auto" }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: { xs: 2.5, sm: 3 },
                        borderRadius: "24px",
                        background: "linear-gradient(135deg, #312E81 0%, #4338CA 40%, #7C3AED 100%)",
                        color: "#FFFFFF",
                        boxShadow: "0 14px 34px -8px rgba(79, 70, 229, 0.45)",
                        mb: 2,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.8)", letterSpacing: "0.4px" }}>
                            AVAILABLE MASTER BALANCE
                          </Typography>
                          <Typography sx={{ fontSize: 34, fontWeight: 950, my: 0.5 }}>
                            ₹{wallet.balance}
                          </Typography>
                          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
                              Main Wallet (75%): ₹{wallet.main_wallet}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "#FDE68A", fontWeight: 800 }}>
                              Self Account Pocket (25%): ₹{wallet.self_account_pocket}
                            </Typography>
                          </Stack>
                        </Box>
                        <VisibilityRoundedIcon sx={{ color: "rgba(255,255,255,0.8)" }} />
                      </Stack>

                      <Stack direction="row" spacing={1.2} sx={{ mt: 2.5 }}>
                        <Button
                          variant="contained"
                          startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                          onClick={() => navigate("/agency/franchise-wallet")}
                          sx={{
                            flex: 1,
                            py: 0.8,
                            borderRadius: "12px",
                            fontWeight: 800,
                            fontSize: 11.5,
                            textTransform: "none",
                            background: "linear-gradient(135deg, #EA580C 0%, #F97316 100%)",
                            color: "#FFFFFF",
                          }}
                        >
                          Add Money
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<SendRoundedIcon sx={{ fontSize: 15 }} />}
                          onClick={() => navigate("/agency/franchise-wallet")}
                          sx={{
                            flex: 1,
                            py: 0.8,
                            borderRadius: "12px",
                            fontWeight: 800,
                            fontSize: 11.5,
                            textTransform: "none",
                            bgcolor: "rgba(255,255,255,0.2)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            color: "#FFFFFF",
                          }}
                        >
                          Send
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<SouthEastRoundedIcon sx={{ fontSize: 15 }} />}
                          onClick={() => navigate("/agency/withdrawals")}
                          sx={{
                            flex: 1,
                            py: 0.8,
                            borderRadius: "12px",
                            fontWeight: 800,
                            fontSize: 11.5,
                            textTransform: "none",
                            bgcolor: "rgba(255,255,255,0.2)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            color: "#FFFFFF",
                          }}
                        >
                          Withdraw (0 Hold)
                        </Button>
                      </Stack>
                    </Paper>

                    <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                      {[
                        { title: "Total Received", val: `₹${wallet.total_received}` },
                        { title: "Total Spent", val: `₹${wallet.total_spent}` },
                        { title: "Today's Earnings", val: `₹${wallet.today}` },
                      ].map((st, idx) => (
                        <Grid item xs={4} key={idx}>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "14px", textAlign: "center", bgcolor: "#FFFFFF" }}>
                            <Typography sx={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>
                              {st.title}
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", mt: 0.25 }}>
                              {st.val}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>

                    <Paper elevation={0} sx={{ borderRadius: "20px", border: "1px solid #E2E8F0", overflow: "hidden", bgcolor: "#FFFFFF" }}>
                      {[
                        { title: "Transaction History", icon: <ReceiptLongRoundedIcon sx={{ color: "#4F46E5" }} />, path: "/agency/transactions" },
                        { title: "Bank Accounts & KYC", icon: <AccountBalanceWalletRoundedIcon sx={{ color: "#0284C7" }} />, path: "/agency/profile" },
                        { title: "Wallet Statement", icon: <AssessmentRoundedIcon sx={{ color: "#10B981" }} />, path: "/agency/monthly-report" },
                        { title: "Payout Settings", icon: <SettingsOutlinedIcon sx={{ color: "#8B5CF6" }} />, path: "/agency/profile" },
                        { title: "Help & Support", icon: <HelpOutlineRoundedIcon sx={{ color: "#F59E0B" }} />, path: "/agency/support" },
                      ].map((item, idx, arr) => (
                        <React.Fragment key={idx}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            onClick={() => navigate(item.path)}
                            sx={{
                              p: 2,
                              cursor: "pointer",
                              "&:hover": { bgcolor: "#F8FAFC" },
                            }}
                          >
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Box sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {item.icon}
                              </Box>
                              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                                {item.title}
                              </Typography>
                            </Stack>
                            <ChevronRightRoundedIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
                          </Stack>
                          {idx < arr.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </Paper>
                  </Box>
                </motion.div>
              )}

              {/* =========================================================================
                  TAB 5: TRANSACTION LEDGER
              ========================================================================= */}
              {activeTab === "ledger" && (
                <motion.div
                  key="ledger"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <Box sx={{ maxWidth: 680, mx: "auto" }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 950, color: "#0F172A", mb: 2 }}>
                      Live Territory Transaction Ledger
                    </Typography>

                    <Stack spacing={1.5}>
                      {transactionsList.map((t) => (
                        <Paper
                          key={t.id}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: "16px",
                            bgcolor: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box
                              sx={{
                                width: 42,
                                height: 42,
                                borderRadius: "12px",
                                bgcolor: t.badgeBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {t.icon}
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>
                                {t.title}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                                {t.date} • {t.category}
                              </Typography>
                            </Box>
                          </Stack>

                          <Typography
                            sx={{
                              fontSize: 15,
                              fontWeight: 950,
                              color: t.amount > 0 ? "#059669" : "#DC2626",
                            }}
                          >
                            {t.amount > 0 ? `+₹${t.amount.toFixed(2)}` : `-₹${Math.abs(t.amount).toFixed(2)}`}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                </motion.div>
              )}

              {/* =========================================================================
                  TAB 6: TERRITORY COMMAND & 7-TIER HIERARCHY
              ========================================================================= */}
              {activeTab === "hierarchy" && (
                <motion.div
                  key="hierarchy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <Box sx={{ maxWidth: 680, mx: "auto" }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: "20px",
                        bgcolor: "#FFFFFF",
                        border: "1.5px solid #C7D2FE",
                        boxShadow: "0 4px 16px rgba(79, 70, 229, 0.08)",
                        mb: 2.5,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                        <Box>
                          <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#0F172A" }}>
                            {isCoordinator ? "Multi-Pincode Coordinator Command" : "Pincode Agency Territory Hub"}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                            {userName} ({userCode})
                          </Typography>
                        </Box>
                        <Chip
                          label="ACTIVE JURISDICTION"
                          size="small"
                          sx={{
                            bgcolor: "#4F46E5",
                            color: "#FFFFFF",
                            fontWeight: 900,
                            fontSize: 10.5,
                          }}
                        />
                      </Stack>

                      <Divider sx={{ my: 1.5 }} />

                      <Grid container spacing={1.5}>
                        <Grid item xs={4}>
                          <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                            State
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                            {selectedState}
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                            District
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                            {selectedDistrict}
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                            Assigned Pincodes
                          </Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#4F46E5" }}>
                            {assignedPincodesList.length} Pincodes
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>

                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: "20px",
                        bgcolor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A" }}>
                        Agency Enterprise Hierarchy (7 Tiers)
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600, mb: 2 }}>
                        Standard operational territory allocation model
                      </Typography>

                      <Stack spacing={1.5}>
                        {[
                          { tier: "Tier 1", name: "State Coordinator", quota: "Multi-State Regional Zone", isMe: isStateAgency && isCoordinator },
                          { tier: "Tier 2", name: "State Franchise", quota: "Full State (~31 Districts)", isMe: isStateAgency && !isCoordinator },
                          { tier: "Tier 3", name: "District Coordinator", quota: "Multi-District Division", isMe: isDistrictAgency && isCoordinator },
                          { tier: "Tier 4", name: "District Franchise", quota: "Single Full District (e.g. Bijapur)", isMe: isDistrictAgency && !isCoordinator },
                          { tier: "Tier 5", name: "Pincode Coordinator", quota: "Cluster of 4–8 Pincodes", isMe: isCoordinator && !isDistrictAgency },
                          { tier: "Tier 6", name: "Pincode Agency", quota: "Single Pincode (e.g. 560073)", isMe: !isCoordinator && !isDistrictAgency },
                          { tier: "Tier 7", name: "Captain (Sub-Franchise)", quota: "Micro-Zone / Retail Cluster", isMe: false },
                        ].map((item, idx) => (
                          <Paper
                            key={idx}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: "14px",
                              bgcolor: item.isMe ? "#EEF2FF" : "#FFFFFF",
                              borderColor: item.isMe ? "#818CF8" : "#E2E8F0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Chip
                                label={item.tier}
                                size="small"
                                sx={{
                                  bgcolor: item.isMe ? "#4F46E5" : "#F1F5F9",
                                  color: item.isMe ? "#FFFFFF" : "#475569",
                                  fontWeight: 900,
                                  fontSize: 10.5,
                                }}
                              />
                              <Box>
                                <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A" }}>
                                  {item.name}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                                  Scope: {item.quota}
                                </Typography>
                              </Box>
                            </Stack>
                            {item.isMe && (
                              <Chip label="YOU ARE HERE" size="small" sx={{ bgcolor: "#10B981", color: "#FFFFFF", fontWeight: 900, fontSize: 10 }} />
                            )}
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  </Box>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </Container>

      {/* ── FILTER DRAWER (Screen 7 Mockup) ── */}
      <Drawer
        anchor="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
            p: 3,
            maxHeight: "85vh",
            maxWidth: 600,
            mx: "auto",
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 950, color: "#0F172A" }}>
            Filter Territory Data
          </Typography>
          <IconButton size="small" onClick={() => setFilterDrawerOpen(false)}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A", mb: 1 }}>
              Merchant Type
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {["all", "b2c", "b2b", "trizone"].map((type) => (
                <Chip
                  key={type}
                  label={type.toUpperCase()}
                  onClick={() => setMerchantTypeFilter(type)}
                  sx={{
                    fontWeight: 800,
                    bgcolor: merchantTypeFilter === type ? "#4F46E5" : "#F1F5F9",
                    color: merchantTypeFilter === type ? "#FFFFFF" : "#475569",
                  }}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A", mb: 1 }}>
              Status
            </Typography>
            <Stack direction="row" spacing={1}>
              {["all", "active", "inactive"].map((st) => (
                <Chip
                  key={st}
                  label={st.toUpperCase()}
                  onClick={() => setMerchantStatusFilter(st)}
                  sx={{
                    fontWeight: 800,
                    bgcolor: merchantStatusFilter === st ? "#4F46E5" : "#F1F5F9",
                    color: merchantStatusFilter === st ? "#FFFFFF" : "#475569",
                  }}
                />
              ))}
            </Stack>
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={() => setFilterDrawerOpen(false)}
            sx={{
              py: 1.25,
              borderRadius: "14px",
              fontWeight: 900,
              bgcolor: "#4F46E5",
              mt: 2,
            }}
          >
            Apply Filters
          </Button>
        </Stack>
      </Drawer>

      {/* ── ADD MERCHANT WIZARD (Screen 8 Mockup) ── */}
      <Dialog
        open={openAddMerchantModal}
        onClose={() => setOpenAddMerchantModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "20px", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 950, fontSize: 18 }}>
          + Add New Merchant (Step {merchantStep}/2)
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {merchantStep === 1 ? (
              <>
                <TextField
                  fullWidth
                  label="Store Name"
                  size="small"
                  value={newMerchantData.storeName}
                  onChange={(e) => setNewMerchantData({ ...newMerchantData, storeName: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Owner Name"
                  size="small"
                  value={newMerchantData.ownerName}
                  onChange={(e) => setNewMerchantData({ ...newMerchantData, ownerName: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Phone Number"
                  size="small"
                  value={newMerchantData.mobile}
                  onChange={(e) => setNewMerchantData({ ...newMerchantData, mobile: e.target.value })}
                />
              </>
            ) : (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    label="Category"
                    value={newMerchantData.category}
                    onChange={(e) => setNewMerchantData({ ...newMerchantData, category: e.target.value })}
                  >
                    {TRIZONE_CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Store Type</InputLabel>
                  <Select
                    label="Store Type"
                    value={newMerchantData.type}
                    onChange={(e) => setNewMerchantData({ ...newMerchantData, type: e.target.value })}
                  >
                    <MenuItem value="B2C">B2C Retail Outlet</MenuItem>
                    <MenuItem value="B2B">B2B Wholesaler / Distributor</MenuItem>
                    <MenuItem value="TriZone">TriZone Experience Hub</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Pincode"
                  size="small"
                  value={newMerchantData.pincode}
                  onChange={(e) => setNewMerchantData({ ...newMerchantData, pincode: e.target.value })}
                />
                <TextField
                  fullWidth
                  label="Full Address"
                  size="small"
                  multiline
                  rows={2}
                  value={newMerchantData.address}
                  onChange={(e) => setNewMerchantData({ ...newMerchantData, address: e.target.value })}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {merchantStep === 2 && (
            <Button onClick={() => setMerchantStep(1)} sx={{ fontWeight: 800 }}>
              Back
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => {
              if (merchantStep === 1) {
                if (!newMerchantData.storeName || !newMerchantData.mobile) {
                  alert("Please provide store name and phone number.");
                  return;
                }
                setMerchantStep(2);
              } else {
                alert(`Merchant ${newMerchantData.storeName} onboarded under Pincode ${newMerchantData.pincode}!`);
                setOpenAddMerchantModal(false);
                setNewMerchantData({ storeName: "", ownerName: "", mobile: "", address: "", category: "tri_basket", type: "B2C", pincode: userPincode });
              }
            }}
            sx={{ bgcolor: "#4F46E5" }}
          >
            {merchantStep === 1 ? "Next Step >" : "Onboard Merchant"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── REGISTER CAPTAIN WIZARD (Screen 9 Mockup) ── */}
      <Dialog
        open={openAddCaptainModal}
        onClose={() => setOpenAddCaptainModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "20px", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 950, fontSize: 18 }}>
          + Register Captain / Field Partner
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Captain Name"
              size="small"
              value={newCaptainData.name}
              onChange={(e) => setNewCaptainData({ ...newCaptainData, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="Mobile Number"
              size="small"
              value={newCaptainData.mobile}
              onChange={(e) => setNewCaptainData({ ...newCaptainData, mobile: e.target.value })}
            />
            <TextField
              fullWidth
              label="Assigned Pincode"
              size="small"
              value={newCaptainData.pincode}
              onChange={(e) => setNewCaptainData({ ...newCaptainData, pincode: e.target.value })}
            />
            <TextField
              fullWidth
              label="Locality / Micro-Zone"
              size="small"
              value={newCaptainData.locality}
              onChange={(e) => setNewCaptainData({ ...newCaptainData, locality: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenAddCaptainModal(false)} sx={{ fontWeight: 800 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!newCaptainData.name || !newCaptainData.mobile) {
                alert("Please provide Captain Name and Phone Number.");
                return;
              }
              alert(`Captain ${newCaptainData.name} registered under Pincode ${newCaptainData.pincode}!`);
              setOpenAddCaptainModal(false);
              setNewCaptainData({ name: "", mobile: "", gender: "Male", pincode: userPincode, locality: "" });
            }}
            sx={{ bgcolor: "#4F46E5" }}
          >
            Register Captain
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── MOBILE BOTTOM NAVIGATION BAR (Enterprise 6-Module Hub) ── */}
      <Paper
        elevation={0}
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1200,
          display: { xs: "block", md: "none" },
          px: 0.5,
          pt: 0.5,
          pb: "calc(0.5rem + env(safe-area-inset-bottom))",
          bgcolor: "rgba(255,255,255,0.96)",
          borderTop: "1px solid #E2E8F0",
          backdropFilter: "blur(16px)",
          boxShadow: "0 -8px 24px rgba(15,23,42,0.08)",
        }}
      >
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.25 }}>
          {[
            { label: "Overview", tab: "dashboard", icon: <InsightsRoundedIcon sx={{ fontSize: 18 }} /> },
            { label: "Merchants", tab: "merchants", icon: <StoreRoundedIcon sx={{ fontSize: 18 }} /> },
            { label: "e-Edu", tab: "packages", icon: <SchoolRoundedIcon sx={{ fontSize: 18 }} /> },
            { label: "Wallet", tab: "wallet", icon: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} /> },
            { label: "Ledger", tab: "ledger", icon: <HistoryRoundedIcon sx={{ fontSize: 18 }} /> },
            { label: "Territory", tab: "hierarchy", icon: <LocationOnRoundedIcon sx={{ fontSize: 18 }} /> },
          ].map((item) => {
            const active = activeTab === item.tab && !selectedMerchant;
            return (
              <Box
                key={item.label}
                component="button"
                type="button"
                onClick={() => {
                  setActiveTab(item.tab);
                  setSelectedMerchant(null);
                }}
                sx={{
                  border: 0,
                  borderRadius: "10px",
                  py: 0.6,
                  bgcolor: active ? "#EEF2FF" : "transparent",
                  color: active ? "#4F46E5" : "#64748B",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.2,
                  cursor: "pointer",
                }}
              >
                {item.icon}
                <Typography sx={{ fontSize: 9.5, fontWeight: active ? 900 : 700, whiteSpace: "nowrap" }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
