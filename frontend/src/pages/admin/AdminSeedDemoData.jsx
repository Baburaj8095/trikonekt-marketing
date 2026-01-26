import React, { useMemo, useState } from "react";
import API from "../../api/api";

function Section({ title, children, action }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "10px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, color: "#0f172a" }}>{title}</div>
        {action || null}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function useDemoData() {
  const categories = useMemo(
    () => [
      { key: "electronics", label: "Electronics", color: "#1d4ed8" },
      { key: "furniture", label: "Furniture", color: "#7c3aed" },
      { key: "ev-vehicles", label: "EV Vehicles", color: "#047857" },
      { key: "holidays", label: "Holidays", color: "#db2777" },
      { key: "properties", label: "Properties", color: "#0f766e" },
      { key: "saving", label: "Saving Plans", color: "#9333ea" },
      { key: "local-store", label: "Local Store", color: "#2563eb" },
      { key: "fashion", label: "Fashion", color: "#dc2626" },
      { key: "groceries", label: "Groceries", color: "#059669" },
      { key: "health-beauty", label: "Health & Beauty", color: "#ea580c" },
    ],
    []
  );

  // 10 products (1 per category for simplicity)
  const products = useMemo(() => {
    const now = Date.now();
    const base = [
      { name: "Smartphone Pro X", cat: "electronics", price: 24999, qty: 12 },
      { name: "Modern Sofa 3-Seater", cat: "furniture", price: 18999, qty: 5 },
      { name: "eBike Ranger 2.0", cat: "ev-vehicles", price: 49999, qty: 3 },
      { name: "Goa Beach Package", cat: "holidays", price: 9999, qty: 20 },
      { name: "2BHK City Apartment", cat: "properties", price: 1500000, qty: 1 },
      { name: "Monthly Savings Plan", cat: "saving", price: 750, qty: 100 },
      { name: "Organic Veg Box", cat: "groceries", price: 699, qty: 50 },
      { name: "Casual Cotton T”‘Shirt", cat: "fashion", price: 499, qty: 80 },
      { name: "Herbal Facewash", cat: "health-beauty", price: 199, qty: 60 },
      { name: "Grocery Delivery Combo", cat: "local-store", price: 999, qty: 30 },
    ];
    return base.map((p, i) => ({
      ...p,
      description: `${p.name} ”” Demo product seeded at ${new Date(now).toLocaleString()}.`,
      discount: i % 3 === 0 ? 10 : 0,
      max_reward_redeem_percent: i % 2 === 0 ? 5 : 0,
      country: "IN",
      state: "KA",
      city: "Bengaluru",
      pincode: "560001",
    }));
  }, []);

  return { categories, products };
}

// Canvas â†’ PNG dataURL â†’ Blob
async function makeCategoryImage(label, bg = "#0f172a") {
  const w = 256;
  const h = 160;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // subtle grid
  ctx.strokeStyle = "#ffffff22";
  for (let x = 0; x < w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // label
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2);

  const dataURL = canvas.toDataURL("image/png");
  const blob = await (await fetch(dataURL)).blob();
  return new File([blob], `${label.toLowerCase().replace(/\s+/g, "-")}.png`, { type: "image/png" });
}

async function makeProductImage(title, bg = "#334155") {
  const w = 512;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // product box
  ctx.fillStyle = "#0ea5e9";
  ctx.fillRect(48, 48, w - 96, h - 200);
  // title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapText(ctx, title, w - 80);
  const lineHeight = 34;
  const startY = h - 110 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, idx) => {
    ctx.fillText(line, w / 2, startY + idx * lineHeight);
  });

  const dataURL = canvas.toDataURL("image/png");
  const blob = await (await fetch(dataURL)).blob();
  return new File([blob], `${title.toLowerCase().replace(/\s+/g, "-")}.png`, { type: "image/png" });
}

// Simple text wrapper for canvas
function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(" ");
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    const w = ctx.measureText(test).width;
    if (w < maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = words[i];
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export default function AdminSeedDemoData() {
  const { categories, products } = useDemoData();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);

  const appendLog = (m) => setLog((lst) => [...lst, `${new Date().toLocaleTimeString()}  ${m}`]);

  const seedCategories = async () => {
    appendLog("Seeding categories...");
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      try {
        const img = await makeCategoryImage(c.label, c.color);
        const fd = new FormData();
        fd.append("key", c.key);
        fd.append("label", c.label);
        fd.append("name", c.label); // compat
        fd.append("route", `/trikonekt-products?category=${encodeURIComponent(c.key)}`);
        fd.append("order", String(i));
        fd.append("home_limit", "10");
        fd.append("is_active", "true");
        fd.append("show_on_home", "true");
        fd.append("hide_when_empty", "false");
        fd.append("image", img);

        await API.post("/uploads/category-banners/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        appendLog(`âœ“ Category created: ${c.label} (${c.key})`);
      } catch (e) {
        const code = e?.response?.status;
        const msg = e?.response?.data?.detail || e?.message || "error";
        appendLog(`! Category (${c.key}) skipped/failed: ${code || ""} ${msg}`);
      }
    }
  };

  const seedProducts = async () => {
    appendLog("Seeding products...");
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        const img = await makeProductImage(p.name);
        const fd = new FormData();
        fd.append("name", p.name);
        fd.append("description", p.description || "");
        fd.append("category", p.cat); // IMPORTANT: use category key
        fd.append("price", String(p.price));
        fd.append("quantity", String(p.qty));
        if (p.discount) fd.append("discount", String(p.discount));
        if (p.max_reward_redeem_percent)
          fd.append("max_reward_redeem_percent", String(p.max_reward_redeem_percent));
        fd.append("country", p.country || "");
        fd.append("state", p.state || "");
        fd.append("city", p.city || "");
        fd.append("pincode", p.pincode || "");
        fd.append("image", img);

        await API.post("/products", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        appendLog(`âœ“ Product created: ${p.name} [${p.cat}]`);
      } catch (e) {
        const code = e?.response?.status;
        const msg = e?.response?.data?.detail || e?.message || "error";
        appendLog(`! Product (${p.name}) failed: ${code || ""} ${msg}`);
      }
    }
  };

  const runSeed = async () => {
    if (busy) return;
    setBusy(true);
    setLog([]);
    setDone(false);
    try {
      await seedCategories();
      await seedProducts();
      appendLog("All done.");
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Seed Demo Categories & Products</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Click the button to create 10 categories and 10 products with generated images. Requires admin access.
        </div>
      </div>

      <Section
        title="Generate demo data"
        action={
          <button
            onClick={runSeed}
            disabled={busy}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {busy ? "Working”¦" : "Create 10 categories + 10 products"}
          </button>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Categories to create</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {categories.map((c) => (
                <li key={c.key} style={{ fontSize: 13, color: "#334155" }}>
                  {c.label} <span style={{ color: "#64748b" }}>({c.key})</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Products to create</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {products.map((p) => (
                <li key={p.name} style={{ fontSize: 13, color: "#334155" }}>
                  {p.name} <span style={{ color: "#64748b" }}>[{p.cat}]</span> ”” ₹{p.price} ({p.qty} qty)
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Logs">
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#fff",
            padding: 8,
            maxHeight: 280,
            overflow: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: 12,
            color: "#0f172a",
            whiteSpace: "pre-wrap",
          }}
        >
          {log.length === 0 ? <div style={{ color: "#64748b" }}>No logs yet.</div> : log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        {done ? (
          <div style={{ marginTop: 8, color: "#16a34a", fontWeight: 700 }}>
            Completed. Check Admin â†’ E”‘commerce Categories and Admin â†’ Products, and the user page /trikonekt-products.
          </div>
        ) : null}
      </Section>
    </div>
  );
}

