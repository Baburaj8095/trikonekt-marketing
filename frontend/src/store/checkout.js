/**
 * Lightweight Checkout Store (namespace-aware, similar to cart store)
 * - Persists non-file checkout state across page reloads
 * - Ephemeral file (payment screenshot) kept in-memory
 * - API mirrors cart store patterns for consistency
 *
 * State shape:
 * {
 *   step: number,
 *   contact: { name, email, phone },
 *   utr: string,
 *   notes: string
 * }
 */

const NS_PREFIX = "checkout";
const listeners = new Set();

function currentNamespace() {
  try {
    const p =
      typeof window !== "undefined" &&
      window.location &&
      typeof window.location.pathname === "string"
        ? window.location.pathname
        : "";
    if (p.startsWith("/admin")) return "admin";
    if (p.startsWith("/agency")) return "agency";
    if (p.startsWith("/employee")) return "employee";
    if (p.startsWith("/business")) return "business";
    return "user";
  } catch {
    return "user";
  }
}

function nsKey() {
  return `${NS_PREFIX}_${currentNamespace()}`;
}

let state = {
  step: 0,
  contact: { name: "", email: "", phone: "" },
  utr: "",
  notes: "",
};

let ephemerals = {
  paymentFile: null, // File | null
};

function serializeForStorage(st) {
  try {
    // Drop File references before persisting
    const { ...rest } = st || {};
    return JSON.parse(JSON.stringify(rest || {}));
  } catch {
    return { step: 0, contact: { name: "", email: "", phone: "" }, utr: "", notes: "" };
  }
}

function loadFromStorage() {
  try {
    const raw =
      (typeof localStorage !== "undefined" && localStorage.getItem(nsKey())) ||
      "null";
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      state.step = Number.isFinite(obj.step) ? obj.step : 0;
      const c = obj.contact || {};
      state.contact = {
        name: String(c.name || ""),
        email: String(c.email || ""),
        phone: String(c.phone || ""),
      };
      state.utr = String(obj.utr || "");
      state.notes = String(obj.notes || "");
    } else {
      // defaults
      state = {
        step: 0,
        contact: { name: "", email: "", phone: "" },
        utr: "",
        notes: "",
      };
    }
  } catch {
    state = {
      step: 0,
      contact: { name: "", email: "", phone: "" },
      utr: "",
      notes: "",
    };
  }
}

function saveToStorage() {
  try {
    const payload = serializeForStorage(state);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(nsKey(), JSON.stringify(payload));
    }
  } catch {}
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(getState());
    } catch (_) {}
  }
}

function ensureLoaded() {
  if (!ensureLoaded._done) {
    loadFromStorage();
    ensureLoaded._done = true;
  }
}
ensureLoaded._done = false;

/** Public API */

export function subscribe(listener) {
  ensureLoaded();
  if (typeof listener === "function") {
    listeners.add(listener);
    try {
      listener(getState());
    } catch {}
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getState() {
  ensureLoaded();
  return {
    ...state,
    file: ephemerals.paymentFile || null,
  };
}

function setState(partial) {
  ensureLoaded();
  state = { ...state, ...(partial || {}) };
  saveToStorage();
  notify();
}

export function setStep(step) {
  const n = Number(step);
  setState({ step: Number.isFinite(n) ? n : 0 });
}

export function setContact(contact = {}) {
  const next = {
    name: String(contact?.name || ""),
    email: String(contact?.email || ""),
    phone: String(contact?.phone || ""),
  };
  setState({ contact: next });
}

export function setUTR(utr = "") {
  setState({ utr: String(utr || "") });
}

export function setNotes(notes = "") {
  setState({ notes: String(notes || "") });
}

export function setPaymentFile(fileOrNull) {
  ensureLoaded();
  ephemerals.paymentFile = fileOrNull || null;
  notify();
}

export function resetCheckout() {
  ensureLoaded();
  state = {
    step: 0,
    contact: { name: "", email: "", phone: "" },
    utr: "",
    notes: "",
  };
  ephemerals.paymentFile = null;
  saveToStorage();
  notify();
}
