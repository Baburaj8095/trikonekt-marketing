import React from "react";
import { useParams } from "react-router-dom";
import ModelListSimple from "./ModelListSimple";

/**
 * ModelList (Simple)
 * Unified dynamic model list page using SimpleTable + dialog-based Create/Edit.
 * Replaces previous DataGrid-based implementation for stability.
 *
 * Route: /admin/dashboard/models/:app/:model
 */
export default function ModelList() {
  const { app, model } = useParams();
  return <ModelListSimple app={app} model={model} />;
}
