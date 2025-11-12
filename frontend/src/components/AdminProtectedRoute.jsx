import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import API from "../api/api";

function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function currentNamespaceFromPath() {
  // Admin-only guard, but keep generic for safety
  try {
    const p = typeof window !== "undefined" ? window.location.pathname : "";
    if (p.startsWith("/admin")) return "admin";
    return "admin";
  } catch {
    return "admin";
  }
}

function getStoredAccess() {
  const ns = currentNamespaceFromPath();
  return (
    (typeof localStorage !== "undefined" && localStorage.getItem(`token_${ns}`)) ||
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem(`token_${ns}`)) ||
    null
  );
}

function getStoredRefresh() {
  const ns = currentNamespaceFromPath();
  return (
    (typeof localStorage !== "undefined" && localStorage.getItem(`refresh_${ns}`)) ||
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem(`refresh_${ns}`)) ||
    null
  );
}

function setAccessToken(newAccess) {
  const ns = currentNamespaceFromPath();
  // Write to the same storage type where the namespaced refresh token is stored
  if (typeof localStorage !== "undefined" && localStorage.getItem(`refresh_${ns}`)) {
    localStorage.setItem(`token_${ns}`, newAccess);
  } else if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(`refresh_${ns}`)) {
    sessionStorage.setItem(`token_${ns}`, newAccess);
  } else if (typeof localStorage !== "undefined") {
    localStorage.setItem(`token_${ns}`, newAccess);
  } else if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(`token_${ns}`, newAccess);
  }
}

function clearTokens() {
  const ns = currentNamespaceFromPath();
  try {
    localStorage.removeItem(`token_${ns}`);
    localStorage.removeItem(`refresh_${ns}`);
  } catch {}
  try {
    sessionStorage.removeItem(`token_${ns}`);
    sessionStorage.removeItem(`refresh_${ns}`);
  } catch {}
}

export default function AdminProtectedRoute({ children }) {
  const location = useLocation();
  const [pending, setPending] = useState(true);
  const [granted, setGranted] = useState(false);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        let access = getStoredAccess();
        let claim = access ? parseJwt(access) : null;
        const now = Math.floor(Date.now() / 1000);
        let exp = claim?.exp || 0;

        // If no access or expired, try refresh once (namespaced)
        if (!access || !claim || !exp || exp <= now) {
          const refresh = getStoredRefresh();
          if (refresh) {
            try {
              const resp = await API.post("/accounts/token/refresh/", { refresh });
              const newAccess = resp?.data?.access;
              if (newAccess) {
                setAccessToken(newAccess);
                access = newAccess;
                claim = parseJwt(newAccess);
                exp = claim?.exp || 0;
              }
            } catch (_) {
              // fall through to clear below
            }
          }
        }

        if (!access || !claim || !exp || exp <= Math.floor(Date.now() / 1000)) {
          if (!cancelled) {
            try {
              if (typeof window !== "undefined") {
                window.__tk_auth_blocked = true;
              }
            } catch {}
            setGranted(false);
            setPayload(null);
          }
          return;
        }

        // Admin-only: allow staff or superuser
        const isStaff = !!claim?.is_staff;
        const isSuperuser = !!claim?.is_superuser;
        if (!(isStaff || isSuperuser)) {
          if (!cancelled) {
            setGranted(false);
            setPayload(claim);
          }
          return;
        }

        if (!cancelled) {
          setGranted(true);
          setPayload(claim);
        }
      } finally {
        if (!cancelled) setPending(false);
      }
    }
    checkAuth();
  }, [location.pathname, location.search]);

  if (pending) {
    // Avoid layout jank while checking auth
    return null;
  }

  if (!granted) {
    // If user is authenticated but not admin, route to their dashboard
    const role = payload?.role;
    if (role && !(payload?.is_staff || payload?.is_superuser)) {
      return <Navigate to={`/${role}/dashboard`} replace />;
    }
    // Not authenticated, or refresh failed
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
}
