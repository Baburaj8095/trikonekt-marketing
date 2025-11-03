import axios from "axios";
import { incrementLoading, decrementLoading } from "../hooks/loadingStore";

const baseURL =
  process.env.REACT_APP_API_URL ||
  "/api";

const API = axios.create({ baseURL });

// Separate client without interceptors for token refresh to avoid recursion/deadlocks
const refreshClient = axios.create({ baseURL });

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
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function getRefreshToken() {
  return localStorage.getItem("refresh") || sessionStorage.getItem("refresh");
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const resp = await refreshClient.post("/accounts/token/refresh/", { refresh });
    const newAccess = resp?.data?.access;
    if (newAccess) {
      if (localStorage.getItem("refresh")) {
        localStorage.setItem("token", newAccess);
      } else {
        sessionStorage.setItem("token", newAccess);
      }
      return newAccess;
    }
  } catch (_) {
    // fall through
  }
  return null;
}

async function ensureFreshAccess() {
  const token = getAccessToken();
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

      // No refresh available or refresh failed: clear tokens
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("refresh");
      } catch (_) {}
      try {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("refresh");
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

export default API;
