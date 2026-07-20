/**
 * Simple global loading store for tracking in-flight API calls.
 * - incrementLoading(): increment counter
 * - decrementLoading(): decrement counter (never below 0)
 * - resetLoading(): force counter to 0 (safety reset)
 * - subscribe(listener): subscribe to counter changes, returns unsubscribe
 * - getLoadingCount(): current counter
 */
let loadingCount = 0;
const listeners = new Set();
let safetyTimer = null;

function notify() {
  for (const fn of listeners) {
    try {
      fn(loadingCount);
    } catch (_) {}
  }
}

function resetSafetyTimer() {
  if (safetyTimer) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
  if (loadingCount > 0) {
    safetyTimer = setTimeout(() => {
      loadingCount = 0;
      safetyTimer = null;
      notify();
    }, 8000);
  }
}

export function incrementLoading() {
  loadingCount += 1;
  resetSafetyTimer();
  notify();
}

export function decrementLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  resetSafetyTimer();
  notify();
}

export function resetLoading() {
  loadingCount = 0;
  if (safetyTimer) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
  notify();
}

export function getLoadingCount() {
  return loadingCount;
}

export function subscribe(listener) {
  if (typeof listener === "function") {
    listeners.add(listener);
    try {
      listener(loadingCount);
    } catch (_) {}
  }
  return () => {
    listeners.delete(listener);
  };
}


