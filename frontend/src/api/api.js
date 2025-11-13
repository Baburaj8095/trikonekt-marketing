import axios from "axios";
import { incrementLoading, decrementLoading } from "../hooks/loadingStore";

const baseURL =
  process.env.REACT_APP_API_URL ||
  "/api";

const API = axios.create({ baseURL });

// Separate client without interceptors for token refresh to avoid recursion/deadlocks
const refreshClient = axios.create({ baseURL });

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
  const ns = currentNamespace();
  const k = nsKey(base, ns);
  return (
    (typeof localStorage !== "undefined" && localStorage.getItem(k)) ||
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) ||
    (typeof localStorage !== "undefined" && localStorage.getItem(base)) ||
    (typeof sessionStorage !== "undefined" && sessionStorage.getItem(base)) ||
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
  return readNamespaced("token");
}

function getRefreshToken() {
  return readNamespaced("refresh");
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const resp = await refreshClient.post("/accounts/token/refresh/", { refresh });
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
    config.headers.Authorization = `Bearer ${token}`;
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

export { ensureFreshAccess, getAccessToken, getRefreshToken };
export default API;
