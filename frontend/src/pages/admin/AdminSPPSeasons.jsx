import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";

const PROMO_PACKAGE_ROUTE = "admin/dynamic/business/promopackage/";
const SPP_SEASON_ROUTE = "admin/dynamic/business/promomonthlypackage/";

function asRows(data) {
  return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
}

function isMonthlyPackage(pkg) {
  return String(pkg?.type || "").toUpperCase() === "MONTHLY";
}

export default function AdminSPPSeasons() {
  const [packages, setPackages] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    package: "",
    number: "",
    total_boxes: "12",
    is_active: true,
  });

  const monthlyPackages = useMemo(
    () => (packages || []).filter(isMonthlyPackage),
    [packages]
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [pkgRes, seasonRes] = await Promise.all([
        API.get(PROMO_PACKAGE_ROUTE, { params: { page: 1, page_size: 300 } }),
        API.get(SPP_SEASON_ROUTE, { params: { page: 1, page_size: 300 } }),
      ]);
      const pkgs = asRows(pkgRes?.data);
      const rows = asRows(seasonRes?.data);
      setPackages(pkgs);
      setSeasons(rows);
      if (!form.package) {
        const firstMonthly = pkgs.find(isMonthlyPackage);
        if (firstMonthly?.id) {
          setForm((prev) => ({ ...prev, package: String(firstMonthly.id) }));
        }
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load SPP seasons.");
      setPackages([]);
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createSeason() {
    const packageId = Number(form.package);
    const number = Number(form.number);
    const totalBoxes = Number(form.total_boxes || 12);

    if (!packageId) {
      setError("Select an SPP promo package.");
      return;
    }
    if (!Number.isInteger(number) || number <= 0) {
      setError("Enter a valid season number.");
      return;
    }
    if (!Number.isInteger(totalBoxes) || totalBoxes <= 0) {
      setError("Enter a valid month count.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await API.post(SPP_SEASON_ROUTE, {
        package: packageId,
        number,
        total_boxes: totalBoxes,
        is_active: !!form.is_active,
      });
      setForm((prev) => ({ ...prev, number: "", total_boxes: "12", is_active: true }));
      await load();
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        data?.detail ||
        data?.non_field_errors?.join?.(", ") ||
        data?.number?.join?.(", ") ||
        "Failed to create SPP season.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSeason(row) {
    const id = row?.id;
    if (!id) return;
    setError("");
    try {
      await API.patch(`${SPP_SEASON_ROUTE}${id}/`, {
        is_active: !row?.is_active,
      });
      setSeasons((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_active: !row?.is_active } : item
        )
      );
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update season status.");
    }
  }

  function packageLabel(pkgId) {
    const rawId = pkgId && typeof pkgId === "object" ? pkgId.id || pkgId.pk : pkgId;
    if (pkgId && typeof pkgId === "object" && (pkgId.name || pkgId.code)) {
      return `${pkgId.name || pkgId.code} (#${rawId || ""})`;
    }
    const pkg = packages.find((p) => String(p.id) === String(rawId));
    return pkg ? `${pkg.name || pkg.code} (#${pkg.id})` : `#${rawId || ""}`;
  }

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1180, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>
            SPP Seasons
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13, mt: 0.5 }}>
            Create Season/SPP numbers that users can select on the SPP purchase screen.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={load} disabled={loading} sx={{ fontWeight: 850 }}>
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
      {loading ? <LinearProgress sx={{ mb: 1.5 }} /> : null}

      <Paper elevation={0} sx={{ p: 2, border: "1px solid #e2e8f0", borderRadius: 3, mb: 2 }}>
        <Typography sx={{ fontWeight: 900, color: "#0f172a", mb: 1 }}>
          Create Season
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr auto auto" }, gap: 1.2, alignItems: "center" }}>
          <TextField
            select
            label="SPP Package"
            size="small"
            value={form.package}
            onChange={(e) => setForm((prev) => ({ ...prev, package: e.target.value }))}
          >
            {monthlyPackages.map((pkg) => (
              <MenuItem key={pkg.id} value={String(pkg.id)}>
                {pkg.name || pkg.code} - Rs. {Number(pkg.price || 1000).toFixed(2)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Season No"
            size="small"
            type="number"
            value={form.number}
            onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
            inputProps={{ min: 1, step: 1 }}
          />
          <TextField
            label="Months"
            size="small"
            type="number"
            value={form.total_boxes}
            onChange={(e) => setForm((prev) => ({ ...prev, total_boxes: e.target.value }))}
            inputProps={{ min: 1, step: 1 }}
          />
          <Button
            variant={form.is_active ? "contained" : "outlined"}
            onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
            sx={{ fontWeight: 850, minHeight: 40 }}
          >
            {form.is_active ? "Active" : "Inactive"}
          </Button>
          <Button variant="contained" onClick={createSeason} disabled={saving} sx={{ fontWeight: 900, minHeight: 40 }}>
            {saving ? "Saving..." : "Create"}
          </Button>
        </Box>
        {!monthlyPackages.length ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            No MONTHLY/SPP promo package found. Create one in Promo Packages first.
          </Alert>
        ) : null}
      </Paper>

      <Paper elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: 3, overflow: "hidden" }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "#f8fafc" }}>
                <TableCell sx={{ fontWeight: 900 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>SPP Package</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Season</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Months</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 900, textAlign: "right" }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {seasons.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>#{row.id}</TableCell>
                  <TableCell>{packageLabel(row.package)}</TableCell>
                  <TableCell sx={{ fontWeight: 850 }}>SPP {row.number}</TableCell>
                  <TableCell>{row.total_boxes || 12}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={row.is_active ? "success" : "default"}
                      label={row.is_active ? "Active" : "Inactive"}
                    />
                  </TableCell>
                  <TableCell sx={{ textAlign: "right" }}>
                    <Button size="small" variant="outlined" onClick={() => toggleSeason(row)} sx={{ fontWeight: 850 }}>
                      {row.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!seasons.length && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, color: "#64748b", textAlign: "center" }}>
                    No SPP seasons created yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
