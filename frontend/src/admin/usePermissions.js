import React from "react";
import API from "../api/api";
import { expandPermissions, hasPermission } from "./permissions";

const TTL = 60 * 1000;

export function useAdminPermissions() {
  const [state, setState] = React.useState({ loading: true, permissions: [], user: null, error: "" });

  React.useEffect(() => {
    let cancelled = false;
    const g = typeof window !== "undefined" ? window : globalThis;

    async function load() {
      try {
        if (g.__ADMIN_ME_CACHE__ && g.__ADMIN_ME_TS__ && Date.now() - g.__ADMIN_ME_TS__ < TTL) {
          const data = g.__ADMIN_ME_CACHE__;
          if (!cancelled) {
            setState({ loading: false, permissions: expandPermissions(data?.permissions || []), user: data?.user || null, error: "" });
          }
          return;
        }
        const res = await API.get("admin/me/", { cacheTTL: TTL, dedupe: "none", timeout: 8000 });
        const data = res?.data || {};
        g.__ADMIN_ME_CACHE__ = data;
        g.__ADMIN_ME_TS__ = Date.now();
        if (!cancelled) {
          setState({ loading: false, permissions: expandPermissions(data.permissions || []), user: data.user || null, error: "" });
        }
      } catch (e) {
        if (!cancelled) {
          setState({ loading: false, permissions: [], user: null, error: e?.message || "Failed to load permissions" });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const can = React.useCallback((required) => hasPermission(state.permissions, required) || !!state.user?.is_superuser, [state.permissions, state.user]);
  return { ...state, can };
}
