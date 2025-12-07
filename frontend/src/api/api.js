import axios from "axios";
import { incrementLoading, decrementLoading } from "../hooks/loadingStore";

const rawBaseURL =
  process.env.REACT_APP_API_URL ||
  "/api";
const baseURL = rawBaseURL.endsWith("/") ? rawBaseURL : rawBaseURL + "/";

const API = axios.create({ baseURL });

// Separate client without interceptors for token refresh to avoid recursion/deadlocks
const refreshClient = axios.create({ baseURL });

// Performance defaults and helpers
const DEFAULT_TIMEOUT = 15000;
API.defaults.timeout = DEFAULT_TIMEOUT;
refreshClient.defaults.timeout = DEFAULT_TIMEOUT;

// In-flight request tracking and simple in-memory cache (GET)
const inflight = new Map(); // key -> { abort, cancel, ts }
const cache = new Map(); // key -> { data, headers, expiry }
const DEFAULT_GET_CACHE_TTL = 0; // default: no caching unless caller opts-in via config.cacheTTL

function makeRequestKey(cfg) {
  try {
    const method = (cfg.method || "get").toLowerCase();
    const url = cfg.url || "";
    const params = cfg.params || {};
    // Sanitize params: drop cache-busting keys and sort keys for stability
    const dropKeys = new Set(["_", "cacheBust", "cache_bust", "ts", "timestamp"]);
    const sanitize = (obj) => {
      if (obj == null || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      const out = {};
      Object.keys(obj)
        .filter((k) => !dropKeys.has(k))
        .sort()
        .forEach((k) => {
          out[k] = sanitize(obj[k]);
        });
      return out;
    };
    const paramsStr = JSON.stringify(sanitize(params));
    return `${method}:${url}?${paramsStr}`;
  } catch (_) {
    return `${cfg.method || "get"}:${cfg.url || ""}`;
  }
}

// Session namespace helpers: isolate tokens per role (admin, user, agency, employee, business)
function currentNamespace() {
  try {
    const p =
      typeof window !== "undefined" &&
      window.location &&
      typeof window.location.pathname === "string"
        ? window.location.pathname
        : "";
    if (p.startsWith("/admin")) return "admin";
    if (p.startsWith("/agency")) return "agency";
    if (p.startsWith("/employee")) return "employee";
    if (p.startsWith("/business")) return "business";
    return "user";
  } catch {
    return "user";
  }
}

function nsKey(base, ns) {
  return `${base}_${ns}`;
}

function readNamespaced(base) {
  // Strictly read namespaced keys only to prevent cross-role token leakage
  const ns = currentNamespace();
  const k = nsKey(base, ns);
  return (
    (typeof localStorage !== "undefined" && localStorage.getItem(k)) ||
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
    null
  );
}

function writeNamespaced(base, value) {
  const ns = currentNamespace();
  const k = nsKey(base, ns);
  // Persist in the same bucket where a refresh exists; fallback to localStorage for "never expire"
  const refreshKey = nsKey("refresh", ns);
  const hasLocal =
    typeof localStorage !== "undefined" &&
    localStorage.getItem(refreshKey) !== null;
  const hasSession =
    typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem(refreshKey) !== null;
  try {
    if (hasLocal) {
      localStorage.setItem(k, value);
      return;
    }
    if (hasSession) {
      sessionStorage.setItem(k, value);
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(k, value);
    } else if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(k, value);
    }
  } catch (_) {}
}

/**
 * JWT helpers to keep session active until logout or storage is cleared.
 */
let refreshingPromise = null;

function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function getAccessToken() {
  const t = readNamespaced("token");
  if (t) return t;
  // Fallback: if we're on an admin route but tokens exist under user namespace (e.g. logged in from non-admin URL)
  try {
    if (currentNamespace() !== "user") {
      const k = "token_user";
      const v =
        (typeof localStorage !== "undefined" && localStorage.getItem(k)) ||
        (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
        null;
      if (v) return v;
    }
  } catch (_) {}
  return null;
}

function getRefreshToken() {
  const r = readNamespaced("refresh");
  if (r) return r;
  // Fallback for cross-namespace login (e.g., admin using token from user namespace)
  try {
    if (currentNamespace() !== "user") {
      const k = "refresh_user";
      const v =
        (typeof localStorage !== "undefined" && localStorage.getItem(k)) ||
        (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
        null;
      if (v) return v;
    }
  } catch (_) {}
  return null;
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const resp = await refreshClient.post("accounts/token/refresh/", { refresh });
    const { access, refresh: newRefresh } = resp?.data || {};
    if (access) {
      writeNamespaced("token", access);
    }
    if (newRefresh) {
      writeNamespaced("refresh", newRefresh);
    }
    return access || null;
  } catch (_) {
    return null;
  }
}

async function ensureFreshAccess() {
  let token = getAccessToken();
  const hasRefresh = !!getRefreshToken();

  // If no access but we have a refresh, try to mint a new access
  if (!token && hasRefresh) {
    return await refreshAccessToken();
  }
  if (!token) return null;

  const payload = parseJwt(token);
  const now = Math.floor(Date.now() / 1000);
  const exp = payload?.exp || 0;
  const isExpiringSoon = exp && exp - now < 60; // refresh 60s before expiry
  if (!isExpiringSoon) return token;

  if (!refreshingPromise) {
    refreshingPromise = refreshAccessToken().finally(() => {
      refreshingPromise = null;
    });
  }
  const refreshed = await refreshingPromise;
  return refreshed || token;
}

/**
 * Redaction helpers for console logging ONLY (does not change the actual request payload).
 * Note: It's impossible to hide the password from your own browser's Network tab,
 * but we can ensure we never log it in the console or error traces.
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "new_password",
  "confirmPassword",
  "confirm_password",
  "old_password",
]);

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "******" : redact(v);
    }
    return out;
  }
  return value;
}

/* Performance: defaults, GET caching, and request de-duplication (latest wins). */
API.interceptors.request.use((config) => {
  try {
    // Apply default timeout if not provided
    if (config.timeout == null) {
      config.timeout = DEFAULT_TIMEOUT;
    }

    // Normalize request URL to work with both baseURL="/api" (dev proxy) and absolute REACT_APP_API_URL.
    // If url starts with "/", strip the leading slash when baseURL ends with "/api" or is absolute,
    // so axios appends the path instead of resetting to the origin root and avoids double "/api".
    try {
      const u = config?.url || "";
      if (typeof u === "string" && u.startsWith("/")) {
        const b = config.baseURL || API.defaults.baseURL || baseURL || "";
        const isAbs = /^https?:\/\//i.test(b);
        const bEndsWithApi = /\/api\/?$/.test(b);
        if (isAbs || bEndsWithApi) {
          // Example:
          //  - baseURL="/api", url="/uploads/cards/" -> "uploads/cards/" => "/api/uploads/cards/"
          //  - baseURL="http://localhost:8000/api", url="/uploads/cards/" -> "uploads/cards/" => "http://.../api/uploads/cards/"
          //  - If url already begins with "/api/", strip that prefix to avoid "/api/api/*" when using axios baseURL="/api"
          let path = u.startsWith("/api/") ? u.slice(5) : u.slice(1);
          config.url = path;
        }
      }
    } catch (_) {}

    const method = (config.method || "get").toLowerCase();

    if (method === "get") {
      const key = makeRequestKey(config);
      const ttl =
        typeof config.cacheTTL === "number" ? config.cacheTTL : DEFAULT_GET_CACHE_TTL;

      // Serve from cache using a custom adapter to short-circuit the network
      if (ttl > 0) {
        const entry = cache.get(key);
        if (entry && Date.now() < entry.expiry) {
          config._fromCache = true;
          config._skipLoadingTrack = true; // prevent spinner for cache hits
          config.adapter = async () => ({
            data: entry.data,
            status: 200,
            statusText: "OK",
            headers: entry.headers || {},
            config,
            request: null,
          });
          return config;
        }
      }

      // Request de-duplication: cancel previous in-flight identical GET, keep latest
      const strategy = config.dedupe || "cancelPrevious"; // "cancelPrevious" | "none"
      if (strategy !== "none") {
        const existing = inflight.get(key);
        if (existing) {
          try {
            existing.abort?.();
            existing.cancel?.("deduped");
          } catch (_) {}
        }
        // Prepare abort handle for current request
        let abort = null;
        let cancel = null;
        try {
          if (typeof AbortController !== "undefined" && !config.signal) {
            const controller = new AbortController();
            config.signal = controller.signal;
            abort = () => controller.abort();
          } else if (axios && axios.CancelToken && !config.cancelToken) {
            const src = axios.CancelToken.source();
            config.cancelToken = src.token;
            cancel = src.cancel;
          }
        } catch (_) {}
        inflight.set(key, { abort, cancel, ts: Date.now() });
        config._reqKey = key;
      }
    }
  } catch (_) {}
  return config;
});

/* Track loading + attach JWT Authorization header from storage when available. */
API.interceptors.request.use(async (config) => {
  // Skip refresh endpoint to prevent recursion/deadlock
  const url = config?.url || "";
  if (url.includes("/accounts/token/refresh/")) {
    return config;
  }

  // Track loading unless explicitly skipped (e.g., retried request)
  if (config._skipLoadingTrack) {
    try {
      delete config._skipLoadingTrack;
    } catch (_) {}
  } else {
    config._trackLoading = true;
    try {
      incrementLoading();
    } catch (_) {}
  }

  // Ensure we have a fresh access token before each request
  let token = await ensureFreshAccess();
  if (!token) token = getAccessToken();

  if (token) {
    config.headers = config.headers || {};
    // Respect manually provided Authorization header (e.g., post-login profile fetch)
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Dev-only safe logging with redaction (commented out by default)
API.interceptors.request.use((config) => {
  if (process.env.NODE_ENV !== "production") {
    try {
      const redactedData =
        config?.data && typeof config.data === "object" ? redact(config.data) : config.data;
      const redactedParams =
        config?.params && typeof config.params === "object" ? redact(config.params) : config.params;

      // console.debug("[API] ->", (config.method || "GET").toUpperCase(), config.url, { data: redactedData, params: redactedParams });
    } catch (_) {}
  }
  return config;
});

/* Ensure we decrement loader even if a request fails before reaching the response interceptors (e.g., network error, CORS, cancellation). */
API.interceptors.request.use(
  undefined,
  (error) => {
    try {
      if (error?.config?._trackLoading) decrementLoading();
    } catch (_) {}
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (res) => {
    try {
      if (res?.config?._trackLoading) decrementLoading();
    } catch (_) {}
    // Cache GET responses and clear inflight tracking
    try {
      const cfg = res?.config || {};
      const method = (cfg.method || "get").toLowerCase();
      if (method === "get") {
        const ttl =
          typeof cfg.cacheTTL === "number" ? cfg.cacheTTL : DEFAULT_GET_CACHE_TTL;
        if (ttl > 0 && !cfg._fromCache) {
          const key = makeRequestKey(cfg);
          cache.set(key, {
            data: res?.data,
            headers: res?.headers || {},
            expiry: Date.now() + ttl,
          });
        }
        if (cfg._reqKey && inflight.has(cfg._reqKey)) {
          inflight.delete(cfg._reqKey);
        }
      }
    } catch (_) {}
    return res;
  },
  async (error) => {
    // Dev logging (redacted)
    if (process.env.NODE_ENV !== "production") {
      try {
        const cfg = error?.config || {};
        const redactedCfgData =
          cfg?.data && typeof cfg.data === "object" ? redact(cfg.data) : cfg.data;
        // console.debug("[API] x ", (cfg.method || "GET").toUpperCase(), cfg.url, {
        //   data: redactedCfgData,
        //   status: error?.response?.status,
        //   response: error?.response?.data,
        // });
      } catch (_) {}
    }

    const status = error?.response?.status;
    const data = error?.response?.data;
    const originalRequest = error?.config || {};

    // Clear inflight map entry (if any)
    try {
      if (originalRequest?._reqKey && inflight.has(originalRequest._reqKey)) {
        inflight.delete(originalRequest._reqKey);
      }
    } catch (_) {}

    // Lightweight retries for idempotent requests on transient errors
    try {
      const method = (originalRequest.method || "get").toLowerCase();
      const isTransient =
        (typeof status !== "number" || status >= 500) ||
        error?.code === "ECONNABORTED";
      const isIdempotent = method === "get" || method === "head";
      const maxAttempts =
        typeof originalRequest.retryAttempts === "number"
          ? originalRequest.retryAttempts
          : 2;
      const count = originalRequest._retryCount || 0;

      if (isTransient && isIdempotent && !originalRequest._retrying && count < maxAttempts) {
        originalRequest._retryCount = count + 1;
        originalRequest._retrying = true;
        originalRequest._skipLoadingTrack = true; // avoid re-incrementing loader
        const base = 200 * Math.pow(2, count);
        const jitter = Math.floor(Math.random() * 100);
        const delay = Math.min(1000, base + jitter);
        await new Promise((r) => setTimeout(r, delay));
        return API(originalRequest);
      }
    } catch (_) {}

    const tokenInvalid =
      status === 401 &&
      (data?.code === "token_not_valid" ||
        data?.detail === "Given token not valid for any token type");

    // Avoid infinite loops
    if (tokenInvalid && !originalRequest._retry) {
      originalRequest._retry = true;
      // Do not increment loading again for the retried request
      originalRequest._skipLoadingTrack = true;

      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Update auth header and retry original request
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${refreshed}`;
        return API(originalRequest);
      }

      // No refresh available or refresh failed: do NOT clear tokens automatically.
      // Persist session until explicit logout or manual cache clear.
      try {
        if (typeof window !== "undefined") {
          window.__tk_auth_blocked = true; // can be used by UI to route to login without wiping storage
        }
      } catch (_) {}

      try {
        if (originalRequest?._trackLoading) decrementLoading();
      } catch (_) {}
      return Promise.reject(error);
    }

    // Non-refreshable error: ensure we decrement loading if we tracked it
    try {
      if (originalRequest?._trackLoading) decrementLoading();
    } catch (_) {}

    return Promise.reject(error);
  }
);

/* One-time cleanup of legacy non-namespaced auth keys to avoid cross-role collisions */
(function cleanupLegacyAuthKeys() {
  try {
    if (typeof localStorage !== "undefined") {
      ["token", "refresh", "role", "user"].forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
    }
    if (typeof sessionStorage !== "undefined") {
      ["token", "refresh", "role", "user"].forEach((k) => {
        try { sessionStorage.removeItem(k); } catch (_) {}
      });
    }
  } catch (_) {}
})();

/**
 * Keep UI session alive by silently refreshing the access token at intervals
 * while the app is open. This ensures users remain logged in until they
 * explicitly logout or clear their browser storage.
 */
(function startTokenKeepAlive() {
  if (typeof window === "undefined") return;
  try {
    if (window.__tk_keepalive) return;
    window.__tk_keepalive = setInterval(() => {
      // ensureFreshAccess() refreshes 60s before expiry using the refresh token (if present)
      ensureFreshAccess().catch(() => {});
    }, 120000); // every 2 minutes
  } catch (_) {}
})();

export async function assignConsumerByCount(payload) {
  const res = await API.post("/coupons/codes/assign-consumer-count/", payload);
  return res?.data || res;
}

export async function assignEmployeeByCount(payload) {
  // payload supports either { employee_username, count, batch?, notes? } or { employee_id, count, ... }
  const res = await API.post("/coupons/codes/assign-employee-count/", payload);
  return res?.data || res;
}

/**
 * E‑Coupon Store APIs
 */

// Bootstrap: role‑filtered products + active payment config (for create order screen)
export async function getEcouponStoreBootstrap() {
  const res = await API.get("/coupons/store/orders/bootstrap/", {
    // cache for short time to reduce flicker
    cacheTTL: 15_000,
    dedupe: "cancelPrevious",
  });
  return res?.data || res;
}

// Create an e‑coupon order (multipart). Fields: product, quantity, utr?, notes?, payment_proof_file?
export async function createEcouponOrder({ product, quantity, utr = "", notes = "", file = null }) {
  const fd = new FormData();
  fd.append("product", String(product));
  fd.append("quantity", String(quantity));
  if (utr) fd.append("utr", String(utr));
  if (notes) fd.append("notes", String(notes));
  if (file) fd.append("payment_proof_file", file);
  const res = await API.post("/coupons/store/orders/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000,
  });
  return res?.data || res;
}

// List my orders (consumer/agency/employee)
export async function getMyEcouponOrders(params = {}) {
  const res = await API.get("/coupons/store/orders/mine/", { params, dedupe: "cancelPrevious" });
  return res?.data || res;
}

// Admin: list pending orders
export async function adminGetPendingEcouponOrders(params = {}) {
  const res = await API.get("/coupons/store/orders/pending/", { params, dedupe: "cancelPrevious" });
  return res?.data || res;
}

// Admin: approve an order and allocate codes
export async function adminApproveEcouponOrder(id, review_note = "") {
  const res = await API.post(`/coupons/store/orders/${id}/approve/`, { review_note });
  return res?.data || res;
}

// Admin: reject an order
export async function adminRejectEcouponOrder(id, review_note = "") {
  const res = await API.post(`/coupons/store/orders/${id}/reject/`, { review_note });
  return res?.data || res;
}

// Admin: payment configs and products (basic CRUD helpers)
export async function listPaymentConfigs(params = {}) {
  const res = await API.get("/coupons/store/payment-configs/", { params });
  return res?.data || res;
}
export async function setActivePaymentConfig(id) {
  const res = await API.post(`/coupons/store/payment-configs/${id}/set-active/`, {});
  return res?.data || res;
}
export async function listStoreProducts(params = {}) {
  const res = await API.get("/coupons/store/products/", { params });
  return res?.data || res;
}

/**
 * Consumer e‑coupon wallet helpers
 */
export async function getMyECoupons(params = {}) {
  const res = await API.get("/coupons/codes/mine-consumer/", { params, dedupe: "cancelPrevious" });
  return res?.data || res;
}
export async function getMyECouponSummary() {
  const res = await API.get("/coupons/codes/consumer-summary/", { cacheTTL: 10_000, dedupe: "cancelPrevious" });
  return res?.data || res;
}
export async function transferECoupon(codeId, { to_username, pincode = "", notes = "" }) {
  const res = await API.post(`/coupons/codes/${codeId}/transfer/`, { to_username, pincode, notes });
  return res?.data || res;
}

// Activation/Redeem using v1 endpoints with e‑coupon source context
export async function activateECoupon150({ code }) {
  const res = await API.post("/v1/coupon/activate/", {
    type: "150",
    source: { channel: "e_coupon", code },
  });
  return res?.data || res;
}
export async function redeemECoupon150({ code }) {
  const res = await API.post("/v1/coupon/redeem/", {
    type: "150",
    source: { channel: "e_coupon", code },
  });
  return res?.data || res;
}

/**
 * Admin: Master Level Commission APIs
 */
export async function adminGetLevelCommission() {
  const res = await API.get("/admin/commission/levels/", {
    cacheTTL: 10_000,
    dedupe: "cancelPrevious",
  });
  return res?.data || res;
}

export async function adminUpdateLevelCommission(payload = {}) {
  // Accepts any subset of { direct, l1, l2, l3, l4, l5 }
  const res = await API.patch("/admin/commission/levels/", payload);
  return res?.data || res;
}

export async function adminSeedLevelCommission() {
  const res = await API.post("/admin/commission/levels/seed/", {});
  return res?.data || res;
}

export async function adminGetMatrixCommissionConfig() {
  const res = await API.get("/admin/commission/matrix/", {
    cacheTTL: 10_000,
    dedupe: "cancelPrevious",
  });
  return res?.data || res;
}

export async function adminUpdateMatrixCommissionConfig(payload = {}) {
  // Accepts any subset of:
  //  - five_matrix_levels, five_matrix_amounts_json, five_matrix_percents_json
  //  - three_matrix_levels, three_matrix_amounts_json, three_matrix_percents_json
  const res = await API.patch("/admin/commission/matrix/", payload);
  return res?.data || res;
}

/**
 * Admin: Rewards Points Config (tiers + per-coupon after base)
 */
export async function adminGetRewardPointsConfig() {
  const res = await API.get("/admin/rewards/points-config/", {
    cacheTTL: 10_000,
    dedupe: "cancelPrevious",
  });
  return res?.data || res;
}
export async function adminUpdateRewardPointsConfig(payload = {}) {
  const res = await API.patch("/admin/rewards/points-config/", payload);
  return res?.data || res;
}

/**
 * Promo Packages (Consumer + Admin)
 */
export async function getPromoPackages() {
  const res = await API.get("/business/promo/packages/", {
    cacheTTL: 10_000,
    dedupe: "cancelPrevious",
  });
  return res?.data || res;
}

export async function listMyPromoPurchases(params = {}) {
  const res = await API.get("/business/promo/purchases/", { params, dedupe: "cancelPrevious" });
  return res?.data || res;
}

export async function createPromoPurchase({
  package_id,
  quantity = 1,
  year = null,
  month = null,
  file = null,
  remarks = "",
  selected_product_id = null,
  selected_promo_product_id = null,
  shipping_address = "",
  // For PRIME 150 user choice
  prime150_choice = "EBOOK",
  // For PRIME 750 user choice
  prime750_choice = "PRODUCT",
  // New Monthly flow
  package_number = null,
  boxes = [],
}) {
  const fd = new FormData();
  fd.append("package_id", String(package_id));

  // MONTHLY (boxes) takes precedence over legacy year/month
  const hasBoxes = Array.isArray(boxes) && boxes.length > 0 && package_number != null;
  if (hasBoxes) {
    // quantity equals number of selected boxes
    const q = Math.max(1, Number(boxes.length) || 1);
    fd.append("quantity", String(q));
    fd.append("package_number", String(package_number));
    for (const b of boxes) {
      try {
        fd.append("boxes", String(parseInt(b, 10)));
      } catch (_) {}
    }
  } else {
    // Legacy path (kept for backward compatibility)
    const qty = Math.max(1, Number(quantity) || 1);
    fd.append("quantity", String(qty));
    if (year != null) fd.append("year", String(year));
    if (month != null) fd.append("month", String(month));
  }

  if (file) fd.append("payment_proof", file);
  if (remarks) fd.append("remarks", String(remarks));
  if (selected_product_id != null) fd.append("selected_product_id", String(selected_product_id));
  if (selected_promo_product_id != null) fd.append("selected_promo_product_id", String(selected_promo_product_id));
  if (shipping_address) fd.append("shipping_address", String(shipping_address));
  if (prime150_choice != null && String(prime150_choice).trim() !== "") {
    fd.append("prime150_choice", String(prime150_choice).toUpperCase());
  }
  if (prime750_choice != null && String(prime750_choice).trim() !== "") {
    fd.append("prime750_choice", String(prime750_choice).toUpperCase());
  }
  const res = await API.post("/business/promo/purchases/", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000,
  });
  return res?.data || res;
}

// Admin promo purchases
export async function adminListPromoPurchases(params = {}) {
  const res = await API.get("/business/admin/promo/purchases/", { params, dedupe: "cancelPrevious" });
  return res?.data || res;
}
export async function adminApprovePromoPurchase(id) {
  const res = await API.post(`/business/admin/promo/purchases/${id}/approve/`, {});
  return res?.data || res;
}
export async function adminRejectPromoPurchase(id, reason = "") {
  const res = await API.post(`/business/admin/promo/purchases/${id}/reject/`, { reason });
  return res?.data || res;
}

/**
 * Marketplace: Product purchase request (consumer checkout -> admin/owner approval)
 * Payload: { product, quantity, consumer_name, consumer_email, consumer_phone, consumer_address, payment_method }
 */
export async function createProductPurchaseRequest(payload = {}) {
  const res = await API.post("/purchase-requests", payload);
  return res?.data || res;
}

/**
 * Rewards Points (coupon activation milestones)
 */
export async function getRewardPointsSummary() {
  const res = await API.get("/business/rewards/points/", { cacheTTL: 10_000, dedupe: "cancelPrevious" });
  return res?.data || res;
}

export async function getMyEBooks() {
  const res = await API.get("/business/ebooks/mine/", { cacheTTL: 10000, dedupe: "cancelPrevious" });
  return res?.data || res;
}

export { ensureFreshAccess, getAccessToken, getRefreshToken };
export default API;
