import React, { useEffect, useState } from "react";
import { subscribe } from "../hooks/loadingStore";

/**
 * Global loading overlay that appears whenever there is at least one
 * in-flight API request tracked by loadingStore.
 */
export default function LoadingOverlay() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsub = subscribe(setCount);
    return () => unsub && unsub();
  }, []);

  if (count <= 0) return null;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          pointerEvents: "none",
        }}
        aria-live="polite"
        aria-busy="true"
      >
        <div
          role="status"
          aria-label="Loading"
          style={{
            width: 48,
            height: 48,
            border: "4px solid rgba(255,255,255,0.6)",
            borderTopColor: "#1976d2",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            boxShadow: "0 0 8px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </>
  );
}
