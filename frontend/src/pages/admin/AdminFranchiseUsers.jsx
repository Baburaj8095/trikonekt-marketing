import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
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

export const INDIAN_STATES = [
  { id: 1, name: "Karnataka" },
  { id: 4009, name: "Goa" },
  { id: 4008, name: "Maharashtra" },
  { id: 3, name: "Tamil Nadu" },
  { id: 4028, name: "Kerala" },
  { id: 4017, name: "Andhra Pradesh" },
  { id: 6, name: "Telangana" },
  { id: 4030, name: "Gujarat" },
  { id: 4057, name: "Rajasthan" },
  { id: 4060, name: "Uttar Pradesh" },
  { id: 4039, name: "Madhya Pradesh" },
  { id: 4062, name: "West Bengal" },
  { id: 4037, name: "Bihar" },
  { id: 4056, name: "Punjab" },
  { id: 4007, name: "Haryana" },
  { id: 4054, name: "Odisha" },
  { id: 4025, name: "Jharkhand" },
  { id: 4040, name: "Chhattisgarh" },
  { id: 4027, name: "Assam" },
  { id: 4020, name: "Himachal Pradesh" },
  { id: 4061, name: "Uttarakhand" },
  { id: 4059, name: "Tripura" },
  { id: 4051, name: "Meghalaya" },
  { id: 4050, name: "Manipur" },
  { id: 4053, name: "Nagaland" },
  { id: 4024, name: "Arunachal Pradesh" },
  { id: 4052, name: "Mizoram" },
  { id: 4058, name: "Sikkim" },
  { id: 4021, name: "Delhi" },
  { id: 4029, name: "Jammu and Kashmir" },
  { id: 4852, name: "Ladakh" },
  { id: 4031, name: "Chandigarh" },
  { id: 4055, name: "Puducherry" },
  { id: 4023, name: "Andaman and Nicobar Islands" },
  { id: 4033, name: "Dadra and Nagar Haveli and Daman and Diu" },
  { id: 4019, name: "Lakshadweep" },
];

export const STATE_DISTRICTS_MAP = {
  Karnataka: [
    "Tumakuru", "Gulbarga", "Kalaburagi", "Hassan", "Bengaluru Urban", "Bengaluru Rural", "Mysuru",
    "Mandya", "Chikkamagaluru", "Shivamogga", "Chitradurga", "Davanagere",
    "Ballari", "Belagavi", "Vijayapura", "Kolar", "Chikkaballapura",
    "Dakshina Kannada", "Udupi", "Uttara Kannada", "Kodagu", "Bagalkote",
    "Bidar", "Chamarajanagara", "Dharwad", "Gadag", "Haveri", "Koppal",
    "Raichur", "Ramanagara", "Vijayanagara", "Yadgir"
  ],
  Goa: ["North Goa", "South Goa"],
  Maharashtra: [
    "Mumbai City", "Mumbai Suburban", "Pune", "Nagpur", "Thane", "Nashik",
    "Aurangabad", "Solapur", "Kolhapur", "Amravati", "Nanded", "Sangli", "Satara"
  ],
  "Tamil Nadu": [
    "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli",
    "Erode", "Vellore", "Thanjavur", "Dindigul", "Kanchipuram", "Tiruppur"
  ],
  Kerala: [
    "Thiruvananthapuram", "Ernakulam", "Kozhikode", "Thrissur", "Kollam", "Palakkad",
    "Malappuram", "Kannur", "Kottayam", "Alappuzha", "Idukki", "Pathanamthitta", "Wayanad", "Kasaragod"
  ],
  "Andhra Pradesh": [
    "Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati",
    "Kakinada", "Rajahmundry", "Kadapa", "Anantapur", "Eluru", "Vizianagaram"
  ],
  Telangana: [
    "Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam",
    "Mahbubnagar", "Nalgonda", "Adilabad", "Suryapet", "Siddipet"
  ],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Junagadh"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Bhilwara", "Alwar", "Sikar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Prayagraj", "Meerut", "Ghaziabad", "Noida", "Bareilly", "Aligarh"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain", "Sagar", "Dewas", "Satna"],
  "West Bengal": ["Kolkata", "Howrah", "North 24 Parganas", "South 24 Parganas", "Hooghly", "Darjeeling", "Siliguri", "Asansol"],
  Bihar: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur"],
  Haryana: ["Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula"],
  Delhi: ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
};

export const KARNATAKA_DISTRICTS = STATE_DISTRICTS_MAP.Karnataka;
export const GOA_DISTRICTS = STATE_DISTRICTS_MAP.Goa;

function getDistrictsForState(stateName) {
  if (STATE_DISTRICTS_MAP[stateName]) {
    return STATE_DISTRICTS_MAP[stateName];
  }
  return [
    `${stateName} Central`,
    `${stateName} North`,
    `${stateName} South`,
    `${stateName} East`,
    `${stateName} West`
  ];
}

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

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: "",
    phone: "",
    password: "Trikonekt@2026!",
    email: "",
    category: "agency_pincode",
    state: "1",
    stateName: "Karnataka",
    district: "",
    pincode: "",
    // Coordinators multi-selectors (strictly max 2)
    selectedPincodes: [],
    selectedDistricts: [],
    selectedStates: [],
  });
  const [pinResolving, setPinResolving] = useState(false);
  const [pinResolvedInfo, setPinResolvedInfo] = useState(null);

  // Auto-resolve Pincode when 6 digits are typed for agency_pincode
  const handlePincodeChange = useCallback(async (val) => {
    const cleaned = String(val || "").replace(/\D/g, "").slice(0, 6);
    setRegisterForm((f) => ({ ...f, pincode: cleaned }));
    if (cleaned.length === 6) {
      setPinResolving(true);
      try {
        let resolvedDistrict = "";
        let resolvedState = "";

        // 1. Try our backend API first (/location/pincode/${cleaned}/)
        try {
          const res = await API.get(`/location/pincode/${cleaned}/`);
          const data = res?.data || {};
          resolvedDistrict = data.district || data.city || data.gram_panchayat || "";
          resolvedState = data.state || "";
        } catch (_) {}

        // 2. If backend didn't return district, fallback to India Post public API
        if (!resolvedDistrict) {
          try {
            const postalRes = await fetch(`https://api.postalpincode.in/pincode/${cleaned}`);
            const postalData = await postalRes.json();
            if (Array.isArray(postalData) && postalData[0]?.Status === "Success") {
              const po = postalData[0]?.PostOffice?.[0];
              if (po) {
                resolvedDistrict = po.District || po.Block || "";
                resolvedState = po.State || "";
              }
            }
          } catch (_) {}
        }

        if (resolvedDistrict) {
          const matchedState = INDIAN_STATES.find(
            (s) => s.name.toLowerCase() === (resolvedState || "").toLowerCase()
          );
          const resolvedStateId = matchedState ? String(matchedState.id) : "1";
          const finalStateName = matchedState ? matchedState.name : (resolvedState || "Karnataka");

          setRegisterForm((f) => ({
            ...f,
            district: resolvedDistrict,
            state: resolvedStateId,
            stateName: finalStateName,
          }));
          setPinResolvedInfo(`${resolvedDistrict}, ${finalStateName}`);
        } else {
          setPinResolvedInfo(null);
        }
      } catch (err) {
        setPinResolvedInfo(null);
      } finally {
        setPinResolving(false);
      }
    } else {
      setPinResolvedInfo(null);
    }
  }, []);

  const saveRegister = useCallback(async () => {
    if (!registerForm.full_name || !registerForm.phone) {
      window.alert("Please provide Full Name and 10-digit Phone Number.");
      return;
    }
    setRegisterSubmitting(true);
    try {
      const payload = {
        role: "agency",
        category: registerForm.category,
        full_name: registerForm.full_name,
        username: registerForm.phone,
        phone: registerForm.phone,
        password: registerForm.password || "Trikonekt@2026!",
        email: registerForm.email || `${registerForm.phone}@trikonekt.in`,
        sponsor_id: "TRIKONEKT",
      };

      if (registerForm.category === "agency_pincode") {
        payload.pincode = registerForm.pincode;
        payload.selected_pincode = registerForm.pincode;
        payload.district = registerForm.district;
        payload.selected_district = registerForm.district;
        payload.state = registerForm.state || 1;
      } else if (registerForm.category === "agency_pincode_coordinator") {
        const pins = (registerForm.selectedPincodes || []).slice(0, 2);
        if (pins.length === 0) {
          window.alert("Please select at least 1 pincode (Max 2 pincodes allowed).");
          setRegisterSubmitting(false);
          return;
        }
        payload.pincode = pins[0];
        payload.pincodes = pins;
        payload.assign_pincodes = pins;
        payload.district = registerForm.district;
        payload.selected_district = registerForm.district;
        payload.state = registerForm.state || 1;
      } else if (registerForm.category === "agency_district") {
        if (!registerForm.district) {
          window.alert("Please select a District.");
          setRegisterSubmitting(false);
          return;
        }
        payload.district = registerForm.district;
        payload.selected_district = registerForm.district;
        payload.state = registerForm.state || 1;
      } else if (registerForm.category === "agency_district_coordinator") {
        const dists = (registerForm.selectedDistricts || []).slice(0, 2);
        if (dists.length === 0) {
          window.alert("Please select at least 1 district (Max 2 districts allowed).");
          setRegisterSubmitting(false);
          return;
        }
        payload.district = dists[0];
        payload.districts = dists;
        payload.assign_districts = dists;
        payload.state = registerForm.state || 1;
      } else if (registerForm.category === "agency_state") {
        payload.state = registerForm.state || 1;
        payload.selected_state = registerForm.state || 1;
      } else if (registerForm.category === "agency_state_coordinator") {
        const stNames = (registerForm.selectedStates || []).slice(0, 2);
        if (stNames.length === 0) {
          window.alert("Please select at least 1 state (Max 2 states allowed).");
          setRegisterSubmitting(false);
          return;
        }
        const stateIds = stNames.map((sn) => {
          const match = INDIAN_STATES.find((s) => s.name.toLowerCase() === sn.toLowerCase());
          return match ? match.id : 1;
        });
        payload.state = stateIds[0];
        payload.assign_states = stateIds;
      }

      await API.post("/accounts/register/", payload);
      window.alert(`Successfully registered ${registerForm.full_name} (${labelFor(registerForm.category)})!`);
      setRegisterOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      window.alert(e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Failed to register agency.");
    } finally {
      setRegisterSubmitting(false);
    }
  }, [registerForm]);

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
        headerName: "Franchise Layer",
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
      <Button variant="contained" color="primary" onClick={() => setRegisterOpen(true)} sx={{ fontWeight: 800, textTransform: "none", bgcolor: "#2563eb" }}>
        + Register Agency Partner
      </Button>
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
              ["Franchise Layer", labelFor(selected?.category)],
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

      <Dialog open={registerOpen} onClose={() => !registerSubmitting && setRegisterOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900, color: "#0F172A" }}>Register New Franchise / Agency Partner</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              size="small"
              label="Full Name *"
              value={registerForm.full_name}
              onChange={(e) => setRegisterForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="e.g. Ramesh Patil"
              required
            />
            <TextField
              size="small"
              label="Phone / Mobile Number (10 digits) *"
              value={registerForm.phone}
              onChange={(e) => setRegisterForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
              placeholder="e.g. 9845012345"
              required
              helperText="This mobile number serves as the username and login identifier."
            />
            <TextField
              size="small"
              label="Email Address"
              value={registerForm.email}
              onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="e.g. partner@trikonekt.in"
            />
            <TextField
              size="small"
              label="Initial Password"
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
            />
            <TextField
              select
              size="small"
              label="Franchise Tier / Category *"
              value={registerForm.category}
              onChange={(e) => setRegisterForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORY_OPTIONS.filter((o) => o.value).map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>

            {/* ============================================================== */}
            {/* CATEGORY 1: PINCODE FRANCHISE (Auto-resolves District & State) */}
            {/* ============================================================== */}
            {registerForm.category === "agency_pincode" && (
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label="Enter 6-Digit Pincode *"
                  value={registerForm.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  placeholder="e.g. 572106"
                  required
                  helperText="District and State are auto-derived as soon as 6 digits are typed."
                  InputProps={{
                    endAdornment: pinResolving ? (
                      <InputAdornment position="end">
                        <CircularProgress size={18} />
                      </InputAdornment>
                    ) : null,
                  }}
                />

                {pinResolvedInfo && (
                  <Alert severity="success" sx={{ py: 0.5, px: 1.5, fontSize: 12.5, fontWeight: 700 }}>
                    📍 Auto-Resolved Location: <strong>{pinResolvedInfo}</strong>
                  </Alert>
                )}

                <TextField
                  size="small"
                  label="District (Auto-Derived) *"
                  value={registerForm.district || ""}
                  placeholder="Auto-derived upon pincode entry"
                  disabled
                  helperText={registerForm.district ? `Locked automatically: ${registerForm.district}` : "Type 6-digit Pincode above to auto-load district."}
                />

                <TextField
                  size="small"
                  label="State (Auto-Derived) *"
                  value={registerForm.stateName || ""}
                  placeholder="Auto-derived upon pincode entry"
                  disabled
                  helperText={registerForm.stateName ? `Locked automatically: ${registerForm.stateName}` : "Type 6-digit Pincode above to auto-load state."}
                />
              </Stack>
            )}

            {/* ============================================================== */}
            {/* CATEGORY 2: PINCODE COORDINATOR (Strict Max 2 Pincodes)       */}
            {/* ============================================================== */}
            {registerForm.category === "agency_pincode_coordinator" && (
              <Stack spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="State *"
                  value={registerForm.stateName}
                  onChange={(e) => {
                    const st = INDIAN_STATES.find((s) => s.name === e.target.value);
                    setRegisterForm((f) => ({
                      ...f,
                      stateName: e.target.value,
                      state: st ? String(st.id) : "1",
                      district: getDistrictsForState(e.target.value)[0] || "Tumakuru",
                    }));
                  }}
                >
                  {INDIAN_STATES.map((s) => (
                    <MenuItem key={s.id} value={s.name}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  size="small"
                  label="District *"
                  value={registerForm.district}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, district: e.target.value }))}
                >
                  {getDistrictsForState(registerForm.stateName).map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </TextField>

                <Autocomplete
                  multiple
                  freeSolo
                  size="small"
                  options={["572106", "572101", "572102", "572103", "572128", "572216"]}
                  value={registerForm.selectedPincodes || []}
                  onChange={(event, newValue) => {
                    if (newValue.length > 2) {
                      window.alert("Maximum 2 pincodes allowed for Pincode Coordinator.");
                      return;
                    }
                    const cleaned = newValue.map((p) => String(p).replace(/\D/g, "").slice(0, 6)).filter(Boolean);
                    setRegisterForm((f) => ({ ...f, selectedPincodes: cleaned }));
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        size="small"
                        color="primary"
                        label={`PIN ${option}`}
                        {...getTagProps({ index })}
                        key={option}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assigned Pincodes (Strictly Max 2) *"
                      placeholder={registerForm.selectedPincodes?.length >= 2 ? "Max 2 reached" : "Type/Select 6-digit PIN and press Enter"}
                      helperText={`Selected: ${registerForm.selectedPincodes?.length || 0} / 2 pincodes. Pincode Coordinator has maximum 2 pincodes jurisdiction.`}
                    />
                  )}
                />
              </Stack>
            )}

            {/* ============================================================== */}
            {/* CATEGORY 3: DISTRICT PARTNER (Strict 1 District)              */}
            {/* ============================================================== */}
            {registerForm.category === "agency_district" && (
              <Stack spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="State *"
                  value={registerForm.stateName}
                  onChange={(e) => {
                    const st = INDIAN_STATES.find((s) => s.name === e.target.value);
                    setRegisterForm((f) => ({
                      ...f,
                      stateName: e.target.value,
                      state: st ? String(st.id) : "1",
                      district: getDistrictsForState(e.target.value)[0] || "Tumakuru",
                    }));
                  }}
                >
                  {INDIAN_STATES.map((s) => (
                    <MenuItem key={s.id} value={s.name}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Assigned District (Select 1 District) *"
                  value={registerForm.district}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, district: e.target.value }))}
                  helperText="District Franchise Partner has strictly 1 district jurisdiction."
                >
                  {getDistrictsForState(registerForm.stateName).map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            )}

            {/* ============================================================== */}
            {/* CATEGORY 4: DISTRICT COORDINATOR (Strict Max 2 Districts)      */}
            {/* ============================================================== */}
            {registerForm.category === "agency_district_coordinator" && (
              <Stack spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="State *"
                  value={registerForm.stateName}
                  onChange={(e) => {
                    const st = INDIAN_STATES.find((s) => s.name === e.target.value);
                    setRegisterForm((f) => ({
                      ...f,
                      stateName: e.target.value,
                      state: st ? String(st.id) : "1",
                      selectedDistricts: [getDistrictsForState(e.target.value)[0] || "Tumakuru"],
                    }));
                  }}
                >
                  {INDIAN_STATES.map((s) => (
                    <MenuItem key={s.id} value={s.name}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>

                <Autocomplete
                  multiple
                  size="small"
                  options={getDistrictsForState(registerForm.stateName)}
                  value={registerForm.selectedDistricts || []}
                  onChange={(event, newValue) => {
                    if (newValue.length > 2) {
                      window.alert("Maximum 2 districts allowed for District Coordinator.");
                      return;
                    }
                    setRegisterForm((f) => ({ ...f, selectedDistricts: newValue, district: newValue[0] || "" }));
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        size="small"
                        color="secondary"
                        label={option}
                        {...getTagProps({ index })}
                        key={option}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assigned Districts (Strictly Max 2) *"
                      placeholder={registerForm.selectedDistricts?.length >= 2 ? "Max 2 reached" : "Select districts..."}
                      helperText={`Selected: ${registerForm.selectedDistricts?.length || 0} / 2 districts. District Coordinator has maximum 2 districts jurisdiction.`}
                    />
                  )}
                />
              </Stack>
            )}

            {/* ============================================================== */}
            {/* CATEGORY 5: STATE PARTNER (Strict 1 State)                    */}
            {/* ============================================================== */}
            {registerForm.category === "agency_state" && (
              <Stack spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="Assigned State (Select 1 State) *"
                  value={registerForm.stateName}
                  onChange={(e) => {
                    const st = INDIAN_STATES.find((s) => s.name === e.target.value);
                    setRegisterForm((f) => ({
                      ...f,
                      stateName: e.target.value,
                      state: st ? String(st.id) : "1",
                    }));
                  }}
                  helperText="State Franchise Partner has strictly 1 state jurisdiction."
                >
                  {INDIAN_STATES.map((s) => (
                    <MenuItem key={s.id} value={s.name}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            )}

            {/* ============================================================== */}
            {/* CATEGORY 6: STATE COORDINATOR (Strict Max 2 States)           */}
            {/* ============================================================== */}
            {registerForm.category === "agency_state_coordinator" && (
              <Stack spacing={1.5}>
                <Autocomplete
                  multiple
                  size="small"
                  options={INDIAN_STATES.map((s) => s.name)}
                  value={registerForm.selectedStates || []}
                  onChange={(event, newValue) => {
                    if (newValue.length > 2) {
                      window.alert("Maximum 2 states allowed for State Coordinator.");
                      return;
                    }
                    setRegisterForm((f) => ({ ...f, selectedStates: newValue }));
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        size="small"
                        color="info"
                        label={option}
                        {...getTagProps({ index })}
                        key={option}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Assigned States (Strictly Max 2) *"
                      placeholder={registerForm.selectedStates?.length >= 2 ? "Max 2 reached" : "Select states..."}
                      helperText={`Selected: ${registerForm.selectedStates?.length || 0} / 2 states. State Coordinator has maximum 2 states jurisdiction.`}
                    />
                  )}
                />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRegisterOpen(false)} disabled={registerSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveRegister}
            disabled={registerSubmitting}
            sx={{ bgcolor: "#2563EB", fontWeight: 800, textTransform: "none" }}
          >
            {registerSubmitting ? "Registering..." : "Complete Registration"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
