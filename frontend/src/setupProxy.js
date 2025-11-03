/* eslint-disable @typescript-eslint/no-var-requires */
const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * Ensure ALL /api/* and /media/* requests to the React dev server (localhost:3000)
 * are proxied to the Django backend (localhost:8000), even when the browser
 * is navigated directly to a URL like:
 *   http://localhost:3000/api/location/pincode/585101/
 *
 * This avoids CRA&#39;s default behavior of serving index.html for requests
 * that Accept: text/html (direct navigation), which would otherwise make it
 * look like the API is &#34;not working&#34;.
 */
module.exports = function (app) {
  // API endpoints
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:8000",
      changeOrigin: true,
      secure: false,
      // Disable WebSocket proxying unless your Django backend serves WS (channels/daphne/uvicorn).
      // Avoids noisy [HPM] WebSocket ECONNRESET logs during backend reloads.
      ws: false,
      logLevel: "error",
      timeout: 120000,
      proxyTimeout: 120000,
      onError(err, req, res) {
        try {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ detail: "Proxy error (backend offline or restarting)" }));
        } catch (_) {}
      },
    })
  );

  // Media files served by Django (useful in dev when components reference /media/*)
  app.use(
    "/media",
    createProxyMiddleware({
      target: "http://localhost:8000",
      changeOrigin: true,
      secure: false,
      logLevel: "error",
      timeout: 120000,
      proxyTimeout: 120000,
      onError(err, req, res) {
        try {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ detail: "Proxy error (backend offline or restarting)" }));
        } catch (_) {}
      },
    })
  );
};
