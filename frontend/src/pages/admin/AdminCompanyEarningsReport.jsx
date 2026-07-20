import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";
import normalizeMediaUrl from "../../utils/media";

function formatMoney(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "₹0.00";
}

function isDummyUser(row) {
  if (!row) return true;
  const user = row.user || row.user_info || {};
  const phone = String(user.mobile || user.phone || user.username || row.phone || row.username || "").trim();
  const name = String(user.full_name || user.username || row.user_name || "").toLowerCase();

  if (!phone && !name) return false;

  // Filter dummy test patterns: starting with 999999999, 11, or 00
  if (phone.startsWith("999999999") || phone.startsWith("9999999999")) return true;
  if (phone.startsWith("11")) return true;
  if (phone.startsWith("00")) return true;
  if (/^0+$/.test(phone) || /^1+$/.test(phone)) return true;
  if (name.includes("dummy") || name.includes("testuser") || name.includes("testing")) return true;

  return false;
}

function parseMonth(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const m = d.getMonth() + 1; // 1 = Jan, 5 = May, 6 = Jun, 7 = Jul
  const y = d.getFullYear();
  if (y === 2026 && m === 5) return "May 2026";
  if (y === 2026 && m === 6) return "June 2026";
  if (y === 2026 && m === 7) return "July 2026";
  return `${d.toLocaleString("default", { month: "short" })} ${y}`;
}

export default function AdminCompanyEarningsReport() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("ALL"); // "ALL", "May 2026", "June 2026", "July 2026"
  const [searchQuery, setSearchQuery] = useState("");

  const [addMoneyRows, setAddMoneyRows] = useState([]);
  const [promoRows, setPromoRows] = useState([]);
  const [agencyPrimeRows, setAgencyPrimeRows] = useState([]);
  const [rankUpgradeRows, setRankUpgradeRows] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setErr("");
    try {
      const [addMoneyRes, promoRes, agencyRes, rankRes] = await Promise.allSettled([
        API.get("/accounts/admin/wallet/upload-requests/", { params: { page_size: 1000 } }),
        API.get("/business/admin/promo/purchases/", { params: { page_size: 1000 } }),
        API.get("/accounts/admin/agency-prime-requests/", { params: { page_size: 1000 } }),
        API.get("/accounts/admin/rank-upgrades/", { params: { page_size: 1000 } }),
      ]);

      if (addMoneyRes.status === "fulfilled") {
        const d = addMoneyRes.value?.data;
        setAddMoneyRows(Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []);
      }
      if (promoRes.status === "fulfilled") {
        const d = promoRes.value?.data;
        setPromoRows(Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []);
      }
      if (agencyRes.status === "fulfilled") {
        const d = agencyRes.value?.data;
        setAgencyPrimeRows(Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []);
      }
      if (rankRes.status === "fulfilled") {
        const d = rankRes.value?.data;
        setRankUpgradeRows(Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : []);
      }
    } catch (e) {
      setErr("Failed to fetch earnings records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter valid Add Money requests
  const validAddMoney = useMemo(() => {
    return addMoneyRows.filter((r) => {
      if (isDummyUser(r)) return false;
      const st = String(r.status || "").toUpperCase();
      if (st !== "APPROVED") return false;
      const month = parseMonth(r.created_at || r.timestamp || r.date);
      if (selectedMonth !== "ALL" && month !== selectedMonth) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const user = r.user || {};
        const phone = String(user.mobile || user.phone || r.phone || "");
        const name = String(user.full_name || user.username || "").toLowerCase();
        const utr = String(r.utr || "").toLowerCase();
        if (!phone.includes(q) && !name.includes(q) && !utr.includes(q)) return false;
      }

      return true;
    });
  }, [addMoneyRows, selectedMonth, searchQuery]);

  // Aggregate monthly stats for valid users
  const monthlyBreakdown = useMemo(() => {
    const months = {
      "May 2026": { addMoney: 0, addMoneyCount: 0, promo: 0, promoCount: 0, users: new Set() },
      "June 2026": { addMoney: 0, addMoneyCount: 0, promo: 0, promoCount: 0, users: new Set() },
      "July 2026": { addMoney: 0, addMoneyCount: 0, promo: 0, promoCount: 0, users: new Set() },
    };

    // Add Money
    addMoneyRows.forEach((r) => {
      if (isDummyUser(r)) return;
      if (String(r.status || "").toUpperCase() !== "APPROVED") return;
      const m = parseMonth(r.created_at || r.timestamp || r.date);
      if (months[m]) {
        const amt = parseFloat(r.amount || 0);
        months[m].addMoney += amt;
        months[m].addMoneyCount += 1;
        const u = r.user?.username || r.user?.mobile || r.phone;
        if (u) months[m].users.add(u);
      }
    });

    // Promo purchases
    promoRows.forEach((r) => {
      if (isDummyUser(r)) return;
      if (String(r.status || "").toUpperCase() !== "APPROVED") return;
      const m = parseMonth(r.created_at || r.timestamp || r.date);
      if (months[m]) {
        const amt = parseFloat(r.total_amount || r.amount || 0);
        months[m].promo += amt;
        months[m].promoCount += 1;
      }
    });

    return months;
  }, [addMoneyRows, promoRows]);

  const grandTotals = useMemo(() => {
    let totalAddMoney = 0;
    let totalAddMoneyRequests = 0;
    let totalPromo = 0;
    let totalPromoCount = 0;
    const allUniqueUsers = new Set();

    Object.values(monthlyBreakdown).forEach((m) => {
      totalAddMoney += m.addMoney;
      totalAddMoneyRequests += m.addMoneyCount;
      totalPromo += m.promo;
      totalPromoCount += m.promoCount;
      m.users.forEach((u) => allUniqueUsers.add(u));
    });

    return {
      totalAddMoney,
      totalAddMoneyRequests,
      totalPromo,
      totalPromoCount,
      uniqueUsersCount: allUniqueUsers.size,
      grandTotal: totalAddMoney + totalPromo,
    };
  }, [monthlyBreakdown]);

  const exportCSV = () => {
    let csv = "User Name,Username/Phone,Amount (INR),UTR No,Date & Time,Month\n";
    validAddMoney.forEach((r) => {
      const user = r.user || {};
      const name = `"${(user.full_name || user.username || "").replace(/"/g, '""')}"`;
      const phone = user.mobile || user.phone || r.phone || "";
      const amt = parseFloat(r.amount || 0).toFixed(2);
      const utr = `"${(r.utr || "").replace(/"/g, '""')}"`;
      const dt = r.created_at || r.timestamp || r.date || "";
      const m = parseMonth(dt) || "";
      csv += `${name},${phone},${amt},${utr},${dt},${m}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Company_Earnings_Valid_Users_${selectedMonth.replace(/\s+/g, "_")}.csv`;
    a.click();
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
            Company Financial Earnings Report
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>
            Exact figures for <strong>May, June & July 2026</strong> (Excluding test dummy accounts: 999999999, 11*, 00*)
          </p>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={fetchData}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh Data
          </button>
          <button
            onClick={exportCSV}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(14,165,233,0.3)",
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {err ? <div style={{ padding: 16, background: "#fee2e2", color: "#991b1b", borderRadius: 8, marginBottom: 20 }}>{err}</div> : null}

      {/* Month Filter Selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {["ALL", "May 2026", "June 2026", "July 2026"].map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: selectedMonth === m ? "1px solid #0ea5e9" : "1px solid #e2e8f0",
              background: selectedMonth === m ? "#0ea5e9" : "#fff",
              color: selectedMonth === m ? "#fff" : "#0f172a",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {m === "ALL" ? "All (May, June & July 2026)" : m}
          </button>
        ))}
      </div>

      {/* Grand Total Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 28 }}>
        <div style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)", color: "#fff", padding: 24, borderRadius: 16, boxShadow: "0 12px 28px rgba(14,165,233,0.25)" }}>
          <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total Valid Earnings ({selectedMonth === "ALL" ? "May - July 2026" : selectedMonth})
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, marginTop: 8 }}>
            {formatMoney(selectedMonth === "ALL" ? grandTotals.grandTotal : (monthlyBreakdown[selectedMonth]?.addMoney || 0) + (monthlyBreakdown[selectedMonth]?.promo || 0))}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
            Combined Add Money Deposits + Package Revenue
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 24, borderRadius: 16, boxShadow: "0 10px 24px rgba(15,23,42,0.06)" }}>
          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
            Add Money Credited by Valid Users
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#16a34a", marginTop: 8 }}>
            {formatMoney(selectedMonth === "ALL" ? grandTotals.totalAddMoney : (monthlyBreakdown[selectedMonth]?.addMoney || 0))}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            {selectedMonth === "ALL" ? grandTotals.totalAddMoneyRequests : (monthlyBreakdown[selectedMonth]?.addMoneyCount || 0)} Approved Top-Ups ({selectedMonth === "ALL" ? grandTotals.uniqueUsersCount : (monthlyBreakdown[selectedMonth]?.users?.size || 0)} Unique Users)
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 24, borderRadius: 16, boxShadow: "0 10px 24px rgba(15,23,42,0.06)" }}>
          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
            Package & Promo Coupon Sales
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0ea5e9", marginTop: 8 }}>
            {formatMoney(selectedMonth === "ALL" ? grandTotals.totalPromo : (monthlyBreakdown[selectedMonth]?.promo || 0))}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            {selectedMonth === "ALL" ? grandTotals.totalPromoCount : (monthlyBreakdown[selectedMonth]?.promoCount || 0)} Approved Packages Purchased
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Cards */}
      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 16 }}>
        Month-by-Month Breakdown (Valid Users)
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 32 }}>
        {Object.entries(monthlyBreakdown).map(([mName, mData]) => (
          <div key={mName} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 8px 20px rgba(15,23,42,0.05)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: 12, marginBottom: 12 }}>
              {mName}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: 14 }}>Add Money Credited:</span>
              <span style={{ fontWeight: 800, color: "#16a34a", fontSize: 14 }}>{formatMoney(mData.addMoney)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>Top-Up Transactions:</span>
              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{mData.addMoneyCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>Unique Depositors:</span>
              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{mData.users.size} Users</span>
            </div>

            <div style={{ height: 1, background: "#f1f5f9", margin: "12px 0" }} />

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#64748b", fontSize: 14 }}>Package Sales:</span>
              <span style={{ fontWeight: 800, color: "#0ea5e9", fontSize: 14 }}>{formatMoney(mData.promo)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>Package Purchases:</span>
              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{mData.promoCount}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Money Transaction Log */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, boxShadow: "0 10px 24px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
            Add Money Deposit Log ({validAddMoney.length} Valid Records)
          </h2>
          <input
            type="text"
            placeholder="Search User, Phone, or UTR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              minWidth: 260,
            }}
          />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading transaction records...</div>
        ) : validAddMoney.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No valid Add Money records found for the selected filter.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "12px 16px" }}>User Name</th>
                  <th style={{ padding: "12px 16px" }}>Phone / Username</th>
                  <th style={{ padding: "12px 16px" }}>Amount Credited</th>
                  <th style={{ padding: "12px 16px" }}>UTR Number</th>
                  <th style={{ padding: "12px 16px" }}>Proof</th>
                  <th style={{ padding: "12px 16px" }}>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {validAddMoney.map((r, idx) => {
                  const user = r.user || {};
                  const uName = user.full_name || user.username || r.user_name || "Partner";
                  const phone = user.mobile || user.phone || r.phone || "-";
                  const amt = parseFloat(r.amount || 0);
                  const proof = r.proof ? normalizeMediaUrl(r.proof) : null;
                  const dt = r.created_at || r.timestamp || r.date || "-";

                  return (
                    <tr key={r.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>{uName}</td>
                      <td style={{ padding: "12px 16px", color: "#475569" }}>{phone}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 900, color: "#16a34a" }}>{formatMoney(amt)}</td>
                      <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace" }}>{r.utr || "-"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {proof ? (
                          <a href={proof} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", fontWeight: 700, textDecoration: "none" }}>
                            View Proof
                          </a>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>No file</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>{dt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
