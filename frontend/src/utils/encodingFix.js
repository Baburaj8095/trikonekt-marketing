/**
 * Utilities to detect and fix mojibake (UTF-8 decoded as ISO-8859-1/Windows-1252)
 * Common sequences: ’, “, ”, ”“, , •, ”¦, Ã, , ₹ (₹)
 */

export function looksLikeMojibake(s) {
  if (typeof s !== "string" || s.length === 0) return false;
  // Heuristic: look for frequent mojibake markers or Unicode replacement char
  return /(?:\uFFFD|Ã|Â|â€|â‚¹|â€¢|â€”|â€“|â€˜|â€™|â€œ|â€)/.test(s);
}

/**
 * Attempt to recover original UTF-8 string from a mis-decoded Latin-1/Win-1252 string.
 * Reinterprets each codepoint (0-255) as a byte and decodes via UTF-8.
 */
export function fixMojibakeString(s) {
  if (typeof s !== "string") return s;
  if (!looksLikeMojibake(s)) return s;

  // Pre-map some very common sequences to improve output even if re-decode fails
  const mappings = [
    [/’/g, "’"],
    [/“|”/g, '"'],
    [/”“/g, "–"],
    [/•/g, "•"],
    [/”¦/g, "…"],
    [/©/g, "©"],
    [/·/g, "·"],
    [/±/g, "±"],
    [/®/g, "®"],
    [/”º/g, "›"],
    [/”¹/g, "‹"],
    [/‑/g, "-"],
    [/₹/g, "₹"],
    [/📞/g, "📞"],
    [/✉️/g, "✉️"],
    [/\u00A0/g, ""], // stray CP1252 NBSP marker often preceding punctuation
  ];

  // Accurate CP1252 Unicode->byte mapping for 0x80..0x9F range
  const CP1252_TO_BYTE = {
    0x20ac: 0x80, // €
    0x201a: 0x82, // ‚
    0x0192: 0x83, // ƒ
    0x201e: 0x84, // „
    0x2026: 0x85, // …
    0x2020: 0x86, // †
    0x2021: 0x87, // ‡
    0x02c6: 0x88, // ˆ
    0x2030: 0x89, // ‰
    0x0160: 0x8a, // Š
    0x2039: 0x8b, // ‹
    0x0152: 0x8c, // Œ
    0x017d: 0x8e, // Ž
    0x2018: 0x91, // ‘
    0x2019: 0x92, // ’
    0x201c: 0x93, // “
    0x201d: 0x94, // ”
    0x2022: 0x95, // •
    0x2013: 0x96, // –
    0x2014: 0x97, // —
    0x02dc: 0x98, // ˜
    0x2122: 0x99, // ™
    0x0161: 0x9a, // š
    0x203a: 0x9b, // ›
    0x0153: 0x9c, // œ
    0x017e: 0x9e, // ž
    0x0178: 0x9f, // Ÿ
  };

  let out = s;
  for (const [re, rep] of mappings) out = out.replace(re, rep);

  const hasMarkers = looksLikeMojibake(out) || /[\u0080-\u009F]/.test(out);

  if (hasMarkers) {
    try {
      // Encode assuming the current string is CP1252-decoded output
      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) {
        const code = out.charCodeAt(i);
        if (code <= 0xff) {
          bytes[i] = code & 0xff;
        } else {
          const mapped = CP1252_TO_BYTE[code] ?? CP1252_TO_BYTE[code | 0];
          bytes[i] = typeof mapped === "number" ? mapped : 0x3f; // '?' fallback
        }
      }
      // Decode bytes as UTF-8 to recover the intended text
      out = new TextDecoder("utf-8").decode(bytes);
    } catch {
      // ignore and keep pre-mapped result
    }
  }

  // Post-map again to clean up any residuals
  for (const [re, rep] of mappings) out = out.replace(re, rep);

  // Strip stray control characters (keep newline/tab/carriage return)
  out = out.replace(/[\u0000-\u001F\u007F]/g, (c) => (c === "\n" || c === "\r" || c === "\t") ? c : "");

  return out;
}

/**
 * Recursively fix mojibake in JSON-like structures.
 */
export function deepFixMojibake(value) {
  if (value == null) return value;

  if (typeof value === "string") {
    return fixMojibakeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(deepFixMojibake);
  }

  if (typeof value === "object") {
    const out = Array.isArray(value) ? [] : { ...value };
    for (const key of Object.keys(value)) {
      out[key] = deepFixMojibake(value[key]);
    }
    return out;
  }

  return value;
}

/**
 * Sweep the DOM and repair text nodes that look like mojibake.
 * Also observes future mutations to keep fixing dynamically-rendered content.
 */
export function installDomTextFixer() {
  const fixNode = (node) => {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const original = node.nodeValue || "";
      const fixed = looksLikeMojibake(original) ? fixMojibakeString(original) : original;
      if (fixed !== original) {
        node.nodeValue = fixed;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_NODE) {
      const children = node.childNodes || [];
      for (let i = 0; i < children.length; i++) {
        fixNode(children[i]);
      }
    }
  };

  try {
    if (document && document.body) {
      // Initial sweep
      fixNode(document.body);

      // Observe dynamic updates
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "characterData" && m.target) {
            fixNode(m.target);
          } else if (m.type === "childList") {
            if (m.addedNodes && m.addedNodes.length) {
              for (let i = 0; i < m.addedNodes.length; i++) {
                fixNode(m.addedNodes[i]);
              }
            }
          }
        }
      });

      observer.observe(document.documentElement, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  } catch {
    // no-op
  }
}
