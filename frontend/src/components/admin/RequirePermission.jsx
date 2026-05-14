import React from "react";
import API, { getAccessToken, ensureFreshAccess } from "../../api/api";
import { hasPermission } from "../../admin/permissions";

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
  const depKey = React.useMemo(() => {
    try {
      const arr = Array.isArray(anyOf) ? Array.from(new Set(anyOf)).sort() : [];
      return JSON.stringify(arr);
    } catch (_) {
      return String(anyOf);
    }
  }, [anyOf]);

  React.useEffect(() => {
    let cancelled = false;
    let cancelledByDedupe = false;
    const g = typeof window !== "undefined" ? window : globalThis;
    const TTL = 60 * 1000; // cache admin/me for 60s to avoid duplicate calls
  
    async function getMe() {
      try {
        if (g.__ADMIN_ME_CACHE__ && g.__ADMIN_ME_TS__ && Date.now() - g.__ADMIN_ME_TS__ < TTL) {
          return g.__ADMIN_ME_CACHE__;
        }
        if (g.__ADMIN_ME_INFLIGHT__) {
          return await g.__ADMIN_ME_INFLIGHT__;
        }
        g.__ADMIN_ME_INFLIGHT__ = (async () => {
          // Wait briefly for token presence (post-login)
          let tries = 0;
          while (!getAccessToken() && tries < 20) {
            await new Promise((r) => setTimeout(r, 100));
            tries += 1;
          }
          try { await ensureFreshAccess(); } catch (_) {}
          const res = await API.get("admin/me/", {
            timeout: 8000,
            retryAttempts: 0,
            dedupe: "none",
            cacheTTL: TTL,
          });
          const data = res?.data || {};
          g.__ADMIN_ME_CACHE__ = data;
          g.__ADMIN_ME_TS__ = Date.now();
          return data;
        })().finally(() => {
          g.__ADMIN_ME_INFLIGHT__ = null;
        });
        return await g.__ADMIN_ME_INFLIGHT__;
      } catch (e) {
        try { g.__ADMIN_ME_CACHE__ = null; g.__ADMIN_ME_TS__ = 0; } catch (_) {}
        throw e;
      }
    }
  
    (async () => {
      setLoading(true);
      try {
        const data = await getMe();
        const u = data?.user || {};
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];
        const isSuper = !!u.is_superuser;
        if (isSuper) {
          if (!cancelled) setAllowed(true);
          return;
        }
        const needed = (() => {
          try { return JSON.parse(depKey) || []; } catch { return []; }
        })();
        if (!Array.isArray(needed) || needed.length === 0) {
          if (!cancelled) setAllowed(false);
          return;
        }
        const ok = hasPermission(perms, needed);
        if (!cancelled) setAllowed(ok);
      } catch (e) {
        const msg = (e && (e.message || e.code)) || "";
        if (
          msg === "deduped" ||
          msg === "ERR_CANCELED" ||
          /canceled|cancelled|aborted/i.test(String(msg)) ||
          (e && e.__canceled)
        ) {
          // Ignore cancellation/dedupe; do not mark as forbidden
          cancelledByDedupe = true;
          return;
        }
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled && !cancelledByDedupe) setLoading(false);
      }
    })();
  
    return () => { cancelled = true; };
  }, [depKey]);

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
