const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * CRA dev-server proxy
 * Proxies frontend requests at http://localhost:3000/api/* to the Django backend at http://localhost:8000/api/*
 * This keeps API calls same-origin (http://localhost:3000/api/*) in development and avoids CORS.
 *
 * Notes:
 * - frontend/src/api/api.js forces baseURL to "/api/" in the browser.
 * - With this proxy, hitting http://localhost:3000/api/user/upgrade-eligibility/ will be forwarded to
 *   http://localhost:8000/api/user/upgrade-eligibility/ during `npm start`.
 */
module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:8000",
      changeOrigin: true,
      secure: false,
      xfwd: true,
      logLevel: "silent", // set to "debug" to troubleshoot locally
    })
  );
};
