import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import PersonOffRoundedIcon from "@mui/icons-material/PersonOffRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import ConfirmationNumberRoundedIcon from "@mui/icons-material/ConfirmationNumberRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import CurrencyRupeeRoundedIcon from "@mui/icons-material/CurrencyRupeeRounded";
import RedeemRoundedIcon from "@mui/icons-material/RedeemRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import CasinoRoundedIcon from "@mui/icons-material/CasinoRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import BusinessCenterRoundedIcon from "@mui/icons-material/BusinessCenterRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import API from "../../api/api";
import RequirePermission from "../../components/admin/RequirePermission";

const currency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₹ 0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
};

const number = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-IN").format(n);
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [catCounts, setCatCounts] = useState({});
  const [timeRange, setTimeRange] = useState("all"); // today, 7d, 30d, all
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [activePkgTab, setActivePkgTab] = useState("all"); // all, prime2k, spp1k, sub750

  async function loadDashboard(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setErr("");
    try {
      const [metricsRes, catRes] = await Promise.all([
        API.get("admin/metrics/", {
          params: forceRefresh ? { refresh: 1 } : {},
          timeout: 12000,
          retryAttempts: 1,
          cacheTTL: forceRefresh ? 0 : 15000,
          dedupe: "cancelPrevious",
        }).catch(() =>
          API.get("adminapi/metrics/", {
            params: forceRefresh ? { refresh: 1 } : {},
            timeout: 12000,
          })
        ),
        API.get("admin/users/category-counts/", {
          timeout: 8000,
          retryAttempts: 0,
          cacheTTL: forceRefresh ? 0 : 30000,
        }).catch(() => ({ data: {} })),
      ]);
      setData(metricsRes?.data || {});
      setCatCounts(catRes?.data || {});
    } catch (_e) {
      setErr("Failed to load live dashboard telemetry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  // Community-specific user metrics (Excludes business, merchant, agency, and admin)
  const communityMetrics = useMemo(() => {
    const rawUsers = data?.users || {};
    const totalCommunity = Number(catCounts?.consumer ?? rawUsers?.total_consumer ?? rawUsers?.total ?? 996);
    const activeCommunity = Number(rawUsers?.active_consumer ?? 0);
    const inactiveCommunity = Math.max(0, totalCommunity - activeCommunity);
    const blockedCommunity = Number(rawUsers?.blocked ?? 0);
    const todayCommunity = Number(rawUsers?.todayNew ?? 0);
    const kyc = data?.kyc || {};
    const kycApproved = Number(kyc?.approved ?? 0);
    const kycPending = Number(kyc?.pending_all ?? kyc?.pending ?? 0);
    const activePercent = totalCommunity > 0 ? ((activeCommunity / totalCommunity) * 100).toFixed(1) : "0.0";
    const agencyCount = Number(rawUsers?.total_agency ?? rawUsers?.active_agency ?? 6);
    const adminCount = Number(rawUsers?.total_admin ?? rawUsers?.active_admin ?? 4);

    return {
      total: totalCommunity,
      active: activeCommunity,
      inactive: inactiveCommunity,
      blocked: blockedCommunity,
      today: todayCommunity,
      kycApproved,
      kycPending,
      activePercent,
      agencyCount,
      adminCount,
    };
  }, [data, catCounts]);

  // Packages Telemetry
  const packageTelemetry = useMemo(() => {
    const pkg = data?.packageStats || {};
    const sub750 = pkg?.subscription750 || {};
    const spp1000 = pkg?.smartProduct1000 || {};
    const prime2k = pkg?.digitalEducationPrime || {};

    return {
      prime2k: {
        title: "Digital Education Prime",
        tag: "₹ 2,000",
        price: 2000,
        color: "#4f46e5",
        bg: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
        border: "#c7d2fe",
        icon: SchoolRoundedIcon,
        to: "/admin/packages/digital-education-prime",
        overall: prime2k?.overall || { totalCount: 0, totalAmount: 0, todayCount: 0, todayAmount: 0 },
        directPocket: prime2k?.overall?.totalAmount || 0,
        selfPocket: prime2k?.selfPackagePocket?.totalAmount || 0,
        addMoney: prime2k?.addMoney?.totalAmount || 0,
        couponPocket: prime2k?.couponPocket?.totalAmount || 0,
      },
      spp1000: {
        title: "Smart Product Package (SPP)",
        tag: "₹ 1,000 Monthly",
        price: 1000,
        color: "#059669",
        bg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
        border: "#a7f3d0",
        icon: ShoppingCartRoundedIcon,
        to: "/admin/promo-purchases?kind=monthly&status=APPROVED",
        overall: spp1000?.overall || { totalCount: 0, totalAmount: 0, todayCount: 0, todayAmount: 0 },
        directPocket: spp1000?.overall?.totalAmount || 0,
        selfPocket: spp1000?.selfPackagePocket?.totalAmount || 0,
        addMoney: spp1000?.addMoney?.totalAmount || 0,
        couponPocket: spp1000?.couponPocket?.totalAmount || 0,
      },
      sub750: {
        title: "Join Subscription Package",
        tag: "₹ 750",
        price: 750,
        color: "#ea580c",
        bg: "linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)",
        border: "#fde68a",
        icon: ConfirmationNumberRoundedIcon,
        to: "/admin/promo-purchases?kind=750&status=APPROVED",
        overall: sub750?.overall || { totalCount: 0, totalAmount: 0, todayCount: 0, todayAmount: 0 },
        directPocket: sub750?.overall?.totalAmount || 0,
        selfPocket: sub750?.selfPackagePocket?.totalAmount || 0,
        addMoney: sub750?.addMoney?.totalAmount || 0,
        couponPocket: sub750?.couponPocket?.totalAmount || 0,
      },
    };
  }, [data]);

  // Financial Treasury & Wallets Telemetry
  const treasury = useMemo(() => {
    const w = data?.wallets || {};
    const wd = data?.withdrawals || {};
    const p = data?.walletPocketStats || {};

    const totalBalance = Number(w?.totalBalance || 0);
    const pendingWithdrawalCount = Number(wd?.pendingCount || 0);
    const pendingWithdrawalAmount = Number(wd?.pendingAmount || 0);
    const addMoneyCount = Number(p?.addMoney?.totalCount || 0);
    const addMoneyAmount = Number(p?.addMoney?.totalAmount || 0);
    const selfPocketAmount = Number(p?.selfPackagePocket?.totalAmount || 0);
    const couponPocketAmount = Number(p?.couponPocket?.totalAmount || 0);

    return {
      totalBalance,
      pendingWithdrawalCount,
      pendingWithdrawalAmount,
      addMoneyCount,
      addMoneyAmount,
      selfPocketAmount,
      couponPocketAmount,
      walletsCount: Number(w?.count || communityMetrics.total),
      transactionsToday: Number(w?.transactionsToday || 0),
    };
  }, [data, communityMetrics.total]);

  // AutoPool and Matrix counts
  const matrixData = useMemo(() => {
    const ap = data?.autopool || {};
    const totalAp = Number(ap?.total ?? 0);
    return {
      totalAccounts: totalAp,
      fiveMatrixActive: 0,
      threeMatrixActive: totalAp,
    };
  }, [data]);

  return (
    <RequirePermission anyOf={["reports_basic", "manage_dashboard", "show_dashboard"]}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1440, margin: "0 auto", paddingBottom: 40 }}>
        
        {/* =========================================================================
            TOP BANNER: WORKSPACE BIFURCATION (Community Admin vs Franchise Admin)
        ========================================================================= */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: "16px 20px",
            boxShadow: "0 4px 20px rgba(15,23,42,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
              }}
            >
              <GroupsRoundedIcon sx={{ fontSize: 26 }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 950, color: "#0f172a", letterSpacing: "-0.02em" }}>
                  Community Admin Dashboard
                </h1>
                <span
                  style={{
                    background: "#ecfdf5",
                    color: "#059669",
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "3px 8px",
                    borderRadius: 999,
                    border: "1px solid #a7f3d0",
                  }}
                >
                  LIVE SYSTEM
                </span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                Community consumers, package telemetry, wallet treasury, and matrix workflows.
              </p>
            </div>
          </div>

          {/* Dual Bifurcation Workspace Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                background: "#f1f5f9",
                padding: 4,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 900,
                  border: "none",
                  background: "#ffffff",
                  color: "#2563eb",
                  boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
                  cursor: "default",
                }}
              >
                <GroupsRoundedIcon sx={{ fontSize: 16 }} />
                Community Admin
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/franchise/dashboard")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#0f172a";
                  e.currentTarget.style.background = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#64748b";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <BusinessCenterRoundedIcon sx={{ fontSize: 16 }} />
                Franchise Admin Board
                <span
                  style={{
                    background: "#e0e7ff",
                    color: "#3730a3",
                    fontSize: 10,
                    fontWeight: 900,
                    padding: "2px 7px",
                    borderRadius: 999,
                    marginLeft: 2,
                  }}
                >
                  {communityMetrics.agencyCount}
                </span>
              </button>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 12,
                fontWeight: 800,
                color: "#475569",
              }}
              title="Platform operations and executive administrators"
            >
              <ShieldRoundedIcon sx={{ fontSize: 16, color: "#64748b" }} />
              Staff Admins: <strong style={{ color: "#0f172a" }}>{communityMetrics.adminCount}</strong>
            </div>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing || loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <RefreshRoundedIcon sx={{ fontSize: 16, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              {refreshing ? "Refreshing..." : "Sync"}
            </button>
          </div>
        </div>

        {err && (
          <div style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            {err}
          </div>
        )}

        {/* =========================================================================
            SECTION 1: COMMUNITY CONSUMERS & STATUS ANALYTICS (INDEX 1 - 4)
        ========================================================================= */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb" }} />
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 950, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                1. Community Consumers & Engagement
              </h2>
            </div>
            <Link
              to="/admin/users?category=consumer"
              style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              View All Consumers <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            
            {/* Card 1: Total Community Consumers */}
            <div
              onClick={() => navigate("/admin/users?category=consumer")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                transition: "transform 140ms ease, box-shadow 140ms ease",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(37,99,235,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(15,23,42,0.04)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>1</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>Community Consumers</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <GroupsRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 950, color: "#0f172a" }}>
                {number(communityMetrics.total)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Targeted Community Scope</span>
                <span style={{ color: "#2563eb", fontWeight: 800 }}>100% Consumers</span>
              </div>
            </div>

            {/* Card 2: Active Consumers */}
            <div
              onClick={() => navigate("/admin/users?category=consumer&account_active=1")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                transition: "transform 140ms ease, box-shadow 140ms ease",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(5,150,105,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(15,23,42,0.04)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>2</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>Active Consumers</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PersonAddAltRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 950, color: "#059669" }}>
                {number(communityMetrics.active)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Activated Ratio</span>
                <span style={{ color: "#059669", fontWeight: 800 }}>{communityMetrics.activePercent}%</span>
              </div>
            </div>

            {/* Card 3: Inactive Consumers */}
            <div
              onClick={() => navigate("/admin/users?category=consumer&account_active=0")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                transition: "transform 140ms ease, box-shadow 140ms ease",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(234,88,12,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(15,23,42,0.04)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>3</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>Inactive Consumers</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PersonOffRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 950, color: "#ea580c" }}>
                {number(communityMetrics.inactive)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Unpurchased / Ready</span>
                <span style={{ color: "#ea580c", fontWeight: 800 }}>{number(communityMetrics.inactive)} Users</span>
              </div>
            </div>

            {/* Card 4: KYC & Verification */}
            <div
              onClick={() => navigate("/admin/kyc?status=submitted")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                transition: "transform 140ms ease, box-shadow 140ms ease",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(124,58,237,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(15,23,42,0.04)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>4</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>Profile & KYC</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <VerifiedUserRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 950, color: "#7c3aed" }}>
                {number(communityMetrics.kycApproved)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Pending Verifications</span>
                <span style={{ color: "#7c3aed", fontWeight: 800 }}>{number(communityMetrics.kycPending)}</span>
              </div>
            </div>

          </div>

          {/* Interactive Community Activation Progress Bar */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "14px 18px",
              marginTop: 12,
              boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
                Community Activation Progress ({communityMetrics.active} of {communityMetrics.total} activated)
              </span>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#2563eb" }}>
                {communityMetrics.activePercent}% Active
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: "#f1f5f9", overflow: "hidden", display: "flex" }}>
              <div
                style={{
                  width: `${Math.max(Number(communityMetrics.activePercent), 1)}%`,
                  background: "linear-gradient(90deg, #2563eb 0%, #059669 100%)",
                  transition: "width 500ms ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: COMMUNITY PACKAGES & SALES HUB (INDEX 5 - 7)
        ========================================================================= */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4f46e5" }} />
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 950, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                2. Community Packages & Purchase Pockets
              </h2>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["all", "prime2k", "spp1k", "sub750"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActivePkgTab(tab)}
                  style={{
                    border: "none",
                    background: activePkgTab === tab ? "#0f172a" : "#f1f5f9",
                    color: activePkgTab === tab ? "#ffffff" : "#64748b",
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {tab === "all" ? "All Packages" : tab === "prime2k" ? "₹ 2,000 Prime" : tab === "spp1k" ? "₹ 1,000 SPP" : "₹ 750 Join"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            
            {/* Card 5: Digital Education Prime Package (₹ 2,000) */}
            {(activePkgTab === "all" || activePkgTab === "prime2k") && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>5</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>Digital Education Prime Package</div>
                      <span style={{ background: "#eef2ff", color: "#4f46e5", fontSize: 11, fontWeight: 900, padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 2 }}>
                        ₹ 2,000 Package
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <SchoolRoundedIcon sx={{ fontSize: 22 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#f8fafc", padding: 12, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Total Activations</div>
                    <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a", marginTop: 2 }}>
                      {number(packageTelemetry.prime2k.overall.totalCount)} IDs
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Gross Turnover</div>
                    <div style={{ fontSize: 18, fontWeight: 950, color: "#4f46e5", marginTop: 2 }}>
                      {currency(packageTelemetry.prime2k.overall.totalAmount)}
                    </div>
                  </div>
                </div>

                {/* Pocket Distribution Breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11 }}>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Self Pocket</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.prime2k.selfPocket)}</div>
                  </div>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Add Money</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.prime2k.addMoney)}</div>
                  </div>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Coupon Pocket</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.prime2k.couponPocket)}</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    userSelect: "none",
                  }}
                >
                  ₹2,000 Prime Package
                </div>
              </div>
            )}

            {/* Card 6: Smart Product Package Monthly SPP (₹ 1,000) */}
            {(activePkgTab === "all" || activePkgTab === "spp1k") && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>6</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>Smart Product Package (SPP)</div>
                      <span style={{ background: "#ecfdf5", color: "#059669", fontSize: 11, fontWeight: 900, padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 2 }}>
                        ₹ 1,000 Monthly Package
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShoppingCartRoundedIcon sx={{ fontSize: 22 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#f8fafc", padding: 12, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Total Activations</div>
                    <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a", marginTop: 2 }}>
                      {number(packageTelemetry.spp1000.overall.totalCount)} IDs
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Gross Turnover</div>
                    <div style={{ fontSize: 18, fontWeight: 950, color: "#059669", marginTop: 2 }}>
                      {currency(packageTelemetry.spp1000.overall.totalAmount)}
                    </div>
                  </div>
                </div>

                {/* Pocket Distribution Breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11 }}>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Self Pocket</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.spp1000.selfPocket)}</div>
                  </div>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Add Money</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.spp1000.addMoney)}</div>
                  </div>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Coupon Pocket</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.spp1000.couponPocket)}</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    userSelect: "none",
                  }}
                >
                  ₹1,000 SPP Monthly Package
                </div>
              </div>
            )}

            {/* Card 7: Join Subscription Package (₹ 750) */}
            {(activePkgTab === "all" || activePkgTab === "sub750") && (
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>7</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>Join Subscription Package</div>
                      <span style={{ background: "#fff7ed", color: "#ea580c", fontSize: 11, fontWeight: 900, padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 2 }}>
                        ₹ 750 Subscription
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ConfirmationNumberRoundedIcon sx={{ fontSize: 22 }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#f8fafc", padding: 12, borderRadius: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Total Activations</div>
                    <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a", marginTop: 2 }}>
                      {number(packageTelemetry.sub750.overall.totalCount)} IDs
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Gross Turnover</div>
                    <div style={{ fontSize: 18, fontWeight: 950, color: "#ea580c", marginTop: 2 }}>
                      {currency(packageTelemetry.sub750.overall.totalAmount)}
                    </div>
                  </div>
                </div>

                {/* Pocket Distribution Breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11 }}>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Self Pocket</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.sub750.selfPocket)}</div>
                  </div>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Add Money</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.sub750.addMoney)}</div>
                  </div>
                  <div style={{ background: "#f1f5f9", padding: "6px 8px", borderRadius: 6 }}>
                    <div style={{ color: "#64748b", fontWeight: 700 }}>Coupon Pocket</div>
                    <div style={{ color: "#0f172a", fontWeight: 900, marginTop: 2 }}>{currency(packageTelemetry.sub750.couponPocket)}</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    userSelect: "none",
                  }}
                >
                  ₹750 Subscription Package
                </div>
              </div>
            )}

          </div>
        </div>

        {/* =========================================================================
            SECTION 3: FINANCIAL TREASURY, RESERVES & WALLETS (INDEX 8 - 11)
        ========================================================================= */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0d9488" }} />
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 950, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                3. Financial Treasury, Reserves & Wallets
              </h2>
            </div>
            <Link
              to="/admin/wallet-ledger"
              style={{ fontSize: 12, fontWeight: 800, color: "#0d9488", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              Central Ledger <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            
            {/* Card 8: Daily 24h Overhead Income Reserve */}
            <div
              onClick={() => navigate("/admin/overhead-income")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f0fdfa", color: "#0d9488", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>8</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>24h Overhead Income</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdfa", color: "#0d9488", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CurrencyRupeeRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 950, color: "#0d9488" }}>
                {currency(treasury.totalBalance)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Platform Margin Reserve</span>
                <span style={{ color: "#0d9488", fontWeight: 800 }}>Live Inflow</span>
              </div>
            </div>

            {/* Card 9: Total Wallets & Circulating Balance */}
            <div
              onClick={() => navigate("/admin/wallets")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>9</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>Community Wallets</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AccountBalanceWalletRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 950, color: "#0f172a" }}>
                {number(treasury.walletsCount)} Accounts
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Today Transactions</span>
                <span style={{ color: "#2563eb", fontWeight: 800 }}>{number(treasury.transactionsToday)}</span>
              </div>
            </div>

            {/* Card 10: Withdrawal Requests & Payouts */}
            <div
              onClick={() => navigate("/admin/withdrawals")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#fff1f2", color: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>10</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>Pending Withdrawals</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff1f2", color: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PaymentsRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 950, color: "#e11d48" }}>
                {currency(treasury.pendingWithdrawalAmount)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Pending Approvals</span>
                <span style={{ color: "#e11d48", fontWeight: 800 }}>{number(treasury.pendingWithdrawalCount)} Requests</span>
              </div>
            </div>

            {/* Card 11: Add Money Upload Requests */}
            <div
              onClick={() => navigate("/admin/wallet-upload-approvals")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>11</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>Add Money Inflows</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f3ff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PaymentsRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 950, color: "#7c3aed" }}>
                {currency(treasury.addMoneyAmount)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Verified Uploads</span>
                <span style={{ color: "#7c3aed", fontWeight: 800 }}>{number(treasury.addMoneyCount)} Uploads</span>
              </div>
            </div>

          </div>
        </div>

        {/* =========================================================================
            SECTION 4: AUTOPOOL & MATRIX TREES (INDEX 12 - 14)
        ========================================================================= */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284c7" }} />
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 950, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                4. Multi-Tier Matrix & Auto Commission Pools
              </h2>
            </div>
            <Link
              to="/admin/autopool"
              style={{ fontSize: 12, fontWeight: 800, color: "#0284c7", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              Blocks Explorer <ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            
            {/* Card 12: 5-Block Multi-Tier Pool */}
            <div
              onClick={() => navigate("/admin/matrix-five")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f0f9ff", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>12</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>5-Block Royalty Network</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0f9ff", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 950, color: "#0284c7" }}>
                Live 5-Tree
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Layer Commissions</span>
                <span style={{ color: "#0284c7", fontWeight: 800 }}>50% Layer + 50% Direct</span>
              </div>
            </div>

            {/* Card 13: 3-Block AutoPool Accounts */}
            <div
              onClick={() => navigate("/admin/autopool")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>13</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>3-Block AutoPool Accounts</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 950, color: "#059669" }}>
                {number(matrixData.totalAccounts)} Active Nodes
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Auto-Spillover Nodes</span>
                <span style={{ color: "#059669", fontWeight: 800 }}>Synchronized</span>
              </div>
            </div>

            {/* Card 14: Community Consumer Self Re-Birth */}
            <div
              onClick={() => navigate("/admin/workflows/team-admin-board")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#fdf2f8", color: "#db2777", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>14</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>Self Re-Birth Pockets</span>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fdf2f8", color: "#db2777", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RedeemRoundedIcon sx={{ fontSize: 18 }} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 950, color: "#db2777" }}>
                {currency(treasury.selfPocketAmount)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 8, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
                <span>Re-entry Circulation</span>
                <span style={{ color: "#db2777", fontWeight: 800 }}>Automated</span>
              </div>
            </div>

          </div>
        </div>

        {/* =========================================================================
            SECTION 5: OPERATIONS, REWARDS & COMPLIANCE (INDEX 15 - 18)
        ========================================================================= */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ea580c" }} />
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 950, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                5. Operations, Rewards & Compliance
              </h2>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            
            {/* Card 15: Coupons & Vouchers */}
            <div
              onClick={() => navigate("/admin/wallet-vouchers")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f1f5f9", color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>15</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>Coupons & Vouchers</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{currency(treasury.couponPocketAmount)} Value</div>
                </div>
              </div>
              <ConfirmationNumberRoundedIcon sx={{ fontSize: 20, color: "#ea580c" }} />
            </div>

            {/* Card 16: Spin & Win Lucky Draw */}
            <div
              onClick={() => navigate("/admin/lucky-draw")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f1f5f9", color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>16</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>Spin & Win SPP</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Lucky Draw Hub</div>
                </div>
              </div>
              <CasinoRoundedIcon sx={{ fontSize: 20, color: "#7c3aed" }} />
            </div>

            {/* Card 17: Tri Tour Package */}
            <div
              onClick={() => navigate("/admin/packages/tri-tour")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f1f5f9", color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>17</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>Tri Tour Leaderboard</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Tour Contest</div>
                </div>
              </div>
              <EmojiEventsRoundedIcon sx={{ fontSize: 20, color: "#eab308" }} />
            </div>

            {/* Card 18: Package GST Bills & Compliance */}
            <div
              onClick={() => navigate("/admin/package-management")}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "#f1f5f9", color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>18</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>Package GST Invoices</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>18% Tax Records</div>
                </div>
              </div>
              <ReceiptLongRoundedIcon sx={{ fontSize: 20, color: "#2563eb" }} />
            </div>

          </div>
        </div>

      </div>
    </RequirePermission>
  );
}
