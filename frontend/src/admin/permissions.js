export const PERMISSIONS = Object.freeze({
  DASHBOARD_READ: "dashboard.read",
  USERS_READ: "users.read",
  USERS_WRITE: "users.write",
  USERS_DELETE: "users.delete",
  ROLES_READ: "roles.read",
  ROLES_MANAGE: "roles.manage",
  PERMISSIONS_READ: "permissions.read",
  PERMISSIONS_MANAGE: "permissions.manage",
  WITHDRAWALS_READ: "withdrawals.read",
  WITHDRAWALS_APPROVE: "withdrawals.approve",
  WALLET_READ: "wallet.read",
  WALLET_ADJUST: "wallet.adjust",
  KYC_READ: "kyc.read",
  KYC_APPROVE: "kyc.approve",
  REPORTS_READ: "reports.read",
  SETTINGS_MANAGE: "settings.manage",
  SUPPORT_READ: "support.read",
  SUPPORT_WRITE: "support.write",
  PROMO_READ: "promo.read",
  PROMO_APPROVE: "promo.approve",
  ECOUPONS_READ: "ecoupons.read",
  ECOUPONS_WRITE: "ecoupons.write",
  AUTOPPOOL_READ: "autopool.read",
  COMMISSIONS_READ: "commissions.read",
  COMMISSIONS_MANAGE: "commissions.manage",
});

export const ROUTE_PERMISSIONS = [
  { path: "/admin/users", permission: PERMISSIONS.USERS_READ },
  { path: "/admin/user-tree", permission: PERMISSIONS.USERS_READ },
  { path: "/admin/kyc", permission: PERMISSIONS.KYC_READ },
  { path: "/admin/withdrawals", permission: PERMISSIONS.WITHDRAWALS_READ },
  { path: "/admin/packages", permission: PERMISSIONS.PROMO_READ },
  { path: "/admin/promo-purchases", permission: PERMISSIONS.PROMO_READ },
  { path: "/admin/promo-package-products", permission: PERMISSIONS.PROMO_READ },
  { path: "/admin/wallet-upload-approvals", permission: PERMISSIONS.WALLET_READ },
  { path: "/admin/agency-prime-requests", permission: PERMISSIONS.PROMO_READ },
  { path: "/admin/lucky-draw", permission: PERMISSIONS.PROMO_READ },
  { path: "/admin/support", permission: PERMISSIONS.SUPPORT_READ },
  { path: "/admin/reports", permission: PERMISSIONS.REPORTS_READ },
  { path: "/admin_user", permission: PERMISSIONS.USERS_READ },
  { path: "/role", permission: PERMISSIONS.ROLES_READ },
  { path: "/permission", permission: PERMISSIONS.PERMISSIONS_READ },
  { path: "/user_permission", permission: PERMISSIONS.ROLES_MANAGE },
];

export const LEGACY_PERMISSION_ALIASES = Object.freeze({
  manage_dashboard: [PERMISSIONS.DASHBOARD_READ],
  manage_users: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_WRITE],
  show_users: [PERMISSIONS.USERS_READ],
  create_users: [PERMISSIONS.USERS_WRITE],
  edit_users: [PERMISSIONS.USERS_WRITE],
  delete_users: [PERMISSIONS.USERS_DELETE],
  manage_roles: [PERMISSIONS.ROLES_MANAGE],
  show_roles: [PERMISSIONS.ROLES_READ],
  create_roles: [PERMISSIONS.ROLES_MANAGE],
  edit_roles: [PERMISSIONS.ROLES_MANAGE],
  delete_roles: [PERMISSIONS.ROLES_MANAGE],
  manage_permissions: [PERMISSIONS.PERMISSIONS_MANAGE],
  show_permissions: [PERMISSIONS.PERMISSIONS_READ],
  create_permissions: [PERMISSIONS.PERMISSIONS_MANAGE],
  edit_permissions: [PERMISSIONS.PERMISSIONS_MANAGE],
  delete_permissions: [PERMISSIONS.PERMISSIONS_MANAGE],
});

export function expandPermissions(input = []) {
  const out = new Set(Array.isArray(input) ? input : []);
  Object.entries(LEGACY_PERMISSION_ALIASES).forEach(([legacy, canonical]) => {
    if (out.has(legacy)) canonical.forEach((p) => out.add(p));
    if (canonical.some((p) => out.has(p))) out.add(legacy);
  });
  return Array.from(out);
}

export function hasPermission(userPermissions = [], required) {
  if (!required) return true;
  const perms = new Set(expandPermissions(userPermissions));
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.some((code) => perms.has(code));
}
