import React, { useState } from "react";
import { useNavigate, useLocation, Link as RouterLink } from "react-router-dom";
import API, { setAuthBlocked } from "../../api/api";

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
  const initialWorkspace = (() => {
    try {
      const params = new URLSearchParams(location.search || "");
      const mode = String(params.get("workspace") || params.get("mode") || "").toLowerCase();
      const fromPath = String(location.state?.from?.pathname || "");
      if (mode === "franchise" || fromPath.startsWith("/admin/franchise")) return "franchise";
    } catch (_) {}
    return "team";
  })();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState("request");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotErr, setForgotErr] = useState("");
  const [forgotNotice, setForgotNotice] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [otpLoginOpen, setOtpLoginOpen] = useState(false);
  const [otpLoginStep, setOtpLoginStep] = useState("request");
  const [otpLoginIdentifier, setOtpLoginIdentifier] = useState("");
  const [otpLoginOtp, setOtpLoginOtp] = useState("");
  const [otpLoginLoading, setOtpLoginLoading] = useState(false);
  const [otpLoginErr, setOtpLoginErr] = useState("");
  const [otpLoginNotice, setOtpLoginNotice] = useState("");

  const onlyDigits = (s) => (s || "").replace(/\D/g, "");

  function openForgotPassword() {
    setForgotOpen(true);
    setForgotStep("request");
    setForgotErr("");
    setForgotNotice("");
    setResetIdentifier(username || "");
    setResetOtp("");
    setResetPassword("");
  }

  function storeAdminSession(access, refreshTok) {
    const payload = parseJwt(access);
    if (!payload) throw new Error("Invalid token");
    const isAdmin = !!payload?.is_staff || !!payload?.is_superuser;
    if (!isAdmin) throw new Error("Not an admin account. Please use an admin/staff user.");
    const ns = "admin";
    setAuthBlocked(false, ns);
    localStorage.setItem(`token_${ns}`, access);
    if (refreshTok) localStorage.setItem(`refresh_${ns}`, refreshTok);
    if (payload?.role) localStorage.setItem(`role_${ns}`, payload.role);
    localStorage.setItem(`user_${ns}`, JSON.stringify({
      username: payload?.username || "",
      full_name: payload?.full_name || "",
      role: payload?.role || "admin",
    }));
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("refresh");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("refresh");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("user");
    } catch (_) {}
  }

  function navigateAfterLogin() {
    const fromPath = location.state && location.state.from && location.state.from.pathname;
    const fromSearch = location.state && location.state.from && location.state.from.search;
    const fallback = workspace === "franchise" ? "/admin/franchise/dashboard" : "/admin/dashboard";
    const redirectTo = fromPath && fromPath !== "/admin/login" ? `${fromPath}${fromSearch || ""}` : fallback;
    navigate(redirectTo, { replace: true });
  }

  function openOtpLogin() {
    setOtpLoginOpen(true);
    setOtpLoginStep("request");
    setOtpLoginIdentifier(username || "");
    setOtpLoginOtp("");
    setOtpLoginErr("");
    setOtpLoginNotice("");
  }

  async function requestAdminLoginOtp() {
    setOtpLoginErr("");
    setOtpLoginNotice("");
    const identifier = String(otpLoginIdentifier || "").trim();
    if (!identifier) {
      setOtpLoginErr("Enter your admin username, email, or phone.");
      return;
    }
    setOtpLoginLoading(true);
    try {
      const res = await API.post("/admin/login/request-otp/", { identifier });
      setOtpLoginNotice(res?.data?.message || "If the admin account exists, OTP has been sent.");
      setOtpLoginStep("verify");
    } catch (e) {
      setOtpLoginErr(e?.response?.data?.detail || e?.message || "Could not request OTP.");
    } finally {
      setOtpLoginLoading(false);
    }
  }

  async function verifyAdminLoginOtp() {
    setOtpLoginErr("");
    setOtpLoginNotice("");
    const identifier = String(otpLoginIdentifier || "").trim();
    const otp = String(otpLoginOtp || "").trim();
    if (!/^\d{6}$/.test(otp)) {
      setOtpLoginErr("Enter the 6-digit OTP.");
      return;
    }
    setOtpLoginLoading(true);
    clearTokens();
    try {
      const res = await API.post("/admin/login/verify-otp/", { identifier, otp });
      const access = res?.data?.access;
      const refreshTok = res?.data?.refresh;
      if (!access) throw new Error("No access token");
      storeAdminSession(access, refreshTok);
      setOtpLoginOpen(false);
      navigateAfterLogin();
    } catch (e) {
      setOtpLoginErr(e?.response?.data?.detail || e?.message || "Invalid or expired OTP.");
      clearTokens();
    } finally {
      setOtpLoginLoading(false);
    }
  }

  async function requestAdminOtp() {
    setForgotErr("");
    setForgotNotice("");
    const identifier = String(resetIdentifier || "").trim();
    if (!identifier) {
      setForgotErr("Enter your admin username, email, or phone.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await API.post("/admin/password/request-otp/", { identifier });
      setForgotNotice(res?.data?.message || "If the account exists, OTP has been sent.");
      setForgotStep("verify");
    } catch (e) {
      setForgotErr(e?.response?.data?.detail || e?.message || "Could not request OTP.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function verifyAdminOtp() {
    setForgotErr("");
    setForgotNotice("");
    const identifier = String(resetIdentifier || "").trim();
    const otp = String(resetOtp || "").trim();
    if (!/^\d{6}$/.test(otp)) {
      setForgotErr("Enter the 6-digit OTP.");
      return;
    }
    setForgotLoading(true);
    try {
      await API.post("/admin/password/verify-otp/", { identifier, otp });
      setForgotNotice("OTP verified. Set a new password.");
      setForgotStep("reset");
    } catch (e) {
      setForgotErr(e?.response?.data?.detail || "Invalid or expired OTP.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function resetAdminPassword() {
    setForgotErr("");
    setForgotNotice("");
    const identifier = String(resetIdentifier || "").trim();
    const otp = String(resetOtp || "").trim();
    const newPassword = String(resetPassword || "");
    if (newPassword.length < 8) {
      setForgotErr("Password must be at least 8 characters.");
      return;
    }
    setForgotLoading(true);
    try {
      await API.post("/admin/password/reset/", {
        identifier,
        otp,
        new_password: newPassword,
      });
      setForgotNotice("Password reset successful. You can sign in now.");
      setPassword("");
      setForgotStep("done");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setForgotErr(Array.isArray(detail) ? detail.join(" ") : detail || e?.message || "Password reset failed.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    clearTokens();

    try {
      const raw = username.trim();
      const userField = /[A-Za-z]/.test(raw) ? raw : onlyDigits(raw);
      const res = await API.post("/admin/login/", {
        username: userField,
        password: password,
        identity_type: "ADMIN",
      });

      const access =
        res?.data?.access || res?.data?.token || res?.data?.data?.token;
      const refreshTok = res?.data?.refresh;
      if (!access) throw new Error("No access token");

      try {
        storeAdminSession(access, refreshTok);
      } catch (e) {
        setErr(e?.message || "Login failed");
        setLoading(false);
        clearTokens();
        return;
      }

      try {
        const meResp = await API.get("/accounts/me/");
        if (meResp?.data) {
          localStorage.setItem("user_admin", JSON.stringify(meResp.data));
        }
      } catch {
        // best-effort
      }

      navigateAfterLogin();
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
            Choose a workspace, then sign in with an Admin/Staff account.
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
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Admin workspace</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  {
                    id: "team",
                    title: "Team Consumer",
                    body: "Users, rewards, wallets",
                  },
                  {
                    id: "franchise",
                    title: "Franchise",
                    body: "State, district, pincode flow",
                  },
                ].map((option) => {
                  const active = workspace === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setWorkspace(option.id)}
                      style={{
                        textAlign: "left",
                        padding: "10px 11px",
                        borderRadius: 10,
                        border: active ? "1px solid #0f172a" : "1px solid #e2e8f0",
                        background: active ? "#0f172a" : "#fff",
                        color: active ? "#fff" : "#0f172a",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 900 }}>{option.title}</div>
                      <div style={{ marginTop: 3, fontSize: 11, color: active ? "#cbd5e1" : "#64748b", lineHeight: 1.25 }}>{option.body}</div>
                    </button>
                  );
                })}
              </div>
            </div>

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
              type="button"
              onClick={openForgotPassword}
              style={{
                alignSelf: "flex-end",
                border: 0,
                background: "transparent",
                color: "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                fontSize: 13,
              }}
            >
              Forgot password?
            </button>

            <button
              type="button"
              onClick={openOtpLogin}
              style={{
                padding: "10px 12px",
                background: "#fff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Login with Email OTP
            </button>

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
          <RouterLink to="/auth/login" style={{ color: "#0f172a", textDecoration: "none" }}>
            Back to User Login
          </RouterLink>
          <RouterLink to="/" style={{ color: "#0f172a", textDecoration: "none" }}>
            Home
          </RouterLink>
        </div>
      </div>

      {forgotOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setForgotOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 18px 45px rgba(15,23,42,0.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>Reset Admin Password</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>OTP is sent to the registered admin email.</div>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              {forgotErr ? (
                <div style={{ padding: "8px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
                  {forgotErr}
                </div>
              ) : null}
              {forgotNotice ? (
                <div style={{ padding: "8px 10px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 8, fontSize: 13 }}>
                  {forgotNotice}
                </div>
              ) : null}

              {forgotStep === "request" || forgotStep === "verify" || forgotStep === "reset" ? (
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#64748b" }}>
                  Admin username, email, or phone
                  <input
                    value={resetIdentifier}
                    disabled={forgotStep !== "request"}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                </label>
              ) : null}

              {forgotStep === "verify" || forgotStep === "reset" ? (
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#64748b" }}>
                  6-digit OTP
                  <input
                    value={resetOtp}
                    disabled={forgotStep === "reset"}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", letterSpacing: 2 }}
                  />
                </label>
              ) : null}

              {forgotStep === "reset" ? (
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#64748b" }}>
                  New password
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                </label>
              ) : null}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 700 }}
                >
                  Close
                </button>
                {forgotStep === "request" ? (
                  <button type="button" disabled={forgotLoading} onClick={requestAdminOtp} style={{ padding: "8px 12px", borderRadius: 8, border: 0, background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
                    {forgotLoading ? "Sending..." : "Send OTP"}
                  </button>
                ) : null}
                {forgotStep === "verify" ? (
                  <button type="button" disabled={forgotLoading} onClick={verifyAdminOtp} style={{ padding: "8px 12px", borderRadius: 8, border: 0, background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
                    {forgotLoading ? "Verifying..." : "Verify OTP"}
                  </button>
                ) : null}
                {forgotStep === "reset" ? (
                  <button type="button" disabled={forgotLoading} onClick={resetAdminPassword} style={{ padding: "8px 12px", borderRadius: 8, border: 0, background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
                    {forgotLoading ? "Resetting..." : "Reset Password"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {otpLoginOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOtpLoginOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 18px 45px rgba(15,23,42,0.28)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>Admin OTP Login</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>A one-time code is sent to the registered admin email.</div>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              {otpLoginErr ? (
                <div style={{ padding: "8px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 13 }}>
                  {otpLoginErr}
                </div>
              ) : null}
              {otpLoginNotice ? (
                <div style={{ padding: "8px 10px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 8, fontSize: 13 }}>
                  {otpLoginNotice}
                </div>
              ) : null}
              <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#64748b" }}>
                Admin username, email, or phone
                <input
                  value={otpLoginIdentifier}
                  disabled={otpLoginStep !== "request"}
                  onChange={(e) => setOtpLoginIdentifier(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
              </label>
              {otpLoginStep === "verify" ? (
                <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#64748b" }}>
                  6-digit OTP
                  <input
                    value={otpLoginOtp}
                    onChange={(e) => setOtpLoginOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", letterSpacing: 2 }}
                  />
                </label>
              ) : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setOtpLoginOpen(false)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  Close
                </button>
                {otpLoginStep === "request" ? (
                  <button type="button" disabled={otpLoginLoading} onClick={requestAdminLoginOtp} style={{ padding: "8px 12px", borderRadius: 8, border: 0, background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
                    {otpLoginLoading ? "Sending..." : "Send OTP"}
                  </button>
                ) : (
                  <button type="button" disabled={otpLoginLoading} onClick={verifyAdminLoginOtp} style={{ padding: "8px 12px", borderRadius: 8, border: 0, background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
                    {otpLoginLoading ? "Signing in..." : "Verify & Sign In"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

