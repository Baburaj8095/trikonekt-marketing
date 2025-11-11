import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";
import { useLocation } from "react-router-dom";

/**
 * Minimal hierarchical tree for users (registered_by chain).
 * - Search by id | username | email | unique_id | sponsor_id | phone
 * - Lazy-load direct children via /api/admin/users/tree/children
 */

function Row({ depth, node, onToggle, loading }) {
  const pad = depth * 16;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderBottom: "1px solid #e2e8f0",
        background: "#fff",
      }}
    >
      <div style={{ width: pad }} />
      <button
        disabled={!node.has_children || loading}
        onClick={() => onToggle(node)}
        title={node.has_children ? "Toggle children" : "No children"}
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          border: "1px solid #e2e8f0",
          background: node._expanded ? "#0f172a" : "#f8fafc",
          color: node._expanded ? "#fff" : "#0f172a",
          cursor: node.has_children ? "pointer" : "default",
        }}
      >
        {node.has_children ? (node._expanded ? "−" : "+") : "•"}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>
          {node.username}{" "}
          <span style={{ color: "#64748b", fontWeight: 500 }}>
            #{node.id} • {node.full_name || "—"}
          </span>
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          role: {node.role || "n/a"} • category: {node.category || "n/a"} • phone:{" "}
          {node.phone || "n/a"} • state: {node.state_name || "n/a"} • pincode:{" "}
          {node.pincode || "n/a"} • direct: {node.direct_count || 0}
        </div>
      </div>
      {loading ? (
        <span style={{ color: "#64748b", fontSize: 12 }}>Loading...</span>
      ) : null}
    </div>
  );
}

export default function AdminUserTree() {
  const [identifier, setIdentifier] = useState("");
  const [root, setRoot] = useState(null);
  const [treeMap, setTreeMap] = useState({}); // id -> { ...node, _expanded, _children, _loading }
  const [err, setErr] = useState("");
  const [searching, setSearching] = useState(false);
  const [defaultDepth, setDefaultDepth] = useState(2);

  const canSearch = String(identifier || "").trim().length > 0;

  // Allow deep-link: /admin/user-tree?identifier=...
  const location = useLocation();
  const autoId = new URLSearchParams(location.search).get("identifier") || "";
  useEffect(() => {
    if (autoId) {
      setIdentifier(autoId);
      // fire search immediately when identifier is present in URL
      loadRoot(autoId);
    }
    // eslint-disable-next-line
  }, [autoId]);

  // If no deep-link identifier is present, load default admin root on mount and expand to defaultDepth
  useEffect(() => {
    if (!autoId) {
      loadDefaultRoot(true);
    }
    // eslint-disable-next-line
  }, []);

  // When root changes (via search or default load), auto-expand to defaultDepth (2 by default)
  useEffect(() => {
    if (root && defaultDepth >= 2) {
      expandToDepth(defaultDepth);
    }
    // eslint-disable-next-line
  }, [root, defaultDepth]);

  function resetTree() {
    setRoot(null);
    setTreeMap({});
    setErr("");
  }

  async function loadDefaultRoot(autoExpand = false) {
    setSearching(true);
    setErr("");
    try {
      const res = await API.get("/admin/users/tree/default-root/");
      const n = res?.data || null;
      if (!n) {
        setErr("No default root user found");
        setRoot(null);
        setTreeMap({});
        return;
      }
      setRoot(n);
      setTreeMap((prev) => ({
        ...prev,
        [n.id]: { ...n, _expanded: false, _children: [], _loading: false },
      }));
      if (autoExpand) {
        try {
          await expandToDepth(defaultDepth);
        } catch (_) {}
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load default root");
      setRoot(null);
      setTreeMap({});
    } finally {
      setSearching(false);
    }
  }

  async function loadRoot(valueOverride) {
    const computed = (valueOverride && typeof valueOverride !== "object") ? String(valueOverride) : identifier;
    const ident = (computed || "").trim();
    if (!ident) return;
    setSearching(true);
    setErr("");
    try {
      const res = await API.get("/admin/users/tree/root/", {
        params: { identifier: ident },
      });
      const n = res?.data || null;
      if (!n) {
        setErr("User not found");
        setRoot(null);
        setTreeMap({});
        return;
      }
      setRoot(n);
      setTreeMap((prev) => ({
        ...prev,
        [n.id]: { ...n, _expanded: false, _children: [], _loading: false },
      }));
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to find user");
      setRoot(null);
      setTreeMap({});
    } finally {
      setSearching(false);
    }
  }

  async function toggleNode(node) {
    const id = node.id;
    const current = treeMap[id] || node;
    if (!current.has_children) return;

    // Collapse
    if (current._expanded) {
      setTreeMap((prev) => ({
        ...prev,
        [id]: { ...current, _expanded: false },
      }));
      return;
    }

    // Expand -> if already have children, just expand
    if (Array.isArray(current._children) && current._children.length > 0) {
      setTreeMap((prev) => ({
        ...prev,
        [id]: { ...current, _expanded: true },
      }));
      return;
    }

    // Load children
    setTreeMap((prev) => ({
      ...prev,
      [id]: { ...current, _loading: true },
    }));
    try {
      const res = await API.get("/admin/users/tree/children/", {
        params: { userId: id, page: 1, page_size: 100 },
      });
      const items = res?.data?.results || [];
      // Merge children into map and mark expanded
      setTreeMap((prev) => {
        const next = { ...prev };
        items.forEach((c) => {
          const exist = next[c.id];
          next[c.id] = {
            ...(exist || c),
            _expanded: false,
            _children: exist?._children || [],
            _loading: false,
          };
        });
        next[id] = { ...current, _expanded: true, _children: items, _loading: false };
        return next;
      });
    } catch (_) {
      setTreeMap((prev) => ({
        ...prev,
        [id]: { ...current, _loading: false },
      }));
    }
  }

  async function loadChildrenFor(userId) {
    if (!userId) return [];
    const current = treeMap[userId] || {};

    // If already expanded and children present, return them
    if (current._expanded && Array.isArray(current._children) && current._children.length > 0) {
      return current._children;
    }

    // Mark loading
    setTreeMap((prev) => ({
      ...prev,
      [userId]: { ...(current || {}), _loading: true },
    }));

    try {
      const res = await API.get("/admin/users/tree/children/", {
        params: { userId, page: 1, page_size: 100 },
      });
      const items = res?.data?.results || [];

      setTreeMap((prev) => {
        const next = { ...prev };
        items.forEach((c) => {
          const exist = next[c.id];
          next[c.id] = {
            ...(exist || c),
            _expanded: false,
            _children: exist?._children || [],
            _loading: false,
          };
        });
        const base = next[userId] || current || {};
        next[userId] = { ...base, _expanded: true, _children: items, _loading: false };
        return next;
      });

      return items;
    } catch (_) {
      setTreeMap((prev) => ({
        ...prev,
        [userId]: { ...(current || {}), _loading: false },
      }));
      return [];
    }
  }

  async function expandToDepth(depth = 2) {
    const d = Math.max(1, Math.min(depth, 3));
    if (!root || !root.id) return;

    // Level 1: expand root
    const level1 = await loadChildrenFor(root.id);

    // Level 2: expand each child of root if target depth is 3
    if (d >= 3 && Array.isArray(level1)) {
      await Promise.all(level1.map((c) => loadChildrenFor(c.id)));
    }
  }

  // Render a flat list with indentation based on expanded state
  const flatList = useMemo(() => {
    if (!root) return [];
    const out = [];
    function walk(n, depth) {
      const ref = treeMap[n.id] || n;
      out.push({ depth, node: ref });
      if (ref._expanded && Array.isArray(ref._children)) {
        ref._children.forEach((c) => walk(treeMap[c.id] || c, depth + 1));
      }
    }
    walk(treeMap[root.id] || root, 0);
    return out;
  }, [root, treeMap]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>User Tree</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Search by id/username/email/unique_id/sponsor_id/phone. Click + to expand direct children.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Enter id / username / email / unique_id / sponsor_id / phone"
          style={{
            padding: "10px 12px",
            minWidth: 320,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            outline: "none",
          }}
        />
        <button
          disabled={!canSearch || searching}
          onClick={() => loadRoot()}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: 0,
            background: "#0f172a",
            color: "#fff",
            cursor: canSearch && !searching ? "pointer" : "not-allowed",
          }}
        >
          {searching ? "Searching..." : "Search"}
        </button>
        <button
          onClick={resetTree}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#0f172a",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
        <button
          onClick={() => expandToDepth(3)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: 0,
            background: "#334155",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Expand to 3 levels
        </button>
        {err ? <span style={{ color: "#dc2626", marginLeft: 8 }}>{err}</span> : null}
      </div>

      {!root ? (
        <div style={{ color: "#64748b" }}>Enter an identifier and search to view the hierarchy.</div>
      ) : (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              padding: "10px 10px",
              borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Hierarchy
          </div>
          {/* Rows */}
          <div>
            {flatList.map(({ depth, node }) => (
              <Row
                key={`${node.id}-${depth}`}
                depth={depth}
                node={node}
                loading={!!node._loading}
                onToggle={toggleNode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
