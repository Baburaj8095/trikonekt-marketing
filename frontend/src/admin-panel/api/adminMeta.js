import API, { ensureFreshAccess, getAccessToken } from "../../api/api";

/**
 * Admin meta API helpers with caching and in-flight dedupe.
 *
 * getAdminMeta() -> summary only (no heavy per-field metadata), cached for 5 minutes
 * getModelFields(app, model) -> fetches fields for a single model, cached for 10 minutes
 * getModelsList(meta) -> convenience accessor
 * findModel(metaOrList, app, model) -> find one model record
 * primeAdminMeta(data) -> seed the summary cache manually
 *
 * Notes:
 * - Summary payload keeps: app_label, model, verbose names, route, list_display, search_fields, list_filter, actions, permissions
 * - Fields are fetched lazily per model via /admin/admin-meta/fields/:app/:model/
 * - Uses window-scoped cache to survive Fast Refresh
 */

const g = (typeof window !== "undefined" ? window : globalThis);

const CLIENT_META_VERSION = 2;
if (!g.__ADMIN_META_CACHE_VER__) g.__ADMIN_META_CACHE_VER__ = 0;

// Summary cache
if (!g.__ADMIN_META_CACHE__) g.__ADMIN_META_CACHE__ = null;
if (!g.__ADMIN_META_CACHE_TS__) g.__ADMIN_META_CACHE_TS__ = 0;
if (!g.__ADMIN_META_INFLIGHT__) g.__ADMIN_META_INFLIGHT__ = null;
const META_TTL = 5 * 60 * 1000; // 5 minutes

// Fields cache (per model)
if (!g.__ADMIN_FIELDS_CACHE__) g.__ADMIN_FIELDS_CACHE__ = {}; // key -> { data, ts }
if (!g.__ADMIN_FIELDS_INFLIGHT__) g.__ADMIN_FIELDS_INFLIGHT__ = {}; // key -> Promise
const FIELDS_TTL = 10 * 60 * 1000; // 10 minutes

function joinUrl(base, path) {
  const b2 = base.endsWith("/") ? base : base + "/";
  const p2 = path.startsWith("/") ? path.slice(1) : path;
  return b2 + p2;
}

function getBase() {
  return API?.defaults?.baseURL || "/api/";
}

function isFresh(ts, ttl) {
  return ts && (Date.now() - ts) < ttl;
}

export async function getAdminMeta() {
  // Serve fresh cache
  if (g.__ADMIN_META_CACHE__ && g.__ADMIN_META_CACHE_VER__ === CLIENT_META_VERSION && isFresh(g.__ADMIN_META_CACHE_TS__, META_TTL)) {
    return g.__ADMIN_META_CACHE__;
  }
  // Reuse in-flight
  if (g.__ADMIN_META_INFLIGHT__) return g.__ADMIN_META_INFLIGHT__;

  const base = getBase();
  const fullUrl = joinUrl(base, "/admin/admin-meta/summary/");

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
    g.__ADMIN_META_CACHE_TS__ = Date.now();
    g.__ADMIN_META_CACHE_VER__ = CLIENT_META_VERSION;
    return g.__ADMIN_META_CACHE__;
  })().finally(() => {
    g.__ADMIN_META_INFLIGHT__ = null;
  });

  return g.__ADMIN_META_INFLIGHT__;
}

export async function getModelFields(app, model) {
  const key = `${String(app).toLowerCase()}.${String(model).toLowerCase()}`;
  const cached = g.__ADMIN_FIELDS_CACHE__[key];
  if (cached && isFresh(cached.ts, FIELDS_TTL)) {
    return cached.data;
  }
  if (g.__ADMIN_FIELDS_INFLIGHT__[key]) {
    return g.__ADMIN_FIELDS_INFLIGHT__[key];
  }

  const base = getBase();
  const fullUrl = joinUrl(base, `/admin/admin-meta/fields/${encodeURIComponent(app)}/${encodeURIComponent(model)}/`);

  g.__ADMIN_FIELDS_INFLIGHT__[key] = (async () => {
    let token = await ensureFreshAccess();
    if (!token) token = getAccessToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const resp = await fetch(fullUrl, { method: "GET", headers });
    if (!resp.ok) {
      let detail = "Failed to load model fields";
      try {
        const d = await resp.json();
        detail = d?.detail || detail;
      } catch (_) {}
      throw new Error(detail);
    }
    const data = await resp.json().catch(() => ({}));
    const fields = Array.isArray(data?.fields) ? data.fields : [];
    g.__ADMIN_FIELDS_CACHE__[key] = { data: fields, ts: Date.now() };
    return fields;
  })().finally(() => {
    g.__ADMIN_FIELDS_INFLIGHT__[key] = null;
  });

  return g.__ADMIN_FIELDS_INFLIGHT__[key];
}

export function getModelsList(meta) {
  return (meta && Array.isArray(meta.models)) ? meta.models : [];
}

export function findModel(metaOrList, app, model) {
  const list = Array.isArray(metaOrList) ? metaOrList : getModelsList(metaOrList);
  return list.find((m) => m.app_label === app && m.model === model) || null;
}

export function primeAdminMeta(data) {
  g.__ADMIN_META_CACHE__ = data || {};
  g.__ADMIN_META_CACHE_TS__ = Date.now();
}
