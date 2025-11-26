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
      // If pointing to localhost/127.0.0.1, rewrite to backend origin (mobile devices can't resolve localhost)
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        const base = backendOrigin || (typeof window !== "undefined" ? window.location.origin : "");
        if (base) {
          const b = new URL(base);
          // Keep path and query, swap origin
          return `${b.origin}${u.pathname}${u.search}${u.hash}`;
        }
      }
      // If page is https but image is http on same host, upgrade to https to avoid mixed content block
      try {
        if (typeof window !== "undefined" && window.location?.protocol === "https:" && u.protocol === "http:") {
          const pageHost = window.location.host;
          if (u.host === pageHost) {
            u.protocol = "https:";
            return u.toString();
          }
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
