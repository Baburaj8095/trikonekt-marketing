import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import API, { ensureFreshAccess } from "../api/api";

function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function currentNamespaceFromPath() {
  try {
    const p = typeof window !== "undefined" ? window.location.pathname : "";
    if (p.startsWith("/agency")) return "agency";
    if (p.startsWith("/employee")) return "employee";
    if (p.startsWith("/business")) return "business";
    return "user";
  } catch {
    return "user";
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

export default function ProtectedRoute({ children, allowedRoles }) {
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

        // If no access or expired, try refresh once via keep-alive helper
        if (!access || !claim || !exp || exp <= now) {
          try {
            const newAccess = await ensureFreshAccess();
            if (newAccess) {
              access = newAccess;
              claim = parseJwt(newAccess);
              exp = claim?.exp || 0;
            }
          } catch (_) {
            // ignore
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

        if (!cancelled) {
          setGranted(true);
          setPayload(claim);
        }
      } finally {
        if (!cancelled) setPending(false);
      }
    }
    checkAuth();
    // Re-check on path or query changes
  }, [location.pathname, location.search]);

  if (pending) {
    // Optionally return a small placeholder to avoid layout jank
    return null;
  }

  if (!granted) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const role = payload?.role;
    if (!role || !allowedRoles.includes(role)) {
      const target = role ? `/${role}/dashboard` : "/login";
      return <Navigate to={target} replace />;
    }
  }

  return children;
}
