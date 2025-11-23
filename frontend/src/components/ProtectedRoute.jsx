import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import API, { ensureFreshAccess } from "../api/api";

function parseJwt(token) {
  try {
    const [, payload] = String(token || "").split(".");
    if (!payload) return null;
    // Handle base64url (JWT) decoding
    let base = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base.length % 4;
    if (pad) base += "=".repeat(4 - pad);
    return JSON.parse(atob(base));
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
        const now = Math.floor(Date.now() / 1000);
        let claim = access ? parseJwt(access) : null;
        let exp = claim?.exp || 0;

        // If access exists but appears expired, attempt one refresh
        if (access && exp && exp <= now) {
          try {
            const newAccess = await ensureFreshAccess();
            if (newAccess) {
              access = newAccess;
              claim = parseJwt(newAccess);
              exp = claim?.exp || 0;
            }
          } catch (_) {}
        }
        // If no access at all, try to mint one (e.g., refresh flow)
        if (!access) {
          try {
            const newAccess = await ensureFreshAccess();
            if (newAccess) {
              access = newAccess;
              claim = parseJwt(newAccess);
              exp = claim?.exp || 0;
            }
          } catch (_) {}
        }

        // Final decision:
        if (!access) {
          if (!cancelled) {
            try {
              if (typeof window !== "undefined") window.__tk_auth_blocked = true;
            } catch {}
            setGranted(false);
            setPayload(null);
          }
          return;
        }
        // If token has no exp (opaque or non-JWT), accept it
        if (exp && exp <= Math.floor(Date.now() / 1000)) {
          if (!cancelled) {
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
    const ns = currentNamespaceFromPath();
    const claimRoleRaw = payload?.role || "";
    const cr = String(claimRoleRaw || "").toLowerCase();

    // Prefer the route namespace for non-consumer areas so impersonation tokens
    // with a "user" role still pass guards on /agency and /employee routes.
    let normalized = ns;
    if (ns === "agency" || ns === "employee" || ns === "business") {
      normalized = ns; // force namespace
    } else {
      // For consumer (user) area, map token roles to app namespaces
      if (cr.startsWith("agency")) normalized = "agency";
      else if (cr.startsWith("employee")) normalized = "employee";
      else normalized = (cr === "user" || cr === "consumer" || cr === "") ? "user" : "user";
    }

    if (!allowedRoles.includes(normalized)) {
      const target = `/${normalized}/dashboard`;
      return <Navigate to={target} replace />;
    }
  }

  return children;
}
