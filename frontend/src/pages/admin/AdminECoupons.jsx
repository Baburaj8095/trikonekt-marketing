import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";
import normalizeMediaUrl from "../../utils/media";

/* Reusable inputs */
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

function Section({ title, children, extraRight, id, visible = true }) {
  if (!visible) return null;
  return (
    <div
      id={id}
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

function MetricCard({ label, value }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

export default function AdminECoupons() {
  // Master lists (bootstrap)
  const [coupons, setCoupons] = useState([]);
  const [batches, setBatches] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Tabs
  const [activeTab, setActiveTab] = useState("create"); // create | orders | inventory | history | settings

  // Generic errors
  const [err, setErr] = useState("");
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  // =========================
  // CREATE (Season-first UX)
  // =========================
  const [season, setSeason] = useState({ number: "1", from: "", to: "" });
  const [seasonCouponId, setSeasonCouponId] = useState("");
  const [seasonEnsuring, setSeasonEnsuring] = useState(false);

  // Generate (two denominations)
  const [gen150, setGen150] = useState({ count: "", prefix: "S1-150", loading: false });
  const [gen759, setGen759] = useState({ count: "", prefix: "S1-759", loading: false });

  // Season-batch helpers
  const [batchDenomCache, setBatchDenomCache] = useState({}); // { [batchId]: 150|759|... }
  const [seasonAvail, setSeasonAvail] = useState({ "150": 0, "759": 0 });
  const [batchAvail, setBatchAvail] = useState({}); // { [batchId]: available }

  // Season assignment (by denomination)
  const [seasonAssign, setSeasonAssign] = useState({
    denom: "150",
    batchId: "",
    targetType: "agency",
    targetAgencyId: "",
    targetUsername: "",
    resolvedTargetId: "",
    count: "",
    loading: false,
  });

  // Season KPIs
  const [seasonKpi, setSeasonKpi] = useState({
    denom: "150",
    values: { available: 0, assigned_agency: 0, assigned_employee: 0, sold: 0, redeemed: 0, revoked: 0 },
    loading: false,
  });

  // Agency history (Season)
  const [agencyHist, setAgencyHist] = useState({
    username: "",
    userId: "",
    denom: "all",
    from: "",
    to: "",
    snapshot: { available: 0, assigned_agency: 0, assigned_employee: 0, sold: 0, redeemed: 0, revoked: 0, total: 0, byDenom: { "150": 0, "759": 0 } },
    rows: [],
    loading: false,
    error: "",
  });

  const seasonLabel = (n) => `Season ${String(n || "").trim() || "1"}`;

  function findSeasonCouponIdByNumber(num, couponsList) {
    const label = `Season ${String(num || "1")}`;
    const lowered = label.toLowerCase();
    const found = (couponsList || []).find(
      (c) =>
        String(c?.code || "").toLowerCase() === lowered ||
        String(c?.campaign || "").toLowerCase() === lowered ||
        String(c?.title || "").toLowerCase() === lowered
    );
    return found ? String(found.id) : "";
  }

  useEffect(() => {
    const n = String(season.number || "").trim() || "1";
    setGen150((g) => ({ ...g, prefix: `S${n}-150` }));
    setGen759((g) => ({ ...g, prefix: `S${n}-759` }));
  }, [season.number]);

  // Auto-detect Season coupon so Season batches show up in Assign dropdown
  useEffect(() => {
    const id = findSeasonCouponIdByNumber(season.number, coupons);
    if (id && id !== seasonCouponId) {
      setSeasonCouponId(id);
    }
  }, [coupons, season.number]);

  // Warm denomination cache and availability for the selected Season
  useEffect(() => {
    if (!seasonCouponId) return;
    (async () => {
      await preloadSeasonBatchDenoms(Number(seasonCouponId));
      await refreshSeasonAvailability(Number(seasonCouponId));
    })();
  }, [seasonCouponId, batches]);

  // =========================
  // INVENTORY/ASSIGN/HISTORY (existing constructs retained)
  // =========================
  const [assignForm, setAssignForm] = useState({
    batch_id: "",
    assignee_type: "agency",
    agency_id: "",
    employee_id: "",
    count: "",
  });
  const [assignLoading, setAssignLoading] = useState(false);

  const [selectedBatch, setSelectedBatch] = useState("");
  const [metrics, setMetrics] = useState({
    available: 0,
    assigned_agency: 0,
    assigned_employee: 0,
    sold: 0,
    redeemed: 0,
    revoked: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Assignment history (list)
  const [assignments, setAssignments] = useState([]);
  const [assignTotal, setAssignTotal] = useState(0);
  const [assignPage, setAssignPage] = useState(1);
  const [assignPageSize, setAssignPageSize] = useState(25);
  const [assignListLoading, setAssignListLoading] = useState(false);
  const [assignFilters, setAssignFilters] = useState({
    role: "",
    assignee_id: "",
    search: "",
    from: "",
    to: "",
  });

  // Admin Agency Assignment Summary (existing)
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summaryFrom, setSummaryFrom] = useState("");
  const [summaryTo, setSummaryTo] = useState("");

  // Store: Payment Configs
  const [pcItems, setPcItems] = useState([]);
  const [pcLoading, setPcLoading] = useState(false);
  const [pcForm, setPcForm] = useState({
    title: "",
    upi_id: "",
    payee_name: "",
    instructions: "",
    file: null,
  });
  const [pcSubmitting, setPcSubmitting] = useState(false);

  // Store: Products
  const [spItems, setSpItems] = useState([]);
  const [spLoading, setSpLoading] = useState(false);
  const [spSubmitting, setSpSubmitting] = useState(false);
  const [spForm, setSpForm] = useState({
    coupon_id: "",
    denomination: "150",
    price_per_unit: "",
    enable_consumer: true,
    enable_agency: true,
    enable_employee: false,
    is_active: true,
    max_per_order: "10",
    display_title: "E‑Coupon",
    display_desc: "",
  });

  // Pending Orders (Admin)
  const [pendingOrders, setPendingOrders] = useState([]);
  const [poLoading, setPoLoading] = useState(false);
  const [orderNotes, setOrderNotes] = useState({});
  const [orderBusy, setOrderBusy] = useState({});
  const [orderAvail, setOrderAvail] = useState({});
  const [orderProdAvail, setOrderProdAvail] = useState({});

  // =========================
  // Bootstrap (reference lists + default dashboard)
  // =========================
  async function loadBootstrap() {
    setBootstrapLoading(true);
    setErr("");
    try {
      const res = await API.get("/coupons/codes/admin-ecoupons-bootstrap/", {
        params: { page: assignPage, page_size: assignPageSize },
      });
      const d = res?.data || {};
      setCoupons(Array.isArray(d.coupons) ? d.coupons : []);
      setBatches(Array.isArray(d.batches) ? d.batches : []);
      setAgencies(Array.isArray(d.agencies) ? d.agencies : []);
      setEmployees(Array.isArray(d.employees) ? d.employees : []);

      const defId = d.default_batch_id ? String(d.default_batch_id) : "";
      setSelectedBatch((prev) => prev || defId);
      if (!assignForm.batch_id && defId) {
        setAssignForm((f) => ({ ...f, batch_id: defId }));
      }

      if (d.metrics) setMetrics(d.metrics);
      if (d.assignments) {
        const rows = Array.isArray(d.assignments.results) ? d.assignments.results : [];
        setAssignments(rows);
        const total =
          typeof d.assignments.count === "number" ? d.assignments.count : rows.length;
        setAssignTotal(total);
      }
    } catch (e) {
      setErr("Failed to load bootstrap data");
    } finally {
      setBootstrapLoading(false);
    }
  }
  useEffect(() => {
    loadBootstrap();
  }, []); // eslint-disable-line

  // =========================
  // Helpers (generic)
  // =========================
  async function fetchCount(url, params = {}) {
    try {
      const res = await API.get(url, { params: { page_size: 1, ...params } });
      const c =
        typeof res?.data?.count === "number"
          ? res.data.count
          : Array.isArray(res?.data)
          ? res.data.length
          : 0;
      return c || 0;
    } catch {
      return 0;
    }
  }

  // Dashboard reloads (existing)
  async function loadDashboard(includeSummary = false) {
    setMetricsLoading(true);
    setAssignListLoading(true);
    if (includeSummary) setSummaryLoading(true);
    try {
      const payload = {
        batch: selectedBatch ? parseInt(selectedBatch, 10) : null,
        assign: {
          role: assignFilters.role || "",
          assignee_id: assignFilters.assignee_id ? parseInt(assignFilters.assignee_id, 10) : null,
          page: assignPage,
          page_size: assignPageSize,
        },
        include_summary: !!includeSummary,
        summary: { date_from: summaryFrom || "", date_to: summaryTo || "" },
      };
      const res = await API.post("/coupons/codes/admin-ecoupons-dashboard/", payload);
      const d = res?.data || {};

      if (d.metrics) setMetrics(d.metrics);

      if (d.assignments) {
        const rows = Array.isArray(d.assignments.results) ? d.assignments.results : [];
        const q = String(assignFilters.search || "").toLowerCase();
        const filtered = q
          ? rows.filter((x) =>
              String(x.assignee_name || "").toLowerCase().includes(q) ||
              String(x.batch_display || "").toLowerCase().includes(q) ||
              String(x.assigned_by || "").toLowerCase().includes(q)
            )
          : rows;
        setAssignments(filtered);
        const total =
          typeof d.assignments.count === "number" ? d.assignments.count : filtered.length;
        setAssignTotal(total);
      }

      if (includeSummary) {
        const items = d?.summary?.results || [];
        setSummary(Array.isArray(items) ? items : []);
        setSummaryError("");
      }
    } catch (e) {
      setErr("Failed to load dashboard");
      if (includeSummary) setSummaryError("Failed to load agency summary");
    } finally {
      setMetricsLoading(false);
      setAssignListLoading(false);
      if (includeSummary) setSummaryLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedBatch) return;
    loadDashboard(false);
  }, [selectedBatch]);

  useEffect(() => {
    if (!selectedBatch) return;
    loadDashboard(false);
  }, [selectedBatch, assignPage, assignPageSize, assignFilters]);

  // Options from reference lists
  const couponOptions = useMemo(
    () => coupons.map((c) => ({ value: String(c.id), label: `${c.title} (id:${c.id})` })),
    [coupons]
  );

  const batchOptionsAll = useMemo(
    () =>
      batches.map((b) => {
        const count =
          b.total ||
          b.count ||
          (typeof b.serial_start === "number" && typeof b.serial_end === "number"
            ? b.serial_end - b.serial_start + 1
            : null);
        return {
          value: String(b.id),
          label: `#${b.id} ${b.prefix}${count ? ` (${count} codes)` : ""}`,
          coupon_id: b.coupon,
        };
      }),
    [batches]
  );

  const agencyOptions = useMemo(
    () =>
      agencies.map((u) => {
        const isSub = String(u?.category || "").toLowerCase().startsWith("agency") && String(u?.category || "").toLowerCase().includes("sub");
        return { value: String(u.id), label: `${u.username} #${u.id}${isSub ? " [sub‑franchise]" : ""}` };
      }),
    [agencies]
  );
  const employeeOptions = useMemo(
    () => employees.map((u) => ({ value: String(u.id), label: `${u.username} #${u.id}` })),
    [employees]
  );
  // Preloaded agencies dropdown with name and pincode
  const agencyOptionsFull = useMemo(
    () =>
      agencies.map((u) => {
        const isSub =
          String(u?.category || "").toLowerCase().startsWith("agency") &&
          String(u?.category || "").toLowerCase().includes("sub");
        const name = String(u?.full_name || "").trim() || u.username;
        const pin = String(u?.pincode || "").trim();
        const pinPart = pin ? ` • PIN ${pin}` : "";
        return {
          value: String(u.id),
          label: `${name} (${u.username})${pinPart}${isSub ? " [sub‑franchise]" : ""}`,
        };
      }),
    [agencies]
  );

  // ==========================================
  // CREATE tab: ensure Season + create batches
  // ==========================================
  const selectedSeasonCoupon = useMemo(() => {
    const id = Number(seasonCouponId || 0);
    return id ? coupons.find((c) => Number(c.id) === id) : null;
  }, [seasonCouponId, coupons]);

  const seasonBatches = useMemo(() => {
    const id = Number(seasonCouponId || 0);
    return id ? batches.filter((b) => Number(b.coupon) === id) : [];
  }, [seasonCouponId, batches]);

  const seasonBatchOptions = useMemo(() => {
    return seasonBatches.map((b) => {
      const count =
        b.total ||
        b.count ||
        (typeof b.serial_start === "number" && typeof b.serial_end === "number"
          ? b.serial_end - b.serial_start + 1
          : null);
      return {
        value: String(b.id),
        label: `#${b.id} ${b.prefix}${count ? ` (${count} codes)` : ""}`,
      };
    });
  }, [seasonBatches]);

  const seasonBatchOptionsByDenom = useMemo(() => {
    // use cache to filter; may include unknown yet (those will appear once cache warms)
    return (denom) =>
      seasonBatches
        .filter((b) => {
          const d = batchDenomCache[String(b.id)];
          return d ? String(d) === String(denom) : true; // show until known
        })
        .map((b) => {
          const count =
            b.total ||
            b.count ||
            (typeof b.serial_start === "number" && typeof b.serial_end === "number"
              ? b.serial_end - b.serial_start + 1
              : null);
          const d = batchDenomCache[String(b.id)];
          return {
            value: String(b.id),
            label: `#${b.id} ${b.prefix}${d ? ` • ₹${d}` : ""}${count ? ` (${count} codes)` : ""}`,
          };
        });
  }, [seasonBatches, batchDenomCache]);

  function toIsoLocal(val) {
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  }

  async function ensureSeasonCoupon() {
    const n = String(season.number || "").trim() || "1";
    const label = seasonLabel(n);
    setSeasonEnsuring(true);
    setErr("");
    try {
      // Try to find existing
      const found =
        coupons.find(
          (c) =>
            String(c.code || "").toLowerCase() === label.toLowerCase() ||
            String(c.campaign || "").toLowerCase() === label.toLowerCase() ||
            String(c.title || "").toLowerCase() === label.toLowerCase()
        ) || null;
      if (found) {
        setSeasonCouponId(String(found.id));
        await preloadSeasonBatchDenoms(found.id);
        await refreshSeasonAvailability(found.id);
        return;
      }
      // Create new
      const payload = {
        code: label,
        title: label,
        description: "",
        campaign: label,
        valid_from: season.from ? toIsoLocal(season.from) : null,
        valid_to: season.to ? toIsoLocal(season.to) : null,
      };
      const res = await API.post("/coupons/coupons/", payload);
      const id = res?.data?.id;
      await loadBootstrap();
      if (id) setSeasonCouponId(String(id));
      await preloadSeasonBatchDenoms(id);
      await refreshSeasonAvailability(id);
      alert(`Season ensured: ${label}`);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to ensure Season coupon";
      setErr(msg);
      alert(msg);
    } finally {
      setSeasonEnsuring(false);
    }
  }

  async function createSeasonBatch(denom, count, prefix) {
    if (!seasonCouponId) {
      alert("Ensure Season first");
      return;
    }
    const value = Number(denom);
    const cnt = Number(count || 0);
    if (!cnt || cnt <= 0) {
      alert("Enter a valid count (>0)");
      return;
    }
    const payload = {
      coupon: Number(seasonCouponId),
      prefix: String(prefix || "").trim() || `S${season.number}-${value}`,
      count: cnt,
      value,
    };
    try {
      if (value === 150) setGen150((g) => ({ ...g, loading: true }));
      if (value === 759) setGen759((g) => ({ ...g, loading: true }));
      await API.post("/coupons/batches/create-ecoupons/", payload);
      await loadBootstrap();
      await preloadSeasonBatchDenoms(Number(seasonCouponId));
      await refreshSeasonAvailability(Number(seasonCouponId));
      alert(`Created ${cnt} codes (₹${value}) for ${seasonLabel(season.number)}`);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create batch";
      alert(msg);
    } finally {
      if (value === 150) setGen150((g) => ({ ...g, loading: false }));
      if (value === 759) setGen759((g) => ({ ...g, loading: false }));
    }
  }

  async function createBothBatches() {
    if (!seasonCouponId) {
      alert("Ensure Season first");
      return;
    }
    await createSeasonBatch(150, gen150.count, gen150.prefix);
    await createSeasonBatch(759, gen759.count, gen759.prefix);
  }

  async function getBatchDenomination(batchId) {
    const key = String(batchId);
    if (batchDenomCache[key]) return batchDenomCache[key];
    try {
      const res = await API.get("/coupons/codes/", { params: { batch: batchId, page_size: 1 } });
      const item =
        (Array.isArray(res?.data?.results) ? res.data.results[0] : null) ||
        (Array.isArray(res?.data) ? res.data[0] : null) ||
        null;
      const val = item && item.value ? Number(item.value) : null;
      if (val) {
        setBatchDenomCache((m) => ({ ...m, [key]: val }));
        return val;
      }
    } catch (_) {}
    return null;
  }

  async function preloadSeasonBatchDenoms(couponId) {
    const list = batches.filter((b) => Number(b.coupon) === Number(couponId));
    await Promise.all(
      list.map(async (b) => {
        if (!batchDenomCache[String(b.id)]) {
          await getBatchDenomination(b.id);
        }
      })
    );
  }

  async function refreshSeasonAvailability(couponId) {
    try {
      const [a150, a759] = await Promise.all([
        fetchCount("/coupons/codes/", { issued_channel: "e_coupon", coupon: Number(couponId), value: 150, status: "AVAILABLE" }),
        fetchCount("/coupons/codes/", { issued_channel: "e_coupon", coupon: Number(couponId), value: 759, status: "AVAILABLE" }),
      ]);
      setSeasonAvail({ "150": a150, "759": a759 });
    } catch {
      setSeasonAvail({ "150": 0, "759": 0 });
    }
  }

  async function refreshBatchAvailability(batchId) {
    if (!batchId) return;
    try {
      const c = await fetchCount("/coupons/codes/", { batch: Number(batchId), status: "AVAILABLE" });
      setBatchAvail((m) => ({ ...m, [String(batchId)]: c }));
    } catch {
      setBatchAvail((m) => ({ ...m, [String(batchId)]: 0 }));
    }
  }

  async function resolveUsername(username) {
    const u = String(username || "").trim();
    if (!u) return null;
    try {
      const res = await API.get("/coupons/codes/resolve-user/", { params: { username: u } });
      return res?.data || null;
    } catch {
      return null;
    }
  }

  async function assignSeasonByCount() {
    if (!seasonCouponId) {
      alert("Ensure Season first");
      return;
    }
    setSeasonAssign((s) => ({ ...s, loading: true }));
    try {
      const { denom, batchId, targetType, targetUsername, targetAgencyId, count } = seasonAssign;
      if (!batchId) {
        alert("Pick a batch");
        setSeasonAssign((s) => ({ ...s, loading: false }));
        return;
      }
      const cnt = Number(count || 0);
      if (!cnt || cnt <= 0) {
        alert("Enter a valid Count (>0)");
        setSeasonAssign((s) => ({ ...s, loading: false }));
        return;
      }
      let targetId = seasonAssign.resolvedTargetId;
      if (targetType === "agency") {
        targetId = targetAgencyId || targetId;
        if (!targetId) {
          alert("Select agency");
          setSeasonAssign((s) => ({ ...s, loading: false }));
          return;
        }
      } else {
        if (!targetId) {
          const info = await resolveUsername(targetUsername);
          if (!info || !info.id) {
            alert("Invalid username");
            setSeasonAssign((s) => ({ ...s, loading: false }));
            return;
          }
          targetId = info.id;
        }
      }
      const idNum = Number(targetId);
      const bid = Number(batchId);
      let url = "", payload = {};
      if (targetType === "agency") {
        url = `/coupons/batches/${bid}/assign-agency-count/`;
        payload = { agency_id: idNum, count: cnt };
      } else {
        url = `/coupons/batches/${bid}/admin-assign-employee-count/`;
        payload = { employee_id: idNum, count: cnt };
      }
      await API.post(url, payload);
      await loadBootstrap();
      await refreshSeasonAvailability(seasonCouponId);
      await refreshBatchAvailability(bid);
      alert("Assigned successfully");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to assign";
      alert(msg);
    } finally {
      setSeasonAssign((s) => ({ ...s, loading: false }));
    }
  }

  async function loadSeasonKpis() {
    if (!seasonCouponId) return;
    setSeasonKpi((k) => ({ ...k, loading: true }));
    try {
      const d = seasonKpi.denom;
      const filters = { coupon: Number(seasonCouponId), issued_channel: "e_coupon" };
      if (d !== "all") filters.value = Number(d);
      const [available, assigned_agency, assigned_employee, sold, redeemed, revoked] = await Promise.all([
        fetchCount("/coupons/codes/", { ...filters, status: "AVAILABLE" }),
        fetchCount("/coupons/codes/", { ...filters, status: "ASSIGNED_AGENCY" }),
        fetchCount("/coupons/codes/", { ...filters, status: "ASSIGNED_EMPLOYEE" }),
        fetchCount("/coupons/codes/", { ...filters, status: "SOLD" }),
        fetchCount("/coupons/codes/", { ...filters, status: "REDEEMED" }),
        fetchCount("/coupons/codes/", { ...filters, status: "REVOKED" }),
      ]);
      setSeasonKpi((k) => ({
        ...k,
        values: { available, assigned_agency, assigned_employee, sold, redeemed, revoked },
      }));
    } catch {
      setSeasonKpi((k) => ({
        ...k,
        values: { available: 0, assigned_agency: 0, assigned_employee: 0, sold: 0, redeemed: 0, revoked: 0 },
      }));
    } finally {
      setSeasonKpi((k) => ({ ...k, loading: false }));
    }
  }

  async function searchAgencyHistory() {
    if (!seasonCouponId) {
      alert("Ensure Season first");
      return;
    }
    setAgencyHist((s) => ({ ...s, loading: true, error: "" }));
    try {
      const id = sTrim(agencyHist.username) ? await (async () => {
        const u = await resolveUsername(agencyHist.username);
        return u?.id || "";
      })() : agencyHist.userId;

      if (!id) {
        setAgencyHist((s) => ({ ...s, loading: false, error: "Invalid agency username" }));
        return;
      }

      // Season batches and denom cache
      await preloadSeasonBatchDenoms(seasonCouponId);

      // Snapshot totals by agency across season batches (merge admin-agency-assignment-summary per batch)
      const list = [...seasonBatches];
      const acc = { AVAILABLE: 0, ASSIGNED_AGENCY: 0, ASSIGNED_EMPLOYEE: 0, SOLD: 0, REDEEMED: 0, REVOKED: 0 };
      const byDenom = { "150": 0, "759": 0 };
      for (const b of list) {
        const resp = await API.get("/coupons/codes/admin-agency-assignment-summary/", { params: { batch: b.id } });
        const rows = Array.isArray(resp?.data?.results) ? resp.data.results : [];
        const me = rows.find((r) => Number(r.agency_id) === Number(id));
        if (me) {
          Object.keys(acc).forEach((k) => (acc[k] += Number(me.counts?.[k] || 0)));
          // denom + total assigned (include all statuses as "owned + progressed")
          const d = batchDenomCache[String(b.id)];
          if (d && (d === 150 || d === 759)) {
            byDenom[String(d)] += Number(me.total || 0);
          }
        }
      }
      const snap = {
        available: acc.AVAILABLE,
        assigned_agency: acc.ASSIGNED_AGENCY,
        assigned_employee: acc.ASSIGNED_EMPLOYEE,
        sold: acc.SOLD,
        redeemed: acc.REDEEMED,
        revoked: acc.REVOKED,
        total: acc.AVAILABLE + acc.ASSIGNED_AGENCY + acc.ASSIGNED_EMPLOYEE + acc.SOLD + acc.REDEEMED + acc.REVOKED,
        byDenom,
      };

      // Full history rows for this agency within Season:
      // Use admin-ecoupons-dashboard for each batch with assignee_id
      const rowsMerged = [];
      for (const b of list) {
        const payload = {
          batch: Number(b.id),
          assign: { role: "agency", assignee_id: Number(id), page: 1, page_size: 1000 },
        };
        const res = await API.post("/coupons/codes/admin-ecoupons-dashboard/", payload);
        const items = Array.isArray(res?.data?.assignments?.results) ? res.data.assignments.results : [];
        for (const r of items) {
          rowsMerged.push({
            ...r,
            denom: batchDenomCache[String(b.id)] || null,
          });
        }
      }

      // Optional filters
      const denomFilter = agencyHist.denom;
      let rows = rowsMerged;
      if (denomFilter !== "all") {
        rows = rows.filter((r) => String(r.denom || "") === String(denomFilter));
      }

      // Sort desc by date
      rows.sort((a, b) => new Date(b.assigned_at || b.created_at || 0) - new Date(a.assigned_at || a.created_at || 0));

      setAgencyHist((s) => ({ ...s, userId: String(id), snapshot: snap, rows, loading: false }));
    } catch (e) {
      setAgencyHist((s) => ({ ...s, loading: false, error: "Failed to load agency history" }));
    }
  }

  function sTrim(x) {
    return String(x || "").trim();
  }

  // =========================
  // INVENTORY: assign & metrics (existing)
  // =========================
  async function assignECoupons() {
    setAssignLoading(true);
    setErr("");
    try {
      if (!assignForm.batch_id) {
        alert("Select batch");
        setAssignLoading(false);
        return;
      }
      const batchId = parseInt(assignForm.batch_id, 10);
      const isAgency = assignForm.assignee_type === "agency";
      const assigneeId = isAgency
        ? parseInt(assignForm.agency_id || "0", 10)
        : parseInt(assignForm.employee_id || "0", 10);
      if (!assigneeId) {
        alert(isAgency ? "Select agency" : "Select employee");
        setAssignLoading(false);
        return;
      }
      const count = parseInt(assignForm.count || "0", 10);
      if (!count || count <= 0) {
        alert("Enter a valid Count (>0).");
        setAssignLoading(false);
        return;
      }
      let url, payload;
      if (isAgency) {
        url = `/coupons/batches/${batchId}/assign-agency-count/`;
        payload = { agency_id: assigneeId, count };
      } else {
        url = `/coupons/batches/${batchId}/admin-assign-employee-count/`;
        payload = { employee_id: assigneeId, count };
      }
      await API.post(url, payload);
      setSelectedBatch(String(batchId));
      setAssignPage(1);
      await loadBootstrap();
      await loadDashboard(false);
      alert("Assigned successfully");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to assign");
    } finally {
      setAssignLoading(false);
    }
  }

  async function loadAgencySummary() {
    setSummaryLoading(true);
    setSummaryError("");
    try {
      await loadDashboard(true);
    } catch (e) {
      setSummaryError("Failed to load agency summary");
    } finally {
      setSummaryLoading(false);
    }
  }

  // Metrics (existing)
  async function loadMetrics() {
    setMetricsLoading(true);
    try {
      const bid = selectedBatch ? parseInt(selectedBatch, 10) : null;

      const [available, assigned_agency, assigned_employee, sold, redeemed, revoked] =
        await Promise.all([
          bid ? fetchCount("/coupons/codes/", { batch: bid, status: "AVAILABLE" }) : 0,
          bid ? fetchCount("/coupons/codes/", { batch: bid, status: "ASSIGNED_AGENCY" }) : 0,
          bid ? fetchCount("/coupons/codes/", { batch: bid, status: "ASSIGNED_EMPLOYEE" }) : 0,
          bid ? fetchCount("/coupons/codes/", { batch: bid, status: "SOLD" }) : 0,
          bid ? fetchCount("/coupons/codes/", { batch: bid, status: "REDEEMED" }) : 0,
          bid ? fetchCount("/coupons/codes/", { batch: bid, status: "REVOKED" }) : 0,
        ]);

      setMetrics({
        available,
        assigned_agency,
        assigned_employee,
        sold,
        redeemed,
        revoked,
      });
    } catch (_) {
      // ignore
    } finally {
      setMetricsLoading(false);
    }
  }

  // =========================
  // STORE: Payment Configs
  // =========================
  async function loadPaymentConfigs() {
    setPcLoading(true);
    try {
      const res = await API.get("/coupons/store/payment-configs/", { params: { page_size: 100 } });
      const items = res?.data?.results || res?.data || [];
      setPcItems(Array.isArray(items) ? items : []);
    } catch (_) {
      setPcItems([]);
    } finally {
      setPcLoading(false);
    }
  }

  async function createPaymentConfig() {
    setPcSubmitting(true);
    try {
      const fd = new FormData();
      if (pcForm.title) fd.append("title", pcForm.title);
      if (pcForm.upi_id) fd.append("upi_id", pcForm.upi_id);
      if (pcForm.payee_name) fd.append("payee_name", pcForm.payee_name);
      if (pcForm.instructions) fd.append("instructions", pcForm.instructions);
      if (pcForm.file) fd.append("upi_qr_image", pcForm.file);
      await API.post("/coupons/store/payment-configs/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadPaymentConfigs();
      setPcForm({ title: "", upi_id: "", payee_name: "", instructions: "", file: null });
      alert("Payment config created.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create payment config";
      alert(msg);
    } finally {
      setPcSubmitting(false);
    }
  }

  async function setActivePc(id) {
    try {
      await API.post(`/coupons/store/payment-configs/${id}/set-active/`, {});
      await loadPaymentConfigs();
      alert("Active config set.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to set active config";
      alert(msg);
    }
  }

  // =========================
  // STORE: Products
  // =========================
  async function loadStoreProducts() {
    setSpLoading(true);
    try {
      const res = await API.get("/coupons/store/products/", { params: { page_size: 200 } });
      const items = res?.data?.results || res?.data || [];
      setSpItems(Array.isArray(items) ? items : []);
    } catch (_) {
      setSpItems([]);
    } finally {
      setSpLoading(false);
    }
  }

  async function createStoreProduct() {
    setSpSubmitting(true);
    try {
      const payload = {
        coupon: spForm.coupon_id ? parseInt(spForm.coupon_id, 10) : null,
        denomination: spForm.denomination ? Number(spForm.denomination) : null,
        price_per_unit: spForm.price_per_unit ? Number(spForm.price_per_unit) : Number(spForm.denomination || 0),
        enable_consumer: !!spForm.enable_consumer,
        enable_agency: !!spForm.enable_agency,
        enable_employee: !!spForm.enable_employee,
        is_active: !!spForm.is_active,
        max_per_order: spForm.max_per_order ? Number(spForm.max_per_order) : null,
        display_title: spForm.display_title || "",
        display_desc: spForm.display_desc || "",
      };
      if (!payload.coupon) {
        alert("Select Coupon");
        setSpSubmitting(false);
        return;
      }
      if (!payload.denomination || payload.denomination <= 0) {
        alert("Enter valid denomination (>0)");
        setSpSubmitting(false);
        return;
      }
      await API.post("/coupons/store/products/", payload);
      await loadStoreProducts();
      alert("Product created.");
      setSpForm((f) => ({
        ...f,
        price_per_unit: "",
        max_per_order: "10",
        display_title: "E‑Coupon",
        display_desc: "",
      }));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to create product";
      alert(msg);
    } finally {
      setSpSubmitting(false);
    }
  }

  async function createStandardProducts() {
    try {
      if (!spForm.coupon_id) {
        alert("Select Coupon");
        return;
      }
      const couponId = parseInt(spForm.coupon_id, 10);
      const wanted = [150, 750, 759];
      const existing = new Set(
        (spItems || [])
          .filter((p) => String(p.coupon) === String(couponId))
          .map((p) => Number(p.denomination))
      );
      setSpSubmitting(true);
      for (const denom of wanted) {
        if (existing.has(Number(denom))) continue;
        const payload = {
          coupon: couponId,
          denomination: denom,
          price_per_unit: denom,
          enable_consumer: true,
          enable_agency: true,
          enable_employee: false,
          is_active: true,
          max_per_order: 10,
          display_title: `E‑Coupon ₹${denom}`,
          display_desc: "",
        };
        try {
          await API.post("/coupons/store/products/", payload);
        } catch (_) {}
      }
      await loadStoreProducts();
      alert("Ensured 150/750/759 products exist for the selected coupon.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to ensure standard products";
      alert(msg);
    } finally {
      setSpSubmitting(false);
    }
  }

  async function patchProduct(id, patch) {
    try {
      await API.patch(`/coupons/store/products/${id}/`, patch);
      await loadStoreProducts();
    } catch (e) {
      const msg = e?.response?.data?.detail || "Update failed";
      alert(msg);
    }
  }

  // Default product coupon from master coupons list
  useEffect(() => {
    if (!spForm.coupon_id && coupons && coupons.length) {
      setSpForm((f) => ({ ...f, coupon_id: String(coupons[0].id) }));
    }
  }, [coupons]); // eslint-disable-line

  // =========================
  // STORE: Pending Orders
  // =========================
  async function loadPendingOrders() {
    setPoLoading(true);
    try {
      const res = await API.get("/coupons/store/orders/pending/", { params: { page_size: 50 } });
      const items = res?.data?.results || res?.data || [];
      const orders = Array.isArray(items) ? items : [];
      setPendingOrders(orders);
      try {
        const pairs = await Promise.all(
          orders.map(async (o) => {
            let couponId = null;
            try {
              const prodRes = await API.get(`/coupons/store/products/${o.product}/`);
              couponId = prodRes?.data?.coupon || null;
            } catch (_e) {}
            let globalCount = 0;
            let prodCount = 0;
            try {
              const params = {
                issued_channel: "e_coupon",
                status: "AVAILABLE",
                page_size: 1,
              };
              const denom =
                typeof o.denomination_snapshot !== "undefined" && o.denomination_snapshot !== null
                  ? o.denomination_snapshot
                  : null;
              if (denom !== null) params.value = denom;
              const invRes = await API.get("/coupons/codes/", { params });
              globalCount =
                typeof invRes?.data?.count === "number"
                  ? invRes.data.count
                  : Array.isArray(invRes?.data)
                  ? invRes.data.length
                  : 0;

              if (couponId) {
                const paramsProd = { ...params, coupon: couponId };
                const invResProd = await API.get("/coupons/codes/", { params: paramsProd });
                prodCount =
                  typeof invResProd?.data?.count === "number"
                    ? invResProd.data.count
                    : Array.isArray(invResProd?.data)
                    ? invResProd.data.length
                    : 0;
              }
            } catch (_e2) {}
            return [o.id, globalCount, prodCount];
          })
        );
        const mapGlobal = {};
        const mapProd = {};
        for (const [id, g, p] of pairs) {
          mapGlobal[id] = g;
          mapProd[id] = p ?? 0;
        }
        setOrderAvail(mapGlobal);
        setOrderProdAvail(mapProd);
      } catch (_calcErr) {
        setOrderAvail({});
      }
    } catch (_) {
      setPendingOrders([]);
    } finally {
      setPoLoading(false);
    }
  }

  async function approveOrder(order) {
    const id = order?.id;
    if (!id) return;
    setOrderBusy((m) => ({ ...m, [id]: true }));
    try {
      const note = orderNotes[id] || "";

      // Pre-check inventory for this denomination (and coupon if resolvable)
      let couponId = null;
      try {
        const prodRes = await API.get(`/coupons/store/products/${order.product}/`);
        couponId = prodRes?.data?.coupon || null;
      } catch (_) {}

      let availableGlobal = 0;
      let availableProduct = 0;
      let available = 0;
      try {
        const params = {
          issued_channel: "e_coupon",
          status: "AVAILABLE",
          page_size: 1,
        };
        const denom =
          typeof order.denomination_snapshot !== "undefined" && order.denomination_snapshot !== null
            ? order.denomination_snapshot
            : null;
        if (denom !== null) params.value = denom;

        const invResGlobal = await API.get("/coupons/codes/", { params });
        availableGlobal =
          typeof invResGlobal?.data?.count === "number"
            ? invResGlobal.data.count
            : Array.isArray(invResGlobal?.data)
            ? invResGlobal.data.length
            : 0;

        if (couponId) {
          const paramsProd = { ...params, coupon: couponId };
          const invResProd = await API.get("/coupons/codes/", { params: paramsProd });
          availableProduct =
            typeof invResProd?.data?.count === "number"
              ? invResProd.data.count
              : Array.isArray(invResProd?.data)
              ? invResProd.data.length
              : 0;
        }

        available = Math.max(availableGlobal, availableProduct);
      } catch (_) {}

      const needed = Number(order.quantity || 0);
      if (available < needed) {
        const shortageGlobal = Math.max(0, needed - availableGlobal);
        const shortageProduct = Math.max(0, needed - availableProduct);
        const shortage = couponId ? shortageProduct : shortageGlobal;
        try {
          setActiveTab("inventory");
          if (couponId) {
            setSpForm((f) => ({ ...f, coupon_id: String(couponId) }));
          }
        } catch {}
        alert(
          `Insufficient inventory. Global denom: ${availableGlobal}, Product coupon: ${availableProduct}, Needed: ${needed}.`
        );
        return;
      }

      // Enough inventory, proceed with approval
      await API.post(`/coupons/store/orders/${id}/approve/`, { review_note: note });
      await loadPendingOrders();
      alert("Order approved and codes allocated.");
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data || {};
      const msg = data?.detail || "Approval failed";
      alert(msg);
    } finally {
      setOrderBusy((m) => ({ ...m, [id]: false }));
    }
  }

  async function rejectOrder(id) {
    setOrderBusy((m) => ({ ...m, [id]: true }));
    try {
      const note = orderNotes[id] || "";
      await API.post(`/coupons/store/orders/${id}/reject/`, { review_note: note });
      await loadPendingOrders();
      alert("Order rejected.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Rejection failed";
      alert(msg);
    } finally {
      setOrderBusy((m) => ({ ...m, [id]: false }));
    }
  }

  // Initial loads for store sections
  useEffect(() => {
    loadPaymentConfigs();
    loadStoreProducts();
    loadPendingOrders();
  }, []); // eslint-disable-line

  // =========================
  // UI
  // =========================
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>E‑Coupons</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Season-first creation. Create Season batches (₹150/₹759), assign by count to agencies/employees, manage store and view metrics.
        </div>
      </div>

      <div style={{ position: "sticky", top: 0, zIndex: 4, background: "transparent", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", overflowX: "auto" }}>
          <button
            onClick={() => setActiveTab("create")}
            style={{
              padding: "6px 10px",
              background: activeTab === "create" ? "#0f172a" : "#fff",
              color: activeTab === "create" ? "#fff" : "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            style={{
              padding: "6px 10px",
              background: activeTab === "orders" ? "#0f172a" : "#fff",
              color: activeTab === "orders" ? "#fff" : "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Orders
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            style={{
              padding: "6px 10px",
              background: activeTab === "inventory" ? "#0f172a" : "#fff",
              color: activeTab === "inventory" ? "#fff" : "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab("history")}
            style={{
              padding: "6px 10px",
              background: activeTab === "history" ? "#0f172a" : "#fff",
              color: activeTab === "history" ? "#fff" : "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            style={{
              padding: "6px 10px",
              background: activeTab === "settings" ? "#0f172a" : "#fff",
              color: activeTab === "settings" ? "#fff" : "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Settings
          </button>
        </div>
      </div>

      {err ? <div style={{ color: "#dc2626", marginBottom: 12 }}>{err}</div> : null}

      {/* CREATE TAB */}
      <Section
        id="sec-season"
        visible={activeTab === "create"}
        title="Season"
        extraRight={
          <button
            onClick={ensureSeasonCoupon}
            disabled={seasonEnsuring}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: seasonEnsuring ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {seasonEnsuring ? "Ensuring..." : "Ensure Season"}
          </button>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <TextInput
            label="Season Number"
            type="number"
            value={season.number}
            onChange={(v) => setSeason((s) => ({ ...s, number: v }))}
            placeholder="e.g., 1"
          />
          <TextInput
            label="Valid From"
            type="datetime-local"
            value={season.from}
            onChange={(v) => setSeason((s) => ({ ...s, from: v }))}
          />
          <TextInput
            label="Valid To"
            type="datetime-local"
            value={season.to}
            onChange={(v) => setSeason((s) => ({ ...s, to: v }))}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>Ledger/Code/Campaign</label>
            <div style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
              {seasonLabel(season.number)}
            </div>
          </div>
        </div>
        {seasonCouponId ? (
          <div style={{ color: "#16a34a", fontSize: 12, marginTop: 8 }}>
            Season ensured: {seasonLabel(season.number)} (coupon #{seasonCouponId})
          </div>
        ) : (
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
            Ensure Season to enable batch generation and assignment.
          </div>
        )}
      </Section>

      <Section
        id="sec-generate"
        visible={activeTab === "create"}
        title="Generate Season Batches (random codes)"
        extraRight={
          <button
            onClick={createBothBatches}
            disabled={
              !(
                seasonCouponId &&
                Number(gen150.count || 0) > 0 &&
                Number(gen759.count || 0) > 0
              )
            }
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor:
                seasonCouponId &&
                Number(gen150.count || 0) > 0 &&
                Number(gen759.count || 0) > 0
                  ? "pointer"
                  : "not-allowed",
              fontWeight: 700,
            }}
          >
            Generate Both
          </button>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12,
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: "#0f172a" }}>₹150</div>
            <TextInput
              label="Count"
              type="number"
              value={gen150.count}
              onChange={(v) => setGen150((s) => ({ ...s, count: v }))}
              placeholder="e.g., 500"
            />
            <TextInput
              label="Prefix"
              value={gen150.prefix}
              onChange={(v) => setGen150((s) => ({ ...s, prefix: v }))}
              placeholder="e.g., S1-150"
            />
            <button
              onClick={() => createSeasonBatch(150, gen150.count, gen150.prefix)}
              disabled={!seasonCouponId || gen150.loading}
              style={{
                padding: "8px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: !seasonCouponId || gen150.loading ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {gen150.loading ? "Creating..." : "Generate 150"}
            </button>
          </div>

          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12,
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: "#0f172a" }}>₹759</div>
            <TextInput
              label="Count"
              type="number"
              value={gen759.count}
              onChange={(v) => setGen759((s) => ({ ...s, count: v }))}
              placeholder="e.g., 500"
            />
            <TextInput
              label="Prefix"
              value={gen759.prefix}
              onChange={(v) => setGen759((s) => ({ ...s, prefix: v }))}
              placeholder="e.g., S1-759"
            />
            <button
              onClick={() => createSeasonBatch(759, gen759.count, gen759.prefix)}
              disabled={!seasonCouponId || gen759.loading}
              style={{
                padding: "8px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: !seasonCouponId || gen759.loading ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {gen759.loading ? "Creating..." : "Generate 759"}
            </button>
          </div>
        </div>

        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Codes will be generated as prefix + 7 random uppercase alphanumerics (e.g., S1-150X7K9A2B).
        </div>
      </Section>

      <Section
        id="sec-assign-season"
        visible={activeTab === "create"}
        title="Assign (Season by denomination)"
        extraRight={
          <button
            onClick={assignSeasonByCount}
            disabled={seasonAssign.loading}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: seasonAssign.loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {seasonAssign.loading ? "Assigning..." : "Assign"}
          </button>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <Select
            label="Denomination"
            value={seasonAssign.denom}
            onChange={(v) => {
              setSeasonAssign((s) => ({ ...s, denom: v, batchId: "" }));
            }}
            options={[
              { value: "150", label: "₹150" },
              { value: "759", label: "₹759" },
            ]}
          />
          <Select
            label="Batch (Season)"
            value={seasonAssign.batchId}
            onChange={(v) => {
              setSeasonAssign((s) => ({ ...s, batchId: v }));
              refreshBatchAvailability(v);
            }}
            options={[
              { value: "", label: "Select..." },
              ...(seasonBatchOptionsByDenom ? seasonBatchOptionsByDenom(seasonAssign.denom) : []),
            ]}
          />
          <Select
            label="Assign To"
            value={seasonAssign.targetType}
            onChange={(v) =>
              setSeasonAssign((s) => ({
                ...s,
                targetType: v,
                targetAgencyId: "",
                targetUsername: "",
                resolvedTargetId: "",
              }))
            }
            options={[
              { value: "agency", label: "Agency / Sub‑franchise" },
              { value: "employee", label: "Employee (Admin direct)" },
            ]}
          />
          {seasonAssign.targetType === "agency" ? (
            <Select
              label="Target Agency"
              value={seasonAssign.targetAgencyId}
              onChange={(v) =>
                setSeasonAssign((s) => ({
                  ...s,
                  targetAgencyId: v,
                  targetUsername: "",
                  resolvedTargetId: "",
                }))
              }
              options={[{ value: "", label: "Select..." }, ...(agencyOptionsFull || [])]}
            />
          ) : (
            <TextInput
              label="Target Username"
              value={seasonAssign.targetUsername}
              onChange={(v) => setSeasonAssign((s) => ({ ...s, targetUsername: v, resolvedTargetId: "" }))}
              placeholder="employee username"
            />
          )}
          <TextInput
            label="Count"
            type="number"
            value={seasonAssign.count}
            onChange={(v) => setSeasonAssign((s) => ({ ...s, count: v }))}
            placeholder="e.g., 100"
          />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
          <div>Season Available ₹150: {seasonAvail["150"]}</div>
          <div>Season Available ₹759: {seasonAvail["759"]}</div>
          {seasonAssign.batchId ? (
            <div>
              Batch Available: {batchAvail[String(seasonAssign.batchId)] ?? "…"}
            </div>
          ) : null}
        </div>
      </Section>

      <Section
        id="sec-season-kpi"
        visible={activeTab === "create"}
        title="Season KPIs"
        extraRight={
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <Select
              label="Denomination"
              value={seasonKpi.denom}
              onChange={(v) => setSeasonKpi((k) => ({ ...k, denom: v }))}
              options={[
                { value: "all", label: "All" },
                { value: "150", label: "₹150" },
                { value: "759", label: "₹759" },
              ]}
            />
            <button
              onClick={loadSeasonKpis}
              disabled={seasonKpi.loading || !seasonCouponId}
              style={{
                padding: "8px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: seasonKpi.loading || !seasonCouponId ? "not-allowed" : "pointer",
                fontWeight: 700,
                height: 40,
              }}
            >
              {seasonKpi.loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard label="Available" value={seasonKpi.values.available} />
          <MetricCard label="Assigned to Agencies" value={seasonKpi.values.assigned_agency} />
          <MetricCard label="Assigned to Employees" value={seasonKpi.values.assigned_employee} />
          <MetricCard label="Sold (Distributed)" value={seasonKpi.values.sold} />
          <MetricCard label="Redeemed (Approved)" value={seasonKpi.values.redeemed} />
          <MetricCard label="Revoked" value={seasonKpi.values.revoked} />
        </div>
      </Section>

      <Section
        id="sec-agency-history-season"
        visible={activeTab === "create"}
        title="Agency history (Season)"
        extraRight={
          <button
            onClick={searchAgencyHistory}
            disabled={agencyHist.loading || !seasonCouponId}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: agencyHist.loading || !seasonCouponId ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {agencyHist.loading ? "Searching..." : "Search"}
          </button>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <TextInput
            label="Agency Username"
            value={agencyHist.username}
            onChange={(v) => setAgencyHist((s) => ({ ...s, username: v }))}
            placeholder="agency username"
          />
          <Select
            label="Denomination"
            value={agencyHist.denom}
            onChange={(v) => setAgencyHist((s) => ({ ...s, denom: v }))}
            options={[
              { value: "all", label: "All" },
              { value: "150", label: "₹150" },
              { value: "759", label: "₹759" },
            ]}
          />
          <TextInput
            label="From (optional)"
            type="datetime-local"
            value={agencyHist.from}
            onChange={(v) => setAgencyHist((s) => ({ ...s, from: v }))}
          />
          <TextInput
            label="To (optional)"
            type="datetime-local"
            value={agencyHist.to}
            onChange={(v) => setAgencyHist((s) => ({ ...s, to: v }))}
          />
        </div>
        {agencyHist.error ? <div style={{ color: "#dc2626", marginTop: 8 }}>{agencyHist.error}</div> : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <MetricCard label="Available" value={agencyHist.snapshot.available} />
          <MetricCard label="Assigned to Agencies" value={agencyHist.snapshot.assigned_agency} />
          <MetricCard label="Assigned to Employees" value={agencyHist.snapshot.assigned_employee} />
          <MetricCard label="Sold (Distributed)" value={agencyHist.snapshot.sold} />
          <MetricCard label="Redeemed" value={agencyHist.snapshot.redeemed} />
          <MetricCard label="Revoked" value={agencyHist.snapshot.revoked} />
          <MetricCard label="Total (Season)" value={agencyHist.snapshot.total} />
          <MetricCard label="Total ₹150" value={agencyHist.snapshot.byDenom["150"]} />
          <MetricCard label="Total ₹759" value={agencyHist.snapshot.byDenom["759"]} />
        </div>

        <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                minWidth: 1000,
                display: "grid",
                gridTemplateColumns: "120px 120px 120px 120px 1fr 200px",
                gap: 8,
                padding: "10px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <div>Denom</div>
              <div>Batch</div>
              <div>Count</div>
              <div>Role</div>
              <div>Assigned By</div>
              <div>Assigned At</div>
            </div>
            <div>
              {(agencyHist.rows || []).map((r, idx) => (
                <div
                  key={r.id || idx}
                  style={{
                    minWidth: 1000,
                    display: "grid",
                    gridTemplateColumns: "120px 120px 120px 120px 1fr 200px",
                    gap: 8,
                    padding: "10px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <div>₹{r.denom || "—"}</div>
                  <div>{r.batch_display || "—"}</div>
                  <div>{r.count ?? "—"}</div>
                  <div style={{ textTransform: "capitalize" }}>{r.role || "—"}</div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.assigned_by || "—"}</div>
                  <div>{r.assigned_at ? new Date(r.assigned_at).toLocaleString() : "—"}</div>
                </div>
              ))}
              {!agencyHist.loading && (!agencyHist.rows || agencyHist.rows.length === 0) ? (
                <div style={{ padding: 12, color: "#64748b" }}>No records</div>
              ) : null}
            </div>
          </div>
        </div>
      </Section>

      {/* SETTINGS TAB (Payment + Store products, concise) */}
      <Section
        id="sec-payment"
        visible={activeTab === "settings"}
        title="Payment settings"
        extraRight={
          <button
            onClick={createPaymentConfig}
            disabled={pcSubmitting}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: pcSubmitting ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {pcSubmitting ? "Saving..." : "Create"}
          </button>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <TextInput
            label="Title"
            value={pcForm.title}
            onChange={(v) => setPcForm((f) => ({ ...f, title: v }))}
            placeholder="e.g., UPI Payments"
          />
          <TextInput
            label="UPI ID"
            value={pcForm.upi_id}
            onChange={(v) => setPcForm((f) => ({ ...f, upi_id: v }))}
            placeholder="e.g., payee@upi"
          />
          <TextInput
            label="Payee Name"
            value={pcForm.payee_name}
            onChange={(v) => setPcForm((f) => ({ ...f, payee_name: v }))}
            placeholder="e.g., Company Pvt Ltd"
          />
          <TextInput
            label="Instructions"
            value={pcForm.instructions}
            onChange={(v) => setPcForm((f) => ({ ...f, instructions: v }))}
            placeholder="Steps for payment (optional)"
          />
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>QR Image</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setPcForm((f) => ({ ...f, file: e.target.files && e.target.files[0] ? e.target.files[0] : null }))
              }
            />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            onClick={loadPaymentConfigs}
            style={{
              padding: "6px 10px",
              background: "#fff",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Refresh List
          </button>
          <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
            Loaded configs: {(pcItems || []).length}
          </div>
        </div>
      </Section>

      <Section
        id="sec-products"
        visible={activeTab === "settings"}
        title="Store products"
        extraRight={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={createStandardProducts}
              disabled={spSubmitting}
              style={{
                padding: "8px 12px",
                background: "#fff",
                color: "#0f172a",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                cursor: spSubmitting ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {spSubmitting ? "Ensuring..." : "Ensure 150/750/759"}
            </button>
            <button
              onClick={createStoreProduct}
              disabled={spSubmitting}
              style={{
                padding: "8px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: spSubmitting ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {spSubmitting ? "Saving..." : "Create"}
            </button>
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <Select
            label="Coupon"
            value={spForm.coupon_id}
            onChange={(v) => setSpForm((f) => ({ ...f, coupon_id: v }))}
            options={[{ value: "", label: "Select..." }, ...couponOptions]}
          />
          <TextInput
            label="Denomination"
            type="number"
            value={spForm.denomination}
            onChange={(v) => setSpForm((f) => ({ ...f, denomination: v }))}
            placeholder="e.g., 150"
          />
          <TextInput
            label="Unit Price (optional)"
            type="number"
            value={spForm.price_per_unit}
            onChange={(v) => setSpForm((f) => ({ ...f, price_per_unit: v }))}
            placeholder="defaults to denomination"
          />
          <TextInput
            label="Max per order"
            type="number"
            value={spForm.max_per_order}
            onChange={(v) => setSpForm((f) => ({ ...f, max_per_order: v }))}
            placeholder="e.g., 10"
          />
          <TextInput
            label="Display Title"
            value={spForm.display_title}
            onChange={(v) => setSpForm((f) => ({ ...f, display_title: v }))}
            placeholder="e.g., E‑Coupon ₹150"
          />
          <TextInput
            label="Display Description"
            value={spForm.display_desc}
            onChange={(v) => setSpForm((f) => ({ ...f, display_desc: v }))}
            placeholder="Optional description"
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!spForm.enable_consumer}
                onChange={(e) => setSpForm((f) => ({ ...f, enable_consumer: e.target.checked }))}
              />
              Consumer
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!spForm.enable_agency}
                onChange={(e) => setSpForm((f) => ({ ...f, enable_agency: e.target.checked }))}
              />
              Agency
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!spForm.enable_employee}
                onChange={(e) => setSpForm((f) => ({ ...f, enable_employee: e.target.checked }))}
              />
              Employee
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!spForm.is_active}
                onChange={(e) => setSpForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active
            </label>
          </div>
        </div>
      </Section>

      {/* ORDERS */}
      <Section
        id="sec-orders"
        visible={activeTab === "orders"}
        title="Awaiting approval"
        extraRight={
          <button
            onClick={loadPendingOrders}
            disabled={poLoading}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: poLoading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {poLoading ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        {poLoading ? (
          <div style={{ color: "#64748b" }}>Loading...</div>
        ) : (pendingOrders || []).length === 0 ? (
          <div style={{ color: "#64748b" }}>No pending orders</div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  minWidth: 1100,
                  display: "grid",
                  gridTemplateColumns: "80px 160px 100px 80px 120px 180px 220px",
                  gap: 8,
                  padding: "10px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                <div>ID</div>
                <div>Buyer</div>
                <div>Role</div>
                <div>Qty</div>
                <div>Total</div>
                <div>Product</div>
                <div>Actions</div>
              </div>
              <div>
                {(pendingOrders || []).map((o) => {
                  const busy = !!orderBusy[o.id];
                  const note = orderNotes[o.id] || "";
                  return (
                    <div
                      key={o.id}
                      style={{
                        minWidth: 1100,
                        display: "grid",
                        gridTemplateColumns: "80px 160px 100px 80px 120px 180px 220px",
                        gap: 8,
                        padding: "10px",
                        borderBottom: "1px solid #e2e8f0",
                        alignItems: "center",
                      }}
                    >
                      <div>#{o.id}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {o.buyer_username || o.buyer || "—"}
                      </div>
                      <div>{o.role_at_purchase || "—"}</div>
                      <div>{o.quantity || 0}</div>
                      <div>₹{o.amount_total || 0}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.product_title || "—"}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          style={{ padding: 8, border: "1px solid #e2e8f0", borderRadius: 8, minWidth: 160 }}
                          placeholder="Review note"
                          value={note}
                          onChange={(e) => setOrderNotes((m) => ({ ...m, [o.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => approveOrder(o)}
                          disabled={busy}
                          style={{
                            padding: "6px 10px",
                            background: "#16a34a",
                            color: "#fff",
                            border: 0,
                            borderRadius: 8,
                            cursor: busy ? "not-allowed" : "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {busy ? "Processing..." : "Approve"}
                        </button>
                        <button
                          onClick={() => rejectOrder(o.id)}
                          disabled={busy}
                          style={{
                            padding: "6px 10px",
                            background: "#dc2626",
                            color: "#fff",
                            border: 0,
                            borderRadius: 8,
                            cursor: busy ? "not-allowed" : "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {busy ? "Processing..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* INVENTORY (minimal summary) */}
      <Section
        id="sec-metrics"
        visible={activeTab === "inventory"}
        title="Inventory Summary"
        extraRight={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Select
              label="Batch"
              value={selectedBatch}
              onChange={setSelectedBatch}
              options={[{ value: "", label: "Select..." }, ...batchOptionsAll]}
            />
            <button
              onClick={() => loadDashboard(false)}
              disabled={metricsLoading}
              style={{
                padding: "8px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: metricsLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
                height: 40,
                alignSelf: "end",
              }}
            >
              {metricsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard label="Available" value={metrics.available} />
          <MetricCard label="Assigned to Agencies" value={metrics.assigned_agency} />
          <MetricCard label="Assigned to Employees" value={metrics.assigned_employee} />
          <MetricCard label="Sold (Distributed)" value={metrics.sold} />
          <MetricCard label="Redeemed (Approved)" value={metrics.redeemed} />
          <MetricCard label="Revoked" value={metrics.revoked} />
        </div>
      </Section>

      {/* HISTORY (simple view) */}
      <Section
        id="sec-history"
        visible={activeTab === "history"}
        title="Assignment History"
        extraRight={
          <button
            onClick={() => loadDashboard(false)}
            disabled={assignListLoading}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: assignListLoading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {assignListLoading ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                minWidth: 1000,
                display: "grid",
                gridTemplateColumns: "120px 1fr 160px 120px 160px 200px",
                gap: 8,
                padding: "10px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <div>Role</div>
              <div>Assignee</div>
              <div>Info</div>
              <div>Count</div>
              <div>Batch</div>
              <div>Assigned At</div>
            </div>
            <div>
              {(assignments || []).map((a, idx) => {
                const role = a.role || (a.agency_id ? "agency" : a.employee_id ? "employee" : "");
                const assignee =
                  a.assignee_name ||
                  a.agency_name ||
                  a.employee_name ||
                  `#${a.assignee_id || a.agency_id || a.employee_id || ""}`;
                const start = a.serial_start ?? a.start ?? a.range_start;
                const end = a.serial_end ?? a.end ?? a.range_end;
                const count =
                  a.count ??
                  (typeof start === "number" && typeof end === "number" ? end - start + 1 : "");
                const info =
                  typeof start === "number" && typeof end === "number"
                    ? `${start} - ${end}`
                    : "Random codes";
                const batch =
                  a.batch_display || (a.batch && `#${a.batch.id}`) || (a.batch_id ? `#${a.batch_id}` : "");
                const at = a.assigned_at || a.created_at || a.created || "";
                return (
                  <div
                    key={a.id || idx}
                    style={{
                      minWidth: 1000,
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 160px 120px 160px 200px",
                      gap: 8,
                      padding: "10px",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ textTransform: "capitalize" }}>{role || "—"}</div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{assignee || "—"}</div>
                    <div>{info}</div>
                    <div>{count ?? "—"}</div>
                    <div>{batch || "—"}</div>
                    <div>{at ? new Date(at).toLocaleString() : "—"}</div>
                  </div>
                );
              })}
              {!assignListLoading && (!assignments || assignments.length === 0) ? (
                <div style={{ padding: 12, color: "#64748b" }}>No assignments found</div>
              ) : null}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
