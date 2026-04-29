import React, { useEffect, useState } from "react";

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

  useEffect(() => {
    let mounted = true;

    async function loadIframeUrl() {
      setLoading(true);
      setError("");
      try {
        const apiBase = process.env.REACT_APP_API_BASE || "";
        const resp = await fetch(`${apiBase}/api/business/hubble/iframe-url/`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data?.detail || "Failed to load gift cards");
        }
        if (mounted) setIframeUrl(String(data?.iframeUrl || ""));
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadIframeUrl();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 12px" }}>Gift Cards</h2>

      {loading ? <div>Loading...</div> : null}
      {error ? (
        <div style={{ color: "#b00020", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {!loading && iframeUrl ? (
        <iframe
          title="Hubble Gift Cards"
          src={iframeUrl}
          style={{ width: "100%", height: "80vh", border: "0px" }}
          allow="clipboard-read; clipboard-write; payment;"
        />
      ) : null}
    </div>
  );
}
