import React from "react";
import API from "../../api/api";

// Lightweight landing page to accept ?access=&refresh= and store them
// under the correct namespace based on current path, then redirect.
export default function ImpersonateLanding() {
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const access = params.get("access");
        const refresh = params.get("refresh");
        const next = params.get("next");

        // Resolve namespace: prefer ?ns=, else path prefix, else token role claim
        const path = window.location.pathname || "";
        const qNsRaw = (params.get("ns") || "").toLowerCase();
        const mapNs = (x) => (x.startsWith("agency") ? "agency" : x.startsWith("employee") ? "employee" : "user");
        let ns = qNsRaw ? mapNs(qNsRaw) : (path.startsWith("/agency") ? "agency" : path.startsWith("/employee") ? "employee" : "user");

        // If no explicit ns and we are on generic /impersonate, infer from access token role
        if (!qNsRaw && ns === "user" && access) {
          try {
            const [, p] = String(access).split(".");
            if (p) {
              let base = p.replace(/-/g, "+").replace(/_/g, "/");
              const pad = base.length % 4;
              if (pad) base += "=".repeat(4 - pad);
              const claim = JSON.parse(atob(base));
              const role = String(claim?.role || "").toLowerCase();
              ns = mapNs(role);
            }
          } catch (_) {}
        }

        if (access) {
          try {
            localStorage.setItem(`token_${ns}`, access);
          } catch (_) {
            try { sessionStorage.setItem(`token_${ns}`, access); } catch (_) {}
          }
        }
        if (refresh) {
          try {
            localStorage.setItem(`refresh_${ns}`, refresh);
          } catch (_) {
            try { sessionStorage.setItem(`refresh_${ns}`, refresh); } catch (_) {}
          }
        }

        // Clear stale identity caches for this namespace so UI doesn't show old TR info
        try {
          localStorage.removeItem(`user_${ns}`);
          localStorage.removeItem(`role_${ns}`);
        } catch (_) {}
        try {
          sessionStorage.removeItem(`user_${ns}`);
          sessionStorage.removeItem(`role_${ns}`);
        } catch (_) {}

        // Remove legacy non-namespaced cache used by some older components
        try { localStorage.removeItem("user"); } catch (_) {}
        try { sessionStorage.removeItem("user"); } catch (_) {}

        // Prefetch /accounts/me and wait briefly so the dashboard reads the new identity
        let wroteIdentity = false;
        try {
          const meResp = await API.get("/accounts/me/");
          const meData = meResp?.data || null;
          if (meData) {
            try {
              localStorage.setItem(`user_${ns}`, JSON.stringify(meData));
              localStorage.setItem(`role_${ns}`, meData.role || ns);
              wroteIdentity = true;
            } catch (_) {
              try {
                sessionStorage.setItem(`user_${ns}`, JSON.stringify(meData));
                sessionStorage.setItem(`role_${ns}`, meData.role || ns);
                wroteIdentity = true;
              } catch (_) {}
            }
          }
        } catch (_) {}

        // Default destination per role namespace
        let dest = "/";
        if (ns === "user") dest = "/user/dashboard";
        if (ns === "agency") dest = "/agency/dashboard";
        if (ns === "employee") dest = "/employee/dashboard";
        if (next && typeof next === "string") dest = next;

        if (cancelled) return;

        // If identity write didn't complete, still proceed after a short delay to avoid hanging
        if (!wroteIdentity) {
          await new Promise((r) => setTimeout(r, 200));
        }

        try {
          window.location.replace(dest);
        } catch {
          window.location.href = dest;
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h3>Preparing impersonation...</h3>
      <div>You will be redirected to the dashboard shortly.</div>
    </div>
  );
}
