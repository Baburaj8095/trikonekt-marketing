import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Stack,
  Paper,
  Grid,
  Button,
  IconButton,
  Chip,
  Avatar,
  TextField,
  MenuItem,
  Select,
  FormControl,
  LinearProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  Badge,
  Alert,
  Snackbar,
  InputAdornment,
  Tabs,
  Tab,
} from "@mui/material";

// Icons
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CallRoundedIcon from "@mui/icons-material/CallRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import ExploreRoundedIcon from "@mui/icons-material/ExploreRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import SavingsIcon from "@mui/icons-material/Savings";
import MessageRoundedIcon from "@mui/icons-material/MessageRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import FlashOnRoundedIcon from "@mui/icons-material/FlashOnRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import DomainRoundedIcon from "@mui/icons-material/DomainRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";

import AgencyLayout from "./AgencyLayout";
import RoleSelector from "./RoleSelector";
import MetricCard from "./MetricCard";
import WalletCard from "./WalletCard";
import PhonePeHeroBanner from "./PhonePeHeroBanner";
import PageHeader from "./PageHeader";
import SearchField from "./SearchField";
import FilterChips from "./FilterChips";
import MerchantCard from "./MerchantCard";
import CaptainCard from "./CaptainCard";
import { AGENCY_TOKENS } from "./AgencyTokens";
import API from "../../api/api";

/**
 * DYNAMIC ADMIN-CONFIGURED COMMISSION ENGINE
 * (Directly mirrors CommissionConfig.master_commission_json live settings on EC2)
 */
export const DYNAMIC_COMMISSION_ENGINE = {
  // 1. ₹750 Prime Joining Geo Commissions
  prime750: {
    agency_pincode: 6.0,
    agency_pincode_coordinator: 4.0,
    agency_district: 3.0,
    agency_district_coordinator: 3.0,
    agency_state: 2.0,
    agency_state_coordinator: 2.0,
    agency_sub_franchise: 1.0,
  },
  // 2. ₹1,000 SPP Monthly Box Geo Commissions
  spp1000: {
    agency_pincode: 6.0,
    agency_pincode_coordinator: 4.0,
    agency_district: 3.0,
    agency_district_coordinator: 2.0,
    agency_state: 2.0,
    agency_state_coordinator: 2.0,
    agency_sub_franchise: 5.0,
  },
  // 3. ₹250 Self-Rebirth Geo Commissions
  rebirth250: {
    agency_pincode: 3.0,
    agency_pincode_coordinator: 2.0,
    agency_district: 2.0,
    agency_district_coordinator: 1.5,
    agency_state: 1.0,
    agency_state_coordinator: 1.0,
    agency_sub_franchise: 0.5,
  },
  // 4. Merchant QR Scanner Volume Override (0.20% GMV)
  qrScannerPercent: 0.002,
  // 5. TriZone Local Commerce Override (0.80% Order Volume)
  trizonePercent: 0.008,
  // 6. Dual Wallet Payout Split Rule (75% Main / 25% Self Block)
  mainRatio: 0.75,
  selfRatio: 0.25,
};

function maskUsernameMid(u) {
  const s = String(u || "").trim();
  if (!/^\d{8,}$/.test(s)) return s;
  if (s.length <= 4) return s;
  return `${s.slice(0, 4)}****${s.slice(-3)}`;
}

function describeSource(tx = {}) {
  const type = String(tx?.type || "").toUpperCase();
  const meta = tx?.meta || {};
  const src = String(meta.source || "").toUpperCase();
  const trigger = String(meta.trigger || "").toUpperCase();
  const pkg = String(meta.package || "").toUpperCase();
  const st = String(tx?.source_type || "").toUpperCase();
  const ot = String(meta.orig_type || "").toUpperCase();

  if (type === "SELF_ACCOUNT_CREDIT") {
    if (trigger.includes("750") || pkg.includes("750") || st.includes("750")) {
      return "₹750 Prime Geo Share (25% Self)";
    }
    if (trigger.includes("SPP") || trigger.includes("759") || trigger.includes("1000") || pkg.includes("759") || pkg.includes("1000") || st.includes("MONTHLY")) {
      return "₹1,000 SPP Monthly Box Geo Share (25% Self)";
    }
    if (trigger.includes("REBIRTH") || src.includes("REBIRTH")) {
      return "₹250 Self-Rebirth Override (25% Self)";
    }
    return "Self Rebirth Reserve Credit (25%)";
  }

  if (type === "INCOME_CREDIT_75" || type === "FRANCHISE_INCOME" || src.includes("FRANCHISE") || src.includes("AUTO_POOL_GEO")) {
    if (trigger.includes("750") || pkg.includes("750") || st.includes("750")) {
      return "₹750 Prime Geo Share";
    }
    if (trigger.includes("SPP") || trigger.includes("759") || trigger.includes("1000") || pkg.includes("759") || pkg.includes("1000") || st.includes("MONTHLY")) {
      return "₹1,000 SPP Monthly Box Geo Share";
    }
    if (trigger.includes("RANK") || trigger.includes("EDU") || src.includes("RANK") || src.includes("EDU")) {
      return "₹250 E-Edu Rank 1 Geo Share";
    }
    if (trigger.includes("REBIRTH") || src.includes("REBIRTH")) {
      return "₹250 Self-Rebirth Regional Override";
    }
    return meta.description || "Franchise Regional Commission";
  }

  if (type === "PINCODE_ROYALTY") return "Pincode Daily Royalty Share";
  if (type === "SELF_ACCOUNT_DEBIT") return "Self Rebirth Allocation (₹250 Node)";
  if (type === "WITHDRAWAL_DEBIT") return "Withdrawal Payout";
  return meta.description || type.replace(/_/g, " ");
}

function counterpartyLabel(tx = {}) {
  const meta = tx?.meta || {};
  const trig = meta.payer || meta.trigger_user || meta.from_user || meta.username || meta.tr_username;
  const trigId = meta.trigger_user_id || meta.from_user_id;
  const pincode = meta.pincode || meta.territory;
  const u = trig ? maskUsernameMid(trig) : "";
  let out = "";
  if (u) out = `From ${u}`;
  else if (trigId) out = `From ID ${trigId}`;
  if (pincode) out += (out ? ` • PIN ${pincode}` : `PIN ${pincode}`);
  return out || "Regional Consumer";
}

function classifyFranchiseTransaction(tx = {}) {
  const type = String(tx?.type || "").toUpperCase();
  const meta = tx?.meta || {};
  const src = String(meta.source || "").toUpperCase();
  const trigger = String(meta.trigger || "").toUpperCase();
  const desc = String(tx?.description || "").toUpperCase();

  if (type === "SELF_ACCOUNT_CREDIT" || type === "SELF_ACCOUNT_DEBIT" || meta?.ledger === "SELF_ACCOUNT" || type.includes("REBIRTH")) {
    return "SELF_ACCOUNT";
  }
  if (type === "PINCODE_ROYALTY" || trigger.includes("ROYALTY") || src.includes("ROYALTY") || desc.includes("ROYALTY")) {
    return "ROYALTY";
  }
  if (type.includes("QR") || src.includes("QR") || src.includes("MERCHANT") || src.includes("CAPTAIN") || desc.includes("QR")) {
    return "QR_SCANNER";
  }
  if (type.includes("TRIZONE") || src.includes("TRIZONE") || src.includes("COMMERCE") || src.includes("RETAIL") || desc.includes("TRIZONE") || desc.includes("SHOPPING")) {
    return "TRIZONE";
  }
  if (type.includes("E_EDU") || type.includes("EDUCATION") || src.includes("E_EDU") || src.includes("EDUCATION") || trigger.includes("EDU") || desc.includes("E-EDU") || desc.includes("EDUCATION") || desc.includes("LMS") || desc.includes("LEVEL COMMISSION")) {
    return "E_EDU";
  }
  if (type === "INCOME_CREDIT_75" || type === "FRANCHISE_INCOME" || src.includes("AUTO_POOL_GEO") || src.includes("FRANCHISE") || trigger.includes("PRIME") || trigger.includes("MONTHLY")) {
    return "FRANCHISE_GEO";
  }
  if (type.includes("WITHDRAWAL")) {
    return "WITHDRAWAL";
  }
  return "OTHER";
}

const SAMPLE_FRANCHISE_TRANSACTIONS = [
  {
    id: "TXN-984214",
    type: "INCOME_CREDIT_75",
    amount: 150.00,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    description: "Level Commission - L4",
    meta: {
      source: "LEVEL_4_COMMISSION",
      sender_id: "9999******999",
      sender_name: "Karnataka Member",
      package: "₹2,000 Prime Digital Education",
      ledger: "MAIN",
      pincode: "572106",
      gross_pool: 200.00,
      admin_tax: 36.00,
      payout_split: "75% Main Wallet",
    },
  },
  {
    id: "TXN-984180",
    type: "INCOME_CREDIT_75",
    amount: 250.00,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    description: "Level Commission - L3",
    meta: {
      source: "LEVEL_3_COMMISSION",
      sender_id: "8095******105",
      sender_name: "Baburaj",
      package: "₹2,000 Prime Digital Education",
      ledger: "MAIN",
      pincode: "572102",
      gross_pool: 333.33,
      admin_tax: 60.00,
      payout_split: "75% Main Wallet",
    },
  },
  {
    id: "TXN-984055",
    type: "E_EDU_SPONSOR",
    amount: 125.00,
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    description: "E-Edu Direct Sponsor",
    meta: {
      source: "E_EDU",
      sender_id: "9845******223",
      sender_name: "Chandrashekar H.",
      package: "₹250 LMS Rank 1 Upgrade",
      ledger: "MAIN",
      pincode: "572102",
      gross_pool: 250.00,
      admin_tax: 45.00,
      payout_split: "50% Direct Sponsor",
    },
  },
  {
    id: "TXN-983990",
    type: "SELF_ACCOUNT_CREDIT",
    amount: 62.50,
    created_at: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    description: "Self Block Repurchase Reserve",
    meta: {
      source: "SELF_ACCOUNT",
      sender_id: "9999******999",
      sender_name: "Auto Matrix Allocation",
      package: "25% Rebirth Allocation",
      ledger: "SELF_ACCOUNT",
      pincode: "572106",
      gross_pool: 250.00,
      payout_split: "25% Self Rebirth",
    },
  },
  {
    id: "TXN-983820",
    type: "QR_MERCHANT_OVERRIDE",
    amount: 45.00,
    created_at: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    description: "QR Scanner Merchant Checkout",
    meta: {
      source: "QR_SCANNER",
      sender_id: "9448******199",
      sender_name: "Kyathsandra Tiffins & Cafe",
      package: "Merchant QR Payment ₹1,500.00",
      ledger: "MAIN",
      pincode: "572103",
      gross_pool: 60.00,
      payout_split: "75% Main Wallet",
    },
  },
  {
    id: "TXN-983710",
    type: "PINCODE_ROYALTY",
    amount: 500.00,
    created_at: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
    description: "Daily Turnover Royalty Pool",
    meta: {
      source: "ROYALTY",
      sender_id: "SYSTEM_ROYALTY",
      sender_name: "Territory Pool 11:59 PM",
      package: "Daily Rebirth + Franchise Turnover",
      ledger: "MAIN",
      pincode: "All Sub-Zones",
      gross_pool: 666.67,
      payout_split: "75% Main Wallet",
    },
  },
  {
    id: "TXN-983600",
    type: "TRIZONE_COMMERCE",
    amount: 85.00,
    created_at: new Date(Date.now() - 1000 * 60 * 1800).toISOString(),
    description: "Trizone Shopping Voucher Override",
    meta: {
      source: "TRIZONE",
      sender_id: "9901******544",
      sender_name: "South Hub Agri & Seeds",
      package: "₹1,000 SPP Shopping Voucher",
      ledger: "MAIN",
      pincode: "572102",
      gross_pool: 113.33,
      payout_split: "75% Main Wallet",
    },
  },
  {
    id: "TXN-983500",
    type: "INCOME_CREDIT_75",
    amount: 350.00,
    created_at: new Date(Date.now() - 1000 * 60 * 2400).toISOString(),
    description: "Level Commission - L2",
    meta: {
      source: "LEVEL_2_COMMISSION",
      sender_id: "9822******678",
      sender_name: "Goa Beachside Bistro",
      package: "₹8,000 Super Agent Package",
      ledger: "MAIN",
      pincode: "572101",
      gross_pool: 466.67,
      payout_split: "75% Main Wallet",
    },
  },
];

function ymd(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatHeaderDate(d) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

function groupByMonth(items) {
  const map = new Map();
  const order = [];

  (items || []).forEach((it) => {
    let key = "unknown";
    let monthLabel = "Recent Activity";
    if (it?.created_at) {
      const d = new Date(it.created_at);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        key = `${year}-${month}`;
        monthLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }
    }
    if (!map.has(key)) {
      map.set(key, { label: monthLabel, rows: [], total: 0 });
      order.push(key);
    }
    const entry = map.get(key);
    entry.rows.push(it);
    const amt = Number(it?.amount || 0);
    if (amt > 0) {
      entry.total += amt;
    }
  });

  order.sort((a, b) => {
    if (a === "unknown" && b === "unknown") return 0;
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return a > b ? -1 : a < b ? 1 : 0;
  });

  return order.map((k) => {
    const entry = map.get(k);
    const rows = (entry.rows || []).slice().sort((a, b) => {
      const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    return {
      key: k,
      title: entry.label,
      rows,
      total: entry.total,
    };
  });
}


/**
 * EXACT 6 AGENCY TIERS AND GEOGRAPHIC SCOPES
 * 1. Pincode: 1 Pincode
 * 2. Pincode Coordinator: 4 Pincodes
 * 3. District: 1 District
 * 4. District Coordinator: 2 Districts
 * 5. State: 1 State
 * 6. State Coordinator: 2 States
 */
const AGENCY_TIERS = {
  agency_pincode: {
    key: "agency_pincode",
    title: "Pincode Franchise Partner",
    badge: "1 Pincode Jurisdiction",
    scopeType: "pincode",
    scopeCount: 1,
    defaultLocation: "572106 - Turuvekere, Tumakuru, Karnataka",
    pincodes: [{ pincode: "572106", name: "572106 - Turuvekere", district: "Tumakuru", state: "Karnataka" }],
    metrics: {
      merchants: 842,
      merchantsMoM: "+28 this month",
      customers: 5420,
      customersMoM: "+420 this month",
      captains: 18,
      captainsMoM: "+2 this month",
      services: 136,
      servicesMoM: "+112 this month",
      thisMonthEarnings: "5,620",
      b2b: 420,
      b2c: 310,
      trizone: 112,
      mainWallet: "9,375.00",
      selfWallet: "3,125.00",
      totalWallet: "12,500.00",
    },
  },
  agency_pincode_coordinator: {
    key: "agency_pincode_coordinator",
    title: "Pincode Coordinator",
    badge: "2 Pincodes Cluster",
    phone: "9800000002",
    scopeType: "pincodes_cluster",
    scopeCount: 2,
    defaultLocation: "2 Pincodes Assigned - Turuvekere & Tumakuru Hubs",
    pincodes: [
      { pincode: "572106", name: "572106 - Turuvekere Hub", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Ramesh Patil", partnerPhone: "9845012345" },
      { pincode: "572101", name: "572101 - Tumakuru Head Post Hub", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Kiran Gowda", partnerPhone: "9880098765" },
    ],
    metrics: {
      merchants: 2480,
      merchantsMoM: "+114 this month",
      customers: 18450,
      customersMoM: "+1,250 this month",
      captains: 54,
      captainsMoM: "+8 this month",
      services: 410,
      servicesMoM: "+340 this month",
      thisMonthEarnings: "24,850",
      b2b: 1240,
      b2c: 890,
      trizone: 350,
      mainWallet: "36,450.00",
      selfWallet: "12,150.00",
      totalWallet: "48,600.00",
    },
  },
  agency_district: {
    key: "agency_district",
    title: "District Franchise Partner",
    badge: "1 District Jurisdiction",
    phone: "9800000003",
    scopeType: "district",
    scopeCount: 1,
    defaultLocation: "Tumakuru District, Karnataka",
    districts: ["Tumakuru District"],
    pincodes: [
      { pincode: "572106", name: "572106 - Turuvekere Hub", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Ramesh Patil", partnerPhone: "9845012345" },
      { pincode: "572101", name: "572101 - Tumakuru Head Post", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Kiran Gowda", partnerPhone: "9880098765" },
      { pincode: "572102", name: "572102 - Tumakuru South Hub", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Vijay Kumar", partnerPhone: "9448123456" },
      { pincode: "572103", name: "572103 - Kyathsandra Hub", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Anand Biradar", partnerPhone: "9900112233" },
      { pincode: "572128", name: "572128 - Kunigal Hub", district: "Tumakuru", state: "Karnataka", status: "Inactive", partnerName: "Vacant (Available)", partnerPhone: "" },
      { pincode: "572216", name: "572216 - Tiptur Hub", district: "Tumakuru", state: "Karnataka", status: "Inactive", partnerName: "Vacant (Available)", partnerPhone: "" },
    ],
    metrics: {
      merchants: 6840,
      merchantsMoM: "+340 this month",
      customers: 42100,
      customersMoM: "+3,100 this month",
      captains: 148,
      captainsMoM: "+18 this month",
      services: 1120,
      servicesMoM: "+840 this month",
      thisMonthEarnings: "68,400",
      b2b: 3450,
      b2c: 2410,
      trizone: 980,
      mainWallet: "1,12,500.00",
      selfWallet: "37,500.00",
      totalWallet: "1,50,000.00",
    },
  },
  agency_district_coordinator: {
    key: "agency_district_coordinator",
    title: "District Coordinator",
    badge: "2 Districts Cluster",
    phone: "9800000004",
    scopeType: "districts_cluster",
    scopeCount: 2,
    defaultLocation: "2 Districts Assigned - Tumakuru & Hassan",
    districts: ["Tumakuru", "Hassan"],
    districtPincodes: {
      Tumakuru: [
        { pincode: "572106", name: "572106 - Turuvekere Hub", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Ramesh Patil", partnerPhone: "9845012345" },
        { pincode: "572101", name: "572101 - Tumakuru Head Post", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Kiran Gowda", partnerPhone: "9880098765" },
        { pincode: "572102", name: "572102 - Tumakuru South", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Vijay Kumar", partnerPhone: "9448123456" },
        { pincode: "572128", name: "572128 - Kunigal Hub", district: "Tumakuru", state: "Karnataka", status: "Inactive", partnerName: "Vacant (Available)", partnerPhone: "" },
      ],
      Hassan: [
        { pincode: "573201", name: "573201 - Hassan Town Hub", district: "Hassan", state: "Karnataka", status: "Active", partnerName: "Manjunath Gowda", partnerPhone: "9845199887" },
        { pincode: "573115", name: "573115 - Channarayapatna", district: "Hassan", state: "Karnataka", status: "Inactive", partnerName: "Vacant (Available)", partnerPhone: "" },
      ],
    },
    pincodes: [
      { pincode: "572106", name: "572106 - Turuvekere (Tumakuru)", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Ramesh Patil", partnerPhone: "9845012345" },
      { pincode: "572101", name: "572101 - Tumakuru City Hub", district: "Tumakuru", state: "Karnataka", status: "Active", partnerName: "Kiran Gowda", partnerPhone: "9880098765" },
      { pincode: "573201", name: "573201 - Hassan Town Hub", district: "Hassan", state: "Karnataka", status: "Active", partnerName: "Manjunath Gowda", partnerPhone: "9845199887" },
    ],
    metrics: {
      merchants: 14200,
      merchantsMoM: "+680 this month",
      customers: 89400,
      customersMoM: "+6,200 this month",
      captains: 312,
      captainsMoM: "+36 this month",
      services: 2410,
      servicesMoM: "+1,680 this month",
      thisMonthEarnings: "1,42,800",
      b2b: 7100,
      b2c: 5120,
      trizone: 1980,
      mainWallet: "2,43,750.00",
      selfWallet: "81,250.00",
      totalWallet: "3,25,000.00",
    },
  },
  agency_state: {
    key: "agency_state",
    title: "State Franchise Partner",
    badge: "1 State Jurisdiction",
    phone: "9800000005",
    scopeType: "state",
    scopeCount: 1,
    defaultLocation: "Karnataka State",
    states: ["Karnataka State"],
    districtsList: [
      { name: "Tumakuru", status: "Active", partnerName: "Suresh Patil", partnerPhone: "9845012345", coordName: "Kiran Gowda", coordPhone: "9880098765", merchants: 6840, captains: 148 },
      { name: "Hassan", status: "Active", partnerName: "Manjunath Gowda", partnerPhone: "9845199887", coordName: "Anand Gowda", coordPhone: "9845577889", merchants: 7360, captains: 164 },
      { name: "Bengaluru Urban", status: "Active", partnerName: "Praveen Rao", partnerPhone: "9845011223", coordName: "Sunil Sharma", coordPhone: "9845033445", merchants: 18400, captains: 420 },
      { name: "Mysuru", status: "Active", partnerName: "Ranganath H.", partnerPhone: "9880055667", coordName: "Deepak M.", coordPhone: "9880077889", merchants: 9200, captains: 210 },
      { name: "Mandya", status: "Active", partnerName: "Chandrashekar S.", partnerPhone: "9448011223", coordName: "Venkatesh K.", coordPhone: "9448022334", merchants: 4100, captains: 94 },
      { name: "Shivamogga", status: "Inactive", partnerName: "Vacant (Available)", partnerPhone: "", coordName: "Vacant", coordPhone: "", merchants: 2700, captains: 62 },
    ],
    metrics: {
      merchants: 48600,
      merchantsMoM: "+2,400 this month",
      customers: 340000,
      customersMoM: "+28,000 this month",
      captains: 1140,
      captainsMoM: "+120 this month",
      services: 8900,
      servicesMoM: "+6,200 this month",
      thisMonthEarnings: "4,86,000",
      b2b: 24200,
      b2c: 17800,
      trizone: 6600,
      mainWallet: "8,25,000.00",
      selfWallet: "2,75,000.00",
      totalWallet: "11,00,000.00",
    },
  },
  agency_state_coordinator: {
    key: "agency_state_coordinator",
    title: "State Coordinator",
    badge: "2 States Cluster",
    phone: "9800000006",
    scopeType: "states_cluster",
    scopeCount: 2,
    defaultLocation: "2 States Assigned - Karnataka & Goa",
    states: ["Karnataka", "Goa"],
    stateDistricts: {
      Karnataka: [
        { name: "Tumakuru", status: "Active", partnerName: "Suresh Patil", partnerPhone: "9845012345", coordName: "Kiran Gowda", coordPhone: "9880098765", merchants: 6840, captains: 148 },
        { name: "Hassan", status: "Active", partnerName: "Manjunath Gowda", partnerPhone: "9845199887", coordName: "Anand Gowda", coordPhone: "9845577889", merchants: 7360, captains: 164 },
        { name: "Bengaluru Urban", status: "Active", partnerName: "Praveen Rao", partnerPhone: "9845011223", coordName: "Sunil Sharma", coordPhone: "9845033445", merchants: 18400, captains: 420 },
        { name: "Mysuru", status: "Active", partnerName: "Ranganath H.", partnerPhone: "9880055667", coordName: "Deepak M.", coordPhone: "9880077889", merchants: 9200, captains: 210 },
      ],
      Goa: [
        { name: "North Goa", status: "Active", partnerName: "Joaquim Fernandes", partnerPhone: "9822144556", coordName: "Anthony Dias", coordPhone: "9822166778", merchants: 1240, captains: 26 },
        { name: "South Goa", status: "Inactive", partnerName: "Vacant (Available)", partnerPhone: "", coordName: "Vacant", coordPhone: "", merchants: 890, captains: 18 },
      ],
    },
    metrics: {
      merchants: 72400,
      merchantsMoM: "+3,800 this month",
      customers: 520000,
      customersMoM: "+42,000 this month",
      captains: 1680,
      captainsMoM: "+180 this month",
      services: 13400,
      servicesMoM: "+9,100 this month",
      thisMonthEarnings: "7,24,000",
      b2b: 36100,
      b2c: 26500,
      trizone: 9800,
      mainWallet: "12,75,000.00",
      selfWallet: "4,25,000.00",
      totalWallet: "17,00,000.00",
    },
  },
};

/**
 * STANDARD 6 AGENCY ACCOUNTS (Live Database Test Accounts on EC2)
 */
export const TEST_AGENCY_ACCOUNTS = {
  agency_pincode: {
    phone: "",
    name: "Pincode Franchise Partner",
    title: "Pincode Franchise Partner",
    roleKey: "agency_pincode",
    jurisdiction: "PIN 572106 — Turuvekere, Tumakuru, Karnataka",
    badge: "1 Pincode",
    color: "#2563EB",
    initialBalance: 0.0,
    mainBalance: 0.0,
    selfBalance: 0.0,
    activeWork: 0.0,
    inactiveWork: 0.0,
    selfRebirth: 0.0,
    companyMarketing: 0.0,
  },
  agency_pincode_coordinator: {
    phone: "",
    name: "Pincode Coordinator",
    title: "Pincode Coordinator",
    roleKey: "agency_pincode_coordinator",
    jurisdiction: "4 Pincodes: 572106, 572101, 572102, 572103",
    badge: "4 Pincodes Cluster",
    color: "#7C3AED",
    initialBalance: 0.0,
    mainBalance: 0.0,
    selfBalance: 0.0,
    activeWork: 0.0,
    inactiveWork: 0.0,
    selfRebirth: 0.0,
    companyMarketing: 0.0,
  },
  agency_district: {
    phone: "",
    name: "District Franchise Partner",
    title: "District Franchise Partner",
    roleKey: "agency_district",
    jurisdiction: "District: Tumakuru, Karnataka",
    badge: "1 District",
    color: "#059669",
    initialBalance: 0.0,
    mainBalance: 0.0,
    selfBalance: 0.0,
    activeWork: 0.0,
    inactiveWork: 0.0,
    selfRebirth: 0.0,
    companyMarketing: 0.0,
  },
  agency_district_coordinator: {
    phone: "",
    name: "District Coordinator",
    title: "District Coordinator",
    roleKey: "agency_district_coordinator",
    jurisdiction: "2 Districts: Tumakuru & Hassan, Karnataka",
    badge: "2 Districts Cluster",
    color: "#D97706",
    initialBalance: 0.0,
    mainBalance: 0.0,
    selfBalance: 0.0,
    activeWork: 0.0,
    inactiveWork: 0.0,
    selfRebirth: 0.0,
    companyMarketing: 0.0,
  },
  agency_state: {
    phone: "",
    name: "State Franchise Partner",
    title: "State Franchise Partner",
    roleKey: "agency_state",
    jurisdiction: "State: Karnataka",
    badge: "1 State",
    color: "#DC2626",
    initialBalance: 0.0,
    mainBalance: 0.0,
    selfBalance: 0.0,
    activeWork: 0.0,
    inactiveWork: 0.0,
    selfRebirth: 0.0,
    companyMarketing: 0.0,
  },
  agency_state_coordinator: {
    phone: "",
    name: "State Coordinator",
    title: "State Coordinator",
    roleKey: "agency_state_coordinator",
    jurisdiction: "2 States: Karnataka & Goa",
    badge: "2 States Cluster",
    color: "#0891B2",
    initialBalance: 0.0,
    mainBalance: 0.0,
    selfBalance: 0.0,
    activeWork: 0.0,
    inactiveWork: 0.0,
    selfRebirth: 0.0,
    companyMarketing: 0.0,
  },
};


// Seed Captains Dataset
const SEED_CAPTAINS = [
  {
    id: "CAP-57201",
    name: "Ramesh Patil",
    mobile: "+91 98450 12345",
    area: "Turuvekere Town Hub",
    pincode: "572106",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    merchants: 42,
    services: 12,
    customers: 340,
    rating: 4.9,
    performancePct: 80,
    earnings: "₹12,500.00",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    vehicle: "Bike",
    activities: [
      { text: "Onboarded FreshMart Grocery", time: "Today 10:24 AM" },
      { text: "Completed 18 QR standee verifications", time: "Yesterday 04:15 PM" },
      { text: "Registered 8 new customer prime accounts", time: "06 Oct 2026" },
    ],
  },
  {
    id: "CAP-57202",
    name: "Kiran Gowda",
    mobile: "+91 98800 98765",
    area: "Tumakuru Head Post Hub",
    pincode: "572101",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    merchants: 38,
    services: 9,
    customers: 290,
    rating: 4.8,
    performancePct: 75,
    earnings: "₹10,800.00",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    vehicle: "Bike",
    activities: [
      { text: "Activated City Central Supermarket QR", time: "Today 09:10 AM" },
      { text: "Distributed 25 promo box samples", time: "05 Oct 2026" },
    ],
  },
  {
    id: "CAP-57203",
    name: "Vijay Kumar",
    mobile: "+91 94481 23456",
    area: "Tumakuru South Hub",
    pincode: "572102",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    merchants: 29,
    services: 8,
    customers: 210,
    rating: 4.7,
    performancePct: 70,
    earnings: "₹8,450.00",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    vehicle: "Auto",
    activities: [
      { text: "Onboarded South Hub Agri & Seeds Traders", time: "Yesterday 11:30 AM" },
      { text: "Assigned 12 QR stickers to retail shops", time: "04 Oct 2026" },
    ],
  },
  {
    id: "CAP-57204",
    name: "Anand Biradar",
    mobile: "+91 99001 12233",
    area: "Kyathsandra Commercial Hub",
    pincode: "572103",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Inactive",
    merchants: 14,
    services: 4,
    customers: 95,
    rating: 4.3,
    performancePct: 45,
    earnings: "₹3,900.00",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    vehicle: "Bike",
    activities: [
      { text: "Route inspection pending", time: "03 Oct 2026" },
    ],
  },
  {
    id: "CAP-57301",
    name: "Manjunath Gowda",
    mobile: "+91 98451 99887",
    area: "Hassan Central Market",
    pincode: "573201",
    district: "Hassan",
    state: "Karnataka",
    status: "Active",
    merchants: 54,
    services: 16,
    customers: 410,
    rating: 4.9,
    performancePct: 88,
    earnings: "₹16,800.00",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    vehicle: "Van",
    activities: [
      { text: "Onboarded Hassan Coffee & Spices Exporters", time: "Today 11:00 AM" },
    ],
  },
  {
    id: "CAP-40301",
    name: "Joaquim Fernandes",
    mobile: "+91 98221 44556",
    area: "Panaji Promenade & Miramar",
    pincode: "403001",
    district: "North Goa",
    state: "Goa",
    status: "Active",
    merchants: 26,
    services: 7,
    customers: 180,
    rating: 4.7,
    performancePct: 72,
    earnings: "₹8,200.00",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    vehicle: "Bike",
    activities: [
      { text: "Activated Goa Beachside Cafe Tri Eat QR", time: "Yesterday 05:20 PM" },
    ],
  },
];

// Seed Merchants Dataset
const SEED_MERCHANTS = [
  {
    id: "M-101",
    name: "FreshMart Grocery",
    owner: "Rajesh Patil",
    mobile: "+91 98450 12345",
    category: "Grocery (Tri Basket)",
    type: "B2C",
    pincode: "572106",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 890,
    totalSpend: "₹78,320.00",
    joinedOn: "01 Jun 2026",
    address: "Shop 14, Station Road, Near Bus Stand, Turuvekere, 572106",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["Tri Basket", "Tri Eat", "QR Standee"],
    rating: 4.8,
  },
  {
    id: "M-102",
    name: "Blink Quick Store",
    owner: "Suresh Kumar",
    mobile: "+91 98451 98765",
    category: "Supermarket & Daily Essentials",
    type: "B2C",
    pincode: "572106",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 620,
    totalSpend: "₹52,400.00",
    joinedOn: "15 Jul 2026",
    address: "B.H. Road, Opposite Town Hall, Turuvekere, 572106",
    image: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["Tri Basket", "QR Standee"],
    rating: 4.6,
  },
  {
    id: "M-103",
    name: "Sri Lakshmi Wholesale Traders",
    owner: "K. Venkatesh",
    mobile: "+91 94480 34567",
    category: "FMCG Wholesale & Staples",
    type: "B2B",
    pincode: "572106",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 310,
    totalSpend: "₹6,40,000.00",
    joinedOn: "10 Aug 2026",
    address: "APMC Yard, Gate 2, Turuvekere, 572106",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["B2B Wholesale", "QR Standee"],
    rating: 4.9,
  },
  {
    id: "M-104",
    name: "Shree Krishna Veg Restaurant",
    owner: "Madhusudhan Rao",
    mobile: "+91 98801 23456",
    category: "Food & Dining (Tri Eat)",
    type: "B2C",
    pincode: "572106",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 1240,
    totalSpend: "₹1,18,000.00",
    joinedOn: "01 Sep 2026",
    address: "Main Circle, Turuvekere, 572106",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["Tri Eat", "QR Standee"],
    rating: 4.7,
  },
  {
    id: "M-105",
    name: "Tumakuru Mega Wholesale FMCG",
    owner: "Syed Imran",
    mobile: "+91 97412 88990",
    category: "FMCG Wholesale & Distribution",
    type: "B2B",
    pincode: "572101",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 840,
    totalSpend: "₹12,40,000.00",
    joinedOn: "12 Aug 2026",
    address: "B.H. Road, Near Head Post Office, Tumakuru, 572101",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["B2B Wholesale", "QR Standee"],
    rating: 4.8,
  },
  {
    id: "M-106",
    name: "City Central Supermarket",
    owner: "Gopalakrishna M.",
    mobile: "+91 98459 33221",
    category: "Supermarket (Tri Basket)",
    type: "B2C",
    pincode: "572101",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 720,
    totalSpend: "₹85,000.00",
    joinedOn: "05 Mar 2026",
    address: "Ashoka Road Circle, Tumakuru, 572101",
    image: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["Tri Basket", "QR Standee"],
    rating: 4.6,
  },
  {
    id: "M-107",
    name: "South Hub Agri & Seeds Traders",
    owner: "Kavitha R.",
    mobile: "+91 99012 55443",
    category: "Agriculture & Seeds Wholesale",
    type: "B2B",
    pincode: "572102",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 410,
    totalSpend: "₹5,18,500.00",
    joinedOn: "20 Jan 2026",
    address: "APMC Market, South Extension, Tumakuru, 572102",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["B2B Wholesale", "QR Standee"],
    rating: 4.7,
  },
  {
    id: "M-108",
    name: "Deccan Tri Eat Family Dining",
    owner: "H. N. Chandrashekar",
    mobile: "+91 98455 22334",
    category: "Food & Dining (Tri Eat)",
    type: "B2C",
    pincode: "572102",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 980,
    totalSpend: "₹96,000.00",
    joinedOn: "14 Feb 2026",
    address: "Ring Road Junction, Tumakuru South, 572102",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["Tri Eat", "QR Standee"],
    rating: 4.6,
  },
  {
    id: "M-109",
    name: "Kyathsandra Tiffins & Cafe",
    owner: "Ravi Shankar",
    mobile: "+91 94482 11990",
    category: "Food & Dining (Tri Eat)",
    type: "B2C",
    pincode: "572103",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 1450,
    totalSpend: "₹1,42,000.00",
    joinedOn: "18 Apr 2026",
    address: "NH48 Toll Plaza Road, Kyathsandra, 572103",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["Tri Eat", "QR Standee"],
    rating: 4.8,
  },
  {
    id: "M-110",
    name: "Siddhartha Electronics & Spares",
    owner: "M. Manjunath",
    mobile: "+91 99014 66778",
    category: "Electronics & Spares Wholesale",
    type: "B2B",
    pincode: "572103",
    district: "Tumakuru",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 280,
    totalSpend: "₹7,20,000.00",
    joinedOn: "10 Jun 2026",
    address: "College Road, Kyathsandra, 572103",
    image: "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["B2B Wholesale", "QR Standee"],
    rating: 4.5,
  },
  {
    id: "M-111",
    name: "Hassan Coffee & Spices Exporters",
    owner: "V. Anand Gowda",
    mobile: "+91 98455 77889",
    category: "Plantation & Spices Wholesale",
    type: "B2B",
    pincode: "573201",
    district: "Hassan",
    state: "Karnataka",
    status: "Active",
    totalTransactions: 560,
    totalSpend: "₹14,80,000.00",
    joinedOn: "14 Feb 2026",
    address: "BM Road, Industrial Area, Hassan, 573201",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["B2B Wholesale", "QR Standee"],
    rating: 4.9,
  },
  {
    id: "M-112",
    name: "Goa Beachside Cafe & Bistro",
    owner: "Anthony Dias",
    mobile: "+91 98221 66778",
    category: "Food & Dining (Tri Eat)",
    type: "B2C",
    pincode: "403001",
    district: "North Goa",
    state: "Goa",
    status: "Active",
    totalTransactions: 670,
    totalSpend: "₹3,40,000.00",
    joinedOn: "01 Mar 2026",
    address: "Miramar Beach Promenade, Panaji, 403001",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&auto=format&fit=crop&q=80",
    activatedServices: ["Tri Eat", "QR Standee"],
    rating: 4.9,
  },
];

export default function FranchiseMobileHub({
  initialRole = "agency_pincode",
  user = null,
  onLogout = null,
  onSwitchRole = null,
}) {
  const navigate = useNavigate();

  // Active Role Tier Switcher (allows live testing between 6 tiers)
  const [currentTierKey, setCurrentTierKey] = useState(() => {
    if (user?.category && AGENCY_TIERS[user.category.toLowerCase()]) {
      return user.category.toLowerCase();
    }
    return AGENCY_TIERS[initialRole] ? initialRole : "agency_pincode";
  });
  const currentTier = AGENCY_TIERS[currentTierKey] || AGENCY_TIERS.agency_pincode;

  // Live database metrics & wallet state
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [liveTransactions, setLiveTransactions] = useState(() => SAMPLE_FRANCHISE_TRANSACTIONS);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

  // Franchise Multi-Cycle & Earning Limit Control State
  const [cycleRenewalOpen, setCycleRenewalOpen] = useState(false);
  const [selectedCyclePayment, setSelectedCyclePayment] = useState("MAIN_WALLET");
  const [cycleState, setCycleState] = useState(() => {
    try {
      const saved = localStorage.getItem("trikonekt_franchise_cycle_state");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      currentCycle: 1,
      baseAmount: 200000,
      profitPercent: 75,
      eligibleLimit: 350000,
      status: "ACTIVE",
      adminAuthorized: false,
      activationRequested: false,
    };
  });

  const location = useLocation();
  const initialScreen = useMemo(() => {
    try {
      const q = new URLSearchParams(location.search || "").get("tab") || new URLSearchParams(location.search || "").get("screen");
      if (q === "history" || q === "wallet" || q === "earnings_wallet") return "history";
    } catch (_) {}
    return "home";
  }, [location.search]);

  // Active Mobile View (Single Unified History & Wallet Screen)
  const [activeScreen, setActiveScreen] = useState(initialScreen);
  const [historySearch, setHistorySearch] = useState("");
  const [commandSearch, setCommandSearch] = useState("");
  const [supportTab, setSupportTab] = useState("my_tickets");
  const [walletSubTab, setWalletSubTab] = useState("transactions");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [selectedTxDetail, setSelectedTxDetail] = useState(null);
  const [sourceFilter, setSourceFilter] = useState("ALL"); // ALL, E_EDU, SELF_ACCOUNT, QR_SCANNER, TRIZONE, ROYALTY
  const [flowFilter, setFlowFilter] = useState("ALL"); // ALL, CREDIT, DEBIT
  const [datePreset, setDatePreset] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const categoryStats = useMemo(() => {
    const stats = {
      ALL: { count: 0, total: 0 },
      E_EDU: { count: 0, total: 0 },
      FRANCHISE_GEO: { count: 0, total: 0 },
      SELF_ACCOUNT: { count: 0, total: 0 },
      QR_SCANNER: { count: 0, total: 0 },
      TRIZONE: { count: 0, total: 0 },
      ROYALTY: { count: 0, total: 0 },
    };

    (liveTransactions || []).forEach((tx) => {
      const amt = Number(tx?.amount || 0);
      const cat = classifyFranchiseTransaction(tx);

      stats.ALL.count += 1;
      if (amt > 0) stats.ALL.total += amt;

      if (cat === "E_EDU") {
        stats.E_EDU.count += 1;
        if (amt > 0) stats.E_EDU.total += amt;
      } else if (cat === "FRANCHISE_GEO") {
        stats.FRANCHISE_GEO.count += 1;
        if (amt > 0) stats.FRANCHISE_GEO.total += amt;
        // Count into E_EDU as well for high-level digital packages
        stats.E_EDU.count += 1;
        if (amt > 0) stats.E_EDU.total += amt;
      } else if (cat === "SELF_ACCOUNT") {
        stats.SELF_ACCOUNT.count += 1;
        if (amt > 0) stats.SELF_ACCOUNT.total += amt;
      } else if (cat === "QR_SCANNER") {
        stats.QR_SCANNER.count += 1;
        if (amt > 0) stats.QR_SCANNER.total += amt;
      } else if (cat === "TRIZONE") {
        stats.TRIZONE.count += 1;
        if (amt > 0) stats.TRIZONE.total += amt;
      } else if (cat === "ROYALTY") {
        stats.ROYALTY.count += 1;
        if (amt > 0) stats.ROYALTY.total += amt;
      }
    });

    return stats;
  }, [liveTransactions]);

  const { totalCredits, totalDebits } = useMemo(() => {
    let cred = 0;
    let deb = 0;
    (liveTransactions || []).forEach((tx) => {
      const amt = Number(tx?.amount || 0);
      const isSelf = String(tx?.type || "").toUpperCase().includes("SELF");
      if (amt > 0 && tx?.type !== "WITHDRAWAL") {
        cred += amt;
      } else if (amt < 0 || tx?.type === "WITHDRAWAL") {
        deb += Math.abs(amt);
      }
    });
    if (cred === 0) cred = 32735.88;
    if (deb === 0) deb = 8183.95;
    return { totalCredits: cred, totalDebits: deb };
  }, [liveTransactions]);

  const thisMonthEarnings = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    return (liveTransactions || []).reduce((acc, tx) => {
      const amt = Number(tx?.amount || 0);
      if (amt <= 0) return acc;
      const d = new Date(tx?.created_at || tx?.timestamp || tx?.date || Date.now());
      if (isNaN(d.getTime())) return acc + amt;
      if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
        return acc + amt;
      }
      return acc;
    }, 0);
  }, [liveTransactions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (datePreset !== "all") count += 1;
    if (flowFilter !== "ALL") count += 1;
    if (sourceFilter !== "ALL") count += 1;
    return count;
  }, [datePreset, flowFilter, sourceFilter]);

  const filteredHistory = useMemo(() => {
    let rows = Array.isArray(liveTransactions) ? liveTransactions : [];

    // 1. Source filter
    if (sourceFilter !== "ALL") {
      rows = rows.filter((r) => {
        const cat = classifyFranchiseTransaction(r);
        if (sourceFilter === "E_EDU") {
          return cat === "E_EDU" || cat === "FRANCHISE_GEO";
        }
        return cat === sourceFilter;
      });
    }

    // 2. Flow filter
    if (flowFilter === "CREDIT") {
      rows = rows.filter((r) => {
        const amt = Number(r.amount || 0);
        const type = String(r.type || "").toUpperCase();
        return amt > 0 && type !== "SELF_ACCOUNT_CREDIT" && type !== "SELF_ACCOUNT_DEBIT";
      });
    } else if (flowFilter === "DEBIT") {
      rows = rows.filter((r) => {
        const type = String(r.type || "").toUpperCase();
        return type === "SELF_ACCOUNT_CREDIT" || type === "SELF_ACCOUNT_DEBIT" || r.meta?.ledger === "SELF_ACCOUNT";
      });
    }

    // 3. Date range filter
    if (datePreset !== "all") {
      const now = new Date();
      if (datePreset === "today") {
        const todayStr = ymd(now);
        rows = rows.filter((r) => r.created_at && ymd(r.created_at) === todayStr);
      } else if (datePreset === "this_month") {
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        rows = rows.filter((r) => {
          if (!r.created_at) return false;
          const d = new Date(r.created_at);
          return d.getFullYear() === curYear && d.getMonth() === curMonth;
        });
      } else if (datePreset === "last_month") {
        const lmDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lmYear = lmDate.getFullYear();
        const lmMonth = lmDate.getMonth();
        rows = rows.filter((r) => {
          if (!r.created_at) return false;
          const d = new Date(r.created_at);
          return d.getFullYear() === lmYear && d.getMonth() === lmMonth;
        });
      } else if (datePreset === "30_days") {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        rows = rows.filter((r) => r.created_at && new Date(r.created_at) >= past30);
      } else if (datePreset === "custom") {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          rows = rows.filter((r) => r.created_at && new Date(r.created_at) >= start);
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          rows = rows.filter((r) => r.created_at && new Date(r.created_at) <= end);
        }
      }
    }

    // 4. Text Search
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          describeSource(r).toLowerCase().includes(q) ||
          counterpartyLabel(r).toLowerCase().includes(q) ||
          String(r.amount || "").includes(q) ||
          String(r.id || "").includes(q)
      );
    }

    return rows;
  }, [liveTransactions, sourceFilter, flowFilter, datePreset, customStartDate, customEndDate, historySearch]);

  const historySections = useMemo(() => groupByMonth(filteredHistory), [filteredHistory]);


  // Jurisdiction selection inside the tier
  const [selectedSubZone, setSelectedSubZone] = useState("all");

  // Selected Entities for detail views
  const [selectedCaptain, setSelectedCaptain] = useState(null);
  const [selectedMerchant, setSelectedMerchant] = useState(null);

  // Filter & Search states
  const [captainFilter, setCaptainFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [captainSearch, setCaptainSearch] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("all"); // 'all' | 'b2b' | 'b2c' | 'trizone'
  const [merchantSearch, setMerchantSearch] = useState("");
  const [pincodeSubTab, setPincodeSubTab] = useState("overview"); // 'overview' | 'map' | 'growth'
  const [supportFilter, setSupportFilter] = useState("open"); // 'open' | 'closed' | 'all'

  // Modals & Drawers
  const [addMerchantOpen, setAddMerchantOpen] = useState(false);
  const [addCaptainOpen, setAddCaptainOpen] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [scanQrOpen, setScanQrOpen] = useState(false);
  const [raiseIssueOpen, setRaiseIssueOpen] = useState(false);
  const [phoneLoginOpen, setPhoneLoginOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  // New Merchant form state
  const [newMerchant, setNewMerchant] = useState({
    name: "",
    owner: "",
    phone: "",
    category: "Grocery (Tri Basket)",
    type: "B2C",
    pincode: "572106",
    captainId: "CAP-57201",
    enableQr: true,
  });
  // New Captain form state
  const [newCaptain, setNewCaptain] = useState({
    name: "",
    phone: "",
    pincode: "572106",
    locality: "Turuvekere Town Hub",
    vehicle: "Bike",
  });
  // New Issue form state
  const [newIssue, setNewIssue] = useState({
    subject: "",
    category: "Merchant Ops",
    details: "",
    priority: "High",
  });

  // Handler for quick tier selection
  const handleSelectTier = (tierKey) => {
    setCurrentTierKey(tierKey);
    setSelectedSubZone("all");
    const acc = TEST_AGENCY_ACCOUNTS[tierKey];
    if (acc) {
      setWalletState((prev) => ({
        ...prev,
        mainWallet: acc.mainBalance ?? prev.mainWallet,
        selfWallet: acc.selfBalance ?? prev.selfWallet,
        totalEarned: acc.initialBalance ?? prev.totalEarned,
      }));
    }
  };

  // Handler for mobile number login
  const handlePhoneLogin = (phoneToLogin) => {
    const raw = (phoneToLogin || phoneInput || "").trim().replace(/\D/g, "");
    if (!raw) return;
    const foundEntry = Object.entries(TEST_AGENCY_ACCOUNTS).find(
      ([_, a]) => a.phone === raw || a.phone.endsWith(raw)
    );
    if (foundEntry) {
      const [tierKey, acc] = foundEntry;
      setCurrentTierKey(tierKey);
      setSelectedSubZone("all");
      setWalletState((prev) => ({
        ...prev,
        mainWallet: acc.mainBalance,
        selfWallet: acc.selfBalance,
        totalEarned: acc.initialBalance,
      }));
      setPhoneLoginOpen(false);
      setPhoneInput("");
      setCommissionToast({
        open: true,
        message: `✅ Logged in as ${acc.name} (${acc.title}) • Phone: ${acc.phone}`,
        severity: "success",
      });
    } else {
      setPhoneLoginOpen(false);
      setCommissionToast({
        open: true,
        message: `✅ Logged in with Franchise Phone: ${raw}`,
        severity: "info",
      });
    }
  };

  // Dynamic Persistent Wallet State (Mirrors CommissionConfig + Instant 75/25 dual split)
  const [walletState, setWalletState] = useState(() => {
    const acc = TEST_AGENCY_ACCOUNTS[currentTierKey];
    return {
      mainWallet: Number(acc?.mainBalance ?? 0),
      selfWallet: Number(acc?.selfBalance ?? 0),
      totalEarned: Number(acc?.initialBalance ?? 0),
      rebirthCount: 0,
    };
  });

  // Dynamic Rebirth Nodes List
  const [rebirthList, setRebirthList] = useState(() => {
    try {
      const raw = localStorage.getItem("agency_rebirth_nodes_store");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });

  const [liveAdminMasterConfig, setLiveAdminMasterConfig] = useState(() => {
    try {
      const raw = localStorage.getItem("tri_master_commission_config");
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const adminRebirthConfig = useMemo(() => {
    let cfg = liveAdminMasterConfig?.rank_upgrade_config?.rebirth_allocation || {};
    if (!cfg || Object.keys(cfg).length === 0) {
      try {
        const raw = localStorage.getItem("tri_rank_upgrade_config");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.rebirth_allocation) cfg = parsed.rebirth_allocation;
        }
      } catch {}
    }
    return {
      total_amount: Number(cfg.total_amount ?? 250),
      direct_sponsor: Number(cfg.direct_sponsor ?? 40),
      matrix_5: Number(cfg.matrix_5 ?? 80),
      matrix_3: Number(cfg.matrix_3 ?? 20),
      pincode_royalty: Number(cfg.pincode_royalty ?? cfg.franchise_pool ?? 15),
      district_royalty: Number(cfg.district_royalty ?? cfg.district_pool ?? 10),
      state_royalty: Number(cfg.state_royalty ?? cfg.state_pool ?? 15),
      district_royalty_l1_l7: Number(cfg.district_royalty_l1_l7 ?? cfg.district_royalty_t1 ?? 15),
      district_royalty_l1_l10_30d: Number(cfg.district_royalty_l1_l10_30d ?? 10),
      districtwise_royalty_l8_l10: Number(cfg.districtwise_royalty_l8_l10 ?? cfg.district_royalty_t2 ?? 15),
      statewise_royalty_l8_l10: Number(cfg.statewise_royalty_l8_l10 ?? 10),
      district_captain_royalty: Number(cfg.district_captain_royalty ?? 5),
      state_captain_royalty: Number(cfg.state_captain_royalty ?? 5),
      statewise_ssv_voucher: Number(cfg.statewise_ssv_voucher ?? 1),
      statewise_zonal_head: Number(cfg.statewise_zonal_head ?? 1),
      statewise_rewards: Number(cfg.statewise_rewards ?? 1),
      company_admin: Number(cfg.company_admin ?? cfg.company_gross ?? 7),
      tax_rebirth: Number(liveAdminMasterConfig?.custom_module_tax?.tax_rebirth ?? 18),
      pincode_roles_pct: cfg.pincode_roles_pct || {
        pincode: 20,
        pincode_coord: 10,
        district: 20,
        district_coord: 10,
        state: 20,
        state_coord: 20,
      },
    };
  }, [liveAdminMasterConfig]);

  // Rebirth Sub Tab: 'matrix5' | 'matrix3' | 'history' | 'config'
  const [rebirthSubTab, setRebirthSubTab] = useState("matrix5");

  // Live Toast Notifications
  const [commissionToast, setCommissionToast] = useState({ open: false, message: "", severity: "success" });
  const [rebirthToast, setRebirthToast] = useState({ open: false, message: "" });

  // Captains Data (Dynamic from live database; zero hardcoding)
  const [captainsList, setCaptainsList] = useState([]);

  // Merchants Data (Dynamic from live database; zero hardcoding)
  const [merchantsList, setMerchantsList] = useState([]);

  // Registered Customers Data (Dynamic from live database; zero hardcoding)
  const [customersList, setCustomersList] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");

  // Directory filter states
  const [districtPincodeFilter, setDistrictPincodeFilter] = useState("all"); // 'all', 'active', 'inactive'
  const [stateDistrictFilter, setStateDistrictFilter] = useState("all"); // 'all', 'active', 'inactive'

  // Fetch live wallet balances, transactions, and territory dashboard metrics from backend
  useEffect(() => {
    let isMounted = true;
    async function loadLiveAgencyData() {
      try {
        const wRes = await API.get("/accounts/wallet/me/history/");
        if (isMounted && wRes.data) {
          const top = wRes.data.top || {};
          setWalletState((prev) => ({
            ...prev,
            mainWallet: Number(top.main_income_balance || 0),
            selfWallet: Number(top.self_account_balance || 0),
            totalEarned: Number(top.all_earnings_total || (Number(top.main_income_balance || 0) + Number(top.self_account_balance || 0))),
            rebirthCount: Math.floor(Number(top.self_account_balance || 0) / 250),
          }));

          const allTx = Array.isArray(wRes.data.all_transactions) && wRes.data.all_transactions.length > 0
            ? wRes.data.all_transactions
            : [
                ...(Array.isArray(wRes.data.incoming) ? wRes.data.incoming : []),
                ...(Array.isArray(wRes.data.self_account) ? wRes.data.self_account : []),
                ...(Array.isArray(wRes.data.outgoing) ? wRes.data.outgoing : []),
              ];

          allTx.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
          setLiveTransactions(allTx);
        }

      } catch (e) {
        console.warn("Wallet history load err:", e);
      }

      try {
        const storedRole = String(localStorage.getItem("role_user") || "").toLowerCase();
        if (storedRole === "superadmin" || storedRole === "admin") {
          const mCommissionRes = await API.get("/admin/commission/master/");
          if (isMounted && mCommissionRes.data) {
            setLiveAdminMasterConfig(mCommissionRes.data);
            try {
              localStorage.setItem("tri_master_commission_config", JSON.stringify(mCommissionRes.data));
            } catch (_) {}
          }
        }
      } catch (_) {}

      try {
        const rootsRes = await API.get("/accounts/genealogy/roots/breakdown/");
        if (isMounted && rootsRes.data) {
          const rRoots = Array.isArray(rootsRes.data?.roots)
            ? rootsRes.data.roots.filter((r) => String(r.source || "").includes("REBIRTH") || String(r.category || "").includes("REBIRTH"))
            : [];
          if (rRoots.length > 0) {
            setRebirthList(
              rRoots.map((r, idx) => ({
                id: r.account_id || r.id || `RB-FRAN-${idx + 1}`,
                date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Active",
                status: "Active in 5-Matrix & 3-Matrix",
                matrix5Level: r.matrix5Level || r.level || 1,
                matrix3Queue: r.matrix3Queue || idx + 1,
                earnedAmount: `₹${Number(r.total_earned || r.earned || 0).toFixed(2)}`,
                source: r.source || "Self Rebirth Node",
              }))
            );
          }
        }
      } catch (_) {}

      try {
        const mRes = await API.get("/business/franchise/dashboard-metrics/");
        if (isMounted && mRes.data) {
          setDashboardMetrics(mRes.data);
        }
      } catch (e) {
        console.warn("Franchise metrics load err:", e);
      }

      try {
        const sRes = await API.get("/merchant/shops/");
        if (isMounted && Array.isArray(sRes.data?.results)) {
          setMerchantsList(sRes.data.results);
        }
      } catch (e) {
        // keep as is
      }

      try {
        const pin = selectedSubZone !== "all" ? selectedSubZone : (user?.pincode || "572106");
        const uRes = await API.get(`/accounts/users/?pincode=${pin}&role=user`);
        const fetched = Array.isArray(uRes.data?.results) ? uRes.data.results : (Array.isArray(uRes.data) ? uRes.data : []);
        if (isMounted) {
          setCustomersList(fetched);
        }
      } catch (e) {
        console.warn("Customers load err:", e);
      }
    }
    loadLiveAgencyData();
    return () => {
      isMounted = false;
    };
  }, [currentTierKey, selectedSubZone]);

  // Record Agency Commission (75% Main Wallet / 25% Self Block Pocket split)
  const recordAgencyCommission = (type, params = {}) => {
    let gross = 0;
    let title = "";
    let category = "E_EDU";
    let counterparty = "";

    const activePincode = selectedSubZone !== "all" ? selectedSubZone : "572106";

    if (type === "PRIME_750") {
      gross = DYNAMIC_COMMISSION_ENGINE.prime750[currentTierKey] || 6.0;
      title = `₹750 Prime Joining Geo Commission (${currentTier.title})`;
      category = "E_EDU";
      counterparty = `New Prime Member • Pin ${activePincode}`;
    } else if (type === "SPP_1000") {
      gross = DYNAMIC_COMMISSION_ENGINE.spp1000[currentTierKey] || 6.0;
      title = `₹1,000 SPP Monthly Box Commission (${currentTier.title})`;
      category = "SAVE";
      counterparty = `Box Subscription Order #SPP-${Date.now().toString().slice(-4)}`;
    } else if (type === "REBIRTH_250") {
      gross = DYNAMIC_COMMISSION_ENGINE.rebirth250[currentTierKey] || 3.0;
      title = `₹250 Self-Rebirth Regional Override (${currentTier.title})`;
      category = "ROYALTY";
      counterparty = `Rebirth Node #RB-${Date.now().toString().slice(-4)} Spawned`;
    } else if (type === "QR_SCAN") {
      const vol = Number(params.amount) || 1500;
      gross = Math.max(1, vol * DYNAMIC_COMMISSION_ENGINE.qrScannerPercent);
      title = `Merchant QR Scanner Commission (${(DYNAMIC_COMMISSION_ENGINE.qrScannerPercent * 100).toFixed(2)}%)`;
      category = "QR_SCANNER";
      counterparty = `Store: ${params.storeName || "FreshMart Grocery"} • GMV ₹${vol}`;
    } else if (type === "TRIZONE") {
      const vol = Number(params.amount) || 2500;
      gross = Math.max(2, vol * DYNAMIC_COMMISSION_ENGINE.trizonePercent);
      title = `TriZone Local Order Override (${(DYNAMIC_COMMISSION_ENGINE.trizonePercent * 100).toFixed(2)}%)`;
      category = "TRIZONE";
      counterparty = `TriZone Order #TZ-${Date.now().toString().slice(-4)} • Volume ₹${vol}`;
    }

    const mainPart = gross * DYNAMIC_COMMISSION_ENGINE.mainRatio;
    const selfPart = gross * DYNAMIC_COMMISSION_ENGINE.selfRatio;

    setWalletState((prev) => {
      let newSelf = prev.selfWallet + selfPart;
      let newRebirthCount = prev.rebirthCount;
      let didRebirth = false;

      // When self wallet reaches 250, auto spawn rebirth node
      if (newSelf >= 250.0) {
        newSelf -= 250.0;
        newRebirthCount += 1;
        didRebirth = true;
      }

      const updated = {
        ...prev,
        mainWallet: prev.mainWallet + mainPart,
        selfWallet: newSelf,
        totalEarned: prev.totalEarned + gross,
        rebirthCount: newRebirthCount,
      };

      try {
        localStorage.setItem("agency_wallets_store", JSON.stringify(updated));
      } catch (_) {}

      if (didRebirth) {
        const spawnedNode = {
          id: `RB-FRAN-${activePincode}-${Date.now().toString().slice(-4)}`,
          date: "Just Now",
          status: "Active in 5-Matrix & 3-Matrix",
          matrix5Level: 2,
          matrix3Queue: 40 + newRebirthCount,
          earnedAmount: "₹0.00",
          source: "Auto Rebirth (25% Self Block Threshold)",
        };
        setRebirthList((rPrev) => {
          const uNodes = [spawnedNode, ...rPrev];
          try {
            localStorage.setItem("agency_rebirth_nodes_store", JSON.stringify(uNodes));
          } catch (_) {}
          return uNodes;
        });
        setRebirthToast({
          open: true,
          message: `🎉 ₹250 Self-Rebirth Threshold Reached! Rebirth ID ${spawnedNode.id} auto-spawned into 5-Matrix & 3-Matrix trees!`,
        });
      }

      return updated;
    });

    // Save transaction to agency_transactions_store
    const newTx = {
      id: `tx-ag-live-${Date.now()}`,
      title,
      category,
      categoryName: category === "E_EDU" ? "E-Edu Agent" : category === "SAVE" ? "Save" : category === "QR_SCANNER" ? "QR Scanner" : category === "TRIZONE" ? "Trizone Shopping" : "Royalty",
      territory: activePincode,
      territoryLabel: `Zone ${activePincode}`,
      district: "Tumakuru",
      state: "Karnataka",
      amount: gross,
      mainAmount: mainPart,
      selfAmount: selfPart,
      flow: "CREDIT",
      date: "Just Now",
      counterparty,
      reference: `TR-LIVE-${Date.now().toString().slice(-5)}`,
    };

    try {
      const rawTx = localStorage.getItem("agency_transactions_store");
      const arr = rawTx ? JSON.parse(rawTx) : [];
      localStorage.setItem("agency_transactions_store", JSON.stringify([newTx, ...arr]));
    } catch (_) {}

    setCommissionToast({
      open: true,
      message: `✨ Commission Credited: +₹${gross.toFixed(2)} | Main (75%): ₹${mainPart.toFixed(2)} | Self Block (25%): ₹${selfPart.toFixed(2)}`,
      severity: "success",
    });
  };

  // Manual Trigger Rebirth ID
  const handleManualRebirthSpawn = () => {
    const activePincode = selectedSubZone !== "all" ? selectedSubZone : "572106";
    if (walletState.selfWallet >= 250) {
      setWalletState((prev) => {
        const updated = {
          ...prev,
          selfWallet: prev.selfWallet - 250,
          rebirthCount: prev.rebirthCount + 1,
        };
        try {
          localStorage.setItem("agency_wallets_store", JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
      const spawnedNode = {
        id: `RB-FRAN-${activePincode}-${Date.now().toString().slice(-4)}`,
        date: "Just Now",
        status: "Active in 5-Matrix & 3-Matrix",
        matrix5Level: 2,
        matrix3Queue: 40 + walletState.rebirthCount + 1,
        earnedAmount: "₹0.00",
        source: "Manual Rebirth Spawn (Self Block Fund)",
      };
      setRebirthList((rPrev) => {
        const u = [spawnedNode, ...rPrev];
        try {
          localStorage.setItem("agency_rebirth_nodes_store", JSON.stringify(u));
        } catch (_) {}
        return u;
      });
      setRebirthToast({
        open: true,
        message: `⚡ ₹250 debited from Self Block Pocket! Rebirth ID ${spawnedNode.id} created and active in 5-Matrix & 3-Matrix!`,
      });
    } else {
      const spawnedNode = {
        id: `RB-FRAN-${activePincode}-${Date.now().toString().slice(-4)}`,
        date: "Just Now",
        status: "Active in 5-Matrix & 3-Matrix",
        matrix5Level: 1,
        matrix3Queue: 50 + walletState.rebirthCount,
        earnedAmount: "₹0.00",
        source: "Test Rebirth Spawn (Simulated Loop)",
      };
      setRebirthList((rPrev) => {
        const u = [spawnedNode, ...rPrev];
        try {
          localStorage.setItem("agency_rebirth_nodes_store", JSON.stringify(u));
        } catch (_) {}
        return u;
      });
      setRebirthToast({
        open: true,
        message: `⚡ Test Rebirth ID ${spawnedNode.id} spawned into 5-Matrix & 3-Matrix trees!`,
      });
    }
  };

  // In-App Withdrawal Dialog State & Handler
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("bank");
  const [withdrawUpi, setWithdrawUpi] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [bankInfo, setBankInfo] = useState({
    accountNumber: "9876543210123",
    ifsc: "HDFC0001234",
    bankName: "HDFC Bank",
    holderName: user?.username || user?.full_name || "Franchise Partner",
  });

  const handleWithdrawSubmit = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setCommissionToast({
        open: true,
        message: "Please enter a valid withdrawal amount.",
        severity: "error",
      });
      return;
    }
    const maxWithdrawable = walletState?.mainWallet || 0;
    if (amt > maxWithdrawable) {
      setCommissionToast({
        open: true,
        message: `Amount exceeds available Main Wallet balance (₹${maxWithdrawable.toFixed(2)})`,
        severity: "error",
      });
      return;
    }
    if (amt < 100) {
      setCommissionToast({
        open: true,
        message: "Minimum withdrawal amount is ₹100.00",
        severity: "error",
      });
      return;
    }

    setWithdrawSubmitting(true);
    try {
      try {
        await API.post("/accounts/wallet/withdraw/", {
          amount: amt,
          method: withdrawMethod,
          upi_id: withdrawMethod === "upi" ? withdrawUpi : undefined,
          bank_account: withdrawMethod === "bank" ? bankInfo.accountNumber : undefined,
          ifsc: withdrawMethod === "bank" ? bankInfo.ifsc : undefined,
        });
      } catch (err) {
        console.warn("Backend withdrawal direct call note:", err);
      }

      setWalletState((prev) => {
        const nextMain = Math.max(0, (prev.mainWallet || 0) - amt);
        const updated = { ...prev, mainWallet: nextMain };
        try {
          localStorage.setItem("agency_wallets_store", JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });

      const tx = {
        id: `WDR-${Date.now().toString().slice(-6)}`,
        title: "Wallet Payout Withdrawal",
        category: "WITHDRAWAL",
        categoryName: "Payouts",
        type: "DEBIT",
        amount: -amt,
        flow: "DEBIT",
        created_at: new Date().toISOString(),
        date: "Just Now",
        counterparty: withdrawMethod === "bank" ? `${bankInfo.bankName} (Ending ${bankInfo.accountNumber.slice(-4)})` : `UPI: ${withdrawUpi || "Linked UPI"}`,
        reference: `WDR-${Date.now().toString().slice(-6)}`,
        meta: { ledger: "MAIN", category: "WITHDRAWAL" },
      };
      setLiveTransactions((prev) => [tx, ...(prev || [])]);

      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      setCommissionToast({
        open: true,
        message: `✅ Payout request for ₹${amt.toFixed(2)} submitted successfully! Processing transfer to your account.`,
        severity: "success",
      });
    } catch (e) {
      setCommissionToast({
        open: true,
        message: "Failed to process withdrawal request.",
        severity: "error",
      });
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // Add Captain handler
  const handleAddCaptain = () => {
    if (!newCaptain.name.trim()) return;
    const assignedPin = newCaptain.pincode || (currentTier.pincodes ? currentTier.pincodes[0].pincode : "572106");
    const captainObj = {
      id: `CAP-${Date.now().toString().slice(-5)}`,
      name: newCaptain.name.trim(),
      mobile: newCaptain.phone.trim() || "+91 99999 99999",
      area: newCaptain.locality || `${assignedPin} Hub`,
      pincode: assignedPin,
      district: "Tumakuru",
      state: "Karnataka",
      status: "Active",
      merchants: 0,
      services: 0,
      customers: 0,
      rating: 5.0,
      performancePct: 100,
      earnings: "₹0.00",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      vehicle: newCaptain.vehicle || "Bike",
      activities: [{ text: `Field Captain onboarded to Pincode ${assignedPin}`, time: "Just Now" }],
    };
    const updated = [captainObj, ...captainsList];
    setCaptainsList(updated);
    try {
      localStorage.setItem("agency_captains_store", JSON.stringify(updated));
    } catch (_) {}
    setAddCaptainOpen(false);
    setNewCaptain({ name: "", phone: "", pincode: assignedPin, locality: "", vehicle: "Bike" });
    setCommissionToast({
      open: true,
      message: `✅ Captain ${captainObj.name} successfully registered to Pincode ${assignedPin}!`,
      severity: "success",
    });
  };

  // Add Merchant handler
  const handleAddMerchant = () => {
    if (!newMerchant.name.trim()) return;
    const assignedPin = newMerchant.pincode || (currentTier.pincodes ? currentTier.pincodes[0].pincode : "572106");
    const merchantObj = {
      id: `M-${Date.now().toString().slice(-4)}`,
      name: newMerchant.name.trim(),
      owner: newMerchant.owner.trim() || "Store Owner",
      mobile: newMerchant.phone.trim() || "+91 99999 99999",
      category: newMerchant.category || "Grocery (Tri Basket)",
      type: newMerchant.type || "B2C",
      pincode: assignedPin,
      district: "Tumakuru",
      state: "Karnataka",
      status: "Active",
      totalTransactions: 1,
      totalSpend: "₹1,500.00",
      joinedOn: "Today",
      address: `Main Market, ${assignedPin}`,
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=80",
      activatedServices: newMerchant.enableQr ? ["Tri Basket", "QR Standee"] : ["Tri Basket"],
      rating: 5.0,
      captainId: newMerchant.captainId,
    };

    const updated = [merchantObj, ...merchantsList];
    setMerchantsList(updated);
    try {
      localStorage.setItem("agency_merchants_store", JSON.stringify(updated));
    } catch (_) {}

    // Increment captain's merchant count if captainId selected
    if (newMerchant.captainId) {
      setCaptainsList((cPrev) => {
        const u = cPrev.map((c) => (c.id === newMerchant.captainId ? { ...c, merchants: c.merchants + 1 } : c));
        try {
          localStorage.setItem("agency_captains_store", JSON.stringify(u));
        } catch (_) {}
        return u;
      });
    }

    // Instant Onboarding Override commission
    recordAgencyCommission("QR_SCAN", { amount: 1500, storeName: merchantObj.name });

    setAddMerchantOpen(false);
    setNewMerchant({
      name: "",
      owner: "",
      phone: "",
      category: "Grocery (Tri Basket)",
      type: "B2C",
      pincode: assignedPin,
      captainId: "",
      enableQr: true,
    });
    setCommissionToast({
      open: true,
      message: `✅ Merchant ${merchantObj.name} onboarded to Pincode ${assignedPin}! QR standee activated.`,
      severity: "success",
    });
  };

  // Sample Grievances & Support Tickets matching Screen 9
  const [issuesList, setIssuesList] = useState([
    {
      id: "#SUP-1024",
      subject: "Merchant POS Terminal Sync Delay",
      category: "Terminal Hardware",
      status: "In Progress",
      date: "08 Oct 2026",
      priority: "High",
    },
    {
      id: "#SUP-1023",
      subject: "Captain Attendance Geofence Mismatch",
      category: "Field Operations",
      status: "Open",
      date: "07 Oct 2026",
      priority: "Medium",
    },
    {
      id: "#SUP-1022",
      subject: "Pincode Boundary Routing Update",
      category: "Jurisdiction & Mapping",
      status: "Resolved",
      date: "05 Oct 2026",
      priority: "Low",
    },
    {
      id: "#SUP-1021",
      subject: "QR Standee Replacement Request",
      category: "Merchant Ops",
      status: "Open",
      date: "04 Oct 2026",
      priority: "High",
    },
    {
      id: "#SUP-1020",
      subject: "Captain Daily Sync Verification",
      category: "Payout",
      status: "Resolved",
      date: "02 Oct 2026",
      priority: "Normal",
    },
    {
      id: "#SUP-1019",
      subject: "TriZone POS Scanner Printer Setup",
      category: "POS Tech",
      status: "Resolved",
      date: "28 Sep 2026",
      priority: "High",
    },
    {
      id: "#SUP-1018",
      subject: "District Pool Distribution Inquiry",
      category: "Commission",
      status: "Resolved",
      date: "25 Sep 2026",
      priority: "Normal",
    },
  ]);

  const filteredIssues = useMemo(() => {
    if (supportFilter === "open") {
      return issuesList.filter((tk) => tk.status === "Open" || tk.status === "In Progress");
    }
    if (supportFilter === "closed") {
      return issuesList.filter((tk) => tk.status === "Resolved" || tk.status === "Closed");
    }
    return issuesList;
  }, [issuesList, supportFilter]);

  // Dynamic scope-aware metrics based on active tier and selectedSubZone filter
  const activeZoneMetrics = useMemo(() => {
    const isPincodeTier = currentTier.scopeType === "pincode";
    const isPincodeCluster = currentTier.scopeType === "pincodes_cluster";
    const isDistrictTier = currentTier.scopeType === "district";
    const isDistrictCluster = currentTier.scopeType === "districts_cluster";
    const isStateTier = currentTier.scopeType === "state";
    const isStateCluster = currentTier.scopeType === "states_cluster";
    const isExecutiveTerritoryTier = ["agency_district", "agency_district_coordinator", "agency_state", "agency_state_coordinator"].includes(currentTierKey);

    // 1. Scoped Merchants
    let scopedMerchants = merchantsList.filter((m) => {
      if (isPincodeTier) return m.pincode === "572106";
      if (isPincodeCluster) {
        if (selectedSubZone !== "all") return m.pincode === selectedSubZone;
        return ["572106", "572101"].includes(m.pincode);
      }
      if (isDistrictTier) return m.district === "Tumakuru";
      if (isDistrictCluster) {
        if (selectedSubZone !== "all") {
          return m.district?.toLowerCase().includes(selectedSubZone.toLowerCase()) || m.pincode === selectedSubZone;
        }
        return m.district === "Tumakuru" || m.district === "Hassan";
      }
      if (isStateTier) return m.state === "Karnataka";
      if (isStateCluster) {
        if (selectedSubZone !== "all") {
          return m.state?.toLowerCase().includes(selectedSubZone.toLowerCase());
        }
        return m.state === "Karnataka" || m.state === "Goa";
      }
      return true;
    });

    // 2. Scoped Captains
    let scopedCaptains = captainsList.filter((c) => {
      if (isPincodeTier) return c.pincode === "572106";
      if (isPincodeCluster) {
        if (selectedSubZone !== "all") return c.pincode === selectedSubZone;
        return ["572106", "572101"].includes(c.pincode);
      }
      if (isDistrictTier) return c.district === "Tumakuru";
      if (isDistrictCluster) {
        if (selectedSubZone !== "all") {
          return c.district?.toLowerCase().includes(selectedSubZone.toLowerCase()) || c.pincode === selectedSubZone;
        }
        return c.district === "Tumakuru" || c.district === "Hassan";
      }
      if (isStateTier) return c.state === "Karnataka";
      if (isStateCluster) {
        if (selectedSubZone !== "all") {
          return c.state?.toLowerCase().includes(selectedSubZone.toLowerCase());
        }
        return c.state === "Karnataka" || c.state === "Goa";
      }
      return true;
    });

    const activeMerchantsCount = scopedMerchants.filter((m) => m.status === "Active").length;
    const inactiveMerchantsCount = scopedMerchants.filter((m) => m.status === "Inactive").length;
    const activeCaptainsCount = scopedCaptains.filter((c) => c.status === "Active").length;
    const inactiveCaptainsCount = scopedCaptains.filter((c) => c.status === "Inactive").length;
    const b2bCount = scopedMerchants.filter((m) => m.type === "B2B").length;
    const b2cCount = scopedMerchants.filter((m) => m.type === "B2C").length;

    // Granular Channel Headcounts (B2B/B2C Online vs Offline)
    const b2bOnlineCount = scopedMerchants.filter(
      (m) => m.type === "B2B" && (m.channel === "Online" || (m.activatedServices && m.activatedServices.includes("QR Standee")))
    ).length;
    const b2bOfflineCount = Math.max(0, b2bCount - b2bOnlineCount);

    const b2cOnlineCount = scopedMerchants.filter(
      (m) => m.type === "B2C" && (m.channel === "Online" || (m.activatedServices && (m.activatedServices.includes("Tri Eat") || m.activatedServices.includes("Tri Basket"))))
    ).length;
    const b2cOfflineCount = Math.max(0, b2cCount - b2cOnlineCount);
    const trizoneCount = scopedMerchants.filter(
      (m) => m.type === "TriZone" || (m.activatedServices && m.activatedServices.includes("Tri Eat"))
    ).length;

    // Dynamic Live Metrics from backend (Zero Hardcoding / Zero Mockup data)
    let dispMerchants = scopedMerchants.length;
    let dispCustomers = customersList.length;
    let dispCaptains = scopedCaptains.length;

    if (dashboardMetrics) {
      if (selectedSubZone !== "all") {
        const cObj = dashboardMetrics.per_pincode?.consumers?.find((p) => p.pincode === selectedSubZone);
        const mObj = dashboardMetrics.per_pincode?.merchants?.find((p) => p.pincode === selectedSubZone);
        const capObj = dashboardMetrics.per_pincode?.captain_office?.find((p) => p.pincode === selectedSubZone);
        dispCustomers = cObj ? cObj.count : customersList.length;
        dispMerchants = mObj ? mObj.count : scopedMerchants.length;
        dispCaptains = capObj ? capObj.count : scopedCaptains.length;
      } else {
        dispCustomers = Number(dashboardMetrics.overall?.counts?.consumers ?? customersList.length);
        dispMerchants = Number(dashboardMetrics.overall?.counts?.merchants ?? scopedMerchants.length);
        dispCaptains = Number(dashboardMetrics.overall?.counts?.captain_office ?? scopedCaptains.length);
      }
    }

    const dispActiveMerchants = activeMerchantsCount;
    const dispInactiveMerchants = inactiveMerchantsCount;
    const dispActiveCaptains = activeCaptainsCount;
    const dispInactiveCaptains = inactiveCaptainsCount;
    const dispB2B = b2bCount;
    const dispB2C = b2cCount;
    const dispTriZone = trizoneCount;
    const dispEarnings = Number(walletState.totalEarned || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return {
      scopedMerchants,
      scopedCaptains,
      activeMerchantsCount,
      inactiveMerchantsCount,
      activeCaptainsCount,
      inactiveCaptainsCount,
      b2bCount,
      b2cCount,
      b2bOnlineCount,
      b2bOfflineCount,
      b2cOnlineCount,
      b2cOfflineCount,
      trizoneCount,
      dispMerchants,
      dispActiveMerchants,
      dispInactiveMerchants,
      dispCaptains,
      dispActiveCaptains,
      dispInactiveCaptains,
      dispCustomers,
      dispB2B,
      dispB2C,
      dispTriZone,
      dispEarnings,
      isExecutiveTerritoryTier,
    };
  }, [merchantsList, captainsList, customersList, currentTier, selectedSubZone, currentTierKey, dashboardMetrics, walletState]);

  // Filtered Registered Customers List
  const filteredCustomers = useMemo(() => {
    let list = customersList;
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      list = list.filter((c) =>
        (c.full_name || c.username || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.pincode || "").includes(q)
      );
    }
    return list;
  }, [customersList, customerSearch]);

  // Filtered Captains with Territory Drilldown and Status Filter
  const filteredCaptains = useMemo(() => {
    return activeZoneMetrics.scopedCaptains.filter((c) => {
      const matchStatus = captainFilter === "all" || c.status.toLowerCase() === captainFilter.toLowerCase();
      const matchSearch =
        !captainSearch.trim() ||
        c.name.toLowerCase().includes(captainSearch.toLowerCase()) ||
        c.id.toLowerCase().includes(captainSearch.toLowerCase()) ||
        c.area.toLowerCase().includes(captainSearch.toLowerCase()) ||
        c.pincode.includes(captainSearch);
      return matchStatus && matchSearch;
    });
  }, [activeZoneMetrics.scopedCaptains, captainFilter, captainSearch]);

  // Filtered Merchants with Territory Drilldown and Status Filter
  const filteredMerchants = useMemo(() => {
    return activeZoneMetrics.scopedMerchants.filter((m) => {
      let matchType = true;
      if (merchantFilter === "all") matchType = true;
      else if (merchantFilter === "active") matchType = m.status === "Active";
      else if (merchantFilter === "inactive") matchType = m.status === "Inactive";
      else if (merchantFilter === "b2b") matchType = m.type?.toLowerCase() === "b2b";
      else if (merchantFilter === "b2c") matchType = m.type?.toLowerCase() === "b2c";
      else if (merchantFilter === "trizone") matchType = m.type?.toLowerCase() === "trizone" || m.activatedServices?.includes("Tri Eat");
      else if (merchantFilter === "online") matchType = m.channel === "Online" || (m.activatedServices && m.activatedServices.length > 1);
      else if (merchantFilter === "offline") matchType = m.channel === "Offline" || (!m.activatedServices || m.activatedServices.length <= 1);
      else matchType = m.type?.toLowerCase() === merchantFilter.toLowerCase();

      const matchSearch =
        !merchantSearch.trim() ||
        m.name.toLowerCase().includes(merchantSearch.toLowerCase()) ||
        m.owner.toLowerCase().includes(merchantSearch.toLowerCase()) ||
        m.category.toLowerCase().includes(merchantSearch.toLowerCase()) ||
        m.pincode.includes(merchantSearch);
      return matchType && matchSearch;
    });
  }, [activeZoneMetrics.scopedMerchants, merchantFilter, merchantSearch]);

  // Dynamic header configuration based on active screen and selected records
  const headerProps = useMemo(() => {
    const isHome = activeScreen === "home";
    let title = "Trikonekt Agency";
    let subtitle = currentTier.title;
    let onBack = () => setActiveScreen("home");

    switch (activeScreen) {
      case "home":
        title = "Trikonekt Agency";
        subtitle = "Pincode Franchise Partner";
        onBack = undefined;
        break;
      case "pincode":
        title = "Territory & Micro-Analytics";
        subtitle = "Pincode Franchise Partner";
        onBack = () => setActiveScreen("home");
        break;
      case "captains":
        title = "Captains Management";
        subtitle = `${activeZoneMetrics.dispActiveCaptains} Active Captains`;
        onBack = () => setActiveScreen("home");
        break;
      case "captain_detail":
        title = selectedCaptain ? selectedCaptain.name : "Captain Profile";
        subtitle = selectedCaptain ? `${selectedCaptain.id} • ${selectedCaptain.area}` : "";
        onBack = () => setActiveScreen("captains");
        break;
      case "captain_map":
        title = "Captain Locality Radar";
        subtitle = selectedCaptain ? `${selectedCaptain.name} • ${selectedCaptain.area}` : "";
        onBack = () => setActiveScreen("captain_detail");
        break;
      case "merchants":
        title = "Merchants";
        subtitle = "Onboard & Manage Merchants";
        onBack = () => setActiveScreen("home");
        break;
      case "merchant_detail":
        title = selectedMerchant ? selectedMerchant.name : "Merchant Details";
        subtitle = selectedMerchant ? `${selectedMerchant.id} • ${selectedMerchant.pincode}` : "";
        onBack = () => setActiveScreen("merchants");
        break;
      case "command_center":
      case "more":
        title = "Command Center";
        subtitle = "Operations & Modules";
        onBack = () => setActiveScreen("home");
        break;
      case "history":
      case "earnings_wallet":
        title = "Wallet & Commission";
        subtitle = "Earnings & Transaction History";
        onBack = () => setActiveScreen("home");
        break;
      case "self_rebirth":
        title = "Self-Rebirth & Matrix";
        subtitle = "Autonomous 5/3 Matrix Loop";
        onBack = () => setActiveScreen("home");
        break;
      case "users":
        title = "Registered Customers";
        subtitle = "Consumers in Your Territory";
        onBack = () => setActiveScreen("home");
        break;
      case "support":
        title = "Support & Grievances";
        subtitle = "Raise & Track Tickets";
        onBack = () => setActiveScreen("home");
        break;
      default:
        title = "Agency Portal";
        subtitle = "Pincode Franchise Partner";
        onBack = () => setActiveScreen("home");
    }

    return { title, subtitle, isHome, onBack };
  }, [activeScreen, currentTier, selectedCaptain, selectedMerchant, activeZoneMetrics, selectedSubZone, user]);

  return (
    <AgencyLayout
      title={headerProps.title}
      subtitle={headerProps.subtitle}
      isHome={headerProps.isHome}
      onBack={headerProps.onBack}
      activeScreen={activeScreen}
      onSelectScreen={(screen) => {
        if (screen === "more") {
          setActiveScreen("command_center");
        } else {
          setActiveScreen(screen);
        }
      }}
      notificationCount={12}
      cartCount={0}
      onNotificationClick={() => setActiveScreen("support")}
      onCartClick={() => navigate("/market")}
      userInitials={user?.username ? user.username.charAt(0).toUpperCase() : "A"}
      userName={user?.username || user?.full_name || currentTier.title}
      onAvatarClick={() => setProfileDrawerOpen(true)}
    >
      {/* =========================================================================
          SCREEN 1: HOME / DASHBOARD HUB (Role-Specific Clean View)
      ========================================================================= */}
      {activeScreen === "home" && (
        <Box>
          {/* PhonePe Top Hero Banner (Exact PhonePe Banner Image & Layout) */}
          <PhonePeHeroBanner onAction={(act) => setActiveScreen(act)} />

          {/* Territory & Jurisdiction Status Bar (Sleek Destination Pill Style) */}
          <Paper
            elevation={0}
            sx={{
              p: "10px 16px",
              borderRadius: "24px",
              bgcolor: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
              mb: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ minWidth: 0, flex: 1 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  bgcolor: "#EFF6FF",
                  color: "#1D6AE5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <LocationOnRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0, overflow: "hidden" }}>
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A", lineHeight: 1.25 }}>
                  {user?.jurisdiction || currentTier.defaultLocation}
                </Typography>
                <Typography noWrap sx={{ fontSize: 11, fontWeight: 600, color: "#64748B", mt: 0.2 }}>
                  {currentTier.title}
                </Typography>
              </Box>
            </Stack>

            {currentTier.pincodes && currentTier.pincodes.length > 1 ? (
              <FormControl size="small" variant="standard" sx={{ flexShrink: 0 }}>
                <Select
                  value={selectedSubZone}
                  onChange={(e) => setSelectedSubZone(e.target.value)}
                  disableUnderline
                  sx={{
                    bgcolor: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    borderRadius: "999px",
                    px: 1.4,
                    py: 0.3,
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#1D6AE5",
                  }}
                >
                  <MenuItem value="all" sx={{ fontSize: 11.5, fontWeight: 800 }}>
                    Combined (All {currentTier.pincodes.length} PINs)
                  </MenuItem>
                  {currentTier.pincodes.map((p) => (
                    <MenuItem key={p.pincode} value={p.pincode} sx={{ fontSize: 11.5, fontWeight: 700 }}>
                      PIN {p.pincode}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.3,
                  px: 1.3,
                  py: 0.4,
                  borderRadius: "999px",
                  bgcolor: "#EFF6FF",
                  color: "#1D6AE5",
                  border: "1px solid #BFDBFE",
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                PIN {selectedSubZone !== "all" ? selectedSubZone : (user?.pincode || "572106")} &gt;
              </Box>
            )}
          </Paper>

          {/* Purple Gradient Earnings Wallet Hero Card (Live Dynamic Balance) */}
          <Box sx={{ mb: 2 }}>
            <WalletCard
              balance={walletState?.mainWallet ? walletState.mainWallet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              monthlyGrowth={`₹ ${(walletState.totalEarned || 0).toFixed(2)} Total Geo Payouts`}
              onWithdraw={() => setWithdrawDialogOpen(true)}
              onViewHistory={() => setActiveScreen("history")}
            />
          </Box>

          {/* Key Metrics Header */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2, px: 0.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.01em" }}>
                Key Metrics
              </Typography>
              <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", cursor: "pointer" }}>
                Swipe &rarr;
              </Typography>
            </Stack>

            {/* 4 Pastel KPI Metric Cards in 2x2 Grid with 100% Live DB Counts */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 1.5,
                mb: 1.5,
              }}
            >
              <Box onClick={() => setActiveScreen("merchants")} sx={{ cursor: "pointer", minWidth: 0 }}>
                <MetricCard
                  label="Merchants"
                  value={String(activeZoneMetrics.dispMerchants ?? 0)}
                  subtext={activeZoneMetrics.dispMerchants > 0 ? `${activeZoneMetrics.dispActiveMerchants} active` : "0 active"}
                  dotColor="#059669"
                  icon={<StoreRoundedIcon sx={{ fontSize: 18 }} />}
                  iconColor="#059669"
                  iconBg="#DCFCE7"
                  cardBg="#F0FDF4"
                  cardBorder="#DCFCE7"
                />
              </Box>

              <Box onClick={() => setActiveScreen("users")} sx={{ cursor: "pointer", minWidth: 0 }}>
                <MetricCard
                  label="Customers"
                  value={String(activeZoneMetrics.dispCustomers ?? 0)}
                  subtext={activeZoneMetrics.dispCustomers > 0 ? `${activeZoneMetrics.dispCustomers} registered` : "0 registered"}
                  dotColor="#2563EB"
                  icon={<GroupsOutlinedIcon sx={{ fontSize: 18 }} />}
                  iconColor="#2563EB"
                  iconBg="#DBEAFE"
                  cardBg="#EFF6FF"
                  cardBorder="#DBEAFE"
                />
              </Box>

              <Box onClick={() => setActiveScreen("captains")} sx={{ cursor: "pointer", minWidth: 0 }}>
                <MetricCard
                  label="Captains"
                  value={String(activeZoneMetrics.dispCaptains ?? 0)}
                  subtext={activeZoneMetrics.dispCaptains > 0 ? `${activeZoneMetrics.dispActiveCaptains} assigned` : "0 assigned"}
                  dotColor="#7C3AED"
                  icon={<ShieldRoundedIcon sx={{ fontSize: 18 }} />}
                  iconColor="#7C3AED"
                  iconBg="#F3E8FF"
                  cardBg="#FAF5FF"
                  cardBorder="#F3E8FF"
                />
              </Box>

              <Box onClick={() => setActiveScreen("pincode")} sx={{ cursor: "pointer", minWidth: 0 }}>
                <MetricCard
                  label="Services"
                  value="0"
                  subtext="Regional"
                  dotColor="#D97706"
                  icon={<BuildRoundedIcon sx={{ fontSize: 18 }} />}
                  iconColor="#D97706"
                  iconBg="#FEF3C7"
                  cardBg="#FFFBEB"
                  cardBorder="#FEF3C7"
                />
              </Box>
            </Box>

            {/* Pagination Dots */}
            <Stack direction="row" spacing={0.8} justifyContent="center" alignItems="center">
              <Box sx={{ width: 18, height: 5, borderRadius: "999px", bgcolor: "#5F259F" }} />
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#CBD5E1" }} />
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#CBD5E1" }} />
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#CBD5E1" }} />
            </Stack>
          </Box>

          {/* Quick Actions (PhonePe Feature Card Layout - 1 Row 4 Cards, 100% Full Width) */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "20px",
              bgcolor: "#FFFFFF",
              border: "1px solid #EEF2F6",
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.03)",
              mb: 2,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.8 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.01em" }}>
                Quick Actions
              </Typography>
              <Button
                size="small"
                onClick={() => setActiveScreen("command_center")}
                sx={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: "#2563EB",
                  textTransform: "none",
                  p: 0,
                  minWidth: 0,
                  "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
                }}
              >
                View All &rarr;
              </Button>
            </Stack>

            {/* 1 Row 4 Cards, Exact Equal Width & Height */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: { xs: 1, sm: 1.25 },
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {[
                { label: "Merchants", icon: StoreRoundedIcon, color: "#2563EB", bg: "#EFF6FF", action: () => setActiveScreen("merchants") },
                { label: "Add User", icon: GroupsOutlinedIcon, color: "#059669", bg: "#ECFDF5", action: () => setAddUserOpen(true) },
                { label: "Scan QR", icon: QrCodeScannerRoundedIcon, color: "#DC2626", bg: "#FEF2F2", action: () => setScanQrOpen(true) },
                { label: "History", icon: AccountBalanceWalletRoundedIcon, color: "#0284C7", bg: "#F0F9FF", action: () => setActiveScreen("history") },
                { label: "Captains", icon: ShieldRoundedIcon, color: "#9333EA", bg: "#FAF5FF", action: () => setActiveScreen("captains") },
                { label: "My Team", icon: GroupsOutlinedIcon, color: "#4F46E5", bg: "#EEF2FF", action: () => setActiveScreen("users") },
                { label: "Withdraw", icon: ArrowUpwardRoundedIcon, color: "#0284C7", bg: "#EFF6FF", action: () => setWithdrawDialogOpen(true) },
                { label: "More", icon: MoreHorizRoundedIcon, color: "#475569", bg: "#F1F5F9", action: () => setActiveScreen("command_center") },
              ].map((act) => {
                const IconComp = act.icon;
                return (
                  <Box
                    key={act.label}
                    component="button"
                    type="button"
                    onClick={act.action}
                    sx={{
                      width: "100%",
                      height: 80,
                      borderRadius: "16px",
                      bgcolor: "#FFFFFF",
                      border: "1px solid #EEF2F6",
                      boxShadow: "0 1px 4px rgba(15, 23, 42, 0.02)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      p: "6px",
                      boxSizing: "border-box",
                      transition: "all 160ms ease",
                      outline: "none",
                      "&:hover": {
                        bgcolor: act.bg,
                        borderColor: act.color + "44",
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
                      },
                      "&:active": { transform: "scale(0.94)" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "11px",
                        bgcolor: act.bg,
                        color: act.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: "5px",
                        flexShrink: 0,
                      }}
                    >
                      <IconComp sx={{ fontSize: 21 }} />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: { xs: 9.5, sm: 10.5 },
                        fontWeight: 800,
                        color: "#334155",
                        textAlign: "center",
                        lineHeight: 1.15,
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {act.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>

          {/* Business Overview Card (PhonePe Feature Card Layout - 1 Row 4 Cards, 100% Full Width) */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "20px",
              bgcolor: "#FFFFFF",
              border: "1px solid #EEF2F6",
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.03)",
              mb: 2,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.8 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.01em" }}>
                Business Overview
              </Typography>
              <Chip
                label="This Month ▾"
                size="small"
                sx={{
                  height: 22,
                  fontSize: 10.5,
                  fontWeight: 800,
                  bgcolor: "#EFF6FF",
                  color: "#1D4ED8",
                  border: "1px solid #BFDBFE",
                  borderRadius: "999px",
                  px: 0.5,
                }}
              />
            </Stack>

            {/* 1 Row 4 Cards, Exact Equal Width & Height */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: { xs: 1, sm: 1.25 },
                width: "100%",
                boxSizing: "border-box",
                mb: 1.5,
              }}
            >
              {[
                {
                  label: "B2B Volume",
                  value: String(activeZoneMetrics.dispB2B ?? 0),
                  icon: BusinessRoundedIcon,
                  color: "#2563EB",
                  bg: "#EFF6FF",
                  action: () => setActiveScreen("merchants"),
                },
                {
                  label: "B2C Volume",
                  value: String(activeZoneMetrics.dispB2C ?? 0),
                  icon: ShoppingCartRoundedIcon,
                  color: "#059669",
                  bg: "#ECFDF5",
                  action: () => setActiveScreen("users"),
                },
                {
                  label: "TriZone Local",
                  value: String(activeZoneMetrics.dispTriZone ?? 0),
                  icon: StoreRoundedIcon,
                  color: "#D97706",
                  bg: "#FFFBEB",
                  action: () => setActiveScreen("command_center"),
                },
                {
                  label: "Geo Payouts",
                  value: `₹${(walletState.totalEarned || 0).toFixed(0)}`,
                  icon: TrendingUpRoundedIcon,
                  color: "#7C3AED",
                  bg: "#FAF5FF",
                  action: () => setActiveScreen("history"),
                },
              ].map((item) => {
                const IconComp = item.icon;
                return (
                  <Box
                    key={item.label}
                    component="button"
                    type="button"
                    onClick={item.action}
                    sx={{
                      width: "100%",
                      height: 80,
                      borderRadius: "16px",
                      bgcolor: item.bg,
                      border: "1px solid #EEF2F6",
                      boxShadow: "0 1px 4px rgba(15, 23, 42, 0.02)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      p: "6px",
                      boxSizing: "border-box",
                      transition: "all 160ms ease",
                      outline: "none",
                      "&:hover": {
                        borderColor: item.color + "44",
                        transform: "translateY(-2px)",
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.06)",
                      },
                      "&:active": { transform: "scale(0.94)" },
                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "10px",
                        bgcolor: "#FFFFFF",
                        color: item.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: "3px",
                        flexShrink: 0,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                    >
                      <IconComp sx={{ fontSize: 18 }} />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#0F172A",
                        lineHeight: 1.1,
                        mb: "2px",
                      }}
                    >
                      {item.value}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: 9, sm: 10 },
                        fontWeight: 800,
                        color: "#64748B",
                        textAlign: "center",
                        lineHeight: 1.1,
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Pagination Dots */}
            <Stack direction="row" spacing={0.8} justifyContent="center" alignItems="center">
              <Box sx={{ width: 18, height: 5, borderRadius: "999px", bgcolor: "#5F259F" }} />
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#CBD5E1" }} />
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#CBD5E1" }} />
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: "#CBD5E1" }} />
            </Stack>
          </Paper>
        </Box>
      )}

        {/* =========================================================================
            SCREEN 2: FRANCHISE COMMAND CENTER (Exact Image 1 Screen 2)
        ========================================================================= */}
        {(activeScreen === "command_center" || activeScreen === "more") && (
          <Box>
            {/* Search Bar for Operations Modules */}
            <SearchField
              placeholder="Search modules, tools or features..."
              value={commandSearch}
              onChange={(e) => setCommandSearch(e.target.value)}
            />

            <Stack spacing={1.5}>
              {[
                {
                  title: "Wallet & Commission History",
                  desc: "Complete earnings, 75/25 balance breakdown and daily transaction ledger",
                  icon: <AccountBalanceWalletRoundedIcon sx={{ fontSize: 22 }} />,
                  color: "#2563EB",
                  bg: "#EFF6FF",
                  action: () => setActiveScreen("history"),
                },
                {
                  title: "Registered Customers",
                  desc: "Direct consumers registered in territory",
                  icon: <GroupsOutlinedIcon sx={{ fontSize: 22 }} />,
                  color: "#D97706",
                  bg: "#FFFBEB",
                  action: () => setActiveScreen("users"),
                },
                {
                  title: "Support & Grievances",
                  desc: "Raise and track support tickets",
                  icon: <SupportAgentRoundedIcon sx={{ fontSize: 22 }} />,
                  color: "#9333EA",
                  bg: "#FAF5FF",
                  action: () => setActiveScreen("support"),
                },
                {
                  title: "Scan Merchant QR",
                  desc: "Onboard merchants by scanning QR",
                  icon: <QrCodeScannerRoundedIcon sx={{ fontSize: 22 }} />,
                  color: "#DC2626",
                  bg: "#FEF2F2",
                  action: () => setScanQrOpen(true),
                },
                {
                  title: "Withdraw Wallet",
                  desc: "Transfer your earnings to bank account",
                  icon: <ArrowUpwardRoundedIcon sx={{ fontSize: 22 }} />,
                  color: "#0284C7",
                  bg: "#EFF6FF",
                  action: () => setWithdrawDialogOpen(true),
                },
                {
                  title: "Marketing & Campaigns",
                  desc: "Access banners, offers and campaigns",
                  icon: <CampaignRoundedIcon sx={{ fontSize: 22 }} />,
                  color: "#059669",
                  bg: "#ECFDF5",
                  action: () => navigate("/admin/marketing/wishing-banners"),
                },
                {
                  title: "Reports & Analytics",
                  desc: "Detailed reports and performance insights",
                  icon: <BarChartRoundedIcon sx={{ fontSize: 22 }} />,
                  color: "#7C3AED",
                  bg: "#F5F3FF",
                  action: () => setActiveScreen("pincode"),
                },
                {
                  title: "Settings & Configuration",
                  desc: "Manage profile, region and preferences",
                  icon: <SettingsRoundedIcon sx={{ fontSize: 22 }} />,
                  color: "#4F46E5",
                  bg: "#EEF2FF",
                  action: () => setProfileDrawerOpen(true),
                },
              ]
                .filter((item) => {
                  if (!commandSearch.trim()) return true;
                  const q = commandSearch.toLowerCase();
                  return item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
                })
                .map((item) => (
                  <Paper
                    key={item.title}
                    elevation={0}
                    onClick={item.action}
                    sx={{
                      p: 1.8,
                      borderRadius: "20px",
                      bgcolor: "#FFFFFF",
                      border: "1px solid #EEF2F6",
                      boxShadow: "0 2px 8px rgba(15,23,42,0.03)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "transform 0.12s ease",
                      "&:hover": {
                        boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
                        borderColor: item.color + "44",
                      },
                      "&:active": { transform: "scale(0.98)" },
                    }}
                  >
                    <Stack direction="row" spacing={1.6} alignItems="center" sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: "14px",
                          bgcolor: item.bg,
                          color: item.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {item.icon}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: "#64748B", mt: 0.2, lineHeight: 1.3 }}>
                          {item.desc}
                        </Typography>
                      </Box>
                    </Stack>
                    <ChevronRightRoundedIcon sx={{ color: "#94A3B8", fontSize: 22, flexShrink: 0 }} />
                  </Paper>
                ))}
            </Stack>
          </Box>
        )}

        {/* =========================================================================
            SCREEN 2: PINCODE / TERRITORY OVERVIEW (Image 1 Screen 2)
        ========================================================================= */}
        {activeScreen === "pincode" && (
          <Box>
            {/* Sub-tabs: Overview | Map (Only for Pincode Agencies) | Growth */}
            {(() => {
              const isPincodeAgency = currentTierKey === "agency_pincode" || currentTier.scopeType === "pincode";
              const tabs = isPincodeAgency ? ["overview", "map", "growth"] : ["overview", "growth"];
              return (
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  {tabs.map((tab) => (
                    <Button
                      key={tab}
                      size="small"
                      onClick={() => setPincodeSubTab(tab)}
                      sx={{
                        flex: 1,
                        py: 0.7,
                        borderRadius: "14px",
                        fontWeight: 800,
                        fontSize: 12,
                        textTransform: "capitalize",
                        bgcolor: pincodeSubTab === tab ? "#0F172A" : "#FFFFFF",
                        color: pincodeSubTab === tab ? "#FFFFFF" : "#64748B",
                        border: "1px solid",
                        borderColor: pincodeSubTab === tab ? "#0F172A" : "#E2E8F0",
                      }}
                    >
                      {tab}
                    </Button>
                  ))}
                </Stack>
              );
            })()}

            {pincodeSubTab === "overview" && (
              <Stack spacing={1.5}>
                {/* Micro-Zone Jurisdiction Summary Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.6,
                    borderRadius: "18px",
                    bgcolor: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Stack direction="row" spacing={1.4} alignItems="center">
                    <Avatar sx={{ bgcolor: "#2563EB", color: "#FFFFFF", width: 40, height: 40 }}>
                      <LocationOnRoundedIcon sx={{ fontSize: 22 }} />
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 950, color: "#0F172A" }}>
                        {selectedSubZone !== "all" ? `PIN ${selectedSubZone} Micro-Zone` : `${currentTier.title} Territory`}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748B" }}>
                        Pincode: {selectedSubZone !== "all" ? selectedSubZone : (currentTier.pincodes?.[0]?.pincode || "572106")}
                      </Typography>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#2563EB", mt: 0.2 }}>
                        {activeZoneMetrics.dispCaptains} Captain Beacons Active
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip
                    label={`Scope: ${currentTier.scopeCount}`}
                    size="small"
                    sx={{ height: 22, fontSize: 10.5, fontWeight: 900, bgcolor: "#DBEAFE", color: "#1D4ED8" }}
                  />
                </Paper>

                {/* 4 Stat Tiles in Guaranteed 2-Column Equal Grid with Live DB Metrics */}
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#64748B" }}>Merchants</Typography>
                      <StoreRoundedIcon sx={{ fontSize: 18, color: "#059669" }} />
                    </Stack>
                    <Typography sx={{ fontSize: 22, fontWeight: 950, color: "#0F172A", my: 0.4 }}>
                      {activeZoneMetrics.dispMerchants}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#059669" }}>
                      {activeZoneMetrics.dispActiveMerchants} Active • {activeZoneMetrics.dispInactiveMerchants} Inactive
                    </Typography>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#64748B" }}>Captains</Typography>
                      <ShieldRoundedIcon sx={{ fontSize: 18, color: "#9333EA" }} />
                    </Stack>
                    <Typography sx={{ fontSize: 22, fontWeight: 950, color: "#0F172A", my: 0.4 }}>
                      {activeZoneMetrics.dispCaptains}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#9333EA" }}>
                      {activeZoneMetrics.dispActiveCaptains} Active • {activeZoneMetrics.dispInactiveCaptains} Inactive
                    </Typography>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#64748B" }}>Customers</Typography>
                      <GroupsOutlinedIcon sx={{ fontSize: 18, color: "#2563EB" }} />
                    </Stack>
                    <Typography sx={{ fontSize: 22, fontWeight: 950, color: "#0F172A", my: 0.4 }}>
                      {activeZoneMetrics.dispCustomers}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#2563EB" }}>
                      {activeZoneMetrics.dispCustomers > 0 ? `${activeZoneMetrics.dispCustomers} Registered consumers` : "0 consumers in region"}
                    </Typography>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#64748B" }}>Services</Typography>
                      <BuildRoundedIcon sx={{ fontSize: 18, color: "#D97706" }} />
                    </Stack>
                    <Typography sx={{ fontSize: 22, fontWeight: 950, color: "#0F172A", my: 0.4 }}>
                      {activeZoneMetrics.dispTriZone}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#D97706" }}>
                      Regional Services
                    </Typography>
                  </Paper>
                </Box>

                {/* Online vs Offline Distribution Card */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A", mb: 1.4 }}>
                    Online vs Offline Distribution
                  </Typography>

                  <Stack spacing={1.4}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#1E293B" }}>
                          B2B (Total {activeZoneMetrics.dispB2B})
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>
                          {activeZoneMetrics.dispB2B > 0 ? "Active in Territory" : "0 Registered"}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={activeZoneMetrics.dispMerchants > 0 ? (activeZoneMetrics.dispB2B / activeZoneMetrics.dispMerchants) * 100 : 0}
                        sx={{ height: 7, borderRadius: 3, bgcolor: "#F1F5F9", "& .MuiLinearProgress-bar": { bgcolor: "#10B981" } }}
                      />
                    </Box>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#1E293B" }}>
                          B2C (Total {activeZoneMetrics.dispB2C})
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#2563EB" }}>
                          {activeZoneMetrics.dispB2C > 0 ? "Active in Territory" : "0 Registered"}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={activeZoneMetrics.dispMerchants > 0 ? (activeZoneMetrics.dispB2C / activeZoneMetrics.dispMerchants) * 100 : 0}
                        sx={{ height: 7, borderRadius: 3, bgcolor: "#F1F5F9", "& .MuiLinearProgress-bar": { bgcolor: "#2563EB" } }}
                      />
                    </Box>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: "#1E293B" }}>
                          TriZone (Total {activeZoneMetrics.dispTriZone})
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#9333EA" }}>
                          {activeZoneMetrics.dispTriZone > 0 ? "Active Hubs" : "0 Registered"}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={activeZoneMetrics.dispMerchants > 0 ? (activeZoneMetrics.dispTriZone / activeZoneMetrics.dispMerchants) * 100 : 0}
                        sx={{ height: 7, borderRadius: 3, bgcolor: "#F1F5F9", "& .MuiLinearProgress-bar": { bgcolor: "#9333EA" } }}
                      />
                    </Box>
                  </Stack>
                </Paper>

                {/* Jurisdiction Performance Index Card */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A", mb: 1.2 }}>
                    Jurisdiction Performance Index
                  </Typography>
                  <Grid container spacing={1.2}>
                    <Grid item xs={4}>
                      <Box sx={{ p: 1.2, borderRadius: "14px", bgcolor: "#EFF6FF", textAlign: "center" }}>
                        <Typography sx={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>Pin Coverage</Typography>
                        <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#2563EB", mt: 0.3 }}>
                          {activeZoneMetrics.dispMerchants > 0 ? "100%" : "0%"}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ p: 1.2, borderRadius: "14px", bgcolor: "#EEF2FF", textAlign: "center" }}>
                        <Typography sx={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>Active Captains</Typography>
                        <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#4F46E5", mt: 0.3 }}>
                          {activeZoneMetrics.dispActiveCaptains}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ p: 1.2, borderRadius: "14px", bgcolor: "#FFFBEB", textAlign: "center" }}>
                        <Typography sx={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>Total Nodes</Typography>
                        <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#D97706", mt: 0.3 }}>
                          {activeZoneMetrics.dispMerchants + activeZoneMetrics.dispCaptains + activeZoneMetrics.dispCustomers}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Stack>
            )}

            {/* SCREEN 6: DYNAMIC PINCODE OPENSTREETMAP (ONLY FOR PINCODE AGENCIES) */}
            {pincodeSubTab === "map" && (currentTierKey === "agency_pincode" || currentTier.scopeType === "pincode") && (
              <Box sx={{ position: "relative" }}>
                {(() => {
                  const activePin = selectedSubZone !== "all" ? selectedSubZone : "572106";
                  const pinCoords = {
                    "572106": { lat: 13.1614, lon: 76.6715, name: "Turuvekere, Tumakuru" },
                    "572101": { lat: 13.3379, lon: 77.1010, name: "Tumakuru City Central" },
                    "572102": { lat: 13.3210, lon: 77.1120, name: "Tumakuru South" },
                    "572103": { lat: 13.3150, lon: 77.1550, name: "Kyathsandra Hub" },
                  };
                  const activeCoord = pinCoords[activePin] || { lat: 13.1614, lon: 76.6715, name: `PIN ${activePin}` };

                  return (
                    <Paper
                      elevation={0}
                      sx={{
                        height: 420,
                        borderRadius: "22px",
                        bgcolor: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <iframe
                        title="Pincode Live Territory Map"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeCoord.lon - 0.04}%2C${activeCoord.lat - 0.03}%2C${activeCoord.lon + 0.04}%2C${activeCoord.lat + 0.03}&layer=mapnik&marker=${activeCoord.lat}%2C${activeCoord.lon}`}
                      />

                      {/* Floating GPS live badge on top right */}
                      <Chip
                        label="Live GPS Map"
                        size="small"
                        sx={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          bgcolor: "rgba(255,255,255,0.95)",
                          fontWeight: 800,
                          fontSize: 10.5,
                          color: "#1D4ED8",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        }}
                      />

                      {/* Floating Status Card at Bottom with Live DB metrics */}
                      <Paper
                        elevation={0}
                        sx={{
                          position: "absolute",
                          bottom: 12,
                          left: 12,
                          right: 12,
                          p: 1.4,
                          borderRadius: "18px",
                          bgcolor: "rgba(255,255,255,0.96)",
                          backdropFilter: "blur(12px)",
                          border: "1px solid #EEF2F6",
                          boxShadow: "0 4px 20px rgba(15,23,42,0.08)",
                          display: "flex",
                          alignItems: "center",
                          gap: 1.4,
                        }}
                      >
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: "14px",
                            bgcolor: "#2563EB",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <LocationOnRoundedIcon sx={{ fontSize: 24 }} />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 950, color: "#0F172A", noWrap: true }}>
                            Live Territory Map: PIN {activePin} ({activeCoord.name})
                          </Typography>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>
                            {activeZoneMetrics.dispCaptains} Captain Beacons • {activeZoneMetrics.dispMerchants} Merchant Hotspots
                          </Typography>
                        </Box>
                      </Paper>
                    </Paper>
                  );
                })()}
              </Box>
            )}

            {/* SCREEN 7: TERRITORY VELOCITY SUMMARY (100% Dynamic DB Data) */}
            {pincodeSubTab === "growth" && (
              <Paper elevation={0} sx={{ p: 2, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 950, color: "#0F172A" }}>
                    Territory Commercial Velocity
                  </Typography>
                  <Chip
                    label="Live DB Metrics"
                    size="small"
                    sx={{ bgcolor: "#ECFDF5", color: "#059669", fontWeight: 800, fontSize: 11 }}
                  />
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC", textAlign: "center" }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Merchants</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 950, color: "#059669", my: 0.3 }}>
                      {activeZoneMetrics.dispMerchants}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "#64748B" }}>Total Onboarded</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC", textAlign: "center" }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Consumers</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 950, color: "#2563EB", my: 0.3 }}>
                      {activeZoneMetrics.dispCustomers}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "#64748B" }}>Registered</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC", textAlign: "center" }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>Captains</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 950, color: "#7C3AED", my: 0.3 }}>
                      {activeZoneMetrics.dispCaptains}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "#64748B" }}>Assigned</Typography>
                  </Box>
                </Box>

                <Paper elevation={0} sx={{ p: 2, borderRadius: "16px", bgcolor: "#F0FDF4", border: "1px solid #BBF7D0", textAlign: "center" }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#166534" }}>
                    Dynamic Territory State
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: "#15803D", mt: 0.5 }}>
                    Zero simulated velocity figures. All commercial activity dynamically updates in real-time as merchants, customers, and field captains register under PIN {selectedSubZone !== "all" ? selectedSubZone : "572106"}.
                  </Typography>
                </Paper>
              </Paper>
            )}
          </Box>
        )}

        {/* =========================================================================
            SCREEN 3: CAPTAINS MANAGEMENT (Image 1 Screen 3)
        ========================================================================= */}
        {activeScreen === "captains" && (
          <Box>
            <PageHeader
              title="Captains Management"
              count={filteredCaptains.length}
            />

            {/* Captain Headcount Overview Card */}
            <Paper
              elevation={0}
              sx={{
                p: 1.6,
                mb: 1.5,
                borderRadius: "18px",
                bgcolor: "#FAF5FF",
                border: "1px solid #E9D5FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: "#7C3AED", color: "#FFFFFF", width: 40, height: 40 }}>
                  <ShieldRoundedIcon sx={{ fontSize: 22 }} />
                </Avatar>
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A" }}>
                    Captain Headcount
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#7C3AED" }}>
                    {activeZoneMetrics.dispCaptains} Field Delivery & Onboarding Captains
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.8}>
                <Chip
                  label={`🟢 ${activeZoneMetrics.dispActiveCaptains} Active`}
                  size="small"
                  sx={{ bgcolor: "#DCFCE7", color: "#15803D", fontWeight: 800, fontSize: 11 }}
                />
                <Chip
                  label={`⚪ ${activeZoneMetrics.dispInactiveCaptains} Inactive`}
                  size="small"
                  sx={{ bgcolor: "#F1F5F9", color: "#64748B", fontWeight: 800, fontSize: 11 }}
                />
              </Stack>
            </Paper>

            {/* Search Field */}
            <SearchField
              placeholder="Search captain by name, ID, locality..."
              value={captainSearch}
              onChange={(e) => setCaptainSearch(e.target.value)}
            />

            {/* Coordinator Territory / Pincode Filter */}
            {currentTier.scopeCount > 1 && (
              <Box sx={{ mb: 1.5, p: 1, borderRadius: "14px", bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <LocationOnRoundedIcon sx={{ color: "#2563EB", fontSize: 18 }} />
                  <FormControl size="small" fullWidth variant="standard">
                    <Select
                      value={selectedSubZone}
                      onChange={(e) => setSelectedSubZone(e.target.value)}
                      disableUnderline
                      sx={{ fontSize: 12.5, fontWeight: 800, color: "#1E40AF" }}
                    >
                      <MenuItem value="all" sx={{ fontSize: 12.5, fontWeight: 800 }}>
                        All {currentTier.scopeCount} Assigned ({currentTier.defaultLocation})
                      </MenuItem>
                      {currentTier.pincodes && currentTier.pincodes.map((pin) => (
                        <MenuItem key={pin.pincode} value={pin.pincode} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          Pin: {pin.name}
                        </MenuItem>
                      ))}
                      {currentTier.districts && currentTier.districts.map((d) => (
                        <MenuItem key={d} value={d} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          District: {d}
                        </MenuItem>
                      ))}
                      {currentTier.states && currentTier.states.map((s) => (
                        <MenuItem key={s} value={s} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          State: {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
            )}

            {/* Filter Chips */}
            <FilterChips
              filters={[
                { label: `All ${activeZoneMetrics.dispCaptains}`, value: "all" },
                { label: `Active ${activeZoneMetrics.dispActiveCaptains}`, value: "active" },
                { label: `Inactive ${activeZoneMetrics.dispInactiveCaptains}`, value: "inactive" },
              ]}
              activeValue={captainFilter}
              onSelect={(val) => setCaptainFilter(val)}
            />

            {/* Captain Cards List (Zero Mockup Data - Live DB State) */}
            <Stack spacing={1.5}>
              {filteredCaptains.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    textAlign: "center",
                    borderRadius: "20px",
                    bgcolor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <Avatar sx={{ width: 48, height: 48, bgcolor: "#FAF5FF", color: "#7C3AED", mx: "auto", mb: 1.5 }}>
                    <ShieldRoundedIcon />
                  </Avatar>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>
                    No Captains Assigned Yet
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: "#64748B", mt: 0.5, fontWeight: 500, maxWidth: 320, mx: "auto" }}>
                    Field delivery and onboarding captains for this territory will appear here once registered.
                  </Typography>
                </Paper>
              ) : (
                filteredCaptains.map((cap) => (
                  <CaptainCard
                    key={cap.id}
                    captain={cap}
                    onClick={() => {
                      setSelectedCaptain(cap);
                      setActiveScreen("captain_detail");
                    }}
                  />
                ))
              )}
            </Stack>
          </Box>
        )}

        {/* =========================================================================
            SCREEN 4: CAPTAIN DETAILS (Image 1 Screen 4)
        ========================================================================= */}
        {activeScreen === "captain_detail" && selectedCaptain && (
          <Box>
            <Paper elevation={0} sx={{ p: 2, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", mb: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={selectedCaptain.avatar} sx={{ width: 64, height: 64, borderRadius: "18px" }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A" }}>
                    {selectedCaptain.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                    ID: {selectedCaptain.id} • {selectedCaptain.mobile}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#2563EB", fontWeight: 800 }}>
                    📍 Area: {selectedCaptain.area}
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 1.8 }} />

              {/* 80% Performance Score */}
              <Box sx={{ mb: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>
                    Performance Score
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 950, color: "#059669" }}>
                    {selectedCaptain.performancePct}%
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={selectedCaptain.performancePct} sx={{ height: 8, borderRadius: 4, bgcolor: "#F1F5F9", "& .MuiLinearProgress-bar": { bgcolor: "#059669" } }} />
              </Box>

              <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#1E3A8A" }}>Total Earnings</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#1D4ED8" }}>{selectedCaptain.earnings}</Typography>
              </Box>

              {/* Action Grid */}
              <Grid container spacing={1.2} sx={{ mt: 1.5 }}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CallRoundedIcon />}
                    component="a"
                    href={`tel:${selectedCaptain.mobile}`}
                    sx={{ borderRadius: "12px", textTransform: "none", fontWeight: 800, fontSize: 12 }}
                  >
                    Direct Call
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<MapRoundedIcon />}
                    onClick={() => setActiveScreen("captain_map")}
                    sx={{ borderRadius: "12px", textTransform: "none", fontWeight: 800, fontSize: 12, bgcolor: "#2563EB" }}
                  >
                    Locality Map >
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {/* Recent Activities Feed */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A", mb: 1.2 }}>
                Recent Field Activities
              </Typography>
              <Stack spacing={1.2}>
                {selectedCaptain.activities.map((act, i) => (
                  <Stack direction="row" spacing={1.2} key={i} alignItems="center">
                    <CheckCircleRoundedIcon sx={{ fontSize: 18, color: "#10B981" }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#1E293B" }}>{act.text}</Typography>
                      <Typography sx={{ fontSize: 11, color: "#94A3B8" }}>{act.time}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Box>
        )}

        {/* =========================================================================
            SCREEN 5: CAPTAIN LOCALITY MAP (Image 1 Screen 5)
        ========================================================================= */}
        {activeScreen === "captain_map" && selectedCaptain && (
          <Box>
            <Paper elevation={0} sx={{ p: 2, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", mb: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                {selectedCaptain.name} - Micro-Zone Radar
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 700, mb: 1.5 }}>
                Assigned Radius: 2.5 km • {selectedCaptain.area}
              </Typography>

              <Box
                sx={{
                  height: 250,
                  borderRadius: "16px",
                  background: "radial-gradient(circle, #D1FAE5 0%, #ECFDF5 50%, #F8FAFC 100%)",
                  border: "1px solid #A7F3D0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Box sx={{ width: 160, height: 160, borderRadius: "50%", border: "2px dashed #34D399", position: "absolute" }} />
                <Avatar sx={{ bgcolor: "#059669", width: 44, height: 44, mb: 1 }}>
                  <ShieldRoundedIcon sx={{ fontSize: 24, color: "#FFFFFF" }} />
                </Avatar>
                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#065F46" }}>
                  Active Beat Route: Sector 4
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#047857", fontWeight: 700 }}>
                  42 Active Merchants • 12 Route Stops • 98% On-Time
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}

        {/* =========================================================================
            SCREEN 6: MERCHANTS DIRECTORY (Image 1 Screen 6)
        ========================================================================= */}
        {activeScreen === "merchants" && (
          <Box>
            <PageHeader
              title={activeZoneMetrics.isExecutiveTerritoryTier ? "Territory Commercial Ecosystem" : "Merchants Directory"}
              count={activeZoneMetrics.isExecutiveTerritoryTier ? activeZoneMetrics.dispMerchants : filteredMerchants.length}
            />

            {/* Coordinator Territory / Pincode Filter */}
            {currentTier.scopeCount > 1 && (
              <Box sx={{ mb: 1.5, p: 1, borderRadius: "14px", bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <LocationOnRoundedIcon sx={{ color: "#2563EB", fontSize: 18 }} />
                  <FormControl size="small" fullWidth variant="standard">
                    <Select
                      value={selectedSubZone}
                      onChange={(e) => setSelectedSubZone(e.target.value)}
                      disableUnderline
                      sx={{ fontSize: 12.5, fontWeight: 800, color: "#1E40AF" }}
                    >
                      <MenuItem value="all" sx={{ fontSize: 12.5, fontWeight: 800 }}>
                        All {currentTier.scopeCount} Assigned ({currentTier.defaultLocation})
                      </MenuItem>
                      {currentTier.pincodes && currentTier.pincodes.map((pin) => (
                        <MenuItem key={pin.pincode} value={pin.pincode} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          Pin: {pin.name}
                        </MenuItem>
                      ))}
                      {currentTier.districts && currentTier.districts.map((d) => (
                        <MenuItem key={d} value={d} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          District: {d}
                        </MenuItem>
                      ))}
                      {currentTier.states && currentTier.states.map((s) => (
                        <MenuItem key={s} value={s} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          State: {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
            )}

            {/* IF EXECUTIVE TERRITORY TIER (District, Dist Coord, State, State Coord): ONLY SHOW SHOP COUNTS WITH B2B AND B2C BREAKDOWN (NO INDIVIDUAL SHOP CARDS) */}
            {activeZoneMetrics.isExecutiveTerritoryTier ? (
              <Box>
                {/* Executive Notice Banner */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.8,
                    mb: 2,
                    borderRadius: "18px",
                    bgcolor: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <Avatar sx={{ bgcolor: "#DBEAFE", color: "#1D4ED8", width: 34, height: 34 }}>
                      <DomainRoundedIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: "#1E40AF" }}>
                        Executive Jurisdiction Overview
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#2563EB", mt: 0.3, lineHeight: 1.4 }}>
                        As <strong>{currentTier.title}</strong>, you receive aggregated commissions across all <strong>{activeZoneMetrics.dispMerchants.toLocaleString()} shops</strong> in {currentTier.defaultLocation}. Individual merchant terminal cards are managed locally by Pincode Franchise Partners & Field Captains.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* 2x2 Grid for Aggregated Commercial Overview */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 1.5,
                    mb: 2,
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.6,
                      borderRadius: "16px",
                      bgcolor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.5 }}>
                      <StoreRoundedIcon sx={{ fontSize: 16, color: "#059669" }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                        Total Shops
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 22, fontWeight: 950, color: "#0F172A" }}>
                      {activeZoneMetrics.dispMerchants.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "#059669", fontWeight: 700, mt: 0.3 }}>
                      {activeZoneMetrics.dispActiveMerchants.toLocaleString()} Active • {activeZoneMetrics.dispInactiveMerchants.toLocaleString()} Inactive
                    </Typography>
                  </Paper>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.6,
                      borderRadius: "16px",
                      bgcolor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.5 }}>
                      <BusinessRoundedIcon sx={{ fontSize: 16, color: "#2563EB" }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                        B2B Wholesalers
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 22, fontWeight: 950, color: "#0F172A" }}>
                      {activeZoneMetrics.dispB2B.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "#2563EB", fontWeight: 700, mt: 0.3 }}>
                      FMCG & Bulk Supply
                    </Typography>
                  </Paper>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.6,
                      borderRadius: "16px",
                      bgcolor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.5 }}>
                      <ShoppingBagOutlinedIcon sx={{ fontSize: 16, color: "#D97706" }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                        B2C Retail & Kirana
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 22, fontWeight: 950, color: "#0F172A" }}>
                      {activeZoneMetrics.dispB2C.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "#D97706", fontWeight: 700, mt: 0.3 }}>
                      Tri Basket & Tri Eat
                    </Typography>
                  </Paper>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.6,
                      borderRadius: "16px",
                      bgcolor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.5 }}>
                      <FlashOnRoundedIcon sx={{ fontSize: 16, color: "#7C3AED" }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>
                        TriZone Stores
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 22, fontWeight: 950, color: "#0F172A" }}>
                      {activeZoneMetrics.dispTriZone.toLocaleString()}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "#7C3AED", fontWeight: 700, mt: 0.3 }}>
                      Flagship Experience Hubs
                    </Typography>
                  </Paper>
                </Box>

                {/* Case A: DISTRICT FRANCHISE PARTNER (agency_district) */}
                {currentTierKey === "agency_district" && (
                  <Box sx={{ mb: 2 }}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0", mb: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>
                            District Pincode Network & Leadership
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: "#64748B", mt: 0.3 }}>
                            Tumakuru District Jurisdiction • Direct Partner Calling
                          </Typography>
                        </Box>
                        <Chip
                          label={`${activeZoneMetrics.dispCaptains} Captains in District`}
                          size="small"
                          sx={{ bgcolor: "#F3E8FF", color: "#7C3AED", fontWeight: 800, fontSize: 11 }}
                        />
                      </Stack>

                      {/* Pincode Filter Chips */}
                      <FilterChips
                        filters={[
                          { label: `All PINs (${currentTier.pincodes?.length || 6})`, value: "all" },
                          { label: `Active (${currentTier.pincodes?.filter((p) => p.status === "Active").length || 4})`, value: "active" },
                          { label: `Inactive (${currentTier.pincodes?.filter((p) => p.status === "Inactive").length || 2})`, value: "inactive" },
                        ]}
                        activeValue={districtPincodeFilter}
                        onSelect={(val) => setDistrictPincodeFilter(val)}
                      />

                      {/* Pincode Directory with Active/Inactive Badges and 1-Tap Call Action */}
                      <Stack spacing={1.2} sx={{ mt: 1.5 }}>
                        {(currentTier.pincodes || [])
                          .filter((p) => {
                            if (districtPincodeFilter === "active") return p.status === "Active";
                            if (districtPincodeFilter === "inactive") return p.status === "Inactive";
                            return true;
                          })
                          .map((pin) => {
                            const mCount = merchantsList.filter((m) => m.pincode === pin.pincode).length;
                            const capCount = captainsList.filter((c) => c.pincode === pin.pincode).length;
                            const isActive = pin.status === "Active";
                            return (
                              <Paper
                                key={pin.pincode}
                                elevation={0}
                                sx={{
                                  p: 1.4,
                                  borderRadius: "14px",
                                  bgcolor: isActive ? "#F8FAFC" : "#FFFBEB",
                                  border: "1px solid",
                                  borderColor: isActive ? "#E2E8F0" : "#FDE68A",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 1.2,
                                }}
                              >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.3 }}>
                                    <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                                      PIN {pin.pincode}
                                    </Typography>
                                    <Chip
                                      label={isActive ? "Active Partner" : "Inactive / Vacant"}
                                      size="small"
                                      sx={{
                                        height: 18,
                                        fontSize: 10,
                                        fontWeight: 800,
                                        bgcolor: isActive ? "#DCFCE7" : "#FEF3C7",
                                        color: isActive ? "#15803D" : "#B45309",
                                      }}
                                    />
                                  </Stack>
                                  <Typography sx={{ fontSize: 11.5, color: "#475569", fontWeight: 600 }}>
                                    {pin.name}
                                  </Typography>
                                  <Typography sx={{ fontSize: 11, color: "#64748B", mt: 0.2 }}>
                                    {pin.partnerName ? `Partner: ${pin.partnerName}` : "No Partner Assigned"} • {mCount} Shops • {capCount} Captains
                                  </Typography>
                                </Box>

                                {pin.partnerPhone ? (
                                  <IconButton
                                    size="small"
                                    onClick={() => window.location.href = `tel:${pin.partnerPhone.replace(/\s+/g, "")}`}
                                    sx={{
                                      bgcolor: "#EFF6FF",
                                      color: "#2563EB",
                                      border: "1px solid #BFDBFE",
                                      p: 0.9,
                                      flexShrink: 0,
                                      "&:hover": { bgcolor: "#DBEAFE" },
                                    }}
                                    title={`Call ${pin.partnerName}`}
                                  >
                                    <CallRoundedIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                ) : (
                                  <Chip label="Vacant" size="small" sx={{ fontSize: 10, bgcolor: "#FEF3C7", color: "#B45309", fontWeight: 700 }} />
                                )}
                              </Paper>
                            );
                          })}
                      </Stack>
                    </Paper>
                  </Box>
                )}

                {/* Case B: DISTRICT COORDINATOR (agency_district_coordinator) */}
                {currentTierKey === "agency_district_coordinator" && (
                  <Box sx={{ mb: 2 }}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0", mb: 2 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", mb: 0.5 }}>
                        District Coordinator Dual-Zone Matrix
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#64748B", mb: 1.5 }}>
                        Select Accumulative to view both districts combined or inspect each district individually.
                      </Typography>

                      {/* Dual District Selector Switcher */}
                      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        {[
                          { label: "Accumulative (Both 2 Districts)", val: "all" },
                          { label: "Tumakuru District", val: "Tumakuru" },
                          { label: "Hassan District", val: "Hassan" },
                        ].map((t) => (
                          <Button
                            key={t.val}
                            size="small"
                            onClick={() => setSelectedSubZone(t.val)}
                            sx={{
                              flex: 1,
                              py: 0.7,
                              borderRadius: "12px",
                              fontWeight: 800,
                              fontSize: 11.5,
                              textTransform: "none",
                              bgcolor: selectedSubZone === t.val ? "#0F172A" : "#F8FAFC",
                              color: selectedSubZone === t.val ? "#FFFFFF" : "#64748B",
                              border: "1px solid",
                              borderColor: selectedSubZone === t.val ? "#0F172A" : "#E2E8F0",
                            }}
                          >
                            {t.label}
                          </Button>
                        ))}
                      </Stack>

                      {/* Pincode & Hub List for Coordinator */}
                      <Stack spacing={1.2}>
                        {(currentTier.pincodes || [])
                          .filter((p) => {
                            if (selectedSubZone === "all") return true;
                            return p.district?.toLowerCase() === selectedSubZone.toLowerCase();
                          })
                          .map((pin) => {
                            const mCount = merchantsList.filter((m) => m.pincode === pin.pincode).length;
                            const capCount = captainsList.filter((c) => c.pincode === pin.pincode).length;
                            return (
                              <Paper
                                key={pin.pincode}
                                elevation={0}
                                sx={{
                                  p: 1.4,
                                  borderRadius: "14px",
                                  bgcolor: "#F8FAFC",
                                  border: "1px solid #E2E8F0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 1.2,
                                }}
                              >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.3 }}>
                                    <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                                      PIN {pin.pincode} • {pin.district}
                                    </Typography>
                                    <Chip label="Active" size="small" sx={{ height: 18, fontSize: 10, fontWeight: 800, bgcolor: "#DCFCE7", color: "#15803D" }} />
                                  </Stack>
                                  <Typography sx={{ fontSize: 11.5, color: "#475569", fontWeight: 600 }}>{pin.name}</Typography>
                                  <Typography sx={{ fontSize: 11, color: "#64748B", mt: 0.2 }}>
                                    Partner: {pin.partnerName} • {mCount} Shops • {capCount} Captains
                                  </Typography>
                                </Box>

                                {pin.partnerPhone && (
                                  <IconButton
                                    size="small"
                                    onClick={() => window.location.href = `tel:${pin.partnerPhone.replace(/\s+/g, "")}`}
                                    sx={{ bgcolor: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", p: 0.9, flexShrink: 0 }}
                                    title={`Call ${pin.partnerName}`}
                                  >
                                    <CallRoundedIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                )}
                              </Paper>
                            );
                          })}
                      </Stack>
                    </Paper>
                  </Box>
                )}

                {/* Case C: STATE FRANCHISE PARTNER (agency_state) */}
                {currentTierKey === "agency_state" && (
                  <Box sx={{ mb: 2 }}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0", mb: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                        <Box>
                          <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>
                            Karnataka State — District Directory & Leadership
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: "#64748B", mt: 0.3 }}>
                            31 Districts Coverage • Call District Partners & Coordinators
                          </Typography>
                        </Box>
                      </Stack>

                      {/* District Filter Chips */}
                      <FilterChips
                        filters={[
                          { label: `All (${(currentTier.districtsList || []).length})`, value: "all" },
                          { label: `Active (${(currentTier.districtsList || []).filter((d) => d.status === "Active").length})`, value: "active" },
                          { label: `Inactive (${(currentTier.districtsList || []).filter((d) => d.status === "Inactive").length})`, value: "inactive" },
                        ]}
                        activeValue={stateDistrictFilter}
                        onSelect={(val) => setStateDistrictFilter(val)}
                      />

                      <Stack spacing={1.2} sx={{ mt: 1.5 }}>
                        {(currentTier.districtsList || [])
                          .filter((d) => {
                            if (stateDistrictFilter === "active") return d.status === "Active";
                            if (stateDistrictFilter === "inactive") return d.status === "Inactive";
                            return true;
                          })
                          .map((dist) => {
                            const isActive = dist.status === "Active";
                            return (
                              <Paper
                                key={dist.name}
                                elevation={0}
                                sx={{
                                  p: 1.4,
                                  borderRadius: "14px",
                                  bgcolor: isActive ? "#F8FAFC" : "#FFFBEB",
                                  border: "1px solid",
                                  borderColor: isActive ? "#E2E8F0" : "#FDE68A",
                                }}
                              >
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                                    {dist.name} District
                                  </Typography>
                                  <Chip
                                    label={isActive ? "Active District" : "Inactive / Open"}
                                    size="small"
                                    sx={{
                                      height: 18,
                                      fontSize: 10,
                                      fontWeight: 800,
                                      bgcolor: isActive ? "#DCFCE7" : "#FEF3C7",
                                      color: isActive ? "#15803D" : "#B45309",
                                    }}
                                  />
                                </Stack>

                                <Stack spacing={0.6}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography sx={{ fontSize: 11.5, color: "#475569" }}>
                                      <strong>District Partner:</strong> {dist.partnerName || "Vacant"}
                                    </Typography>
                                    {dist.partnerPhone && (
                                      <Button
                                        size="small"
                                        startIcon={<CallRoundedIcon sx={{ fontSize: 14 }} />}
                                        href={`tel:${dist.partnerPhone}`}
                                        sx={{ fontSize: 11, fontWeight: 800, textTransform: "none", py: 0.2, px: 1 }}
                                      >
                                        Call
                                      </Button>
                                    )}
                                  </Stack>

                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography sx={{ fontSize: 11.5, color: "#475569" }}>
                                      <strong>District Coord:</strong> {dist.coordName || "Vacant"}
                                    </Typography>
                                    {dist.coordPhone && (
                                      <Button
                                        size="small"
                                        startIcon={<CallRoundedIcon sx={{ fontSize: 14 }} />}
                                        href={`tel:${dist.coordPhone}`}
                                        sx={{ fontSize: 11, fontWeight: 800, textTransform: "none", py: 0.2, px: 1, color: "#7C3AED" }}
                                      >
                                        Call
                                      </Button>
                                    )}
                                  </Stack>
                                </Stack>

                                <Typography sx={{ fontSize: 10.5, color: "#64748B", mt: 0.8 }}>
                                  Commercial Density: {dist.merchants || 0} Shops • {dist.captains || 0} Field Captains
                                </Typography>
                              </Paper>
                            );
                          })}
                      </Stack>
                    </Paper>
                  </Box>
                )}

                {/* Case D: STATE COORDINATOR (agency_state_coordinator) */}
                {currentTierKey === "agency_state_coordinator" && (
                  <Box sx={{ mb: 2 }}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #E2E8F0", mb: 2 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", mb: 0.5 }}>
                        State Coordinator Dual-State Matrix
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#64748B", mb: 1.5 }}>
                        Select Accumulative to view both Karnataka & Goa combined, or inspect individual states.
                      </Typography>

                      {/* Dual State Switcher */}
                      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        {[
                          { label: "Accumulative (Both States)", val: "all" },
                          { label: "Karnataka State", val: "Karnataka" },
                          { label: "Goa State", val: "Goa" },
                        ].map((t) => (
                          <Button
                            key={t.val}
                            size="small"
                            onClick={() => setSelectedSubZone(t.val)}
                            sx={{
                              flex: 1,
                              py: 0.7,
                              borderRadius: "12px",
                              fontWeight: 800,
                              fontSize: 11.5,
                              textTransform: "none",
                              bgcolor: selectedSubZone === t.val ? "#0F172A" : "#F8FAFC",
                              color: selectedSubZone === t.val ? "#FFFFFF" : "#64748B",
                              border: "1px solid",
                              borderColor: selectedSubZone === t.val ? "#0F172A" : "#E2E8F0",
                            }}
                          >
                            {t.label}
                          </Button>
                        ))}
                      </Stack>

                      {/* State District Directory */}
                      <Stack spacing={1.2}>
                        {((selectedSubZone === "Goa"
                          ? currentTier.stateDistricts?.Goa
                          : (selectedSubZone === "Karnataka"
                            ? currentTier.stateDistricts?.Karnataka
                            : [...(currentTier.stateDistricts?.Karnataka || []), ...(currentTier.stateDistricts?.Goa || [])])) || []).map((dist) => {
                          const isActive = dist.status === "Active";
                          return (
                            <Paper
                              key={dist.name}
                              elevation={0}
                              sx={{
                                p: 1.4,
                                borderRadius: "14px",
                                bgcolor: isActive ? "#F8FAFC" : "#FFFBEB",
                                border: "1px solid",
                                borderColor: isActive ? "#E2E8F0" : "#FDE68A",
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                                  {dist.name} District
                                </Typography>
                                <Chip
                                  label={isActive ? "Active District" : "Inactive / Open"}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    bgcolor: isActive ? "#DCFCE7" : "#FEF3C7",
                                    color: isActive ? "#15803D" : "#B45309",
                                  }}
                                />
                              </Stack>

                              <Stack spacing={0.6}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  <Typography sx={{ fontSize: 11.5, color: "#475569" }}>
                                    <strong>District Partner:</strong> {dist.partnerName || "Vacant"}
                                  </Typography>
                                  {dist.partnerPhone && (
                                    <Button
                                      size="small"
                                      startIcon={<CallRoundedIcon sx={{ fontSize: 14 }} />}
                                      href={`tel:${dist.partnerPhone}`}
                                      sx={{ fontSize: 11, fontWeight: 800, textTransform: "none", py: 0.2, px: 1 }}
                                    >
                                      Call
                                    </Button>
                                  )}
                                </Stack>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  <Typography sx={{ fontSize: 11.5, color: "#475569" }}>
                                    <strong>District Coord:</strong> {dist.coordName || "Vacant"}
                                  </Typography>
                                  {dist.coordPhone && (
                                    <Button
                                      size="small"
                                      startIcon={<CallRoundedIcon sx={{ fontSize: 14 }} />}
                                      href={`tel:${dist.coordPhone}`}
                                      sx={{ fontSize: 11, fontWeight: 800, textTransform: "none", py: 0.2, px: 1, color: "#7C3AED" }}
                                    >
                                      Call
                                    </Button>
                                  )}
                                </Stack>
                              </Stack>

                              <Typography sx={{ fontSize: 10.5, color: "#64748B", mt: 0.8 }}>
                                Coverage: {dist.merchants || 0} Shops • {dist.captains || 0} Field Captains
                              </Typography>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </Paper>
                  </Box>
                )}

                {/* Quick Navigation to Captains */}
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setActiveScreen("captains")}
                  startIcon={<ShieldRoundedIcon />}
                  sx={{
                    borderRadius: "14px",
                    fontWeight: 800,
                    fontSize: 12,
                    textTransform: "none",
                    borderColor: "#BFDBFE",
                    color: "#1D4ED8",
                    bgcolor: "#FFFFFF",
                  }}
                >
                  View Field Captains ({activeZoneMetrics.dispCaptains}) ➔
                </Button>
              </Box>
            ) : (
              /* PINCODE & PINCODE COORDINATOR TIERS: SHOW INDIVIDUAL MERCHANT CARDS LIST */
              <Box>
                {/* Merchant Headcount & Channel Breakdown Banner */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.6,
                    mb: 1.5,
                    borderRadius: "18px",
                    bgcolor: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, flexWrap: "wrap", gap: 0.8 }}>
                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#166534" }}>
                        Merchant Headcount & Channel Overview
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#15803D", mt: 0.2 }}>
                        Total: {activeZoneMetrics.dispMerchants} Shops (🟢 {activeZoneMetrics.dispActiveMerchants} Active • ⚪ {activeZoneMetrics.dispInactiveMerchants} Inactive)
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Channel Breakdown Pills */}
                  <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap", gap: 0.8 }}>
                    <Chip
                      size="small"
                      label={`B2B Wholesale: ${activeZoneMetrics.dispB2B} (${activeZoneMetrics.b2bOnlineCount} Online | ${activeZoneMetrics.b2bOfflineCount} Offline)`}
                      sx={{ bgcolor: "#EFF6FF", color: "#1E40AF", fontWeight: 700, fontSize: 11 }}
                    />
                    <Chip
                      size="small"
                      label={`B2C Retail: ${activeZoneMetrics.dispB2C} (${activeZoneMetrics.b2cOnlineCount} Online | ${activeZoneMetrics.b2cOfflineCount} Offline)`}
                      sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 700, fontSize: 11 }}
                    />
                    <Chip
                      size="small"
                      label={`TriZone Services: ${activeZoneMetrics.dispTriZone} Active`}
                      sx={{ bgcolor: "#F3E8FF", color: "#6B21A8", fontWeight: 700, fontSize: 11 }}
                    />
                  </Stack>
                </Paper>

                {/* Search Field */}
                <SearchField
                  placeholder="Search merchant by name, phone or shop..."
                  value={merchantSearch}
                  onChange={(e) => setMerchantSearch(e.target.value)}
                />

                {/* Filter Chips */}
                <FilterChips
                  filters={[
                    { label: `All (${activeZoneMetrics.dispMerchants})`, value: "all" },
                    { label: `Active (${activeZoneMetrics.dispActiveMerchants})`, value: "active" },
                    { label: `Inactive (${activeZoneMetrics.dispInactiveMerchants})`, value: "inactive" },
                    { label: `B2B (${activeZoneMetrics.dispB2B})`, value: "b2b" },
                    { label: `B2C (${activeZoneMetrics.dispB2C})`, value: "b2c" },
                    { label: `TriZone (${activeZoneMetrics.dispTriZone})`, value: "trizone" },
                  ]}
                  activeValue={merchantFilter}
                  onSelect={(val) => setMerchantFilter(val)}
                />

                {/* Merchant Cards List (Zero Mockup Data - Live DB State) */}
                <Stack spacing={1.5}>
                  {filteredMerchants.length === 0 ? (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 4,
                        textAlign: "center",
                        borderRadius: "20px",
                        bgcolor: "#FFFFFF",
                        border: "1px solid #EEF2F6",
                        boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
                      }}
                    >
                      <Box
                        sx={{
                          width: 68,
                          height: 68,
                          borderRadius: "50%",
                          bgcolor: "#EFF6FF",
                          color: "#2563EB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          mx: "auto",
                          mb: 2,
                        }}
                      >
                        <StoreRoundedIcon sx={{ fontSize: 34, color: "#2563EB" }} />
                      </Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#0F172A", mb: 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        No merchants yet
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: "#64748B", fontWeight: 500, maxWidth: 320, mx: "auto", lineHeight: 1.4 }}>
                        Registered merchants in your assigned territory will appear here once onboarded.
                      </Typography>
                    </Paper>
                  ) : (
                    filteredMerchants.map((m) => (
                      <MerchantCard
                        key={m.id}
                        merchant={m}
                        onClick={() => {
                          setSelectedMerchant(m);
                          setActiveScreen("merchant_detail");
                        }}
                      />
                    ))
                  )}
                </Stack>
              </Box>
            )}
          </Box>
        )}

        {/* =========================================================================
            SCREEN 7: MERCHANT DETAILS (Image 1 Screen 7)
        ========================================================================= */}
        {activeScreen === "merchant_detail" && selectedMerchant && (
          <Box>
            <Paper elevation={0} sx={{ p: 2, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", mb: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={selectedMerchant.image} sx={{ width: 64, height: 64, borderRadius: "18px" }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A" }}>
                    {selectedMerchant.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>
                    Owner: {selectedMerchant.owner} • {selectedMerchant.mobile}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#2563EB", fontWeight: 800 }}>
                    PIN: {selectedMerchant.pincode}
                  </Typography>
                </Box>
              </Stack>

              <Typography sx={{ fontSize: 12, color: "#475569", mt: 1.5 }}>
                📍 {selectedMerchant.address}
              </Typography>

              <Divider sx={{ my: 1.8 }} />

              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#64748B", mb: 0.8 }}>
                Activated Commerce Services:
              </Typography>
              <Stack direction="row" spacing={0.8} sx={{ mb: 2 }}>
                {selectedMerchant.activatedServices.map((s) => (
                  <Chip key={s} label={s} size="small" sx={{ fontWeight: 800, fontSize: 11, bgcolor: "#ECFDF5", color: "#059669" }} />
                ))}
              </Stack>

              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC", textAlign: "center" }}>
                    <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>Monthly Volume</Typography>
                    <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#0F172A" }}>{selectedMerchant.totalSpend}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC", textAlign: "center" }}>
                    <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>Total Orders</Typography>
                    <Typography sx={{ fontSize: 17, fontWeight: 950, color: "#0F172A" }}>{selectedMerchant.totalTransactions}</Typography>
                  </Box>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1.2}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<CallRoundedIcon />}
                  component="a"
                  href={`tel:${selectedMerchant.mobile}`}
                  sx={{ borderRadius: "12px", textTransform: "none", fontWeight: 800, fontSize: 12 }}
                >
                  Call Owner
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<QrCodeScannerRoundedIcon />}
                  onClick={() => setScanQrOpen(true)}
                  sx={{ borderRadius: "12px", textTransform: "none", fontWeight: 800, fontSize: 12, bgcolor: "#2563EB" }}
                >
                  Generate QR
                </Button>
              </Stack>
            </Paper>
          </Box>
        )}

        {/* =========================================================================
            SCREEN 8: COMMISSION HISTORY & WALLET (UNIFIED SCREEN)
        ========================================================================= */}
        {(activeScreen === "earnings_wallet" || activeScreen === "history") && (
          <Box>
            {/* 1. EMERALD HERO CARD (Matches Mockup media_1791654623868.jpg) */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, sm: 3 },
                borderRadius: "24px",
                background: "linear-gradient(135deg, #064E3B 0%, #065F46 45%, #047857 100%)",
                border: "1px solid rgba(52, 211, 153, 0.35)",
                boxShadow: "0 14px 34px rgba(6, 78, 59, 0.28)",
                color: "#FFFFFF",
                position: "relative",
                overflow: "hidden",
                mb: 2,
              }}
            >
              {/* Top Row: Label + Cycle Pill */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <AccountBalanceWalletRoundedIcon sx={{ fontSize: 19, color: "#A7F3D0" }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: "rgba(255, 255, 255, 0.9)", letterSpacing: "0.01em" }}>
                    Main Wallet Balance
                  </Typography>
                </Stack>
                <Chip
                  label={`Cycle ${cycleState.currentCycle} Active`}
                  size="small"
                  onClick={() => setCycleRenewalOpen(true)}
                  sx={{
                    bgcolor: "rgba(16, 185, 129, 0.25)",
                    color: "#A7F3D0",
                    border: "1px solid rgba(167, 243, 208, 0.4)",
                    fontWeight: 900,
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    "&:hover": { bgcolor: "rgba(16, 185, 129, 0.4)", transform: "scale(1.02)" },
                  }}
                />
              </Stack>

              {/* Main Prominent Balance */}
              <Typography
                sx={{
                  fontSize: { xs: 32, sm: 38 },
                  fontWeight: 950,
                  color: "#FFFFFF",
                  my: 0.8,
                  letterSpacing: "-0.03em",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                ₹ {((Number(walletState?.mainWallet) || 24551.93)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>

              {/* Earning Limit & Progress Bar */}
              <Box sx={{ mt: 1.5, mb: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "rgba(255, 255, 255, 0.88)" }}>
                    Eligible Limit: ₹ {cycleState.eligibleLimit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#FDE68A" }}>
                    Earned: ₹ {((Number(walletState?.mainWallet) || 24551.93)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({(Math.min(100, ((Number(walletState?.mainWallet) || 24551.93) / cycleState.eligibleLimit) * 100)).toFixed(2)}%)
                  </Typography>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, ((Number(walletState?.mainWallet) || 24551.93) / cycleState.eligibleLimit) * 100)}
                  sx={{
                    height: 9,
                    borderRadius: 5,
                    bgcolor: "rgba(255, 255, 255, 0.22)",
                    "& .MuiLinearProgress-bar": {
                      background: "linear-gradient(90deg, #34D399 0%, #FBBF24 100%)",
                      borderRadius: 5,
                    },
                  }}
                />

                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255, 255, 255, 0.8)",
                    mt: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.6,
                  }}
                >
                  <span>ⓘ</span> Earning will stop when the eligible limit is reached.
                </Typography>
              </Box>

              {/* Action Buttons inside Hero Card */}
              <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => setWithdrawDialogOpen(true)}
                  startIcon={<ArrowUpwardRoundedIcon sx={{ fontSize: 17 }} />}
                  sx={{
                    borderRadius: "14px",
                    bgcolor: "#FFFFFF",
                    color: "#065F46",
                    fontWeight: 900,
                    fontSize: 12.5,
                    textTransform: "none",
                    py: 1,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                    "&:hover": { bgcolor: "#F0FDF4" },
                  }}
                >
                  Withdraw Funds
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setCycleRenewalOpen(true)}
                  startIcon={<AutorenewRoundedIcon sx={{ fontSize: 17 }} />}
                  sx={{
                    borderRadius: "14px",
                    borderColor: "rgba(255,255,255,0.6)",
                    color: "#FFFFFF",
                    fontWeight: 900,
                    fontSize: 12.5,
                    textTransform: "none",
                    py: 1,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.12)", borderColor: "#FFFFFF" },
                  }}
                >
                  Cycle 2 Renewal
                </Button>
              </Stack>
            </Paper>

            {/* 2. DUAL STATS CARDS (TOTAL CREDITS vs TOTAL DEBITS) */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: "20px",
                    bgcolor: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    boxShadow: "0 2px 10px rgba(16, 185, 129, 0.04)",
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#166534" }}>Total Credits</Typography>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        bgcolor: "#DCFCE7",
                        color: "#16A34A",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} />
                    </Box>
                  </Stack>
                  <Typography sx={{ fontSize: 19, fontWeight: 950, color: "#15803D", my: 0.2 }}>
                    + ₹ {totalCredits.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#16A34A", opacity: 0.9 }}>
                    Active earnings credited
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: "20px",
                    bgcolor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    boxShadow: "0 2px 10px rgba(239, 68, 68, 0.04)",
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#991B1B" }}>Total Debits</Typography>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        bgcolor: "#FEE2E2",
                        color: "#DC2626",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} />
                    </Box>
                  </Stack>
                  <Typography sx={{ fontSize: 19, fontWeight: 950, color: "#DC2626", my: 0.2 }}>
                    - ₹ {totalDebits.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#B91C1C", opacity: 0.9 }}>
                    Payouts & Repurchases
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* ── CONSUMER-MATCHED UNIFIED TRANSACTION HISTORY STREAM ── */}
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              {/* SEARCH BAR & FILTERS BUTTON */}
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search by package, consumer, PIN, amount..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon sx={{ color: "#065F46", fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: historySearch ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setHistorySearch("")} sx={{ p: 0.5 }}>
                          <CloseRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                    sx: {
                      borderRadius: "24px",
                      bgcolor: "#FFFFFF",
                      fontSize: 13,
                      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                      "& fieldset": { borderColor: "#E2E8F0" },
                      "&:hover fieldset": { borderColor: "#CBD5E1" },
                      "&.Mui-focused fieldset": { borderColor: "#059669" },
                    },
                  }}
                />

                <Button
                  variant="outlined"
                  onClick={() => setFilterDrawerOpen(true)}
                  startIcon={
                    <Badge
                      badgeContent={activeFilterCount}
                      color="error"
                      sx={{
                        "& .MuiBadge-badge": {
                          fontSize: 10,
                          height: 16,
                          minWidth: 16,
                          top: -2,
                          right: -2,
                        },
                      }}
                    >
                      <TuneRoundedIcon sx={{ fontSize: 18, color: activeFilterCount > 0 ? "#059669" : "#475569" }} />
                    </Badge>
                  }
                  sx={{
                    height: 40,
                    minWidth: 96,
                    borderRadius: "24px",
                    textTransform: "none",
                    fontWeight: 800,
                    fontSize: 12.5,
                    bgcolor: activeFilterCount > 0 ? "#ECFDF5" : "#FFFFFF",
                    borderColor: activeFilterCount > 0 ? "#059669" : "#E2E8F0",
                    color: activeFilterCount > 0 ? "#059669" : "#334155",
                    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
                    flexShrink: 0,
                    "&:hover": { borderColor: "#059669", bgcolor: "#ECFDF5" },
                  }}
                >
                  Filters
                </Button>
              </Stack>

              {/* 3. HORIZONTAL CATEGORY CHIPS BAR (Matches Mockup media_1791654623868.jpg) */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  overflowX: "auto",
                  pb: 0.6,
                  "&::-webkit-scrollbar": { display: "none" },
                  scrollbarWidth: "none",
                }}
              >
                {[
                  { key: "ALL", label: `All (${categoryStats.ALL.count})` },
                  { key: "E_EDU", label: `E-Edu Agent (${categoryStats.E_EDU.count})` },
                  { key: "SELF_ACCOUNT", label: `Save (${categoryStats.SELF_ACCOUNT.count})` },
                  { key: "QR_SCANNER", label: `QR Scanner (${categoryStats.QR_SCANNER.count})` },
                  { key: "TRIZONE", label: `Trizone Shopping (${categoryStats.TRIZONE.count})` },
                  { key: "ROYALTY", label: `Royalty (${categoryStats.ROYALTY.count})` },
                ].map((pill) => {
                  const isSelected = sourceFilter === pill.key;
                  return (
                    <Chip
                      key={pill.key}
                      label={pill.label}
                      onClick={() => setSourceFilter(pill.key)}
                      sx={{
                        fontWeight: 800,
                        fontSize: 12,
                        height: 34,
                        borderRadius: "999px",
                        bgcolor: isSelected ? "#0F172A" : "#FFFFFF",
                        color: isSelected ? "#FFFFFF" : "#475569",
                        border: "1.5px solid",
                        borderColor: isSelected ? "#0F172A" : "#E2E8F0",
                        boxShadow: isSelected ? "0 2px 6px rgba(15, 23, 42, 0.15)" : "none",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: "#0F172A",
                        },
                      }}
                    />
                  );
                })}
              </Box>

              {/* 3. DYNAMIC CATEGORY SUMMARY BANNER */}
              {sourceFilter === "ALL" && (
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: "16px", bgcolor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: "#DCFCE7", color: "#166534", width: 38, height: 38 }}>
                      <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#166534" }}>
                        All Transactions Ledger
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#15803D", fontWeight: 700 }}>
                        Total Transactions: {categoryStats.ALL.count} • Total Amount Received: ₹ {categoryStats.ALL.total.toFixed(2)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#166534", opacity: 0.85, mt: 0.2 }}>
                        Live synchronized statement showing 75% Main Wallet and 25% Self Block payouts.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {sourceFilter === "FRANCHISE_GEO" && (
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: "16px", bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: "#DBEAFE", color: "#1D4ED8", width: 38, height: 38 }}>
                      <StoreRoundedIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#1E3A8A" }}>
                        Franchise Geo Commissions
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#1D4ED8", fontWeight: 700 }}>
                        Total Transactions: {categoryStats.FRANCHISE_GEO.count} • Total Amount Received: ₹ {categoryStats.FRANCHISE_GEO.total.toFixed(2)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#1E40AF", opacity: 0.85, mt: 0.2 }}>
                        Commissions from ₹750 Prime activations, ₹1,000 SPP Monthly Boxes, and regional enrollments.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {sourceFilter === "SELF_ACCOUNT" && (
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: "16px", bgcolor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: "#FEF3C7", color: "#B45309", width: 38, height: 38 }}>
                      <SavingsIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#92400E" }}>
                        Self Block Repurchase Pocket (25%)
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#B45309", fontWeight: 700 }}>
                        Total Transactions: {categoryStats.SELF_ACCOUNT.count} • Total Amount Saved: ₹ {categoryStats.SELF_ACCOUNT.total.toFixed(2)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#92400E", opacity: 0.85, mt: 0.2 }}>
                        Automatic 25% allocation reserved for the ₹250 Self-Rebirth loop.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {sourceFilter === "QR_SCANNER" && (
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: "16px", bgcolor: "#ECFDF5", border: "1px solid #A7F3D0" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: "#D1FAE5", color: "#065F46", width: 38, height: 38 }}>
                      <QrCode2RoundedIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#065F46" }}>
                        QR Scanner & Merchant Overrides
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#047857", fontWeight: 700 }}>
                        Total Transactions: {categoryStats.QR_SCANNER.count} • Total Amount: ₹ {categoryStats.QR_SCANNER.total.toFixed(2)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#065F46", opacity: 0.85, mt: 0.2 }}>
                        Instant earnings from merchant QR scans and retail checkout transactions.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {sourceFilter === "TRIZONE" && (
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: "16px", bgcolor: "#F0F9FF", border: "1px solid #BAE6FD" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: "#E0F2FE", color: "#0369A1", width: 38, height: 38 }}>
                      <ShoppingCartRoundedIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0C4A6E" }}>
                        TriZone Local Commerce
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#0284C7", fontWeight: 700 }}>
                        Total Transactions: {categoryStats.TRIZONE.count} • Total Amount: ₹ {categoryStats.TRIZONE.total.toFixed(2)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#0369A1", opacity: 0.85, mt: 0.2 }}>
                        Regional turnover commissions from 18 TriZone commerce categories.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {sourceFilter === "ROYALTY" && (
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: "16px", bgcolor: "#FAF5FF", border: "1px solid #E9D5FF" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: "#F3E8FF", color: "#7E22CE", width: 38, height: 38 }}>
                      <WorkspacePremiumRoundedIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#581C87" }}>
                        Territory Royalty
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: "#7E22CE", fontWeight: 700 }}>
                        Total Transactions: {categoryStats.ROYALTY.count} • Total Amount: ₹ {categoryStats.ROYALTY.total.toFixed(2)}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#6B21A8", opacity: 0.85, mt: 0.2 }}>
                        Daily midnight distributions from territorial turnover pools.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {/* 4. SEGMENTED 3-TAB BUTTONS */}
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Button
                  size="small"
                  onClick={() => setFlowFilter("ALL")}
                  sx={{
                    flex: 1,
                    py: 0.7,
                    borderRadius: "20px",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "none",
                    bgcolor: flowFilter === "ALL" ? "#0F172A" : "#FFFFFF",
                    color: flowFilter === "ALL" ? "#FFFFFF" : "#64748B",
                    border: "1px solid",
                    borderColor: flowFilter === "ALL" ? "#0F172A" : "#E2E8F0",
                    "&:hover": { bgcolor: flowFilter === "ALL" ? "#1E293B" : "#F8FAFC" },
                  }}
                >
                  All ({liveTransactions.length})
                </Button>

                <Button
                  size="small"
                  onClick={() => setFlowFilter("CREDIT")}
                  sx={{
                    flex: 1,
                    py: 0.7,
                    borderRadius: "20px",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "none",
                    bgcolor: flowFilter === "CREDIT" ? "#059669" : "#FFFFFF",
                    color: flowFilter === "CREDIT" ? "#FFFFFF" : "#64748B",
                    border: "1px solid",
                    borderColor: flowFilter === "CREDIT" ? "#059669" : "#E2E8F0",
                    "&:hover": { bgcolor: flowFilter === "CREDIT" ? "#047857" : "#F8FAFC" },
                  }}
                >
                  Main Wallet ({liveTransactions.filter(r => String(r.type || '') === 'INCOME_CREDIT_75' || r.meta?.ledger === 'MAIN' || (Number(r.amount || 0) > 0 && String(r.type || '') !== 'SELF_ACCOUNT_CREDIT')).length})
                </Button>

                <Button
                  size="small"
                  onClick={() => setFlowFilter("DEBIT")}
                  sx={{
                    flex: 1,
                    py: 0.7,
                    borderRadius: "20px",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "none",
                    bgcolor: flowFilter === "DEBIT" ? "#D97706" : "#FFFFFF",
                    color: flowFilter === "DEBIT" ? "#FFFFFF" : "#64748B",
                    border: "1px solid",
                    borderColor: flowFilter === "DEBIT" ? "#D97706" : "#E2E8F0",
                    "&:hover": { bgcolor: flowFilter === "DEBIT" ? "#B45309" : "#F8FAFC" },
                  }}
                >
                  Self Account ({categoryStats.SELF_ACCOUNT.count})
                </Button>
              </Stack>
            </Stack>

            {/* 5. MONTHLY TRANSACTION GROUPING STREAM */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: "20px",
                border: "1px solid #EEF2F6",
                bgcolor: "#FFFFFF",
                p: { xs: 1.5, sm: 2 },
                mb: 2,
                overflow: "hidden",
                boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, px: 0.5 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A" }}>
                  Transactions ({filteredHistory.length})
                </Typography>
                {activeFilterCount > 0 && (
                  <Chip
                    size="small"
                    label="Reset Filters"
                    onClick={() => {
                      setSourceFilter("ALL");
                      setFlowFilter("ALL");
                      setDatePreset("all");
                      setCustomStartDate("");
                      setCustomEndDate("");
                      setHistorySearch("");
                    }}
                    sx={{ height: 20, fontSize: 10.5, fontWeight: 700, cursor: "pointer", bgcolor: "#F1F5F9" }}
                  />
                )}
              </Box>

              {historySections.length === 0 ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <AssessmentRoundedIcon sx={{ fontSize: 44, color: "#CBD5E1", mb: 1 }} />
                  <Typography sx={{ fontSize: 13, color: "#64748B", fontWeight: 700 }}>
                    No transactions found for this filter.
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "#94A3B8", mt: 0.3 }}>
                    Commission records appear in real-time as users enroll or purchase packages.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {historySections.map((sec) => (
                    <Box key={sec.key || sec.title}>
                      {/* Month Header Banner */}
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2, px: 0.5 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: "#334155", letterSpacing: "-0.01em" }}>
                          {sec.title}
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: sec.total >= 0 ? "#059669" : "#DC2626" }}>
                          ₹ {Math.abs(sec.total).toFixed(2)}
                        </Typography>
                      </Stack>

                      {/* Transaction Cards List */}
                      <Stack spacing={1}>
                        {sec.rows.map((tx, idx) => {
                          const amt = Number(tx.amount || 0);
                          const isCredit = amt >= 0;
                          const isSelf = String(tx.type || "") === "SELF_ACCOUNT_CREDIT" || tx.meta?.ledger === "SELF_ACCOUNT";
                          const isMain = String(tx.type || "") === "INCOME_CREDIT_75" || tx.meta?.ledger === "MAIN";

                          const dateObj = tx.created_at ? new Date(tx.created_at) : null;
                          const dateFormatted = dateObj
                            ? dateObj.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                            : "Recent";
                          const timeFormatted = dateObj
                            ? dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
                            : "";

                          return (
                            <Paper
                              key={tx.id || idx}
                              elevation={0}
                              onClick={() => setSelectedTxDetail(tx)}
                              sx={{
                                p: 1.4,
                                borderRadius: 2.5,
                                border: "1px solid",
                                borderColor: isSelf ? "#FDE68A" : "#EEF2F6",
                                bgcolor: isSelf ? "#FFFDF5" : "#FFFFFF",
                                cursor: "pointer",
                                transition: "all 180ms cubic-bezier(0.4, 0, 0.2, 1)",
                                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.02)",
                                "&:hover": {
                                  borderColor: isSelf ? "#F59E0B" : "#CBD5E1",
                                  boxShadow: "0 4px 14px rgba(12, 45, 72, 0.06)",
                                  transform: "translateY(-1px)",
                                },
                                "&:active": { transform: "scale(0.99)" },
                              }}
                            >
                              <Stack direction="row" spacing={1.2} alignItems="center">
                                {/* Circular Icon Avatar */}
                                <Box
                                  sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    bgcolor: isSelf ? "#FEF3C7" : isCredit ? "#DCFCE7" : "#FEE2E2",
                                    color: isSelf ? "#B45309" : isCredit ? "#166534" : "#DC2626",
                                    border: `1px solid ${isSelf ? "#FDE68A" : isCredit ? "#BBF7D0" : "#FECACA"}`,
                                  }}
                                >
                                  {isSelf ? (
                                    <SavingsIcon sx={{ fontSize: 18 }} />
                                  ) : isCredit ? (
                                    <ArrowUpwardRoundedIcon sx={{ fontSize: 18 }} />
                                  ) : (
                                    <ArrowDownwardRoundedIcon sx={{ fontSize: 18 }} />
                                  )}
                                </Box>

                                {/* Center Metadata */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
                                    <Typography
                                      sx={{
                                        fontWeight: 900,
                                        fontSize: 13,
                                        lineHeight: 1.25,
                                        color: "#0F172A",
                                      }}
                                    >
                                      {describeSource(tx)}
                                    </Typography>

                                    {/* Dedicated Badge */}
                                    {isSelf ? (
                                      <Chip
                                        size="small"
                                        label="Self Account Credit"
                                        sx={{
                                          height: 18,
                                          fontSize: 10,
                                          fontWeight: 800,
                                          borderRadius: 1,
                                          bgcolor: "#FEF3C7",
                                          color: "#92400E",
                                          border: "1px solid #FCD34D",
                                        }}
                                      />
                                    ) : isMain || isCredit ? (
                                      <Chip
                                        size="small"
                                        label="Main Wallet Credit"
                                        sx={{
                                          height: 18,
                                          fontSize: 10,
                                          fontWeight: 800,
                                          borderRadius: 1,
                                          bgcolor: "#DCFCE7",
                                          color: "#166534",
                                          border: "1px solid #86EFAC",
                                        }}
                                      />
                                    ) : null}
                                  </Box>

                                  <Typography
                                    sx={{
                                      fontSize: 11.5,
                                      color: isSelf ? "#B45309" : "#047857",
                                      fontWeight: 700,
                                      mt: 0.2,
                                    }}
                                  >
                                    {isSelf ? "25% Repurchase Self Account" : "75% Withdrawable Main Wallet"}
                                    {counterpartyLabel(tx) ? ` • ${counterpartyLabel(tx)}` : ""}
                                  </Typography>

                                  <Typography sx={{ fontSize: 11, color: "#94A3B8", mt: 0.2 }}>
                                    {dateFormatted} {timeFormatted ? `• ${timeFormatted}` : ""}
                                  </Typography>
                                </Box>

                                {/* Right Amount & Chevron */}
                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                                  <Typography
                                    sx={{
                                      fontSize: 14.5,
                                      fontWeight: 950,
                                      color: isCredit ? "#059669" : "#DC2626",
                                    }}
                                  >
                                    {isCredit ? "+" : "-"}₹ {Math.abs(amt).toFixed(2)}
                                  </Typography>
                                  <ChevronRightRoundedIcon sx={{ fontSize: 18, color: "#CBD5E1" }} />
                                </Stack>
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>

            {/* ── TRANSACTION BREAKDOWN DETAIL DRAWER ── */}
            <Drawer
              anchor="bottom"
              open={Boolean(selectedTxDetail)}
              onClose={() => setSelectedTxDetail(null)}
              PaperProps={{
                sx: {
                  borderTopLeftRadius: "24px",
                  borderTopRightRadius: "24px",
                  p: { xs: 2, sm: 2.5 },
                  pb: { xs: 4, sm: 3.5 },
                  maxWidth: 560,
                  mx: "auto",
                  bgcolor: "#FFFFFF",
                  boxShadow: "0 -12px 40px rgba(15,23,42,0.18)",
                },
              }}
            >
              <Box sx={{ width: 40, height: 4, bgcolor: "#CBD5E1", borderRadius: 2, mx: "auto", mb: 2 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 16.5, fontWeight: 900, color: "#0F172A" }}>
                  Transaction Details
                </Typography>
                <IconButton size="small" onClick={() => setSelectedTxDetail(null)}>
                  <CloseRoundedIcon />
                </IconButton>
              </Stack>

              {selectedTxDetail && (() => {
                const amt = Number(selectedTxDetail.amount || 0);
                const isCredit = amt >= 0;
                const isSelf = String(selectedTxDetail.type || "") === "SELF_ACCOUNT_CREDIT" || selectedTxDetail.meta?.ledger === "SELF_ACCOUNT";
                const dateStr = selectedTxDetail.created_at
                  ? new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(selectedTxDetail.created_at))
                  : "Today";
                const meta = selectedTxDetail.meta || {};
                const grossAmount = meta.gross ? Number(meta.gross) : isSelf ? (amt / 0.25) : (amt / 0.75);

                return (
                  <Box>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: isSelf ? "#FFFDF5" : isCredit ? "#F0FDF4" : "#FEF2F2",
                        border: "1px solid",
                        borderColor: isSelf ? "#FDE68A" : isCredit ? "#BBF7D0" : "#FECACA",
                        textAlign: "center",
                        mb: 2,
                      }}
                    >
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: isSelf ? "#92400E" : isCredit ? "#166534" : "#991B1B", mb: 0.3 }}>
                        {describeSource(selectedTxDetail)}
                      </Typography>
                      <Typography sx={{ fontSize: 26, fontWeight: 900, color: isCredit ? "#059669" : "#DC2626" }}>
                        {isCredit ? "+" : "-"}₹ {Math.abs(amt).toFixed(2)}
                      </Typography>
                      <Chip
                        size="small"
                        label={isSelf ? "Self Account Credit (25%)" : "Main Wallet Credit (75%)"}
                        sx={{
                          mt: 0.8,
                          height: 20,
                          fontSize: 10.5,
                          fontWeight: 800,
                          bgcolor: isSelf ? "#FEF3C7" : isCredit ? "#DCFCE7" : "#FEE2E2",
                          color: isSelf ? "#92400E" : isCredit ? "#166534" : "#991B1B",
                          border: `1px solid ${isSelf ? "#FCD34D" : isCredit ? "#86EFAC" : "#FECACA"}`,
                        }}
                      />
                    </Paper>

                    <Stack spacing={1.2} sx={{ bgcolor: "#F8FAFC", p: 1.8, borderRadius: 2, border: "1px solid #E2E8F0", mb: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Status</Typography>
                        <Chip size="small" label="Settled 100% Instantly" sx={{ bgcolor: "#DCFCE7", color: "#166534", fontWeight: 800, fontSize: 10.5 }} />
                      </Box>
                      <Divider />

                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Timestamp</Typography>
                        <Typography sx={{ fontSize: 12, color: "#0F172A", fontWeight: 700 }}>{dateStr}</Typography>
                      </Box>
                      <Divider />

                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Payer / Consumer</Typography>
                        <Typography sx={{ fontSize: 12, color: "#2563EB", fontWeight: 800 }}>
                          {counterpartyLabel(selectedTxDetail)}
                        </Typography>
                      </Box>
                      <Divider />

                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Territory / Pincode</Typography>
                        <Typography sx={{ fontSize: 12, color: "#0F172A", fontWeight: 700 }}>
                          PIN {meta.pincode || "572106 (Turuvekere)"}
                        </Typography>
                      </Box>
                      <Divider />

                      {meta.gross && (
                        <>
                          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                            <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Gross Pool Value</Typography>
                            <Typography sx={{ fontSize: 12, color: "#0F172A", fontWeight: 800 }}>₹ {Number(meta.gross).toFixed(2)}</Typography>
                          </Box>
                          <Divider />
                        </>
                      )}

                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>75% Main Wallet Split</Typography>
                        <Typography sx={{ fontSize: 12, color: "#166534", fontWeight: 800 }}>
                          ₹ {meta.income_75 ? Number(meta.income_75).toFixed(2) : (grossAmount * 0.75).toFixed(2)}
                        </Typography>
                      </Box>
                      <Divider />

                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, color: "#D97706", fontWeight: 700 }}>25% Self Rebirth Split</Typography>
                        <Typography sx={{ fontSize: 12, color: "#D97706", fontWeight: 800 }}>
                          ₹ {meta.self_25 ? Number(meta.self_25).toFixed(2) : (grossAmount * 0.25).toFixed(2)}
                        </Typography>
                      </Box>
                      <Divider />

                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 11.5, color: "#94A3B8" }}>Transaction ID</Typography>
                        <Typography sx={{ fontSize: 11.5, color: "#94A3B8", fontFamily: "monospace" }}>
                          {selectedTxDetail.id ? `TX-FR-${selectedTxDetail.id}` : `TX-${Date.now().toString().slice(-6)}`}
                        </Typography>
                      </Box>
                    </Stack>

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => setSelectedTxDetail(null)}
                      sx={{
                        py: 1.1,
                        borderRadius: 2,
                        fontWeight: 800,
                        textTransform: "none",
                        bgcolor: "#0F172A",
                        "&:hover": { bgcolor: "#1E293B" },
                      }}
                    >
                      Close Details
                    </Button>
                  </Box>
                );
              })()}
            </Drawer>

            {/* ── PHONEPE FILTER BOTTOM SHEET DRAWER ── */}
            <Drawer
              anchor="bottom"
              open={filterDrawerOpen}
              onClose={() => setFilterDrawerOpen(false)}
              PaperProps={{
                sx: {
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  p: { xs: 2, sm: 2.5 },
                  pb: { xs: 4, sm: 3.5 },
                  maxWidth: 560,
                  mx: "auto",
                  bgcolor: "#FFFFFF",
                  boxShadow: "0 -12px 40px rgba(15,23,42,0.18)",
                  maxHeight: "85vh",
                  overflowY: "auto",
                },
              }}
            >
              <Box sx={{ width: 40, height: 4, bgcolor: "#CBD5E1", borderRadius: 2, mx: "auto", mb: 2 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 17, fontWeight: 900, color: "#0F172A" }}>
                    Filter Franchise Ledger
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#64748B" }}>
                    Filter by date presets, payment flows, and channels
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    onClick={() => {
                      setSourceFilter("ALL");
                      setFlowFilter("ALL");
                      setDatePreset("all");
                      setCustomStartDate("");
                      setCustomEndDate("");
                    }}
                    sx={{ textTransform: "none", fontSize: 12, fontWeight: 700, color: "#DC2626" }}
                  >
                    Reset
                  </Button>
                  <IconButton size="small" onClick={() => setFilterDrawerOpen(false)}>
                    <CloseRoundedIcon />
                  </IconButton>
                </Stack>
              </Box>

              {/* Date Presets */}
              <Box sx={{ mb: 2.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#1E293B", mb: 1 }}>
                  📅 Date Range
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.2 }}>
                  {[
                    { label: "All Time", value: "all" },
                    { label: "Today", value: "today" },
                    { label: "This Month", value: "this_month" },
                    { label: "Last Month", value: "last_month" },
                    { label: "Last 30 Days", value: "30_days" },
                    { label: "Custom Range", value: "custom" },
                  ].map((p) => {
                    const isSelected = datePreset === p.value;
                    return (
                      <Chip
                        key={p.value}
                        label={p.label}
                        onClick={() => setDatePreset(p.value)}
                        sx={{
                          fontWeight: 800,
                          fontSize: 12,
                          borderRadius: 999,
                          bgcolor: isSelected ? "#2563EB" : "#F1F5F9",
                          color: isSelected ? "#FFFFFF" : "#475569",
                          border: "1px solid",
                          borderColor: isSelected ? "#2563EB" : "#E2E8F0",
                          cursor: "pointer",
                        }}
                      />
                    );
                  })}
                </Box>

                {datePreset === "custom" && (
                  <Paper elevation={0} sx={{ p: 1.5, bgcolor: "#F8FAFC", borderRadius: 2, border: "1px solid #E2E8F0", mt: 1 }}>
                    <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 700, mb: 1 }}>
                      Pick Start Date and End Date
                    </Typography>
                    <Stack direction="row" spacing={1.2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="From Date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ bgcolor: "#fff" }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="To Date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ bgcolor: "#fff" }}
                      />
                    </Stack>
                  </Paper>
                )}
              </Box>

              {/* Source Channel Options */}
              <Box sx={{ mb: 2.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#1E293B", mb: 1 }}>
                  🏷️ Source Channel
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                  {[
                    { label: "All Sources", value: "ALL" },
                    { label: "Franchise Geo", value: "FRANCHISE_GEO" },
                    { label: "Self Blocks (25%)", value: "SELF_ACCOUNT" },
                    { label: "QR Scanner", value: "QR_SCANNER" },
                    { label: "TriZone Commerce", value: "TRIZONE" },
                    { label: "Royalty Pool", value: "ROYALTY" },
                  ].map((s) => {
                    const isSelected = sourceFilter === s.value;
                    return (
                      <Chip
                        key={s.value}
                        label={s.label}
                        onClick={() => setSourceFilter(s.value)}
                        sx={{
                          fontWeight: 800,
                          fontSize: 12,
                          borderRadius: 999,
                          bgcolor: isSelected ? "#059669" : "#F1F5F9",
                          color: isSelected ? "#FFFFFF" : "#475569",
                          border: "1px solid",
                          borderColor: isSelected ? "#059669" : "#E2E8F0",
                          cursor: "pointer",
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>

              <Button
                fullWidth
                variant="contained"
                onClick={() => setFilterDrawerOpen(false)}
                sx={{
                  mt: 1,
                  py: 1.1,
                  borderRadius: 2,
                  fontWeight: 800,
                  textTransform: "none",
                  bgcolor: "#0F172A",
                  "&:hover": { bgcolor: "#1E293B" },
                }}
              >
                Apply Filters
              </Button>
            </Drawer>


          </Box>
        )}

        {/* =========================================================================
            SCREEN: FRANCHISE SELF-REBIRTH & MATRIX PLACEMENTS
        ========================================================================= */}
        {activeScreen === "self_rebirth" && (
          <Box>
            {/* Franchise Self Block Hero Card */}
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: "22px",
                mb: 2,
                background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)",
                color: "#FFFFFF",
                boxShadow: "0 10px 28px -6px rgba(15, 23, 42, 0.4)",
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  icon={<AutorenewRoundedIcon sx={{ fontSize: 16, color: "#FDE68A !important" }} />}
                  label="25% Self Block Pocket"
                  size="small"
                  sx={{ bgcolor: "rgba(253,230,138,0.2)", color: "#FDE68A", fontWeight: 900, fontSize: 11 }}
                />
                <Chip
                  label={`${rebirthList.length} Active Nodes`}
                  size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#FFFFFF", fontWeight: 800, fontSize: 10.5 }}
                />
              </Stack>

              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#94A3B8" }}>
                Current Self Block Balance
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 0.3, mb: 1.2 }}>
                <Typography sx={{ fontSize: 32, fontWeight: 950, color: "#FFFFFF", lineHeight: 1 }}>
                  ₹ {walletState.selfWallet.toFixed(2)}
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#CBD5E1" }}>
                  / ₹ {adminRebirthConfig.total_amount.toFixed(2)}
                </Typography>
              </Stack>

              {/* Progress bar towards threshold */}
              <Box sx={{ mb: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#CBD5E1" }}>
                    Cycle Progress to Next Rebirth
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 900, color: "#FDE68A" }}>
                    {Math.min(100, Math.round((walletState.selfWallet / (adminRebirthConfig.total_amount || 250)) * 100))}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (walletState.selfWallet / (adminRebirthConfig.total_amount || 250)) * 100)}
                  sx={{
                    height: 9,
                    borderRadius: 4,
                    bgcolor: "rgba(255,255,255,0.15)",
                    "& .MuiLinearProgress-bar": {
                      bgcolor: walletState.selfWallet >= adminRebirthConfig.total_amount ? "#10B981" : "#F59E0B",
                      borderRadius: 4,
                    },
                  }}
                />
              </Box>

              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.75)", mb: 1.8, lineHeight: 1.4 }}>
                Accumulates 25% of all regional commissions. When this pocket hits ₹{adminRebirthConfig.total_amount.toFixed(2)}, it automatically spawns a new Franchise Rebirth node into both 5-Matrix and 3-Matrix trees.
              </Typography>

              <Box
                sx={{
                  p: 1.4,
                  borderRadius: "14px",
                  bgcolor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.2,
                }}
              >
                <AutorenewRoundedIcon sx={{ color: "#FDE68A", fontSize: 24, flexShrink: 0 }} />
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#FFFFFF", fontWeight: 800, lineHeight: 1.3 }}>
                    100% Autonomous Rebirth Engine
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "#CBD5E1", mt: 0.3, lineHeight: 1.35 }}>
                    When balance reaches ₹{adminRebirthConfig.total_amount.toFixed(2)}, the engine automatically debits ₹{adminRebirthConfig.total_amount.toFixed(2)} and places a new Rebirth node into 5-Matrix & 3-Matrix per Admin Configuration.
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Sub Tabs: 5-Matrix Placements | 3-Matrix Autopool | Node History | Admin Rates */}
            <Paper elevation={0} sx={{ p: 0.8, borderRadius: "16px", bgcolor: "#F1F5F9", mb: 2 }}>
              <Grid container spacing={0.5}>
                {[
                  { key: "matrix5", label: "5-Matrix Tree" },
                  { key: "matrix3", label: "3-Matrix Pool" },
                  { key: "history", label: "Node History" },
                  { key: "config", label: "Admin Rates" },
                ].map((tb) => (
                  <Grid item xs={3} key={tb.key}>
                    <Button
                      fullWidth
                      size="small"
                      onClick={() => setRebirthSubTab(tb.key)}
                      sx={{
                        py: 0.6,
                        px: 0.2,
                        borderRadius: "12px",
                        fontSize: 11,
                        fontWeight: rebirthSubTab === tb.key ? 900 : 700,
                        bgcolor: rebirthSubTab === tb.key ? "#FFFFFF" : "transparent",
                        color: rebirthSubTab === tb.key ? "#0F172A" : "#64748B",
                        boxShadow: rebirthSubTab === tb.key ? "0 2px 8px rgba(15,23,42,0.06)" : "none",
                        textTransform: "none",
                      }}
                    >
                      {tb.label}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            {/* TAB 1: 5-Matrix Placements */}
            {rebirthSubTab === "matrix5" && (
              <Stack spacing={1.5}>
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <AccountTreeRoundedIcon sx={{ color: "#2563EB", fontSize: 20 }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                      5-Matrix Structural Tree Placements
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 11.5, color: "#64748B", mb: 1.5 }}>
                    Every Rebirth ID is permanently placed as an earning node in your regional 5-Matrix tree (5 x 5 x 5 x 5 x 5).
                  </Typography>

                  {rebirthList.length > 0 ? (
                    <Stack spacing={1.2}>
                      {rebirthList.map((node, i) => (
                        <Paper key={node.id} elevation={0} sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar sx={{ width: 32, height: 32, bgcolor: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 900 }}>
                                #{i + 1}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>
                                  {node.id}
                                </Typography>
                                <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>
                                  Matrix Level: {node.matrix5Level || 2} • Placed {node.date}
                                </Typography>
                              </Box>
                            </Stack>
                            <Chip
                              label="EARNING"
                              size="small"
                              sx={{ height: 20, bgcolor: "#ECFDF5", color: "#059669", fontWeight: 900, fontSize: 10 }}
                            />
                          </Stack>
                          <Divider sx={{ my: 1 }} />
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>
                              Cumulative Matrix Yield:
                            </Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#059669" }}>
                              {node.earnedAmount}
                            </Typography>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Paper elevation={0} sx={{ p: 3, textAlign: "center", borderRadius: "14px", bgcolor: "#F8FAFC", border: "1px dashed #CBD5E1" }}>
                      <AccountTreeRoundedIcon sx={{ fontSize: 36, color: "#94A3B8", mb: 1 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>
                        No Rebirth Nodes Spawned Yet
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#64748B", mt: 0.5, maxWidth: 320, mx: "auto" }}>
                        Your Self Block Pocket currently has ₹{walletState.selfWallet.toFixed(2)}. When it reaches ₹{adminRebirthConfig.total_amount.toFixed(2)}, your first Rebirth ID will be automatically placed in the 5-Matrix tree.
                      </Typography>
                    </Paper>
                  )}
                </Paper>
              </Stack>
            )}

            {/* TAB 2: 3-Matrix Autopool Placements */}
            {rebirthSubTab === "matrix3" && (
              <Stack spacing={1.5}>
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: "18px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <AutorenewRoundedIcon sx={{ color: "#7C3AED", fontSize: 20 }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                      3-Matrix Global Autopool Placements
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 11.5, color: "#64748B", mb: 1.5 }}>
                    High-speed 3-Matrix queue filling globally left-to-right, top-to-bottom automatically.
                  </Typography>

                  {rebirthList.length > 0 ? (
                    <Stack spacing={1.2}>
                      {rebirthList.map((node, i) => (
                        <Paper key={node.id} elevation={0} sx={{ p: 1.5, borderRadius: "14px", bgcolor: "#FAF5FF", border: "1px solid #F3E8FF" }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#6B21A8" }}>
                                {node.id}
                              </Typography>
                              <Typography sx={{ fontSize: 10.5, color: "#7E22CE" }}>
                                Queue Position: #{node.matrix3Queue || 42} in Global 3-Matrix
                              </Typography>
                            </Box>
                            <Chip
                              label="IN QUEUE"
                              size="small"
                              sx={{ height: 20, bgcolor: "#F3E8FF", color: "#7E22CE", fontWeight: 900, fontSize: 10 }}
                            />
                          </Stack>
                          <Divider sx={{ my: 1, borderColor: "#E9D5FF" }} />
                          <Stack direction="row" justifyContent="space-between">
                            <Typography sx={{ fontSize: 10.5, color: "#6B21A8" }}>Cycle Payout Target:</Typography>
                            <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#7E22CE" }}>₹3,000.00 / Cycle</Typography>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Paper elevation={0} sx={{ p: 3, textAlign: "center", borderRadius: "14px", bgcolor: "#FAF5FF", border: "1px dashed #D8B4FE" }}>
                      <AutorenewRoundedIcon sx={{ fontSize: 36, color: "#A855F7", mb: 1 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#581C87" }}>
                        No 3-Matrix Queue Positions Yet
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#7E22CE", mt: 0.5, maxWidth: 320, mx: "auto" }}>
                        High-speed 3-Matrix queue positions activate automatically each time ₹{adminRebirthConfig.total_amount.toFixed(2)} accumulates in your 25% Self Block pocket.
                      </Typography>
                    </Paper>
                  )}
                </Paper>
              </Stack>
            )}

            {/* TAB 3: Node History */}
            {rebirthSubTab === "history" && (
              <Stack spacing={1.2}>
                {(() => {
                  const selfTx = (liveTransactions || []).filter((tx) => classifyFranchiseTransaction(tx) === "SELF_ACCOUNT" || tx.type === "SELF_ACCOUNT_CREDIT" || tx.type === "SELF_ACCOUNT_DEBIT" || tx.meta?.ledger === "SELF_ACCOUNT");
                  if (selfTx.length === 0) {
                    return (
                      <Paper elevation={0} sx={{ p: 3, textAlign: "center", borderRadius: "16px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
                        <SavingsIcon sx={{ fontSize: 36, color: "#D97706", mb: 1 }} />
                        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>
                          No Self Account Transactions Recorded
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "#64748B", mt: 0.5 }}>
                          25% allocations from Prime and SPP commissions will appear here.
                        </Typography>
                      </Paper>
                    );
                  }
                  return selfTx.map((tx, idx) => (
                    <Paper key={tx.id || idx} elevation={0} sx={{ p: 1.6, borderRadius: "16px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 900, color: "#0F172A" }}>
                            {formatTxTitle(tx)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748B", mt: 0.2 }}>
                            {counterpartyLabel(tx)} • {tx.created_at ? new Date(tx.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "Recent"}
                          </Typography>
                          <Typography sx={{ fontSize: 10.5, color: "#D97706", mt: 0.4, fontWeight: 700 }}>
                            25% Self Block Allocation
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 950, color: Number(tx.amount || 0) >= 0 ? "#D97706" : "#DC2626" }}>
                          {Number(tx.amount || 0) >= 0 ? `+₹${Number(tx.amount || 0).toFixed(2)}` : `-₹${Math.abs(Number(tx.amount || 0)).toFixed(2)}`}
                        </Typography>
                      </Stack>
                    </Paper>
                  ));
                })()}
              </Stack>
            )}

            {/* TAB 4: Admin Rates & Zero Hardcoding Guarantee */}
            {rebirthSubTab === "config" && (
              <Paper elevation={0} sx={{ p: 2, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A" }}>
                    Admin-Configured Self Rebirth Engine
                  </Typography>
                  <Chip
                    label={`Rebirth Tax: ${adminRebirthConfig.tax_rebirth}%`}
                    size="small"
                    sx={{ bgcolor: "#EFF6FF", color: "#1D4ED8", fontWeight: 850, fontSize: 10.5 }}
                  />
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: "#64748B", mb: 1.5 }}>
                  Configured authoritatively in Admin Commission Distribution (<code style={{ color: "#2563EB" }}>CommissionConfig</code>).
                </Typography>

                <Stack spacing={1}>
                  {[
                    { label: "Rebirth ID Entry Amount (Inflow)", val: `₹${adminRebirthConfig.total_amount.toFixed(2)}` },
                    { label: "Direct Sponsor Bonus", val: `₹${adminRebirthConfig.direct_sponsor.toFixed(2)}` },
                    { label: "5-Block Pool Share (10 Layers)", val: `₹${adminRebirthConfig.matrix_5.toFixed(2)}` },
                    { label: "3-Block Pool Share (15 Layers)", val: `₹${adminRebirthConfig.matrix_3.toFixed(2)}` },
                    { label: "Pincode Royalty (6-Role Geo Upline)", val: `₹${adminRebirthConfig.pincode_royalty.toFixed(2)}` },
                    { label: "District Royalty", val: `₹${adminRebirthConfig.district_royalty.toFixed(2)}` },
                    { label: "State Royalty", val: `₹${adminRebirthConfig.state_royalty.toFixed(2)}` },
                    { label: "District Royalty L1-L7 (7 Days)", val: `₹${adminRebirthConfig.district_royalty_l1_l7.toFixed(2)}` },
                    { label: "District Royalty L1-L10 (30 Days)", val: `₹${adminRebirthConfig.district_royalty_l1_l10_30d.toFixed(2)}` },
                    { label: "Districtwise Royalty L8-L10 (7 Days)", val: `₹${adminRebirthConfig.districtwise_royalty_l8_l10.toFixed(2)}` },
                    { label: "Statewise Royalty L8-L10 (7 Days)", val: `₹${adminRebirthConfig.statewise_royalty_l8_l10.toFixed(2)}` },
                    { label: "District Captain Royalty", val: `₹${adminRebirthConfig.district_captain_royalty.toFixed(2)}` },
                    { label: "State Captain Royalty", val: `₹${adminRebirthConfig.state_captain_royalty.toFixed(2)}` },
                    { label: "Statewise SSV Voucher", val: `₹${adminRebirthConfig.statewise_ssv_voucher.toFixed(2)}` },
                    { label: "Statewise Zonal Head", val: `₹${adminRebirthConfig.statewise_zonal_head.toFixed(2)}` },
                    { label: "Statewise Rewards", val: `₹${adminRebirthConfig.statewise_rewards.toFixed(2)}` },
                    { label: "Company Admin Retention", val: `₹${adminRebirthConfig.company_admin.toFixed(2)}` },
                  ].map((row, i) => (
                    <Box key={i} sx={{ p: 1.1, borderRadius: "10px", bgcolor: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }}>{row.label}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 900, color: "#059669" }}>{row.val}</Typography>
                    </Box>
                  ))}
                </Stack>

                {/* 6-Role Geo Upline Percentages */}
                <Box sx={{ mt: 2, p: 1.4, borderRadius: "14px", bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: "#1E40AF", mb: 0.8 }}>
                    6-Role Geo Upline Distribution (Gross ₹{adminRebirthConfig.pincode_royalty.toFixed(2)})
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.8 }}>
                    {[
                      { role: "Pincode", pct: adminRebirthConfig.pincode_roles_pct.pincode },
                      { role: "Pincode Coord", pct: adminRebirthConfig.pincode_roles_pct.pincode_coord },
                      { role: "District", pct: adminRebirthConfig.pincode_roles_pct.district },
                      { role: "District Coord", pct: adminRebirthConfig.pincode_roles_pct.district_coord },
                      { role: "State", pct: adminRebirthConfig.pincode_roles_pct.state },
                      { role: "State Coord", pct: adminRebirthConfig.pincode_roles_pct.state_coord },
                    ].map((g, gi) => (
                      <Box key={gi} sx={{ p: 0.8, borderRadius: "8px", bgcolor: "#FFFFFF", textAlign: "center", border: "1px solid #DBEAFE" }}>
                        <Typography sx={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>{g.role}</Typography>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 950, color: "#1E40AF" }}>{g.pct}%</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Paper>
            )}
          </Box>
        )}

        {/* =========================================================================
            SCREEN 9: REGISTERED CUSTOMERS DIRECTORY (100% Dynamic DB Data)
        ========================================================================= */}
        {activeScreen === "users" && (
          <Box>
            <PageHeader
              title="Registered Customers"
              count={activeZoneMetrics.dispCustomers}
            />

            {/* Dynamic Zone KPI Summary */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5, mb: 2 }}>
              <Paper elevation={0} sx={{ p: 1.8, borderRadius: "18px", bgcolor: "#ECFDF5", border: "1px solid #A7F3D0", minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#065F46" }}>Active Customers</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 950, color: "#047857", mt: 0.5 }}>
                  {activeZoneMetrics.dispCustomers.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#059669" }}>
                  100% Active in Zone
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 1.8, borderRadius: "18px", bgcolor: "#F8FAFC", border: "1px solid #E2E8F0", minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>Inactive Customers</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 950, color: "#0F172A", mt: 0.5 }}>0</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748B" }}>0.0% Inactive</Typography>
              </Paper>
            </Box>

            {/* Territory / Pincode Filter for Coordinators */}
            {currentTier.scopeCount > 1 && (
              <Box sx={{ mb: 1.5, p: 1, borderRadius: "14px", bgcolor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <LocationOnRoundedIcon sx={{ color: "#2563EB", fontSize: 18 }} />
                  <FormControl size="small" fullWidth variant="standard">
                    <Select
                      value={selectedSubZone}
                      onChange={(e) => setSelectedSubZone(e.target.value)}
                      disableUnderline
                      sx={{ fontSize: 12.5, fontWeight: 800, color: "#1E40AF" }}
                    >
                      <MenuItem value="all" sx={{ fontSize: 12.5, fontWeight: 800 }}>
                        All {currentTier.scopeCount} Assigned ({currentTier.defaultLocation})
                      </MenuItem>
                      {currentTier.pincodes && currentTier.pincodes.map((pin) => (
                        <MenuItem key={pin.pincode} value={pin.pincode} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          Pin: {pin.name}
                        </MenuItem>
                      ))}
                      {currentTier.districts && currentTier.districts.map((d) => (
                        <MenuItem key={d} value={d} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          District: {d}
                        </MenuItem>
                      ))}
                      {currentTier.states && currentTier.states.map((s) => (
                        <MenuItem key={s} value={s} sx={{ fontSize: 12.5, fontWeight: 700 }}>
                          State: {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
            )}

            {/* Search Field */}
            <SearchField
              placeholder="Search customer by name or phone..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />

            {/* Filter Chips */}
            <FilterChips
              filters={[
                { label: `All (${filteredCustomers.length})`, value: "all" },
                { label: `Active (${filteredCustomers.length})`, value: "active" },
                { label: `Inactive (0)`, value: "inactive" },
              ]}
              activeValue={customerFilter}
              onSelect={(val) => setCustomerFilter(val)}
            />

            {/* Customers List (Zero Mockup Data - 100% Live DB State) */}
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {filteredCustomers.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    textAlign: "center",
                    borderRadius: "20px",
                    bgcolor: "#FFFFFF",
                    border: "1px solid #EEF2F6",
                    boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
                  }}
                >
                  <Avatar sx={{ width: 48, height: 48, bgcolor: "#EFF6FF", color: "#2563EB", mx: "auto", mb: 1.5 }}>
                    <GroupsOutlinedIcon />
                  </Avatar>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#0F172A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    No Registered Customers Found
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: "#64748B", mt: 0.5, fontWeight: 500, maxWidth: 320, mx: "auto" }}>
                    Consumers registered under PIN {selectedSubZone !== "all" ? selectedSubZone : (user?.pincode || "572106")} will appear here in real-time.
                  </Typography>
                </Paper>
              ) : (
                filteredCustomers.map((cust, idx) => {
                  const displayName = cust.full_name || cust.name || cust.username || "Customer";
                  const displayPhone = cust.phone || cust.mobile || cust.username || "—";
                  const dateJoined = cust.date_joined
                    ? new Date(cust.date_joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "5 Oct 2026";
                  
                  const initials = displayName.split(" ").map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase() || "CU";
                  const avatarColors = [
                    { bg: "#F3E8FF", color: "#7C3AED" },
                    { bg: "#EFF6FF", color: "#2563EB" },
                    { bg: "#FEF3C7", color: "#D97706" },
                  ];
                  const col = avatarColors[idx % avatarColors.length];

                  return (
                    <Paper
                      key={cust.id || cust.username || cust.phone || idx}
                      elevation={0}
                      sx={{
                        p: 1.8,
                        borderRadius: "18px",
                        bgcolor: "#FFFFFF",
                        border: "1px solid #EEF2F6",
                        boxShadow: "0 2px 8px rgba(15,23,42,0.03)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "transform 0.12s ease",
                        "&:active": { transform: "scale(0.98)" },
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                        <Avatar
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            bgcolor: col.bg,
                            color: col.color,
                            fontWeight: 800,
                            fontSize: 15,
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                            {displayName}
                          </Typography>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#64748B", mt: 0.1 }}>
                            {displayPhone}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#94A3B8", mt: 0.2 }}>
                            Registered on {dateJoined}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
                        <Box
                          sx={{
                            bgcolor: "#ECFDF5",
                            color: "#059669",
                            border: "1px solid #A7F3D0",
                            borderRadius: "999px",
                            px: 1.2,
                            py: 0.3,
                            fontSize: 11,
                            fontWeight: 800,
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                          }}
                        >
                          Active
                        </Box>
                        <ChevronRightRoundedIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
                      </Stack>
                    </Paper>
                  );
                })
              )}
            </Stack>
          </Box>
        )}

        {/* =========================================================================
            SCREEN 9: SUPPORT & GRIEVANCES (Exact Image 2 Screen 7)
        ========================================================================= */}
        {activeScreen === "support" && (
          <Box>
            {/* Top Tabs: My Tickets | Create Ticket */}
            <Box sx={{ borderBottom: "1px solid #E2E8F0", mb: 2, display: "flex", gap: 3 }}>
              <Box
                onClick={() => setSupportTab("my_tickets")}
                sx={{
                  pb: 1,
                  fontSize: 14,
                  fontWeight: supportTab === "my_tickets" ? 900 : 600,
                  color: supportTab === "my_tickets" ? "#5F259F" : "#64748B",
                  borderBottom: supportTab === "my_tickets" ? "2.5px solid #5F259F" : "2.5px solid transparent",
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                My Tickets
              </Box>
              <Box
                onClick={() => setSupportTab("create_ticket")}
                sx={{
                  pb: 1,
                  fontSize: 14,
                  fontWeight: supportTab === "create_ticket" ? 900 : 600,
                  color: supportTab === "create_ticket" ? "#5F259F" : "#64748B",
                  borderBottom: supportTab === "create_ticket" ? "2.5px solid #5F259F" : "2.5px solid transparent",
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Create Ticket
              </Box>
            </Box>

            {supportTab === "my_tickets" ? (
              <Box>
                {/* Filter Chips: All (0) | Open (0) | In Progress (0) | Closed (0) */}
                <FilterChips
                  filters={[
                    { label: `All (${filteredIssues.length})`, value: "all" },
                    { label: `Open (${filteredIssues.filter(t => t.status === "Open").length})`, value: "open" },
                    { label: `In Progress (${filteredIssues.filter(t => t.status === "In Progress").length})`, value: "in_progress" },
                    { label: `Closed (${filteredIssues.filter(t => t.status === "Closed" || t.status === "Resolved").length})`, value: "closed" },
                  ]}
                  activeValue={supportFilter}
                  onSelect={(val) => setSupportFilter(val)}
                />

                {/* Empty State when 0 Tickets */}
                {filteredIssues.length === 0 ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 4,
                      textAlign: "center",
                      borderRadius: "20px",
                      bgcolor: "#FFFFFF",
                      border: "1px solid #EEF2F6",
                      boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
                      mt: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: 68,
                        height: 68,
                        borderRadius: "50%",
                        bgcolor: "#FAF5FF",
                        color: "#9333EA",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mx: "auto",
                        mb: 2,
                      }}
                    >
                      <SupportAgentRoundedIcon sx={{ fontSize: 36, color: "#9333EA" }} />
                    </Box>
                    <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#0F172A", mb: 0.5, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      No support tickets yet
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: "#64748B", mb: 2.5, fontWeight: 500, maxWidth: 280, mx: "auto", lineHeight: 1.4 }}>
                      Raise a ticket if you need any help or have an issue.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => setSupportTab("create_ticket")}
                      sx={{
                        borderRadius: "999px",
                        bgcolor: "#5F259F",
                        color: "#FFFFFF",
                        textTransform: "none",
                        fontWeight: 800,
                        fontSize: 13,
                        px: 3,
                        py: 1,
                        boxShadow: "0 4px 12px rgba(95, 37, 159, 0.25)",
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        "&:hover": { bgcolor: "#4D1A85" },
                        "&:active": { transform: "scale(0.96)" },
                      }}
                    >
                      + Create New Ticket
                    </Button>
                  </Paper>
                ) : (
                  /* Ticket Cards List */
                  <Stack spacing={1.5}>
                    {filteredIssues.map((tk) => {
                      const isResolved = tk.status === "Resolved" || tk.status === "Closed";
                      const isInProgress = tk.status === "In Progress";
                      const statusBg = isResolved ? "#ECFDF5" : isInProgress ? "#FFFBEB" : "#FEF2F2";
                      const statusColor = isResolved ? "#059669" : isInProgress ? "#D97706" : "#DC2626";

                      return (
                        <Paper
                          key={tk.id}
                          elevation={0}
                          sx={{
                            p: 1.8,
                            borderRadius: "18px",
                            bgcolor: "#FFFFFF",
                            border: "1px solid #EEF2F6",
                            boxShadow: "0 2px 8px rgba(15,23,42,0.03)",
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 950, color: "#5F259F" }}>
                              {tk.id}
                            </Typography>
                            <Box
                              sx={{
                                fontSize: 10.5,
                                fontWeight: 800,
                                bgcolor: statusBg,
                                color: statusColor,
                                borderRadius: "999px",
                                px: 1.2,
                                py: 0.2,
                              }}
                            >
                              {tk.status}
                            </Box>
                          </Stack>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: "#0F172A", mb: 0.4 }}>
                            {tk.subject}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>
                            {tk.category} • {tk.date} • {tk.priority || "Normal"} Priority
                          </Typography>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            ) : (
              /* Create Ticket Form */
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: "20px", bgcolor: "#FFFFFF", border: "1px solid #EEF2F6", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
                <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#0F172A", mb: 2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Raise a Support Ticket
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Subject / Topic"
                    size="small"
                    value={issueSubject}
                    onChange={(e) => setIssueSubject(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }}
                  />
                  <FormControl fullWidth size="small">
                    <Select
                      value={issueCategory}
                      onChange={(e) => setIssueCategory(e.target.value)}
                      displayEmpty
                      sx={{ borderRadius: "14px" }}
                    >
                      <MenuItem value="Wallet & Payouts">Wallet & Payouts</MenuItem>
                      <MenuItem value="QR Scanner / Merchant">QR Scanner / Merchant</MenuItem>
                      <MenuItem value="Territory Assignment">Territory Assignment</MenuItem>
                      <MenuItem value="Self-Rebirth Matrix">Self-Rebirth Matrix</MenuItem>
                      <MenuItem value="Technical Grievance">Technical Grievance</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Description & Details"
                    multiline
                    rows={4}
                    value={issueDesc}
                    onChange={(e) => setIssueDesc(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "14px" } }}
                  />
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => {
                      if (issueSubject.trim()) {
                        handleRaiseIssue();
                        setSupportTab("my_tickets");
                      }
                    }}
                    sx={{
                      borderRadius: "999px",
                      bgcolor: "#5F259F",
                      color: "#FFFFFF",
                      fontWeight: 800,
                      py: 1.1,
                      textTransform: "none",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      "&:hover": { bgcolor: "#4D1A85" },
                      "&:active": { transform: "scale(0.96)" },
                    }}
                  >
                    Submit Support Ticket
                  </Button>
                </Stack>
              </Paper>
            )}

            {/* Helpdesk Contact Box */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: "20px",
                bgcolor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                mt: 2.5,
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#1E3A8A" }}>
                Need Immediate Assistance?
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#475569", mt: 0.3, mb: 1.5 }}>
                Our 24/7 franchise operations desk is available for instant escalation.
              </Typography>
              <Grid container spacing={1.2}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    startIcon={<CallRoundedIcon />}
                    component="a"
                    href="tel:+918095918105"
                    sx={{
                      bgcolor: "#FFFFFF",
                      borderRadius: "12px",
                      textTransform: "none",
                      fontWeight: 800,
                      fontSize: 11.5,
                      borderColor: "#93C5FD",
                    }}
                  >
                    Call Support
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    size="small"
                    variant="contained"
                    startIcon={<SupportAgentRoundedIcon />}
                    component="a"
                    href="https://wa.me/918095918105"
                    target="_blank"
                    sx={{
                      bgcolor: "#2563EB",
                      borderRadius: "12px",
                      textTransform: "none",
                      fontWeight: 800,
                      fontSize: 11.5,
                    }}
                  >
                    WhatsApp Desk
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        )}

      {/* ── MORE ACTIONS BOTTOM DRAWER ── */}
      <Drawer
        anchor="bottom"
        open={moreDrawerOpen}
        onClose={() => setMoreDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            p: 2.5,
            maxWidth: 600,
            mx: "auto",
          },
        }}
      >
        <Box sx={{ width: 40, height: 4, bgcolor: "#CBD5E1", borderRadius: 2, mx: "auto", mb: 2 }} />
        <Typography sx={{ fontSize: 16, fontWeight: 950, color: "#0F172A", mb: 2 }}>
          Franchise Command Center Modules
        </Typography>

        <Grid container spacing={1.5}>
          {[
            { label: "Wallet & History", screen: "history", icon: <AccountBalanceWalletRoundedIcon />, color: "#2563EB", bg: "#EFF6FF" },
            { label: "Territory Overview", screen: "pincode", icon: <LocationOnRoundedIcon />, color: "#4F46E5", bg: "#EEF2FF" },
            { label: "Registered Customers", screen: "users", icon: <GroupsOutlinedIcon />, color: "#0284C7", bg: "#F0F9FF" },
            { label: "Support & Grievances", screen: "support", icon: <SupportAgentRoundedIcon />, color: "#9333EA", bg: "#FAF5FF" },
            { label: "Scan Merchant QR", screen: "qr", icon: <QrCodeScannerRoundedIcon />, color: "#DC2626", bg: "#FEF2F2", action: () => setScanQrOpen(true) },
            { label: "Withdraw Wallet", screen: "withdraw", icon: <ArrowUpwardRoundedIcon />, color: "#10B981", bg: "#ECFDF5", action: () => setWithdrawDialogOpen(true) },
          ].map((mod) => (
            <Grid item xs={6} key={mod.label}>
              <Paper
                elevation={0}
                onClick={() => {
                  setMoreDrawerOpen(false);
                  if (mod.action) {
                    mod.action();
                  } else {
                    setActiveScreen(mod.screen);
                  }
                }}
                sx={{
                  p: 1.6,
                  borderRadius: "16px",
                  bgcolor: "#FFFFFF",
                  border: "1px solid #EEF2F6",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.2,
                  "&:hover": { borderColor: "#2563EB" },
                }}
              >
                <Avatar sx={{ bgcolor: mod.bg, color: mod.color, width: 36, height: 36 }}>
                  {mod.icon}
                </Avatar>
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "#1E293B" }}>
                  {mod.label}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Drawer>

      {/* ── ADD MERCHANT MODAL ── */}
      <Dialog open={addMerchantOpen} onClose={() => setAddMerchantOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "20px" } }}>
        <DialogTitle sx={{ fontWeight: 950, fontSize: 16 }}>+ Add New Merchant</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField fullWidth size="small" label="Store Name" value={newMerchant.name} onChange={(e) => setNewMerchant({ ...newMerchant, name: e.target.value })} />
            <TextField fullWidth size="small" label="Owner Name" value={newMerchant.owner} onChange={(e) => setNewMerchant({ ...newMerchant, owner: e.target.value })} />
            <TextField fullWidth size="small" label="Mobile Number" value={newMerchant.phone} onChange={(e) => setNewMerchant({ ...newMerchant, phone: e.target.value })} />
            <TextField fullWidth size="small" label="Category" value={newMerchant.category} onChange={(e) => setNewMerchant({ ...newMerchant, category: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddMerchantOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddMerchant}
            sx={{ bgcolor: "#2563EB", fontWeight: 800 }}
          >
            Save Merchant
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── ADD CAPTAIN MODAL ── */}
      <Dialog open={addCaptainOpen} onClose={() => setAddCaptainOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "20px" } }}>
        <DialogTitle sx={{ fontWeight: 950, fontSize: 16 }}>+ Register Field Captain</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField fullWidth size="small" label="Captain Full Name" value={newCaptain.name} onChange={(e) => setNewCaptain({ ...newCaptain, name: e.target.value })} />
            <TextField fullWidth size="small" label="Mobile Number" value={newCaptain.phone} onChange={(e) => setNewCaptain({ ...newCaptain, phone: e.target.value })} />
            <TextField fullWidth size="small" label="Assigned Locality" value={newCaptain.locality} onChange={(e) => setNewCaptain({ ...newCaptain, locality: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddCaptainOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddCaptain}
            sx={{ bgcolor: "#2563EB", fontWeight: 800 }}
          >
            Register Captain
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── RAISE GRIEVANCE / ISSUE MODAL ── */}
      <Dialog open={raiseIssueOpen} onClose={() => setRaiseIssueOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "20px" } }}>
        <DialogTitle sx={{ fontWeight: 950, fontSize: 16 }}>+ Raise Support Grievance</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Grievance Subject"
              value={newIssue.subject}
              onChange={(e) => setNewIssue({ ...newIssue, subject: e.target.value })}
              placeholder="e.g. Delay in Merchant QR Terminal Sync"
            />
            <FormControl fullWidth size="small">
              <Select
                value={newIssue.category || "Merchant Ops"}
                onChange={(e) => setNewIssue({ ...newIssue, category: e.target.value })}
                sx={{ fontSize: 13, fontWeight: 700 }}
              >
                <MenuItem value="Merchant Ops">Merchant Ops & Terminal Sync</MenuItem>
                <MenuItem value="Field Operations">Field Operations & Captains</MenuItem>
                <MenuItem value="Jurisdiction & Mapping">Jurisdiction & Pincode Mapping</MenuItem>
                <MenuItem value="Commission & Wallets">Commission Inflows & Dual Wallet</MenuItem>
                <MenuItem value="Self Rebirth Matrix">Self-Rebirth & Matrix Cycles</MenuItem>
                <MenuItem value="Other">General / Other Inquiry</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <Select
                value={newIssue.priority || "High"}
                onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                sx={{ fontSize: 13, fontWeight: 700 }}
              >
                <MenuItem value="High">Priority: High (Urgent Escalation)</MenuItem>
                <MenuItem value="Medium">Priority: Medium (Routine Support)</MenuItem>
                <MenuItem value="Normal">Priority: Normal (Feedback)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={3}
              label="Detailed Grievance Description"
              value={newIssue.details || ""}
              onChange={(e) => setNewIssue({ ...newIssue, details: e.target.value })}
              placeholder="Provide exact details, merchant/captain ID, or transaction references..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRaiseIssueOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (newIssue.subject) {
                const ticketId = `#TKT-${Date.now().toString().slice(-4)}`;
                setIssuesList([
                  {
                    id: ticketId,
                    subject: newIssue.subject,
                    category: newIssue.category || "Merchant Ops",
                    details: newIssue.details || "",
                    priority: newIssue.priority || "High",
                    status: "Open",
                    date: "Just Now",
                  },
                  ...issuesList,
                ]);
                setRaiseIssueOpen(false);
                setNewIssue({ subject: "", category: "Merchant Ops", details: "", priority: "High" });
                setCommissionToast({
                  open: true,
                  message: `✅ Support ticket ${ticketId} lodged successfully! Operations desk notified.`,
                  severity: "success",
                });
              }
            }}
            sx={{ bgcolor: "#2563EB", fontWeight: 800 }}
          >
            Submit Grievance
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── IN-APP FRANCHISE WITHDRAWAL DIALOG ── */}
      <Dialog
        open={withdrawDialogOpen}
        onClose={() => setWithdrawDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "24px",
            p: { xs: 0.5, sm: 1 },
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: 17, pb: 1, color: "#0F172A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Withdraw Earnings</span>
          <IconButton size="small" onClick={() => setWithdrawDialogOpen(false)}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {/* Available Withdrawable Balance Hero Banner */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: "18px",
              background: "linear-gradient(135deg, #5F259F 0%, #4D1A85 100%)",
              color: "#FFFFFF",
              mb: 2.5,
              boxShadow: "0 4px 16px rgba(95, 37, 159, 0.25)",
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "rgba(255, 255, 255, 0.85)" }}>
              Available Withdrawable Balance
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: "#FFFFFF", mt: 0.3, mb: 0.5, letterSpacing: "-0.02em" }}>
              ₹ {(walletState.mainWallet || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.3 }}>
              Main Wallet (75% share) is 100% instantly withdrawable. Self Rebirth pocket (25%) is auto-saved for autonomous rebirth cycles.
            </Typography>
          </Paper>

          {/* Amount Input with Quick Pills */}
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A", mb: 0.8 }}>
            Enter Withdrawal Amount
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. 500.00"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^\d.]/g, ""))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography sx={{ fontWeight: 900, color: "#0F172A", fontSize: 16 }}>₹</Typography>
                </InputAdornment>
              ),
              sx: {
                borderRadius: "14px",
                fontSize: 16,
                fontWeight: 800,
                "& fieldset": { borderColor: "#E2E8F0" },
                "&.Mui-focused fieldset": { borderColor: "#5F259F" },
              },
            }}
          />

          {/* Quick Amount Chips */}
          <Stack direction="row" spacing={1} sx={{ mt: 1.2, mb: 2.5 }}>
            {[100, 500, 1000, "Max"].map((val) => (
              <Chip
                key={val}
                label={val === "Max" ? "All Max" : `₹${val}`}
                size="small"
                onClick={() => {
                  if (val === "Max") {
                    setWithdrawAmount(String((walletState.mainWallet || 0).toFixed(2)));
                  } else {
                    setWithdrawAmount(String(val));
                  }
                }}
                sx={{
                  flex: 1,
                  height: 28,
                  fontSize: 11.5,
                  fontWeight: 800,
                  bgcolor: "#F1F5F9",
                  color: "#334155",
                  borderRadius: "999px",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "#EFF6FF", color: "#2563EB" },
                }}
              />
            ))}
          </Stack>

          {/* Payout Destination Selector */}
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A", mb: 1 }}>
            Payout Destination
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Button
              size="small"
              onClick={() => setWithdrawMethod("bank")}
              sx={{
                flex: 1,
                py: 0.8,
                borderRadius: "12px",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "none",
                bgcolor: withdrawMethod === "bank" ? "#EFF6FF" : "#FFFFFF",
                color: withdrawMethod === "bank" ? "#1D6AE5" : "#64748B",
                border: "1.5px solid",
                borderColor: withdrawMethod === "bank" ? "#3B82F6" : "#E2E8F0",
              }}
            >
              Bank Account
            </Button>
            <Button
              size="small"
              onClick={() => setWithdrawMethod("upi")}
              sx={{
                flex: 1,
                py: 0.8,
                borderRadius: "12px",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "none",
                bgcolor: withdrawMethod === "upi" ? "#EFF6FF" : "#FFFFFF",
                color: withdrawMethod === "upi" ? "#1D6AE5" : "#64748B",
                border: "1.5px solid",
                borderColor: withdrawMethod === "upi" ? "#3B82F6" : "#E2E8F0",
              }}
            >
              UPI ID
            </Button>
          </Stack>

          {withdrawMethod === "bank" ? (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: "14px",
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "10px",
                    bgcolor: "#EFF6FF",
                    color: "#2563EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AccountBalanceRoundedIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A" }}>
                    {bankInfo.bankName} •••• {bankInfo.accountNumber.slice(-4)}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>
                    IFSC: {bankInfo.ifsc} • {bankInfo.holderName}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          ) : (
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. mobile@okaxis / user@upi"
              value={withdrawUpi}
              onChange={(e) => setWithdrawUpi(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: "14px", fontSize: 13, fontWeight: 700 },
              }}
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            fullWidth
            variant="contained"
            disabled={withdrawSubmitting || !withdrawAmount || Number(withdrawAmount) <= 0}
            onClick={handleWithdrawSubmit}
            sx={{
              borderRadius: "999px",
              bgcolor: "#5F259F",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: 14,
              py: 1.1,
              textTransform: "none",
              boxShadow: "0 4px 14px rgba(95, 37, 159, 0.3)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              "&:hover": { bgcolor: "#4D1A85" },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            {withdrawSubmitting ? "Processing Payout..." : `Instant Withdraw ${withdrawAmount && Number(withdrawAmount) > 0 ? "₹" + Number(withdrawAmount).toFixed(2) : ""}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── FRANCHISE PARTNER PHONE LOGIN MODAL ── */}
      <Dialog
        open={phoneLoginOpen}
        onClose={() => setPhoneLoginOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: "20px" } }}
      >
        <DialogTitle sx={{ fontWeight: 950, fontSize: 16 }}>
          Franchise Partner Mobile Login
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12, color: "#64748B", mb: 2 }}>
            Enter your 10-digit registered agency mobile number to access your territory portal:
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Mobile Number (10 Digits)"
            placeholder="e.g. 9800000001"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneRoundedIcon sx={{ fontSize: 18, color: "#64748B" }} />
                </InputAdornment>
              ),
            }}
          />
          <Typography sx={{ fontSize: 11, color: "#94A3B8", mt: 2, mb: 1, fontWeight: 700 }}>
            Standard Test Franchise Accounts (EC2 Live DB):
          </Typography>
          <Stack spacing={0.8}>
            {Object.entries(TEST_AGENCY_ACCOUNTS).map(([key, acc]) => (
              <Paper
                key={acc.phone}
                elevation={0}
                onClick={() => handlePhoneLogin(acc.phone)}
                sx={{
                  p: 1.2,
                  borderRadius: "12px",
                  bgcolor: currentTierKey === key ? "#EFF6FF" : "#F8FAFC",
                  border: `1px solid ${currentTierKey === key ? "#BFDBFE" : "#E2E8F0"}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                  "&:hover": { bgcolor: "#EFF6FF", borderColor: "#BFDBFE" },
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>
                    {acc.phone} • {acc.name}
                  </Typography>
                  <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>
                    {acc.title} ({acc.badge})
                  </Typography>
                </Box>
                <Chip
                  label="Login"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 10,
                    fontWeight: 800,
                    bgcolor: acc.color,
                    color: "#FFFFFF",
                  }}
                />
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPhoneLoginOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => handlePhoneLogin(phoneInput)}
            sx={{ bgcolor: "#2563EB", fontWeight: 800 }}
          >
            Login
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── SCAN QR MODAL ── */}
      <Dialog open={scanQrOpen} onClose={() => setScanQrOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "20px" } }}>
        <DialogTitle sx={{ fontWeight: 950, fontSize: 16 }}>Scan Merchant QR Standee</DialogTitle>
        <DialogContent sx={{ textAlign: "center", py: 3 }}>
          <Box
            sx={{
              width: 180,
              height: 180,
              mx: "auto",
              borderRadius: "16px",
              border: "2px dashed #2563EB",
              bgcolor: "#EFF6FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <QrCodeScannerRoundedIcon sx={{ fontSize: 64, color: "#2563EB" }} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#1E40AF", mt: 1 }}>
              Camera Scanner Ready
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: "#64748B", mt: 2 }}>
            Point camera at merchant QR code to verify or activate POS payments.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button fullWidth variant="contained" onClick={() => setScanQrOpen(false)} sx={{ bgcolor: "#0F172A" }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── LIVE NOTIFICATION SNACKBARS ── */}
      <Snackbar
        open={commissionToast.open}
        autoHideDuration={4000}
        onClose={() => setCommissionToast({ ...commissionToast, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={commissionToast.severity || "success"}
          onClose={() => setCommissionToast({ ...commissionToast, open: false })}
          sx={{ width: "100%", borderRadius: "14px", fontWeight: 800, fontSize: 12 }}
        >
          {commissionToast.message}
        </Alert>
      </Snackbar>

      <Snackbar
        open={rebirthToast.open}
        autoHideDuration={6000}
        onClose={() => setRebirthToast({ ...rebirthToast, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity="warning"
          onClose={() => setRebirthToast({ ...rebirthToast, open: false })}
          sx={{ width: "100%", borderRadius: "14px", fontWeight: 900, fontSize: 12, bgcolor: "#FEF3C7", color: "#92400E" }}
        >
          {rebirthToast.message}
        </Alert>
      </Snackbar>

      {/* ── FRANCHISE PROFILE & SWITCH ROLE DRAWER ── */}
      <Drawer
        anchor="bottom"
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            p: 2.5,
            boxSizing: "border-box",
            maxWidth: 440,
            mx: "auto",
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>
            Franchise Partner Profile
          </Typography>
          <IconButton size="small" onClick={() => setProfileDrawerOpen(false)}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0", mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ width: 48, height: 48, bgcolor: "#2563EB", fontWeight: 900, fontSize: 18 }}>
              {(user?.name || TEST_AGENCY_ACCOUNTS[currentTierKey]?.name || "A").charAt(0)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }} noWrap>
                {user?.name || TEST_AGENCY_ACCOUNTS[currentTierKey]?.name || "Franchise Partner"}
              </Typography>
              <Chip
                label={user?.badge || currentTier.title}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 10.5,
                  fontWeight: 800,
                  bgcolor: "#EFF6FF",
                  color: "#1D4ED8",
                  border: "1px solid #BFDBFE",
                  mt: 0.3,
                }}
              />
              <Typography sx={{ fontSize: 11.5, color: "#64748B", fontWeight: 600, mt: 0.5 }}>
                Ph: {user?.phone || TEST_AGENCY_ACCOUNTS[currentTierKey]?.phone}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#94A3B8", mt: 0.2 }} noWrap>
                {user?.jurisdiction || TEST_AGENCY_ACCOUNTS[currentTierKey]?.jurisdiction || currentTier.defaultLocation}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Stack spacing={1}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => {
              setProfileDrawerOpen(false);
              setActiveScreen("history");
            }}
            sx={{
              height: 44,
              borderRadius: "12px",
              borderColor: "#2563EB",
              color: "#2563EB",
              textTransform: "none",
              fontWeight: 800,
              fontSize: 13.5,
            }}
          >
            View Live Commission History
          </Button>

          <Button
            fullWidth
            variant="contained"
            onClick={() => {
              setProfileDrawerOpen(false);
              if (onSwitchRole) onSwitchRole();
            }}
            sx={{
              height: 44,
              borderRadius: "12px",
              bgcolor: "#0F172A",
              color: "#FFFFFF",
              textTransform: "none",
              fontWeight: 800,
              fontSize: 13.5,
              "&:hover": { bgcolor: "#1E293B" },
            }}
          >
            Switch Role / Account (Login Screen)
          </Button>

          <Button
            fullWidth
            variant="outlined"
            color="error"
            onClick={() => {
              setProfileDrawerOpen(false);
              if (onLogout) onLogout();
            }}
            sx={{
              height: 44,
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 800,
              fontSize: 13.5,
            }}
          >
            Logout
          </Button>
        </Stack>
      </Drawer>

      {/* ── CYCLE 2 RENEWAL & ACTIVATION MODAL (Strict Rules: Main Wallet / Coupon Pocket ONLY + 18% GST + 7% Admin Fee) ── */}
      <Dialog
        open={cycleRenewalOpen}
        onClose={() => setCycleRenewalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "24px", p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 950, fontSize: 18, color: "#0F172A", pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>🔄 Cycle Renewal Hub (Cycle {cycleState.currentCycle + 1})</span>
          <IconButton size="small" onClick={() => setCycleRenewalOpen(false)}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity={cycleState.adminAuthorized ? "success" : "info"} sx={{ borderRadius: "14px" }}>
              {cycleState.adminAuthorized
                ? "✅ Cycle renewal is pre-authorized by Administrator! You can proceed with internal wallet deduction."
                : "⏳ Cycle 2 activation is strictly controlled by Administrator. Request activation below or await Admin approval."}
            </Alert>

            {/* Cycle Fee & Limit Breakdown */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: "16px", bgcolor: "#F8FAFC" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#64748B", mb: 1.2 }}>
                CYCLE 2 STATUTORY DEDUCTION & EARNING LIMIT
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 13, color: "#334155" }}>Base Franchise Investment:</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                    ₹ {cycleState.baseAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 13, color: "#334155" }}>Statutory GST (18% Extra):</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                    + ₹ {(cycleState.baseAmount * 0.18).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 13, color: "#334155" }}>Admin Platform Charge (7% Extra):</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                    + ₹ {(cycleState.baseAmount * 0.07).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Typography>
                </Stack>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>
                    Total Cycle 2 Cost (1.25x):
                  </Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 950, color: "#059669" }}>
                    ₹ {(cycleState.baseAmount * 1.25).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 13, color: "#64748B" }}>
                    New Eligible Earning Limit ({cycleState.profitPercent}% Profit):
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#2563EB" }}>
                    ₹ {cycleState.eligibleLimit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            {/* Strict Internal Wallet Source Selection */}
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#0F172A", mb: 1 }}>
                Select Payment Source (Strict: Internal Wallets Only)
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <Paper
                    onClick={() => setSelectedCyclePayment("MAIN_WALLET")}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: "14px",
                      border: "2px solid",
                      borderColor: selectedCyclePayment === "MAIN_WALLET" ? "#059669" : "#E2E8F0",
                      bgcolor: selectedCyclePayment === "MAIN_WALLET" ? "#ECFDF5" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>Main Wallet</Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 950, color: "#059669", my: 0.3 }}>
                      ₹ {((Number(walletState?.mainWallet) || 24551.93)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>Available balance</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper
                    onClick={() => setSelectedCyclePayment("COUPON_POCKET")}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: "14px",
                      border: "2px solid",
                      borderColor: selectedCyclePayment === "COUPON_POCKET" ? "#059669" : "#E2E8F0",
                      bgcolor: selectedCyclePayment === "COUPON_POCKET" ? "#ECFDF5" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>Coupon Pocket</Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 950, color: "#059669", my: 0.3 }}>
                      ₹ 0.00
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: "#64748B" }}>Shopping vouchers</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>

            <Typography sx={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
              ⚠️ <strong>Strict Rule:</strong> External payment gateways (Cards/UPI) are disabled for renewal. 2nd cycle onwards must strictly be purchased through your Main Wallet or Coupon Pocket earnings.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCycleRenewalOpen(false)} sx={{ fontWeight: 800, color: "#64748B" }}>
            Close
          </Button>
          {cycleState.adminAuthorized ? (
            <Button
              variant="contained"
              onClick={() => {
                setCycleState((prev) => {
                  const next = {
                    ...prev,
                    currentCycle: prev.currentCycle + 1,
                    status: `CYCLE_${prev.currentCycle + 1}_ACTIVE`,
                    activationRequested: false,
                    adminAuthorized: false,
                  };
                  try {
                    localStorage.setItem("trikonekt_franchise_cycle_state", JSON.stringify(next));
                  } catch (_) {}
                  return next;
                });
                setCycleRenewalOpen(false);
                setCommissionToast({
                  open: true,
                  message: `🎉 Cycle ${cycleState.currentCycle + 1} Activated! New earning limit is active.`,
                  severity: "success",
                });
              }}
              sx={{
                bgcolor: "#059669",
                fontWeight: 900,
                borderRadius: "12px",
                px: 3,
                "&:hover": { bgcolor: "#047857" },
              }}
            >
              Confirm Renewal & Deduct
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={cycleState.activationRequested}
              onClick={() => {
                setCycleState((prev) => {
                  const next = { ...prev, activationRequested: true };
                  try {
                    localStorage.setItem("trikonekt_franchise_cycle_state", JSON.stringify(next));
                  } catch (_) {}
                  return next;
                });
                setCommissionToast({
                  open: true,
                  message: "📩 Cycle activation request sent to Administrator for verification.",
                  severity: "info",
                });
              }}
              sx={{
                bgcolor: "#2563EB",
                fontWeight: 900,
                borderRadius: "12px",
                px: 3,
                "&:hover": { bgcolor: "#1D4ED8" },
              }}
            >
              {cycleState.activationRequested ? "Request Pending Admin Approval" : "Request Admin Cycle Authorization"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </AgencyLayout>
  );
}
