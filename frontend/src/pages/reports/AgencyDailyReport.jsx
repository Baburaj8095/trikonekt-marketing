import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  MenuItem,
  Stack,
} from "@mui/material";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";

function intOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function moneyOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function AgencyDailyReport() {
  // Submit (one per day upsert)
  const [form, setForm] = useState({
    tr_registered: "",
    wg_registered: "",
    asia_pay_registered: "",
    dm_account_registered: "",
    e_coupon_issued: "",
    physical_coupon_issued: "",
    product_sold: "",
    total_amount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState({ type: "", text: "" });

  const handleChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const doSubmit = async () => {
    setSubmitMsg({ type: "", text: "" });
    try {
      setSubmitting(true);
      const payload = {
        tr_registered: intOrZero(form.tr_registered),
        wg_registered: intOrZero(form.wg_registered),
        asia_pay_registered: intOrZero(form.asia_pay_registered),
        dm_account_registered: intOrZero(form.dm_account_registered),
        e_coupon_issued: intOrZero(form.e_coupon_issued),
        physical_coupon_issued: intOrZero(form.physical_coupon_issued),
        product_sold: intOrZero(form.product_sold),
        total_amount: moneyOrZero(form.total_amount),
      };
      await API.post("/v1/reports/submit/", payload);
      setSubmitMsg({ type: "success", text: "Daily report submitted." });
      await loadMyReports();
    } catch (e) {
      const err = e?.response?.data;
      setSubmitMsg({
        type: "error",
        text:
          (typeof err === "string" && err) ||
          err?.detail ||
          "Failed to submit daily report.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // My Reports (Agency's own)
  const [myFrom, setMyFrom] = useState("");
  const [myTo, setMyTo] = useState("");
  const [myRows, setMyRows] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState("");
  const [myReloadKey, setMyReloadKey] = useState(0);

  const loadMyReports = async () => {
    try {
      setMyLoading(true);
      setMyError("");
      const params = {};
      if (myFrom) params.from = myFrom;
      if (myTo) params.to = myTo;
      const res = await API.get("/v1/reports/my-reports/", { params });
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setMyRows(data || []);
    } catch (e) {
      setMyError("Failed to load your reports.");
      setMyRows([]);
    } finally {
      setMyLoading(false);
    }
  };

  // Team Reports (Agency scope)
  const [teamFrom, setTeamFrom] = useState("");
  const [teamTo, setTeamTo] = useState("");
  const [teamRole, setTeamRole] = useState(""); // EMPLOYEE | SUBFRANCHISE | "" (all)
  const [teamReporter, setTeamReporter] = useState(""); // optional reporter id filter
  const [teamRows, setTeamRows] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamReloadKey, setTeamReloadKey] = useState(0);

  const loadTeamReports = async () => {
    try {
      setTeamLoading(true);
      setTeamError("");
      const params = {};
      if (teamFrom) params.from = teamFrom;
      if (teamTo) params.to = teamTo;
      if (teamRole) params.role = teamRole;
      if (teamReporter) params.reporter = teamReporter;
      const res = await API.get("/v1/reports/all/", { params });
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setTeamRows(data || []);
    } catch (e) {
      const err = e?.response?.data;
      setTeamError(
        (typeof err === "string" && err) ||
          err?.detail ||
          "Failed to load team reports."
      );
      setTeamRows([]);
    } finally {
      setTeamLoading(false);
    }
  };

  const downloadCSV = () => {
    const q = new URLSearchParams();
    if (teamFrom) q.set("from", teamFrom);
    if (teamTo) q.set("to", teamTo);
    if (teamRole) q.set("role", teamRole);
    if (teamReporter) q.set("reporter", teamReporter);
    q.set("format", "csv");
    const url = `/api/v1/reports/all/?${q.toString()}`;
    window.open(url, "_blank", "noopener");
  };

  useEffect(() => {
    loadMyReports();
  }, []);

  // DataGrid columns and server fetchers
  const myColumns = useMemo(
    () => [
      { field: "date", headerName: "Date", minWidth: 140 },
      { field: "role", headerName: "Role", minWidth: 120 },
      { field: "tr_registered", headerName: "TR", minWidth: 80 },
      { field: "wg_registered", headerName: "WG", minWidth: 80 },
      { field: "asia_pay_registered", headerName: "Asia Pay", minWidth: 110 },
      { field: "dm_account_registered", headerName: "DM Acc", minWidth: 110 },
      { field: "e_coupon_issued", headerName: "E‑Coupon", minWidth: 110 },
      { field: "physical_coupon_issued", headerName: "Physical", minWidth: 110 },
      { field: "product_sold", headerName: "Products", minWidth: 110 },
      { field: "total_amount", headerName: "Total Amount", minWidth: 140 },
    ],
    []
  );

  const myFetcher = React.useCallback(
    async ({ page, pageSize }) => {
      const params = {};
      if (myFrom) params.from = myFrom;
      if (myTo) params.to = myTo;
      const res = await API.get("/v1/reports/my-reports/", { params });
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      const count =
        typeof res.data?.count === "number" ? res.data.count : data.length;

      // If backend isn't paginated, slice locally
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const results = Array.isArray(res.data?.results)
        ? data
        : data.slice(start, end);

      return { results, count };
    },
    [myFrom, myTo, myReloadKey]
  );

  const teamColumns = useMemo(
    () => [
      { field: "date", headerName: "Date", minWidth: 140 },
      { field: "reporter", headerName: "Reporter", minWidth: 160, flex: 1 },
      { field: "role", headerName: "Role", minWidth: 140 },
      { field: "tr_registered", headerName: "TR", minWidth: 80 },
      { field: "wg_registered", headerName: "WG", minWidth: 80 },
      { field: "asia_pay_registered", headerName: "Asia Pay", minWidth: 110 },
      { field: "dm_account_registered", headerName: "DM Acc", minWidth: 110 },
      { field: "e_coupon_issued", headerName: "E‑Coupon", minWidth: 110 },
      { field: "physical_coupon_issued", headerName: "Physical", minWidth: 110 },
      { field: "product_sold", headerName: "Products", minWidth: 110 },
      { field: "total_amount", headerName: "Total Amount", minWidth: 140 },
    ],
    []
  );

  const teamFetcher = React.useCallback(
    async ({ page, pageSize }) => {
      const params = {};
      if (teamFrom) params.from = teamFrom;
      if (teamTo) params.to = teamTo;
      if (teamRole) params.role = teamRole;
      if (teamReporter) params.reporter = teamReporter;
      const res = await API.get("/v1/reports/all/", { params });
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.results)
        ? res.data.results
        : [];
      const count =
        typeof res.data?.count === "number" ? res.data.count : data.length;

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const results = Array.isArray(res.data?.results)
        ? data
        : data.slice(start, end);

      return { results, count };
    },
    [teamFrom, teamTo, teamRole, teamReporter, teamReloadKey]
  );

  return (
    <Container maxWidth="lg" sx={{ px: 0 }}>
      <Grid container spacing={2}>
        {/* Submit (Agency/Sub-Franchise) */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
              Submit Daily Report
            </Typography>

            {submitMsg.text ? (
              <Alert sx={{ mb: 2 }} severity={submitMsg.type === "success" ? "success" : "error"}>
                {submitMsg.text}
              </Alert>
            ) : null}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  size="small"
                  label="TR Registered"
                  value={form.tr_registered}
                  onChange={handleChange("tr_registered")}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  size="small"
                  label="WG Registered"
                  value={form.wg_registered}
                  onChange={handleChange("wg_registered")}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  size="small"
                  label="Asia Pay Registered"
                  value={form.asia_pay_registered}
                  onChange={handleChange("asia_pay_registered")}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  size="small"
                  label="DM Account Registered"
                  value={form.dm_account_registered}
                  onChange={handleChange("dm_account_registered")}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  size="small"
                  label="E‑Coupon Issued"
                  value={form.e_coupon_issued}
                  onChange={handleChange("e_coupon_issued")}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  size="small"
                  label="Physical Coupon Issued"
                  value={form.physical_coupon_issued}
                  onChange={handleChange("physical_coupon_issued")}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  size="small"
                  label="Products Sold"
                  value={form.product_sold}
                  onChange={handleChange("product_sold")}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  size="small"
                  label="Total Amount (₹)"
                  value={form.total_amount}
                  onChange={handleChange("total_amount")}
                  inputProps={{ inputMode: "decimal" }}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={doSubmit}
                  disabled={submitting}
                  sx={{ minWidth: 160 }}
                >
                  {submitting ? "Submitting..." : "Submit Report"}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* My Reports */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2, flexWrap: "wrap" }}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", flexGrow: 1 }}>
                My Reports
              </Typography>
              <TextField
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", sm: "auto" } }}
                value={myFrom}
                onChange={(e) => setMyFrom(e.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", sm: "auto" } }}
                value={myTo}
                onChange={(e) => setMyTo(e.target.value)}
              />
              <Button variant="outlined" onClick={() => setMyReloadKey((k) => k + 1)} sx={{ width: { xs: "100%", sm: "auto" } }}>Filter</Button>
            </Stack>

            <DataTable
              key={myReloadKey}
              columns={myColumns}
              fetcher={myFetcher}
              density="standard"
              checkboxSelection={false}
            />
          </Paper>
        </Grid>

        {/* Team Reports (Agency scope) */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2, flexWrap: "wrap" }}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", flexGrow: 1 }}>
                Team Reports
              </Typography>
              <TextField
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", sm: "auto" } }}
                value={teamFrom}
                onChange={(e) => setTeamFrom(e.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", sm: "auto" } }}
                value={teamTo}
                onChange={(e) => setTeamTo(e.target.value)}
              />
              <TextField
                select
                size="small"
                label="Role"
                value={teamRole}
                onChange={(e) => setTeamRole(e.target.value)}
                sx={{ width: { xs: "100%", sm: "auto" }, minWidth: { sm: 160 } }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="EMPLOYEE">Employee</MenuItem>
                <MenuItem value="SUBFRANCHISE">Sub‑Franchise</MenuItem>
              </TextField>
              <TextField
                size="small"
                label="Reporter ID (optional)"
                value={teamReporter}
                onChange={(e) => setTeamReporter(e.target.value)}
                sx={{ width: { xs: "100%", sm: "auto" }, minWidth: { sm: 200 } }}
              />
              <Button variant="outlined" onClick={() => setTeamReloadKey((k) => k + 1)} sx={{ width: { xs: "100%", sm: "auto" } }}>Filter</Button>
              <Button variant="contained" onClick={downloadCSV} sx={{ width: { xs: "100%", sm: "auto" } }}>Download CSV</Button>
            </Stack>

            <DataTable
              key={teamReloadKey}
              columns={teamColumns}
              fetcher={teamFetcher}
              density="standard"
              checkboxSelection={false}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
