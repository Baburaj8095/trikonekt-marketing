import API from "../../api/api";

/**
 * Shared admin-meta cache to prevent duplicate network requests across the app,
 * even during Fast Refresh or when multiple components request it at once.
 *
 * - getAdminMeta(): returns full payload { models: [...] } with caching and in-flight dedupe
 * - getModelsList(meta): convenience to read models array
 * - findModel(metaOrList, app, model): find a specific model meta
 * - primeAdminMeta(data): manually seed cache if needed
 *
 * Implementation notes:
 * - Uses a window-scoped cache to survive module reloads during dev (Fast Refresh).
 * - In-flight promise dedupes concurrent callers so only one HTTP request is sent.
 */

const g = (typeof window !== "undefined" ? window : globalThis);
if (!g.__ADMIN_META_CACHE__) g.__ADMIN_META_CACHE__ = null;
if (!g.__ADMIN_META_INFLIGHT__) g.__ADMIN_META_INFLIGHT__ = null;

export async function getAdminMeta() {
  if (g.__ADMIN_META_CACHE__) return g.__ADMIN_META_CACHE__;
  if (g.__ADMIN_META_INFLIGHT__) return g.__ADMIN_META_INFLIGHT__;

  g.__ADMIN_META_INFLIGHT__ = API.get("admin/admin-meta/")
    .then((res) => {
      const data = res?.data || {};
      g.__ADMIN_META_CACHE__ = data;
      return data;
    })
    .finally(() => {
      g.__ADMIN_META_INFLIGHT__ = null;
    });

  return g.__ADMIN_META_INFLIGHT__;
}

export function getModelsList(meta) {
  return (meta && Array.isArray(meta.models)) ? meta.models : [];
}

export function findModel(metaOrList, app, model) {
  const list = Array.isArray(metaOrList) ? metaOrList : getModelsList(metaOrList);
  return list.find((m) => m.app_label === app && m.model === model) || null;
}

export function primeAdminMeta(data) {
  g.__ADMIN_META_CACHE__ = data;
}
