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
              <Button variant="outlined" onClick={loadMyReports} sx={{ width: { xs: "100%", sm: "auto" } }}>Filter</Button>
            </Stack>

            {loading ? (
              <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={18} /> <Typography variant="body2">Loading…</Typography>
              </Box>
            ) : loadError ? (
              <Alert severity="error">{loadError}</Alert>
            ) : (
              <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>TR</TableCell>
                    <TableCell>WG</TableCell>
                    <TableCell>Asia Pay</TableCell>
                    <TableCell>DM Acc</TableCell>
                    <TableCell>E‑Coupon</TableCell>
                    <TableCell>Physical</TableCell>
                    <TableCell>Products</TableCell>
                    <TableCell>Total Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(rows || []).map((r) => (
                    <TableRow key={`${r.id}-${r.date}`}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.role}</TableCell>
                      <TableCell>{r.tr_registered}</TableCell>
                      <TableCell>{r.wg_registered}</TableCell>
                      <TableCell>{r.asia_pay_registered}</TableCell>
                      <TableCell>{r.dm_account_registered}</TableCell>
                      <TableCell>{r.e_coupon_issued}</TableCell>
                      <TableCell>{r.physical_coupon_issued}</TableCell>
                      <TableCell>{r.product_sold}</TableCell>
                      <TableCell>₹{r.total_amount}</TableCell>
                    </TableRow>
                  ))}
                  {(!rows || rows.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          No reports found for the selected range.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
