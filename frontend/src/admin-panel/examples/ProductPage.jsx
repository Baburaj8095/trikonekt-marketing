import React from "react";
import ModelListSimple from "../dynamic/ModelListSimple";

/**
 * Example page pinned to market.Product using SimpleTable + dialog edit.
 * Route: /admin/dashboard/examples/products
 */
export default function ProductPage() {
  return <ModelListSimple app="market" model="product" />;
}
