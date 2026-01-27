// Node script to fix mojibake sequences committed into source files
// Scans frontend/src and frontend/public by default, replacing common CP1252->UTF-8 artifacts.
//
// Usage:
//   node scripts/fix_mojibake.js [dir1] [dir2] ...
//
// Notes:
// - Skips binary-ish and vendor/build folders.
// - Operates on text files: .js, .jsx, .ts, .tsx, .json, .html, .css, .md, .txt

const fs = require("fs");
const path = require("path");

const DEFAULT_DIRS = ["frontend/src", "frontend/public"];
const SKIP_DIRS = new Set(["node_modules", "build", "dist", ".git", ".next", "coverage", "out"]);
const TEXT_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".html", ".css", ".md", ".txt"]);

const replacements = [
  // Quotes
  { re: /â€™/g, to: "’" }, // right single quote
  { re: /â€˜/g, to: "‘" }, // left single quote
  { re: /â€œ/g, to: "“" }, // left double quote
  { re: /â€/g, to: "”" }, // right double quote

  // Dashes, bullets, ellipsis
  { re: /â€“/g, to: "–" }, // en dash
  { re: /â€”/g, to: "—" }, // em dash
  { re: /â€‘/g, to: "‑" }, // non-breaking hyphen U+2011
  { re: /â€¢/g, to: "•" }, // bullet
  { re: /â€¦/g, to: "…" }, // ellipsis

  // Rupee
  { re: /â‚¹/g, to: "₹" }, // INR sign

  // Multiplication sign
  { re: /Ã—/g, to: "×" }, // multiplication sign

  // Single guillemets and chevron
  { re: /â€º/g, to: "›" },
  { re: /â€¹/g, to: "‹" },

  // Common CP1252 leftovers
  { re: /Â©/g, to: "©" },
  { re: /Â®/g, to: "®" },
  { re: /Â±/g, to: "±" },
  { re: /Â·/g, to: "·" },

  // Stray 'Â' often preceding punctuation
  { re: /Â/g, to: "" },

  // Additional observed sequences in repo
  { re: /”¢/g, to: "•" },
  { re: /âœ”/g, to: "✔" },
  { re: /âœ”ï¸/g, to: "✔️" },
  { re: /ðŸ”´/g, to: "🔴" },
  { re: /ðŸ“œ/g, to: "📜" },
  { re: /ðŸ”‘/g, to: "🔑" },
  { re: /â‘ /g, to: "①" },
  { re: /â‘¡/g, to: "②" },
  { re: /â‘¢/g, to: "③" },

  // Generic bad curly pair -> empty (used as placeholder like "””")
  { re: /””/g, to: "" },

  // Curly quote + prime/apostrophe used as hyphen; normalize to non-breaking hyphen
  { re: /”‘/g, to: "‑" }, // U+2011

  // Emoji sequences occasionally present as mojibake
  { re: /ðŸ“ž/g, to: "📞" }, // telephone receiver
  { re: /âœ‰ï¸/g, to: "✉️" }, // envelope with VS16

];

function isTextFile(p) {
  const ext = path.extname(p).toLowerCase();
  return TEXT_EXTS.has(ext);
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function applyReplacements(content) {
  let changed = false;
  let counts = Object.create(null);
  for (const { re, to } of replacements) {
    const before = content;
    content = content.replace(re, (m) => {
      counts[to] = (counts[to] || 0) + 1;
      return to;
    });
    if (content !== before) changed = true;
  }
  return { content, changed, counts };
}

function main() {
  const roots = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_DIRS).map((p) =>
    path.resolve(process.cwd(), p)
  );

  const summary = {
    scannedFiles: 0,
    modifiedFiles: 0,
    totalReplacements: 0,
    byChar: Object.create(null),
    modifiedList: [],
  };

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      if (!isTextFile(file)) continue;
      summary.scannedFiles++;

      let content;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }

      const { content: next, changed, counts } = applyReplacements(content);
      if (changed) {
        try {
          fs.writeFileSync(file, next, "utf8");
          summary.modifiedFiles++;
          const fileCount = Object.values(counts).reduce((a, b) => a + b, 0);
          summary.totalReplacements += fileCount;
          for (const [char, n] of Object.entries(counts)) {
            summary.byChar[char] = (summary.byChar[char] || 0) + n;
          }
          summary.modifiedList.push({ file, counts });
          console.log(`[fixed] ${file} (${fileCount} replacements)`);
        } catch (e) {
          console.error(`[error] Failed to write ${file}:`, e.message);
        }
      }
    }
  }

  console.log("\n=== Mojibake fix summary ===");
  console.log(`Scanned files:      ${summary.scannedFiles}`);
  console.log(`Modified files:     ${summary.modifiedFiles}`);
  console.log(`Total replacements: ${summary.totalReplacements}`);
  if (summary.modifiedFiles) {
    console.log("\nBy character:");
    for (const [char, n] of Object.entries(summary.byChar)) {
      console.log(`  ${char} : ${n}`);
    }
  }
}

if (require.main === module) {
  main();
}
