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

export default function AdminProtectedRoute({ children }) {
  const location = useLocation();
  const access = getStoredAccess();

  if (!access) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  const payload = parseJwt(access);
  const now = Math.floor(Date.now() / 1000);
  const exp = payload?.exp || 0;

  if (!payload || !exp || exp <= now) {
    clearTokens();
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  const isStaff = !!payload?.is_staff;
  const isSuperuser = !!payload?.is_superuser;

  if (!(isStaff || isSuperuser)) {
    // Redirect non-admin users to their dashboard based on role
    const role = payload?.role;
    const target = role ? `/${role}/dashboard` : "/login";
    return <Navigate to={target} replace />;
  }

  return children;
}
