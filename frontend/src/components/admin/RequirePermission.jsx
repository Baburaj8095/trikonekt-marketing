import React from "react";
import API, { getAccessToken, ensureFreshAccess } from "../../api/api";

/**
 * RequirePermission
 * - Enforces RBAC permissions on admin pages (default deny).
 * - anyOf: array of permission codes (e.g., ["manage_users", "show_users"])
 * - Renders a 403 view when not allowed.
 *
 * Notes:
 * - Super Admin bypasses all checks.
 * - Inactive admins are blocked by backend; this component provides UI gating.
 */
export default function RequirePermission({ anyOf = [], children, Fallback403 }) {
  const [loading, setLoading] = React.useState(true);
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        let tries = 0;
        while (!getAccessToken() && tries < 20) {
          await new Promise((r) => setTimeout(r, 100));
          tries += 1;
        }
        try { await ensureFreshAccess(); } catch (_) {}
        const res = await API.get("admin/me/", { timeout: 8000, retryAttempts: 0 });
        const data = res?.data || {};
        const u = data?.user || {};
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];
        const isSuper = !!u.is_superuser;
        if (isSuper) {
          if (!cancelled) setAllowed(true);
          return;
        }
        if (!Array.isArray(anyOf) || anyOf.length === 0) {
          if (!cancelled) setAllowed(false);
          return;
        }
        const ok = anyOf.some((c) => perms.includes(c));
        if (!cancelled) setAllowed(ok);
      } catch (e) {
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [anyOf]);

  if (loading) {
    return (
      <div style={{ padding: 12, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 10 }}>
        Checking permissions...
      </div>
    );
  }

  if (!allowed) {
    if (Fallback403) return <Fallback403 />;
    return (
      <div style={{ padding: 16, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 10 }}>
        403  You do not have permission to access this page.
      </div>
    );
  }

  return <>{children}</>;
}

