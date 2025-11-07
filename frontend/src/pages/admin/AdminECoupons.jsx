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

  // Create Coupon form
  const [couponForm, setCouponForm] = useState({
    title: "Lucky E-Coupon",
    description: "",
    campaign: "E-LDGR",
    valid_from: "",
    valid_to: "",
  });
  const [createCouponLoading, setCreateCouponLoading] = useState(false);

  // Create Batch form (E-Coupon)
  const [batchForm, setBatchForm] = useState({
    coupon_id: "",
    prefix: "E-LDGR",
    serial_start: "1",
    serial_end: "1000",
    serial_width: "6",
  });
  const [createBatchLoading, setCreateBatchLoading] = useState(false);

  // Assign-to-Agency form
  const [assignForm, setAssignForm] = useState({
    batch_id: "",
    agency_id: "",
    serial_start: "",
    serial_end: "",
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
    matrix_five_users: 0,
    matrix_three_150_users: 0,
    matrix_three_50_users: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [err, setErr] = useState("");

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
        code: (couponForm.campaign || couponForm.title || "E-LDGR").trim(),
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
        prefix: batchForm.prefix.trim() || "E-LDGR",
        serial_start: parseInt(batchForm.serial_start, 10),
        serial_end: parseInt(batchForm.serial_end, 10),
        serial_width: parseInt(batchForm.serial_width, 10),
        issued_channel: "e_coupon",
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

  async function assignToAgency() {
    setAssignLoading(true);
    setErr("");
    try {
      if (!assignForm.batch_id || !assignForm.agency_id) {
        alert("Select batch and agency");
        setAssignLoading(false);
        return;
      }
      const id = parseInt(assignForm.batch_id, 10);
      const payload = { agency_id: parseInt(assignForm.agency_id, 10) };
      if (assignForm.serial_start && assignForm.serial_end) {
        payload.serial_start = parseInt(assignForm.serial_start, 10);
        payload.serial_end = parseInt(assignForm.serial_end, 10);
      }
      await API.post(`/coupons/batches/${id}/assign-agency/`, payload);
      await loadBatches();
      alert("Assigned to agency");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to assign to agency");
    } finally {
      setAssignLoading(false);
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
        // matrix users per pool
        five_users,
        three150_users,
        three50_users,
      ] = await Promise.all([
        bid ? fetchCount("/coupons/codes/", { batch: bid, status: "AVAILABLE" }) : 0,
        bid ? fetchCount("/coupons/codes/", { batch: bid, status: "ASSIGNED_AGENCY" }) : 0,
        bid ? fetchCount("/coupons/codes/", { batch: bid, status: "ASSIGNED_EMPLOYEE" }) : 0,
        bid ? fetchCount("/coupons/codes/", { batch: bid, status: "SOLD" }) : 0,
        bid ? fetchCount("/coupons/codes/", { batch: bid, status: "REDEEMED" }) : 0,
        bid ? fetchCount("/coupons/codes/", { batch: bid, status: "REVOKED" }) : 0,
        fetchCount("/admin/matrix/progress/", { pool: "FIVE_150" }),
        fetchCount("/admin/matrix/progress/", { pool: "THREE_150" }),
        fetchCount("/admin/matrix/progress/", { pool: "THREE_50" }),
      ]);

      setMetrics({
        available,
        assigned_agency,
        assigned_employee,
        sold,
        redeemed,
        revoked,
        matrix_five_users: five_users,
        matrix_three_150_users: three150_users,
        matrix_three_50_users: three50_users,
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
  }, []);

  useEffect(() => {
    loadMetrics();
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#0f172a" }}>E-Coupons</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Create e-coupon batches with codes like E-LDGR + SEQ number, assign to agencies, and view redemption/activation metrics.
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
            placeholder="e.g., E-LDGR"
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
        title="Create E-Coupon Batch (E-LDGR + SEQ)"
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
            placeholder="E-LDGR"
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
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Example with prefix={batchForm.prefix || "E-LDGR"} and width={batchForm.serial_width || 6}:{" "}
          {(batchForm.prefix || "E-LDGR") + String(batchForm.serial_start || 1).padStart(parseInt(batchForm.serial_width || "6", 10), "0")}
        </div>
      </Section>

      {/* Assign to Agency */}
      <Section
        title="Assign E-Coupons to Agency"
        extraRight={
          <button
            onClick={assignToAgency}
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
            label="Agency"
            value={assignForm.agency_id}
            onChange={(v) => setAssignField("agency_id", v)}
            options={[{ value: "", label: "Select..." }, ...agencyOptions]}
          />
          <TextInput
            label="Serial Start (optional)"
            value={assignForm.serial_start}
            onChange={(v) => setAssignField("serial_start", v)}
            placeholder="Range start"
          />
          <TextInput
            label="Serial End (optional)"
            value={assignForm.serial_end}
            onChange={(v) => setAssignField("serial_end", v)}
            placeholder="Range end"
          />
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Leave Serial Start/End empty to assign all currently AVAILABLE codes in the batch to the selected agency.
        </div>
      </Section>

      {/* Metrics */}
      <Section
        title="Redemption & Activation Summary"
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
        <div style={{ height: 12 }} />
        <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Activation (Users with pool progress)</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard label="5-Matrix (FIVE_150) Users" value={metrics.matrix_five_users} />
          <MetricCard label="3-Matrix (THREE_150) Users" value={metrics.matrix_three_150_users} />
          <MetricCard label="3-Matrix (THREE_50) Users" value={metrics.matrix_three_50_users} />
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
          Notes: Redemption counts are computed per selected batch using CouponCode status. Activation counts are overall users with matrix
          progress in the respective pools.
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
