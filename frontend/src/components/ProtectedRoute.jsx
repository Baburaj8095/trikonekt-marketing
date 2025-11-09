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

function getStoredAccess() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function getStoredRefresh() {
  return localStorage.getItem("refresh") || sessionStorage.getItem("refresh");
}

function setAccessToken(newAccess) {
  if (localStorage.getItem("refresh")) {
    localStorage.setItem("token", newAccess);
  } else if (sessionStorage.getItem("refresh")) {
    sessionStorage.setItem("token", newAccess);
  } else if (localStorage.getItem("token")) {
    localStorage.setItem("token", newAccess);
  } else {
    sessionStorage.setItem("token", newAccess);
  }
}

function clearTokens() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
  } catch {}
  try {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("refresh");
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

        // If no access or expired, try refresh once
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
            clearTokens();
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
