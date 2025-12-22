import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";

function TextInput({ label, value, onChange, placeholder, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, color: "#64748b" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function humanDate(x) {
  try {
    return x ? new Date(x).toLocaleString() : "";
  } catch {
    return String(x || "");
  }
}

export default function AdminLuckyDraw() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // Spin Draw state
  const [spins, setSpins] = useState([]);
  const [spinLoading, setSpinLoading] = useState(false);
  const [spinErr, setSpinErr] = useState("");
  const [spinForm, setSpinForm] = useState({ title: "", start_at: "", end_at: "" });
  const [winForm, setWinForm] = useState({
    username: "",
    prize_title: "",
    prize_description: "",
    prize_type: "INFO",
    prize_value: "",
  });

  const [filters, setFilters] = useState({
    search: "",
    pincode: "",
    status: "",
  });

  // Season Lucky Draw Eligibility state
  const [seasons, setSeasons] = useState([]);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [seasonsErr, setSeasonsErr] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [eligLoading, setEligLoading] = useState(false);
  const [eligErr, setEligErr] = useState("");
  const [eligRows, setEligRows] = useState([]);
  const [eligFilters, setEligFilters] = useState({ eligible_only: true, search: "" });

  function setF(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      // Staff users receive all submissions
      const res = await API.get("/uploads/lucky-draw/");
      const items = res?.data?.results || res?.data || [];
      setRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load Lucky Draw submissions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Spin Draw helpers
  async function fetchSpins() {
    setSpinLoading(true);
    setSpinErr("");
    try {
      const res = await API.get("/uploads/spin/draws/");
      const items = res?.data?.results || res?.data || [];
      setSpins(Array.isArray(items) ? items : []);
    } catch (e) {
      setSpinErr(e?.response?.data?.detail || "Failed to load Spin Draws");
      setSpins([]);
    } finally {
      setSpinLoading(false);
    }
  }

  async function createSpin() {
    if (!spinForm.title || !spinForm.start_at || !spinForm.end_at) {
      alert("Enter Title, Start and End date-time.");
      return;
    }
    try {
      setSpinLoading(true);
      setSpinErr("");
      const toIso = (v) => {
        try {
          const d = new Date(v);
          if (isNaN(d.getTime())) return v;
          return d.toISOString();
        } catch {
          return v;
        }
      };
      await API.post("/uploads/spin/draws/", {
        title: String(spinForm.title).trim(),
        start_at: toIso(spinForm.start_at),
        end_at: toIso(spinForm.end_at),
      });
      setSpinForm({ title: "", start_at: "", end_at: "" });
      await fetchSpins();
    } catch (e) {
      setSpinErr(e?.response?.data?.detail || "Failed to create Spin Draw");
    } finally {
      setSpinLoading(false);
    }
  }

  async function lockSpin(id) {
    try {
      setSpinLoading(true);
      setSpinErr("");
      await API.post(`/uploads/spin/draws/${id}/lock/`, {});
      await fetchSpins();
    } catch (e) {
      setSpinErr(e?.response?.data?.detail || "Failed to lock draw");
    } finally {
      setSpinLoading(false);
    }
  }

  async function unlockSpin(id) {
    try {
      setSpinLoading(true);
      setSpinErr("");
      await API.post(`/uploads/spin/draws/${id}/unlock/`, {});
      await fetchSpins();
    } catch (e) {
      setSpinErr(e?.response?.data?.detail || "Failed to unlock draw");
    } finally {
      setSpinLoading(false);
    }
  }

  async function addWinner(drawId) {
    const uname = String(winForm.username || "").trim();
    if (!uname) {
      alert("Enter a username to add as winner.");
      return;
    }
    try {
      setSpinLoading(true);
      setSpinErr("");
      // Resolve username -> user id
      const res = await API.get("/coupons/codes/resolve-user", { params: { username: uname } });
      const data = res?.data || {};
      const userId = data?.id || data?.user?.id;
      if (!userId) {
        throw new Error("User not found.");
      }
      const payload = {
        user: userId,
        prize_title: String(winForm.prize_title || ""),
        prize_description: String(winForm.prize_description || ""),
        prize_type: String(winForm.prize_type || "INFO"),
      };
      const pv = String(winForm.prize_value || "").trim();
      if (pv) {
        const num = Number(pv);
        if (!Number.isNaN(num)) payload.prize_value = num;
      }
      await API.post(`/uploads/spin/draws/${drawId}/winners/`, payload);
      // Keep prize fields; clear only username for quick batch adds
      setWinForm((w) => ({ ...w, username: "" }));
      await fetchSpins();
    } catch (e) {
      setSpinErr(e?.response?.data?.detail || e?.message || "Failed to add winner");
    } finally {
      setSpinLoading(false);
    }
  }

  async function removeWinner(winnerId) {
    try {
      setSpinLoading(true);
      setSpinErr("");
      await API.delete(`/uploads/spin/winners/${winnerId}/`);
      await fetchSpins();
    } catch (e) {
      setSpinErr(e?.response?.data?.detail || "Failed to remove winner");
    } finally {
      setSpinLoading(false);
    }
  }

  // Seasons (Coupon masters) – code/title/campaign starting with "season"
  async function fetchSeasons(q = "") {
    try {
      setSeasonsLoading(true);
      setSeasonsErr("");
      const res = await API.get("/coupons/lucky-draw/seasons/", { params: { q } });
      const items = res?.data?.results || res?.data || [];
      setSeasons(Array.isArray(items) ? items : []);
      if (!seasonId && items && items.length) {
        setSeasonId(String(items[0].id));
      }
    } catch (e) {
      setSeasons([]);
      setSeasonsErr(e?.response?.data?.detail || "Failed to load Seasons");
    } finally {
      setSeasonsLoading(false);
    }
  }

  async function fetchEligibility() {
    if (!seasonId) {
      setEligRows([]);
      return;
    }
    try {
      setEligLoading(true);
      setEligErr("");
      const params = {
        coupon: seasonId,
        eligible_only: eligFilters.eligible_only ? 1 : 0,
      };
      const s = String(eligFilters.search || "").trim();
      if (s) params.search = s;
      const res = await API.get("/coupons/lucky-draw/participants/", { params });
      const items = res?.data?.results || res?.data || [];
      setEligRows(Array.isArray(items) ? items : []);
    } catch (e) {
      setEligRows([]);
      setEligErr(e?.response?.data?.detail || "Failed to load participants");
    } finally {
      setEligLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    fetchSpins();
    fetchSeasons();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    fetchEligibility();
    // eslint-disable-next-line
  }, [seasonId, eligFilters]);

  const statusOptions = [
    { value: "", label: "Any" },
    { value: "SUBMITTED", label: "SUBMITTED" },
    { value: "TRE_APPROVED", label: "TRE_APPROVED" },
    { value: "TRE_REJECTED", label: "TRE_REJECTED" },
    { value: "AGENCY_APPROVED", label: "AGENCY_APPROVED" },
    { value: "AGENCY_REJECTED", label: "AGENCY_REJECTED" },
    { value: "ADMIN_APPROVED", label: "ADMIN_APPROVED" },
    { value: "ADMIN_REJECTED", label: "ADMIN_REJECTED" },
  ];

  async function adminAction(id, action) {
    setLoading(true);
    setErr("");
    try {
      await API.post(`/uploads/lucky-draw/${id}/${action}/`, {});
      await fetchRows();
    } catch (e) {
      setErr(e?.response?.data?.detail || `Failed to ${action.replace("-", " ")}`);
    } finally {
      setLoading(false);
    }
  }

  const shown = useMemo(() => {
    const s = (filters.search || "").trim().toLowerCase();
    const pin = (filters.pincode || "").trim().toLowerCase();
    const st = (filters.status || "").trim().toUpperCase();
    return (rows || []).filter((r) => {
      const okSearch =
        !s ||
        String(r.id || "").includes(s) ||
        String(r.username || "").toLowerCase().includes(s) ||
        String(r.phone || "").toLowerCase().includes(s) ||
        String(r.sl_number || "").toLowerCase().includes(s) ||
        String(r.ledger_number || "").toLowerCase().includes(s) ||
        String(r.agency_name || "").toLowerCase().includes(s) ||
        String(r.coupon_purchaser_name || "").toLowerCase().includes(s);
      const okPin = !pin || String(r.pincode || "").toLowerCase().includes(pin);
      const okStatus = !st || String(r.status || "").toUpperCase() === st;
      return okSearch && okPin && okStatus;
    });
  }, [rows, filters]);

  return (
    <div>
      {/* Spin-based Lucky Draws (Admin-configured) */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Spin-based Lucky Draws</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Configure a spin window (start/end). Mark 1–10 usernames as winners, then Lock. Users can spin during the live window; only marked users will win.
        </div>
      </div>

      {/* Create Spin Draw */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
          marginBottom: 12,
        }}
      >
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          <TextInput
            label="Title"
            value={spinForm.title}
            onChange={(v) => setSpinForm((f) => ({ ...f, title: v }))}
            placeholder="e.g., Diwali Spin"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>Start At</label>
            <input
              type="datetime-local"
              value={spinForm.start_at}
              onChange={(e) => setSpinForm((f) => ({ ...f, start_at: e.target.value }))}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", outline: "none", background: "#fff" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>End At</label>
            <input
              type="datetime-local"
              value={spinForm.end_at}
              onChange={(e) => setSpinForm((f) => ({ ...f, end_at: e.target.value }))}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", outline: "none", background: "#fff" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={createSpin}
              disabled={spinLoading}
              style={{
                padding: "10px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: spinLoading ? "not-allowed" : "pointer",
                width: "100%",
              }}
            >
              {spinLoading ? "Creating..." : "Create Draw"}
            </button>
          </div>
        </div>
        {spinErr ? <div style={{ color: "#dc2626", padding: 12, borderTop: "1px solid #e2e8f0" }}>{spinErr}</div> : null}
      </div>

      {/* Spin Draws Listing */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
          marginBottom: 24,
        }}
      >
        <div style={{ padding: 10, background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 700, color: "#0f172a" }}>
          Draws
        </div>
        <div style={{ padding: 10 }}>
          {(spins || []).length === 0 ? (
            <div style={{ color: "#64748b" }}>{spinLoading ? "Loading..." : "No draws created yet."}</div>
          ) : (
            spins.map((d) => (
              <div key={d.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{d.title || `#${d.id}`}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Window: {humanDate(d.start_at)} — {humanDate(d.end_at)}
                  </div>
                  <div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        color: d.status === "LIVE" ? "#065f46" : "#0f172a",
                        background: d.status === "LIVE" ? "#d1fae5" : "#f1f5f9",
                        border: d.status === "LIVE" ? "1px solid #10b98130" : "1px solid #e2e8f0",
                      }}
                    >
                      {d.status || "DRAFT"} {d.locked ? " • LOCKED" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                    {!d.locked ? (
                      <button
                        onClick={() => lockSpin(d.id)}
                        disabled={spinLoading}
                        style={{ padding: "6px 10px", background: "#0f172a", color: "#fff", border: 0, borderRadius: 6, cursor: spinLoading ? "not-allowed" : "pointer" }}
                      >
                        Lock
                      </button>
                    ) : (
                      <button
                        onClick={() => unlockSpin(d.id)}
                        disabled={spinLoading}
                        style={{ padding: "6px 10px", background: "#6b7280", color: "#fff", border: 0, borderRadius: 6, cursor: spinLoading ? "not-allowed" : "pointer" }}
                      >
                        Unlock
                      </button>
                    )}
                  </div>
                </div>

                {/* Winners */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: "#0f172a" }}>
                    Winners ({(d.winners || []).length}/10)
                  </div>
                  {(d.winners || []).length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>No winners added.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                      {d.winners.map((w) => (
                        <div key={w.id} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: 8 }}>
                          <div style={{ fontWeight: 600 }}>{w.username || `User #${w.user}`}</div>
                          <div style={{ fontSize: 12, color: "#475569" }}>{w.prize_title || "—"}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{w.prize_type}{w.prize_value ? ` • ₹${w.prize_value}` : ""}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button
                              onClick={() => removeWinner(w.id)}
                              disabled={spinLoading || d.locked}
                              style={{ padding: "6px 10px", background: "#b91c1c", color: "#fff", border: 0, borderRadius: 6, cursor: (spinLoading || d.locked) ? "not-allowed" : "pointer" }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Winner */}
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, alignItems: "end" }}>
                  <TextInput
                    label="Winner Username"
                    value={winForm.username}
                    onChange={(v) => setWinForm((f) => ({ ...f, username: v }))}
                    placeholder="username / phone"
                  />
                  <TextInput
                    label="Prize Title"
                    value={winForm.prize_title}
                    onChange={(v) => setWinForm((f) => ({ ...f, prize_title: v }))}
                    placeholder="e.g., ₹100 Wallet Credit"
                  />
                  <TextInput
                    label="Prize Description"
                    value={winForm.prize_description}
                    onChange={(v) => setWinForm((f) => ({ ...f, prize_description: v }))}
                    placeholder="Optional"
                  />
                  <Select
                    label="Prize Type"
                    value={winForm.prize_type}
                    onChange={(v) => setWinForm((f) => ({ ...f, prize_type: v }))}
                    options={[
                      { value: "INFO", label: "INFO" },
                      { value: "WALLET", label: "WALLET" },
                      { value: "COUPON", label: "COUPON" },
                    ]}
                  />
                  <TextInput
                    label="Prize Value"
                    value={winForm.prize_value}
                    onChange={(v) => setWinForm((f) => ({ ...f, prize_value: v }))}
                    placeholder="e.g., 100"
                  />
                  <div>
                    <button
                      onClick={() => addWinner(d.id)}
                      disabled={spinLoading || d.locked || (d.winners || []).length >= 10}
                      style={{
                        padding: "10px 12px",
                        background: "#065f46",
                        color: "#fff",
                        border: 0,
                        borderRadius: 8,
                        cursor: (spinLoading || d.locked || (d.winners || []).length >= 10) ? "not-allowed" : "pointer",
                        width: "100%",
                      }}
                    >
                      Add Winner
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Season Eligibility (Spin & Win) */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Season Eligibility (Spin & Win)</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          List of users eligible to participate in the Lucky Draw for a Season (Coupon master). Users are eligible when they have first-time purchases of both ₹150 and ₹759 within a Season.
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          background: "#fff",
          marginBottom: 24,
        }}
      >
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          <Select
            label="Season (Coupon Master)"
            value={seasonId}
            onChange={(v) => setSeasonId(v)}
            options={(seasons || []).map((s) => ({
              value: String(s.id),
              label: s.title || s.code || `#${s.id}`,
            }))}
          />
          <TextInput
            label="Search User"
            value={eligFilters.search}
            onChange={(v) => setEligFilters((f) => ({ ...f, search: v }))}
            placeholder="username / phone"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>Eligible Only</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <input
                type="checkbox"
                checked={!!eligFilters.eligible_only}
                onChange={(e) => setEligFilters((f) => ({ ...f, eligible_only: !!e.target.checked }))}
              />
              <span style={{ fontSize: 13, color: "#334155" }}>Show only users who have both ₹150 and ₹759</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              onClick={fetchEligibility}
              disabled={eligLoading}
              style={{
                padding: "10px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: eligLoading ? "not-allowed" : "pointer",
                width: "100%",
              }}
            >
              {eligLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
        {(seasonsErr || eligErr) ? (
          <div style={{ color: "#dc2626", padding: 12, borderTop: "1px solid #e2e8f0" }}>
            {seasonsErr || eligErr}
          </div>
        ) : null}

        <div style={{ padding: 10 }}>
          <div
            style={{
              minWidth: 900,
              display: "grid",
              gridTemplateColumns: "180px 120px 120px 80px 80px 90px 180px 180px",
              gap: 8,
              padding: "10px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            <div>User</div>
            <div>Phone</div>
            <div>Pincode</div>
            <div>₹150</div>
            <div>₹759</div>
            <div>Eligible</div>
            <div>First ₹150 At</div>
            <div>First ₹759 At</div>
          </div>
          <div>
            {eligLoading ? (
              <div style={{ padding: 12, color: "#64748b" }}>Loading...</div>
            ) : (eligRows || []).length === 0 ? (
              <div style={{ padding: 12, color: "#64748b" }}>No participants found.</div>
            ) : (
              eligRows.map((u, idx) => (
                <div
                  key={`${u.user_id}-${idx}`}
                  style={{
                    minWidth: 900,
                    display: "grid",
                    gridTemplateColumns: "180px 120px 120px 80px 80px 90px 180px 180px",
                    gap: 8,
                    padding: "10px",
                    borderBottom: "1px solid #e2e8f0",
                    alignItems: "center",
                  }}
                >
                  <div title={u.username || ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {u.username || `User #${u.user_id}`}
                  </div>
                  <div>{u.phone || "—"}</div>
                  <div>{u.pincode || "—"}</div>
                  <div>{u.has_150 ? "Yes" : "No"}</div>
                  <div>{u.has_759 ? "Yes" : "No"}</div>
                  <div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        color: u.eligible ? "#065f46" : "#0f172a",
                        background: u.eligible ? "#d1fae5" : "#f1f5f9",
                        border: u.eligible ? "1px solid #10b98130" : "1px solid #e2e8f0",
                      }}
                    >
                      {u.eligible ? "YES" : "NO"}
                    </span>
                  </div>
                  <div>{humanDate(u.created_at_150)}</div>
                  <div>{humanDate(u.created_at_759)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>Manual Coupon Submissions</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Staff overview of all submissions (read-only). Approvals are performed by TRE/Agency roles in their respective apps.
        </div>
      </div>

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
          placeholder="id / username / phone / SL / Ledger / Agency / Purchaser"
        />
        <TextInput
          label="Pincode"
          value={filters.pincode}
          onChange={(v) => setF("pincode", v)}
          placeholder="e.g., 560001"
        />
        <Select
          label="Status"
          value={filters.status}
          onChange={(v) => setF("status", v)}
          options={statusOptions}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={fetchRows}
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
          onClick={() => setFilters({ search: "", pincode: "", status: "" })}
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
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              minWidth: 1100,
              display: "grid",
              gridTemplateColumns:
                "80px 140px 120px 120px 130px 120px 120px 160px 140px 200px",
              gap: 8,
              padding: "10px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            <div>ID</div>
            <div>User</div>
            <div>Phone</div>
            <div>Pincode</div>
            <div>Status</div>
            <div>SL No.</div>
            <div>Ledger No.</div>
            <div>Agency</div>
            <div>Created</div>
            <div>Actions</div>
          </div>
          <div>
            {shown.map((r) => (
              <div
                key={r.id}
                style={{
                  minWidth: 1100,
                  display: "grid",
                  gridTemplateColumns:
                    "80px 140px 120px 120px 130px 120px 120px 160px 140px 200px",
                  gap: 8,
                  padding: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  alignItems: "center",
                }}
              >
                <div>#{r.id}</div>
                <div title={r.username || ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.username || "—"}
                </div>
                <div>{r.phone || "—"}</div>
                <div>{r.pincode || "—"}</div>
                <div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      color:
                        r.status === "AGENCY_APPROVED" || r.status === "TRE_APPROVED"
                          ? "#065f46"
                          : r.status && r.status.includes("REJECTED")
                          ? "#991b1b"
                          : "#0f172a",
                      background:
                        r.status === "AGENCY_APPROVED" || r.status === "TRE_APPROVED"
                          ? "#d1fae5"
                          : r.status && r.status.includes("REJECTED")
                          ? "#fee2e2"
                          : "#f1f5f9",
                      border:
                        r.status === "AGENCY_APPROVED" || r.status === "TRE_APPROVED"
                          ? "1px solid #10b98130"
                          : r.status && r.status.includes("REJECTED")
                          ? "1px solid #ef444430"
                          : "1px solid #e2e8f0",
                    }}
                  >
                    {r.status || "—"}
                  </span>
                </div>
                <div>{r.sl_number || "—"}</div>
                <div>{r.ledger_number || "—"}</div>
                <div title={r.agency_name || ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.agency_name || "—"}
                </div>
                <div>{humanDate(r.created_at)}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => adminAction(r.id, "admin-approve")}
                    disabled={loading || r.status === "ADMIN_APPROVED"}
                    style={{
                      padding: "6px 10px",
                      background: "#065f46",
                      color: "#fff",
                      border: 0,
                      borderRadius: 6,
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    Admin Approve
                  </button>
                  <button
                    onClick={() => adminAction(r.id, "admin-reject")}
                    disabled={loading || r.status === "ADMIN_REJECTED"}
                    style={{
                      padding: "6px 10px",
                      background: "#b91c1c",
                      color: "#fff",
                      border: 0,
                      borderRadius: 6,
                      cursor: loading ? "not-allowed" : "pointer",
                    }}
                  >
                    Admin Reject
                  </button>
                </div>
              </div>
            ))}
            {!loading && shown.length === 0 ? (
              <div style={{ padding: 12, color: "#64748b" }}>No results</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
