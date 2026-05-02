import React, { useCallback, useEffect, useMemo, useState } from "react";

function getAuthHeaders() {
  // This project stores role-scoped token under token_user, token_agency, token_employee
  // For consumer routes we use token_user.
  const token =
    localStorage.getItem("token_user") ||
    sessionStorage.getItem("token_user") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function HubbleGiftCards() {
  const [iframeUrl, setIframeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const apiBase = useMemo(() => process.env.REACT_APP_API_BASE || "", []);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadIframeUrl() {
      setLoading(true);
      setError("");
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 15000);
        const resp = await fetch(`${apiBase}/api/business/hubble/iframe-url/`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data?.detail || "Failed to load gift cards");
        }
        if (mounted) setIframeUrl(String(data?.iframeUrl || ""));
      } catch (e) {
        const msg = e?.name === "AbortError" ? "Timed out loading gift cards. Please retry." : (e?.message || "Failed to load");
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadIframeUrl();
    return () => {
      mounted = false;
    };
  }, [apiBase, reloadKey]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 12px" }}>Gift Cards</h2>

      {loading ? <div>Loading...</div> : null}
      {error ? (
        <div style={{ color: "#b00020", marginBottom: 12 }}>
          {error}
          <div style={{ marginTop: 8 }}>
            <button onClick={reload} style={{ padding: "8px 12px", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {!loading && iframeUrl ? (
        <iframe
          title="Hubble Gift Cards"
          src={iframeUrl}
          // SECURITY: prevent leaking token-bearing query params via referrer headers.
          referrerPolicy="no-referrer"
          // SECURITY: sandbox the iframe. Hubble requires its own JS to run.
          // IMPORTANT: Hubble's own CSP may block embedding if the iframe has an opaque origin.
          // `allow-same-origin` is required so the embedded page is treated as https origin,
          // not as "null" (opaque) origin.
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          style={{ width: "100%", height: "80vh", border: "0px" }}
          // Keep allow list minimal. Remove clipboard permissions unless truly required.
          allow="payment"
        />
      ) : null}
    </div>
  );
}
