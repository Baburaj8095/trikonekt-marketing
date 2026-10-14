import { useState, useEffect } from "react";
import API, { listMyPromoPurchases, getUpgradeEligibility } from "../api/api";

export function resolveUserTierBadgeSync(user, promoPurchases = [], rankLevel = 0) {
  const rawRole = String(user?.role || user?.category || user?.user_type || "").toLowerCase();

  // If user has an explicit franchise/agency role, display that role
  if (
    rawRole.includes("agency") ||
    rawRole.includes("coordinator") ||
    rawRole.includes("merchant") ||
    rawRole.includes("captain")
  ) {
    return user?.role_name || user?.role || user?.category || "Agency";
  }

  // 1. Check direct level / rank numbers
  const levelNum = Number(
    rankLevel ||
    user?.achieved_level ||
    user?.rank_level ||
    user?.current_level ||
    user?.highest_rank ||
    user?.rank ||
    user?.current_rank ||
    0
  );

  let has40k = false;
  let has8k = false;
  let has2k = false;

  const pkgStr = String(
    user?.package ||
    user?.package_name ||
    user?.active_package ||
    user?.prime_package ||
    ""
  ).toLowerCase();
  const pkgAmt = Number(user?.package_amount || user?.package_price || 0);

  if (pkgAmt >= 40000 || pkgStr.includes("40000") || pkgStr.includes("promoter")) {
    has40k = true;
  } else if (pkgAmt >= 8000 || pkgStr.includes("8000") || pkgStr.includes("super")) {
    has8k = true;
  } else if (pkgAmt >= 2000 || pkgStr.includes("2000") || pkgStr.includes("prime") || pkgStr.includes("starter")) {
    has2k = true;
  }

  // Check promoPurchases list
  if (Array.isArray(promoPurchases)) {
    for (const pp of promoPurchases) {
      const status = String(pp?.status || "").toUpperCase();
      if (status === "APPROVED" || status === "ACTIVE") {
        const pPrice = Number(pp?.package?.price || pp?.price || 0);
        const pName = String(pp?.package?.name || pp?.name || "").toLowerCase();
        if (pPrice >= 40000 || pName.includes("40000") || pName.includes("promoter")) {
          has40k = true;
        } else if (pPrice >= 8000 || pName.includes("8000") || pName.includes("super")) {
          has8k = true;
        } else if (pPrice >= 2000 || pName.includes("2000") || pName.includes("prime") || pName.includes("750") || pName.includes("starter")) {
          has2k = true;
        }
      }
    }
  }

  if (levelNum >= 10 || has40k) {
    return "L10 District Promoter agent";
  }
  if ((levelNum >= 7 && levelNum <= 9) || has8k) {
    return "L7-L9 Super Agent";
  }
  return "L1-L6 agent";
}

export function useUserTierBadge(user) {
  const [badge, setBadge] = useState(() => {
    try {
      const cached = localStorage.getItem("tri_user_tier_badge");
      if (cached) return cached;
    } catch (_) {}
    return resolveUserTierBadgeSync(user);
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [purchasesRes, eligRes] = await Promise.allSettled([
          listMyPromoPurchases().catch(() => []),
          getUpgradeEligibility().catch(() => null),
        ]);

        if (!alive) return;

        const purchases = purchasesRes.status === "fulfilled" && Array.isArray(purchasesRes.value)
          ? purchasesRes.value
          : (purchasesRes.value?.results || []);
        const rankLevel = eligRes.status === "fulfilled"
          ? Number(eligRes.value?.achieved_level || eligRes.value?.current_level || 0)
          : 0;

        const resolved = resolveUserTierBadgeSync(user, purchases, rankLevel);
        setBadge(resolved);
        try {
          localStorage.setItem("tri_user_tier_badge", resolved);
        } catch (_) {}
      } catch (_) {
        if (!alive) return;
        const resolved = resolveUserTierBadgeSync(user);
        setBadge(resolved);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  return badge;
}
