import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { listMyPromoPurchases } from "../../../api/api";
import AppsGrid from "../../../components/AppsGrid";

// Assets (reuse same ones as v2)
import LOGO from "../../../assets/TRIKONEKT.png";
import banner_wg from "../../../assets/Wealth_Galaxy.jpg";
import imgGiftCards from "../../../assets/gifts.jpg";
import imgEcommerce from "../../../assets/ecommerce.jpg";
import imgSpinWin from "../../../assets/lucky-draw-img.png";
import imgHolidays from "../../../assets/holidays.jpg";
import imgEV from "../../../assets/ev-img.jpg";
import imgBillRecharge from "../../../assets/google-play-store.png";
import imgPlaystoreScreen from "../../../assets/play_store_screen.webp";
import imgFurniture from "../../../assets/furniture.jpeg";
import imgProperties from "../../../assets/propeties.jpg";

/**
 * Home3
 * Mirrors v2 Dashboard2Home content and data; only UX classes changed to v3.
 */
export default function Home3() {
  const navigate = useNavigate();

  // Prime badge (mirror logic used in v2 shell)
  const [isPrime, setIsPrime] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await listMyPromoPurchases();
        const list = Array.isArray(res) ? res : res?.results || [];
        const valid = (list || []).filter(
          (pp) => String(pp?.status || "").toUpperCase() === "APPROVED"
        );
        let has150 = false,
          has750 = false,
          hasMonthly = false;
        for (const pp of valid) {
          const pkg = pp?.package || {};
          const type = String(pkg?.type || "");
          const name = String(pkg?.name || "").toLowerCase();
          const code = String(pkg?.code || "").toLowerCase();
          const price = Number(pkg?.price || 0);
          if (type === "MONTHLY") hasMonthly = true;
          else if (type === "PRIME") {
            if (Math.abs(price - 150) < 0.5 || name.includes("150") || code.includes("150"))
              has150 = true;
            if (Math.abs(price - 750) < 0.5 || name.includes("750") || code.includes("750"))
              has750 = true;
          }
        }
        if (mounted) setIsPrime(has150 || has750 || hasMonthly);
      } catch {
        if (mounted) setIsPrime(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Admin-managed cards (same data source as v2)
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const storedRole = useMemo(
    () => localStorage.getItem("role_user") || sessionStorage.getItem("role_user") || "user",
    []
  );
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/uploads/cards/", {
          params: { role: storedRole || undefined },
        });
        if (!mounted) return;
        setCards(Array.isArray(res?.data) ? res.data : []);
      } catch {
        setCards([]);
      } finally {
        if (mounted) setLoadingCards(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [storedRole]);

  const MEDIA_BASE = (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");

  // App items (same list as v2)
  const appItems = useMemo(
    () => [
      { key: "genealogy", label: "Genealogy", route: "/user/my-team", image: LOGO },
      { key: "wealth-galaxy", label: "Wealth Galaxy", route: "/user/wealth-galaxy", image: banner_wg },
      { key: "prime", label: "Prime", route: "/user/promo-packages", image: LOGO },
      { key: "bill-recharge", label: "Bill & Recharge", comingSoon: true, image: imgBillRecharge },
      { key: "ecommerce", label: "E‑commerce", route: "/trikonekt-products", image: imgEcommerce },
      { key: "tri-holidays", label: "TRI Holidays", route: "/user/tri/tri-holidays", image: imgHolidays },
      { key: "tri-furniture", label: "TRI Furniture", route: "/user/tri/tri-furniture", image: imgFurniture },
      { key: "tri-electronics", label: "TRI Electronics", route: "/user/tri/tri-electronics", image: imgPlaystoreScreen },
      { key: "tri-properties", label: "TRI Properties", route: "/user/tri/tri-properties", image: imgProperties },
      { key: "tri-spinwin", label: "TRI Spin & Win", route: "/user/lucky-draw", image: imgSpinWin },
      { key: "tri-local-store", label: "Local Store", route: "/user/tri/tri-local-store", image: imgGiftCards },
      { key: "tri-ev", label: "TRI EV Vehicles", route: "/user/tri/tri-ev", image: imgEV },
    ],
    []
  );

  const appItemsWithBadge = useMemo(
    () =>
      appItems.map((it) =>
        it.key === "prime"
          ? {
              ...it,
              badgeText: isPrime ? "Prime" : "Non‑Prime",
              badgeBg: isPrime ? "#16a34a" : "#6b7280",
              badgeFg: "#fff",
            }
          : it
      ),
    [appItems, isPrime]
  );

  return (
    <div>
      {/* Action chips row (navigates to existing areas; only UX styling changed) */}
      <div className="v3-chip-row">
        <button className="v3-chip" onClick={() => navigate("/v3/wallet")}>Deposit</button>
        <button className="v3-chip" onClick={() => navigate("/v3/wallet")}>Withdraw</button>
        <button className="v3-chip" onClick={() => navigate("/user/promo-packages")}>Plan</button>
      </div>

      {/* Quick Apps */}
      <div className="v3-section">
        <div className="v3-section-header">
          <div className="v3-section-title">Quick Apps</div>
        </div>
        <div className="v3-card" style={{ padding: 8 }}>
          <AppsGrid items={appItemsWithBadge} variant="image" columns={{ xs: 2, sm: 3, md: 4 }} />
        </div>
      </div>

      {/* Agency Products */}
      <div className="v3-section">
        <div className="v3-section-header">
          <div className="v3-section-title">Agency Products</div>
        </div>
        <div className="v3-card" style={{ padding: 16 }}>
          {loadingCards ? (
            <div className="v3-muted">Loading cards...</div>
          ) : (
            <div
              className="v3-grid"
              style={{
                gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
              }}
            >
              <style>
                {`@media (min-width: 600px) {.v3-products-grid {grid-template-columns: repeat(2, minmax(0, 1fr));}} 
                   @media (min-width: 900px) {.v3-products-grid {grid-template-columns: repeat(3, minmax(0, 1fr));}}`}
              </style>
              <div className="v3-grid v3-products-grid" style={{ gap: 12 }}>
                {(Array.isArray(cards) ? cards : [])
                  .filter((c) => c.is_active !== false)
                  .map((card) => (
                    <div
                      key={card.id || card.key}
                      className="v3-card v3-click"
                      style={{ overflow: "hidden" }}
                      onClick={() => navigate("/trikonekt-products")}
                    >
                      {card.image ? (
                        <img
                          src={card.image?.startsWith("http") ? card.image : `${MEDIA_BASE}${card.image}`}
                          alt={card.title}
                          style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                        />
                      ) : null}
                      <div style={{ padding: 12 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#fff", marginBottom: 6 }}>
                          {card.title}
                        </div>
                        <div className="v3-muted" style={{ fontSize: 13 }}>
                          {card.description || ""}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
