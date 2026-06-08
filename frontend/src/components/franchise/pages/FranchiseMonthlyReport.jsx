import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import API from "../../../api/api";

const REPORT_FIELDS = [
  { key: "consumer_subscription_750_count", label: "Consumer Subscription 750 Count" },
  { key: "prime_subscription_8250_count", label: "Prime Subscription 8250 Count" },
  { key: "smart_purchase_plan_1000_count", label: "Smart Purchase Plan 1000 Count" },
  { key: "franchise_reference_count", label: "Franchise Reference Count" },
  { key: "captain_business_connect_reference_count", label: "Captain Business Connect Reference Count" },
  { key: "tri_trip_reference_count", label: "Tri Trip Reference Count" },
  { key: "organized_meeting_count", label: "Organized Meeting Count" },
];

const COLORS = {
  page: "#f7f9ff",
  text: "#14213d",
  muted: "#64748b",
  border: "#e2e8f0",
  blue: "#2563eb",
  green: "#16a34a",
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function splitMonth(value) {
  const [year, month] = String(value || currentMonthValue()).split("-");
  return { year: Number(year), month: Number(month) };
}

function statusTone(status) {
  const value = String(status || "PENDING").toUpperCase();
  if (value === "APPROVED") return { bg: "#dcfce7", fg: "#166534" };
  if (value === "REJECTED") return { bg: "#fee2e2", fg: "#991b1b" };
  return { bg: "#fef3c7", fg: "#92400e" };
}

function formatPeriod(row) {
  if (!row) return "-";
  return `${String(row.month).padStart(2, "0")}/${row.year}`;
}

function getApiError(error) {
  const data = error?.response?.data;
  if (!data) return "Something went wrong. Please try again.";
  if (typeof data === "string") return data;
  if (data.detail) return String(data.detail);
  const key = Object.keys(data)[0];
  const value = key ? data[key] : null;
  if (Array.isArray(value)) return value.join(", ");
  return value ? String(value) : JSON.stringify(data);
}

const blankForm = REPORT_FIELDS.reduce((acc, field) => {
  acc[field.key] = "";
  return acc;
}, {});

export default function FranchiseMonthlyReport() {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [form, setForm] = useState(blankForm);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const totalCount = useMemo(
    () => REPORT_FIELDS.reduce((sum, field) => sum + Number(form[field.key] || 0), 0),
    [form]
  );

  const hydrateForm = (report) => {
    const next = { ...blankForm };
    REPORT_FIELDS.forEach((field) => {
      next[field.key] = report ? String(report[field.key] || 0) : "";
    });
    setForm(next);
    setNote(report?.note || "");
  };

  const loadReport = async (selectedMonth = monthValue) => {
    const { year, month } = splitMonth(selectedMonth);
    try {
      setError("");
      setLoading(true);
      const res = await API.get("/accounts/franchise/monthly-work-report/", {
        params: { year, month },
        dedupe: "cancelPrevious",
      });
      const data = res?.data || {};
      setCurrentReport(data.report || null);
      setHistory(data.history || []);
      hydrateForm(data.report || null);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleMonthChange = (value) => {
    setMonthValue(value);
    loadReport(value);
  };

  const submitReport = async () => {
    const { year, month } = splitMonth(monthValue);
    const payload = { year, month, note };
    REPORT_FIELDS.forEach((field) => {
      payload[field.key] = Number(form[field.key] || 0);
    });

    try {
      setError("");
      setSuccess("");
      setSubmitting(true);
      const res = await API.post("/accounts/franchise/monthly-work-report/", payload);
      setSuccess(res?.data?.detail || "Monthly report submitted for admin approval.");
      await loadReport(monthValue);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const currentTone = statusTone(currentReport?.status);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.page, py: { xs: 1.5, md: 3 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ color: COLORS.text, fontWeight: 950, fontSize: { xs: "1.35rem", md: "1.9rem" } }}>
              Monthly Report
            </Typography>
            <Typography sx={{ color: COLORS.muted, fontWeight: 600, fontSize: { xs: "0.82rem", md: "0.95rem" } }}>
              Submit your monthly franchise work report for admin approval. Approval enables Active Work Wallet Pay.
            </Typography>
          </Box>

          {loading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: "100%", borderRadius: 3, border: `1px solid ${COLORS.border}`, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.07)" }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.3} alignItems="center">
                      <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "#dbeafe", color: COLORS.blue }}>
                        <EventRoundedIcon />
                      </Box>
                      <Box>
                        <Typography sx={{ color: COLORS.muted, fontWeight: 800, fontSize: "0.78rem" }}>
                          Month Selection
                        </Typography>
                        <Typography sx={{ color: COLORS.text, fontWeight: 950, fontSize: "1.25rem" }}>
                          {monthValue}
                        </Typography>
                      </Box>
                    </Stack>
                    <TextField
                      label="Select Month"
                      type="month"
                      value={monthValue}
                      onChange={(e) => handleMonthChange(e.target.value)}
                      fullWidth
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ color: COLORS.muted, fontWeight: 800 }}>Status</Typography>
                      <Chip
                        label={currentReport?.status || "NOT SUBMITTED"}
                        sx={{
                          bgcolor: currentReport ? currentTone.bg : "#e2e8f0",
                          color: currentReport ? currentTone.fg : "#334155",
                          fontWeight: 900,
                        }}
                      />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ color: COLORS.muted, fontWeight: 800 }}>Total Count</Typography>
                      <Typography sx={{ color: COLORS.green, fontWeight: 950, fontSize: "1.25rem" }}>{totalCount}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card sx={{ borderRadius: 3, border: `1px solid ${COLORS.border}`, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.07)" }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AssignmentTurnedInRoundedIcon sx={{ color: COLORS.blue }} />
                      <Box>
                        <Typography sx={{ color: COLORS.text, fontWeight: 950, fontSize: "1.05rem" }}>
                          Monthly Reporting Table
                        </Typography>
                        <Typography sx={{ color: COLORS.muted, fontWeight: 600, fontSize: "0.82rem" }}>
                          Enter count values for the selected month.
                        </Typography>
                      </Box>
                    </Stack>

                    <Grid container spacing={1.4}>
                      {REPORT_FIELDS.map((field) => (
                        <Grid item xs={12} sm={6} key={field.key}>
                          <TextField
                            label={field.label}
                            type="number"
                            value={form[field.key]}
                            onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                            inputProps={{ min: 0, step: 1 }}
                            fullWidth
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }}
                          />
                        </Grid>
                      ))}
                      <Grid item xs={12}>
                        <TextField
                          label="Note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          fullWidth
                          multiline
                          minRows={2}
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }}
                        />
                      </Grid>
                    </Grid>

                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1}>
                      <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.82rem" }}>
                        Submitting will set this month to Pending until admin approves it.
                      </Typography>
                      <Button
                        onClick={submitReport}
                        disabled={submitting}
                        sx={{
                          minWidth: 190,
                          borderRadius: 2,
                          py: 1,
                          bgcolor: COLORS.blue,
                          color: "#fff",
                          textTransform: "none",
                          fontWeight: 900,
                          "&:hover": { bgcolor: "#1d4ed8" },
                        }}
                      >
                        {submitting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Submit Report"}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ borderRadius: 3, border: `1px solid ${COLORS.border}`, boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)" }}>
            <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ReceiptLongRoundedIcon sx={{ color: COLORS.blue }} />
                  <Typography sx={{ color: COLORS.text, fontWeight: 950, fontSize: "1.05rem" }}>
                    Submitted Reports
                  </Typography>
                </Stack>
                {history.length ? (
                  <Stack spacing={1}>
                    {history.map((row) => {
                      const tone = statusTone(row.status);
                      const rowTotal = REPORT_FIELDS.reduce((sum, field) => sum + Number(row[field.key] || 0), 0);
                      return (
                        <Card key={row.id} sx={{ borderRadius: 2, border: `1px solid ${COLORS.border}`, boxShadow: "none" }}>
                          <CardContent sx={{ p: { xs: 1.3, md: 1.6 } }}>
                            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                              <Box>
                                <Typography sx={{ color: COLORS.text, fontWeight: 950 }}>
                                  {formatPeriod(row)} - Total {rowTotal}
                                </Typography>
                                <Typography sx={{ color: COLORS.muted, fontWeight: 700, fontSize: "0.78rem" }}>
                                  750: {row.consumer_subscription_750_count} | 8250: {row.prime_subscription_8250_count} | SPP: {row.smart_purchase_plan_1000_count} | Meetings: {row.organized_meeting_count}
                                </Typography>
                              </Box>
                              <Chip label={row.status} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, bgcolor: tone.bg, color: tone.fg, fontWeight: 900 }} />
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ py: 5, textAlign: "center", border: `1px dashed ${COLORS.border}`, borderRadius: 2 }}>
                    <Typography sx={{ color: COLORS.text, fontWeight: 900 }}>No monthly reports submitted yet</Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
