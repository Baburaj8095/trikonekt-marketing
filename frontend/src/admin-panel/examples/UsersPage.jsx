import React from "react";
import ModelListSimple from "../dynamic/ModelListSimple";

/**
 * Example Users page pinned to accounts.CustomUser using SimpleTable + dialog edit.
 * Route: /admin/dashboard/examples/users
 */
export default function UsersPage() {
  return <ModelListSimple app="accounts" model="customuser" />;
}
