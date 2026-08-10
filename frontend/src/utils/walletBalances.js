function toMoneyNumber(value) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const num = toMoneyNumber(value);
    if (num > 0) return num;
  }
  return 0;
}

function pickTransferWallet(wallet, keys) {
  const transferWallets = wallet?.transfer_wallets || {};
  return firstPositiveNumber(...keys.map((key) => transferWallets?.[key]));
}

function addMoneyHistoryBalance(history) {
  const rows = [
    ...(Array.isArray(history?.incoming) ? history.incoming : []),
    ...(Array.isArray(history?.recent) ? history.recent : []),
    ...(Array.isArray(history?.results) ? history.results : []),
    ...(Array.isArray(history) ? history : []),
  ];
  const seen = new Set();
  return rows.reduce((sum, row) => {
    const key = row?.id ?? `${row?.type || ""}:${row?.source_type || ""}:${row?.source_id || ""}:${row?.created_at || ""}`;
    if (seen.has(key)) return sum;
    seen.add(key);

    const meta = row?.meta || {};
    const sourceType = String(row?.source_type || "").toUpperCase();
    const isAddMoney =
      String(row?.type || "").toUpperCase().includes("ADD_MONEY") ||
      String(meta?.pocket || "").toLowerCase() === "add_money" ||
      ["WALLET_UPLOAD", "UPLOAD_TO_WALLET", "PACKAGE_UPLOAD", "PACKAGE_BUY_UPLOAD"].includes(sourceType) ||
      String(meta?.wallet || "").toUpperCase() === "ADD_MONEY" ||
      String(meta?.destination_wallet || "").toUpperCase() === "ADD_MONEY_POCKET" ||
      String(meta?.legacy_wallet_type || "").toUpperCase() === "ADD_MONEY_POCKET" ||
      String(meta?.wallet_source || "").toLowerCase() === "package_upload";

    return isAddMoney ? sum + toMoneyNumber(row?.amount) : sum;
  }, 0);
}

export function getSelfPackageWalletBalance(wallet) {
  return firstPositiveNumber(
    pickTransferWallet(wallet, ["internal", "selfPackage", "self_package"]),
    wallet?.internal_wallet_balance,
    wallet?.self_package_pocket_balance
  );
}

export function getPackagePurchaseCouponBalance(wallet) {
  return firstPositiveNumber(
    pickTransferWallet(wallet, [
      "packagePurchaseCoupon",
      "package_purchase_coupon",
      "packageCoupon",
      "package_coupon",
    ]),
    wallet?.package_purchase_coupon_balance,
    wallet?.package_coupon_wallet_balance
  );
}

export function getAddMoneyPocketBalance(wallet, history = null) {
  const directBal = wallet?.pockets?.add_money ?? wallet?.add_money_pocket ?? wallet?.add_money_pocket_balance ?? wallet?.package_upload_balance;
  if (directBal !== undefined && directBal !== null && directBal !== "") {
    const num = Number(directBal);
    if (!isNaN(num)) return Math.max(0, num);
  }
  const summaryBalance = firstPositiveNumber(
    pickTransferWallet(wallet, ["packageUpload", "package_upload", "addMoney", "add_money"])
  );
  if (summaryBalance > 0) return summaryBalance;
  return Math.max(0, addMoneyHistoryBalance(history));
}
