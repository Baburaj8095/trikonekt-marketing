/**
 * Simple global loading store for tracking in-flight API calls.
 * - incrementLoading(): increment counter
 * - decrementLoading(): decrement counter (never below 0)
 * - subscribe(listener): subscribe to counter changes, returns unsubscribe
 * - getLoadingCount(): current counter
 */
let loadingCount = 0;
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try {
      fn(loadingCount);
    } catch (_) {}
  }
}

export function incrementLoading() {
  loadingCount += 1;
  notify();
}

export function decrementLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  notify();
}

export function getLoadingCount() {
  return loadingCount;
}

export function subscribe(listener) {
  if (typeof listener === "function") {
    listeners.add(listener);
    // Immediately notify with current state
    try {
      listener(loadingCount);
    } catch (_) {}
  }
  return () => {
    listeners.delete(listener);
  };
}
