import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminPermissions } from "./usePermissions";

export default function RouteGuard({ permission, anyOf, children }) {
  const location = useLocation();
  const { loading, can } = useAdminPermissions();

  if (loading) return null;
  const required = anyOf || permission;
  if (!can(required)) {
    return <Navigate to="/admin/dashboard" replace state={{ deniedFrom: location.pathname }} />;
  }
  return <>{children}</>;
}
