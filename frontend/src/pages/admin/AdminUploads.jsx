import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";

function TextInput({ label, value, onChange, placeholder, type = "text", style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          outline: "none",
          background: "#fff",
          ...style,
        }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          outline: "none",
          background: "#fff",
          ...style,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Section({ title, children, extraRight }) {
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
        {extraRight || null}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function humanDate(x) {
  try {
    return x ? new Date(x).toLocaleString() : "";
  } catch {
    return String(x || "");
  }
}

function ensureAbsolute(url) {
  if (!url) return "";
  if (String(url).startsWith("http")) return url;
  // Backend typically returns /media/... for local storage. Keep same-origin.
  return String(url);
}

export default function AdminUploads() {
  // Upload form
  const [form, setForm] = useState({ title: "", file: null });
  const [uploadBusy, setUploadBusy] = useState(false);

  // Listing
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Filters (client-side)
  const [filters, setFilters] = useState({
    search: "",
    pincode: "",
    state: "",
  });

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function loadRows(p = page) {
    setLoading(true);
    setErr("");
    try {
      const res = await API.get("/uploads/files/", { params: { page: p, page_size: pageSize } });
      const items = res?.data?.results || res?.data || [];
      const total = typeof res?.data?.count === "number" ? res.data.count : (Array.isArray(items) ? items.length : 0);
      setRows(Array.isArray(items) ? items : []);
      setCount(total || 0);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load uploads.");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows(1);
    setPage(1);
  }, []); // initial

  // Derived filtered rows (client-side filter on current page results)
  const shown = useMemo(() => {
    const s = (filters.search || "").trim().toLowerCase();
    const pin = (filters.pincode || "").trim().toLowerCase();
    const st = (filters.state || "").trim().toLowerCase();
    return (rows || []).filter((r) => {
      const title = String(r.title || "").toLowerCase();
      const rid = String(r.id || "");
      const userId = String(r.user || "");
      const upin = String(r.user_pincode || "").toLowerCase();
      const ustate = String(r.user_state || "").toLowerCase();
      let ok = true;
      if (s) ok = ok && (title.includes(s) || rid.includes(s) || userId.includes(s));
      if (pin) ok = ok && upin.includes(pin);
      if (st) ok = ok && ustate.includes(st);
      return ok;
    });
  }, [rows, filters]);

  async function onUpload(e) {
    e.preventDefault();
    if (!form.title || !form.file) {
      alert("Title and file are required.");
      return;
    }
    try {
      setUploadBusy(true);
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("file", form.file);
      await API.post("/uploads/files/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({ title: "", file: null });
      await loadRows(1);
      setPage(1);
      alert("Uploaded.");
    } catch (e2) {
      const msg =
        e2?.response?.data?.detail ||
        (typeof e2?.response?.data === "string" ? e2.response.data : "Upload failed.");
      alert(msg);
    } finally {
      setUploadBusy(false);
    }
  }

  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text);
      alert("Link copied.");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Link copied.");
    }
  }

  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
  async function goto(p) {
    const np = Math.max(1, Math.min(totalPages, p));
    setPage(np);
    await loadRows(np);
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Uploads</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Admin uploads management. Upload files (PDFs, images, docs) and browse per-role scoped listings.
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <a
          href="/api/uploads/debug/storage/"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: "#0ea5e9", textDecoration: "none" }}
          title="Inspect current storage backend"
        >
          Storage Info
        </a>
      </div>

      {/* Upload form */}
      <Section
        title="New Upload"
        extraRight={
          <button
            onClick={onUpload}
            disabled={uploadBusy || !form.title || !form.file}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: uploadBusy ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {uploadBusy ? "Uploading..." : "Upload"}
          </button>
        }
      >
        <form onSubmit={onUpload}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <TextInput
              label="Title"
              value={form.title}
              onChange={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="e.g., Terms & Conditions"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#64748b" }}>File</label>
              <input
                type="file"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                style={{
                  padding: "8px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                }}
              />
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Cloud files or local /media, depending on backend config.
              </div>
            </div>
          </div>
        </form>
      </Section>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <TextInput
          label="Search"
          value={filters.search}
          onChange={(v) => setF("search", v)}
          placeholder="title / id / user id"
        />
        <TextInput
          label="User Pincode"
          value={filters.pincode}
          onChange={(v) => setF("pincode", v)}
          placeholder="e.g., 560001"
        />
        <TextInput
          label="User State"
          value={filters.state}
          onChange={(v) => setF("state", v)}
          placeholder="e.g., Karnataka"
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => loadRows(1)}
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#0f172a",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button
          onClick={() => {
            setFilters({ search: "", pincode: "", state: "" });
          }}
          disabled={loading}
          style={{
            padding: "10px 12px",
            background: "#fff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Reset Filters
        </button>
        {err ? <div style={{ color: "#dc2626" }}>{err}</div> : null}
      </div>

      {/* Listing */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {!isMobile ? (
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                minWidth: 900,
                display: "grid",
                gridTemplateColumns: "80px 1fr 120px 160px 200px 140px",
                gap: 8,
                padding: "10px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <div>ID</div>
              <div>Title</div>
              <div>User ID</div>
              <div>Pincode / State</div>
              <div>Created</div>
              <div>Actions</div>
            </div>
            <div>
              {shown.map((u) => {
                const href = ensureAbsolute(u.file);
                return (
                  <div
                    key={u.id}
                    style={{
                      minWidth: 900,
                      display: "grid",
                      gridTemplateColumns: "80px 1fr 120px 160px 200px 140px",
                      gap: 8,
                      padding: "10px",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <div>#{u.id}</div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{u.title || "—"}</div>
                    <div>{u.user ?? "—"}</div>
                    <div>
                      {(u.user_pincode || "—")}{u.user_state ? ` • ${u.user_state}` : ""}
                    </div>
                    <div>{humanDate(u.created_at)}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {href ? (
                        <>
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              padding: "6px 10px",
                              background: "#0ea5e9",
                              color: "#fff",
                              borderRadius: 6,
                              textDecoration: "none",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            Open
                          </a>
                          <button
                            onClick={() => copyToClipboard(String(href).startsWith("http") ? href : (window.location.origin + href))}
                            style={{
                              padding: "6px 10px",
                              background: "#fff",
                              color: "#0f172a",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Copy Link
                          </button>
                        </>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: 12 }}>No file URL</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!loading && shown.length === 0 ? (
                <div style={{ padding: 12, color: "#64748b" }}>No results</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div>
            {shown.map((u) => {
              const href = ensureAbsolute(u.file);
              return (
                <div
                  key={u.id}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 900, color: "#0f172a" }}>#{u.id}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{humanDate(u.created_at)}</div>
                  </div>
                  <div style={{ color: "#0f172a", fontWeight: 700 }}>{u.title || "—"}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>User: {u.user ?? "—"}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {u.user_pincode || "—"}{u.user_state ? ` • ${u.user_state}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {href ? (
                      <>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: "8px 12px",
                            background: "#0ea5e9",
                            color: "#fff",
                            borderRadius: 8,
                            textDecoration: "none",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          Open
                        </a>
                        <button
                          onClick={() => copyToClipboard(String(href).startsWith("http") ? href : (window.location.origin + href))}
                          style={{
                            padding: "8px 12px",
                            background: "#fff",
                            color: "#0f172a",
                            border: "1px solid #e2e8f0",
                            borderRadius: 8,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          Copy Link
                        </button>
                      </>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: 12 }}>No file URL</span>
                    )}
                  </div>
                </div>
              );
            })}
            {!loading && shown.length === 0 ? (
              <div style={{ padding: 12, color: "#64748b" }}>No results</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {count} total • page {page} of {totalPages}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => goto(1)}
            disabled={loading || page <= 1}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer" }}
          >
            « First
          </button>
          <button
            onClick={() => goto(page - 1)}
            disabled={loading || page <= 1}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer" }}
          >
            ‹ Prev
          </button>
          <button
            onClick={() => goto(page + 1)}
            disabled={loading || page >= totalPages}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer" }}
          >
            Next ›
          </button>
          <button
            onClick={() => goto(totalPages)}
            disabled={loading || page >= totalPages}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer" }}
          >
            Last »
          </button>
        </div>
      </div>
    </div>
  );
}
