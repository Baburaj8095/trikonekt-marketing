import React from "react";
import API from "../../api/api";

// Canonical module keys must match backend/adminapi/permissions.py MODULE_KEYS
const MODULE_KEYS = [
  "users",
  "ecoupons",
  "promo",
  "kyc",
  "withdrawals",
  "support",
  "autopool",
  "commissions",
  "reports_basic",
  "reports_finance",
];

const MODULE_TO_CODENAME = Object.freeze(
  MODULE_KEYS.reduce((acc, k) => {
    acc[k] = `adminapi.access_${k}`;
    return acc;
  }, {})
);

function Section({ title, children, subtitle }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", marginBottom: 14 }}>
      <div style={{ padding: 12, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, color: "#0f172a" }}>{title}</div>
        {subtitle ? <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{subtitle}</div> : null}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

export default function AdminAccessManager() {
  // Global state
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  // Permissions index (auth.permission) for adminapi.access_*
  const [permIndex, setPermIndex] = React.useState(null); // {codename -> {id, name}}
  const [permIndexLoading, setPermIndexLoading] = React.useState(false);
  const [permIndexErr, setPermIndexErr] = React.useState("");

  // Create user form
  const [createUsername, setCreateUsername] = React.useState("");
  const [createEmail, setCreateEmail] = React.useState("");
  const [createdUser, setCreatedUser] = React.useState(null); // {id, username, email}
  const [tempPassword, setTempPassword] = React.useState("");

  // Target (existing or just created) user
  const [lookup, setLookup] = React.useState("");
  const [userDetail, setUserDetail] = React.useState(null); // dynamic customuser object
  const [userLoading, setUserLoading] = React.useState(false);
  const [userErr, setUserErr] = React.useState("");

  // Modules editor
  const [selectedModules, setSelectedModules] = React.useState(() =>
    MODULE_KEYS.reduce((acc, k) => {
      acc[k] = false;
      return acc;
    }, {})
  );
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState("");

  // Fetch permissions index (auth.permission rows for adminapi.access_*)
  const ensurePermIndex = React.useCallback(async () => {
    if (permIndex) return permIndex;
    setPermIndexLoading(true);
    setPermIndexErr("");
    try {
      // Use dynamic admin endpoint (ModelViewSet with search)
      // Try to fetch all adminapi.access_* permissions in one go
      const res = await API.get("admin/dynamic/auth/permission/", {
        params: { search: "adminapi.access_", page_size: 200 },
      });
      const rows = Array.isArray(res?.data?.results) ? res.data.results : [];
      const idx = {};
      for (const p of rows) {
        const code = String(p?.codename || "");
        if (code.startsWith("adminapi.access_")) {
          idx[code] = { id: p.id, name: p.name, codename: code };
        }
      }
      // Fallback: individual lookups if any module is missing
      for (const mk of MODULE_KEYS) {
        const cd = MODULE_TO_CODENAME[mk];
        if (!idx[cd]) {
          try {
            const r = await API.get("admin/dynamic/auth/permission/", { params: { search: cd, page_size: 10 } });
            const rr = Array.isArray(r?.data?.results) ? r.data.results : [];
            const hit = rr.find((x) => String(x?.codename) === cd);
            if (hit) idx[cd] = { id: hit.id, name: hit.name, codename: hit.codename };
          } catch {}
        }
      }
      setPermIndex(idx);
      return idx;
    } catch (e) {
      setPermIndexErr("Failed to load admin permissions index. Ensure you are superuser or have auth.permission view access.");
      return null;
    } finally {
      setPermIndexLoading(false);
    }
  }, [permIndex]);

  // Utilities
  function toStr(x) {
    return x === null || x === undefined ? "" : String(x);
  }
  function isDigits(s) {
    return /^[0-9]+$/.test(String(s).trim());
  }

  // Create Admin user (no password yet)
  async function handleCreateUser() {
    setError("");
    setNotice("");
    setCreatedUser(null);
    setTempPassword("");
    const username = toStr(createUsername).trim();
    const email = toStr(createEmail).trim();
    if (!username) {
      setError("Username is required.");
      return;
    }
    setLoading(true);
    try {
      // Create via dynamic CustomUser endpoint; set staff/active flags
      const payload = {
        username,
        email,
        is_staff: true,
        is_active: true,
      };
      const res = await API.post("admin/dynamic/accounts/customuser/", payload);
      const obj = res?.data || null;
      if (!obj || !obj.id) throw new Error("User creation failed");
      setCreatedUser({ id: obj.id, username: obj.username, email: obj.email || "" });

      // Immediately set a temporary secure password using superuser-only endpoint
      try {
        const t = await API.post(`admin/users/${obj.id}/set-temp-password/`, {});
        const pwd = t?.data?.temp_password || "";
        setTempPassword(pwd);
        setNotice("User created and temporary password generated.");
      } catch (e) {
        setNotice("User created. Failed to generate temp password; you can set later from Admin Users grid.");
      }

      // Preload user into editor
      await loadUserDetailById(obj.id);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to create user";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Load user detail (dynamic) by id
  async function loadUserDetailById(id) {
    setUserLoading(true);
    setUserErr("");
    try {
      const res = await API.get(`admin/dynamic/accounts/customuser/${id}/`);
      const obj = res?.data || null;
      setUserDetail(obj);
      // Build current modules map based on user_permissions ids
      const idx = await ensurePermIndex();
      const current = MODULE_KEYS.reduce((acc, k) => {
        acc[k] = false;
        return acc;
      }, {});
      if (obj && idx) {
        const up = Array.isArray(obj.user_permissions) ? obj.user_permissions : [];
        const adminapiIds = new Set(Object.values(idx).map((p) => p.id));
        const have = new Set(up.filter((pid) => adminapiIds.has(pid)));
        for (const mk of MODULE_KEYS) {
          const cd = MODULE_TO_CODENAME[mk];
          const pid = idx[cd]?.id;
          if (pid && have.has(pid)) current[mk] = true;
        }
        // Superuser implies all modules, even if permissions aren't explicitly set
        if (obj.is_superuser) {
          for (const mk of MODULE_KEYS) current[mk] = true;
        }
      }
      setSelectedModules(current);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load user";
      setUserErr(msg);
      setUserDetail(null);
    } finally {
      setUserLoading(false);
    }
  }

  // Lookup user by identifier (id or username)
  async function handleLookup() {
    setUserErr("");
    setNotice("");
    const q = toStr(lookup).trim();
    if (!q) {
      setUserErr("Enter user id or username.");
      return;
    }
    if (isDigits(q)) {
      await loadUserDetailById(Number(q));
      return;
    }
    // Search via Admin Users list to resolve id, then fetch dynamic detail for permissions
    setUserLoading(true);
    try {
      const res = await API.get("admin/users/", { params: { search: q, page_size: 1 } });
      const item = Array.isArray(res?.data?.results) ? res.data.results[0] : null;
      if (!item || !item.id) {
        setUserErr("User not found.");
        setUserDetail(null);
      } else {
        await loadUserDetailById(item.id);
      }
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to search user";
      setUserErr(msg);
      setUserDetail(null);
    } finally {
      setUserLoading(false);
    }
  }

  function toggleModule(mk) {
    setSelectedModules((prev) => ({ ...prev, [mk]: !prev[mk] }));
  }

  // Save module permissions to user (and ensure is_staff)
  async function handleSaveModules() {
    setSaveErr("");
    setNotice("");
    const obj = userDetail;
    if (!obj || !obj.id) {
      setSaveErr("Load a user first.");
      return;
    }
    const idx = await ensurePermIndex();
    if (!idx) {
      setSaveErr("Permissions index not available.");
      return;
    }
    setSaveLoading(true);
    try {
      // Compute selected adminapi permission ids
      const want = new Set();
      for (const mk of MODULE_KEYS) {
        if (selectedModules[mk]) {
          const cd = MODULE_TO_CODENAME[mk];
          const row = idx[cd];
          if (row?.id) want.add(row.id);
        }
      }
      // Merge with existing non-adminapi permissions
      const have = Array.isArray(obj.user_permissions) ? new Set(obj.user_permissions) : new Set();
      const adminapiIdSet = new Set(Object.values(idx).map((p) => p.id));
      // Remove all adminapi ids from existing
      const kept = new Set([...have].filter((pid) => !adminapiIdSet.has(pid)));
      // Add selected adminapi ids
      for (const pid of want) kept.add(pid);
      const finalIds = Array.from(kept);

      // Ensure staff flag for admin area access
      const payload = {
        is_staff: true,
        user_permissions: finalIds,
      };
      const res = await API.patch(`admin/dynamic/accounts/customuser/${obj.id}/`, payload);
      setUserDetail(res?.data || obj);
      setNotice("Permissions updated. The user will see only the allowed admin modules.");
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to update permissions";
      setSaveErr(msg);
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: "#0f172a", fontWeight: 900, fontSize: 18 }}>Admin Access Manager</h2>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Create admin users, and assign module-based permissions to control which admin screens they can view.
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>
          {error}
        </div>
      ) : null}
      {notice ? (
        <div style={{ marginBottom: 10, padding: "10px 12px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#14532d", borderRadius: 8 }}>
          {notice}
        </div>
      ) : null}

      <Section
        title="Create Admin User"
        subtitle="Creates a staff user, then generates a secure temporary password."
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Username"
            value={createUsername}
            onChange={(e) => setCreateUsername(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, minWidth: 180 }}
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={createEmail}
            onChange={(e) => setCreateEmail(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, minWidth: 220 }}
          />
          <button
            onClick={handleCreateUser}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #93c5fd",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {loading ? "Creating..." : "Create + Temp Password"}
          </button>
        </div>

        {createdUser ? (
          <div style={{ marginTop: 10, color: "#0f172a", fontSize: 14 }}>
            Created User: <b>#{createdUser.id}</b> {createdUser.username} {createdUser.email ? `(${createdUser.email})` : ""}
          </div>
        ) : null}
        {tempPassword ? (
          <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#0a1120", color: "#cbd5e1" }}>
            Temporary Password: <b>{tempPassword}</b>
          </div>
        ) : null}
      </Section>

      <Section
        title="Load Target User"
        subtitle="Enter user id or username to edit module permissions."
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="User ID or Username"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, minWidth: 220 }}
          />
          <button
            onClick={handleLookup}
            disabled={userLoading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #93c5fd",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {userLoading ? "Loading..." : "Load User"}
          </button>
          {userErr ? <div style={{ color: "#dc2626", fontSize: 12 }}>{userErr}</div> : null}
        </div>

        {userDetail ? (
          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <div style={{ color: "#0f172a" }}>
              Target: <b>#{userDetail.id}</b> {userDetail.username} {userDetail.email ? `(${userDetail.email})` : ""}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              is_staff: <b>{String(!!userDetail.is_staff)}</b> &nbsp; | &nbsp; is_superuser: <b>{String(!!userDetail.is_superuser)}</b>
            </div>
          </div>
        ) : null}
      </Section>

      <Section
        title="Assign Admin Module Permissions"
        subtitle="Toggle the admin modules this user can access. Changes are persisted to Django auth permissions (adminapi.access_*)."
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: "#64748b" }}>
          {permIndexLoading
            ? "Loading permissions index..."
            : permIndexErr
            ? permIndexErr
            : "Modules map to Django permissions adminapi.access_<module>."}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {MODULE_KEYS.map((mk) => (
            <label
              key={mk}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                background: selectedModules[mk] ? "rgba(59,130,246,0.08)" : "#fff",
              }}
            >
              <input
                type="checkbox"
                checked={!!selectedModules[mk]}
                onChange={() => toggleModule(mk)}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{mk}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{MODULE_TO_CODENAME[mk]}</div>
              </div>
            </label>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleSaveModules}
            disabled={saveLoading || !userDetail}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #93c5fd",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontWeight: 800,
              cursor: userDetail ? "pointer" : "not-allowed",
            }}
          >
            {saveLoading ? "Saving..." : "Save Permissions"}
          </button>
          {saveErr ? <div style={{ color: "#dc2626", fontSize: 12 }}>{saveErr}</div> : null}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
          Notes:
          <ul style={{ marginTop: 6 }}>
            <li>Users must be staff (is_staff=true) to access the admin area. This screen enforces is_staff on save.</li>
            <li>Superusers implicitly have all modules regardless of explicit permissions.</li>
            <li>Non-adminapi permissions on the user are preserved; only adminapi.access_* perms are replaced.</li>
          </ul>
        </div>
      </Section>
    </div>
  );
}

