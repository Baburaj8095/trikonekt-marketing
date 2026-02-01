/* eslint-disable import/no-extraneous-dependencies */
const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * CRA dev proxy to backend.
 *
 * Why this is needed:
 * - When running the React dev server on http://localhost:3000, any request to "/api/*"
 *   would otherwise try to hit http://localhost:3000/api/* (which doesn't exist) and can
 *   appear as "canceled" in the Network tab or fail due to CORS.
 * - This proxy forwards "/api/*" (and a few media paths) to the Django backend
 *   running on http://localhost:8000 by default.
 *
 * Usage:
 * - Restart the React dev server after adding this file.
 * - Optionally set BACKEND_URL env var to point to a different backend, e.g.:
 *   BACKEND_URL=http://127.0.0.1:8000
 */
module.exports = function setup(app) {
  const target = process.env.BACKEND_URL || "http://localhost:8000";

  const commonOptions = {
    target,
    changeOrigin: true,
    ws: false,
    secure: false,
    xfwd: true,
    // Be generous with timeouts so the dev server doesn't abort long backend calls
    proxyTimeout: 300000,
    timeout: 300000,
    onError(err, req, res) {
      try {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Dev proxy to backend failed.");
      } catch (_) {}
      // eslint-disable-next-line no-console
      console.error("[setupProxy] Proxy error:", err && err.message ? err.message : err);
    },
  };

  // Proxy API requests
  app.use(
    ["/api", "/api/"],
    createProxyMiddleware({
      ...commonOptions,
      // Keep the "/api" prefix as-is so backend sees "/api/..." paths unchanged
      // pathRewrite: { "^/api": "/api" },
    })
  );

  // Optional: Proxy media/uploads through the same backend if you serve files there in dev
  app.use(["/media", "/media/"], createProxyMiddleware(commonOptions));
  app.use(["/uploads", "/uploads/"], createProxyMiddleware(commonOptions));


  // eslint-disable-next-line no-console
  console.log(`[setupProxy] Proxying /api, /media, /uploads to ${target}`);
};
