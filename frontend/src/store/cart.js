/**
 * Centralized Cart Store
 * - Supports mixed item types: ECOUPON, PROMO_PACKAGE, PRODUCT (future)
 * - Persistent per role/namespace (user/agency/employee/admin/business) via localStorage
 * - In-memory files (payment proofs) are NOT persisted (browser limitation)
 *
 * Item shape:
 * {
 *   key: string,            // stable unique key
 *   type: "ECOUPON" | "PROMO_PACKAGE" | "PRODUCT",
 *   id: string | number,    // product/package id
 *   name: string,
 *   unitPrice: number,
 *   qty: number,
 *   meta: object,           // arbitrary metadata e.g. { denomination, package_number, boxes[], selected_product_id, shipping_address }
 *   file?: File | null      // proof file for this line (optional; not persisted)
 * }
 */

const NS_PREFIX = "cart";
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

/** Internal state (persisted fields) */
let state = {
  items: [], // persisted (without file objects)
};

/** Ephemeral (non-persisted) extras e.g. files by key */
let ephemerals = {
  files: new Map(), // key -> File
};

function shallowClone(item) {
  return { ...item, meta: item?.meta ? { ...item.meta } : {} };
}

function serializeForStorage(items) {
  // Drop File references before persisting
  return (items || []).map((it) => {
    const { file, ...rest } = it || {};
    return JSON.parse(JSON.stringify(rest || {}));
  });
}

function loadFromStorage() {
  try {
    const raw = (typeof localStorage !== "undefined" && localStorage.getItem(nsKey())) || "null";
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.items)) {
      state.items = obj.items.map((x) => shallowClone(x));
    } else if (Array.isArray(obj)) {
      // Backward compat if only array was stored
      state.items = obj.map((x) => shallowClone(x));
    } else {
      state.items = [];
    }
  } catch {
    state.items = [];
  }
}

function saveToStorage() {
  try {
    const payload = { items: serializeForStorage(state.items) };
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

function isFiniteNumber(n) {
  return typeof n === "number" && isFinite(n);
}

function asNumber(v, def = 0) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isFiniteNumber(n) ? n : def;
}

function metaKey(meta = {}) {
  try {
    // Build a deterministic meta signature for key hashing
    const safe = {};
    const keys = Object.keys(meta || {}).sort();
    for (const k of keys) {
      const val = meta[k];
      if (val == null) continue;
      if (Array.isArray(val)) {
        // Normalize arrays (e.g., boxes)
        safe[k] = val.slice().map((x) => (typeof x === "number" ? x : String(x))).sort();
      } else if (typeof val === "object") {
        // One level deep stringify for stability
        const inner = {};
        for (const ik of Object.keys(val).sort()) {
          inner[ik] = val[ik];
        }
        safe[k] = inner;
      } else {
        safe[k] = val;
      }
    }
    return JSON.stringify(safe);
  } catch {
    return "";
  }
}

function computeKey(type, id, meta = {}) {
  const base = `${String(type || "").toUpperCase()}:${String(id)}`;
  const mk = metaKey(meta);
  return mk ? `${base}:${mk}` : base;
}

function getState() {
  // Stitch ephemeral files back into items
  const items = (state.items || []).map((it) => {
    const f = ephemerals.files.get(it.key) || null;
    return { ...it, file: f || null };
  });
  return {
    items,
    count: items.length,
    total: items.reduce((sum, it) => sum + asNumber(it.unitPrice, 0) * asNumber(it.qty, 0), 0),
  };
}

function setState(nextItems) {
  state.items = (nextItems || []).map((x) => shallowClone(x));
  saveToStorage();
  notify();
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

export function getItems() {
  ensureLoaded();
  return getState().items;
}

export function getCartCount() {
  ensureLoaded();
  return getState().count;
}

export function getCartTotal() {
  ensureLoaded();
  return getState().total;
}

/**
  addItem
  - Merges by computed key (type+id+meta signature)
  - If existing, increments qty; else inserts
*/
export function addItem({ type, id, name = "", unitPrice = 0, qty = 1, meta = {}, file = null }) {
  ensureLoaded();
  const t = String(type || "").toUpperCase();
  const key = computeKey(t, id, meta);
  const next = state.items.slice();
  const idx = next.findIndex((x) => x.key === key);
  if (idx >= 0) {
    const cur = next[idx];
    const newQty = Math.max(1, asNumber(cur.qty, 1) + Math.max(1, asNumber(qty, 1)));
    next[idx] = { ...cur, qty: newQty };
  } else {
    next.push({
      key,
      type: t,
      id,
      name: String(name || ""),
      unitPrice: asNumber(unitPrice, 0),
      qty: Math.max(1, asNumber(qty, 1)),
      meta: meta || {},
    });
  }
  setState(next);
  if (file && typeof file === "object") {
    try {
      ephemerals.files.set(key, file);
    } catch {}
  }
  return key;
}

export function updateQty(key, qty) {
  ensureLoaded();
  const q = Math.max(1, asNumber(qty, 1));
  const next = (state.items || []).map((x) => (x.key === key ? { ...x, qty: q } : x));
  setState(next);
}

export function removeItem(key) {
  ensureLoaded();
  const next = (state.items || []).filter((x) => x.key !== key);
  setState(next);
  try {
    ephemerals.files.delete(key);
  } catch {}
}

export function clearCart() {
  ensureLoaded();
  setState([]);
  ephemerals.files.clear();
}

/** Attach/replace a proof file for a line (not persisted) */
export function setItemFile(key, fileOrNull) {
  ensureLoaded();
  if (!fileOrNull) {
    ephemerals.files.delete(key);
  } else {
    ephemerals.files.set(key, fileOrNull);
  }
  // Notify with new stitched state
  notify();
}

/** Update line item meta (merge). Useful for per-line shipping address, selections, etc. */
export function setItemMeta(key, partial = {}) {
  ensureLoaded();
  const next = (state.items || []).map((x) =>
    x.key === key ? { ...x, meta: { ...(x.meta || {}), ...(partial || {}) } } : x
  );
  setState(next);
}

/** Update a line's unit price (useful for part payment on Agency Packages) */
export function setItemUnitPrice(key, unitPrice) {
  ensureLoaded();
  const p = asNumber(unitPrice, 0);
  const v = Math.max(1, Number.isFinite(p) ? p : 1); // enforce minimum ₹1
  const next = (state.items || []).map((x) =>
    x.key === key ? { ...x, unitPrice: v } : x
  );
  setState(next);
}

/** Convenience helpers to add mapped item types */

export function addEcoupon({ productId, title = "E‑Coupon", unitPrice = 0, qty = 1, denomination = null }) {
  return addItem({
    type: "ECOUPON",
    id: productId,
    name: title,
    unitPrice,
    qty,
    meta: { denomination },
  });
}

export function addPromoPackagePrime({
  pkgId,
  name,
  unitPrice = 0,
  qty = 1,
  selected_product_id = null, // legacy (market.Product)
  selected_promo_product_id = null, // new (business.PromoProduct)
  shipping_address = "",
  prime150_choice = null,
  prime750_choice = null,
}) {
  return addItem({
    type: "PROMO_PACKAGE",
    id: pkgId,
    name,
    unitPrice,
    qty,
    meta: {
      kind: "PRIME",
      selected_product_id,
      selected_promo_product_id,
      shipping_address,
      prime150_choice,
      prime750_choice,
    },
  });
}

export function addPromoPackageMonthly({ pkgId, name, unitPrice = 0, package_number = null, boxes = [] }) {
  const boxesArr = Array.isArray(boxes) ? boxes.map((x) => Number(x)).filter((x) => Number.isFinite(x)).sort((a, b) => a - b) : [];
  return addItem({
    type: "PROMO_PACKAGE",
    id: pkgId,
    name,
    unitPrice,
    qty: Math.max(1, boxesArr.length || 1),
    meta: { kind: "MONTHLY", package_number, boxes: boxesArr },
  });
}

/**
 * Add a physical product to the centralized cart
 * meta includes minimal shipping data; contact details can be collected at checkout.
 */
export function addProduct({
  productId,
  name,
  unitPrice = 0,
  qty = 1,
  shipping_address = "",
  image_url = "",
  // TRI App extras (optional; ignored for normal marketplace products)
  tri = false,
  max_reward_pct = 0,
  tri_app_slug = "",
}) {
  return addItem({
    type: "PRODUCT",
    id: productId,
    name,
    unitPrice,
    qty: Math.max(1, Number(qty) || 1),
    meta: {
      shipping_address,
      image_url,
      // Pass through TRI metadata so checkout can compute reward discounts
      tri: !!tri,
      max_reward_pct: Number(max_reward_pct || 0),
      tri_app_slug: tri_app_slug || "",
    },
  });
}

/**
 * Agency Prime Package (agency-side cart)
 * By default, unitPrice should be the package amount, but you can also
 * add a line for the remaining amount only (from AgencyPrimeApproval page).
 * Reference and notes are stored in meta and sent during checkout.
 */
export function addAgencyPackage({
  pkgId,
  name,
  unitPrice = 0,
  qty = 1,
  reference = null,
  notes = null,
}) {
  return addItem({
    type: "AGENCY_PACKAGE",
    id: pkgId,
    name,
    unitPrice,
    qty: Math.max(1, Number(qty) || 1),
    meta: { reference, notes },
  });
}
