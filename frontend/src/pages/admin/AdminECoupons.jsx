import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/api";

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
  // Master lists
  const [coupons, setCoupons] = useState([]);
  const [batches, setBatches] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Create Coupon form
  const [couponForm, setCouponForm] = useState({
    title: "Lucky E-Coupon",
    description: "",
    campaign: "LDGR",
    valid_from: "",
    valid_to: "",
  });
  const [createCouponLoading, setCreateCouponLoading] = useState(false);

  // Create Batch form (E-Coupon)
  const [batchForm, setBatchForm] = useState({
    coupon_id: "",
    prefix: "LDGR",
    count: "500",
    denomination: "150",
  });
  const [createBatchLoading, setCreateBatchLoading] = useState(false);

  // Assign-to-Agency/Employee form (count based only)
  const [assignForm, setAssignForm] = useState({
    batch_id: "",
    assignee_type: "agency",
    agency_id: "",
    employee_id: "",
    count: "",
  });
  const [assignLoading, setAssignLoading] = useState(false);

  // Metrics selection and values
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

  const [err, setErr] = useState("");
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");

  // Admin Agency Assignment Summary
  const [summary, setSummary] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summaryFrom, setSummaryFrom] = useState("");
  const [summaryTo, setSummaryTo] = useState("");

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

  function setCouponField(k, v) {
    setCouponForm((f) => ({ ...f, [k]: v }));
  }
  function setBatchField(k, v) {
    setBatchForm((f) => ({ ...f, [k]: v }));
  }
  function setAssignField(k, v) {
    setAssignForm((f) => ({ ...f, [k]: v }));
  }

  async function loadCoupons() {
    try {
      const res = await API.get("/coupons/coupons/", { params: { page_size: 100 } });
      const items = res?.data?.results || res?.data || [];
      setCoupons(Array.isArray(items) ? items : []);
      if (!batchForm.coupon_id) {
        const first = (Array.isArray(items) ? items : [])[0];
        if (first) setBatchForm((f) => ({ ...f, coupon_id: String(first.id) }));
      }
    } catch (_) {}
  }

  async function loadBatches() {
    try {
      const res = await API.get("/coupons/batches/", { params: { page_size: 100 } });
      const items = res?.data?.results || res?.data || [];
      setBatches(Array.isArray(items) ? items : []);
      if (!assignForm.batch_id && items?.length) {
        setAssignForm((f) => ({ ...f, batch_id: String(items[0].id) }));
      }
      if (!selectedBatch && items?.length) {
        setSelectedBatch(String(items[0].id));
      }
    } catch (_) {}
  }

  async function loadEmployees() {
    try {
      const res = await API.get("/admin/users/", { params: { role: "employee", page_size: 200 } });
      const items = res?.data?.results || res?.data || [];
      setEmployees(Array.isArray(items) ? items : []);
    } catch (_) {}
  }

  async function loadAgencies() {
    try {
      const res = await API.get("/admin/users/", { params: { role: "agency", page_size: 200 } });
      const items = res?.data?.results || res?.data || [];
      setAgencies(Array.isArray(items) ? items : []);
    } catch (_) {}
  }

  async function createCoupon() {
    setCreateCouponLoading(true);
    setErr("");
    try {
      const payload = {
        code: (couponForm.campaign || couponForm.title || "LDGR").trim(),
        title: couponForm.title,
        description: couponForm.description,
        campaign: couponForm.campaign,
        valid_from: couponForm.valid_from || null,
        valid_to: couponForm.valid_to || null,
      };
      const res = await API.post("/coupons/coupons/", payload);
      await loadCoupons();
      alert(`Coupon created: ${res?.data?.title || "OK"}`);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to create coupon");
    } finally {
      setCreateCouponLoading(false);
    }
  }

  async function createBatch() {
    setCreateBatchLoading(true);
    setErr("");
    try {
      if (!batchForm.coupon_id) {
        alert("Select coupon");
        setCreateBatchLoading(false);
        return;
      }
      const payload = {
        coupon: parseInt(batchForm.coupon_id, 10),
        prefix: (batchForm.prefix || "LDGR").trim() || "LDGR",
        count: parseInt(batchForm.count || "0", 10),
        value: parseInt(batchForm.denomination || "150", 10),
      };
      if (!payload.count || payload.count <= 0) {
        alert("Enter a valid Count (>0)");
        setCreateBatchLoading(false);
        return;
      }
      await API.post("/coupons/batches/create-ecoupons/", payload);
      await loadBootstrap();
      alert("E-Coupon batch created");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to create batch");
    } finally {
      setCreateBatchLoading(false);
    }
  }

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

  async function loadAssignments() {
    setAssignListLoading(true);
    try {
      const bid = selectedBatch || assignForm.batch_id || "";
      const params = {
        page: assignPage,
        page_size: assignPageSize,
        batch: bid || undefined,
      };
      const res = await API.get("/coupons/audits/", { params });
      const items = res?.data?.results || res?.data || [];
      const rows = (Array.isArray(items) ? items : [])
        .filter((r) => {
          const a = r.action || "";
          return (
            a === "assigned_to_agency" ||
            a === "assigned_to_agency_by_count" ||
            a === "assigned_to_employee" ||
            a === "bulk_assigned_to_employees" ||
            a === "bulk_assigned_to_agencies" ||
            a === "agency_assigned_to_employee_by_count" ||
            a === "admin_assigned_to_employee_by_count"
          );
        })
        .flatMap((r) => {
          const action = r.action || "";
          const meta = r.metadata || {};
          const batch_id = r.batch || r.batch_id || null;
          const by = r.actor_username || "";
          const at = r.created_at || "";
          if (action === "bulk_assigned_to_employees" && Array.isArray(meta.assignments)) {
            return meta.assignments.map((it) => ({
              id: `${action}-${batch_id}-${it.employee_id}-${at}`,
              role: "employee",
              assignee_id: it.employee_id,
              assignee_name: `Employee #${it.employee_id}`,
              serial_start: null,
              serial_end: null,
              count: it.count,
              batch_display: batch_id ? `#${batch_id}` : "",
              assigned_by: by,
              assigned_at: at,
            }));
          }
          let role = action.includes("employee") ? "employee" : "agency";
          let assignee_id = role === "employee" ? (meta.employee_id || null) : (meta.agency_id || null);
          let assignee_name =
            assignee_id
              ? `${role === "employee" ? "Employee" : "Agency"} #${assignee_id}`
              : (r.notes || "").replace(/^.* to /, "").trim();

          let start = null, end = null, count = null;
          if (Array.isArray(meta.serial_range) && meta.serial_range.length === 2) {
            start = meta.serial_range[0];
            end = meta.serial_range[1];
            if (Number.isFinite(start) && Number.isFinite(end)) {
              count = end - start + 1;
            }
          }
          if (meta.count && !count) count = meta.count;
          if (meta.total_assigned && !count) count = meta.total_assigned;

          return [
            {
              id: `${action}-${batch_id}-${assignee_id || ""}-${at}`,
              role,
              assignee_id,
              assignee_name,
              serial_start: start,
              serial_end: end,
              count,
              batch_display: batch_id ? `#${batch_id}` : "",
              assigned_by: by,
              assigned_at: at,
            },
          ];
        });

      // Client-side filters
      let filtered = rows;
      if (assignFilters.role) {
        filtered = filtered.filter((x) => x.role === assignFilters.role);
      }
      if (assignFilters.assignee_id) {
        filtered = filtered.filter((x) => String(x.assignee_id || "") === String(assignFilters.assignee_id));
      }
      if (assignFilters.search) {
        const q = String(assignFilters.search).toLowerCase();
        filtered = filtered.filter(
          (x) =>
            String(x.assignee_name || "").toLowerCase().includes(q) ||
            String(x.batch_display || "").toLowerCase().includes(q) ||
            String(x.assigned_by || "").toLowerCase().includes(q)
        );
      }

      setAssignments(filtered);
      const total =
        typeof res?.data?.count === "number"
          ? res.data.count
          : Array.isArray(items)
          ? items.length
          : filtered.length;
      setAssignTotal(total);
    } catch (_) {
      setAssignments([]);
      setAssignTotal(0);
    } finally {
      setAssignListLoading(false);
    }
  }

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

  // Consolidated loaders
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
          typeof d.assignments.count === "number"
            ? d.assignments.count
            : rows.length;
        setAssignTotal(total);
      }
    } catch (e) {
      setErr("Failed to load bootstrap data");
    } finally {
      setBootstrapLoading(false);
    }
  }

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
          typeof d.assignments.count === "number"
            ? d.assignments.count
            : filtered.length;
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
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!selectedBatch) return;
    loadDashboard(false);
  }, [selectedBatch]);

  useEffect(() => {
    if (!selectedBatch) return;
    loadDashboard(false);
  }, [selectedBatch, assignPage, assignPageSize, assignFilters]);

  // Options
  const couponOptions = useMemo(
    () => coupons.map((c) => ({ value: String(c.id), label: `${c.title} (id:${c.id})` })),
    [coupons]
  );

  const batchOptions = useMemo(
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
        };
      }),
    [batches]
  );

  const agencyOptions = useMemo(
    () => agencies.map((u) => ({ value: String(u.id), label: `${u.username} #${u.id}` })),
    [agencies]
  );
  const employeeOptions = useMemo(
    () => employees.map((u) => ({ value: String(u.id), label: `${u.username} #${u.id}` })),
    [employees]
  );

  // =========================
  // E‑Coupon Store Management
  // =========================

  // Payment Configs
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

  // Store Products
  const [spItems, setSpItems] = useState([]);
  const [spLoading, setSpLoading] = useState(false);
  const [spSubmitting, setSpSubmitting] = useState(false);
  const [spForm, setSpForm] = useState({
    coupon_id: "",
    denomination: "150",
    price_per_unit: "",
    enable_consumer: true,
    enable_agency: false,
    enable_employee: false,
    is_active: true,
    max_per_order: "10",
    display_title: "E‑Coupon",
    display_desc: "",
  });

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

  // Pending Orders (Admin)
  const [pendingOrders, setPendingOrders] = useState([]);
  const [poLoading, setPoLoading] = useState(false);
  const [orderNotes, setOrderNotes] = useState({});
  const [orderBusy, setOrderBusy] = useState({});

  async function loadPendingOrders() {
    setPoLoading(true);
    try {
      const res = await API.get("/coupons/store/orders/pending/", { params: { page_size: 50 } });
      const items = res?.data?.results || res?.data || [];
      setPendingOrders(Array.isArray(items) ? items : []);
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

      let available = 0;
      try {
        const params = {
          issued_channel: "e_coupon",
          status: "AVAILABLE",
          page_size: 1,
        };
        if (couponId) params.coupon = couponId;
        const denom =
          typeof order.denomination_snapshot !== "undefined" && order.denomination_snapshot !== null
            ? order.denomination_snapshot
            : null;
        if (denom !== null) params.value = denom;
        const invRes = await API.get("/coupons/codes/", { params });
        available =
          typeof invRes?.data?.count === "number"
            ? invRes.data.count
            : Array.isArray(invRes?.data)
            ? invRes.data.length
            : 0;
      } catch (_) {}

      const needed = Number(order.quantity || 0);
      if (available < needed) {
        const shortage = Math.max(0, needed - available);
        // Prefill Create Batch form to quickly top-up inventory
        try {
          if (couponId) {
            setBatchForm((f) => ({
              ...f,
              coupon_id: String(couponId),
              denomination: String(Number(order.denomination_snapshot || 150)),
              count: String(shortage || needed || 0),
            }));
            try {
              document.getElementById("sec-create-batch")?.scrollIntoView({ behavior: "smooth" });
            } catch {}
          }
        } catch {}
        alert(
          `Insufficient e‑coupon inventory for this denomination. Available: ${available}, Needed: ${needed}. Prefilled Create Batch for quick top‑up.`
        );
        return;
      }

      // Enough inventory, proceed with approval
      await API.post(`/coupons/store/orders/${id}/approve/`, { review_note: note });
      await loadPendingOrders();
      alert("Order approved and codes allocated.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Approval failed";
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>E-Coupons</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Create random e-coupon batches (Prefix + 7-char alphanumeric), assign by count to agencies or employees, manage e-coupon store and view redemption metrics.
        </div>
      </div>

      <div style={{ position: "sticky", top: 0, zIndex: 4, background: "transparent", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", overflowX: "auto" }}>
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
            onClick={() => setActiveTab("setup")}
            style={{
              padding: "6px 10px",
              background: activeTab === "setup" ? "#0f172a" : "#fff",
              color: activeTab === "setup" ? "#fff" : "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Setup
          </button>
        </div>
      </div>
      {err ? <div style={{ color: "#dc2626", marginBottom: 12 }}>{err}</div> : null}

      {/* E‑Coupon Store: Payment Config */}
      <Section
        id="sec-payment"
        visible={activeTab === "setup"}
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
            {pcForm.file ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{pcForm.file.name}</div> : null}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Existing Configs</div>
          {pcLoading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (pcItems || []).length === 0 ? (
            <div style={{ color: "#64748b" }}>No configs</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {(pcItems || []).map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {c.upi_qr_image_url ? (
                      <img
                        alt="QR"
                        src={c.upi_qr_image_url}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ fontSize: 10, color: "#64748b", padding: 4, textAlign: "center" }}>No QR</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
                    <div style={{ fontWeight: 700 }}>{c.title || `#${c.id}`}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{c.payee_name || "—"}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{c.upi_id || ""}</div>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12, maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.instructions || "—"}
                  </div>
                  <div style={{ color: c.is_active ? "#16a34a" : "#64748b", fontWeight: 700, marginLeft: 8 }}>
                    {c.is_active ? "ACTIVE" : "INACTIVE"}
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    {!c.is_active ? (
                      <button
                        onClick={() => setActivePc(c.id)}
                        style={{
                          padding: "6px 10px",
                          background: "#0f172a",
                          color: "#fff",
                          border: 0,
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Set Active
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* E‑Coupon Store: Products */}
      <Section
        id="sec-products"
        visible={activeTab === "setup"}
        title="Store products"
        extraRight={
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

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Existing Products</div>
          {spLoading ? (
            <div style={{ color: "#64748b" }}>Loading...</div>
          ) : (spItems || []).length === 0 ? (
            <div style={{ color: "#64748b" }}>No products</div>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
              <div style={{ overflowX: "auto" }}>
                <div
                  style={{
                    minWidth: 1000,
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 100px 100px 120px 240px 120px 140px",
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
                  <div>Denom</div>
                  <div>Price</div>
                  <div>Visibility</div>
                  <div>Description</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                <div>
                  {(spItems || []).map((p) => {
                    const vis = [
                      p.enable_consumer ? "Consumer" : null,
                      p.enable_agency ? "Agency" : null,
                      p.enable_employee ? "Employee" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—";
                    return (
                      <div
                        key={p.id}
                        style={{
                          minWidth: 1000,
                          display: "grid",
                          gridTemplateColumns: "60px 1fr 100px 100px 120px 240px 120px 140px",
                          gap: 8,
                          padding: "10px",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <div>#{p.id}</div>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.display_title || p.coupon_title || "—"}
                        </div>
                        <div>₹{p.denomination}</div>
                        <div>₹{p.price_per_unit}</div>
                        <div>{vis}</div>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.display_desc || "—"}</div>
                        <div style={{ color: p.is_active ? "#16a34a" : "#64748b", fontWeight: 700 }}>
                          {p.is_active ? "ACTIVE" : "INACTIVE"}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            onClick={() => patchProduct(p.id, { is_active: !p.is_active })}
                            style={{
                              padding: "6px 10px",
                              background: "#fff",
                              color: "#0f172a",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            {p.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => patchProduct(p.id, { enable_consumer: !p.enable_consumer })}
                            style={{
                              padding: "6px 10px",
                              background: "#fff",
                              color: "#0f172a",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            {p.enable_consumer ? "Hide Consumer" : "Show Consumer"}
                          </button>
                          <button
                            onClick={() => patchProduct(p.id, { enable_agency: !p.enable_agency })}
                            style={{
                              padding: "6px 10px",
                              background: "#fff",
                              color: "#0f172a",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            {p.enable_agency ? "Hide Agency" : "Show Agency"}
                          </button>
                          <button
                            onClick={() => patchProduct(p.id, { enable_employee: !p.enable_employee })}
                            style={{
                              padding: "6px 10px",
                              background: "#fff",
                              color: "#0f172a",
                              border: "1px solid #e2e8f0",
                              borderRadius: 8,
                              cursor: "pointer",
                            }}
                          >
                            {p.enable_employee ? "Hide Employee" : "Show Employee"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Pending E‑Coupon Orders */}
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
                  minWidth: 1200,
                  display: "grid",
                  gridTemplateColumns: "80px 160px 100px 80px 100px 160px 160px 240px 220px",
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
                <div>UTR</div>
                <div>Proof</div>
                <div>Actions</div>
              </div>
              <div>
                {(pendingOrders || []).map((o) => {
                  const busy = !!orderBusy[o.id];
                  const note = orderNotes[o.id] || "";
                  const proofUrl = o.payment_proof_file || "";
                  return (
                    <div
                      key={o.id}
                      style={{
                        minWidth: 1200,
                        display: "grid",
                        gridTemplateColumns: "80px 160px 100px 80px 100px 160px 160px 240px 220px",
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
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.utr || "—"}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {proofUrl ? (
                          <a href={proofUrl} target="_blank" rel="noreferrer">
                            View Proof
                          </a>
                        ) : (
                          <span style={{ color: "#64748b" }}>No file</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

      {/* Create Coupon */}
      <Section
        id="sec-create-coupon"
        visible={activeTab === "setup"}
        title="Create Coupon (master)"
        extraRight={
          <button
            onClick={createCoupon}
            disabled={createCouponLoading}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: createCouponLoading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {createCouponLoading ? "Creating..." : "Create"}
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
            value={couponForm.title}
            onChange={(v) => setCouponField("title", v)}
            placeholder="e.g., Lucky E-Coupon"
          />
          <TextInput
            label="Campaign"
            value={couponForm.campaign}
            onChange={(v) => setCouponField("campaign", v)}
            placeholder="e.g., LDGR"
          />
          <TextInput
            label="Valid From"
            type="datetime-local"
            value={couponForm.valid_from}
            onChange={(v) => setCouponField("valid_from", v)}
          />
          <TextInput
            label="Valid To"
            type="datetime-local"
            value={couponForm.valid_to}
            onChange={(v) => setCouponField("valid_to", v)}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <TextInput
              label="Description"
              value={couponForm.description}
              onChange={(v) => setCouponField("description", v)}
              placeholder="Optional"
            />
          </div>
        </div>
      </Section>

      {/* Create E-Coupon Batch */}
      <Section
        id="sec-create-batch"
        visible={activeTab === "inventory"}
        title="Top‑up inventory (random codes)"
        extraRight={
          <button
            onClick={createBatch}
            disabled={createBatchLoading}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: createBatchLoading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {createBatchLoading ? "Creating..." : "Create Batch"}
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
            label="Coupon"
            value={batchForm.coupon_id}
            onChange={(v) => setBatchField("coupon_id", v)}
            options={[{ value: "", label: "Select..." }, ...couponOptions]}
          />
          <TextInput
            label="Prefix"
            value={batchForm.prefix}
            onChange={(v) => setBatchField("prefix", v)}
            placeholder="LDGR"
          />
          <TextInput
            label="Count"
            type="number"
            value={batchForm.count}
            onChange={(v) => setBatchField("count", v)}
            placeholder="500"
          />
          <Select
            label="Denomination"
            value={batchForm.denomination}
            onChange={(v) => setBatchField("denomination", v)}
            options={[
              { value: "50", label: "₹50" },
              { value: "150", label: "₹150" },
              { value: "750", label: "₹750" },
            ]}
          />
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Codes will be generated as {(batchForm.prefix || "LDGR")} + 7 random uppercase alphanumerics (e.g., {`${(batchForm.prefix || "LDGR")}X7K9A2B`}).
        </div>
      </Section>

      {/* Assign to Agency/Employee */}
      <Section
        id="sec-assign"
        visible={activeTab === "inventory"}
        title="Assign E-Coupons (Count-based)"
        extraRight={
          <button
            onClick={assignECoupons}
            disabled={assignLoading}
            style={{
              padding: "8px 12px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              cursor: assignLoading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {assignLoading ? "Assigning..." : "Assign"}
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
            label="Batch"
            value={assignForm.batch_id}
            onChange={(v) => setAssignField("batch_id", v)}
            options={[{ value: "", label: "Select..." }, ...batchOptions]}
          />
          <Select
            label="Assign To"
            value={assignForm.assignee_type}
            onChange={(v) => setAssignField("assignee_type", v)}
            options={[
              { value: "agency", label: "Agency" },
              { value: "employee", label: "Employee (Admin direct)" },
            ]}
          />
          {assignForm.assignee_type === "agency" ? (
            <Select
              label="Agency"
              value={assignForm.agency_id}
              onChange={(v) => setAssignField("agency_id", v)}
              options={[{ value: "", label: "Select..." }, ...agencyOptions]}
            />
          ) : (
            <Select
              label="Employee"
              value={assignForm.employee_id}
              onChange={(v) => setAssignField("employee_id", v)}
              options={[{ value: "", label: "Select..." }, ...employeeOptions]}
            />
          )}
          <TextInput
            label="Count"
            value={assignForm.count}
            onChange={(v) => setAssignField("count", v)}
            placeholder="e.g., 100"
            type="number"
          />
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Assigns the given number of unassigned random codes from the selected batch. Assigned codes will be unique and cannot be re-assigned by other agencies.
        </div>
      </Section>

      {/* Assignment History */}
      <Section
        id="sec-history"
        visible={activeTab === "inventory"}
        title="Assignment History"
        extraRight={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                height: 40,
              }}
            >
              {assignListLoading ? "Refreshing..." : "Refresh"}
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
            label="Role"
            value={assignFilters.role}
            onChange={(v) => {
              setAssignFilters((f) => ({ ...f, role: v, assignee_id: "" }));
              setAssignPage(1);
            }}
            options={[
              { value: "", label: "Any role" },
              { value: "agency", label: "Agency" },
              { value: "employee", label: "Employee" },
            ]}
          />
          {assignFilters.role === "employee" ? (
            <Select
              label="Employee"
              value={assignFilters.assignee_id}
              onChange={(v) => {
                setAssignFilters((f) => ({ ...f, assignee_id: v }));
                setAssignPage(1);
              }}
              options={[{ value: "", label: "Any" }, ...employeeOptions]}
            />
          ) : (
            <Select
              label="Agency"
              value={assignFilters.assignee_id}
              onChange={(v) => {
                setAssignFilters((f) => ({ ...f, assignee_id: v }));
                setAssignPage(1);
              }}
              options={[{ value: "", label: "Any" }, ...agencyOptions]}
            />
          )}
          <TextInput
            label="Search"
            value={assignFilters.search}
            onChange={(v) => setAssignFilters((f) => ({ ...f, search: v }))}
            placeholder="assignee/code/batch"
          />
          <TextInput
            label="From"
            type="datetime-local"
            value={assignFilters.from}
            onChange={(v) => setAssignFilters((f) => ({ ...f, from: v }))}
            placeholder="from"
          />
          <TextInput
            label="To"
            type="datetime-local"
            value={assignFilters.to}
            onChange={(v) => setAssignFilters((f) => ({ ...f, to: v }))}
            placeholder="to"
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setAssignPage(1);
              loadDashboard(false);
            }}
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
            Apply Filters
          </button>
          <button
            onClick={() => {
              setAssignFilters({ role: "", assignee_id: "", search: "", from: "", to: "" });
              setAssignPage(1);
            }}
            disabled={assignListLoading}
            style={{
              padding: "8px 12px",
              background: "#fff",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              cursor: assignListLoading ? "not-allowed" : "pointer",
            }}
          >
            Reset
          </button>
          <div style={{ color: "#64748b", marginLeft: "auto" }}>{assignTotal} records</div>
        </div>

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
                minWidth: 1000,
                display: "grid",
                gridTemplateColumns: "120px 1fr 180px 120px 120px 1fr 200px",
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
              <div>Range/Info</div>
              <div>Count</div>
              <div>Batch</div>
              <div>Assigned By</div>
              <div>Assigned At</div>
            </div>
            <div>
              {(assignments || []).map((a) => {
                const role = a.role || (a.agency_id ? "agency" : a.employee_id ? "employee" : "");
                const assignee =
                  a.assignee_name ||
                  (a.assignee && (a.assignee.username || a.assignee.name)) ||
                  a.agency_name ||
                  a.employee_name ||
                  (a.agency && (a.agency.username || a.agency.name)) ||
                  (a.employee && (a.employee.username || a.employee.name)) ||
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
                const by =
                  a.assigned_by_name ||
                  (a.assigned_by && (a.assigned_by.username || a.assigned_by.name)) ||
                  (typeof a.assigned_by === "string" ? a.assigned_by : "");
                const at = a.assigned_at || a.created_at || a.created || "";
                return (
                  <div
                    key={a.id || `${role}-${assignee}-${start}-${end}-${Math.random()}`}
                    style={{
                      minWidth: 1000,
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 180px 120px 120px 1fr 200px",
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
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{by || "—"}</div>
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

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setAssignPage((p) => Math.max(1, p - 1))}
            disabled={assignPage <= 1 || assignListLoading}
            style={{
              padding: "6px 10px",
              background: "#fff",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              cursor: assignPage <= 1 || assignListLoading ? "not-allowed" : "pointer",
            }}
          >
            Prev
          </button>
          <div style={{ color: "#64748b" }}>
            Page {assignPage} / {Math.max(1, Math.ceil(assignTotal / assignPageSize) || 1)}
          </div>
          <button
            onClick={() => {
              const maxPage = Math.max(1, Math.ceil(assignTotal / assignPageSize) || 1);
              setAssignPage((p) => Math.min(maxPage, p + 1));
            }}
            disabled={
              assignPage >= Math.max(1, Math.ceil(assignTotal / assignPageSize) || 1) || assignListLoading
            }
            style={{
              padding: "6px 10px",
              background: "#fff",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              cursor:
                assignPage >= Math.max(1, Math.ceil(assignTotal / assignPageSize) || 1) || assignListLoading
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Next
          </button>
        </div>
      </Section>

      {/* Metrics */}
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
              options={[{ value: "", label: "Select..." }, ...batchOptions]}
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
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Notes: Redemption counts are computed per selected batch using CouponCode status.
        </div>
      </Section>

      {/* Admin: Agency Assignment Summary */}
      <Section
        id="sec-agency-summary"
        visible={activeTab === "inventory"}
        title="Agency Assignment Summary"
        extraRight={
          <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
            <TextInput
              label="From"
              type="datetime-local"
              value={summaryFrom}
              onChange={setSummaryFrom}
              placeholder="from"
              style={{ minWidth: 220 }}
            />
            <TextInput
              label="To"
              type="datetime-local"
              value={summaryTo}
              onChange={setSummaryTo}
              placeholder="to"
              style={{ minWidth: 220 }}
            />
            <button
              onClick={loadAgencySummary}
              disabled={summaryLoading}
              style={{
                padding: "8px 12px",
                background: "#0f172a",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                cursor: summaryLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
                height: 40,
                alignSelf: "end",
              }}
            >
              {summaryLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        }
      >
        {summaryError ? <div style={{ color: "#dc2626", marginBottom: 10 }}>{summaryError}</div> : null}
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
                minWidth: 1200,
                display: "grid",
                gridTemplateColumns:
                  "180px 220px 120px 140px 140px 120px 120px 140px 120px 120px 120px",
                gap: 8,
                padding: "10px",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <div>Username</div>
              <div>Full Name</div>
              <div>Pincode</div>
              <div>City</div>
              <div>State</div>
              <div>Available</div>
              <div>Assigned</div>
              <div>Assigned Emp</div>
              <div>Sold</div>
              <div>Redeemed</div>
              <div>Total</div>
            </div>
            <div>
              {(summary || []).map((row, idx) => {
                const counts = row.counts || {};
                return (
                  <div
                    key={row.agency_id || idx}
                    style={{
                      minWidth: 1200,
                      display: "grid",
                      gridTemplateColumns:
                        "180px 220px 120px 140px 140px 120px 120px 140px 120px 120px 120px",
                      gap: 8,
                      padding: "10px",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.username || "—"}
                    </div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.full_name || "—"}
                    </div>
                    <div>{row.pincode || "—"}</div>
                    <div>{row.city || "—"}</div>
                    <div>{row.state || "—"}</div>
                    <div>{counts.AVAILABLE ?? 0}</div>
                    <div>{counts.ASSIGNED_AGENCY ?? 0}</div>
                    <div>{counts.ASSIGNED_EMPLOYEE ?? 0}</div>
                    <div>{counts.SOLD ?? 0}</div>
                    <div>{counts.REDEEMED ?? 0}</div>
                    <div>{row.total ?? 0}</div>
                  </div>
                );
              })}
              {!summaryLoading && (!summary || summary.length === 0) ? (
                <div style={{ padding: 12, color: "#64748b" }}>No data</div>
              ) : null}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
