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
    serial_start: "1",
    serial_end: "1000",
    serial_width: "6",
    denomination: "150",
  });
  const [createBatchLoading, setCreateBatchLoading] = useState(false);

  // Assign-to-Agency form
  const [assignForm, setAssignForm] = useState({
    batch_id: "",
    assignee_type: "agency",
    agency_id: "",
    employee_id: "",
    serial_start: "",
    serial_end: "",
    count: "",
  });
  const [assignLoading, setAssignLoading] = useState(false);
  const [nextStart, setNextStart] = useState("");
  const [nextStartLoading, setNextStartLoading] = useState(false);

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
        prefix: batchForm.prefix.trim() || "LDGR",
        serial_start: parseInt(batchForm.serial_start, 10),
        serial_end: parseInt(batchForm.serial_end, 10),
        serial_width: parseInt(batchForm.serial_width, 10),
        issued_channel: "e_coupon",
        value: parseInt(batchForm.denomination, 10),
      };
      if (!payload.serial_start || !payload.serial_end || payload.serial_start > payload.serial_end) {
        alert("Enter valid serial range");
        setCreateBatchLoading(false);
        return;
      }
      await API.post("/coupons/batches/", payload);
      await loadBatches();
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
      let serialStart = assignForm.serial_start ? parseInt(assignForm.serial_start, 10) : (nextStart ? parseInt(nextStart, 10) : NaN);
      let serialEnd = assignForm.serial_end ? parseInt(assignForm.serial_end, 10) : NaN;
      const count = assignForm.count ? parseInt(assignForm.count, 10) : NaN;
      if (!assignForm.serial_start && !assignForm.serial_end && !Number.isNaN(count) && !Number.isNaN(serialStart)) {
        serialEnd = serialStart + count - 1;
      }
      // Monotonic guardrails (avoid overlaps and invalid ranges)
      const ns = nextStart ? parseInt(nextStart, 10) : NaN;
      if (!Number.isNaN(count) && count <= 0) {
        alert("Count must be > 0");
        setAssignLoading(false);
        return;
      }
      if (!Number.isNaN(serialStart) && !Number.isNaN(serialEnd) && serialStart > serialEnd) {
        alert("Serial Start must be <= Serial End");
        setAssignLoading(false);
        return;
      }
      if (!Number.isNaN(ns)) {
        // If overrides are provided, ensure they don't start before the nextStart (sequential policy)
        if (assignForm.serial_start && serialStart < ns) {
          alert(`Serial Start must be \u2265 ${ns} to avoid overlapping previous assignments`);
          setAssignLoading(false);
          return;
        }
      }
      if (!isAgency) {
        if (Number.isNaN(count) || count <= 0) {
          alert("For employee assignment, enter a valid Count (>0).");
          setAssignLoading(false);
          return;
        }
      }
      let url, payload;
      if (isAgency) {
        payload = { agency_id: assigneeId };
        if (!Number.isNaN(serialStart) && !Number.isNaN(serialEnd)) {
          payload.serial_start = serialStart;
          payload.serial_end = serialEnd;
        }
        url = `/coupons/batches/${batchId}/assign-agency/`;
      } else {
        payload = { employee_id: assigneeId, count: count };
        url = `/coupons/batches/${batchId}/admin-assign-employee-count/`;
      }
      await API.post(url, payload);
      setSelectedBatch(String(batchId));
      setAssignPage(1);
      await Promise.all([loadBatches(), loadAssignments(), loadMetrics()]);
      loadNextStart();
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
          let start = null,
            end = null,
            count = null;
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
      // Request small page_size so DRF returns {"count": <N>, "results": [...]}
      const res = await API.get(url, { params: { page_size: 1, ...params } });
      const c = typeof res?.data?.count === "number" ? res.data.count : (Array.isArray(res?.data) ? res.data.length : 0);
      return c || 0;
    } catch {
      return 0;
    }
  }

  async function loadNextStart() {
    const bid = assignForm.batch_id ? parseInt(assignForm.batch_id, 10) : null;
    if (!bid) {
      setNextStart("");
      return;
    }
    setNextStartLoading(true);
    try {
      const role = assignForm.assignee_type === "employee" ? "employee" : "agency";
      const res = await API.get(`/coupons/batches/${bid}/next-start/`, {
        params: { scope: "global", role },
      });
      const n = res?.data?.next_start;
      setNextStart(typeof n === "number" ? String(n) : "");
    } catch (_) {
      setNextStart("");
    } finally {
      setNextStartLoading(false);
    }
  }

  async function loadMetrics() {
    setMetricsLoading(true);
    try {
      const bid = selectedBatch ? parseInt(selectedBatch, 10) : null;

      const [
        available,
        assigned_agency,
        assigned_employee,
        sold,
        redeemed,
        revoked,
      ] = await Promise.all([
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

  useEffect(() => {
    loadCoupons();
    loadBatches();
    loadAgencies();
    loadEmployees();
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [selectedBatch]);

  useEffect(() => {
    loadNextStart();
  }, [assignForm.batch_id, assignForm.assignee_type]);

  useEffect(() => {
    loadAssignments();
  }, [assignPage, assignPageSize, assignFilters]);

  useEffect(() => {
    loadAssignments();
  }, [selectedBatch]);

  const couponOptions = useMemo(
    () => coupons.map((c) => ({ value: String(c.id), label: `${c.title} (id:${c.id})` })),
    [coupons]
  );
  const batchOptions = useMemo(
    () =>
      batches.map((b) => ({
        value: String(b.id),
        label: `#${b.id} ${b.prefix}${String(b.serial_start).padStart(b.serial_width, "0")} - ${b.prefix}${String(b.serial_end).padStart(b.serial_width, "0")}`,
      })),
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>E-Coupons</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Create e-coupon batches with codes like LDGR + SEQ number, assign to agencies, and view redemption metrics.
        </div>
      </div>

      {err ? <div style={{ color: "#dc2626", marginBottom: 12 }}>{err}</div> : null}

      {/* Create Coupon */}
      <Section
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
        title="Create E-Coupon Batch (LDGR + SEQ)"
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
            label="Serial Start"
            value={batchForm.serial_start}
            onChange={(v) => setBatchField("serial_start", v)}
            placeholder="1"
          />
          <TextInput
            label="Serial End"
            value={batchForm.serial_end}
            onChange={(v) => setBatchField("serial_end", v)}
            placeholder="1000"
          />
          <TextInput
            label="Serial Width"
            value={batchForm.serial_width}
            onChange={(v) => setBatchField("serial_width", v)}
            placeholder="6"
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
          Example with prefix={batchForm.prefix || "LDGR"} and width={batchForm.serial_width || 6}:{" "}
          {(batchForm.prefix || "LDGR") + String(batchForm.serial_start || 1).padStart(parseInt(batchForm.serial_width || "6", 10), "0")}
        </div>
      </Section>

      {/* Assign to Agency */}
      <Section
        title="Assign E-Coupons"
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
            label={`Next Start (auto)${nextStartLoading ? " • loading…" : ""}`}
            value={nextStart}
            onChange={() => {}}
            placeholder="—"
            style={{ background: "#f8fafc" }}
          />
          <TextInput
            label="Count (optional)"
            value={assignForm.count}
            onChange={(v) => setAssignField("count", v)}
            placeholder="e.g., 100"
            type="number"
          />
          <TextInput
            label="Serial Start (optional override)"
            value={assignForm.serial_start}
            onChange={(v) => setAssignField("serial_start", v)}
            placeholder="Override start"
          />
          <TextInput
            label="Serial End (optional override)"
            value={assignForm.serial_end}
            onChange={(v) => setAssignField("serial_end", v)}
            placeholder="Override end"
          />
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Leave Count empty to assign a custom range (Serial Start/End). Leave all fields empty to assign all AVAILABLE codes in the batch.
          If Count is set and overrides are empty, the assigned range will start from “Next Start” and continue sequentially.
        </div>
      </Section>

      {/* Assignment History */}
      <Section
        title="Assignment History"
        extraRight={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => loadAssignments()}
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
              loadAssignments();
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
          <div style={{ color: "#64748b", marginLeft: "auto" }}>
            {assignTotal} records
          </div>
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
              <div>Range</div>
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
                const count = a.count ?? (typeof start === "number" && typeof end === "number" ? end - start + 1 : "");
                const batch = a.batch_display || (a.batch && `#${a.batch.id}`) || (a.batch_id ? `#${a.batch_id}` : "");
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
                    <div>{(start ?? "—")} - {(end ?? "—")}</div>
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
            disabled={assignPage >= Math.max(1, Math.ceil(assignTotal / assignPageSize) || 1) || assignListLoading}
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
        title="Redemption Summary"
        extraRight={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Select
              label="Batch"
              value={selectedBatch}
              onChange={setSelectedBatch}
              options={[{ value: "", label: "Select..." }, ...batchOptions]}
            />
            <button
              onClick={loadMetrics}
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
