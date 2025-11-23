import React, { useEffect, useMemo, useState } from "react";
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

export default function EmployeeDailyReport() {
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState({ type: "", text: "" });

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

  // History
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadMyReports = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const params = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await API.get("/v1/reports/my-reports/", { params });
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRows(data || []);
    } catch (e) {
      setLoadError("Failed to load your reports.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyReports();
  }, []);

  // DataGrid columns and server fetcher
  const columns = useMemo(
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

  const fetcher = React.useCallback(
    async ({ page, pageSize }) => {
      const params = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
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
    [dateFrom, dateTo, reloadKey]
  );

  return (
    <Container maxWidth="lg" sx={{ px: 0 }}>
      <Grid container spacing={2}>
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
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", sm: "auto" } }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              <Button variant="outlined" onClick={() => setReloadKey((k) => k + 1)} sx={{ width: { xs: "100%", sm: "auto" } }}>Filter</Button>
            </Stack>

            <DataTable
              key={reloadKey}
              columns={columns}
              fetcher={fetcher}
              density="standard"
              checkboxSelection={false}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
