/* CRA dev proxy to backend Django server.
   - Proxies all /api/* requests to http://localhost:8000/api/*
   - Also proxies /media and /static for local asset access
   Notes:
   - Restart `npm start` after creating or changing this file.
   - You can override target via REACT_APP_DEV_PROXY_TARGET.
*/
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  const target = process.env.REACT_APP_DEV_PROXY_TARGET || "http://localhost:8000";

  // API proxy
  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
      xfwd: true,
      secure: false,
      ws: false,
      // Keep /api prefix as-is
      pathRewrite: {
        "^/api": "/api",
      },
      logLevel: "warn",
    })
  );

  // Media (optional convenience) - DO NOT proxy /static in CRA dev; it breaks bundle.js
  app.use(
    ["/media"],
    createProxyMiddleware({
      target,
      changeOrigin: true,
      xfwd: true,
      secure: false,
      ws: false,
      logLevel: "warn",
    })
  );
};

