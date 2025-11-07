import React, { useState } from "react";
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom";
import API from "../../api/api";

function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function clearTokens() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
  } catch {}
  try {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("refresh");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("user");
  } catch {}
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onlyDigits = (s) => (s || "").replace(/\D/g, "");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    clearTokens();

    try {
      const raw = username.trim();
      const userField = /[A-Za-z]/.test(raw) ? raw : onlyDigits(raw);
      const res = await API.post("/accounts/login/", {
        username: userField,
        password: password,
      });

      const access =
        res?.data?.access || res?.data?.token || res?.data?.data?.token;
      const refreshTok = res?.data?.refresh;
      if (!access) throw new Error("No access token");

      const payload = parseJwt(access);
      if (!payload) throw new Error("Invalid token");
      const isAdmin = !!payload?.is_staff || !!payload?.is_superuser;
      if (!isAdmin) {
        setErr("Not an admin account. Please use an admin/staff user.");
        setLoading(false);
        clearTokens();
        return;
      }

      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("token", access);
      if (refreshTok) storage.setItem("refresh", refreshTok);
      if (payload?.role) storage.setItem("role", payload.role);

      try {
        const meResp = await API.get("/accounts/me/");
        if (meResp?.data) {
          storage.setItem("user", JSON.stringify(meResp.data));
        }
      } catch {
        // best-effort
      }

      const redirectTo =
        (location.state && location.state.from && location.state.from.pathname) ||
        "/admin/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        (error?.response?.data ? JSON.stringify(error.response.data) : "Login failed");
      setErr(typeof msg === "string" ? msg : String(msg));
      clearTokens();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.95) 100%)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
          padding: 24,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: "#0f172a" }}>Admin Login</h2>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Sign in with an Admin/Staff account to access the Admin Panel.
          </div>
        </div>

        {err ? (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "8px 10px",
              marginBottom: 12,
              fontSize: 14,
            }}
          >
            {err}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#64748b" }}>
                Phone or Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                type="text"
                inputMode="text"
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#64748b" }}>Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                type="password"
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  outline: "none",
                }}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#334155" }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: 14,
            fontSize: 13,
            color: "#475569",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <RouterLink to="/login" style={{ color: "#0f172a", textDecoration: "none" }}>
            Back to User Login
          </RouterLink>
          <RouterLink to="/" style={{ color: "#0f172a", textDecoration: "none" }}>
            Home
          </RouterLink>
        </div>
      </div>
    </div>
  );
}
