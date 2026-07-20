import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import API from "../../api/api";
import DataTable from "../../admin-panel/components/data/DataTable";

const CATEGORY_OPTIONS = [
  { value: "", label: "All franchise users" },
  { value: "agency_state_coordinator", label: "State Coordinator" },
  { value: "agency_state", label: "State" },
  { value: "agency_district_coordinator", label: "District Coordinator" },
  { value: "agency_district", label: "District" },
  { value: "agency_pincode_coordinator", label: "Pincode Coordinator" },
  { value: "agency_pincode", label: "Pincode" },
];

function labelFor(value) {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label || "All franchise users";
}

export default function AdminFranchiseUsers() {
  const location = useLocation();
  const params = new URLSearchParams(location.search || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search || "");
    setCategory(searchParams.get("category") || "");
  }, [location.search]);

  const openView = useCallback(async (row) => {
    if (!row?.id) return;
    setSelected(row);
    setViewOpen(true);
    try {
      const res = await API.get(`/admin/users/${row.id}/`, { timeout: 12000 });
      setSelected({ ...row, ...(res?.data || {}) });
    } catch (_) {}
  }, []);

  const openEdit = useCallback(async (row) => {
    if (!row?.id) return;
    let data = row;
    try {
      const res = await API.get(`/admin/users/${row.id}/`, { timeout: 12000 });
      data = { ...row, ...(res?.data || {}) };
    } catch (_) {}
    setSelected(data);
    setEditForm({
      full_name: data.full_name || "",
      phone: data.phone || "",
      email: data.email || "",
      pincode: data.pincode || "",
      state: data.state || "",
      city: data.city || "",
      account_active: !!data.account_active,
    });
    setEditOpen(true);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      const payload = {
        full_name: editForm.full_name || "",
        phone: editForm.phone || "",
        email: editForm.email || "",
        pincode: editForm.pincode || "",
        account_active: !!editForm.account_active,
      };
      if (String(editForm.state || "").trim()) payload.state = editForm.state;
      if (String(editForm.city || "").trim()) payload.city = editForm.city;
      await API.patch(`/admin/users/${selected.id}/`, payload);
      setEditOpen(false);
      setSelected(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      window.alert(e?.response?.data?.detail || e?.message || "Failed to update franchise user.");
    } finally {
      setSaving(false);
    }
  }, [editForm, selected]);

  const toggleAccess = useCallback(async (row) => {
    if (!row?.id) return;
    const canLogin = row.is_active !== false;
    const action = canLogin ? "deactivate" : "activate";
    const label = canLogin ? "block" : "unblock";
    const ok = window.confirm(`${canLogin ? "Block" : "Unblock"} ${row.full_name || row.username || "this franchise user"}?`);
    if (!ok) return;
    try {
      await API.post(`/admin/users/${row.id}/${action}/`, {});
      setRefreshKey((k) => k + 1);
    } catch (e) {
      window.alert(e?.response?.data?.detail || e?.message || `Failed to ${label} franchise user.`);
    }
  }, []);

  const impersonate = useCallback(async (row) => {
    if (!row?.id || row.is_active === false) return;
    try {
      const res = await API.post(`/admin/users/${row.id}/impersonate/`);
      const { access, refresh } = res?.data || {};
      if (!access || !refresh) return;
      const query = new URLSearchParams({
        access,
        refresh,
        ns: "agency",
        next: "/agency/franchise-dashboard",
      });
      window.location.assign(`/agency/impersonate?${query.toString()}`);
    } catch (e) {
      window.alert(e?.response?.data?.detail || e?.message || "Unable to login as franchise user.");
    }
  }, []);

  const fetcher = useCallback(
    async ({ page, pageSize, search, ordering }) => {
      const req = {
        page,
        page_size: pageSize,
        role: "agency",
      };
      if (category) req.category = category;
      if (search) req.search = search;
      if (ordering) req.ordering = ordering;
      if (pincode) req.pincode = pincode;
      if (state) req.state = state;
      const res = await API.get("/admin/users/", { params: req, timeout: 25000 });
      return {
        results: res?.data?.results || [],
        count: res?.data?.count || 0,
      };
    },
    [category, pincode, state]
  );

  const columns = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 90 },
      { field: "user_code", headerName: "Code", minWidth: 150, flex: 1, valueGetter: (params) => params?.row?.user_code || params?.row?.prefixed_id || params?.row?.username },
      { field: "full_name", headerName: "Name", minWidth: 180, flex: 1 },
      { field: "username", headerName: "Username", minWidth: 160, flex: 1 },
      { field: "phone", headerName: "Phone", minWidth: 130 },
      {
        field: "__login",
        headerName: "Login",
        width: 96,
        align: "center",
        headerAlign: "center",
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params?.row || {};
          const canLogin = row.is_active !== false;
          return (
            <Button
              size="small"
              variant="contained"
              disabled={!canLogin}
              onClick={(e) => {
                e?.stopPropagation?.();
                impersonate(row);
              }}
              sx={{ minWidth: 64, bgcolor: canLogin ? "#2563eb" : "#94a3b8", textTransform: "none", fontWeight: 700 }}
            >
              Login
            </Button>
          );
        },
      },
      {
        field: "category",
        headerName: "Franchise Level",
        minWidth: 210,
        renderCell: (params) => <Chip size="small" label={labelFor(params?.row?.category)} />,
      },
      { field: "state_name", headerName: "State", minWidth: 150, flex: 1, valueGetter: (params) => params?.row?.state_name || params?.row?.state || "" },
      {
        field: "assigned_regions_summary",
        headerName: "Assigned Regions",
        minWidth: 260,
        flex: 1,
        renderCell: (params) => params?.row?.assigned_regions_summary || "-",
      },
      { field: "pincode", headerName: "Pincode", minWidth: 110 },
      {
        field: "account_active",
        headerName: "Status",
        width: 130,
        renderCell: (params) => <Chip size="small" color={params?.row?.account_active ? "success" : "warning"} label={params?.row?.account_active ? "Active" : "Inactive"} />,
      },
      {
        field: "is_active",
        headerName: "Access",
        width: 120,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          const canLogin = params?.row?.is_active !== false;
          return <Chip size="small" color={canLogin ? "success" : "error"} label={canLogin ? "Allowed" : "Blocked"} />;
        },
      },
      {
        field: "__wallet",
        headerName: "Wallet",
        width: 120,
        renderCell: (params) => (
          <Button component={Link} to={`/admin/franchise/wallets?user=${params?.row?.id || ""}`} size="small" variant="outlined">
            Open
          </Button>
        ),
      },
      {
        field: "__actions",
        headerName: "Actions",
        minWidth: 360,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params?.row || {};
          const canLogin = row.is_active !== false;
          return (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ width: "100%" }}>
              <Button size="small" variant="contained" color="inherit" onClick={() => openView(row)} sx={{ minWidth: 58, bgcolor: "#0f172a", color: "#fff" }}>
                View
              </Button>
              <Button size="small" variant="outlined" onClick={() => openEdit(row)} sx={{ minWidth: 54 }}>
                Edit
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!canLogin}
                onClick={() => impersonate(row)}
                sx={{ minWidth: 62, bgcolor: canLogin ? "#2563eb" : "#94a3b8" }}
              >
                Login
              </Button>
              <Button
                size="small"
                variant="contained"
                color={canLogin ? "error" : "success"}
                onClick={() => toggleAccess(row)}
                sx={{ minWidth: 76 }}
              >
                {canLogin ? "Block" : "Unblock"}
              </Button>
            </Stack>
          );
        },
      },
    ],
    [impersonate, openEdit, openView, toggleAccess]
  );

  const toolbar = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <TextField select size="small" label="Franchise level" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 230 }}>
        {CATEGORY_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
        ))}
      </TextField>
      <TextField size="small" label="State ID" value={state} onChange={(e) => setState(e.target.value)} sx={{ minWidth: 130 }} />
      <TextField size="small" label="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} sx={{ minWidth: 130 }} />
      <Button variant="contained" onClick={() => setRefreshKey((k) => k + 1)}>Apply</Button>
      <Button component={Link} to="/admin/franchise/dashboard" variant="outlined">Dashboard</Button>
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1440, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950, color: "#0f172a" }}>Franchise User Table</Typography>
          <Typography sx={{ color: "#64748b", fontSize: 13 }}>
            Dedicated agency/franchise user screen for State Coordinator, State, District Coordinator, District, Pincode Coordinator, and Pincode.
          </Typography>
        </Box>
        <Paper variant="outlined" sx={{ px: 1.25, py: 1, borderRadius: 1 }}>
          <Typography sx={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Current view</Typography>
          <Typography sx={{ fontWeight: 950 }}>{labelFor(category)}</Typography>
        </Paper>
      </Stack>
      <DataTable
        key={refreshKey}
        columns={columns}
        fetcher={fetcher}
        toolbar={toolbar}
        checkboxSelection={false}
        density="standard"
        extraKey={`${category}-${state}-${pincode}`}
      />

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Franchise User Details</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            {[
              ["Name", selected?.full_name],
              ["Username", selected?.username],
              ["Phone", selected?.phone],
              ["Email", selected?.email],
              ["Code", selected?.user_code || selected?.prefixed_id],
              ["Franchise Level", labelFor(selected?.category)],
              ["State", selected?.state_name || selected?.state],
              ["Pincode", selected?.pincode],
              ["Account", selected?.account_active ? "Active" : "Inactive"],
              ["Access", selected?.is_active === false ? "Blocked" : "Allowed"],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 1 }}>
                <Typography sx={{ color: "#64748b", fontWeight: 800, fontSize: 13 }}>{label}</Typography>
                <Typography sx={{ color: "#0f172a", fontWeight: 700, overflowWrap: "anywhere" }}>{value || "-"}</Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Franchise User</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <TextField size="small" label="Full Name" value={editForm.full_name || ""} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} />
            <TextField size="small" label="Phone / Login User ID" value={editForm.phone || ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            <TextField size="small" label="Email" value={editForm.email || ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            <TextField size="small" label="State ID" value={editForm.state || ""} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))} />
            <TextField size="small" label="District/City ID" value={editForm.city || ""} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
            <TextField size="small" label="Pincode" value={editForm.pincode || ""} onChange={(e) => setEditForm((f) => ({ ...f, pincode: e.target.value }))} />
            <TextField
              select
              size="small"
              label="Account Status"
              value={editForm.account_active ? "1" : "0"}
              onChange={(e) => setEditForm((f) => ({ ...f, account_active: e.target.value === "1" }))}
            >
              <MenuItem value="1">Active</MenuItem>
              <MenuItem value="0">Inactive</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
