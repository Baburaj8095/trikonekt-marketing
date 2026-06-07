import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import CasinoRoundedIcon from "@mui/icons-material/CasinoRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import API from "../../api/api";
import RequirePermission from "../../components/admin/RequirePermission";

const DASHBOARD_COLORS = [
  { bg: "#fff1f2", fg: "#e11d48", soft: "#ffe4e6" },
  { bg: "#eef2ff", fg: "#4f46e5", soft: "#e0e7ff" },
  { bg: "#ecfdf5", fg: "#059669", soft: "#d1fae5" },
  { bg: "#fff7ed", fg: "#ea580c", soft: "#fed7aa" },
  { bg: "#f5f3ff", fg: "#7c3aed", soft: "#ede9fe" },
  { bg: "#eff6ff", fg: "#2563eb", soft: "#dbeafe" },
  { bg: "#fdf2f8", fg: "#db2777", soft: "#fce7f3" },
  { bg: "#f0fdfa", fg: "#0d9488", soft: "#ccfbf1" },
];

const currency = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
};

const number = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-IN").format(n);
};

function dashboardColor(index) {
  return DASHBOARD_COLORS[(index - 1) % DASHBOARD_COLORS.length];
}

function MetricLine({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 13, fontWeight: 900, marginTop: 3, overflowWrap: "anywhere" }}>
        {value ?? "-"}
      </div>
    </div>
  );
}

function DashboardCard({ card, index, onOpen }) {
  const color = dashboardColor(index);
  const Icon = card.icon || DashboardCustomizeRoundedIcon;
  const clickable = !!card.to;

  return (
    <button
      type="button"
      onClick={() => clickable && onOpen(card.to)}
      disabled={!clickable}
      style={{
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        borderRadius: 8,
        minHeight: 136,
        padding: 14,
        textAlign: "left",
        boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
        cursor: clickable ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
      }}
      onMouseEnter={(e) => {
        if (!clickable) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 14px 30px rgba(15,23,42,0.11)";
        e.currentTarget.style.borderColor = color.soft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 8px 22px rgba(15,23,42,0.06)";
        e.currentTarget.style.borderColor = "#e5e7eb";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: color.soft,
              color: color.fg,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 950,
              flex: "0 0 auto",
            }}
          >
            {index}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 950, lineHeight: 1.2 }}>
              {card.title}
            </div>
            {card.subtitle ? (
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                {card.subtitle}
              </div>
            ) : null}
          </div>
        </div>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 7,
            background: color.bg,
            color: color.fg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </span>
      </div>

      {card.primary ? (
        <div style={{ color: "#0f172a", fontSize: 22, fontWeight: 950, lineHeight: 1 }}>
          {card.primary}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(card.metrics?.length || 1, 4)}, minmax(0, 1fr))`,
          gap: 10,
          marginTop: "auto",
        }}
      >
        {(card.metrics || [{ label: "Count", value: "-" }]).map((metric) => (
          <MetricLine key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>
    </button>
  );
}

function SummaryPanel({ title, rows }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#ffffff",
        padding: 16,
        boxShadow: "0 8px 22px rgba(15,23,42,0.05)",
      }}
    >
      <h3 style={{ margin: "0 0 12px", color: "#0f172a", fontSize: 14, fontWeight: 950 }}>{title}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{row.label}</span>
            <span style={{ color: "#0f172a", fontSize: 12, fontWeight: 950, textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [catCounts, setCatCounts] = useState({});
  const [merchantsCount, setMerchantsCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadMetrics() {
      setLoading(true);
      setErr("");
      try {
        const res = await API.get("admin/metrics/", {
          timeout: 12000,
          retryAttempts: 1,
          cacheTTL: 15000,
          dedupe: "cancelPrevious",
        });
        if (mounted) setData(res?.data || {});
      } catch (_e) {
        try {
          const res = await API.get("adminapi/metrics/", {
            timeout: 12000,
            retryAttempts: 1,
            cacheTTL: 15000,
            dedupe: "cancelPrevious",
          });
          if (mounted) setData(res?.data || {});
        } catch {
          if (mounted) {
            setData({});
            setErr("Failed to load dashboard metrics.");
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMetrics();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadCounts() {
      try {
        const res = await API.get("admin/users/category-counts/", {
          timeout: 8000,
          retryAttempts: 0,
          cacheTTL: 30000,
          dedupe: "cancelPrevious",
        });
        if (mounted) setCatCounts(res?.data || {});
      } catch {
        if (mounted) setCatCounts({});
      }
    }

    loadCounts();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const parseCount = (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    };

    async function loadMerchantTotal() {
      try {
        const [roleBusiness, catMerchant, catBusiness] = await Promise.all([
          API.get("/api/admin/users/", { params: { role: "business", page: 1, page_size: 1 }, timeout: 8000, retryAttempts: 0 }),
          API.get("/api/admin/users/", { params: { role: "user", category: "merchant", page: 1, page_size: 1 }, timeout: 8000, retryAttempts: 0 }),
          API.get("/api/admin/users/", { params: { role: "user", category: "business", page: 1, page_size: 1 }, timeout: 8000, retryAttempts: 0 }),
        ]);
        const total = parseCount(roleBusiness?.data?.count) + parseCount(catMerchant?.data?.count) + parseCount(catBusiness?.data?.count);
        if (mounted) setMerchantsCount(total);
      } catch {
        if (mounted) setMerchantsCount(null);
      }
    }

    loadMerchantTotal();
    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(() => {
    const users = data?.users || {};
    const kyc = data?.kyc || {};
    const wallets = data?.wallets || {};
    const withdrawals = data?.withdrawals || {};
    const coupons = data?.coupons || {};
    const uploadsModels = data?.uploadsModels || {};
    const market = data?.market || {};
    const reports = data?.reports || {};
    const autopool = data?.autopool || {};
    const packageStats = data?.packageStats || {};
    const subscription750 = packageStats.subscription750 || {};
    const smartProduct1000 = packageStats.smartProduct1000 || {};
    const digitalEducationPrime = packageStats.digitalEducationPrime || {};
    const walletPocketStats = data?.walletPocketStats || {};
    const totalConsumers = catCounts.consumer ?? users.total ?? 0;
    const businessTotal = merchantsCount ?? (catCounts.merchant ?? 0) + (catCounts.business ?? 0);

    const packageMetrics = (stats = {}) => [
      { label: "Today ID", value: number(stats.todayCount) },
      { label: "Today Amount", value: currency(stats.todayAmount) },
      { label: "Total ID", value: number(stats.totalCount) },
      { label: "Total Amount", value: currency(stats.totalAmount) },
    ];

    const simple = (title, icon, to, count = "-", amount = "-") => ({
      title,
      icon,
      to,
      metrics: [
        { label: "Count", value: count },
        { label: "Amount", value: amount },
      ],
    });

    return [
      { title: "Team Consumers", icon: GroupsRoundedIcon, to: "/admin/users?category=consumer", metrics: [{ label: "Count", value: number(totalConsumers) }] },
      {
        title: "Active Users",
        icon: PersonAddAltRoundedIcon,
        to: "/admin/users?account_active=1",
        primary: number(users.active),
        metrics: [
          { label: "Today", value: number(users.todayNew) },
          { label: "Total", value: number(users.active) },
          { label: "Amount", value: "-" },
        ],
      },
      { title: "Inactive Users", icon: PersonOffRoundedIcon, to: "/admin/users?account_active=0", metrics: [{ label: "Count", value: number(users.inactive) }] },
      { title: "Blocked Users", icon: BlockRoundedIcon, to: "/admin/users?is_active=0", metrics: [{ label: "Count", value: number(users.blocked) }] },
      { title: "Profile & KYC", icon: VerifiedUserRoundedIcon, to: "/admin/kyc?status=submitted", metrics: [{ label: "Submitted", value: number(kyc.submitted) }, { label: "Approved", value: number(kyc.approved) }, { label: "Pending", value: number(kyc.pending_all ?? kyc.pending) }] },
      { title: "Subscription Rs 750", icon: ConfirmationNumberRoundedIcon, to: "/admin/promo-purchases?kind=750&status=APPROVED", metrics: packageMetrics(subscription750.overall) },
      { title: "Subscription Rs 750 Coupon Pocket", icon: ConfirmationNumberRoundedIcon, to: "/admin/promo-purchases?kind=750&status=APPROVED", metrics: packageMetrics(subscription750.couponPocket) },
      { title: "Subscription Rs 750 Self Package Pocket", icon: ShoppingCartRoundedIcon, to: "/admin/promo-purchases?kind=750&status=APPROVED", metrics: packageMetrics(subscription750.selfPackagePocket) },
      { title: "Subscription Rs 750 Add Money", icon: AccountBalanceWalletRoundedIcon, to: "/admin/promo-purchases?kind=750&status=APPROVED", metrics: packageMetrics(subscription750.addMoney) },
      { title: "Subscription Rs 750 Redeem Point Wallet", icon: AccountBalanceWalletRoundedIcon, to: "/admin/workflows/redeem-point-coupon-summary", metrics: [{ label: "Count", value: number(coupons.redeemed) }, { label: "Amount Approval", value: "-" }] },
      { title: "Smart Product Package Rs 1000", icon: ShoppingCartRoundedIcon, to: "/admin/promo-purchases?kind=759&status=APPROVED", metrics: packageMetrics(smartProduct1000.overall) },
      { title: "Smart Product Package Rs 1000 Coupon Pocket", icon: ConfirmationNumberRoundedIcon, to: "/admin/promo-purchases?kind=759&status=APPROVED", metrics: packageMetrics(smartProduct1000.couponPocket) },
      { title: "Smart Product Package Rs 1000 Self Package Pocket", icon: ShoppingCartRoundedIcon, to: "/admin/promo-purchases?kind=759&status=APPROVED", metrics: packageMetrics(smartProduct1000.selfPackagePocket) },
      { title: "Smart Product Package Rs 1000 Add Money", icon: AccountBalanceWalletRoundedIcon, to: "/admin/promo-purchases?kind=759&status=APPROVED", metrics: packageMetrics(smartProduct1000.addMoney) },
      { title: "Digital Education Prime Package", icon: SchoolRoundedIcon, to: "/admin/packages/digital-education-prime", metrics: packageMetrics(digitalEducationPrime.overall) },
      simple("Digital Education Prime Package Coupon Pocket", ConfirmationNumberRoundedIcon, "/admin/packages/digital-education-prime"),
      simple("Digital Education Prime Package Self Package Pocket", SchoolRoundedIcon, "/admin/packages/digital-education-prime"),
      simple("Digital Education Prime Package Add Money", AccountBalanceWalletRoundedIcon, "/admin/packages/digital-education-prime"),
      { title: "Total Earning", icon: CurrencyRupeeRoundedIcon, to: "/admin/wallet-ledger", primary: currency(wallets.totalBalance), metrics: [{ label: "Amount", value: currency(wallets.totalBalance) }] },
      { title: "Main Wallet", icon: AccountBalanceWalletRoundedIcon, to: "/admin/wallets", primary: currency(wallets.totalBalance), metrics: [{ label: "Wallets", value: number(wallets.count) }] },
      simple("Team Consumer Self Re-birth", RedeemRoundedIcon, "/admin/workflows/team-admin-board"),
      { title: "Coupon Purchase Pocket", icon: ShoppingCartRoundedIcon, to: "/admin/wallet-vouchers", metrics: packageMetrics(walletPocketStats.couponPocket) },
      { title: "Self Re-birth Pocket", icon: RedeemRoundedIcon, to: "/admin/workflows/redeem-point-coupon-summary", metrics: packageMetrics(walletPocketStats.selfPackagePocket) },
      { title: "Add Money", icon: PaymentsRoundedIcon, to: "/admin/wallet-upload-approvals", metrics: packageMetrics(walletPocketStats.addMoney) },
      { title: "Purchase Package Coupon", icon: ConfirmationNumberRoundedIcon, to: "/admin/wallet-vouchers", metrics: packageMetrics(walletPocketStats.packageCouponPocket) },
      { title: "Withdrawal", icon: PaymentsRoundedIcon, to: "/admin/withdrawals", metrics: [{ label: "Overall Count", value: number(withdrawals.pendingCount) }, { label: "Overall Amount", value: currency(withdrawals.pendingAmount) }] },
      simple("Shopping Consumer Self Re-birth", StorefrontRoundedIcon, "/admin/workflows/team-admin-board"),
      simple("Franchisee Self Re-birth", ShieldRoundedIcon, "/admin/workflows/franchise-reference-reward"),
      simple("Captain Self Re-birth", EmojiEventsRoundedIcon, "/admin/workflows/zonal-reward"),
      { title: "Spin & Win SPP", icon: CasinoRoundedIcon, to: "/admin/lucky-draw", subtitle: "List inside", metrics: [{ label: "Entries", value: number(uploadsModels.luckyDrawSubmissions) }] },
      { title: "Spin & Win Digital Education", icon: CasinoRoundedIcon, to: "/admin/lucky-draw", subtitle: "List inside", metrics: [{ label: "Pending", value: number(uploadsModels.luckyDrawPendingAgency) }] },
      { title: "Tri Tour", icon: EmojiEventsRoundedIcon, to: "/admin/packages/tri-tour", subtitle: "List inside", metrics: [{ label: "Count", value: "-" }] },
      { title: "Subscription Rs 750 5 Matrix", icon: AccountTreeRoundedIcon, to: "/admin/commissions/history", metrics: [{ label: "ID Count", value: "-" }] },
      { title: "Smart Product Package Rs 1000 5 Matrix", icon: AccountTreeRoundedIcon, to: "/admin/commissions/history", metrics: [{ label: "ID Count", value: "-" }] },
      { title: "Digital Education 5 Matrix", icon: AccountTreeRoundedIcon, to: "/admin/commissions/history", metrics: [{ label: "ID Count", value: "-" }] },
      { title: "Subscription Rs 750 3 Matrix", icon: AccountTreeRoundedIcon, to: "/admin/autopool", metrics: [{ label: "ID Count", value: number(autopool.total) }] },
      { title: "Smart Product Package Rs 1000 3 Matrix", icon: AccountTreeRoundedIcon, to: "/admin/autopool", metrics: [{ label: "ID Count", value: number(autopool.total) }] },
      { title: "Digital Education 3 Matrix", icon: AccountTreeRoundedIcon, to: "/admin/autopool", metrics: [{ label: "ID Count", value: number(autopool.total) }] },
      { title: "5 Matrix Tree", icon: AccountTreeRoundedIcon, to: "/admin/user-tree", metrics: [{ label: "Tree", value: "Open" }] },
      { title: "3 Matrix Tree", icon: AccountTreeRoundedIcon, to: "/admin/user-tree", metrics: [{ label: "Tree", value: "Open" }] },
      { title: "Digital Education 5 Matrix Tree", icon: AccountTreeRoundedIcon, to: "/admin/user-tree", metrics: [{ label: "Tree", value: "Open" }] },
      { title: "Package GST Bills", icon: ReceiptLongRoundedIcon, to: "/admin/package-management", metrics: [{ label: "Count", value: number(reports.dailyReportsTotal) }] },
      simple("QR Scanner Payment", QrCodeScannerRoundedIcon, "/admin/payments"),
      simple("Gateway Mode of Payment", CreditCardRoundedIcon, "/admin/payments"),
      { title: "CRM Connect Website", icon: DashboardCustomizeRoundedIcon, to: "/admin/workflows/crm-connect", metrics: [{ label: "Status", value: "Manage" }] },
      { title: "Business / Merchant", icon: StorefrontRoundedIcon, to: "/admin/merchants", metrics: [{ label: "Count", value: number(businessTotal) }, { label: "Products", value: number(market.products) }] },
      { title: "Dashboard Cards", icon: DashboardCustomizeRoundedIcon, to: "/admin/dashboard-cards", metrics: [{ label: "Count", value: number(uploadsModels.dashboardCards) }] },
    ];
  }, [catCounts, data, merchantsCount]);

  return (
    <RequirePermission anyOf={["reports_basic", "manage_dashboard", "show_dashboard"]}>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: "#0f172a", fontSize: 22, fontWeight: 950 }}>Dashboard</h2>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              Team consumer overview, package pockets, matrix trees, wallets, and payment summaries.
            </div>
          </div>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
            {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>

        {loading ? <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>Loading dashboard cards...</div> : null}
        {err ? <div style={{ color: "#b91c1c", fontSize: 13, fontWeight: 800 }}>{err}</div> : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: 12,
            alignItems: "stretch",
          }}
        >
          {cards.map((card, idx) => (
            <DashboardCard key={`${idx}-${card.title}`} card={card} index={idx + 1} onOpen={navigate} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <SummaryPanel
            title="Wallet Summary"
            rows={[
              { label: "Main Wallet", value: currency(data?.wallets?.totalBalance) },
              { label: "Purchase Wallet", value: "-" },
              { label: "Earning Wallet", value: "-" },
              { label: "Total Balance", value: currency(data?.wallets?.totalBalance) },
            ]}
          />
          <SummaryPanel
            title="Top Summary"
            rows={[
              { label: "Active Users", value: number(data?.users?.active) },
              { label: "Total Earning", value: currency(data?.wallets?.totalBalance) },
              { label: "Total Withdrawal", value: currency(data?.withdrawals?.pendingAmount) },
              { label: "Total Re-birth", value: "-" },
            ]}
          />
          <SummaryPanel
            title="System Overview"
            rows={[
              { label: "Total Users", value: number(data?.users?.total) },
              { label: "Today New Users", value: number(data?.users?.todayNew) },
              { label: "KYC Verified Users", value: number(data?.kyc?.approved) },
              { label: "Today Transactions", value: number(data?.wallets?.transactionsToday) },
            ]}
          />
        </div>
      </div>
    </RequirePermission>
  );
}
