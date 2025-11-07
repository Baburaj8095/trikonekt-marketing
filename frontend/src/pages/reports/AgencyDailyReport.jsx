import React, { useEffect, useState } from "react";
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
  MenuItem,
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
              sx={{ mb: 2 }}
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
                value={myFrom}
                onChange={(e) => setMyFrom(e.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={myTo}
                onChange={(e) => setMyTo(e.target.value)}
              />
              <Button variant="outlined" onClick={loadMyReports}>Filter</Button>
            </Stack>

            {myLoading ? (
              <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={18} /> <Typography variant="body2">Loading…</Typography>
              </Box>
            ) : myError ? (
              <Alert severity="error">{myError}</Alert>
            ) : (
              <Table size="small">
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
                  {(myRows || []).map((r) => (
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
                  {(!myRows || myRows.length === 0) && (
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
            )}
          </Paper>
        </Grid>

        {/* Team Reports (Agency scope) */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2 }}
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
                value={teamFrom}
                onChange={(e) => setTeamFrom(e.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={teamTo}
                onChange={(e) => setTeamTo(e.target.value)}
              />
              <TextField
                select
                size="small"
                label="Role"
                value={teamRole}
                onChange={(e) => setTeamRole(e.target.value)}
                sx={{ minWidth: 160 }}
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
                sx={{ minWidth: 200 }}
              />
              <Button variant="outlined" onClick={loadTeamReports}>Filter</Button>
              <Button variant="contained" onClick={downloadCSV}>Download CSV</Button>
            </Stack>

            {teamLoading ? (
              <Box sx={{ py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={18} /> <Typography variant="body2">Loading…</Typography>
              </Box>
            ) : teamError ? (
              <Alert severity="error">{teamError}</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Reporter</TableCell>
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
                  {(teamRows || []).map((r) => (
                    <TableRow key={`${r.id}-${r.date}`}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.reporter}</TableCell>
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
                  {(!teamRows || teamRows.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={11}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          No team reports found for the selected filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
