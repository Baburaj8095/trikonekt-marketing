import React, { useEffect, useState } from "react";
import { subscribe, resetLoading } from "../hooks/loadingStore";

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

  // Safety: If overlay stays visible for > 6 seconds continuously, auto reset count to unfreeze UI
  useEffect(() => {
    if (count <= 0) return;
    const timer = setTimeout(() => {
      resetLoading();
    }, 6000);
    return () => clearTimeout(timer);
  }, [count]);

  if (count <= 0) return null;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        onClick={() => resetLoading()}
        title="Click to dismiss loading overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          cursor: "pointer",
        }}
        aria-live="polite"
        aria-busy="true"
      >
        <div
          role="status"
          aria-label="Loading"
          style={{
            width: 44,
            height: 44,
            border: "4px solid rgba(255,255,255,0.7)",
            borderTopColor: "#0ea5e9",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            boxShadow: "0 0 10px rgba(0,0,0,0.18)",
          }}
        />
      </div>
    </>
  );
}

