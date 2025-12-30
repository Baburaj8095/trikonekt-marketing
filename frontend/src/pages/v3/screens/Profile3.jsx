import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import V2WrapperFactory from "../../v2/V2WrapperFactory";

/**
 * Profile3
 * - Mirrors v2 Dashboard2Profile content and groupings (no copy/data change).
 * - If ?screen=name is present, renders V2WrapperFactory(name) inside v3 UX.
 */
export default function Profile3() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const screen = searchParams.get("screen");

  const storedUser = useMemo(() => {
    try {
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const parsed = ls ? JSON.parse(ls) : {};
      return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object"
        ? parsed.user
        : parsed;
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";
  const displayEmail = storedUser?.email || "";

  const groups = [
    {
      title: "Account",
      items: [{ label: "Account Info", screen: "profile2" }],
    },
    {
      title: "Earnings & Teams",
      items: [
        { label: "Genealogy (My Team)", screen: "my-team2" },
        { label: "Refer & Earn", screen: "refer-earn2" },
        { label: "Join Prime Packages", screen: "promo-packages2" },
      ],
    },
    {
      title: "Orders & Coupons",
      items: [
        { label: "My E‑Coupons", screen: "my-e-coupons2" },
        { label: "My Orders", screen: "my-orders2" },
        { label: "Cart", screen: "cart2" },
      ],
    },
    {
      title: "Marketplaces",
      items: [
        { label: "Trikonekt Products", screen: "trikonekt-products2" },
        { label: "Merchant Marketplace", screen: "merchant-marketplace2" },
      ],
    },
    {
      title: "Help",
      items: [{ label: "Support", screen: "support2" }],
    },
  ];

  if (screen) {
    return (
      <div>
        <div className="v3-chip-row" style={{ paddingTop: 0 }}>
          <button
            className="v3-chip"
            onClick={() => {
              navigate("/v3/profile", { replace: true });
            }}
          >
            ← Back
          </button>
        </div>
        <div className="v3-card" style={{ padding: 8 }}>
          <V2WrapperFactory name={screen} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
          {displayName}
        </div>
        {displayEmail ? (
          <div className="v3-muted" style={{ fontSize: 12 }}>{displayEmail}</div>
        ) : null}
      </div>

      {groups.map((group) => (
        <div key={group.title} className="v3-section">
          <div className="v3-section-header">
            <div className="v3-section-title">{group.title}</div>
          </div>
          <div className="v3-card">
            {(group.items || []).map((item, idx, arr) => (
              <div
                key={item.label}
                className="v3-tile v3-click"
                style={{
                  borderBottom: idx < arr.length - 1 ? undefined : "none",
                }}
                onClick={() => {
                  if (item.screen) {
                    navigate(`/v3/profile?screen=${encodeURIComponent(item.screen)}`);
                  } else if (item.to) {
                    navigate(item.to);
                  }
                }}
              >
                <div className="v3-tile-icon">›</div>
                <div>
                  <div className="v3-tile-title">{item.label}</div>
                </div>
                <div className="v3-tile-right">⟩</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Quick tab helpers */}
      <div className="v3-chip-row">
        <button className="v3-chip" onClick={() => navigate("/v3")}>Dashboard</button>
        <button className="v3-chip" onClick={() => navigate("/v3/wallet")}>Wallet</button>
        <button className="v3-chip" onClick={() => navigate("/v3/history")}>History</button>
      </div>
    </div>
  );
}
