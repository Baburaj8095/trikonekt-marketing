import React from "react";
import { Navigate, useLocation } from "react-router-dom";

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
  const access = getStoredAccess();

  if (!access) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const payload = parseJwt(access);
  const now = Math.floor(Date.now() / 1000);
  const exp = payload?.exp || 0;

  if (!payload || !exp || exp <= now) {
    clearTokens();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const role = payload.role;
    if (!role || !allowedRoles.includes(role)) {
      const target = role ? `/${role}/dashboard` : "/login";
      return <Navigate to={target} replace />;
    }
  }

  return children;
}
