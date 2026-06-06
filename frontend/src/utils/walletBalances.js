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

export function getAddMoneyPocketBalance(wallet) {
  return firstPositiveNumber(
    pickTransferWallet(wallet, ["packageUpload", "package_upload", "addMoney", "add_money"]),
    wallet?.add_money_pocket_balance,
    wallet?.package_upload_balance
  );
}
