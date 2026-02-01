/**
 * Media URL utilities to ensure images load across devices/environments.
 * - Normalizes relative paths like "/media/..." against backend origin
 * - Rewrites localhost/127.0.0.1 hosts to current backend origin (mobile fix)
 * - Upgrades http -> https when page is served over https (avoid mixed content)
 */
import API from "../api/api";

function getBackendOrigin() {
  try {
    const base = API?.defaults?.baseURL || "";
    if (/^https?:\/\//i.test(base)) {
      return new URL(base).origin;
    }
  } catch (_) {}
  try {
    if (typeof window !== "undefined" && window.location) {
      return window.location.origin;
    }
  } catch (_) {}
  return "";
}

export function normalizeMediaUrl(input) {
  try {
    if (!input) return "";
    if (typeof input !== "string") return String(input);

    // data URLs should pass-through
    if (input.startsWith("data:")) return input;

    const backendOrigin = getBackendOrigin();

    // Absolute URL cases
    try {
      const u = new URL(input);
      
      // If page is https and image is http, upgrade to https to avoid mixed content block on mobile/strict browsers
      try {
        if (typeof window !== "undefined" && window.location?.protocol === "https:" && u.protocol === "http:") {
          u.protocol = "https:";
          return u.toString();
        }
      } catch (_) {}

      // Rewrite local/loopback hosts to backend ABSOLUTE origin only (avoid rewriting to frontend origin)
      try {
        let backendAbsOrigin = "";
        const base = API?.defaults?.baseURL || "";
        if (/^https?:\/\//i.test(base)) {
          backendAbsOrigin = new URL(base).origin;
        }
        const host = (u.hostname || "").toLowerCase();
        const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
        if (backendAbsOrigin && isLocalHost) {
          const rewritten = new URL(u.pathname + u.search + u.hash, backendAbsOrigin);
          return rewritten.toString();
        }
      } catch (_) {}

      // Already an absolute, return as-is
      return input;
    } catch (_) {
      // Not an absolute URL, treat as relative
    }

    // Relative path cases: "/media/...", "media/...", etc.
    const path = input.startsWith("/") ? input : `/${input}`;
    if (backendOrigin) return `${backendOrigin}${path}`;
    if (typeof window !== "undefined" && window.location) {
      return `${window.location.origin}${path}`;
    }
    return path;
  } catch (_) {
    return input || "";
  }
}

export default normalizeMediaUrl;
