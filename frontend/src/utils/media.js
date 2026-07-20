/**
 * Media URL utilities to ensure images load across devices/environments.
 * - Resolves uploaded media paths (e.g. /media/wallet_uploads/..., wallet_uploads/...) to Cloudinary CDN URLs
 * - Normalizes single-slash typos like "https:/res.cloudinary.com..." to proper protocol
 * - Normalizes relative paths like "/media/..." against backend origin when fallback is required
 * - Rewrites localhost/127.0.0.1 hosts to current backend origin (mobile fix)
 * - Upgrades http -> https when page is served over https (avoid mixed content)
 */
import API from "../api/api";

const CLOUDINARY_CLOUD_NAME = "dbfupwnqp";
const CLOUDINARY_IMAGE_BASE = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`;

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

    let str = input.trim();

    // Fix single-slash typos e.g., "https:/res.cloudinary.com..." or "https:/api.growth.vin..."
    if (/^https?:\/(?!\/)/i.test(str)) {
      str = str.replace(/^https?:\//i, (m) => (m.toLowerCase().startsWith("https") ? "https://" : "http://"));
    }

    // Direct Cloudinary URLs
    if (str.includes("res.cloudinary.com")) {
      if (typeof window !== "undefined" && window.location?.protocol === "https:" && str.startsWith("http://")) {
        return str.replace(/^http:\/\//i, "https://");
      }
      return str;
    }

    // Embedded encoded remote URL check (e.g. /media/https%3A/...)
    try {
      const decodedPath = decodeURIComponent(str);
      const m = decodedPath.match(/(https?:\/{1,2}[^?#]+)/i);
      if (m) {
        let remote = m[1].replace("https:/", "https://").replace("http:/", "http://");
        if (typeof window !== "undefined" && window.location?.protocol === "https:" && remote.startsWith("http://")) {
          remote = remote.replace(/^http:\/\//i, "https://");
        }
        return remote;
      }
    } catch (_) {}

    // Extract relative path from absolute URLs pointing to backend / local origin
    let relPath = str;
    try {
      if (/^https?:\/\//i.test(str)) {
        const uObj = new URL(str);
        relPath = uObj.pathname;
      }
    } catch (_) {}

    let cleanPath = relPath.replace(/^\/+/, "");
    if (cleanPath.startsWith("media/")) {
      cleanPath = cleanPath.replace(/^media\//, "");
    }

    // Known media upload directories that map to Cloudinary
    if (
      cleanPath &&
      (cleanPath.startsWith("wallet_uploads/") ||
        cleanPath.startsWith("uploads/") ||
        cleanPath.startsWith("products/") ||
        cleanPath.startsWith("merchant/") ||
        cleanPath.startsWith("team_consumer/"))
    ) {
      return `${CLOUDINARY_IMAGE_BASE}${cleanPath}`;
    }

    const backendOrigin = getBackendOrigin();

    // Absolute URL cases
    try {
      const u = new URL(str);

      // Upgrade http to https if page is https
      if (typeof window !== "undefined" && window.location?.protocol === "https:" && u.protocol === "http:") {
        u.protocol = "https:";
        return u.toString();
      }

      // Rewrite local/loopback hosts to backend ABSOLUTE origin
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

      return str;
    } catch (_) {}

    // Relative path cases: "/media/...", "media/...", etc.
    const path = str.startsWith("/") ? str : `/${str}`;
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

