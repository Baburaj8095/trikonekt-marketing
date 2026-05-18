import React, { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
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
        field: "__wallet",
        headerName: "Wallet",
        width: 120,
        renderCell: (params) => (
          <Button component={Link} to={`/admin/franchise/wallets?user=${params?.row?.id || ""}`} size="small" variant="outlined">
            Open
          </Button>
        ),
      },
    ],
    []
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
    </Box>
  );
}
