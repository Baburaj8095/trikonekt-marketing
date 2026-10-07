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

  // Google Authenticator 2FA states
  const [twoFactorSetupOpen, setTwoFactorSetupOpen] = useState(false);
  const [twoFactorVerifyOpen, setTwoFactorVerifyOpen] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorErr, setTwoFactorErr] = useState("");
  const [useBackupCodeMode, setUseBackupCodeMode] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

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

  async function handleConfirm2FASetup(e) {
    if (e) e.preventDefault();
    setTwoFactorErr("");
    const code = String(twoFactorCode || "").trim().replace(/\D/g, "");
    if (code.length !== 6) {
      setTwoFactorErr("Please enter the complete 6-digit code from Google Authenticator.");
      return;
    }
    setTwoFactorLoading(true);
    try {
      const res = await API.post("/admin/login/2fa/confirm-setup/", {
        temp_token: twoFactorData?.temp_token,
        otp_code: code,
      });
      const access = res?.data?.access;
      const refreshTok = res?.data?.refresh;
      if (!access) throw new Error("Authentication failed: No access token received");
      storeAdminSession(access, refreshTok);
      if (res?.data?.user) {
        localStorage.setItem("user_admin", JSON.stringify(res.data.user));
      }
      setTwoFactorSetupOpen(false);
      navigateAfterLogin();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Verification failed. Please check the 6-digit code.";
      setTwoFactorErr(detail);
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function handleVerify2FA(e) {
    if (e) e.preventDefault();
    setTwoFactorErr("");
    const raw = String(twoFactorCode || "").trim();
    if (!raw) {
      setTwoFactorErr(useBackupCodeMode ? "Please enter your 8-character backup recovery code." : "Please enter the 6-digit Authenticator code.");
      return;
    }
    setTwoFactorLoading(true);
    try {
      const res = await API.post("/admin/login/2fa/verify/", {
        temp_token: twoFactorData?.temp_token,
        otp_code: raw,
      });
      const access = res?.data?.access;
      const refreshTok = res?.data?.refresh;
      if (!access) throw new Error("Authentication failed: No access token received");
      storeAdminSession(access, refreshTok);
      if (res?.data?.user) {
        localStorage.setItem("user_admin", JSON.stringify(res.data.user));
      }
      setTwoFactorVerifyOpen(false);
      navigateAfterLogin();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Invalid authentication code. Please try again.";
      setTwoFactorErr(detail);
    } finally {
      setTwoFactorLoading(false);
    }
  }

  function handleCopySecret() {
    if (!twoFactorData?.secret) return;
    try {
      navigator.clipboard.writeText(twoFactorData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    } catch (_) {}
  }

  function handleDownloadBackupCodes() {
    if (!twoFactorData?.backup_codes) return;
    try {
      const content = `TRIKONEKT ADMIN 2FA BACKUP RECOVERY CODES\nAccount: ${twoFactorData.username}\nGenerated: ${new Date().toLocaleString()}\n\nKeep these codes in a safe place. Each code can only be used once.\n\n` +
        twoFactorData.backup_codes.map((c, i) => `${i + 1}. ${c}`).join("\n");
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trikonekt-admin-backup-codes-${twoFactorData.username}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2500);
    } catch (_) {}
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

      // 1. Check if First-Time 2FA Setup is Required (QR code enrollment)
      if (res?.data?.require_2fa_setup) {
        setTwoFactorData(res.data);
        setTwoFactorCode("");
        setTwoFactorErr("");
        setCopiedSecret(false);
        setCopiedBackup(false);
        setTwoFactorSetupOpen(true);
        setLoading(false);
        return;
      }

      // 2. Check if Standard 2FA Verification is Required (6-digit rolling code)
      if (res?.data?.require_2fa_verify) {
        setTwoFactorData(res.data);
        setTwoFactorCode("");
        setTwoFactorErr("");
        setUseBackupCodeMode(false);
        setTwoFactorVerifyOpen(true);
        setLoading(false);
        return;
      }

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
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Select Admin Workspace
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                {[
                  {
                    id: "team",
                    title: "Community Admin (User Admin)",
                    body: "Community consumers, ₹2,000 Prime packages, LMS digital education, 5/3 Blocks AutoPools, and wallet treasury.",
                  },
                  {
                    id: "franchise",
                    title: "Franchise Admin",
                    body: "State / District / Pincode franchises, agency coordinators, merchants, zonal turnover pools, and franchise wallets.",
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
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: active ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        background: active ? "#0f172a" : "#ffffff",
                        color: active ? "#ffffff" : "#1e293b",
                        cursor: "pointer",
                        transition: "all 150ms ease",
                        boxShadow: active ? "0 4px 16px rgba(37,99,235,0.2)" : "0 1px 3px rgba(0,0,0,0.04)",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{option.title}</div>
                        {active && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "#2563eb",
                              color: "#ffffff",
                            }}
                          >
                            Selected
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 11,
                          color: active ? "#cbd5e1" : "#64748b",
                          lineHeight: 1.35,
                          fontWeight: 500,
                        }}
                      >
                        {option.body}
                      </div>
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

      {/* Google Authenticator 2FA First-Time Setup Modal */}
      {twoFactorSetupOpen && twoFactorData ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 50px -12px rgba(15,23,42,0.35)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>🛡️</span>
                <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 16 }}>Set Up Google Authenticator (2FA)</div>
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Account: <strong>{twoFactorData.username}</strong>. Enhance your admin security by linking an authenticator app.
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {twoFactorErr ? (
                <div style={{ padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {twoFactorErr}
                </div>
              ) : null}

              {/* Step 1: Scan QR */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#f8fafc" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
                  1. Scan with Google Authenticator / Authy
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  {twoFactorData.qr_code ? (
                    <img
                      src={twoFactorData.qr_code}
                      alt="Google Authenticator QR Code"
                      style={{ width: 160, height: 160, borderRadius: 8, border: "2px solid #cbd5e1", background: "#fff", padding: 4 }}
                    />
                  ) : null}
                  <div style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>
                    Or enter manual secret key:
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                    <input
                      readOnly
                      value={twoFactorData.secret || ""}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontFamily: "ui-monospace, monospace",
                        fontWeight: 700,
                        background: "#fff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        color: "#334155",
                        textAlign: "center",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      style={{
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        background: copiedSecret ? "#16a34a" : "#0f172a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {copiedSecret ? "Copied! ✓" : "Copy Key"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Backup Recovery Codes */}
              {twoFactorData.backup_codes && twoFactorData.backup_codes.length ? (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fffbeb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#92400e" }}>
                      2. Emergency Backup Recovery Codes
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadBackupCodes}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#92400e",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      {copiedBackup ? "Downloaded! ✓" : "Save Codes (.txt)"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "#b45309", marginBottom: 8 }}>
                    Save these one-time codes in a safe place in case you lose access to your device.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {twoFactorData.backup_codes.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#fff",
                          border: "1px solid #fde68a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontFamily: "ui-monospace, monospace",
                          fontWeight: 700,
                          fontSize: 12,
                          color: "#78350f",
                          textAlign: "center",
                        }}
                      >
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Step 3: Enter 6-Digit Code */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#f8fafc" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                  3. Enter 6-Digit Code from App to Confirm
                </div>
                <input
                  autoFocus
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && twoFactorCode.length === 6) {
                      handleConfirm2FASetup(e);
                    }
                  }}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px",
                    textAlign: "center",
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: 8,
                    borderRadius: 8,
                    border: "2px solid #2563eb",
                    background: "#fff",
                    color: "#0f172a",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setTwoFactorSetupOpen(false)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#475569",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={twoFactorLoading || twoFactorCode.length !== 6}
                onClick={handleConfirm2FASetup}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: twoFactorCode.length === 6 ? "#2563eb" : "#94a3b8",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: twoFactorCode.length === 6 && !twoFactorLoading ? "pointer" : "not-allowed",
                  boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
                }}
              >
                {twoFactorLoading ? "Verifying..." : "Verify & Complete Setup"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Google Authenticator 2FA Login Verification Modal */}
      {twoFactorVerifyOpen && twoFactorData ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 50px -12px rgba(15,23,42,0.35)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🔐</span>
                <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 16 }}>Two-Factor Authentication</div>
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Account: <strong>{twoFactorData.username}</strong>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={handleVerify2FA} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {twoFactorErr ? (
                <div style={{ padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {twoFactorErr}
                </div>
              ) : null}

              {!useBackupCodeMode ? (
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                    Enter 6-Digit Authenticator Code
                  </label>
                  <input
                    autoFocus
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px",
                      textAlign: "center",
                      fontSize: 24,
                      fontWeight: 800,
                      letterSpacing: 8,
                      borderRadius: 8,
                      border: "2px solid #2563eb",
                      background: "#f8fafc",
                      color: "#0f172a",
                      outline: "none",
                    }}
                  />
                  <div style={{ marginTop: 8, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setUseBackupCodeMode(true);
                        setTwoFactorCode("");
                        setTwoFactorErr("");
                      }}
                      style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Lost access to device? Use Backup Recovery Code
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
                    Enter 8-Character Backup Recovery Code
                  </label>
                  <input
                    autoFocus
                    type="text"
                    maxLength={10}
                    placeholder="E.g. A323FAA9"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.trim().toUpperCase())}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "12px",
                      textAlign: "center",
                      fontSize: 20,
                      fontWeight: 800,
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: 3,
                      borderRadius: 8,
                      border: "2px solid #f59e0b",
                      background: "#fffbeb",
                      color: "#78350f",
                      outline: "none",
                    }}
                  />
                  <div style={{ marginTop: 8, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setUseBackupCodeMode(false);
                        setTwoFactorCode("");
                        setTwoFactorErr("");
                      }}
                      style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      ← Back to Google Authenticator Code
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setTwoFactorVerifyOpen(false)}
                  style={{
                    padding: "9px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={twoFactorLoading || !twoFactorCode}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: twoFactorCode ? "#2563eb" : "#94a3b8",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: twoFactorCode && !twoFactorLoading ? "pointer" : "not-allowed",
                  }}
                >
                  {twoFactorLoading ? "Signing in..." : "Verify & Sign In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

