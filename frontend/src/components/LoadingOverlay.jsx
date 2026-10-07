import React, { useEffect, useState } from "react";
import { subscribe, resetLoading } from "../hooks/loadingStore";
import TrikonektInfinityLoader from "./common/TrikonektInfinityLoader";

/**
 * Global loading overlay that appears whenever there is at least one
 * in-flight API request tracked by loadingStore.
 * Now features the Trikonekt signature animated infinity symbol loader.
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
    <div
      onClick={() => resetLoading()}
      title="Click to dismiss loading overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
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
        style={{
          background: "#ffffff",
          padding: "24px 32px",
          borderRadius: "20px",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TrikonektInfinityLoader size={54} text="Connecting..." />
      </div>
    </div>
  );
}

