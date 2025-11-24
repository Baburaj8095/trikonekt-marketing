import React, { useCallback, useMemo, useState } from "react";
import {
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";

export default function AdminReports() {
  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [role, setRole] = useState("ALL"); // EMPLOYEE | SUBFRANCHISE | ALL
  const [reporter, setReporter] = useState(""); // optional numeric user id
  const [reloadKey, setReloadKey] = useState(0);

  const [errorMsg, setErrorMsg] = useState("");

  const columns = useMemo(
    () => [
      { field: "date", headerName: "Date", minWidth: 140 },
      { field: "role", headerName: "Role", minWidth: 140 },
      { field: "reporter", headerName: "Reporter (ID)", minWidth: 160 },
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

  const makeParams = () => {
    const params = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (role === "EMPLOYEE" || role === "SUBFRANCHISE") params.role = role;
    if (reporter && /^\d+$/.test(String(reporter))) params.reporter = String(reporter);
    return params;
    };

  // Server fetcher for DataTable (backend is not paginated; slice locally)
  const fetcher = useCallback(
    async ({ page, pageSize }) => {
      setErrorMsg("");
      const params = makeParams();
      const res = await API.get("/v1/reports/all/", { params, dedupe: "cancelPrevious" });
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
    [dateFrom, dateTo, role, reporter, reloadKey]
  );

  const handleExportCsv = async () => {
    setErrorMsg("");
    try {
      const params = { ...makeParams(), format: "csv" };
      const resp = await API.get("/v1/reports/all/", {
        params,
        responseType: "blob",
        timeout: 30000,
      });
      const blob = new Blob([resp.data], { type: "text/csv;charset=utf-8" });
      // Try to extract filename from Content-Disposition
      let filename = "daily_reports.csv";
      const dispo = resp?.headers?.["content-disposition"] || resp?.headers?.["Content-Disposition"];
      if (dispo && typeof dispo === "string") {
        const m = dispo.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
        const v = decodeURIComponent((m?.[1] || m?.[2] || "").trim());
        if (v) filename = v;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setErrorMsg("Failed to export CSV.");
    }
  };

  return (
    <Container maxWidth="lg" sx={{ px: 0 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
              Daily Reports
            </Typography>

            {errorMsg ? (
              <Alert sx={{ mb: 2 }} severity="error">
                {errorMsg}
              </Alert>
            ) : null}

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{ mb: 2, flexWrap: "wrap" }}
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <TextField
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", md: "auto" } }}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: "100%", md: "auto" } }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="role-select-label">Role</InputLabel>
                <Select
                  labelId="role-select-label"
                  label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="EMPLOYEE">Employee</MenuItem>
                  <MenuItem value="SUBFRANCHISE">Sub‑Franchise</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Reporter ID (optional)"
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                sx={{ width: { xs: "100%", md: 220 } }}
                value={reporter}
                onChange={(e) => setReporter(e.target.value)}
              />
              <Button
                variant="outlined"
                onClick={() => setReloadKey((k) => k + 1)}
                sx={{ width: { xs: "100%", md: "auto" } }}
              >
                Apply Filters
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setRole("ALL");
                  setReporter("");
                  setReloadKey((k) => k + 1);
                }}
                sx={{ width: { xs: "100%", md: "auto" } }}
              >
                Clear
              </Button>
              <Button
                variant="contained"
                onClick={handleExportCsv}
                sx={{ ml: { md: "auto" }, width: { xs: "100%", md: "auto" } }}
              >
                Export CSV
              </Button>
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
