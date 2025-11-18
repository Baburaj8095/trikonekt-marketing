import API, { ensureFreshAccess, getAccessToken } from "../../api/api";

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

  const base = API?.defaults?.baseURL || "/api/";
  const joinUrl = (b, p) => {
    const b2 = b.endsWith("/") ? b : b + "/";
    const p2 = p.startsWith("/") ? p.slice(1) : p;
    return b2 + p2;
  };
  const fullUrl = joinUrl(base, "/admin/admin-meta/");

  g.__ADMIN_META_INFLIGHT__ = (async () => {
    let token = await ensureFreshAccess();
    if (!token) token = getAccessToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const resp = await fetch(fullUrl, { method: "GET", headers });
    if (!resp.ok) {
      let detail = "Failed to load admin metadata";
      try {
        const d = await resp.json();
        detail = d?.detail || detail;
      } catch (_) {}
      throw new Error(detail);
    }
    const data = await resp.json().catch(() => ({}));
    g.__ADMIN_META_CACHE__ = data || {};
    return g.__ADMIN_META_CACHE__;
  })().finally(() => {
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
